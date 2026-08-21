import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Put,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { User } from '../users/entities/user.entity';
import { Company } from './entities/company.entity';

type HiringDocument = {
  id: string;
  name: string;
  required: boolean;
  instructions: string;
};

type HiringConfig = {
  documents: HiringDocument[];
  customStatuses: string[];
  defaultJobDurationDays: number;
  notifyOnNewCandidate: boolean;
};

const DEFAULT_CONFIG: HiringConfig = {
  documents: [
    {
      id: 'doc-rg',
      name: 'RG ou CNH',
      required: true,
      instructions: 'Frente e verso',
    },
    {
      id: 'doc-cpf',
      name: 'CPF',
      required: true,
      instructions: 'Caso não conste no RG',
    },
    {
      id: 'doc-residencia',
      name: 'Comprovante de Residência',
      required: true,
      instructions: 'Máximo 3 meses',
    },
  ],
  customStatuses: ['Entrevista com Gestor', 'Banco de Reserva'],
  defaultJobDurationDays: 30,
  notifyOnNewCandidate: true,
};

@Controller('company-hiring-config')
@UseGuards(FirebaseAuthGuard)
export class CompanyHiringConfigController {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
  ) {}

  private async getCompanyForUser(uid: string): Promise<Company> {
    const user = await this.usersRepository.findOne({ where: { id: uid } });
    if (!user?.companyId) {
      throw new ForbiddenException('Sua conta não possui vínculo com uma empresa.');
    }

    const company = await this.companiesRepository.findOne({
      where: { id: user.companyId },
    });
    if (!company) {
      throw new ForbiddenException('A empresa vinculada à conta não foi encontrada.');
    }

    if (!user.isCompanyAdmin && company.ownerId !== uid) {
      throw new ForbiddenException(
        'Somente administradores da empresa podem alterar as configurações de contratação.',
      );
    }

    return company;
  }

  private normalizeConfig(value: unknown): HiringConfig {
    const body = value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};

    const documents = Array.isArray(body.documents)
      ? body.documents.slice(0, 30).map((item, index) => {
          const document = item && typeof item === 'object'
            ? (item as Record<string, unknown>)
            : {};
          const name = String(document.name || '').trim().slice(0, 120);
          if (!name) {
            throw new BadRequestException(
              `Informe o nome do documento ${index + 1}.`,
            );
          }
          return {
            id: String(document.id || `doc-${index + 1}`).slice(0, 120),
            name,
            required: document.required !== false,
            instructions: String(document.instructions || '').trim().slice(0, 500),
          };
        })
      : DEFAULT_CONFIG.documents;

    const customStatuses = Array.isArray(body.customStatuses)
      ? Array.from(
          new Set(
            body.customStatuses
              .map((item) => String(item || '').trim().slice(0, 80))
              .filter(Boolean),
          ),
        ).slice(0, 30)
      : DEFAULT_CONFIG.customStatuses;

    const duration = Number(body.defaultJobDurationDays);
    const defaultJobDurationDays = Number.isFinite(duration)
      ? Math.max(1, Math.min(365, Math.round(duration)))
      : DEFAULT_CONFIG.defaultJobDurationDays;

    return {
      documents,
      customStatuses,
      defaultJobDurationDays,
      notifyOnNewCandidate: body.notifyOnNewCandidate !== false,
    };
  }

  @Get()
  async getConfig(@Req() req: any): Promise<HiringConfig> {
    const company = await this.getCompanyForUser(req.user.uid);
    if (!company.hiringConfig) return DEFAULT_CONFIG;
    return this.normalizeConfig(company.hiringConfig);
  }

  @Put()
  async saveConfig(
    @Req() req: any,
    @Body() body: unknown,
  ): Promise<HiringConfig> {
    const company = await this.getCompanyForUser(req.user.uid);
    const config = this.normalizeConfig(body);
    company.hiringConfig = config as unknown as Record<string, unknown>;
    await this.companiesRepository.save(company);
    return config;
  }
}
