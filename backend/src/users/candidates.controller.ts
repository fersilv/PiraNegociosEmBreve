import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Company } from '../companies/entities/company.entity';
import { SettingsService } from '../admin/settings.service';
import { User, UserType } from './entities/user.entity';

type AuthenticatedRequest = { user: { uid: string } };

@Controller('candidates')
@UseGuards(FirebaseAuthGuard)
export class CandidatesController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly settingsService: SettingsService,
  ) {}

  private async assertTalentAccess(uid: string) {
    const viewer = await this.users.findOne({ where: { id: uid } });
    if (!viewer) throw new ForbiddenException('Conta não encontrada.');

    if (viewer.type !== UserType.ADMIN) {
      if (!viewer.companyId)
        throw new ForbiddenException(
          'O banco de talentos é destinado a empresas verificadas.',
        );
      const company = await this.companies.findOne({
        where: { id: viewer.companyId },
      });
      if (!company?.isVerified)
        throw new ForbiddenException(
          'A empresa precisa ser verificada para acessar o banco de talentos.',
        );
    }
  }

  private serializeCandidate(candidate: User, aiEnabled: boolean) {
    const candidateData: Partial<User> = { ...candidate };
    delete candidateData.aiAnalysis;
    delete candidateData.uploadedResumeFile;
    delete candidateData.publishedResumeSnapshot;
    delete candidateData.resumeURL;
    const safeJobPreferences = { ...(candidate.jobPreferences || {}) };
    delete safeJobPreferences.pcdDeclaration;
    delete safeJobPreferences.pcdDocumentationStatus;
    delete safeJobPreferences.pcdDataConsent;
    delete safeJobPreferences.includeExclusivePcdJobs;
    const published =
      candidate.resumeStatus === 'PUBLISHED' &&
      Boolean(candidate.publishedResumeSnapshot);

    return {
      ...candidateData,
      resumeURL: published ? candidate.resumeURL : '',
      publishedResumeSnapshot: published
        ? candidate.publishedResumeSnapshot
        : null,
      jobPreferences: safeJobPreferences,
      ...(aiEnabled ? { aiAnalysis: candidate.aiAnalysis } : {}),
      name:
        candidate.socialName ||
        candidate.fullName ||
        candidate.displayName ||
        'Candidato',
    };
  }

  @Get('by-email')
  async findByEmail(
    @Req() req: AuthenticatedRequest,
    @Query('email') value: string,
  ) {
    await this.assertTalentAccess(req.user.uid);
    const email = String(value || '')
      .trim()
      .toLowerCase();
    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      return null;

    const candidate = await this.users
      .createQueryBuilder('candidate')
      .where('LOWER(candidate."email") = :email', { email })
      .andWhere('candidate."isOpenToWork" = true')
      .andWhere(
        '(candidate."type" IS NULL OR candidate."type" <> :adminType)',
        { adminType: UserType.ADMIN },
      )
      .getOne();
    if (!candidate) return null;
    const aiEnabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    return this.serializeCandidate(candidate, aiEnabled);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    await this.assertTalentAccess(req.user.uid);
    const aiEnabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';

    // Qualquer usuário comum pode optar por aparecer no banco de talentos.
    // O critério de candidatura é isOpenToWork, não type = CANDIDATE.
    const candidates = (
      await this.users.find({
        where: { isOpenToWork: true },
        order: { updatedAt: 'DESC' },
      })
    ).filter((candidate) => candidate.type !== UserType.ADMIN);

    return candidates.map((candidate) =>
      this.serializeCandidate(candidate, aiEnabled),
    );
  }
}
