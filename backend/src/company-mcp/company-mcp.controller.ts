import { All, Controller, ForbiddenException, Req, Res, UseGuards } from '@nestjs/common';
import { CompanyMcpOAuthGuard } from './company-mcp-oauth.guard';
import { CompanyMcpOperationsService } from './company-mcp-operations.service';

@Controller('company/mcp')
@UseGuards(CompanyMcpOAuthGuard)
export class CompanyMcpController {
  constructor(private readonly operations: CompanyMcpOperationsService) {}

  @All()
  async handle(@Req() req: any, @Res() res: any) {
    const [{ createMcpHandler, McpServer }, { toNodeHandler }, z] = await Promise.all([
      import('@modelcontextprotocol/server'),
      import('@modelcontextprotocol/node'),
      import('zod/v4'),
    ]);
    const auth = req.companyMcpOAuth;
    const companyId = String(auth.company.id);
    const actorUserId = String(auth.authorizedByUserId);
    const scopes = new Set<string>(auth.scopes || []);
    const allowed = (scope: string) => scopes.has(scope);

    const productFields = {
      categorySlug: z.string().min(1).max(80).optional(),
      title: z.string().min(1).max(160).optional(),
      description: z.string().min(1).max(12000).optional(),
      price: z.union([z.number().min(0).max(999999999.99), z.string().max(40)]).optional(),
      priceType: z.enum(['FIXED', 'NEGOTIABLE', 'STARTING_AT']).optional(),
      condition: z.enum(['NEW', 'USED', 'REFURBISHED']).optional(),
      city: z.string().max(120).optional(),
      state: z.string().length(2).optional(),
      neighborhood: z.string().max(140).nullable().optional(),
      attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      publicationChannels: z.array(z.enum(['CLASSIFIEDS', 'COMPANY_PAGE'])).min(1).max(2).optional(),
      catalogConfig: z.record(z.string(), z.any()).nullable().optional(),
      commerceConfig: z.record(z.string(), z.any()).nullable().optional(),
      stockQuantity: z.number().int().min(0).max(1000000).optional(),
      contactPhone: z.string().max(40).nullable().optional(),
      contactWhatsapp: z.string().max(40).nullable().optional(),
      images: z.array(z.union([z.string().max(2200), z.object({ url: z.string().max(2200) })])).max(10).optional(),
    };

    const jobFields = {
      title: z.string().min(1).max(180).optional(),
      description: z.string().min(1).max(20000).optional(),
      requirements: z.string().max(20000).nullable().optional(),
      skills: z.array(z.string().max(80)).max(10).optional(),
      location: z.string().max(180).nullable().optional(),
      city: z.string().max(120).nullable().optional(),
      state: z.string().max(2).nullable().optional(),
      type: z.string().max(40).nullable().optional(),
      workModel: z.string().max(40).nullable().optional(),
      salary: z.string().max(120).nullable().optional(),
      pcdMode: z.enum(['GENERAL', 'INCLUSIVE', 'EXCLUSIVE']).optional(),
      isConfidential: z.boolean().optional(),
      isInternal: z.boolean().optional(),
      isTalentPool: z.boolean().optional(),
      active: z.boolean().optional(),
      deadlineDate: z.string().nullable().optional(),
      acceptsPlatformApplications: z.boolean().optional(),
      requiresResumeFile: z.boolean().optional(),
      externalApplicationInstructions: z.string().max(5000).nullable().optional(),
      applicationEmail: z.string().max(254).nullable().optional(),
      applicationWhatsApp: z.string().max(30).nullable().optional(),
      applicationUrl: z.string().max(2000).nullable().optional(),
      applicationUrlTitle: z.string().max(180).nullable().optional(),
    };

    const reportSchema = z.object({
      domain: z.enum(['COMMERCE', 'RECRUITMENT', 'EXECUTIVE']),
      from: z.string().max(40).optional(),
      to: z.string().max(40).optional(),
      groupBy: z.enum(['status', 'category', 'job', 'day']).optional(),
      metrics: z.array(z.string().max(80)).max(30).optional(),
    });

    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: 'PiraNegócios Business', version: '1.0.0' });
      const register = (scope: string, name: string, definition: any, fn: any) => {
        if (allowed(scope)) server.registerTool(name, definition, fn);
      };

      register('company:read', 'piranegocios_company_context', {
        description: 'Retorna a empresa vinculada a este OAuth e o estado do catálogo. Nunca aceita companyId arbitrário.',
        inputSchema: z.object({}),
      }, async () => this.result(await this.operations.companyContext(companyId)));

      register('company:read', 'piranegocios_company_agent_guide', {
        description: 'Retorna instruções operacionais para agentes que usam o MCP empresarial.',
        inputSchema: z.object({}),
      }, async () => this.result({
        companyBound: true,
        rules: [
          'Use somente registros retornados por este MCP; a empresa é definida pelo OAuth.',
          'Crie produtos como rascunho e publique em uma chamada separada.',
          'Antes de arquivar produto ou excluir vaga, confirme a intenção quando houver ambiguidade.',
          'Não invente IDs, preços, estoque, status de candidatura ou dados de candidatos.',
          'Para análises, prefira relatórios parametrizados por período e domínio.',
          'Dados de candidatura são dados pessoais: use apenas para o processo seletivo autorizado.',
        ],
        commonFlows: [
          'catalog: listar categorias -> criar produto -> revisar -> publicar',
          'inventory: localizar produto -> atualizar preço/estoque/imagens -> consultar novamente',
          'recruitment: criar vaga -> listar candidaturas -> consultar candidatura -> atualizar status',
          'analytics: executar relatório COMMERCE, RECRUITMENT ou EXECUTIVE com período explícito',
        ],
      }));

      register('catalog:categories:read', 'piranegocios_company_categories', {
        description: 'Lista categorias, subcategorias e schemas de atributos para preparar cadastros corretos.',
        inputSchema: z.object({}),
      }, async () => this.result(await this.operations.categories()));

      register('catalog:products:list', 'piranegocios_company_products_list', {
        description: 'Lista e pesquisa produtos pertencentes exclusivamente à empresa conectada.',
        inputSchema: z.object({
          q: z.string().max(200).optional(),
          status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'SOLD', 'ARCHIVED', 'PENDING_REVIEW']).optional(),
          categorySlug: z.string().max(80).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        }),
      }, async (args: any) => this.result(await this.operations.productsList(companyId, args)));

      register('catalog:products:read', 'piranegocios_company_product_get', {
        description: 'Consulta um produto por ID, incluindo imagens, variações, preço e estoque.',
        inputSchema: z.object({ id: z.string().uuid() }),
      }, async ({ id }: { id: string }) => this.result(await this.operations.productGet(companyId, id)));

      register('catalog:products:create', 'piranegocios_company_product_create', {
        description: 'Cadastra um produto como RASCUNHO. Use a ferramenta de publicação somente depois de revisar os dados.',
        inputSchema: z.object({
          ...productFields,
          categorySlug: z.string().min(1).max(80),
          title: z.string().min(1).max(160),
          description: z.string().min(1).max(12000),
          price: z.union([z.number().min(0).max(999999999.99), z.string().max(40)]),
        }),
      }, async (args: any) => this.result(await this.operations.productCreate(companyId, actorUserId, args)));

      register('catalog:products:update', 'piranegocios_company_product_update', {
        description: 'Atualiza campos de um produto da empresa: conteúdo, preço, estoque, imagens, atributos, variações e canais.',
        inputSchema: z.object({ id: z.string().uuid(), ...productFields }),
      }, async ({ id, ...input }: any) => this.result(await this.operations.productUpdate(companyId, id, input)));

      register('catalog:products:publish', 'piranegocios_company_product_publish', {
        description: 'Publica um produto. Requer empresa apta, verificada, adesão ao Marketplace e termos atuais.',
        inputSchema: z.object({ id: z.string().uuid() }),
      }, async ({ id }: { id: string }) => this.result(await this.operations.productPublish(companyId, id)));

      register('catalog:products:status', 'piranegocios_company_product_set_status', {
        description: 'Altera o estado do produto entre rascunho, publicado, pausado, vendido ou arquivado.',
        inputSchema: z.object({ id: z.string().uuid(), status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'SOLD', 'ARCHIVED']) }),
      }, async ({ id, status }: { id: string; status: string }) => this.result(await this.operations.productStatus(companyId, id, status)));

      register('catalog:products:delete', 'piranegocios_company_product_archive', {
        description: 'Remove o produto do catálogo ativo por ARQUIVAMENTO SEGURO. Não apaga histórico de pedidos, conversas ou auditoria.',
        inputSchema: z.object({ id: z.string().uuid() }),
      }, async ({ id }: { id: string }) => this.result(await this.operations.productArchive(companyId, id)));

      register('catalog:analytics:read', 'piranegocios_company_commerce_analytics', {
        description: 'Gera métricas do catálogo da empresa por período: produtos, publicados, vendidos, visualizações, favoritos e estoque.',
        inputSchema: z.object({ from: z.string().max(40).optional(), to: z.string().max(40).optional() }),
      }, async (args: any) => this.result(await this.operations.commerceAnalytics(companyId, args)));

      register('recruitment:jobs:list', 'piranegocios_company_jobs_list', {
        description: 'Lista vagas pertencentes à empresa conectada.',
        inputSchema: z.object({ q: z.string().max(200).optional(), active: z.boolean().optional(), limit: z.number().int().min(1).max(100).optional() }),
      }, async (args: any) => this.result(await this.operations.jobsList(companyId, args)));

      register('recruitment:jobs:read', 'piranegocios_company_job_get', {
        description: 'Consulta uma vaga da empresa por ID.',
        inputSchema: z.object({ id: z.string().uuid() }),
      }, async ({ id }: { id: string }) => this.result(await this.operations.jobGet(companyId, id)));

      register('recruitment:jobs:create', 'piranegocios_company_job_create', {
        description: 'Cria uma nova vaga pertencente à empresa conectada.',
        inputSchema: z.object({ ...jobFields, title: z.string().min(1).max(180), description: z.string().min(1).max(20000) }),
      }, async (args: any) => this.result(await this.operations.jobCreate(companyId, actorUserId, args)));

      register('recruitment:jobs:update', 'piranegocios_company_job_update', {
        description: 'Atualiza uma vaga pertencente à empresa conectada.',
        inputSchema: z.object({ id: z.string().uuid(), ...jobFields }),
      }, async ({ id, ...input }: any) => this.result(await this.operations.jobUpdate(companyId, actorUserId, id, input)));

      register('recruitment:jobs:status', 'piranegocios_company_job_set_active', {
        description: 'Ativa ou pausa uma vaga pertencente à empresa conectada.',
        inputSchema: z.object({ id: z.string().uuid(), active: z.boolean() }),
      }, async ({ id, active }: { id: string; active: boolean }) => this.result(await this.operations.jobStatus(companyId, actorUserId, id, active)));

      register('recruitment:jobs:delete', 'piranegocios_company_job_delete', {
        description: 'Exclui definitivamente uma vaga da empresa. Ação destrutiva, use após confirmação explícita.',
        inputSchema: z.object({ id: z.string().uuid() }),
      }, async ({ id }: { id: string }) => this.result(await this.operations.jobDelete(companyId, actorUserId, id)));

      register('recruitment:applications:list', 'piranegocios_company_applications_list', {
        description: 'Lista candidaturas da empresa com filtros por vaga e status. A listagem evita carregar o currículo completo.',
        inputSchema: z.object({ jobId: z.string().uuid().optional(), status: z.enum(['PENDING', 'REVIEWING', 'DOCUMENTS_REQUESTED', 'DOCUMENTS_SUBMITTED', 'HIRED', 'REJECTED', 'WITHDRAWN']).optional(), limit: z.number().int().min(1).max(200).optional() }),
      }, async (args: any) => this.result(await this.operations.applicationsList(companyId, args)));

      register('recruitment:applications:read', 'piranegocios_company_application_get', {
        description: 'Consulta uma candidatura da empresa, incluindo o snapshot de currículo recebido. Trate os dados como pessoais e confidenciais.',
        inputSchema: z.object({ id: z.string().uuid() }),
      }, async ({ id }: { id: string }) => this.result(await this.operations.applicationGet(companyId, id)));

      register('recruitment:applications:update', 'piranegocios_company_application_update', {
        description: 'Atualiza status, prioridade, observações e solicitações de documentos da candidatura usando o fluxo normal de notificações.',
        inputSchema: z.object({
          id: z.string().uuid(),
          status: z.enum(['PENDING', 'REVIEWING', 'DOCUMENTS_REQUESTED', 'DOCUMENTS_SUBMITTED', 'HIRED', 'REJECTED', 'WITHDRAWN']).optional(),
          priority: z.string().max(120).nullable().optional(),
          observations: z.array(z.union([z.string().max(3000), z.record(z.string(), z.any())])).max(100).optional(),
          documentsRequested: z.boolean().optional(),
          customDocs: z.array(z.record(z.string(), z.any())).max(100).optional(),
        }),
      }, async ({ id, ...input }: any) => this.result(await this.operations.applicationUpdate(companyId, actorUserId, id, input)));

      register('recruitment:analytics:read', 'piranegocios_company_recruitment_analytics', {
        description: 'Gera métricas do recrutamento por período: vagas, visualizações, candidaturas, análise, contratações e recusas.',
        inputSchema: z.object({ from: z.string().max(40).optional(), to: z.string().max(40).optional() }),
      }, async (args: any) => this.result(await this.operations.recruitmentAnalytics(companyId, args)));

      register('analytics:reports:run', 'piranegocios_company_report', {
        description: 'Executa relatório sob demanda para o agente. COMMERCE exige analytics de catálogo; RECRUITMENT exige analytics de recrutamento; EXECUTIVE exige ambos.',
        inputSchema: reportSchema,
      }, async (args: any) => {
        if ((args.domain === 'COMMERCE' || args.domain === 'EXECUTIVE') && !allowed('catalog:analytics:read')) throw new ForbiddenException('O OAuth não autoriza analytics de catálogo.');
        if ((args.domain === 'RECRUITMENT' || args.domain === 'EXECUTIVE') && !allowed('recruitment:analytics:read')) throw new ForbiddenException('O OAuth não autoriza analytics de recrutamento.');
        return this.result(await this.operations.report(companyId, args.domain, args));
      });

      return server;
    });

    const nodeHandler = toNodeHandler(handler);
    await nodeHandler(req, res, req.body);
  }

  private result(value: unknown) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
    };
  }
}
