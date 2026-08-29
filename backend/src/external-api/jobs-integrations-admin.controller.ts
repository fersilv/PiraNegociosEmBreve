import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ExternalApiClient } from './entities/external-api-client.entity';
import {
  DEFAULT_JOBS_MCP_SCOPES,
  DEFAULT_JOBS_V2_SCOPES,
  expandLegacyJobsScopes,
  JOBS_CAPABILITIES,
  sanitizeJobsScopes,
} from './jobs-mcp.scopes';

type IntegrationKind = 'v1' | 'v2' | 'mcp';
const LEGACY_OAUTH_ENVELOPE = ['jobs:read', 'jobs:write'];

@Controller('admin/job-integrations')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class JobsIntegrationsAdminController {
  constructor(
    @InjectRepository(ExternalApiClient)
    private readonly clients: Repository<ExternalApiClient>,
  ) {}

  @Get('capabilities')
  capabilities() {
    return {
      capabilities: JOBS_CAPABILITIES,
      defaults: {
        v1: LEGACY_OAUTH_ENVELOPE,
        v2: DEFAULT_JOBS_V2_SCOPES,
        mcp: DEFAULT_JOBS_MCP_SCOPES,
      },
      policy: {
        mcpPermissionModel: 'ONE_TOOL_ONE_SCOPE',
        legacyScopesAccepted: true,
        newKeysUseLegacyUmbrella: false,
      },
    };
  }

  @Get('clients')
  async list(@Query('kind') kindRaw?: string) {
    const kind = this.kind(kindRaw || 'v1');
    const target = this.target(kind);
    const clients = await this.clients.find({
      where: { apiVersion: target.apiVersion, audience: target.audience },
      select: {
        id: true,
        name: true,
        sourceLabel: true,
        keyPrefix: true,
        scopes: true,
        apiVersion: true,
        audience: true,
        active: true,
        createdById: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' },
    });
    return clients.map((client) => this.publicClient(client));
  }

  @Post('clients')
  async create(
    @Req() req: any,
    @Body()
    data: { kind?: string; name?: string; sourceLabel?: string; scopes?: string[] },
  ) {
    const kind = this.kind(data.kind || 'v2');
    const target = this.target(kind);
    const name = String(data.name || '').trim().slice(0, 120);
    const sourceLabel = String(data.sourceLabel || name).trim().slice(0, 160);
    if (!name || !sourceLabel) {
      throw new BadRequestException('Nome e identificação da origem são obrigatórios.');
    }

    const scopes = kind === 'v1'
      ? [...LEGACY_OAUTH_ENVELOPE]
      : this.scopesForKind(kind, data.scopes, kind === 'mcp' ? DEFAULT_JOBS_MCP_SCOPES : DEFAULT_JOBS_V2_SCOPES);
    if (!scopes.length) throw new BadRequestException('Selecione pelo menos uma permissão.');

    const apiKey = this.newKey(kind);
    const client = await this.clients.save(
      this.clients.create({
        name,
        sourceLabel,
        keyPrefix: apiKey.slice(0, 20),
        keyHash: this.hash(apiKey),
        scopes,
        apiVersion: target.apiVersion,
        audience: target.audience,
        active: true,
        createdById: String(req.user?.uid || req.user?.email || 'admin'),
        lastUsedAt: null,
      }),
    );

    return {
      client: this.publicClient(client),
      apiKey,
      warning: 'Copie agora. A chave completa não será exibida novamente.',
    };
  }

  @Put('clients/:id')
  async update(
    @Param('id') id: string,
    @Body()
    data: { name?: string; sourceLabel?: string; active?: boolean; scopes?: string[] },
  ) {
    const client = await this.clients.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Chave não encontrada.');
    if (data.name?.trim()) client.name = data.name.trim().slice(0, 120);
    if (data.sourceLabel?.trim()) client.sourceLabel = data.sourceLabel.trim().slice(0, 160);
    if (typeof data.active === 'boolean') client.active = data.active;
    if (Array.isArray(data.scopes)) {
      if (client.apiVersion === 'v1' && client.audience === 'api') {
        client.scopes = [...LEGACY_OAUTH_ENVELOPE];
      } else {
        const kind: IntegrationKind = client.audience === 'mcp' ? 'mcp' : 'v2';
        const selected = this.scopesForKind(kind, data.scopes, []);
        if (!selected.length) throw new BadRequestException('Selecione pelo menos uma permissão.');
        client.scopes = selected;
      }
    }
    return this.publicClient(await this.clients.save(client));
  }

  @Post('clients/:id/rotate')
  async rotate(@Param('id') id: string) {
    const client = await this.clients.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Chave não encontrada.');
    const kind: IntegrationKind = client.audience === 'mcp'
      ? 'mcp'
      : client.apiVersion === 'v2'
        ? 'v2'
        : 'v1';
    const apiKey = this.newKey(kind);
    client.keyPrefix = apiKey.slice(0, 20);
    client.keyHash = this.hash(apiKey);
    client.active = true;
    await this.clients.save(client);
    return { apiKey, warning: 'A chave anterior foi revogada. Copie esta chave agora.' };
  }

  private kind(value: string): IntegrationKind {
    const normalized = String(value || '').trim().toLowerCase();
    if (!['v1', 'v2', 'mcp'].includes(normalized)) {
      throw new BadRequestException('kind deve ser v1, v2 ou mcp.');
    }
    return normalized as IntegrationKind;
  }

  private target(kind: IntegrationKind) {
    if (kind === 'mcp') return { apiVersion: 'v2' as const, audience: 'mcp' as const };
    return { apiVersion: kind, audience: 'api' as const };
  }

  private scopesForKind(kind: Exclude<IntegrationKind, 'v1'>, value: unknown, fallback: string[]) {
    const channel = kind === 'mcp' ? 'mcp' : 'v2';
    const allowed = new Set(
      JOBS_CAPABILITIES
        .filter((capability) => !capability.legacy && capability.channels.includes(channel))
        .map((capability) => capability.scope),
    );
    return sanitizeJobsScopes(value, fallback).filter((scope) => allowed.has(scope));
  }

  private newKey(kind: IntegrationKind) {
    // O OAuth atual autentica a chave administrativa pn_v1_. A audiência MCP
    // continua separada no banco e nunca passa no guard REST; o prefixo é só
    // compatibilidade da etapa de autorização e pode mudar numa revisão futura.
    const prefix = kind === 'v2' ? 'pn_v2_' : 'pn_v1_';
    return `${prefix}${randomBytes(32).toString('hex')}`;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private publicClient(client: ExternalApiClient) {
    const { keyHash: _keyHash, ...safe } = client;
    return {
      ...safe,
      effectiveScopes: expandLegacyJobsScopes(client.scopes || []),
      usesLegacyScopes: (client.scopes || []).some((scope) =>
        JOBS_CAPABILITIES.some((capability) => capability.scope === scope && capability.legacy),
      ),
    };
  }
}
