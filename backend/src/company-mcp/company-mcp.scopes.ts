export type CompanyMcpRisk = 'read' | 'write' | 'destructive';

export type CompanyMcpCapability = {
  scope: string;
  domain: 'company' | 'catalog' | 'recruitment' | 'analytics';
  label: string;
  description: string;
  risk: CompanyMcpRisk;
  permission?: 'companyProfile' | 'marketplace' | 'recruitment';
  default?: boolean;
};

export const COMPANY_MCP_CAPABILITIES: CompanyMcpCapability[] = [
  { scope: 'company:read', domain: 'company', label: 'Consultar empresa conectada', description: 'Lê identidade, situação e configuração básica da empresa vinculada ao OAuth.', risk: 'read', permission: 'companyProfile', default: true },

  { scope: 'catalog:categories:read', domain: 'catalog', label: 'Consultar categorias', description: 'Lê categorias e atributos disponíveis para cadastro de produtos.', risk: 'read', permission: 'marketplace', default: true },
  { scope: 'catalog:products:list', domain: 'catalog', label: 'Listar produtos', description: 'Lista produtos e seus estados no catálogo da empresa.', risk: 'read', permission: 'marketplace', default: true },
  { scope: 'catalog:products:read', domain: 'catalog', label: 'Consultar produto', description: 'Lê um produto específico pertencente à empresa conectada.', risk: 'read', permission: 'marketplace', default: true },
  { scope: 'catalog:products:create', domain: 'catalog', label: 'Cadastrar produtos', description: 'Cria produtos em rascunho no catálogo da empresa.', risk: 'write', permission: 'marketplace', default: true },
  { scope: 'catalog:products:update', domain: 'catalog', label: 'Atualizar produtos', description: 'Atualiza conteúdo, preço, estoque, imagens e variações de produtos.', risk: 'write', permission: 'marketplace', default: true },
  { scope: 'catalog:products:publish', domain: 'catalog', label: 'Publicar produtos', description: 'Publica produtos após as validações comerciais e cadastrais.', risk: 'write', permission: 'marketplace', default: true },
  { scope: 'catalog:products:status', domain: 'catalog', label: 'Alterar status de produtos', description: 'Pausa, reabre como rascunho, marca como vendido ou arquiva um produto.', risk: 'write', permission: 'marketplace', default: true },
  { scope: 'catalog:products:delete', domain: 'catalog', label: 'Remover produtos do catálogo', description: 'Arquiva o produto de forma segura, preservando histórico comercial e auditoria.', risk: 'destructive', permission: 'marketplace' },
  { scope: 'catalog:analytics:read', domain: 'analytics', label: 'Relatórios de catálogo e vendas', description: 'Consulta métricas do catálogo, visualizações, favoritos e distribuição de status.', risk: 'read', permission: 'marketplace', default: true },

  { scope: 'recruitment:jobs:list', domain: 'recruitment', label: 'Listar vagas da empresa', description: 'Lista as vagas criadas pela empresa conectada.', risk: 'read', permission: 'recruitment', default: true },
  { scope: 'recruitment:jobs:read', domain: 'recruitment', label: 'Consultar vaga', description: 'Lê os detalhes de uma vaga pertencente à empresa.', risk: 'read', permission: 'recruitment', default: true },
  { scope: 'recruitment:jobs:create', domain: 'recruitment', label: 'Criar vagas', description: 'Cria novas vagas da empresa.', risk: 'write', permission: 'recruitment', default: true },
  { scope: 'recruitment:jobs:update', domain: 'recruitment', label: 'Atualizar vagas', description: 'Atualiza conteúdo, regras de candidatura e dados de uma vaga.', risk: 'write', permission: 'recruitment', default: true },
  { scope: 'recruitment:jobs:status', domain: 'recruitment', label: 'Ativar ou pausar vagas', description: 'Altera a disponibilidade de vagas pertencentes à empresa.', risk: 'write', permission: 'recruitment', default: true },
  { scope: 'recruitment:jobs:delete', domain: 'recruitment', label: 'Excluir vagas', description: 'Exclui definitivamente uma vaga da empresa. Use somente após confirmação explícita.', risk: 'destructive', permission: 'recruitment' },
  { scope: 'recruitment:applications:list', domain: 'recruitment', label: 'Listar candidaturas', description: 'Lista candidaturas recebidas pelas vagas da empresa.', risk: 'read', permission: 'recruitment', default: true },
  { scope: 'recruitment:applications:read', domain: 'recruitment', label: 'Consultar candidatura', description: 'Consulta uma candidatura e o snapshot de currículo recebido.', risk: 'read', permission: 'recruitment', default: true },
  { scope: 'recruitment:applications:update', domain: 'recruitment', label: 'Atualizar candidatura', description: 'Atualiza status, prioridade e observações de uma candidatura e mantém as notificações do fluxo.', risk: 'write', permission: 'recruitment', default: true },
  { scope: 'recruitment:analytics:read', domain: 'analytics', label: 'Relatórios de recrutamento', description: 'Consulta funil de candidaturas, vagas, contratações e visualizações.', risk: 'read', permission: 'recruitment', default: true },

  { scope: 'analytics:reports:run', domain: 'analytics', label: 'Executar relatórios sob demanda', description: 'Permite ao agente solicitar relatórios parametrizados somente dos domínios que também estejam autorizados.', risk: 'read', default: true },
];

export const COMPANY_MCP_SCOPES = COMPANY_MCP_CAPABILITIES.map((item) => item.scope);

export const DEFAULT_COMPANY_MCP_SCOPES = COMPANY_MCP_CAPABILITIES
  .filter((item) => item.default)
  .map((item) => item.scope);

export function companyScopeCapability(scope: string) {
  return COMPANY_MCP_CAPABILITIES.find((item) => item.scope === scope) || null;
}
