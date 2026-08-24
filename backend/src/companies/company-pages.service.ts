import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Company } from './entities/company.entity';
import { CompanyPage } from './entities/company-page.entity';
import { CompanyPagePreview } from './entities/company-page-preview.entity';

export const BUILT_IN_COMPANY_TEMPLATES = [
  'essencial',
  'institucional',
  'vitrine',
  'editorial',
] as const;

const REQUIRED_SECTION_TYPES = ['identity', 'jobs'] as const;
const MAX_CONFIG_BYTES = 450_000;
const PREVIEW_MINUTES = 60;

type AnyConfig = Record<string, any>;

@Injectable()
export class CompanyPagesService {
  constructor(
    @InjectRepository(CompanyPage)
    private readonly pages: Repository<CompanyPage>,
    @InjectRepository(CompanyPagePreview)
    private readonly previews: Repository<CompanyPagePreview>,
  ) {}

  defaultConfig(company: Company): AnyConfig {
    return {
      version: 1,
      templateKey: 'essencial',
      width: 'standard',
      theme: {
        primary: '#b64b36',
        background: '#fffdf9',
        text: '#292524',
        accent: '#7c2d12',
      },
      cover: {
        enabled: false,
        url: '',
        height: 'medium',
        position: 'center',
        overlay: 28,
      },
      about: {
        title: 'Sobre a empresa',
        text: company.description || '',
      },
      contacts: {
        phone: company.phone || '',
        secondaryPhone: '',
        whatsapp: '',
        email: '',
        website: company.website || '',
      },
      socials: {
        instagram: company.socialInstagram || '',
        linkedin: company.socialLinkedin || '',
        facebook: company.socialFacebook || '',
        youtube: '',
        tiktok: '',
      },
      legal: {
        termsEnabled: false,
        termsTitle: 'Termos de uso',
        termsBody: '',
        privacyEnabled: false,
        privacyTitle: 'Política de privacidade',
        privacyBody: '',
      },
      sections: [
        { id: 'identity', type: 'identity', enabled: true, locked: true },
        { id: 'about', type: 'about', enabled: true },
        { id: 'contact', type: 'contact', enabled: true },
        { id: 'socials', type: 'socials', enabled: true },
        { id: 'advanced', type: 'advanced', enabled: false },
        { id: 'jobs', type: 'jobs', enabled: true, locked: true },
        { id: 'legal', type: 'legal', enabled: true },
      ],
      advanced: {
        enabled: false,
        html: '',
        css: '',
        js: '',
      },
    };
  }

  async getForCompany(company: Company) {
    const existing = await this.pages.findOne({ where: { companyId: company.id } });
    if (existing) {
      return {
        ...existing,
        validation: this.validate(existing.draft, company),
      };
    }
    const draft = this.defaultConfig(company);
    return {
      companyId: company.id,
      templateKey: 'essencial',
      draft,
      published: null,
      status: 'DRAFT' as const,
      revision: 1,
      publishedAt: null,
      validation: this.validate(draft, company),
    };
  }

  async saveDraft(company: Company, rawConfig: unknown) {
    const config = this.normalizeConfig(rawConfig, company);
    const validation = this.validate(config, company);
    let page = await this.pages.findOne({ where: { companyId: company.id } });
    if (!page) {
      page = this.pages.create({
        companyId: company.id,
        templateKey: String(config.templateKey || 'essencial'),
        draft: config,
        published: null,
        status: 'DRAFT',
        revision: 1,
        publishedAt: null,
      });
    } else {
      page.templateKey = String(config.templateKey || page.templateKey || 'essencial');
      page.draft = config;
    }
    const saved = await this.pages.save(page);
    return { ...saved, validation };
  }

  async createPreview(company: Company, rawConfig?: unknown) {
    const page = await this.pages.findOne({ where: { companyId: company.id } });
    const config = this.normalizeConfig(
      rawConfig && typeof rawConfig === 'object'
        ? rawConfig
        : page?.draft || this.defaultConfig(company),
      company,
    );
    const expiresAt = new Date(Date.now() + PREVIEW_MINUTES * 60_000);
    const preview = this.previews.create({
      token: randomUUID(),
      companyId: company.id,
      snapshot: config,
      expiresAt,
    });
    await this.previews.save(preview);
    await this.previews.delete({ companyId: company.id, expiresAt: LessThan(new Date()) });
    return {
      token: preview.token,
      expiresAt,
      validation: this.validate(config, company),
    };
  }

