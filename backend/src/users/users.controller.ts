import { BadRequestException, Controller, Get, Post, Patch, Put, Body, UseGuards, Req, Param, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { SettingsService } from '../admin/settings.service';
import { User, UserType } from './entities/user.entity';
import { AnalyticsService } from '../analytics/analytics.service';

const STRUCTURED_RESUME_MARKER = 'structured://published';
const STORED_RESUME_MARKER = 'stored://uploaded';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly analytics: AnalyticsService,
    private readonly settingsService: SettingsService,
  ) {}

  private isBootstrapAdmin(email?: string): boolean {
    if (!email) return false;
    const admins = (this.configService.get<string>('ADMIN_EMAILS') || '')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    return admins.includes(email.toLowerCase());
  }

  private validateSensitiveJobPreferences(updateData: Partial<User>) {
    const preferences = updateData.jobPreferences;
    if (!preferences) return;
    const declaration = preferences.pcdDeclaration ?? 'NOT_INFORMED';
    const validDeclarations = ['NOT_INFORMED', 'YES', 'NO'];
    const validDocumentationStatuses = ['NOT_INFORMED', 'HAS_REPORT', 'NO_REPORT', 'IN_PROGRESS'];
    if (!validDeclarations.includes(declaration)) throw new BadRequestException('Autodeclaração PcD inválida.');
    if (preferences.pcdDocumentationStatus && !validDocumentationStatuses.includes(preferences.pcdDocumentationStatus)) {
      throw new BadRequestException('Status de documentação PcD inválido.');
    }
    if (declaration !== 'NOT_INFORMED' && preferences.pcdDataConsent !== true) {
      throw new BadRequestException('O tratamento da autodeclaração PcD exige consentimento específico e destacado.');
    }
    if (declaration !== 'YES' && preferences.pcdDocumentationStatus && preferences.pcdDocumentationStatus !== 'NOT_INFORMED') {
      throw new BadRequestException('O status de documentação só pode ser informado por quem se autodeclarou PcD.');
    }
    if (declaration !== 'YES' && preferences.includeExclusivePcdJobs === true) {
      throw new BadRequestException('Vagas exclusivas PcD só podem ser ativadas após autodeclaração voluntária.');
    }
  }

  private validateResumePublication(updateData: Partial<User>) {
    if (updateData.resumeStatus !== undefined && !['DRAFT', 'PUBLISHED'].includes(updateData.resumeStatus)) {
      throw new BadRequestException('Status do currículo inválido.');
    }
    if (updateData.publishedResumeSnapshot !== undefined) {
      throw new BadRequestException('A versão publicada do currículo é gerenciada exclusivamente pelo servidor.');
    }
    if (updateData.uploadedResumeFile !== undefined && updateData.uploadedResumeFile !== null) {
      const file = updateData.uploadedResumeFile;
      if (!file.name?.trim() || !file.dataUrl?.startsWith('data:')) throw new BadRequestException('Arquivo-base do currículo inválido.');
      if (!Number.isFinite(file.size) || file.size < 0 || file.size > 20 * 1024 * 1024) {
        throw new BadRequestException('O arquivo-base do currículo deve ter no máximo 20 MB.');
      }
    }
  }

  private resumeFileMetadata(file: User['uploadedResumeFile']) {
    if (!file) return null;
    return {
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt,
    };
  }

  private buildPublishedResumeSnapshot(profile: User, publishedAt: Date): Record<string, unknown> {
    const aiScore = profile.aiAnalysis && typeof profile.aiAnalysis === 'object'
      ? Number((profile.aiAnalysis as Record<string, unknown>).score)
      : Number.NaN;
    return {
      version: 1,
      publishedAt: publishedAt.toISOString(),
      fullName: profile.fullName,
      socialName: profile.socialName,
      phone: profile.phone,
      email: profile.email,
      city: profile.city,
      state: profile.state,
      address: profile.address,
      bio: profile.bio,
      experiences: this.usersService.normalizeExperienceDates(profile.experiences) || [],
      education: Array.isArray(profile.education) ? profile.education : [],
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      courses: Array.isArray(profile.courses) ? profile.courses : [],
      languages: Array.isArray(profile.languages) ? profile.languages : [],
      salaryExpectation: profile.salaryExpectation,
      resumePhotoURL: profile.resumePhotoURL,
      resumePreferences: profile.resumePreferences || {},
      score: Number.isFinite(aiScore) ? Math.max(0, Math.min(100, Math.round(aiScore))) : null,
    };
  }

  private async exposeProfileForRuntime(profile: User) {
    const runtimeProfile = {
      ...profile,
      type: profile.type ?? UserType.CANDIDATE,
      resumeStatus: profile.resumeStatus || 'DRAFT',
      uploadedResumeFile: this.resumeFileMetadata(profile.uploadedResumeFile),
      experiences: this.usersService.normalizeExperienceDates(profile.experiences),
    };
    const aiEnabled = (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const canExposeResumeAnalysis = aiEnabled && Boolean(profile.resumeScoreUnlocked || profile.hasAiAnalyzed || profile.aiAnalysis);
    if (canExposeResumeAnalysis) return runtimeProfile;
    const { aiAnalysis: _aiAnalysis, ...safeProfile } = runtimeProfile;
    return { ...safeProfile, hasAiAnalyzed: false };
  }

  @Get('me/resume-file')
  async getResumeFile(@Req() req: any) {
    const user = await this.usersService.findOneOrNull(req.user.uid);
    return user?.uploadedResumeFile || null;
  }

  @Get('me')
  async getProfile(@Req() req: any) {
    const user = req.user;
    void this.analytics.recordAccountAccess(user.uid, req.headers).catch(() => undefined);
    const existing = await this.usersService.findOneOrNull(user.uid);
    if (this.isBootstrapAdmin(user.email)) {
      if (!existing || existing.type !== UserType.ADMIN) {
        const profile = await this.usersService.createOrUpdate(user.uid, {
          type: UserType.ADMIN,
          displayName: existing?.displayName || user.name || user.email,
          fullName: existing?.fullName || user.name || user.email,
          email: user.email,
        });
        return this.exposeProfileForRuntime(profile);
      }
      return this.exposeProfileForRuntime(existing);
    }
    if (existing) return this.exposeProfileForRuntime(existing);
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!email) throw new BadRequestException('Sua conta de autenticação precisa possuir um e-mail válido.');
    const displayName = (typeof user.name === 'string' && user.name.trim()) || email.split('@')[0];
    const profile = await this.usersService.createOrUpdate(user.uid, { email, displayName, fullName: displayName });
    return this.exposeProfileForRuntime(profile);
  }

  @Post('me')
  @Patch('me')
  async updateProfile(@Req() req: any, @Body() updateData: Partial<User>) {
    const user = req.user;
    const existing = await this.usersService.findOneOrNull(user.uid);
    this.validateSensitiveJobPreferences(updateData);
    this.validateResumePublication(updateData);
    const sanitized = this.usersService.sanitizeSelfUpdate(updateData, existing);

    if (
      updateData.type === UserType.ADMIN ||
      updateData.isCompanyAdmin !== undefined ||
      updateData.companyId !== undefined ||
      updateData.resumeScoreUnlocked !== undefined
    ) {
      throw new BadRequestException('Campos de papel, vínculo corporativo e recursos premium são gerenciados exclusivamente pelo servidor.');
    }

    if (updateData.uploadedResumeFile !== undefined) {
      if (updateData.uploadedResumeFile) {
        if (!existing?.resumeURL?.trim() || existing.resumeURL === STRUCTURED_RESUME_MARKER || existing.resumeURL === STORED_RESUME_MARKER) {
          sanitized.resumeURL = STORED_RESUME_MARKER;
        }
      } else if (existing?.resumeURL === STORED_RESUME_MARKER) {
        sanitized.resumeURL = existing.resumeStatus === 'PUBLISHED' && existing.publishedResumeSnapshot
          ? STRUCTURED_RESUME_MARKER
          : '';
      }
    }

    if (updateData.resumeStatus === 'PUBLISHED') {
      const merged = { ...(existing || {}), ...sanitized } as User;
      const hasStructuredResume = Boolean(
        merged.bio?.trim() ||
        (Array.isArray(merged.experiences) && merged.experiences.length) ||
        (Array.isArray(merged.education) && merged.education.length) ||
        (Array.isArray(merged.skills) && merged.skills.length),
      );
      if (!hasStructuredResume) {
        throw new BadRequestException('Complete ao menos o resumo, experiências, formação ou habilidades antes de publicar o currículo.');
      }
      const publishedAt = new Date();
      sanitized.resumeStatus = 'PUBLISHED';
      sanitized.resumePublishedAt = publishedAt;
      sanitized.publishedResumeSnapshot = this.buildPublishedResumeSnapshot(merged, publishedAt);
      const resumeUrl = sanitized.resumeURL ?? existing?.resumeURL;
      if (!resumeUrl?.trim() || resumeUrl === STRUCTURED_RESUME_MARKER || resumeUrl === STORED_RESUME_MARKER) {
        sanitized.resumeURL = merged.uploadedResumeFile ? STORED_RESUME_MARKER : STRUCTURED_RESUME_MARKER;
      }
    } else if (updateData.resumeStatus === 'DRAFT') {
      // Tirar do ar não apaga a última versão publicada. O rascunho também permanece intacto.
      sanitized.resumeStatus = 'DRAFT';
      sanitized.resumePublishedAt = existing?.resumePublishedAt || null;
      sanitized.publishedResumeSnapshot = existing?.publishedResumeSnapshot || null;
      sanitized.resumeURL = existing?.uploadedResumeFile ? STORED_RESUME_MARKER : '';
    } else if (existing?.resumeStatus === 'PUBLISHED') {
      // Editar o rascunho não derruba nem altera a versão já publicada.
      sanitized.resumeStatus = 'PUBLISHED';
      sanitized.resumePublishedAt = existing.resumePublishedAt;
      sanitized.publishedResumeSnapshot = existing.publishedResumeSnapshot;
    }

    if (typeof user.email === 'string' && user.email.trim()) sanitized.email = user.email.trim().toLowerCase();
    else if (!existing) throw new BadRequestException('Sua conta de autenticação precisa possuir um e-mail válido.');
    if (this.isBootstrapAdmin(user.email)) sanitized.type = UserType.ADMIN;
    return this.usersService.createOrUpdate(user.uid, sanitized);
  }

  @Put(':id/fcm-token')
  async updateFcmToken(@Req() req: any, @Param('id') id: string, @Body('token') token: unknown) {
    if (id !== req.user.uid) throw new ForbiddenException('Você só pode atualizar o seu próprio dispositivo.');
    if (typeof token !== 'string' || token.length > 4096) throw new BadRequestException('Token de dispositivo inválido.');
    return this.usersService.createOrUpdate(id, { fcmToken: token });
  }
}
