import {
  All,
  BadRequestException,
  Controller,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  JOB_MATCH_ALGORITHM_VERSION,
  JobMatchService,
} from '../job-match/job-match.service';
import { ExternalJobsService } from './external-jobs.service';
import type { ExternalJobInput, JobCatalogQuery } from './external-jobs.service';
import { hasJobsScope } from './jobs-mcp.scopes';
import { JobsOAuthGuard } from './jobs-oauth.guard';
import { JobsOperationsService } from './jobs-operations.service';

type ExternalJobWithMatchInput = ExternalJobInput & { matchProfile?: unknown };

@Controller('jobs/mcp')
@UseGuards(JobsOAuthGuard)
export class JobsMcpController {
  constructor(
    private readonly jobs: ExternalJobsService,
    private readonly operations: JobsOperationsService,
    private readonly jobMatch: JobMatchService,
    private readonly dataSource: DataSource,
  ) {}

  @All()
  async handle(@Req() req: any, @Res() res: any) {
    const [{ createMcpHandler, McpServer }, { toNodeHandler }, z] =
      await Promise.all([
        import('@modelcontextprotocol/server'),
        import('@modelcontextprotocol/node'),
        import('zod/v4'),
      ]);
    const scopes = new Set<string>(req.jobsOAuth?.scopes || []);
    const apiClient = req.jobsOAuth?.apiClient;
    const allowed = (scope: string) => hasJobsScope(scopes, scope);
    const actor = `mcp:${apiClient?.id || 'unknown'}:${apiClient?.name || 'integration'}`.slice(0, 160);

    const externalJobFields = {
      title: z.string().min(1).max(180).optional(),
      sourceName: z.string().max(160).optional(),
      sourceUrl: z.string().max(2000).optional(),
      city: z.string().max(120).optional(),
      state: z.string().max(2).optional(),
      description: z.string().min(1).max(20000).optional(),
      requirements: z.string().max(20000).optional(),
      type: z.string().max(40).optional(),
      workModel: z.string().max(40).optional(),
      salary: z.string().max(80).optional(),
      estimatedSalary: z.string().max(80).optional(),
      estimatedSalarySource: z.string().max(160).optional(),
      estimatedSalarySourceUrl: z.string().max(2000).optional(),
      estimatedSalaryRegion: z.string().max(160).optional(),
      estimatedSalaryUpdatedAt: z.string().optional(),
      pcdMode: z.enum(['GENERAL', 'INCLUSIVE', 'EXCLUSIVE']).optional(),
      applicationEmail: z.string().max(254).optional(),
      applicationWhatsApp: z.string().max(30).optional(),
      applicationUrl: z.string().max(2000).optional(),
      applicationUrlTitle: z.string().max(180).optional(),
      externalApplicationInstructions: z.string().max(5000).optional(),
      deadlineDate: z.string().optional(),
      isTalentPool: z.boolean().optional(),
      isFlagged: z.boolean().optional(),
      flagObservation: z.string().max(1000).optional(),
      companyName: z.string().max(160).optional(),
      sourceExternalId: z.string().max(120).optional(),
      sourcePublishedAt: z.string().optional(),
      lastVerifiedAt: z.string().optional(),
      lastSeenAt: z.string().optional(),
      flagReason: z.string().max(120).optional(),
      flaggedAt: z.string().optional(),
      flaggedBy: z.string().max(120).optional(),
      matchProfile: z.any().optional(),
    };

    const handler = createMcpHandler(() => {
      const server = new McpServer({
        name: 'PiraNegócios Vagas',
        version: '2.0.0',
      });

      if (allowed('jobs:list')) {
        server.registerTool(
          'piranegocios_jobs_list',
          {
            description: 'Lista e pesquisa vagas com filtros, estado ativo e paginação por cursor.',
            inputSchema: z.object({
              q: z.string().max(300).optional(),
              limit: z.number().int().min(1).max(100).optional(),
              cursor: z.string().max(1024).optional(),
              active: z.boolean().optional(),
              external: z.boolean().optional(),
              city: z.string().max(120).optional(),
              state: z.string().max(2).optional(),
              type: z.string().max(40).optional(),
              workModel: z.string().max(40).optional(),
              companyId: z.string().max(100).optional(),
              pcdMode: z.enum(['GENERAL', 'INCLUSIVE', 'EXCLUSIVE']).optional(),
            }),
          },
          async (args: any) => {
            const query: JobCatalogQuery = {
              ...args,
              limit: args.limit === undefined ? undefined : String(args.limit),
              active: args.active === undefined ? undefined : String(args.active),
              external: args.external === undefined ? undefined : String(args.external),
            };
            return this.result(await this.jobs.list(query, apiClient));
          },
        );
      }

      if (allowed('jobs:detail')) {
        server.registerTool(
          'piranegocios_jobs_get',
          {
            description: 'Consulta uma vaga específica por ID, incluindo moderação, revisão operacional e estado ativo.',
            inputSchema: z.object({ id: z.string().uuid() }),
          },
          async ({ id }: { id: string }) => this.result(await this.operations.get(id)),
        );
      }

      if (allowed('jobs:stats:read')) {
        server.registerTool(
          'piranegocios_jobs_stats',
          {
            description: 'Consulta totais de vagas ativas/inativas, alertas, moderação e cada estado da fila operacional.',
            inputSchema: z.object({}),
          },
          async () => this.result(await this.operations.stats()),
        );
      }

      if (allowed('jobs:review:read')) {
        server.registerTool(
          'piranegocios_jobs_review_queue',
          {
            description: 'Consulta a fila operacional sem misturar vagas novas com vagas já analisadas que precisam de rechecagem ou desativação.',
            inputSchema: z.object({
              status: z.enum([
                'PENDING_REVIEW',
                'REVIEWED_OK',
                'RECHECK_REQUIRED',
                'DEACTIVATION_REQUIRED',
                'RESOLVED',
              ]).optional(),
              active: z.boolean().optional(),
              city: z.string().max(120).optional(),
              state: z.string().max(2).optional(),
              page: z.number().int().min(1).optional(),
              pageSize: z.number().int().min(1).max(100).optional(),
            }),
          },
          async (args: any) => this.result(await this.operations.reviewQueue(args)),
        );
      }

      if (allowed('jobs:match:read')) {
        server.registerTool(
          'piranegocios_jobs_match_profile_schema',
          {
            description: 'Retorna o formato aceito em matchProfile para uma IA enviar a ficha estruturada da vaga.',
            inputSchema: z.object({}),
          },
          async () => this.result(this.matchProfileSchema()),
        );

        server.registerTool(
          'piranegocios_jobs_match_profile_status',
          {
            description: 'Lista o estado das fichas de matching e localiza vagas com perfil ausente ou desatualizado.',
            inputSchema: z.object({
              ready: z.enum(['true', 'false', 'all']).optional(),
              active: z.enum(['true', 'false', 'all']).optional(),
              limit: z.number().int().min(1).max(500).optional(),
              city: z.string().max(120).optional(),
              state: z.string().max(2).optional(),
            }),
          },
          async (args: any) => this.result(await this.matchProfileStatus(args)),
        );
      }

      if (allowed('jobs:duplicates:check')) {
        server.registerTool(
          'piranegocios_jobs_check_duplicate',
          {
            description: 'Verifica se uma vaga já existe antes do cadastro.',
            inputSchema: z.object({
              ...externalJobFields,
              title: z.string().min(1).max(180),
              description: z.string().min(1).max(20000),
              allowSimilarDuplicate: z.boolean().optional(),
            }),
          },
          async (args: any) => this.result(await this.jobs.check(args, apiClient)),
        );
      }

      if (allowed('jobs:create')) {
        server.registerTool(
          'piranegocios_jobs_create_external',
          {
            description: 'Cadastra uma vaga externa com deduplicação e fluxo normal de moderação.',
            inputSchema: z.object({
              ...externalJobFields,
              title: z.string().min(1).max(180),
              description: z.string().min(1).max(20000),
              allowSimilarDuplicate: z.boolean().optional(),
            }),
          },
          async (args: ExternalJobWithMatchInput) => this.result(await this.createExternal(args, apiClient)),
        );
      }

      if (allowed('jobs:update')) {
        server.registerTool(
          'piranegocios_jobs_update_external',
          {
            description: 'Atualiza o conteúdo de uma vaga externa gerida pela credencial de ingestão.',
            inputSchema: z.object({ id: z.string().uuid(), ...externalJobFields }),
          },
          async ({ id, ...input }: any) => this.result(await this.updateExternal(id, input, apiClient)),
        );
      }

      if (allowed('jobs:verify')) {
        server.registerTool(
          'piranegocios_jobs_verify_external',
          {
            description: 'Registra uma verificação da fonte. O novo reviewStatus é atualizado sem devolver vagas revisadas para a fila de novas.',
            inputSchema: z.object({
              id: z.string().uuid(),
              status: z.enum(['AVAILABLE', 'NOT_FOUND', 'CLOSED', 'EXPIRED', 'UNCERTAIN']),
              observation: z.string().max(1000).optional(),
              matchProfile: z.any().optional(),
            }),
          },
          async ({ id, ...input }: any) => this.result(await this.verifyExternal(id, input, apiClient)),
        );
      }

      if (allowed('jobs:activate')) {
        server.registerTool(
          'piranegocios_jobs_activate',
          {
            description: 'Ativa uma vaga e registra a decisão de revisão. Requer autorização jobs:activate.',
            inputSchema: z.object({ id: z.string().uuid(), note: z.string().max(4000).optional() }),
          },
          async ({ id, note }: { id: string; note?: string }) => this.result(await this.operations.setActive(id, true, actor, note)),
        );
      }

      if (allowed('jobs:deactivate')) {
        server.registerTool(
          'piranegocios_jobs_deactivate',
          {
            description: 'Desativa uma vaga e marca a ação operacional como resolvida. AÇÃO SENSÍVEL.',
            inputSchema: z.object({ id: z.string().uuid(), note: z.string().max(4000).optional() }),
          },
          async ({ id, note }: { id: string; note?: string }) => this.result(await this.operations.setActive(id, false, actor, note)),
        );
      }

      if (allowed('jobs:review:write')) {
        server.registerTool(
          'piranegocios_jobs_set_review_status',
          {
            description: 'Altera o estado operacional da revisão de uma vaga sem confundir revisão, moderação e publicação.',
            inputSchema: z.object({
              id: z.string().uuid(),
              status: z.enum([
                'PENDING_REVIEW',
                'REVIEWED_OK',
                'RECHECK_REQUIRED',
                'DEACTIVATION_REQUIRED',
                'RESOLVED',
              ]),
              note: z.string().max(4000).optional(),
            }),
          },
          async ({ id, status, note }: { id: string; status: string; note?: string }) => this.result(await this.operations.setReview(id, status, actor, note)),
        );
      }

      if (allowed('jobs:flag')) {
        server.registerTool(
          'piranegocios_jobs_flag',
          {
            description: 'Sinaliza uma vaga para ação ou rechecagem.',
            inputSchema: z.object({
              id: z.string().uuid(),
              reason: z.string().max(120).optional(),
              observation: z.string().max(4000).optional(),
            }),
          },
          async ({ id, ...data }: any) => this.result(await this.operations.flag(id, actor, data)),
        );
      }

      if (allowed('jobs:unflag')) {
        server.registerTool(
          'piranegocios_jobs_unflag',
          {
            description: 'Limpa um alerta preservando o estado de revisão para a vaga não voltar à fila de vagas novas.',
            inputSchema: z.object({ id: z.string().uuid(), note: z.string().max(4000).optional() }),
          },
          async ({ id, note }: { id: string; note?: string }) => this.result(await this.operations.clearFlag(id, actor, note)),
        );
      }

      if (allowed('jobs:delete')) {
        server.registerTool(
          'piranegocios_jobs_delete',
          {
            description: 'Exclui definitivamente uma vaga. AÇÃO DESTRUTIVA, conceda este escopo somente a integrações administrativas.',
            inputSchema: z.object({ id: z.string().uuid() }),
          },
          async ({ id }: { id: string }) => this.result(await this.operations.remove(id)),
        );
      }

      return server;
    });

    const nodeHandler = toNodeHandler(handler);
    await nodeHandler(req, res, req.body);
  }

