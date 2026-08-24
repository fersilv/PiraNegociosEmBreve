import { BadRequestException, Controller, Delete, Get, Post, Patch, Put, Body, UseGuards, Req, Param, Headers, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { SettingsService } from '../admin/settings.service';
import { User, UserType } from './entities/user.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { CompanyTalentInvite } from '../companies/entities/company-talent-invite.entity';
import { Job } from '../jobs/entities/job.entity';
import { hashInviteToken, maskInviteEmail, normalizeInviteEmail } from '../companies/talent-invite.utils';

const STRUCTURED_RESUME_MARKER = 'structured://published';
const STORED_RESUME_MARKER = 'stored://uploaded';
const RESUME_DELETE_CONFIRMATION = 'EXCLUIR MEU CURRICULO';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly analytics: AnalyticsService,
    private readonly settingsService: SettingsService,
    @InjectRepository(CompanyTalentInvite)
    private readonly talentInvites: Repository<CompanyTalentInvite>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
  ) {}

  private isBootstrapAdmin(email?: string): boolean {
    if (!email) return false;
    const admins = (this.configService.get<string>('ADMIN_EMAILS') || '')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    return admins.includes(email.toLowerCase());
  }

  private async resolveRegistrationInvite(
    token: string | undefined,
    email: string | undefined,
    uid: string,
  ) {
    if (!token) return null;
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token))
      throw new ForbiddenException('Convite inválido ou expirado.');
    const invite = await this.talentInvites.findOne({
      where: { tokenHash: hashInviteToken(token) },
    });
    const job = invite
      ? await this.jobs.findOne({ where: { id: invite.jobId, active: true } })
      : null;
    const today = new Date().toISOString().slice(0, 10);
    if (
      !invite ||
      !['PENDING', 'ACCEPTED'].includes(invite.status) ||
      !job ||
      !invite.expiresAt ||
      invite.expiresAt.getTime() < Date.now() ||
      (job.deadlineDate && job.deadlineDate < today)
    ) {
      throw new ForbiddenException('Convite inválido ou expirado.');
    }
    const normalizedEmail = normalizeInviteEmail(email);
    if (!normalizedEmail || normalizedEmail !== invite.candidateEmail) {
      throw new ForbiddenException({
        code: 'INVITE_EMAIL_MISMATCH',
        message: `Este convite foi enviado para ${invite.candidateEmail ? maskInviteEmail(invite.candidateEmail) : 'outro e-mail'}. Entre com a conta correta.`,
      });
    }
    if (invite.candidateId && invite.candidateId !== uid)
      throw new ForbiddenException('Este convite já está vinculado a outra conta.');
    return invite;
  }

  private async ensureRegistrationAllowed(
    existing: User | null,
    email: string | undefined,
    inviteToken: string | undefined,
    uid: string,
  ) {
    const invite = await this.resolveRegistrationInvite(inviteToken, email, uid);
    if (invite || existing || this.isBootstrapAdmin(email)) return invite;
    const registrationsOpen = (await this.settingsService.getValue('ALLOW_NEW_REGISTRATIONS', 'true')) === 'true';
    if (!registrationsOpen) {
      throw new ForbiddenException({
        code: 'REGISTRATION_CLOSED',
        message: 'Novos cadastros estão temporariamente pausados. Entre na lista de espera para ser avisado quando reabrirmos.',
      });
    }
    return null;
  }

  private async linkRegistrationInvite(
    invite: CompanyTalentInvite | null,
    profile: User,
  ) {
    if (!invite) return;
    invite.candidateId = profile.id;
    invite.registeredAt = invite.registeredAt || profile.createdAt || new Date();
    await this.talentInvites.save(invite);
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
      jobPreferences: profile.jobPreferences || {},
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
  async getProfile(
    @Req() req: any,
    @Headers('x-talent-invite-token') inviteToken?: string,
  ) {
    const user = req.user;
    void this.analytics.recordAccountAccess(user.uid, req.headers).catch(() => undefined);
    const existing = await this.usersService.findOneOrNull(user.uid);
    const registrationInvite = await this.ensureRegistrationAllowed(
      existing,
      user.email,
      inviteToken,
      user.uid,
    );
    if (this.isBootstrapAdmin(user.email)) {
      if (!existing || existing.type !== UserType.ADMIN) {
        const profile = await this.usersService.createOrUpdate(user.uid, {
          type: UserType.ADMIN,
          displayName: existing?.displayName || user.name || user.email,
          fullName: existing?.fullName || user.name || user.email,
          email: user.email,
        });
        await this.linkRegistrationInvite(registrationInvite, profile);
        return this.exposeProfileForRuntime(profile);
      }
      await this.linkRegistrationInvite(registrationInvite, existing);
      return this.exposeProfileForRuntime(existing);
    }
    if (existing) {
      await this.linkRegistrationInvite(registrationInvite, existing);
      return this.exposeProfileForRuntime(existing);
    }
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!email) throw new BadRequestException('Sua conta de autenticação precisa possuir um e-mail válido.');
    const displayName = (typeof user.name === 'string' && user.name.trim()) || email.split('@')[0];
    const profile = await this.usersService.createOrUpdate(user.uid, { email, displayName, fullName: displayName });
    await this.linkRegistrationInvite(registrationInvite, profile);
    return this.exposeProfileForRuntime(profile);
  }

  @Post('me')
  @Patch('me')
  async updateProfile(
    @Req() req: any,
    @Body() updateData: Partial<User>,
    @Headers('x-talent-invite-token') inviteToken?: string,
  ) {
    const user = req.user;
    const existing = await this.usersService.findOneOrNull(user.uid);
    const registrationInvite = await this.ensureRegistrationAllowed(
      existing,
      user.email,
      inviteToken,
      user.uid,
    );
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
      sanitized.resumeStatus = 'DRAFT';
      sanitized.resumePublishedAt = existing?.resumePublishedAt || null;
      sanitized.publishedResumeSnapshot = existing?.publishedResumeSnapshot || null;
      sanitized.resumeURL = existing?.uploadedResumeFile ? STORED_RESUME_MARKER : '';
    } else if (existing?.resumeStatus === 'PUBLISHED') {
      sanitized.resumeStatus = 'PUBLISHED';
      sanitized.resumePublishedAt = existing.resumePublishedAt;
      sanitized.publishedResumeSnapshot = existing.publishedResumeSnapshot;
    }

    if (typeof user.email === 'string' && user.email.trim()) sanitized.email = user.email.trim().toLowerCase();
    else if (!existing) throw new BadRequestException('Sua conta de autenticação precisa possuir um e-mail válido.');
    if (this.isBootstrapAdmin(user.email)) sanitized.type = UserType.ADMIN;
    const profile = await this.usersService.createOrUpdate(user.uid, sanitized);
    await this.linkRegistrationInvite(registrationInvite, profile);
    return profile;
  }

  @Delete('me/resume')
  async deleteResume(@Req() req: any, @Body('confirmation') confirmation: unknown) {
    const normalized = String(confirmation || '').trim().toUpperCase();
    if (normalized !== RESUME_DELETE_CONFIRMATION) {
      throw new BadRequestException({
        code: 'RESUME_DELETE_CONFIRMATION_REQUIRED',
        message: `Para excluir definitivamente, digite exatamente: ${RESUME_DELETE_CONFIRMATION}`,
      });
    }
    const result = await this.usersService.deleteResumePermanently(req.user.uid);
    return {
      ...result,
      freeUsageReset: false,
      message: 'Currículo e cópias de currículo excluídos definitivamente. Seus limites gratuitos já utilizados foram preservados.',
    };
  }

  @Put(':id/fcm-token')
  async updateFcmToken(@Req() req: any, @Param('id') id: string, @Body('token') token: unknown) {
    if (id !== req.user.uid) throw new ForbiddenException('Você só pode atualizar o seu próprio dispositivo.');
    if (typeof token !== 'string' || token.length > 4096) throw new BadRequestException('Token de dispositivo inválido.');
    return this.usersService.createOrUpdate(id, { fcmToken: token });
  }
}
