import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    @InjectRepository(ClassifiedUserPreference)
    private readonly preferences: Repository<ClassifiedUserPreference>,
    @InjectRepository(CompanyClassifiedProfile)
    private readonly companyProfiles: Repository<CompanyClassifiedProfile>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
  ) {}

  async context(uid: string) {
    const { user, company, companyEligible, companyVerified } = await this.baseContext(uid);
    const [preference, companyProfile] = await Promise.all([
      this.preferences.findOne({ where: { userId: uid } }),
      company?.id ? this.companyProfiles.findOne({ where: { companyId: company.id } }) : Promise.resolve(null),
    ]);

    const personalTermsAccepted = Boolean(
      preference?.personalTermsAcceptedAt && preference.personalTermsVersion === CLASSIFIEDS_TERMS_VERSION,
    );
    const companyTermsAccepted = Boolean(
      companyProfile?.termsAcceptedAt && companyProfile.termsVersion === CLASSIFIEDS_TERMS_VERSION,
    );
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
        requiresOnboarding: companyEligible && (!companyVerified || !companyTermsAccepted),
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
    if (identity === 'COMPANY' && (!company || !companyEligible)) {
      throw new ForbiddenException('Você não tem permissão para usar esta empresa nos Classificados.');
    }

    let preference = await this.preferences.findOne({ where: { userId: uid } });
    if (!preference) preference = this.preferences.create({ userId: uid });
    preference.lastIdentityType = identity;
    preference.lastCompanyId = identity === 'COMPANY' ? company!.id : null;
    await this.preferences.save(preference);
    return this.context(uid);
  }

  async acceptPersonalTerms(uid: string, accepted: unknown) {
    if (accepted !== true) throw new BadRequestException('É necessário aceitar os Termos de Uso dos Classificados.');
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
    if (!company || !companyEligible) throw new ForbiddenException('Você não pode configurar esta empresa.');
    if (!companyVerified) throw new ForbiddenException('A empresa precisa estar verificada para aderir aos Classificados.');

    let profile = await this.companyProfiles.findOne({ where: { companyId: company.id } });
    const hasCurrentTerms = Boolean(
      profile?.termsAcceptedAt && profile.termsVersion === CLASSIFIEDS_TERMS_VERSION,
    );
    if (body.acceptedTerms !== true && !hasCurrentTerms) {
      throw new BadRequestException('É necessário aceitar os Termos de Uso dos Classificados em nome da empresa.');
    }
    if (!profile) profile = this.companyProfiles.create({ companyId: company.id });

    const canSellProducts = body.canSellProducts !== undefined ? Boolean(body.canSellProducts) : profile.canSellProducts;
    const canOfferServices = body.canOfferServices !== undefined ? Boolean(body.canOfferServices) : profile.canOfferServices;
    if (!canSellProducts && !canOfferServices) {
      throw new BadRequestException('Marque venda de produtos, prestação de serviços ou as duas opções.');
    }

    profile.status = 'ACTIVE';
    profile.canSellProducts = canSellProducts;
    profile.canOfferServices = canOfferServices;
    if (body.businessSegments !== undefined) {
      profile.businessSegments = cleanSegments(body.businessSegments);
    } else if (!Array.isArray(profile.businessSegments)) {
      profile.businessSegments = [];
    }
    if (body.defaultPublicationChannels !== undefined) {
      profile.defaultPublicationChannels = cleanChannels(body.defaultPublicationChannels, profile.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE']);
    } else if (!profile.defaultPublicationChannels?.length) {
      profile.defaultPublicationChannels = ['CLASSIFIEDS', 'COMPANY_PAGE'];
    }
    if (body.pageSectionLabel !== undefined) {
      profile.pageSectionLabel = cleanNullable(body.pageSectionLabel, 80);
    }
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

  async active(uid: string, requireReady = true): Promise<ActiveClassifiedIdentity> {
    const { user, company, companyEligible, companyVerified } = await this.baseContext(uid);
    const preference = await this.preferences.findOne({ where: { userId: uid } });
    const hasTwoFaces = Boolean(company && companyEligible);
    let type = preference?.lastIdentityType || (hasTwoFaces ? null : 'PERSONAL');
    if (!type) throw new BadRequestException('Escolha se deseja entrar nos Classificados como Personal ou Business.');

    if (type === 'PERSONAL') {
      const personalTermsCurrent = Boolean(
        preference?.personalTermsAcceptedAt && preference.personalTermsVersion === CLASSIFIEDS_TERMS_VERSION,
      );
      if (requireReady && !personalTermsCurrent) {
        throw new ForbiddenException('Aceite os Termos de Uso para ativar o PiraNegócios Personal.');
      }
      return { type, user, company: null, companyProfile: null };
    }

    if (!company || !companyEligible) throw new ForbiddenException('A identidade empresarial não está mais disponível para esta conta.');
    if (!companyVerified) throw new ForbiddenException('A empresa precisa estar verificada para usar os Classificados.');
    const companyProfile = await this.companyProfiles.findOne({ where: { companyId: company.id } });
    const companyTermsCurrent = Boolean(
      companyProfile?.termsAcceptedAt && companyProfile.termsVersion === CLASSIFIEDS_TERMS_VERSION,
    );
    if (requireReady && (!companyTermsCurrent || companyProfile?.status !== 'ACTIVE')) {
      throw new ForbiddenException('Conclua a adesão da empresa aos Classificados.');
    }
    return { type, user, company, companyProfile };
  }

  async assertCompanyOperator(uid: string, companyId: string) {
    const user = await this.users.findOne({ where: { id: uid } });
    const company = await this.companies.findOne({ where: { id: companyId } });
    if (!user || !company || (company.ownerId !== uid && !(user.companyId === companyId && user.isCompanyAdmin))) {
      throw new ForbiddenException('Você não pode administrar os Classificados desta empresa.');
    }
    return { user, company };
  }

  private async baseContext(uid: string) {
    const user = await this.users.findOne({ where: { id: uid } });
    if (!user) throw new ForbiddenException('Usuário não encontrado.');
    const company = user.companyId
      ? await this.companies.findOne({ where: { id: user.companyId } })
      : await this.companies.findOne({ where: { ownerId: uid } });
    const companyEligible = Boolean(company && (company.ownerId === uid || (user.companyId === company.id && user.isCompanyAdmin)));
    const companyVerified = Boolean(company && (company.verificationStatus === CompanyStatus.VERIFIED || company.isVerified));
    return { user, company, companyEligible, companyVerified };
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