  private async createExternal(input: ExternalJobWithMatchInput, apiClient: any) {
    const result: any = await this.jobs.create(input, apiClient);
    if (input?.matchProfile !== undefined && result?.created && result?.job?.id) {
      const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
      return { ...result, matchProfile };
    }
    return result;
  }

  private async updateExternal(id: string, input: ExternalJobWithMatchInput, apiClient: any) {
    if (input?.matchProfile !== undefined) this.jobMatch.stageProvidedProfile(id, input.matchProfile);
    try {
      const result: any = await this.jobs.update(id, input, apiClient);
      if (input?.matchProfile !== undefined && result?.job?.id) {
        const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
        return { ...result, matchProfile };
      }
      return result;
    } finally {
      this.jobMatch.clearStagedProvidedProfile(id);
    }
  }

  private async verifyExternal(id: string, input: any, apiClient: any) {
    if (input?.matchProfile !== undefined) this.jobMatch.stageProvidedProfile(id, input.matchProfile);
    try {
      const result: any = await this.jobs.verify(id, input, apiClient);
      if (input?.matchProfile !== undefined && result?.job?.id) {
        const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
        return { ...result, matchProfile };
      }
      return result;
    } finally {
      this.jobMatch.clearStagedProvidedProfile(id);
    }
  }

