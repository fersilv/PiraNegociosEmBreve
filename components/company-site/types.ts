export type CompanySiteType = 'store' | 'institutional' | 'services' | 'careers';
export type CompanyBusinessDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type CompanyBusinessHoursInterval = { open: string; close: string };
export type CompanyBusinessSpecialDate = { date: string; label?: string; closed?: boolean; open?: string; close?: string };

export interface CompanySiteConfig {
  version?: number;
  siteType?: CompanySiteType | string;
  templateKey?: string;
  whatsapp?: string;
  businessHours?: {
    enabled?: boolean;
    showOnPage?: boolean;
    timezone?: string;
    days?: Partial<Record<CompanyBusinessDay, CompanyBusinessHoursInterval[]>>;
    specialDates?: CompanyBusinessSpecialDate[];
  };
  legal?: {
    termsEnabled?: boolean;
    termsTitle?: string;
    termsBody?: string;
    privacyEnabled?: boolean;
    privacyTitle?: string;
    privacyBody?: string;
  };
}

export interface PublicCompanyLike {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  website?: string;
  address?: string;
  cityState?: string;
  city?: string;
  state?: string;
  phone?: string;
  whatsapp?: string;
  logoURL?: string;
  socialInstagram?: string;
  socialLinkedin?: string;
  socialFacebook?: string;
  isVerified?: boolean;
  verificationStatus?: string;
}

export interface PublicJobLike {
  id?: string;
  slug?: string;
  title?: string;
  location?: string;
  city?: string;
  state?: string;
  type?: string;
  workModel?: string;
  salary?: string;
}

export const COMPANY_SITE_TYPES: Array<{
  id: CompanySiteType;
  name: string;
  eyebrow: string;
  description: string;
  bestFor: string;
}> = [
  { id: 'store', name: 'Loja', eyebrow: 'Varejo & catálogo', description: 'Uma vitrine comercial com cara de e-commerce, produtos em primeiro plano e caminhos rápidos para compra e contato.', bestFor: 'Lojas, mercados, moda, presentes, alimentação e varejo.' },
  { id: 'institutional', name: 'Institucional', eyebrow: 'Marca & organização', description: 'Um site corporativo sóbrio, com identidade, história, presença regional, reputação, vagas e portfólio.', bestFor: 'Indústrias, associações, escolas, clínicas e organizações.' },
  { id: 'services', name: 'Serviços', eyebrow: 'Atendimento & solução', description: 'Uma apresentação orientada a conversão, com serviços, diferenciais, contato e reputação como protagonistas.', bestFor: 'Assistências, escritórios, oficinas, tecnologia e prestadores.' },
  { id: 'careers', name: 'Carreiras', eyebrow: 'Empregador & talentos', description: 'Uma experiência de employer branding em que oportunidades e cultura aparecem antes do restante do catálogo.', bestFor: 'Empresas com contratação recorrente ou marca empregadora forte.' },
];

const LEGACY_STORE_KEYS = new Set(['vitrine','bazar','portal','loja','marketplace','catalogo','classificados-pro','mercado','gazeta','mosaico','radar','pregao']);
export function resolveCompanySiteType(config?: CompanySiteConfig | null): CompanySiteType {
  const raw = String(config?.siteType || config?.templateKey || '').toLowerCase();
  if (raw === 'store' || LEGACY_STORE_KEYS.has(raw)) return 'store';
  if (raw === 'services') return 'services';
  if (raw === 'careers') return 'careers';
  return 'institutional';
}
