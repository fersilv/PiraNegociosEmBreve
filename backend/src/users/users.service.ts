import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from './entities/user.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';

const SELF_MANAGED_FIELDS = [
  'displayName',
  'photoURL',
  'fullName',
  'birthDate',
  'socialName',
  'treatment',
  'phone',
  'bio',
  'resumeURL',
  'resumePhotoURL',
  'address',
  'salaryExpectation',
  'acceptedTerms',
  'linkedinURL',
  'additionalPhones',
  'experiences',
  'skills',
  'courses',
  'education',
  'languages',
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

  private normalizeMonthYear(value: unknown): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(atual|presente)$/i.test(raw)) return 'Atual';

    let match = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (match) {
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) {
        return `${String(month).padStart(2, '0')}/${match[1]}`;
      }
    }

    match = raw.match(/^\d{1,2}[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      const month = Number(match[1]);
      if (month >= 1 && month <= 12) {
        return `${String(month).padStart(2, '0')}/${match[2]}`;
      }
    }

    match = raw.match(/^(\d{1,2})[/-](\d{4})$/);
    if (match) {
      const month = Number(match[1]);
      if (month >= 1 && month <= 12) {
        return `${String(month).padStart(2, '0')}/${match[2]}`;
      }
    }

    const months: Record<string, string> = {
      jan: '01', janeiro: '01', january: '01',
      fev: '02', fevereiro: '02', feb: '02', february: '02',
      mar: '03', março: '03', marco: '03', march: '03',
      abr: '04', abril: '04', apr: '04', april: '04',
      mai: '05', maio: '05', may: '05',
      jun: '06', junho: '06', june: '06',
      jul: '07', julho: '07', july: '07',
      ago: '08', agosto: '08', aug: '08', august: '08',
      set: '09', setembro: '09', sep: '09', sept: '09', september: '09',
      out: '10', outubro: '10', oct: '10', october: '10',
      nov: '11', novembro: '11', november: '11',
      dez: '12', dezembro: '12', dec: '12', december: '12',
    };
    const textual = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .match(/^([a-z]+)[\s/-]+(\d{4})$/);
    if (textual) {
      const month = months[textual[1]];
      if (month) return `${month}/${textual[2]}`;
    }

    if (/^\d{4}$/.test(raw)) return raw;
    return raw;
  }

  normalizeExperienceDates(value: unknown): unknown {
    if (!Array.isArray(value)) return value;
    return value.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const experience = item as Record<string, unknown>;
      const current = experience.current === true;
      return {
        ...experience,
        startDate: this.normalizeMonthYear(experience.startDate),
        endDate: current
          ? 'Atual'
          : this.normalizeMonthYear(experience.endDate),
      };
    });
  }

  sanitizeSelfUpdate(
    data: Partial<User>,
    _existing: User | null,
  ): Partial<User> {
    const sanitized: Partial<User> = {};
    for (const field of SELF_MANAGED_FIELDS) {
      if (data[field] !== undefined) {
        (sanitized as Record<string, unknown>)[field] = data[field];
      }
    }

    if (data.experiences !== undefined) {
      sanitized.experiences = this.normalizeExperienceDates(data.experiences) as unknown[];
    }

    // Usuários comuns não recebem um papel obrigatório. Recursos pessoais são
    // capacidades da conta, enquanto acesso empresarial vem de companyId e
    // isCompanyAdmin. O campo type permanece apenas para ADMIN e legado.
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
      isOpenToWork: data.isOpenToWork ?? true,
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
