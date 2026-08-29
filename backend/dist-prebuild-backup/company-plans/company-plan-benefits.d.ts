export type CompanyWhatsAppFeature = 'WHATSAPP_FREE' | 'JOB_ACTIVATE' | 'JOB_DEACTIVATE' | 'JOB_CLOSE' | 'CANDIDATES_DETAIL' | 'CANDIDATE_PROFILE' | 'APPLICATION_STATUS' | 'APPLICATION_NOTE' | 'CANDIDATE_INVITE' | 'CANDIDATE_INVITE_CANCEL' | 'TALENT_MANAGE' | 'CANDIDATE_WHATSAPP' | 'RECENT_APPLICATIONS' | 'ADVANCED_JOB_STATS';
export type CompanyPlanBenefitId = Exclude<CompanyWhatsAppFeature, 'WHATSAPP_FREE'> | 'JOB_HIGHLIGHT' | 'AD_HIGHLIGHT';
export type PaidCompanyPlan = 'PLUS' | 'ELITE';
export type CompanyPlanBenefitDefinition = {
    id: CompanyPlanBenefitId;
    label: string;
    description: string;
    category: 'WHATSAPP' | 'VISIBILITY';
    minimumPlan: PaidCompanyPlan;
};
export declare const COMPANY_PLAN_BENEFIT_CATALOG: CompanyPlanBenefitDefinition[];
export declare function benefitCatalogForPlan(plan: PaidCompanyPlan): CompanyPlanBenefitDefinition[];
export declare function defaultBenefitIdsForPlan(plan: PaidCompanyPlan): CompanyPlanBenefitId[];
export declare function normalizeBenefitIds(plan: PaidCompanyPlan, value: unknown): CompanyPlanBenefitId[];
export declare function benefitDefinitions(ids: CompanyPlanBenefitId[]): CompanyPlanBenefitDefinition[];
