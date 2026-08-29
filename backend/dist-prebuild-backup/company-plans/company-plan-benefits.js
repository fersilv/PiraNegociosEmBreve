"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPANY_PLAN_BENEFIT_CATALOG = void 0;
exports.benefitCatalogForPlan = benefitCatalogForPlan;
exports.defaultBenefitIdsForPlan = defaultBenefitIdsForPlan;
exports.normalizeBenefitIds = normalizeBenefitIds;
exports.benefitDefinitions = benefitDefinitions;
const PLAN_RANK = { PLUS: 1, ELITE: 2 };
exports.COMPANY_PLAN_BENEFIT_CATALOG = [
    {
        id: 'JOB_ACTIVATE',
        label: 'Ativar vagas pelo WhatsApp',
        description: 'Permite ativar uma vaga diretamente pela assistente empresarial.',
        category: 'WHATSAPP',
        minimumPlan: 'PLUS',
    },
    {
        id: 'JOB_DEACTIVATE',
        label: 'Desativar vagas pelo WhatsApp',
        description: 'Permite pausar uma vaga diretamente pela assistente empresarial.',
        category: 'WHATSAPP',
        minimumPlan: 'PLUS',
    },
    {
        id: 'JOB_CLOSE',
        label: 'Encerrar vagas pelo WhatsApp',
        description: 'Permite encerrar o processo de uma vaga pela assistente empresarial.',
        category: 'WHATSAPP',
        minimumPlan: 'PLUS',
    },
    {
        id: 'CANDIDATES_DETAIL',
        label: 'Candidatos com detalhes no WhatsApp',
        description: 'Lista candidatos individualmente com mais informações.',
        category: 'WHATSAPP',
        minimumPlan: 'PLUS',
    },
    {
        id: 'CANDIDATE_PROFILE',
        label: 'Perfil e currículo pelo WhatsApp',
        description: 'Abre perfil e currículo do candidato na operação pelo WhatsApp.',
        category: 'WHATSAPP',
        minimumPlan: 'PLUS',
    },
    {
        id: 'APPLICATION_STATUS',
        label: 'Alterar status de candidatura',
        description: 'Permite movimentar o candidato nas etapas da seleção pelo WhatsApp.',
        category: 'WHATSAPP',
        minimumPlan: 'ELITE',
    },
    {
        id: 'APPLICATION_NOTE',
        label: 'Observações internas de candidatos',
        description: 'Adiciona observações internas durante a gestão pelo WhatsApp.',
        category: 'WHATSAPP',
        minimumPlan: 'ELITE',
    },
    {
        id: 'CANDIDATE_INVITE',
        label: 'Convidar candidatos pelo WhatsApp',
        description: 'Permite enviar convite para vagas diretamente pela assistente.',
        category: 'WHATSAPP',
        minimumPlan: 'ELITE',
    },
    {
        id: 'CANDIDATE_INVITE_CANCEL',
        label: 'Cancelar convites pelo WhatsApp',
        description: 'Permite cancelar um convite pendente diretamente pela assistente.',
        category: 'WHATSAPP',
        minimumPlan: 'ELITE',
    },
    {
        id: 'TALENT_MANAGE',
        label: 'Banco de Talentos e pastas pelo WhatsApp',
        description: 'Adiciona e remove candidatos do Banco de Talentos e de pastas.',
        category: 'WHATSAPP',
        minimumPlan: 'ELITE',
    },
    {
        id: 'CANDIDATE_WHATSAPP',
        label: 'Gestão de candidatos pelo WhatsApp',
        description: 'Amplia as ações de relacionamento e gestão de candidatos pela assistente.',
        category: 'WHATSAPP',
        minimumPlan: 'ELITE',
    },
    {
        id: 'RECENT_APPLICATIONS',
        label: 'Novas candidaturas por período',
        description: 'Consulta candidaturas recentes por intervalo de tempo.',
        category: 'WHATSAPP',
        minimumPlan: 'ELITE',
    },
    {
        id: 'ADVANCED_JOB_STATS',
        label: 'Estatísticas avançadas das vagas',
        description: 'Libera consultas avançadas de desempenho das vagas pelo WhatsApp.',
        category: 'WHATSAPP',
        minimumPlan: 'ELITE',
    },
    {
        id: 'JOB_HIGHLIGHT',
        label: 'Elegibilidade para destaque de vagas',
        description: 'Permite que a empresa participe dos recursos de destaque de vagas do PiraNegócios.',
        category: 'VISIBILITY',
        minimumPlan: 'ELITE',
    },
    {
        id: 'AD_HIGHLIGHT',
        label: 'Elegibilidade para destaques na Meta e Google',
        description: 'Permite elegibilidade às ações publicitárias do PiraNegócios na Meta e Google.',
        category: 'VISIBILITY',
        minimumPlan: 'ELITE',
    },
];
function benefitCatalogForPlan(plan) {
    return exports.COMPANY_PLAN_BENEFIT_CATALOG.filter((benefit) => PLAN_RANK[benefit.minimumPlan] <= PLAN_RANK[plan]);
}
function defaultBenefitIdsForPlan(plan) {
    return benefitCatalogForPlan(plan).map((benefit) => benefit.id);
}
function normalizeBenefitIds(plan, value) {
    const allowed = new Set(benefitCatalogForPlan(plan).map((benefit) => benefit.id));
    if (!Array.isArray(value))
        return defaultBenefitIdsForPlan(plan);
    return Array.from(new Set(value
        .map((item) => String(item || '').trim().toUpperCase())
        .filter((item) => allowed.has(item))));
}
function benefitDefinitions(ids) {
    const selected = new Set(ids);
    return exports.COMPANY_PLAN_BENEFIT_CATALOG.filter((benefit) => selected.has(benefit.id));
}
//# sourceMappingURL=company-plan-benefits.js.map