  private matchProfileSchema() {
    return {
      field: 'matchProfile',
      optional: true,
      purpose: 'Permite que uma IA de ingestão envie a ficha estruturada da vaga e evite uma segunda chamada de IA interna quando a ficha for aceita.',
      requiredFields: ['canonicalRole', 'occupationalFamily'],
      requirementTypes: ['SKILL', 'EXPERIENCE', 'EDUCATION', 'CERTIFICATION', 'LICENSE', 'OTHER'],
      schema: {
        canonicalRole: 'string',
        occupationalFamily: 'string',
        occupationKeywords: ['string'],
        technicalSkills: [{ name: 'string', required: 'boolean', weight: 'number 0.1..5', evidenceTerms: ['string'] }],
        requirements: [{ label: 'string', type: 'SKILL|EXPERIENCE|EDUCATION|CERTIFICATION|LICENSE|OTHER', required: 'boolean', weight: 'number 0.1..5', evidenceTerms: ['string'] }],
        softSkills: ['string'],
        summary: 'string',
      },
      note: 'A ficha descreve a vaga. Ela nunca define score de candidato; a compatibilidade continua sendo calculada internamente contra cada currículo.',
    };
  }

  private async matchProfileStatus(args: any) {
    const normalizedReady = String(args.ready || 'all').trim().toLowerCase();
    const normalizedActive = String(args.active || 'true').trim().toLowerCase();
    if (!['true', 'false', 'all'].includes(normalizedReady)) throw new BadRequestException('ready deve ser true, false ou all.');
    if (!['true', 'false', 'all'].includes(normalizedActive)) throw new BadRequestException('active deve ser true, false ou all.');

    const safeLimit = Math.min(500, Math.max(1, Number(args.limit || 500)));
    const cleanCity = String(args.city || '').trim();
    const cleanState = String(args.state || '').trim().toUpperCase();
    if (cleanState && !/^[A-Z]{2}$/.test(cleanState)) throw new BadRequestException('state deve ser uma UF com 2 letras.');

    const params: unknown[] = [JOB_MATCH_ALGORITHM_VERSION];
    const where: string[] = [];
    if (normalizedActive !== 'all') {
      params.push(normalizedActive === 'true');
      where.push(`j.active = $${params.length}`);
    }
    if (cleanCity) {
      params.push(cleanCity);
      where.push(`LOWER(j.city) = LOWER($${params.length})`);
    }
    if (cleanState) {
      params.push(cleanState);
      where.push(`UPPER(j.state) = $${params.length}`);
    }

    const validReadyExpression = `(p.status = 'READY' AND p."algorithmVersion" = $1)`;
    if (normalizedReady === 'true') where.push(validReadyExpression);
    if (normalizedReady === 'false') where.push(`NOT ${validReadyExpression}`);
    params.push(Math.trunc(safeLimit));

    const rows = await this.dataSource.query(
      `SELECT
         j.id,
         j.slug,
         j.title,
         j."companyName",
         j."sourceName",
         j."sourceUrl",
         j."sourceExternalId",
         j.city,
         j.state,
         j.active,
         j."moderationStatus",
         j."reviewStatus",
         j."reviewedAt",
         j."createdAt",
         j."updatedAt",
         p.status AS "matchProfileStatus",
         p."algorithmVersion" AS "matchProfileAlgorithmVersion",
         p.error AS "matchProfileError",
         p."analyzedAt" AS "matchProfileAnalyzedAt",
         p."updatedAt" AS "matchProfileUpdatedAt",
         ${validReadyExpression} AS ready
       FROM jobs j
       LEFT JOIN job_match_profiles p ON p."jobId" = j.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY j."createdAt" DESC, j.id DESC
       LIMIT $${params.length}`,
      params,
    );

    return {
      data: rows.map((row: any) => ({
        ...row,
        matchProfileStatus: row.matchProfileStatus || 'MISSING',
        ready: Boolean(row.ready),
      })),
      count: rows.length,
      filters: {
        ready: normalizedReady,
        active: normalizedActive,
        city: cleanCity || null,
        state: cleanState || null,
        limit: Math.trunc(safeLimit),
        algorithmVersion: JOB_MATCH_ALGORITHM_VERSION,
      },
    };
  }

  private result(value: unknown) {
    return { content: [{ type: 'text' as const, text: this.safeStringify(value) }] };
  }

  private safeStringify(value: unknown) {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      value,
      (_key, nested) => {
        if (typeof nested === 'bigint') return nested.toString();
        if (Buffer.isBuffer(nested)) return { type: 'buffer', base64: nested.toString('base64') };
        if (nested && typeof nested === 'object') {
          if (seen.has(nested)) return '[circular]';
          seen.add(nested);
        }
        if (typeof nested === 'function') return undefined;
        return nested;
      },
      2,
    );
  }
}
