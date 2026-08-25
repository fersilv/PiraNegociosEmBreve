export type JobsCapabilityRisk = 'read' | 'write' | 'destructive';

export type JobsCapability = {
  scope: string;
  category: string;
  label: string;
  description: string;
  risk: JobsCapabilityRisk;
  legacy?: boolean;
  defaultMcp?: boolean;
};

export const JOBS_CAPABILITIES: JobsCapability[] = [
  {
    scope: 'jobs:read',
    category: 'Compatibilidade',
    label: 'Leitura ampla de vagas',
    description: 'Escopo legado que mantém compatibilidade com integrações antigas de leitura.',
    risk: 'read',
    legacy: true,
  },
  {
    scope: 'jobs:write',
    category: 'Compatibilidade',
    label: 'Escrita ampla de vagas',
    description: 'Escopo legado que mantém compatibilidade com integrações antigas de escrita.',
    risk: 'write',
    legacy: true,
  },
  { scope: 'jobs:list', category: 'Vagas · Consulta', label: 'Listar vagas', description: 'Lista vagas com filtros, paginação e estado operacional.', risk: 'read', defaultMcp: true },
  { scope: 'jobs:detail', category: 'Vagas · Consulta', label: 'Consultar vaga por ID', description: 'Lê os dados completos de uma vaga específica.', risk: 'read', defaultMcp: true },
  { scope: 'jobs:stats:read', category: 'Vagas · Consulta', label: 'Consultar estatísticas', description: 'Consulta totais de vagas por atividade, moderação, revisão e alertas.', risk: 'read', defaultMcp: true },
  { scope: 'jobs:duplicates:check', category: 'Vagas · Consulta', label: 'Checar duplicidade', description: 'Pesquisa possíveis duplicidades antes de criar ou atualizar uma vaga.', risk: 'read', defaultMcp: true },
  { scope: 'jobs:match:read', category: 'Vagas · Consulta', label: 'Consultar perfil de aderência', description: 'Consulta schema e estado do mecanismo de compatibilidade de vagas.', risk: 'read', defaultMcp: true },
  { scope: 'jobs:review:read', category: 'Vagas · Revisão', label: 'Consultar fila de revisão', description: 'Lista vagas pelo novo estado operacional de revisão.', risk: 'read', defaultMcp: true },
  { scope: 'jobs:create', category: 'Vagas · Cadastro', label: 'Criar vaga', description: 'Cadastra nova vaga externa usando o fluxo normal de validação e deduplicação.', risk: 'write', defaultMcp: true },
  { scope: 'jobs:update', category: 'Vagas · Cadastro', label: 'Atualizar vaga', description: 'Atualiza conteúdo permitido de uma vaga existente.', risk: 'write', defaultMcp: true },
  { scope: 'jobs:verify', category: 'Vagas · Revisão', label: 'Registrar verificação', description: 'Registra disponibilidade, fechamento, expiração, ausência ou incerteza da fonte.', risk: 'write', defaultMcp: true },
  { scope: 'jobs:review:write', category: 'Vagas · Revisão', label: 'Alterar estado de revisão', description: 'Marca a vaga como revisada, para rechecagem, exigindo desativação ou resolvida.', risk: 'write' },
  { scope: 'jobs:activate', category: 'Vagas · Publicação', label: 'Ativar vaga', description: 'Ativa uma vaga para publicação e registra a decisão operacional.', risk: 'write' },
  { scope: 'jobs:deactivate', category: 'Vagas · Publicação', label: 'Desativar vaga', description: 'Desativa uma vaga e encerra o estado operacional pendente quando apropriado.', risk: 'destructive' },
  { scope: 'jobs:flag', category: 'Vagas · Alertas', label: 'Sinalizar vaga', description: 'Cria ou atualiza um alerta operacional na vaga.', risk: 'write' },
  { scope: 'jobs:unflag', category: 'Vagas · Alertas', label: 'Limpar alerta', description: 'Limpa o alerta sem devolver uma vaga já revisada para a fila de vagas novas.', risk: 'write' },
  { scope: 'jobs:delete', category: 'Vagas · Manutenção', label: 'Excluir vaga definitivamente', description: 'Remove definitivamente uma vaga. Deve ser liberado apenas para integrações administrativas confiáveis.', risk: 'destructive' },
];

export const JOBS_MCP_SCOPES = JOBS_CAPABILITIES.map((capability) => capability.scope);
export const DEFAULT_JOBS_MCP_SCOPES = JOBS_CAPABILITIES.filter((capability) => capability.defaultMcp).map((capability) => capability.scope);
export type JobsMcpScope = string;

export function sanitizeJobsScopes(value: unknown, fallback: string[] = DEFAULT_JOBS_MCP_SCOPES) {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set(JOBS_MCP_SCOPES);
  return Array.from(new Set(value.map(String).filter((scope) => allowed.has(scope))));
}

export function hasJobsScope(scopes: Iterable<string>, scope: string) {
  const values = scopes instanceof Set ? scopes : new Set(scopes);
  if (values.has(scope)) return true;
  if (scope === 'jobs:read' || scope === 'jobs:write') return values.has(scope);

  // Se a credencial já possui qualquer scope granular, os umbrellas antigos
  // deixam de conceder permissões implícitas. Isso preserva OAuths antigos sem
  // transformar jobs:write em autorização acidental para delete/deactivate.
  const hasGranularScope = Array.from(values).some(
    (value) => value.startsWith('jobs:') && !['jobs:read', 'jobs:write'].includes(value),
  );
  if (hasGranularScope) return false;

  const capability = JOBS_CAPABILITIES.find((item) => item.scope === scope);
  if (!capability) return false;
  return capability.risk === 'read' ? values.has('jobs:read') : values.has('jobs:write');
}
