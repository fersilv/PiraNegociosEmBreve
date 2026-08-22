import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Company } from '../companies/entities/company.entity';
import { SettingsService } from '../admin/settings.service';
import { User, UserType } from './entities/user.entity';

@Controller('candidates')
@UseGuards(FirebaseAuthGuard)
export class CandidatesController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  async list(@Req() req: any) {
    const viewer = await this.users.findOne({ where: { id: req.user.uid } });
    if (!viewer) throw new ForbiddenException('Conta não encontrada.');

    // Acesso empresarial é uma capacidade do vínculo com a empresa, não um
    // tipo exclusivo de usuário. ADMIN continua sendo o único papel global.
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

    return candidates.map((candidate) => {
      const { aiAnalysis, ...candidateData } = candidate;
      const {
        pcdDeclaration: _pcdDeclaration,
        pcdDocumentationStatus: _pcdDocumentationStatus,
        pcdDataConsent: _pcdDataConsent,
        includeExclusivePcdJobs: _includeExclusivePcdJobs,
        ...safeJobPreferences
      } = candidate.jobPreferences || {};

      return {
        ...candidateData,
        // Autodeclaração PcD e situação de documentação são dados sensíveis.
        // O banco de talentos recebe apenas mobilidade/CNH/veículo. A empresa
        // não consegue inferir a resposta PcD pelo toggle de recomendações.
        jobPreferences: safeJobPreferences,
        ...(aiEnabled ? { aiAnalysis } : {}),
        name:
          candidate.socialName ||
          candidate.fullName ||
          candidate.displayName ||
          'Candidato',
      };
    });
  }
}
