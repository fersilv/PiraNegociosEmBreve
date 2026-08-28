import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { ClassifiedIdentityType, ClassifiedUserPreference } from './entities/classified-user-preference.entity';
import { ClassifiedPublicationChannel, CompanyClassifiedProfile } from './entities/company-classified-profile.entity';

export const CLASSIFIEDS_TERMS_VERSION = '2026-08-25';
const CHANNELS: ClassifiedPublicationChannel[] = ['CLASSIFIEDS', 'COMPANY_PAGE'];

export type ActiveClassifiedIdentity = {
  type: ClassifiedIdentityType;
  user: User;
  company: Company | null;
  companyProfile: CompanyClassifiedProfile | null;
};

@Injectable()
export class ClassifiedsIdentityService {
  constructor(
    @InjectRepository(ClassifiedUserPreference) private readonly preferences: Repository<ClassifiedUserPreference>,
    @InjectRepository(CompanyClassifiedProfile) private readonly companyProfiles: Repository<CompanyClassifiedProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly dataSource: DataSource,
  ) {}

  async context(uid: string) {
    const { user, company, companyEligible, companyVerified } = await this.baseContext(uid);
    const [preference, companyProfile] = await Promise.all([
      this.preferences.findOne({ where: { userId: uid } }),
      company?.id ? this.companyProfiles.findOne({ where: { companyId: company.id } }) : Promise.resolve(null),
    ]);
    const personalTermsAccepted = Boolean(preference?.personalTermsAcceptedAt && preference.personalTermsVersion === CLASSIFIEDS_TERMS_VERSION);
    const companyTermsAccepted = Boolean(companyProfile?.termsAcceptedAt && companyProfile.termsVersion === CLASSIFIEDS_TERMS_VERSION);
    const hasTwoFaces = Boolean(company && companyEligible);
    const remembered = preference?.lastIdentityType || null;
    let activeIdentity: ClassifiedIdentityType | null = remembered;
    if (!hasTwoFaces && !activeIdentity) activeIdentity = 'PERSONAL';
    if (activeIdentity === 'COMPANY' && (!company || !companyEligible)) activeIdentity = 'PERSONAL';

    return {
      termsVersion: CLASSIFIEDS_TERMS_VERSION,
      needsIdentitySelection: hasTwoFaces && !remembered,
      activeIdentity,
      personal: {
        available: true,
        termsAccepted: personalTermsAccepted,
        termsAcceptedAt: personalTermsAccepted ? preference?.personalTermsAcceptedAt || null : null,
        name: user.socialName || user.displayName || user.fullName || 'Meu perfil',
        photoURL: user.photoURL || null,
      },
      company: company ? {
        id: company.id,
        name: company.name,
        logoURL: company.logoURL,
        available: companyEligible,
        verified: companyVerified,
        termsAccepted: companyTermsAccepted,
        requiresOnboarding: false,
        publishingSetupRequired: companyEligible && (!companyVerified || !companyTermsAccepted),
        canSellProducts: companyProfile?.canSellProducts ?? true,
        canOfferServices: companyProfile?.canOfferServices ?? false,
        businessSegments: companyProfile?.businessSegments || [],
        defaultPublicationChannels: companyProfile?.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE'],
        pageSectionLabel: companyProfile?.pageSectionLabel || null,
      } : null,
    };
  }

  async select(uid: string, identityRaw: unknown) {
    const identity = String(identityRaw || '').toUpperCase() as ClassifiedIdentityType;
    if (!['PERSONAL', 'COMPANY'].includes(identity)) throw new BadRequestException('Identidade inválida.');
    const { company, companyEligible } = await this.baseContext(uid);
    if (identity === 'COMPANY' && (!company || !companyEligible)) throw new ForbiddenException('Você não tem permissão para usar esta empresa no Marketplace.');
    let preference = await this.preferences.findOne({ where: { userId: uid } });
    if (!preference) preference = this.preferences.create({ userId: uid });
    preference.lastIdentityType = identity;
    preference.lastCompanyId = identity === 'COMPANY' ? company!.id : null;
    await this.preferences.save(preference);
    return this.context(uid);
  }

  async acceptPersonalTerms(uid: string, accepted: unknown) {
    if (accepted !== true) throw new BadRequestException('É necessário aceitar os Termos de Uso do Marketplace para publicar.');
    await this.baseContext(uid);
    let preference = await this.preferences.findOne({ where: { userId: uid } });
    if (!preference) preference = this.preferences.create({ userId: uid });
    preference.personalTermsVersion = CLASSIFIEDS_TERMS_VERSION;
    preference.personalTermsAcceptedAt = new Date();
    preference.lastIdentityType = preference.lastIdentityType || 'PERSONAL';
    await this.preferences.save(preference);
    return this.context(uid);
  }

