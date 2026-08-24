import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
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
  'resumeStatus',
  'resumePublishedAt',
  'uploadedResumeFile',
  'resumePhotoURL',
  'resumePreferences',
  'address',
  'city',
  'state',
  'jobPreferences',
  'salaryExpectation',
  'acceptedTerms',
  'linkedinURL',
  'additionalPhones',
  'experiences',
  'skills',
  'courses',
  'education',
  'languages',
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
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  findOneOrNull(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private normalizeKey(value: unknown): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  }

  private normalizeMonthYear(value: unknown): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(atual|presente)$/i.test(raw)) return 'Atual';

    let match = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (match) {
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) return `${String(month).padStart(2, '0')}/${match[1]}`;
    }
    match = raw.match(/^\d{1,2}[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      const month = Number(match[1]);
      if (month >= 1 && month <= 12) return `${String(month).padStart(2, '0')}/${match[2]}`;
    }
    match = raw.match(/^(\d{1,2})[/-](\d{4})$/);
    if (match) {
      const month = Number(match[1]);
      if (month >= 1 && month <= 12) return `${String(month).padStart(2, '0')}/${match[2]}`;
    }

    const months: Record<string, string> = {
      jan: '01', janeiro: '01', january: '01', fev: '02', fevereiro: '02', feb: '02', february: '02', mar: '03', março: '03', marco: '03', march: '03', abr: '04', abril: '04', apr: '04', april: '04', mai: '05', maio: '05', may: '05', jun: '06', junho: '06', june: '06', jul: '07', julho: '07', july: '07', ago: '08', agosto: '08', aug: '08', august: '08', set: '09', setembro: '09', sep: '09', sept: '09', september: '09', out: '10', outubro: '10', oct: '10', october: '10', nov: '11', novembro: '11', november: '11', dez: '12', dezembro: '12', dec: '12', december: '12',
    };
    const textual = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/^([a-z]+)[\s/-]+(\d{4})$/);
    if (textual) {
      const month = months[textual[1]];
      if (month) return `${month}/${textual[2]}`;
    }
    if (/^\d{4}$/.test(raw)) return raw;
    return raw;
  }

  private normalizeTimeline(value: unknown): unknown {
    if (!Array.isArray(value)) return value;
    return value.map((item) => {
      const stage = this.asRecord(item);
      if (!stage) return item;
      const current = stage.current === true;
      return { ...stage, startDate: this.normalizeMonthYear(stage.startDate), endDate: current ? 'Atual' : this.normalizeMonthYear(stage.endDate) };
    });
  }

  normalizeExperienceDates(value: unknown): unknown {
    if (!Array.isArray(value)) return value;
    return value.map((item) => {
      const experience = this.asRecord(item);
      if (!experience) return item;
      const current = experience.current === true;
      return {
        ...experience,
        startDate: this.normalizeMonthYear(experience.startDate),
        endDate: current ? 'Atual' : this.normalizeMonthYear(experience.endDate),
        timeline: this.normalizeTimeline(experience.timeline),
      };
    });
  }

  private findExistingResumeItem(incoming: Record<string, unknown>, existingItems: unknown[], semanticFields: string[]): Record<string, unknown> | null {
    const incomingId = this.normalizeKey(incoming.id);
    if (incomingId) {
      const byId = existingItems.map((item) => this.asRecord(item)).find((item) => item && this.normalizeKey(item.id) === incomingId);
      if (byId) return byId;
    }
    const semanticKey = semanticFields.map((field) => this.normalizeKey(incoming[field])).join('|');
    if (!semanticKey.replace(/\|/g, '')) return null;
    return existingItems.map((item) => this.asRecord(item)).find((item) => item && semanticFields.map((field) => this.normalizeKey(item[field])).join('|') === semanticKey) || null;
  }

  private preserveExperienceStructure(incomingValue: unknown, existingValue: unknown): unknown {
    if (!Array.isArray(incomingValue)) return incomingValue;
    const existingItems = Array.isArray(existingValue) ? existingValue : [];
    return incomingValue.map((item) => {
      const incoming = this.asRecord(item);
      if (!incoming) return item;
      const existing = this.findExistingResumeItem(incoming, existingItems, ['company']);
      if (!existing) return incoming;
      const incomingTimeline = Array.isArray(incoming.timeline) ? incoming.timeline : null;
      const existingTimeline = Array.isArray(existing.timeline) ? existing.timeline : null;
      if (incomingTimeline) return { ...existing, ...incoming, timeline: incomingTimeline };
      if (existingTimeline && existingTimeline.length > 0) {
        if (existingTimeline.length === 1) {
          const onlyStage = this.asRecord(existingTimeline[0]);
          const mergedStage = onlyStage ? {
            ...onlyStage,
            role: incoming.role ?? onlyStage.role,
            startDate: incoming.startDate ?? onlyStage.startDate,
            endDate: incoming.endDate ?? onlyStage.endDate,
            current: incoming.current ?? onlyStage.current,
            description: incoming.description ?? onlyStage.description,
            skills: incoming.skills ?? onlyStage.skills,
          } : existingTimeline[0];
          return { ...existing, ...incoming, timeline: [mergedStage] };
        }
        return { ...existing, ...incoming, id: incoming.id ?? existing.id, skills: incoming.skills ?? existing.skills, timeline: existingTimeline };
      }
      return { ...existing, ...incoming };
    });
  }

  private preserveStructuredArray(incomingValue: unknown, existingValue: unknown, semanticFields: string[]): unknown {
    if (!Array.isArray(incomingValue)) return incomingValue;
    const existingItems = Array.isArray(existingValue) ? existingValue : [];
    return incomingValue.map((item) => {
      const incoming = this.asRecord(item);
      if (!incoming) return item;
      const existing = this.findExistingResumeItem(incoming, existingItems, semanticFields);
      return existing ? { ...existing, ...incoming } : incoming;
    });
  }

  sanitizeSelfUpdate(data: Partial<User>, existing: User | null): Partial<User> {
    const sanitized: Partial<User> = {};
    for (const field of SELF_MANAGED_FIELDS) {
      if (data[field] !== undefined) (sanitized as Record<string, unknown>)[field] = data[field];
    }
    if (data.experiences !== undefined) {
      const preserved = this.preserveExperienceStructure(data.experiences, existing?.experiences);
      sanitized.experiences = this.normalizeExperienceDates(preserved) as unknown[];
    }
    if (data.education !== undefined) {
      sanitized.education = this.preserveStructuredArray(data.education, existing?.education, ['institution', 'degree', 'fieldOfStudy']) as unknown[];
    }
    if (data.courses !== undefined) {
      sanitized.courses = this.preserveStructuredArray(data.courses, existing?.courses, ['name', 'institution']) as unknown[];
    }
    return sanitized;
  }

  async deleteResumePermanently(userId: string) {
    const temporaryPaths: string[] = [];

    await this.usersRepository.manager.transaction(async (manager) => {
      const existing = await manager.findOne(User, { where: { id: userId } });
      if (!existing) throw new NotFoundException(`User with ID ${userId} not found`);

      const transferRows = await manager.query(
        'SELECT "filePath" FROM mobile_upload_sessions WHERE "userId" = $1 AND "filePath" IS NOT NULL',
        [userId],
      );
      for (const row of transferRows) {
        if (typeof row?.filePath === 'string' && row.filePath) temporaryPaths.push(row.filePath);
      }

      await manager.query('DELETE FROM resume_analysis_history WHERE "userId" = $1', [userId]);
      await manager.query('DELETE FROM resume_improvement_proposals WHERE "userId" = $1', [userId]);
      await manager.query('DELETE FROM resume_publication_history WHERE "userId" = $1', [userId]);
      await manager.query('DELETE FROM mobile_upload_sessions WHERE "userId" = $1', [userId]);
      await manager.query(
        'UPDATE applications SET "resumeSnapshot" = NULL, "resumeUrl" = NULL WHERE "candidateId" = $1',
        [userId],
      );
      await manager.query(
        `UPDATE users
         SET bio = NULL,
             experiences = NULL,
             education = NULL,
             skills = NULL,
             courses = NULL,
             languages = NULL,
             "salaryExpectation" = NULL,
             "resumeURL" = '',
             "resumeStatus" = 'DRAFT',
             "resumePublishedAt" = NULL,
             "publishedResumeSnapshot" = NULL,
             "uploadedResumeFile" = NULL,
             "resumePhotoURL" = NULL,
             "resumePreferences" = NULL,
             "aiAnalysis" = NULL,
             "hasAiAnalyzed" = false,
             "isOpenToWork" = false,
             "updatedAt" = now()
         WHERE id = $1`,
        [userId],
      );
    });

    await Promise.all(temporaryPaths.map((path) => unlink(path).catch(() => undefined)));

    const user = await this.findOne(userId);
    return {
      deleted: true,
      isOpenToWork: user.isOpenToWork,
      aiAnalysisCount: user.aiAnalysisCount,
      aiImportCount: user.aiImportCount,
    };
  }

  async createOrUpdate(id: string, data: Partial<User>): Promise<User> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });
    if (existingUser) {
      Object.assign(existingUser, data);
      return this.usersRepository.save(existingUser);
    }
    const email = data.email?.trim().toLowerCase();
    const invitation = email ? await this.invitationsRepository.findOne({ where: { email } }) : null;
    const newUser = this.usersRepository.create({
      id,
      ...data,
      email,
      isOpenToWork: data.isOpenToWork ?? true,
      ...(invitation ? {
        companyId: invitation.companyId,
        isCompanyAdmin: invitation.isCompanyAdmin,
        status: 'ACTIVE',
        displayName: data.displayName || invitation.name,
        fullName: data.fullName || invitation.name,
      } : {}),
    });
    const saved = await this.usersRepository.save(newUser);
    if (invitation) await this.invitationsRepository.remove(invitation);
    return saved;
  }
}
