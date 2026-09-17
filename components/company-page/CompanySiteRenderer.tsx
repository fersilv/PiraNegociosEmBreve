import React from 'react';
import { CareersCompanySite } from '../company-site/CareersCompanySite';
import { InstitutionalCompanySite } from '../company-site/InstitutionalCompanySite';
import { ServicesCompanySite } from '../company-site/ServicesCompanySite';
import { StoreCompanySite } from '../company-site/StoreCompanySite';
import { resolveCompanySiteType } from '../company-site/types';
import type { CompanySiteConfig, CompanySiteType, PublicCompanyLike, PublicJobLike } from '../company-site/types';

export type { CompanySiteConfig as CompanyPageConfig, CompanySiteType, PublicCompanyLike, PublicJobLike } from '../company-site/types';

export function CompanySiteRenderer({ company, jobs, page }: { company: PublicCompanyLike; jobs: PublicJobLike[]; page?: CompanySiteConfig | null }) {
  const config: CompanySiteConfig = page || { version: 3, siteType: 'institutional' };
  const siteType = resolveCompanySiteType(config);
  const companyWithOperationalContacts = config.whatsapp ? { ...company, whatsapp: config.whatsapp } : company;
  if (siteType === 'store') return <StoreCompanySite company={companyWithOperationalContacts} jobs={jobs} config={config} />;
  if (siteType === 'services') return <ServicesCompanySite company={companyWithOperationalContacts} jobs={jobs} config={config} />;
  if (siteType === 'careers') return <CareersCompanySite company={companyWithOperationalContacts} jobs={jobs} config={config} />;
  return <InstitutionalCompanySite company={companyWithOperationalContacts} jobs={jobs} config={config} />;
}

export function isCommerceCompanyTheme(key: string): boolean {
  return resolveCompanySiteType({ siteType: key }) === 'store';
}
