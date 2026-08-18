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
import { ExternalApiRequest } from './entities/external-api-request.entity';

@Controller('admin/api-v1')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class ExternalApiAdminController {
  constructor(
    @InjectRepository(ExternalApiClient)
    private readonly clients: Repository<ExternalApiClient>,
    @InjectRepository(ExternalApiRequest)
    private readonly requests: Repository<ExternalApiRequest>,
  ) {}
  @Get('clients') list() {
    return this.clients.find({
      select: {
        id: true,
        name: true,
        sourceLabel: true,
        keyPrefix: true,
        scopes: true,
        active: true,
        createdById: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' },
    });
  }
  @Post('clients') async create(
    @Req() req: any,
    @Body() data: { name?: string; sourceLabel?: string },
  ) {
    const name = data.name?.trim().slice(0, 120);
    const sourceLabel = data.sourceLabel?.trim().slice(0, 160);
    if (!name || !sourceLabel)
      throw new BadRequestException(
        'Nome e identificação da origem são obrigatórios.',
      );
    const apiKey = this.newKey();
    const client = await this.clients.save(
      this.clients.create({
        name,
        sourceLabel,
        keyPrefix: apiKey.slice(0, 20),
        keyHash: this.hash(apiKey),
        scopes: ['jobs:read', 'jobs:write'],
        active: true,
        createdById: req.user.uid,
        lastUsedAt: null,
      }),
    );
    return {
      client: {
        id: client.id,
        name: client.name,
        sourceLabel: client.sourceLabel,
        keyPrefix: client.keyPrefix,
        active: client.active,
      },
      apiKey,
      warning: 'Copie agora. A chave completa não será exibida novamente.',
    };
  }
  @Put('clients/:id') async update(
    @Param('id') id: string,
    @Body() data: { active?: boolean; name?: string; sourceLabel?: string },
  ) {
    const client = await this.clients.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Chave não encontrada.');
    if (typeof data.active === 'boolean') client.active = data.active;
    if (data.name?.trim()) client.name = data.name.trim().slice(0, 120);
    if (data.sourceLabel?.trim())
      client.sourceLabel = data.sourceLabel.trim().slice(0, 160);
    return this.clients.save(client);
  }
  @Post('clients/:id/rotate') async rotate(@Param('id') id: string) {
    const client = await this.clients.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Chave não encontrada.');
    const apiKey = this.newKey();
    client.keyPrefix = apiKey.slice(0, 20);
    client.keyHash = this.hash(apiKey);
    client.active = true;
    await this.clients.save(client);
    return {
      apiKey,
      warning: 'A chave anterior foi revogada. Copie esta chave agora.',
    };
  }
  @Get('clients/:id/requests')
  async usage(
    @Param('id') id: string,
    @Query() query: { page?: string; pageSize?: string },
  ) {
    if (!(await this.clients.exists({ where: { id } })))
      throw new NotFoundException('Chave não encontrada.');
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number.parseInt(query.pageSize || '20', 10) || 20),
    );
    const [data, total] = await this.requests.findAndCount({
      where: { clientId: id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
  private newKey() {
    return `pn_v1_${randomBytes(32).toString('hex')}`;
  }
  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
