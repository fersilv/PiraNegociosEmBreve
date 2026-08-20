import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from './entities/user.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';

const SELF_MANAGED_FIELDS = [
  'displayName',
  'photoURL',
  'fullName',
  'socialName',
  'treatment',
  'phone',
  'bio',
  'resumeURL',
  'acceptedTerms',
  'linkedinURL',
  'additionalPhones',
  'experiences',
  'skills',
  'courses',
  'education',
  'aiAnalysis',
  'hasAiAnalyzed',
  'aiAnalysisCount',
  'savedDocs',
  'isOpenToWork',
] as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CompanyInvitation)
    private invitationsRepository: Repository<CompanyInvitation>,
  ) {}

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  findOneOrNull(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  sanitizeSelfUpdate(
    data: Partial<User>,
    existing: User | null,
  ): Partial<User> {
    const sanitized: Partial<User> = {};
    for (const field of SELF_MANAGED_FIELDS) {
      if (data[field] !== undefined) {
        (sanitized as Record<string, unknown>)[field] = data[field];
      }
    }

    if (!existing || !existing.type) {
      sanitized.type = UserType.CANDIDATE;
    }
    return sanitized;
  }

  async createOrUpdate(id: string, data: Partial<User>): Promise<User> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });

    if (existingUser) {
      Object.assign(existingUser, data);
      return this.usersRepository.save(existingUser);
    }

    const email = data.email?.trim().toLowerCase();
    const invitation = email
      ? await this.invitationsRepository.findOne({ where: { email } })
      : null;
    const newUser = this.usersRepository.create({
      id,
      ...data,
      email,
      ...(invitation
        ? {
            type: UserType.COMPANY,
            companyId: invitation.companyId,
            isCompanyAdmin: invitation.isCompanyAdmin,
            status: 'ACTIVE',
            displayName: data.displayName || invitation.name,
            fullName: data.fullName || invitation.name,
          }
        : {}),
    });
    const saved = await this.usersRepository.save(newUser);
    if (invitation) await this.invitationsRepository.remove(invitation);
    return saved;
  }
}
