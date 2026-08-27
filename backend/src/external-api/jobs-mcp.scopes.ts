export type JobsCapabilityRisk = 'read' | 'write' | 'destructive';
export type JobsCapabilityChannel = 'v1' | 'v2' | 'mcp';

export type JobsCapability = {
  scope: string;
  section: string;
  category: string;
  label: string;
  description: string;
  risk: JobsCapabilityRisk;
  channels: JobsCapabilityChannel[];
  toolName?: string;
  endpoint?: string;
  legacy?: boolean;
  defaultV2?: boolean;
  defaultMcp?: boolean;
};

export const JOBS_CAPABILITIES: JobsCapability[] = [
  {
    scope: 'jobs:read',
    section: 'Compatibilidade',
    category: 'Scopes antigos',
    label: 'Leitura ampla de vagas',
    description: 'Escopo legado mantido apenas para integrações antigas. Novas chaves devem usar permissões granulares.',
    risk: 'read',
    channels: ['v1', 'mcp'],
    legacy: true,
  },
  {
    scope: 'jobs:write',
    section: 'Compatibilidade',
    category: 'Scopes antigos',
    label: 'Escrita ampla de vagas',
    description: 'Escopo legado mantido apenas para integrações antigas. Não concede novas funções gerenciais sensíveis.',
    risk: 'write',
    channels: ['v1', 'mcp'],
    legacy: true,
  },
  {
    scope: 'jobs:match:read',
    section: 'Compatibilidade',
    category: 'Scopes antigos',
    label: 'Leitura ampla de matching',
    description: 'Escopo legado que equivale às permissões de schema e fila de matchProfile.',
    risk: 'read',
    channels: ['mcp'],
    legacy: true,
  },
  {
    scope: 'automation:classifieds:read',
    section: 'Compatibilidade',
    category: 'Scopes antigos',
    label: 'Leitura ampla de automações dos Classificados',
    description: 'Escopo legado que libera as antigas consultas agrupadas de moderação dos Classificados.',
    risk: 'read',
    channels: ['mcp'],
    legacy: true,
  },
  {
    scope: 'automation:classifieds:write',
    section: 'Compatibilidade',
    category: 'Scopes antigos',
    label: 'Escrita ampla de automações dos Classificados',
    description: 'Escopo legado que libera as antigas decisões agrupadas de moderação dos Classificados.',
    risk: 'write',
    channels: ['mcp'],
    legacy: true,
  },
  {
    scope: 'automation:feedback:read',
    section: 'Compatibilidade',
    category: 'Scopes antigos',
    label: 'Leitura ampla de feedback e FAQ',
    description: 'Escopo legado que libera as antigas consultas agrupadas de feedback e fontes de FAQ.',
    risk: 'read',
    channels: ['mcp'],
    legacy: true,
  },
  {
    scope: 'automation:feedback:write',
    section: 'Compatibilidade',
    category: 'Scopes antigos',
    label: 'Escrita ampla de feedback e FAQ',
    description: 'Escopo legado que libera as antigas gravações agrupadas de insights e FAQs.',
    risk: 'write',
    channels: ['mcp'],
    legacy: true,
  },

  {
    scope: 'jobs:list',
    section: 'Vagas',
    category: 'Consulta',
    label: 'Listar e pesquisar vagas',
    description: 'Lista vagas com filtros, paginação, cidade, estado e situação.',
    risk: 'read',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_list',
    endpoint: 'GET /api/v2/jobs',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:detail',
    section: 'Vagas',
    category: 'Consulta',
    label: 'Consultar vaga por ID',
    description: 'Lê os dados completos de uma vaga, incluindo revisão, moderação e publicação.',
    risk: 'read',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_get',
    endpoint: 'GET /api/v2/jobs/:id',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:stats:read',
    section: 'Vagas',
    category: 'Consulta',
    label: 'Consultar estatísticas',
    description: 'Consulta totais por atividade, moderação, revisão e sinalização.',
    risk: 'read',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_stats',
    endpoint: 'GET /api/v2/jobs/stats',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:duplicates:check',
    section: 'Vagas',
    category: 'Cadastro e qualidade',
    label: 'Checar duplicidade de vaga',
    description: 'Pesquisa possíveis duplicidades antes do cadastro de uma vaga externa.',
    risk: 'read',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_check_duplicate',
    endpoint: 'POST /api/v2/jobs/check',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:create',
    section: 'Vagas',
    category: 'Cadastro e qualidade',
    label: 'Cadastrar vaga externa',
    description: 'Cadastra nova vaga externa usando validação, deduplicação e o fluxo normal de moderação.',
    risk: 'write',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_create_external',
    endpoint: 'POST /api/v2/jobs',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:update',
    section: 'Vagas',
    category: 'Cadastro e qualidade',
    label: 'Corrigir ou atualizar vaga',
    description: 'Atualiza o conteúdo permitido de uma vaga existente.',
    risk: 'write',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_update_external',
    endpoint: 'PATCH /api/v2/jobs/:id',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:verify',
    section: 'Vagas',
    category: 'Auditoria',
    label: 'Registrar verificação da fonte',
    description: 'Registra disponibilidade, fechamento, expiração, ausência ou incerteza da vaga na fonte original.',
    risk: 'write',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_verify_external',
    endpoint: 'POST /api/v2/jobs/:id/verification',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:review:read',
    section: 'Vagas',
    category: 'Auditoria',
    label: 'Consultar fila de revisão',
    description: 'Lista vagas pendentes, revisadas, para rechecagem, desativação ou resolução.',
    risk: 'read',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_review_queue',
    endpoint: 'GET /api/v2/jobs/review',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:review:write',
    section: 'Vagas',
    category: 'Auditoria',
    label: 'Alterar estado de revisão',
    description: 'Marca a vaga como revisada, para rechecagem, para desativação ou como resolvida.',
    risk: 'write',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_set_review_status',
    endpoint: 'PATCH /api/v2/jobs/:id/review',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:activate',
    section: 'Vagas',
    category: 'Publicação',
    label: 'Aprovar e ativar vaga',
    description: 'Ativa a vaga para publicação e registra a decisão operacional.',
    risk: 'write',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_activate',
    endpoint: 'POST /api/v2/jobs/:id/activate',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:deactivate',
    section: 'Vagas',
    category: 'Publicação',
    label: 'Desativar vaga',
    description: 'Retira uma vaga de publicação e encerra a pendência operacional quando apropriado.',
    risk: 'destructive',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_deactivate',
    endpoint: 'POST /api/v2/jobs/:id/deactivate',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:flag',
    section: 'Vagas',
    category: 'Sinalização',
    label: 'Sinalizar vaga',
    description: 'Cria ou atualiza um alerta operacional com motivo e observação.',
    risk: 'write',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_flag',
    endpoint: 'POST /api/v2/jobs/:id/flag',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:unflag',
    section: 'Vagas',
    category: 'Sinalização',
    label: 'Remover sinalização',
    description: 'Limpa o alerta depois da correção sem alterar indevidamente o estado de revisão.',
    risk: 'write',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_unflag',
    endpoint: 'POST /api/v2/jobs/:id/unflag',
    defaultV2: true,
    defaultMcp: true,
  },
  {
    scope: 'jobs:delete',
    section: 'Vagas',
    category: 'Manutenção sensível',
    label: 'Excluir vaga definitivamente',
    description: 'Remove definitivamente uma vaga. Deve ser liberado somente para integrações administrativas confiáveis.',
    risk: 'destructive',
    channels: ['v2', 'mcp'],
    toolName: 'piranegocios_jobs_delete',
    endpoint: 'DELETE /api/v2/jobs/:id',
  },

  {
    scope: 'jobs:match:schema:read',
    section: 'Vagas',
    category: 'Matching por IA externa',
    label: 'Consultar schema do matchProfile',
    description: 'Expõe o formato da ficha estruturada de uma vaga para o agente externo.',
    risk: 'read',
    channels: ['mcp'],
    toolName: 'piranegocios_jobs_match_profile_schema',
    defaultMcp: true,
  },
  {
    scope: 'jobs:match:status:read',
    section: 'Vagas',
    category: 'Matching por IA externa',
    label: 'Consultar fila de matchProfile',
    description: 'Localiza fichas prontas, ausentes, com erro ou desatualizadas para processamento externo.',
    risk: 'read',
    channels: ['mcp'],
    toolName: 'piranegocios_jobs_match_profile_status',
    defaultMcp: true,
  },
  {
    scope: 'jobs:match:write',
    section: 'Vagas',
    category: 'Matching por IA externa',
    label: 'Gravar matchProfile',
    description: 'Recebe a ficha estruturada produzida por um agente externo sem executar modelo de IA no backend.',
    risk: 'write',
    channels: ['mcp'],
    toolName: 'piranegocios_jobs_set_match_profile',
    defaultMcp: true,
  },

  {
    scope: 'automation:status:read',
    section: 'Operações externas',
    category: 'Controle',
    label: 'Consultar status das filas externas',
    description: 'Mostra as filas request-only que substituíram os antigos disparos automáticos de IA.',
    risk: 'read',
    channels: ['mcp'],
    toolName: 'piranegocios_ai_automation_status',
    defaultMcp: true,
  },
  {
    scope: 'automation:classifieds:listings:queue:read',
    section: 'Classificados',
    category: 'Moderação de anúncios',
    label: 'Consultar fila de anúncios',
    description: 'Lista anúncios publicados que ainda aguardam revisão externa de possível duplicidade.',
    risk: 'read',
    channels: ['mcp'],
    toolName: 'piranegocios_classifieds_listing_moderation_queue',
    defaultMcp: true,
  },
  {
    scope: 'automation:classifieds:listings:context:read',
    section: 'Classificados',
    category: 'Moderação de anúncios',
    label: 'Consultar contexto de duplicidade',
    description: 'Carrega um anúncio e candidatos anteriores da mesma identidade para comparação externa.',
    risk: 'read',
    channels: ['mcp'],
    toolName: 'piranegocios_classifieds_listing_moderation_context',
    defaultMcp: true,
  },
  {
    scope: 'automation:classifieds:listings:moderation:write',
    section: 'Classificados',
    category: 'Moderação de anúncios',
    label: 'Aplicar moderação de anúncio',
    description: 'Grava APPROVE ou DUPLICATE produzido externamente e pode pausar o anúncio duplicado.',
    risk: 'write',
    channels: ['mcp'],
    toolName: 'piranegocios_classifieds_apply_listing_moderation',
    defaultMcp: true,
  },
  {
    scope: 'automation:classifieds:reviews:queue:read',
    section: 'Classificados',
    category: 'Moderação de avaliações',
    label: 'Consultar avaliações pendentes',
    description: 'Lista avaliações de compras aguardando decisão externa ou manual.',
    risk: 'read',
    channels: ['mcp'],
    toolName: 'piranegocios_classifieds_review_moderation_queue',
    defaultMcp: true,
  },
  {
    scope: 'automation:classifieds:reviews:moderation:write',
    section: 'Classificados',
    category: 'Moderação de avaliações',
    label: 'Aplicar moderação de avaliação',
    description: 'Grava aprovação ou reprovação produzida por um agente externo.',
    risk: 'write',
    channels: ['mcp'],
    toolName: 'piranegocios_classifieds_apply_review_moderation',
    defaultMcp: true,
  },

  {
    scope: 'automation:feedback:queue:read',
    section: 'Produto & suporte',
    category: 'Feedback',
    label: 'Consultar feedback aberto',
    description: 'Lê feedbacks para agrupamento e priorização por um agente externo.',
    risk: 'read',
    channels: ['mcp'],
    toolName: 'piranegocios_product_feedback_queue',
    defaultMcp: true,
  },
  {
    scope: 'automation:feedback:insights:write',
    section: 'Produto & suporte',
    category: 'Feedback',
    label: 'Gravar insights de feedback',
    description: 'Substitui os insights pelos agrupamentos preparados externamente.',
    risk: 'write',
    channels: ['mcp'],
    toolName: 'piranegocios_product_feedback_apply_insights',
    defaultMcp: true,
  },
  {
    scope: 'automation:feedback:faq-source:read',
    section: 'Produto & suporte',
    category: 'FAQ',
    label: 'Consultar fonte para FAQ',
    description: 'Lê perguntas recentes do suporte para um agente externo propor artigos de ajuda.',
    risk: 'read',
    channels: ['mcp'],
    toolName: 'piranegocios_product_faq_source',
    defaultMcp: true,
  },
  {
    scope: 'automation:feedback:faqs:write',
    section: 'Produto & suporte',
    category: 'FAQ',
    label: 'Gravar rascunhos de FAQ',
    description: 'Salva rascunhos produzidos externamente. A publicação continua dependendo de revisão administrativa.',
    risk: 'write',
    channels: ['mcp'],
    toolName: 'piranegocios_product_feedback_apply_faqs',
    defaultMcp: true,
  },
];