  async publish(company: Company, rawConfig?: unknown) {
    const existing = await this.pages.findOne({ where: { companyId: company.id } });
    const config = this.normalizeConfig(
      rawConfig && typeof rawConfig === 'object'
        ? rawConfig
        : existing?.draft || this.defaultConfig(company),
      company,
    );
    const validation = this.validate(config, company);
    if (!validation.validForPublish) {
      throw new BadRequestException({
        message: 'A página ainda não pode ser publicada.',
        validation,
      });
    }

    const page = existing || this.pages.create({ companyId: company.id, revision: 1 });
    page.templateKey = String(config.templateKey || 'essencial');
    page.draft = config;
    page.published = config;
    page.status = 'PUBLISHED';
    page.publishedAt = new Date();
    page.revision = existing ? Math.max(1, Number(existing.revision || 1) + 1) : 1;
    const saved = await this.pages.save(page);
    return { ...saved, validation };
  }

  async unpublish(company: Company) {
    const page = await this.pages.findOne({ where: { companyId: company.id } });
    if (!page) return null;
    page.status = 'DRAFT';
    page.published = null;
    page.publishedAt = null;
    return this.pages.save(page);
  }

  validate(rawConfig: unknown, company: Company) {
    const config = rawConfig && typeof rawConfig === 'object' ? (rawConfig as AnyConfig) : {};
    const sections = Array.isArray(config.sections) ? config.sections : [];
    const activeTypes = new Set(
      sections
        .filter((section: any) => section && section.enabled !== false)
        .map((section: any) => String(section.type || section.id || '').trim()),
    );
    const missingSections = REQUIRED_SECTION_TYPES.filter((type) => !activeTypes.has(type));
    const missingCompanyData: string[] = [];
    if (!company.name?.trim()) missingCompanyData.push('name');
    if (!company.address?.trim()) missingCompanyData.push('address');

    const warnings: string[] = [];
    if (missingSections.includes('jobs')) {
      warnings.push('O componente de vagas é obrigatório e precisa estar ativo antes da publicação.');
    }
    if (missingSections.includes('identity')) {
      warnings.push('O cabeçalho obrigatório com nome, endereço e selo da empresa precisa estar presente.');
    }
    if (missingCompanyData.includes('address')) {
      warnings.push('Cadastre o endereço da empresa no Perfil da empresa antes de publicar.');
    }

    return {
      validForPublish: missingSections.length === 0 && missingCompanyData.length === 0,
      missingSections,
      missingCompanyData,
      warnings,
      lockedComponents: ['companyName', 'address', 'verificationBadge', 'jobs'],
    };
  }

  normalizeConfig(rawConfig: unknown, company: Company): AnyConfig {
    const fallback = this.defaultConfig(company);
    const input = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
      ? JSON.parse(JSON.stringify(rawConfig))
      : fallback;

    const bytes = Buffer.byteLength(JSON.stringify(input), 'utf8');
    if (bytes > MAX_CONFIG_BYTES) {
      throw new BadRequestException('A configuração da página ficou grande demais. Reduza imagens ou código personalizado.');
    }

    const templateKey = String(input.templateKey || fallback.templateKey).slice(0, 80);
    const width = ['compact', 'standard', 'wide', 'full'].includes(input.width)
      ? input.width
      : fallback.width;
    const advanced = input.advanced && typeof input.advanced === 'object' ? input.advanced : {};
    const safeText = (value: unknown, max: number) => String(value || '').slice(0, max);

    return {
      ...fallback,
      ...input,
      version: 1,
      templateKey,
      width,
      theme: { ...fallback.theme, ...(input.theme || {}) },
      cover: { ...fallback.cover, ...(input.cover || {}), url: safeText(input.cover?.url, 2_500_000) },
      about: { ...fallback.about, ...(input.about || {}), text: safeText(input.about?.text, 20_000) },
      contacts: { ...fallback.contacts, ...(input.contacts || {}) },
      socials: { ...fallback.socials, ...(input.socials || {}) },
      legal: {
        ...fallback.legal,
        ...(input.legal || {}),
        termsBody: safeText(input.legal?.termsBody, 80_000),
        privacyBody: safeText(input.legal?.privacyBody, 80_000),
      },
      sections: Array.isArray(input.sections) ? input.sections.slice(0, 30) : fallback.sections,
      advanced: {
        enabled: Boolean(advanced.enabled),
        html: safeText(advanced.html, 120_000),
        css: safeText(advanced.css, 120_000),
        js: safeText(advanced.js, 120_000),
      },
    };
  }
}
