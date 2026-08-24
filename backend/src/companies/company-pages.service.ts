import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Company } from './entities/company.entity';
import { CompanyPage } from './entities/company-page.entity';
import { CompanyPagePreview } from './entities/company-page-preview.entity';

export const BUILT_IN_COMPANY_TEMPLATES = [
  'aurora',
  'atlas',
  'pulse',
  'canvas',
  'noir',
] as const;

const REQUIRED_SECTION_TYPES = ['identity', 'jobs'] as const;
const REQUIRED_CODE_COMPONENTS = [
  { tag: 'pn-company-name', label: 'nome da empresa' },
  { tag: 'pn-company-address', label: 'endereço' },
  { tag: 'pn-verification-badge', label: 'selo de verificação' },
  { tag: 'pn-jobs', label: 'vagas abertas' },
] as const;
const MAX_CONFIG_BYTES = 4_500_000;
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
      version: 2,
      editorMode: 'visual',
      templateKey: 'aurora',
      templateVersion: 2,
      width: 'standard',
      theme: {
        primary: '#b84f38',
        background: '#f8f5f0',
        text: '#201d1b',
        accent: '#2f4f46',
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
        { id: 'jobs', type: 'jobs', enabled: true, locked: true },
        { id: 'legal', type: 'legal', enabled: true },
      ],
      codePage: {
        html: '',
        css: '',
        js: '',
      },
    };
  }

  async getForCompany(company: Company) {
    const existing = await this.pages.findOne({ where: { companyId: company.id } });
    if (existing) {
      const draft = this.normalizeConfig(existing.draft, company);
      return {
        ...existing,
        draft,
        validation: this.validate(draft, company),
      };
    }
    const draft = this.defaultConfig(company);
    return {
      companyId: company.id,
      templateKey: 'aurora',
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
        templateKey: String(config.templateKey || 'aurora'),
        draft: config,
        published: null,
        status: 'DRAFT',
        revision: 1,
        publishedAt: null,
      });
    } else {
      page.templateKey = String(config.templateKey || page.templateKey || 'aurora');
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
    page.templateKey = String(config.templateKey || 'aurora');
    page.draft = config;
    page.published = config;
    page.status = 'PUBLISHED';
    page.publishedAt = new Date();
    page.revision = existing?.published
      ? Math.max(1, Number(existing.revision || 1) + 1)
      : Math.max(1, Number(existing?.revision || 1));
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
    const editorMode = config.editorMode === 'code' ? 'code' : 'visual';
    const missingCompanyData: string[] = [];
    if (!company.name?.trim()) missingCompanyData.push('name');
    if (!company.address?.trim()) missingCompanyData.push('address');

    const warnings: string[] = [];
    let missingSections: string[] = [];
    let missingCodeComponents: string[] = [];

    if (editorMode === 'code') {
      const html = String(config.codePage?.html || '');
      missingCodeComponents = REQUIRED_CODE_COMPONENTS
        .filter(({ tag }) => !new RegExp(`<${tag}(?:\\s|>)`, 'i').test(html))
        .map(({ tag }) => tag);
      for (const missing of missingCodeComponents) {
        const component = REQUIRED_CODE_COMPONENTS.find((entry) => entry.tag === missing);
        warnings.push(`O componente obrigatório de ${component?.label || missing} precisa estar no HTML antes da publicação.`);
      }
    } else {
      const sections = Array.isArray(config.sections) ? config.sections : [];
      const activeTypes = new Set(
        sections
          .filter((section: any) => section && section.enabled !== false)
          .map((section: any) => String(section.type || section.id || '').trim()),
      );
      missingSections = REQUIRED_SECTION_TYPES.filter((type) => !activeTypes.has(type));
      if (missingSections.includes('jobs')) {
        warnings.push('O componente de vagas é obrigatório e precisa estar ativo antes da publicação.');
      }
      if (missingSections.includes('identity')) {
        warnings.push('A identidade obrigatória da empresa precisa estar ativa antes da publicação.');
      }
    }

    if (missingCompanyData.includes('address')) {
      warnings.push('Cadastre o endereço da empresa no Perfil da empresa antes de publicar.');
    }

    const structurallyValid = editorMode === 'code'
      ? missingCodeComponents.length === 0
      : missingSections.length === 0;

    return {
      editorMode,
      validForPublish: structurallyValid && missingCompanyData.length === 0,
      missingSections,
      missingCodeComponents,
      missingCompanyData,
      warnings,
      lockedComponents: ['companyName', 'address', 'verificationBadge', 'jobs'],
      requiredCodeTags: REQUIRED_CODE_COMPONENTS.map(({ tag }) => tag),
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

    const safeText = (value: unknown, max: number) => String(value || '').slice(0, max);
    const templateKey = safeText(input.templateKey || fallback.templateKey, 80);
    const width = ['compact', 'standard', 'wide', 'full'].includes(input.width)
      ? input.width
      : fallback.width;
    const editorMode = input.editorMode === 'code' ? 'code' : 'visual';
    const codePage = input.codePage && typeof input.codePage === 'object' ? input.codePage : {};

    return {
      ...fallback,
      ...input,
      version: 2,
      editorMode,
      templateKey,
      templateVersion: Math.max(1, Number(input.templateVersion || 2)),
      width,
      theme: { ...fallback.theme, ...(input.theme || {}) },
      cover: { ...fallback.cover, ...(input.cover || {}), url: safeText(input.cover?.url, 3_500_000) },
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
      codePage: {
        html: safeText(codePage.html, 180_000),
        css: safeText(codePage.css, 180_000),
        js: safeText(codePage.js, 180_000),
      },
    };
  }
}