export const ALL_JOBS_SCOPES = JOBS_CAPABILITIES.map((capability) => capability.scope);
export const JOBS_MCP_SCOPES = JOBS_CAPABILITIES
  .filter((capability) => capability.channels.includes('mcp'))
  .map((capability) => capability.scope);
export const DEFAULT_JOBS_V2_SCOPES = JOBS_CAPABILITIES
  .filter((capability) => capability.defaultV2)
  .map((capability) => capability.scope);
export const DEFAULT_JOBS_MCP_SCOPES = JOBS_CAPABILITIES
  .filter((capability) => capability.defaultMcp)
  .map((capability) => capability.scope);
export type JobsMcpScope = string;

export function sanitizeJobsScopes(value: unknown, fallback: string[] = DEFAULT_JOBS_MCP_SCOPES) {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set(ALL_JOBS_SCOPES);
  return Array.from(new Set(value.map(String).filter((scope) => allowed.has(scope))));
}

const LEGACY_SCOPE_EQUIVALENTS: Record<string, string[]> = {
  'jobs:match:read': ['jobs:match:schema:read', 'jobs:match:status:read'],
  'automation:classifieds:read': [
    'automation:status:read',
    'automation:classifieds:listings:queue:read',
    'automation:classifieds:listings:context:read',
    'automation:classifieds:reviews:queue:read',
  ],
  'automation:classifieds:write': [
    'automation:classifieds:listings:moderation:write',
    'automation:classifieds:reviews:moderation:write',
  ],
  'automation:feedback:read': [
    'automation:feedback:queue:read',
    'automation:feedback:faq-source:read',
  ],
  'automation:feedback:write': [
    'automation:feedback:insights:write',
    'automation:feedback:faqs:write',
  ],
};

