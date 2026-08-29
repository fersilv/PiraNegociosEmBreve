import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Put, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

const TARGET_TYPES = [
  'WHATSAPP_INDIVIDUAL',
  'WHATSAPP_GROUP_INTEGRATED',
  'WHATSAPP_GROUP_MANUAL',
  'INTEGRATION',
] as const;

@Controller('admin/classifieds-delivery/partners')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class ClassifiedsDeliveryChannelAdminController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Get(':partnerId/channel-binding')
  async getBinding(@Param('partnerId') partnerId: string) {
    await this.assertPartner(partnerId);
    const rows = await this.dataSource.query(
      `SELECT b.*,w.name AS "instanceName",w.status AS "instanceStatus",w.active AS "instanceActive"
       FROM delivery_partner_channel_bindings b
       LEFT JOIN whatsapp_instances w ON w.id=b."instanceId"
       WHERE b."partnerId"=$1::uuid
       LIMIT 1`,
      [partnerId],
    );
    return rows[0] || null;
  }

  @Put(':partnerId/channel-binding')
  async saveBinding(
    @Req() req: any,
    @Param('partnerId') partnerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.assertPartner(partnerId);
    const targetType = String(body.targetType || '').trim().toUpperCase();
    if (!TARGET_TYPES.includes(targetType as (typeof TARGET_TYPES)[number])) {
      throw new BadRequestException('Tipo de canal operacional inválido.');
    }

    let instanceId = String(body.instanceId || '').trim() || null;
    let targetId = String(body.targetId || '').trim().slice(0, 255) || null;
    const targetLabel = String(body.targetLabel || '').trim().slice(0, 180) || null;

    if (targetType === 'WHATSAPP_GROUP_INTEGRATED') {
      if (!instanceId || !targetId) throw new BadRequestException('Selecione a instância e o grupo do WhatsApp.');
      await this.assertConnectedInstance(instanceId);
      const groups = await this.whatsapp.listGroups(instanceId);
      const exists = groups.some((group: any) => this.serializeWid(group?.id) === targetId);
      if (!exists) throw new BadRequestException('O grupo selecionado não pertence à instância de WhatsApp informada.');
    } else if (targetType === 'WHATSAPP_INDIVIDUAL') {
      if (!instanceId) throw new BadRequestException('Selecione a instância de WhatsApp que fará o disparo.');
      await this.assertConnectedInstance(instanceId);
      const digits = String(targetId || '').replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) throw new BadRequestException('Informe um WhatsApp individual válido com DDD.');
      targetId = digits;
    } else {
      instanceId = null;
      if (!targetId && targetType !== 'INTEGRATION') throw new BadRequestException('Informe o destino operacional do parceiro.');
    }

    const rows = await this.dataSource.query(
      `INSERT INTO delivery_partner_channel_bindings(
         "partnerId","instanceId","targetType","targetId","targetLabel",metadata,"updatedByUserId"
       ) VALUES ($1::uuid,$2::uuid,$3::varchar,$4::varchar,$5::varchar,$6::jsonb,$7::varchar)
       ON CONFLICT ("partnerId") DO UPDATE SET
         "instanceId"=EXCLUDED."instanceId",
         "targetType"=EXCLUDED."targetType",
         "targetId"=EXCLUDED."targetId",
         "targetLabel"=EXCLUDED."targetLabel",
         metadata=EXCLUDED.metadata,
         "updatedByUserId"=EXCLUDED."updatedByUserId",
         "updatedAt"=now()
       RETURNING *`,
      [
        partnerId,
        instanceId,
        targetType,
        targetId,
        targetLabel,
        JSON.stringify(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        String(req.user.uid),
      ],
    );

    // Mantém os campos legados sincronizados enquanto os consumidores antigos ainda existem.
    await this.dataSource.query(
      `UPDATE delivery_partners
       SET "channelType"=$2::varchar,"channelTarget"=$3::varchar,"updatedAt"=now()
       WHERE id=$1::uuid`,
      [partnerId, targetType, targetId],
    );

    return rows[0];
  }

  private async assertPartner(partnerId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(partnerId)) throw new BadRequestException('Parceiro inválido.');
    const rows = await this.dataSource.query(`SELECT id FROM delivery_partners WHERE id=$1::uuid LIMIT 1`, [partnerId]);
    if (!rows[0]) throw new NotFoundException('Parceiro de entrega não encontrado.');
  }

  private async assertConnectedInstance(instanceId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(instanceId)) throw new BadRequestException('Instância de WhatsApp inválida.');
    const rows = await this.dataSource.query(
      `SELECT id,status,active FROM whatsapp_instances WHERE id=$1::uuid LIMIT 1`,
      [instanceId],
    );
    if (!rows[0]) throw new NotFoundException('Instância de WhatsApp não encontrada.');
    if (rows[0].active !== true || rows[0].status !== 'CONNECTED') {
      throw new BadRequestException('A instância de WhatsApp precisa estar ativa e conectada.');
    }
  }

  private serializeWid(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value._serialized === 'string') return value._serialized;
    if (typeof value.user === 'string' && typeof value.server === 'string') return `${value.user}@${value.server}`;
    if (typeof value.id === 'string') return value.id;
    return String(value || '');
  }
}