  async configureCompany(uid: string, body: Record<string, unknown>) {
    const { company, companyEligible, companyVerified } = await this.baseContext(uid);
    if (!company || !companyEligible) throw new ForbiddenException('Você não pode configurar o Marketplace desta empresa.');
    if (!companyVerified) throw new ForbiddenException('A empresa precisa estar verificada para publicar no Marketplace.');
    let profile = await this.companyProfiles.findOne({ where: { companyId: company.id } });
    const hasCurrentTerms = Boolean(profile?.termsAcceptedAt && profile.termsVersion === CLASSIFIEDS_TERMS_VERSION);
    if (body.acceptedTerms !== true && !hasCurrentTerms) throw new BadRequestException('Aceite os Termos de Uso do Marketplace antes da primeira publicação.');
    if (!profile) profile = this.companyProfiles.create({ companyId: company.id });

    const canSellProducts = body.canSellProducts !== undefined ? Boolean(body.canSellProducts) : profile.canSellProducts;
    const canOfferServices = body.canOfferServices !== undefined ? Boolean(body.canOfferServices) : profile.canOfferServices;
    if (!canSellProducts && !canOfferServices) throw new BadRequestException('Marque venda de produtos, prestação de serviços ou as duas opções.');
    profile.status = 'ACTIVE';
    profile.canSellProducts = canSellProducts;
    profile.canOfferServices = canOfferServices;
    if (body.businessSegments !== undefined) profile.businessSegments = cleanSegments(body.businessSegments);
    else if (!Array.isArray(profile.businessSegments)) profile.businessSegments = [];
    if (body.defaultPublicationChannels !== undefined) profile.defaultPublicationChannels = cleanChannels(body.defaultPublicationChannels, profile.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE']);
    else if (!profile.defaultPublicationChannels?.length) profile.defaultPublicationChannels = ['CLASSIFIEDS', 'COMPANY_PAGE'];
    if (body.pageSectionLabel !== undefined) profile.pageSectionLabel = cleanNullable(body.pageSectionLabel, 80);
    if (body.acceptedTerms === true) {
      profile.termsVersion = CLASSIFIEDS_TERMS_VERSION;
      profile.termsAcceptedAt = new Date();
      profile.termsAcceptedByUserId = uid;
    }
    await this.companyProfiles.save(profile);

    let preference = await this.preferences.findOne({ where: { userId: uid } });
    if (!preference) preference = this.preferences.create({ userId: uid });
    preference.lastIdentityType = 'COMPANY';
    preference.lastCompanyId = company.id;
    await this.preferences.save(preference);
    return this.context(uid);
  }

  async active(uid: string, requireReady = false): Promise<ActiveClassifiedIdentity> {
    const { user, company, companyEligible, companyVerified } = await this.baseContext(uid);
    const preference = await this.preferences.findOne({ where: { userId: uid } });
    const hasTwoFaces = Boolean(company && companyEligible);
    let type = preference?.lastIdentityType || (hasTwoFaces ? null : 'PERSONAL');
    if (!type) throw new BadRequestException('Escolha se deseja usar o Marketplace como perfil pessoal ou como empresa.');
    if (type === 'PERSONAL') {
      const currentTerms = Boolean(preference?.personalTermsAcceptedAt && preference.personalTermsVersion === CLASSIFIEDS_TERMS_VERSION);
      if (requireReady && !currentTerms) throw new ForbiddenException('Aceite os Termos de Uso do Marketplace antes da sua primeira publicação.');
      return { type, user, company: null, companyProfile: null };
    }
    if (!company || !companyEligible) throw new ForbiddenException('A identidade da empresa não está disponível para sua conta no Marketplace.');
    const companyProfile = await this.companyProfiles.findOne({ where: { companyId: company.id } });
    const companyTermsCurrent = Boolean(companyProfile?.termsAcceptedAt && companyProfile.termsVersion === CLASSIFIEDS_TERMS_VERSION);
    if (requireReady && !companyVerified) throw new ForbiddenException('A empresa precisa estar verificada antes de publicar no Marketplace.');
    if (requireReady && (!companyTermsCurrent || companyProfile?.status !== 'ACTIVE')) throw new ForbiddenException('Conclua a adesão ao Marketplace e aceite os termos antes da primeira publicação.');
    return { type, user, company, companyProfile };
  }

  async assertPublishingReady(uid: string) { return this.active(uid, true); }

  async assertCompanyOperator(uid: string, companyId: string) {
    const user = await this.users.findOne({ where: { id: uid } });
    const company = await this.companies.findOne({ where: { id: companyId } });
    if (!user || !company) throw new ForbiddenException('Empresa ou usuário não encontrado.');
    if (company.ownerId === uid) return { user, company };
    const membership = await this.membership(uid, companyId);
    if (!membership || (membership.role !== 'PRIMARY_ADMIN' && membership.role !== 'ADMIN' && membership.permissions?.marketplace !== true)) throw new ForbiddenException('Seu perfil não tem permissão para administrar o Marketplace desta empresa.');
    return { user, company };
  }

  private async baseContext(uid: string) {
    const user = await this.users.findOne({ where: { id: uid } });
    if (!user) throw new ForbiddenException('Usuário não encontrado.');

    let company = user.companyId ? await this.companies.findOne({ where: { id: user.companyId } }) : null;
    if (!company) company = await this.companies.findOne({ where: { ownerId: uid } });
    if (!company) {
      const rows = await this.dataSource.query(
        `SELECT c.*
         FROM company_memberships m
         JOIN companies c ON c.id=m."companyId"
         WHERE m."userId"=$1 AND m.status='ACTIVE'
         ORDER BY CASE m.role WHEN 'PRIMARY_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,m."updatedAt" DESC
         LIMIT 1`,
        [uid],
      ).catch(() => []);
      if (rows[0]?.id) company = rows[0] as Company;
    }

    let membership = company ? await this.membership(uid, company.id) : null;

    // Migração transparente para contas empresariais criadas antes de company_memberships.
    // PRIMARY_ADMIN é reservado ao proprietário. Outros administradores legados entram
    // como ADMIN para não colidir com o índice que permite um único admin principal ativo.
    const legacyCompanyAdmin = Boolean(
      company && !membership && user.companyId === company.id && user.isCompanyAdmin,
    );
    if (company && legacyCompanyAdmin) {
      const permissions = {
        companyProfile: true,
        recruitment: true,
        marketplace: true,
        finance: true,
        team: true,
      };
      const role = company.ownerId === uid ? 'PRIMARY_ADMIN' : 'ADMIN';
      const rows = await this.dataSource.query(
        `INSERT INTO company_memberships("companyId","userId",role,"isPartner",permissions,status)
         VALUES ($1,$2,$3,false,$4::jsonb,'ACTIVE')
         ON CONFLICT ("companyId","userId") DO UPDATE SET
           role=EXCLUDED.role,
           status='ACTIVE',
           permissions=COALESCE(company_memberships.permissions,'{}'::jsonb) || EXCLUDED.permissions,
           "updatedAt"=now()
         RETURNING role,permissions,status`,
        [company.id, uid, role, JSON.stringify(permissions)],
      ).catch(() => []);
      membership = rows[0] || null;
    }

    // Quando a empresa foi recuperada pelo ownerId ou pela tabela nova de vínculos,
    // repara os campos legados que ainda abastecem algumas telas antigas.
    if (company && !user.companyId && (company.ownerId === uid || membership)) {
      await this.dataSource.query(
        `UPDATE users SET "companyId"=$2,"companyName"=$3,"isCompanyAdmin"=$4,"updatedAt"=now() WHERE id=$1`,
        [uid, company.id, company.name, company.ownerId === uid || membership?.role === 'PRIMARY_ADMIN' || membership?.role === 'ADMIN'],
      ).catch(() => undefined);
      user.companyId = company.id;
      user.companyName = company.name;
      user.isCompanyAdmin = company.ownerId === uid || membership?.role === 'PRIMARY_ADMIN' || membership?.role === 'ADMIN';
    }

    const companyEligible = Boolean(company && (
      company.ownerId === uid ||
      membership?.role === 'PRIMARY_ADMIN' ||
      membership?.role === 'ADMIN' ||
      membership?.permissions?.marketplace === true ||
      (!membership && user.companyId === company.id && user.isCompanyAdmin)
    ));
    const companyVerified = Boolean(company && (company.verificationStatus === CompanyStatus.VERIFIED || company.isVerified));
    return { user, company, companyEligible, companyVerified };
  }

  private async membership(uid: string, companyId: string) {
    const rows = await this.dataSource.query(
      `SELECT role,permissions,status FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND status='ACTIVE' LIMIT 1`,
      [companyId, uid],
    ).catch(() => []);
    return rows[0] || null;
  }
}

function cleanSegments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 20);
}
function cleanChannels(value: unknown, fallback: ClassifiedPublicationChannel[]) {
  if (!Array.isArray(value)) return fallback;
  const channels = [...new Set(value.map((item) => String(item || '').toUpperCase()).filter((item) => CHANNELS.includes(item as ClassifiedPublicationChannel)))] as ClassifiedPublicationChannel[];
  return channels.length ? channels : fallback;
}
function cleanNullable(value: unknown, max: number) {
  const text = String(value ?? '').trim().slice(0, max);
  return text || null;
}
