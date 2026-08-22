import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Application } from '../applications/entities/application.entity';
import { User, UserType } from '../users/entities/user.entity';
import { Company } from './entities/company.entity';

type HiringDocument = {
  id: string;
  name: string;
  required: boolean;
  instructions: string;
};

const DEFAULT_DOCUMENTS: HiringDocument[] = [
  { id: 'doc-rg', name: 'RG ou CNH', required: true, instructions: 'Frente e verso' },
  { id: 'doc-cpf', name: 'CPF', required: true, instructions: 'Caso não conste no RG' },
  { id: 'doc-residencia', name: 'Comprovante de Residência', required: true, instructions: 'Máximo 3 meses' },
];

@Controller()
@UseGuards(FirebaseAuthGuard)
export class HiringConfigCompatController {
  constructor(
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
  ) {}

  private normalizeDocuments(value: unknown): HiringDocument[] {
    const config = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};
    if (!Array.isArray(config.documents) || config.documents.length === 0) {
      return DEFAULT_DOCUMENTS;
    }
    return config.documents
      .slice(0, 30)
      .map((item, index) => {
        const document = item && typeof item === 'object'
          ? item as Record<string, unknown>
          : {};
        const name = String(document.name || '').trim().slice(0, 120);
        if (!name) return null;
        return {
          id: String(document.id || `doc-${index + 1}`).slice(0, 120),
          name,
          required: document.required !== false,
          instructions: String(document.instructions || '').trim().slice(0, 500),
        };
      })
      .filter((item): item is HiringDocument => Boolean(item));
  }

  private async getReadableConfig(uid: string, companyId: string) {
    const [company, user] = await Promise.all([
      this.companies.findOne({ where: { id: companyId } }),
      this.users.findOne({ where: { id: uid } }),
    ]);
    if (!company) throw new ForbiddenException('Empresa não encontrada.');

    const canManage = Boolean(
      user?.type === UserType.ADMIN ||
      company.ownerId === uid ||
      user?.companyId === companyId,
    );
    const hasApplication = canManage
      ? true
      : Boolean(await this.applications.findOne({
          where: { candidateId: uid, companyId },
        }));

    if (!canManage && !hasApplication) {
      throw new ForbiddenException('Você não tem acesso às configurações de contratação desta empresa.');
    }

    return {
      documents: this.normalizeDocuments(company.hiringConfig),
    };
  }

  // Compatibility for CandidateOnboardingPage.
  @Get('companies/:companyId/hiring-config')
  getCandidateConfig(@Req() req: any, @Param('companyId') companyId: string) {
    return this.getReadableConfig(req.user.uid, companyId);
  }

  // Compatibility for ApplicationManagerModal.
  @Get('company-hiring-config/:companyId')
  getManagerConfig(@Req() req: any, @Param('companyId') companyId: string) {
    return this.getReadableConfig(req.user.uid, companyId);
  }
}
