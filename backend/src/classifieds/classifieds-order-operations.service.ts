import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsOrdersGateway } from './classifieds-orders.gateway';

const OPERATIONAL_STATUSES = ['CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','COMPLETED','CANCELED'] as const;
type OperationalStatus = typeof OPERATIONAL_STATUSES[number];

@Injectable()
export class ClassifiedsOrderOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: ClassifiedsOrdersGateway,
  ) {}

  async summary(uid: string) {
    const companyId = await this.companyId(uid);
    const rows = await this.dataSource.query(
      `SELECT
         EXISTS(SELECT 1 FROM classified_listings l WHERE l."companyId"=$1 LIMIT 1) AS "hasListings",
         EXISTS(SELECT 1 FROM classified_orders o WHERE o."companyId"=$1 LIMIT 1) AS "hasSales",
         (SELECT count(*)::int FROM classified_orders o WHERE o."companyId"=$1 AND o.status NOT IN ('COMPLETED','CANCELED')) AS "openOrders"`,
      [companyId],
    );
    const row = rows[0] || {};
    return {
      hasListings: row.hasListings === true,
      hasSales: row.hasSales === true,
      openOrders: Math.max(0, Number(row.openOrders || 0)),
      visible: row.hasListings === true || row.hasSales === true,
    };
  }

  async list(uid: string) {
    const companyId = await this.companyId(uid);
    const rows = await this.dataSource.query(
      `SELECT o.*, l.title,l.slug,i.url AS image,
              COALESCE(u."socialName",u."displayName",u."fullName",'Cliente') AS "buyerName",
              u.email AS "buyerEmail",u."whatsappPhoneE164" AS "buyerWhatsapp",
              COALESCE((SELECT count(*)::int FROM classified_order_items oi WHERE oi."orderId"=o.id),1) AS "itemKinds",
              COALESCE((SELECT sum(oi.quantity)::int FROM classified_order_items oi WHERE oi."orderId"=o.id),o.quantity) AS "itemUnits"
       FROM classified_orders o
       JOIN classified_listings l ON l.id=o."listingId"
       LEFT JOIN users u ON u.id=o."buyerUserId"
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1
       ) i ON true
       WHERE o."companyId"=$1
       ORDER BY
         CASE upper(COALESCE(o.metadata->>'operationalPriority','')) WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
         CASE o.status WHEN 'CREATED' THEN 0 WHEN 'PAID' THEN 1 WHEN 'CONFIRMED' THEN 2 WHEN 'PREPARING' THEN 3 WHEN 'READY' THEN 4 WHEN 'OUT_FOR_DELIVERY' THEN 5 WHEN 'COMPLETED' THEN 6 ELSE 7 END,
         o."createdAt" ASC
       LIMIT 1000`,
      [companyId],
    );
    return rows.map((row: any) => this.present(row));
  }

  async detail(uid: string, orderId: string) {
    const companyId = await this.companyId(uid);
    const rows = await this.dataSource.query(
      `SELECT o.*,l.title,l.slug,i.url AS image,
              COALESCE(u."socialName",u."displayName",u."fullName",'Cliente') AS "buyerName",
              u.email AS "buyerEmail",u.phone AS "buyerPhone",u."whatsappPhoneE164" AS "buyerWhatsapp",
              u.address AS "buyerProfileAddress",u.city AS "buyerProfileCity",u.state AS "buyerProfileState"
       FROM classified_orders o
       JOIN classified_listings l ON l.id=o."listingId"
       LEFT JOIN users u ON u.id=o."buyerUserId"
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1
       ) i ON true
       WHERE o.id=$1 AND o."companyId"=$2 LIMIT 1`,
      [orderId, companyId],
    );
    const order = rows[0];
    if (!order) throw new NotFoundException('Pedido não encontrado.');

    const [items, events] = await Promise.all([
      this.dataSource.query(
        `SELECT oi.*,l.slug,i.url AS image
         FROM classified_order_items oi
         LEFT JOIN classified_listings l ON l.id=oi."listingId"
         LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=oi."listingId" ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1) i ON true
         WHERE oi."orderId"=$1 ORDER BY oi."createdAt" ASC`,
        [orderId],
      ).catch(() => []),
      this.dataSource.query(
        `SELECT id,type,"fromStatus","toStatus","actorUserId",metadata,"createdAt"
         FROM classified_order_events WHERE "orderId"=$1 ORDER BY "createdAt" ASC`,
        [orderId],
      ).catch(() => []),
    ]);

    return {
      ...this.present(order),
      buyerPhone: order.buyerPhone || null,
      buyerProfileAddress: order.buyerProfileAddress || null,
      buyerProfileCity: order.buyerProfileCity || null,
      buyerProfileState: order.buyerProfileState || null,
      fulfillmentData: order.fulfillmentData || {},
      deliveryQuoteSnapshot: order.deliveryQuoteSnapshot || null,
      paymentFinancialSnapshot: order.paymentFinancialSnapshot || null,
      metadata: order.metadata || {},
      items: items.length ? items : [{
        id: `legacy:${order.id}`,
        listingId: order.listingId,
        titleSnapshot: order.title,
        quantity: order.quantity,
        unitPriceCents: order.unitPriceCents,
        discountCents: order.discountCents,
        totalCents: Number(order.unitPriceCents || 0) * Number(order.quantity || 1),
        image: order.image || null,
      }],
      events,
    };
  }

  async updateStatus(uid: string, orderId: string, rawStatus: unknown) {
    const companyId = await this.companyId(uid);
    const status = String(rawStatus || '').trim().toUpperCase() as OperationalStatus;
    if (!OPERATIONAL_STATUSES.includes(status)) throw new BadRequestException('Status operacional inválido.');

    const updated = await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT * FROM classified_orders WHERE id=$1 AND "companyId"=$2 LIMIT 1 FOR UPDATE`,
        [orderId, companyId],
      );
      const order = rows[0];
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (['COMPLETED','CANCELED'].includes(String(order.status)) && order.status !== status) {
        throw new BadRequestException('Este pedido já foi encerrado.');
      }
      if (order.status === status) return order;
      const changed = await manager.query(
        `UPDATE classified_orders SET status=$2,
           "readyAt"=CASE WHEN $2='READY' THEN COALESCE("readyAt",now()) ELSE "readyAt" END,
           "completedAt"=CASE WHEN $2='COMPLETED' THEN COALESCE("completedAt",now()) ELSE "completedAt" END,
           "canceledAt"=CASE WHEN $2='CANCELED' THEN COALESCE("canceledAt",now()) ELSE "canceledAt" END,
           "updatedAt"=now()
         WHERE id=$1 RETURNING *`,
        [orderId, status],
      );
      await manager.query(
        `INSERT INTO classified_order_events("orderId",type,"fromStatus","toStatus","actorUserId",metadata)
         VALUES ($1,'STATUS_CHANGED',$2,$3,$4,$5::jsonb)`,
        [orderId, order.status, status, uid, JSON.stringify({ surface: 'MINHAS_VENDAS' })],
      );
      return changed[0];
    });

    await this.notifications.notifyUser(updated.buyerUserId, {
      title: 'Pedido atualizado',
      message: `Seu pedido agora está: ${this.statusLabel(status)}.`,
      type: 'classified_order_status',
      link: '/classificados/compras',
    }).catch(() => undefined);
    this.realtime.publishCompanyOrderChanged(companyId, orderId, 'STATUS', { status });
    return this.present(updated);
  }

  async setPriority(uid: string, orderId: string, rawPriority: unknown) {
    const companyId = await this.companyId(uid);
    const priority = String(rawPriority || 'NORMAL').trim().toUpperCase();
    if (!['NORMAL','HIGH','URGENT'].includes(priority)) throw new BadRequestException('Prioridade inválida.');
    const rows = await this.dataSource.query(
      `UPDATE classified_orders
       SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{operationalPriority}',to_jsonb($3::text),true),"updatedAt"=now()
       WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      [orderId, companyId, priority],
    );
    if (!rows[0]) throw new NotFoundException('Pedido não encontrado.');
    await this.dataSource.query(
      `INSERT INTO classified_order_events("orderId",type,"actorUserId",metadata)
       VALUES ($1,'PRIORITY_CHANGED',$2,$3::jsonb)`,
      [orderId, uid, JSON.stringify({ priority, surface: 'MINHAS_VENDAS' })],
    ).catch(() => undefined);
    this.realtime.publishCompanyOrderChanged(companyId, orderId, 'PRIORITY', { operationalPriority: priority });
    return this.present(rows[0]);
  }

  private async companyId(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY' || !identity.company?.id) {
      throw new ForbiddenException('A central de vendas é exclusiva do workspace Business.');
    }
    return identity.company.id;
  }

  private present(row: any) {
    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const ageMinutes = Number.isFinite(createdAt.getTime()) ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60_000)) : 0;
    const manual = String(row.metadata?.operationalPriority || 'NORMAL').toUpperCase();
    const autoUrgent = !['COMPLETED','CANCELED'].includes(String(row.status)) && (
      (String(row.status) === 'CREATED' && ageMinutes >= 10)
      || (String(row.status) === 'CONFIRMED' && ageMinutes >= 20)
      || (String(row.status) === 'PREPARING' && ageMinutes >= 35)
      || (String(row.status) === 'READY' && ageMinutes >= 25)
    );
    return {
      ...row,
      operationalPriority: ['URGENT','HIGH'].includes(manual) ? manual : autoUrgent ? 'HIGH' : 'NORMAL',
      manualPriority: manual,
      autoUrgent,
      ageMinutes,
    };
  }

  private statusLabel(status: string) {
    return ({
      CONFIRMED: 'confirmado',
      PREPARING: 'em preparação',
      READY: 'pronto',
      OUT_FOR_DELIVERY: 'saiu para entrega',
      COMPLETED: 'concluído',
      CANCELED: 'cancelado',
    } as Record<string, string>)[status] || status.toLowerCase();
  }
}