const LEGACY_READ_EQUIVALENTS = new Set([
  'jobs:list',
  'jobs:match:schema:read',
  'jobs:match:status:read',
]);
const LEGACY_WRITE_EQUIVALENTS = new Set([
  'jobs:duplicates:check',
  'jobs:create',
  'jobs:update',
  'jobs:verify',
]);

export function expandLegacyJobsScopes(scopes: Iterable<string>) {
  const values = scopes instanceof Set ? new Set(scopes) : new Set(scopes);
  const expanded = new Set<string>();
  for (const scope of values) {
    if (scope === 'jobs:read' || scope === 'jobs:write') continue;
    const equivalents = LEGACY_SCOPE_EQUIVALENTS[scope];
    if (equivalents) equivalents.forEach((item) => expanded.add(item));
    else expanded.add(scope);
  }

  const hasExplicitGranularJobsScope = Array.from(values).some(
    (value) => value.startsWith('jobs:') && !['jobs:read', 'jobs:write'].includes(value),
  );
  if (!hasExplicitGranularJobsScope) {
    if (values.has('jobs:read')) LEGACY_READ_EQUIVALENTS.forEach((scope) => expanded.add(scope));
    if (values.has('jobs:write')) LEGACY_WRITE_EQUIVALENTS.forEach((scope) => expanded.add(scope));
  }
  return Array.from(expanded);
}

export function hasJobsScope(scopes: Iterable<string>, scope: string) {
  const values = scopes instanceof Set ? scopes : new Set(scopes);
  if (values.has(scope)) return true;
  if (scope === 'jobs:read' || scope === 'jobs:write') return values.has(scope);

  for (const [legacyScope, equivalents] of Object.entries(LEGACY_SCOPE_EQUIVALENTS)) {
    if (values.has(legacyScope) && equivalents.includes(scope)) return true;
  }

  const hasGranularScope = Array.from(values).some(
    (value) => value.startsWith('jobs:') && !['jobs:read', 'jobs:write'].includes(value),
  );
  if (hasGranularScope) return false;

  // O envelope histórico nunca concede permissões gerenciais introduzidas depois.
  if (values.has('jobs:read') && LEGACY_READ_EQUIVALENTS.has(scope)) return true;
  if (values.has('jobs:write') && LEGACY_WRITE_EQUIVALENTS.has(scope)) return true;
  return false;
}
