import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { classifiedsCommerceFeatureFlags } from './classifieds-commerce-feature-flags';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

@Injectable()
export class ClassifiedsServiceQuotesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  async request(uid: string, listingId: string, raw: Record<string, unknown>) {
    this.assertEnabled();
    const rows = await this.dataSource.query(`SELECT * FROM classified_listings WHERE id=$1 AND status='PUBLISHED' LIMIT 1`, [listingId]);
    const listing = rows[0];
    if (!listing || listing.listingType !== 'SERVICE' || !listing.companyId) throw new NotFoundException('Serviço Business não encontrado.');
    if (listing.sellerUserId === uid) throw new BadRequestException('Você não pode solicitar orçamento do próprio serviço.');
    const scope = String(raw.scope || '').trim().slice(0, 6000);
    if (scope.length < 10) throw new BadRequestException('Descreva com um pouco mais de detalhe o que você precisa.');
    const attachments = Array.isArray(raw.attachments) ? raw.attachments.slice(0, 12).map((item) => this.safeAttachment(item)) : [];
    const conversationId = String(raw.conversationId || '').trim() || null;
    const created = await this.dataSource.query(
      `INSERT INTO classified_service_quote_requests("listingId","companyId","customerUserId","conversationId",status,scope,attachments) VALUES ($1,$2,$3,$4,'REQUESTED',$5,$6::jsonb) RETURNING *`,
      [listing.id, listing.companyId, uid, conversationId, scope, JSON.stringify(attachments)],
    );
    await this.event(created[0].id, 'REQUESTED', null, 'REQUESTED', uid, { listingId });
    await this.notifications.notifyCompany(listing.companyId, {
      title: 'Nova solicitação de orçamento',
      message: `Um cliente pediu orçamento para ${listing.title}.`,
      type: 'classified_service_quote_requested',
      link: '/classificados/orcamentos',
    }).catch(() => undefined);
    return this.detailForUser(uid, created[0].id);
  }

  async myRequests(uid: string) {
    this.assertEnabled();
    return this.dataSource.query(
      `SELECT r.*,l.title,l.slug,c.name AS "companyName",v."amountCents",v.version AS "latestVersion",v."validUntil"
       FROM classified_service_quote_requests r
       JOIN classified_listings l ON l.id=r."listingId" JOIN companies c ON c.id=r."companyId"
       LEFT JOIN LATERAL (SELECT * FROM classified_service_quote_versions WHERE "requestId"=r.id ORDER BY version DESC LIMIT 1) v ON true
       WHERE r."customerUserId"=$1 ORDER BY r."updatedAt" DESC LIMIT 500`,
      [uid],
    );
  }

  async companyRequests(uid: string) {
    this.assertEnabled();
    const companyId = await this.companyId(uid);
    return this.dataSource.query(
      `SELECT r.*,l.title,l.slug,u."displayName" AS "customerName",u.email AS "customerEmail",v."amountCents",v.version AS "latestVersion",v."validUntil"
       FROM classified_service_quote_requests r
       JOIN classified_listings l ON l.id=r."listingId" LEFT JOIN users u ON u.id=r."customerUserId"
       LEFT JOIN LATERAL (SELECT * FROM classified_service_quote_versions WHERE "requestId"=r.id ORDER BY version DESC LIMIT 1) v ON true
       WHERE r."companyId"=$1 ORDER BY r."updatedAt" DESC LIMIT 500`,
      [companyId],
    );
  }

  async detailForUser(uid: string, requestId: string) {
    this.assertEnabled();
    const rows = await this.dataSource.query(`SELECT r.*,l.title,l.slug,c.name AS "companyName" FROM classified_service_quote_requests r JOIN classified_listings l ON l.id=r."listingId" JOIN companies c ON c.id=r."companyId" WHERE r.id=$1 AND r."customerUserId"=$2 LIMIT 1`, [requestId, uid]);
    if (!rows[0]) throw new NotFoundException('Solicitação de orçamento não encontrada.');
    return this.withVersions(rows[0]);
  }

  async detailForCompany(uid: string, requestId: string) {
    this.assertEnabled();
    const companyId = await this.companyId(uid);
    const rows = await this.dataSource.query(`SELECT r.*,l.title,l.slug,u."displayName" AS "customerName",u.email AS "customerEmail" FROM classified_service_quote_requests r JOIN classified_listings l ON l.id=r."listingId" LEFT JOIN users u ON u.id=r."customerUserId" WHERE r.id=$1 AND r."companyId"=$2 LIMIT 1`, [requestId, companyId]);
    if (!rows[0]) throw new NotFoundException('Solicitação de orçamento não encontrada.');
    return this.withVersions(rows[0]);
  }

  async createVersion(uid: string, requestId: string, raw: Record<string, unknown>) {
    this.assertEnabled();
    const companyId = await this.companyId(uid);
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM classified_service_quote_requests WHERE id=$1 AND "companyId"=$2 FOR UPDATE`, [requestId, companyId]);
      const request = rows[0];
      if (!request) throw new NotFoundException('Solicitação de orçamento não encontrada.');
      if (['ACCEPTED','DECLINED','EXPIRED','CANCELED'].includes(request.status)) throw new BadRequestException('Esta solicitação já foi encerrada.');
      const amountCents = this.moneyCents(raw.amountCents);
      const description = String(raw.description || '').trim().slice(0, 8000);
      if (!description) throw new BadRequestException('Descreva a proposta.');
      const validUntil = this.futureDate(raw.validUntil);
      const version = Number(request.currentVersionNumber || 0) + 1;
      const items = Array.isArray(raw.items) ? raw.items.slice(0, 100).map((item) => this.safeItem(item)) : [];
      const conditions = String(raw.conditions || '').trim().slice(0, 8000) || null;
      const deliveryDays = raw.deliveryDays === null || raw.deliveryDays === undefined || raw.deliveryDays === '' ? null : this.int(raw.deliveryDays, 0, 3650, 0);
      const versions = await manager.query(`INSERT INTO classified_service_quote_versions("requestId",version,"amountCents",items,description,conditions,"deliveryDays","validUntil","createdByUserId") VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9) RETURNING *`, [requestId, version, amountCents, JSON.stringify(items), description, conditions, deliveryDays, validUntil, uid]);
      const nextStatus = request.status === 'REQUESTED' ? 'DRAFT' : 'NEGOTIATING';
      await manager.query(`UPDATE classified_service_quote_requests SET "currentVersionNumber"=$2,status=$3,"updatedAt"=now() WHERE id=$1`, [requestId, version, nextStatus]);
      await manager.query(`INSERT INTO classified_service_quote_events("requestId",action,"fromStatus","toStatus","actorUserId",metadata) VALUES ($1,'VERSION_CREATED',$2,$3,$4,$5::jsonb)`, [requestId, request.status, nextStatus, uid, JSON.stringify({ versionId: versions[0].id, version })]);
      return versions[0];
    });
  }

  async send(uid: string, requestId: string) {
    const companyId = await this.companyId(uid);
    const detail = await this.detailForCompany(uid, requestId);
    if (!detail.versions?.[0]) throw new BadRequestException('Crie uma versão da proposta antes de enviar.');
    if (['ACCEPTED','DECLINED','EXPIRED','CANCELED'].includes(detail.status)) throw new BadRequestException('Esta solicitação já foi encerrada.');
    const rows = await this.dataSource.query(`UPDATE classified_service_quote_requests SET status='SENT',"updatedAt"=now() WHERE id=$1 AND "companyId"=$2 RETURNING *`, [requestId, companyId]);
    await this.event(requestId, 'SENT', detail.status, 'SENT', uid, { version: detail.versions[0].version });
    await this.notifications.notifyUser(detail.customerUserId, { title: 'Seu orçamento chegou', message: `${detail.title}: nova proposta disponível para análise.`, type: 'classified_service_quote_sent', link: `/classificados/orcamentos/${requestId}` }).catch(() => undefined);
    return rows[0];
  }

  async requestAdjustment(uid: string, requestId: string, noteRaw: unknown) {
    const detail = await this.detailForUser(uid, requestId);
    if (!['SENT','NEGOTIATING'].includes(detail.status)) throw new BadRequestException('Esta proposta não está aberta para ajuste.');
    const note = String(noteRaw || '').trim().slice(0, 4000);
    if (!note) throw new BadRequestException('Explique o ajuste desejado.');
    const rows = await this.dataSource.query(`UPDATE classified_service_quote_requests SET status='NEGOTIATING',"updatedAt"=now() WHERE id=$1 RETURNING *`, [requestId]);
    await this.event(requestId, 'ADJUSTMENT_REQUESTED', detail.status, 'NEGOTIATING', uid, { note });
    await this.notifications.notifyCompany(detail.companyId, { title: 'Cliente pediu ajuste no orçamento', message: `${detail.title}: há uma nova solicitação de ajuste.`, type: 'classified_service_quote_adjustment', link: `/classificados/orcamentos/${requestId}` }).catch(() => undefined);
    return rows[0];
  }

  async accept(uid: string, requestId: string, versionIdRaw?: unknown) {
    this.assertEnabled();
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM classified_service_quote_requests WHERE id=$1 AND "customerUserId"=$2 FOR UPDATE`, [requestId, uid]);
      const request = rows[0];
      if (!request) throw new NotFoundException('Solicitação de orçamento não encontrada.');
      if (!['SENT','NEGOTIATING'].includes(request.status)) throw new BadRequestException('Esta proposta não pode ser aprovada agora.');
      const requestedVersionId = String(versionIdRaw || '').trim();
      const versions = requestedVersionId
        ? await manager.query(`SELECT * FROM classified_service_quote_versions WHERE id=$1 AND "requestId"=$2 LIMIT 1`, [requestedVersionId, requestId])
        : await manager.query(`SELECT * FROM classified_service_quote_versions WHERE "requestId"=$1 ORDER BY version DESC LIMIT 1`, [requestId]);
      const version = versions[0];
      if (!version) throw new BadRequestException('Versão da proposta não encontrada.');
      if (new Date(version.validUntil).getTime() <= Date.now()) {
        await manager.query(`UPDATE classified_service_quote_requests SET status='EXPIRED',"updatedAt"=now() WHERE id=$1`, [requestId]);
        await manager.query(`INSERT INTO classified_service_quote_events("requestId",action,"fromStatus","toStatus","actorUserId",metadata) VALUES ($1,'EXPIRED',$2,'EXPIRED',$3,$4::jsonb)`, [requestId, request.status, uid, JSON.stringify({ versionId: version.id })]);
        throw new BadRequestException('Esta proposta expirou. Solicite uma nova versão.');
      }
      const snapshot = { request: { id: request.id, listingId: request.listingId, companyId: request.companyId, customerUserId: request.customerUserId, scope: request.scope }, version };
      const contracts = await manager.query(`INSERT INTO classified_service_contracts("requestId","quoteVersionId","companyId","customerUserId",status,snapshot) VALUES ($1,$2,$3,$4,'ACCEPTED',$5::jsonb) ON CONFLICT ("requestId") DO NOTHING RETURNING *`, [requestId, version.id, request.companyId, uid, JSON.stringify(snapshot)]);
      const contract = contracts[0] || (await manager.query(`SELECT * FROM classified_service_contracts WHERE "requestId"=$1 LIMIT 1`, [requestId]))[0];
      await manager.query(`UPDATE classified_service_quote_requests SET status='ACCEPTED',"acceptedVersionId"=$2,"acceptedAt"=now(),"updatedAt"=now() WHERE id=$1`, [requestId, version.id]);
      await manager.query(`INSERT INTO classified_service_quote_events("requestId",action,"fromStatus","toStatus","actorUserId",metadata) VALUES ($1,'ACCEPTED',$2,'ACCEPTED',$3,$4::jsonb)`, [requestId, request.status, uid, JSON.stringify({ versionId: version.id, contractId: contract.id })]);
      return { accepted: true, version, contract };
    });
  }

  async decline(uid: string, requestId: string, reasonRaw?: unknown) {
    const detail = await this.detailForUser(uid, requestId);
    if (['ACCEPTED','DECLINED','EXPIRED','CANCELED'].includes(detail.status)) throw new BadRequestException('Esta solicitação já foi encerrada.');
    const rows = await this.dataSource.query(`UPDATE classified_service_quote_requests SET status='DECLINED',"declinedAt"=now(),"updatedAt"=now() WHERE id=$1 RETURNING *`, [requestId]);
    await this.event(requestId, 'DECLINED', detail.status, 'DECLINED', uid, { reason: String(reasonRaw || '').trim().slice(0,2000) || null });
    return rows[0];
  }

  async cancelByCompany(uid: string, requestId: string, reasonRaw?: unknown) {
    const detail = await this.detailForCompany(uid, requestId);
    if (['ACCEPTED','DECLINED','EXPIRED','CANCELED'].includes(detail.status)) throw new BadRequestException('Esta solicitação já foi encerrada.');
    const rows = await this.dataSource.query(`UPDATE classified_service_quote_requests SET status='CANCELED',"canceledAt"=now(),"updatedAt"=now() WHERE id=$1 RETURNING *`, [requestId]);
    await this.event(requestId, 'CANCELED', detail.status, 'CANCELED', uid, { reason: String(reasonRaw || '').trim().slice(0,2000) || null });
    return rows[0];
  }

  async expire() {
    if (!classifiedsCommerceFeatureFlags().consultativeQuotes) return { expired: 0 };
    const rows = await this.dataSource.query(
      `UPDATE classified_service_quote_requests r SET status='EXPIRED',"updatedAt"=now()
       WHERE r.status IN ('SENT','NEGOTIATING') AND EXISTS (
         SELECT 1 FROM classified_service_quote_versions v WHERE v."requestId"=r.id AND v.version=r."currentVersionNumber" AND v."validUntil"<=now()
       ) RETURNING id`,
    ).catch(() => []);
    for (const row of rows) await this.event(row.id, 'EXPIRED', null, 'EXPIRED', 'SYSTEM', {}).catch(() => undefined);
    return { expired: rows.length };
  }

  private async withVersions(row: any) {
    const versions = await this.dataSource.query(`SELECT * FROM classified_service_quote_versions WHERE "requestId"=$1 ORDER BY version DESC`, [row.id]);
    const events = await this.dataSource.query(`SELECT * FROM classified_service_quote_events WHERE "requestId"=$1 ORDER BY "createdAt" ASC`, [row.id]);
    const contracts = await this.dataSource.query(`SELECT * FROM classified_service_contracts WHERE "requestId"=$1 LIMIT 1`, [row.id]);
    return { ...row, versions, events, contract: contracts[0] || null };
  }

  private async event(requestId: string, action: string, fromStatus: string | null, toStatus: string | null, actorUserId: string, metadata: Record<string, unknown>) {
    await this.dataSource.query(`INSERT INTO classified_service_quote_events("requestId",action,"fromStatus","toStatus","actorUserId",metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [requestId, action, fromStatus, toStatus, actorUserId, JSON.stringify(metadata)]);
  }

  private async companyId(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY' || !identity.company?.id) throw new ForbiddenException('Orçamentos da empresa exigem o workspace Business.');
    return identity.company.id;
  }

  private assertEnabled() {
    if (!classifiedsCommerceFeatureFlags().consultativeQuotes) throw new BadRequestException('Orçamentos consultivos ainda não estão habilitados neste ambiente.');
  }

  private moneyCents(value: unknown) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000_000) throw new BadRequestException('Valor da proposta inválido.');
    return n;
  }

  private futureDate(value: unknown) {
    const date = new Date(String(value || ''));
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new BadRequestException('A validade da proposta precisa estar no futuro.');
    return date.toISOString();
  }

  private int(value: unknown, min: number, max: number, fallback: number) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  private safeAttachment(value: unknown) {
    const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return { url: String(item.url || '').trim().slice(0,1000), name: String(item.name || '').trim().slice(0,180) || null, type: String(item.type || '').trim().slice(0,80) || null };
  }

  private safeItem(value: unknown) {
    const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const quantity = this.int(item.quantity, 1, 100000, 1);
    const unitPriceCents = this.moneyCents(item.unitPriceCents || 0);
    return { description: String(item.description || '').trim().slice(0,500), quantity, unitPriceCents, totalCents: quantity * unitPriceCents };
  }
}
