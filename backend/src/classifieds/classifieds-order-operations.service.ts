import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
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
    private readonly marketplacePayments: ClassifiedsMarketplacePaymentsService,
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
      events: this.presentTimeline(events, order),
    };
  }

  async updateStatus(uid: string, orderId: string, rawStatus: unknown) {
    const companyId = await this.companyId(uid);
    const status = String(rawStatus || '').trim().toUpperCase() as OperationalStatus;
    if (!OPERATIONAL_STATUSES.includes(status)) throw new BadRequestException('Status operacional inválido.');

    if (status === 'CANCELED') {
      return this.cancelOrder(uid, companyId, orderId);
    }

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

      const payOnReceipt = String(order.orderMode || '') === 'PAY_ON_RECEIPT';
      const nextPaymentStatus = payOnReceipt && status === 'COMPLETED' ? 'APPROVED' : String(order.paymentStatus || 'PENDING');
      const nextStockReserved = payOnReceipt && status === 'COMPLETED' ? false : Boolean(order.stockReserved);

      const changed = await manager.query(
        `UPDATE classified_orders SET status=$2,
           "paymentStatus"=$3,
           "stockReserved"=$4,
           "paidAt"=CASE WHEN $5::boolean AND $2='COMPLETED' THEN COALESCE("paidAt",now()) ELSE "paidAt" END,
           "readyAt"=CASE WHEN $2='READY' THEN COALESCE("readyAt",now()) ELSE "readyAt" END,
           "completedAt"=CASE WHEN $2='COMPLETED' THEN COALESCE("completedAt",now()) ELSE "completedAt" END,
           "updatedAt"=now()
         WHERE id=$1 RETURNING *`,
        [orderId, status, nextPaymentStatus, nextStockReserved, payOnReceipt],
      );
      const next = changed[0];

      if (payOnReceipt && status === 'COMPLETED') {
        await manager.query(`UPDATE classified_order_items SET "stockReserved"=false WHERE "orderId"=$1`, [order.id]).catch(() => undefined);
        if (order.offerId) {
          await manager.query(
            `UPDATE classified_offers SET status='CONSUMED',"consumedAt"=COALESCE("consumedAt",now()),"orderId"=$2,"updatedAt"=now()
             WHERE id=$1 AND status IN ('ACCEPTED','CONSUMED')`,
            [order.offerId, order.id],
          ).catch(() => undefined);
        }
        await this.settleDeliveryQuote(manager, order, 'CONSUMED');
      }

      await manager.query(
        `INSERT INTO classified_order_events("orderId",type,"fromStatus","toStatus","actorUserId",metadata)
         VALUES ($1,'STATUS_CHANGED',$2,$3,$4,$5::jsonb)`,
        [orderId, order.status, status, uid, JSON.stringify({ surface: 'MINHAS_VENDAS', paymentOnReceipt: payOnReceipt })],
      );
      if (payOnReceipt && status === 'COMPLETED') {
        await manager.query(
          `INSERT INTO classified_order_events("orderId",type,"fromStatus","toStatus","actorUserId",metadata)
           VALUES ($1,'PAYMENT_CONFIRMED_ON_RECEIPT','PENDING','APPROVED',$2,$3::jsonb)`,
          [orderId, uid, JSON.stringify({ method: order.paymentMethod, source: 'SELLER_CONFIRMATION' })],
        ).catch(() => undefined);
      }
      return next;
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

  private async cancelOrder(uid: string, companyId: string, orderId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM classified_orders WHERE id=$1 AND "companyId"=$2 LIMIT 1`,
      [orderId, companyId],
    );
    const current = rows[0];
    if (!current) throw new NotFoundException('Pedido não encontrado.');
    if (current.status === 'CANCELED') return this.present(current);
    if (current.status === 'COMPLETED') throw new BadRequestException('Este pedido já foi concluído e não pode ser cancelado por esta tela.');

    const payOnReceipt = String(current.orderMode || '') === 'PAY_ON_RECEIPT';
    const approvedOnline = !payOnReceipt && String(current.paymentStatus) === 'APPROVED';
    let refund: { id?: string | null; status?: string | null; alreadyRefunded?: boolean } | null = null;

    if (approvedOnline) {
      if (String(current.paymentProvider || '') !== 'MERCADO_PAGO' || !current.providerPaymentId) {
        throw new BadRequestException('Este pagamento já foi aprovado, mas não há uma transação Mercado Pago válida para estorno automático. O pedido não foi cancelado.');
      }
      refund = await this.refundMercadoPago(current);
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const lockedRows = await manager.query(
        `SELECT * FROM classified_orders WHERE id=$1 AND "companyId"=$2 LIMIT 1 FOR UPDATE`,
        [orderId, companyId],
      );
      const order = lockedRows[0];
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (order.status === 'CANCELED') return order;
      if (order.status === 'COMPLETED') throw new BadRequestException('Este pedido já foi concluído e não pode ser cancelado por esta tela.');

      const localPayOnReceipt = String(order.orderMode || '') === 'PAY_ON_RECEIPT';
      const localApprovedOnline = !localPayOnReceipt && String(order.paymentStatus) === 'APPROVED';

      if (localApprovedOnline) {
        if (!refund) throw new BadRequestException('O estorno não foi confirmado. O pedido continua ativo.');
        await this.restorePaidStock(manager, order);
      } else if (order.stockReserved) {
        await this.releaseReceiptReservation(manager, order);
      }

      const paymentStatus = localApprovedOnline ? 'REFUNDED' : localPayOnReceipt || ['PENDING','IN_PROCESS'].includes(String(order.paymentStatus)) ? 'CANCELED' : String(order.paymentStatus || 'CANCELED');
      const refundMetadata = refund ? {
        provider: 'MERCADO_PAGO',
        paymentId: String(order.providerPaymentId || ''),
        refundId: refund.id || null,
        status: refund.status || 'approved',
        idempotencyKey: this.refundIdempotencyKey(order.id),
        alreadyRefunded: refund.alreadyRefunded === true,
        requestedAt: new Date().toISOString(),
      } : null;

      const changed = await manager.query(
        `UPDATE classified_orders SET
           status='CANCELED',
           "paymentStatus"=$2,
           "stockReserved"=false,
           "canceledAt"=COALESCE("canceledAt",now()),
           metadata=CASE WHEN $3::jsonb IS NULL THEN metadata ELSE COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('refund',$3::jsonb) END,
           "updatedAt"=now()
         WHERE id=$1 RETURNING *`,
        [order.id, paymentStatus, refundMetadata ? JSON.stringify(refundMetadata) : null],
      );
      const next = changed[0];

      if (localApprovedOnline) {
        await manager.query(
          `INSERT INTO classified_order_events("orderId",type,"fromStatus","toStatus","actorUserId",metadata)
           VALUES ($1,'PAYMENT_REFUNDED','APPROVED','REFUNDED',$2,$3::jsonb)`,
          [order.id, uid, JSON.stringify({ provider: 'MERCADO_PAGO', refundId: refund?.id || null })],
        ).catch(() => undefined);
      }
      await manager.query(
        `INSERT INTO classified_order_events("orderId",type,"fromStatus","toStatus","actorUserId",metadata)
         VALUES ($1,'STATUS_CHANGED',$2,'CANCELED',$3,$4::jsonb)`,
        [order.id, order.status, uid, JSON.stringify({ surface: 'MINHAS_VENDAS', refunded: localApprovedOnline })],
      );
      return next;
    });

    await this.notifications.notifyUser(updated.buyerUserId, {
      title: approvedOnline ? 'Pedido cancelado e pagamento estornado' : 'Pedido cancelado',
      message: approvedOnline
        ? 'A empresa cancelou o pedido e o estorno total foi solicitado e confirmado no Mercado Pago.'
        : 'A empresa cancelou seu pedido.',
      type: 'classified_order_status',
      link: '/classificados/compras',
    }).catch(() => undefined);
    this.realtime.publishCompanyOrderChanged(companyId, orderId, approvedOnline ? 'PAYMENT' : 'STATUS', { status: 'CANCELED', paymentStatus: updated.paymentStatus });
    return this.present(updated);
  }

  private async refundMercadoPago(order: any) {
    const credentials = await this.marketplacePayments.sellerMercadoPagoCredentials(order.companyId);
    const paymentId = String(order.providerPaymentId || '').trim();
    const idempotencyKey = this.refundIdempotencyKey(order.id);
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: '{}',
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);

    if (response?.ok) {
      const data = await response.json().catch(() => ({}));
      return { id: data?.id == null ? null : String(data.id), status: String(data?.status || 'approved'), alreadyRefunded: false };
    }

    // Se uma tentativa anterior conseguiu estornar mas a resposta se perdeu, reconciliamos
    // pela lista de reembolsos antes de permitir que o pedido seja marcado como cancelado.
    const reconciled = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
      headers: { authorization: `Bearer ${credentials.accessToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (reconciled?.ok) {
      const refunds = await reconciled.json().catch(() => []);
      const approved = Array.isArray(refunds) ? refunds.find((item: any) => ['approved','refunded','processed'].includes(String(item?.status || '').toLowerCase())) : null;
      if (approved) return { id: approved.id == null ? null : String(approved.id), status: String(approved.status || 'approved'), alreadyRefunded: true };
    }

    let providerMessage = '';
    if (response) {
      const data = await response.json().catch(() => ({}));
      providerMessage = String(data?.message || data?.error || data?.cause?.[0]?.description || '').trim();
    }
    throw new BadRequestException(providerMessage ? `O Mercado Pago não confirmou o estorno: ${providerMessage}. O pedido continua ativo.` : 'O Mercado Pago não confirmou o estorno. O pedido continua ativo e pode ser cancelado novamente após a reconciliação.');
  }

  private refundIdempotencyKey(orderId: string) {
    return `pn-refund-${String(orderId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48)}`;
  }

  private async restorePaidStock(manager: any, order: any) {
    const listingRows = await manager.query(`SELECT "commerceConfig" FROM classified_listings WHERE id=$1 LIMIT 1 FOR UPDATE`, [order.listingId]);
    const config = listingRows[0]?.commerceConfig || {};
    const raw = config?.onlineCheckout?.stockQuantity;
    if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
      const restored = Math.max(0, Math.floor(Number(raw))) + Math.max(1, Number(order.quantity || 1));
      const next = { ...config, onlineCheckout: { ...(config.onlineCheckout || {}), stockQuantity: restored } };
      await manager.query(`UPDATE classified_listings SET "commerceConfig"=$2::jsonb,"updatedAt"=now() WHERE id=$1`, [order.listingId, JSON.stringify(next)]);
    }
    await manager.query(`UPDATE classified_order_items SET "stockReserved"=false WHERE "orderId"=$1`, [order.id]).catch(() => undefined);
    await this.settleDeliveryQuote(manager, order, 'RELEASE');
  }

  private async releaseReceiptReservation(manager: any, order: any) {
    if (order.stockReserved) {
      const listingRows = await manager.query(`SELECT "commerceConfig" FROM classified_listings WHERE id=$1 LIMIT 1 FOR UPDATE`, [order.listingId]);
      const config = listingRows[0]?.commerceConfig || {};
      const raw = config?.onlineCheckout?.stockQuantity;
      if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
        const restored = Math.max(0, Math.floor(Number(raw))) + Math.max(1, Number(order.quantity || 1));
        const next = { ...config, onlineCheckout: { ...(config.onlineCheckout || {}), stockQuantity: restored } };
        await manager.query(`UPDATE classified_listings SET "commerceConfig"=$2::jsonb,"updatedAt"=now() WHERE id=$1`, [order.listingId, JSON.stringify(next)]);
      }
      await manager.query(`UPDATE classified_order_items SET "stockReserved"=false WHERE "orderId"=$1`, [order.id]).catch(() => undefined);
    }
    if (order.offerId) {
      await manager.query(
        `UPDATE classified_offers SET status=CASE WHEN "expiresAt"<=now() THEN 'EXPIRED' ELSE 'ACCEPTED' END,"orderId"=NULL,"updatedAt"=now()
         WHERE id=$1 AND "orderId"=$2 AND status='ACCEPTED'`,
        [order.offerId, order.id],
      ).catch(() => undefined);
    }
    await this.settleDeliveryQuote(manager, order, 'RELEASE');
  }

  private async settleDeliveryQuote(manager: any, order: any, action: 'CONSUMED' | 'RELEASE') {
    const quoteId = String(order.deliveryQuoteSnapshot?.id || order.fulfillmentData?.deliveryQuoteId || '').trim();
    if (!quoteId) return;
    if (action === 'CONSUMED') {
      await manager.query(`UPDATE delivery_quotes SET status='CONSUMED',"updatedAt"=now() WHERE id=$1 AND status IN ('QUOTED','SELECTED','CONSUMED')`, [quoteId]).catch(() => undefined);
      return;
    }
    await manager.query(
      `UPDATE delivery_quotes SET status=CASE WHEN "expiresAt"<=now() THEN 'EXPIRED' ELSE 'QUOTED' END,"updatedAt"=now()
       WHERE id=$1 AND status='SELECTED'`,
      [quoteId],
    ).catch(() => undefined);
  }

  private presentTimeline(events: any[], order: any) {
    const internal = new Set(['PAYMENT_RESPONSE','PAYMENT_WEBHOOK','STOCK_RELEASED']);
    const visible = (Array.isArray(events) ? events : []).filter((event) => !internal.has(String(event?.type || '').toUpperCase()));
    const rawPaymentEvents = (Array.isArray(events) ? events : []).filter((event) => ['PAYMENT_RESPONSE','PAYMENT_WEBHOOK'].includes(String(event?.type || '').toUpperCase()));
    const hasApproved = visible.some((event) => ['PAYMENT_APPROVED','PAYMENT_CONFIRMED_ON_RECEIPT'].includes(String(event?.type || '').toUpperCase()));
    const approvedRaw = rawPaymentEvents.find((event) => String(event?.toStatus || '').toUpperCase() === 'APPROVED');
    if (!hasApproved && (approvedRaw || order.paidAt)) {
      visible.push({
        id: `payment-approved:${order.id}`,
        type: 'PAYMENT_APPROVED',
        fromStatus: approvedRaw?.fromStatus || 'PENDING',
        toStatus: 'APPROVED',
        actorUserId: null,
        metadata: {},
        createdAt: approvedRaw?.createdAt || order.paidAt,
      });
    }
    visible.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    return visible;
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
      CONFIRMED: 'confirmado', PREPARING: 'em preparação', READY: 'pronto', OUT_FOR_DELIVERY: 'saiu para entrega', COMPLETED: 'concluído', CANCELED: 'cancelado',
    } as Record<string, string>)[status] || status.toLowerCase();
  }
}
