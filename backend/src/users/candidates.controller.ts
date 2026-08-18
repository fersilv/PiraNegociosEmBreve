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
import { User, UserType } from './entities/user.entity';

@Controller('candidates')
@UseGuards(FirebaseAuthGuard)
export class CandidatesController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
  ) {}

  @Get()
  async list(@Req() req: any) {
    const viewer = await this.users.findOne({ where: { id: req.user.uid } });
    if (!viewer) throw new ForbiddenException('Conta não encontrada.');
    if (viewer.type !== UserType.ADMIN) {
      if (viewer.type !== UserType.COMPANY || !viewer.companyId)
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
    const candidates = await this.users.find({
      where: { type: UserType.CANDIDATE, isOpenToWork: true },
      order: { updatedAt: 'DESC' },
    });
    return candidates.map((candidate) => ({
      ...candidate,
      name:
        candidate.socialName ||
        candidate.fullName ||
        candidate.displayName ||
        'Candidato',
    }));
  }
}
