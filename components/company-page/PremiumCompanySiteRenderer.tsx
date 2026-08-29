import React from 'react';
import { FullPageCompanySandbox } from './FullPageCompanySandbox';

export type CompanyPageWidth = 'compact' | 'standard' | 'wide' | 'full';
export type CompanyEditorMode = 'visual' | 'code';
export type CompanyTypography = 'clean' | 'editorial' | 'technical' | 'human';
export type CompanyHeroLayout = 'split' | 'centered' | 'cover' | 'minimal';
export type CompanyJobsLayout = 'list' | 'grid' | 'compact';

export interface CompanyPageSection {
  id: string;
  type: 'identity' | 'about' | 'contact' | 'socials' | 'jobs' | 'legal' | string;
  enabled?: boolean;
  locked?: boolean;
}

export interface CompanyPageConfig {
  version?: number;
  editorMode?: CompanyEditorMode;
  templateKey?: string;
  width?: CompanyPageWidth;
  theme?: { primary?: string; background?: string; text?: string; accent?: string };
  branding?: {
    typography?: CompanyTypography;
    logoSize?: 'small' | 'medium' | 'large';
    corners?: 'square' | 'soft' | 'round';
  };
  navigation?: {
    enabled?: boolean;
    sticky?: boolean;
    transparent?: boolean;
    jobsLabel?: string;
  };
  hero?: {
    layout?: CompanyHeroLayout;
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    jobsLabel?: string;
  };
  jobs?: {
    title?: string;
    intro?: string;
    layout?: CompanyJobsLayout;
  };
  footer?: { text?: string };
  cover?: { enabled?: boolean; url?: string; height?: 'small' | 'medium' | 'large'; position?: string; overlay?: number };
  about?: { title?: string; text?: string };
  contacts?: { phone?: string; secondaryPhone?: string; whatsapp?: string; email?: string; website?: string };
  socials?: { instagram?: string; linkedin?: string; facebook?: string; youtube?: string; tiktok?: string };
  legal?: { termsEnabled?: boolean; termsTitle?: string; termsBody?: string; privacyEnabled?: boolean; privacyTitle?: string; privacyBody?: string };
  sections?: CompanyPageSection[];
  codePage?: { html?: string; css?: string; js?: string };
  advanced?: { enabled?: boolean; html?: string; css?: string; js?: string };
}

export interface PublicCompanyLike {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  website?: string;
  address?: string;
  cityState?: string;
  city?: string;
  state?: string;
  phone?: string;
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

export function CompanySiteRenderer({ company, jobs, page, preview = false }: { company: PublicCompanyLike; jobs: PublicJobLike[]; page?: any; preview?: boolean }) {
  const config = page || {};
  
  // Apply page overrides to the company object for the sandbox
  const companyWithOverrides = {
    ...company,
    phone: config.contacts?.phone || company.phone,
    website: config.contacts?.website || company.website,
    socialInstagram: config.socials?.instagram || company.socialInstagram,
    socialLinkedin: config.socials?.linkedin || company.socialLinkedin,
    socialFacebook: config.socials?.facebook || company.socialFacebook,
    description: config.about?.text || company.description,
  };

  return (
    <FullPageCompanySandbox
      company={companyWithOverrides}
      jobs={jobs}
      html={config.codePage?.html || ''}
      css={config.codePage?.css || ''}
      js={config.codePage?.js || ''}
    />
  );
}
