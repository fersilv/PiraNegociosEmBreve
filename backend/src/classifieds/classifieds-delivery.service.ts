import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { classifiedsCommerceFeatureFlags } from './classifieds-commerce-feature-flags';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

type QuoteItemInput = { listingId: string; quantity: number };

type DeliveryAggregate = {
  companyId: string;
  items: Array<{ listingId: string; quantity: number; title: string; weightGrams: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null; volumeCm3: number | null; disableLocalPartners: boolean }>;
  weightGrams: number | null;
  maxLengthCm: number | null;
  maxWidthCm: number | null;
  maxHeightCm: number | null;
  volumeCm3: number | null;
};

@Injectable()
export class ClassifiedsDeliveryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
  ) {}

  async companyPreferences(uid: string) {
    const companyId = await this.companyId(uid);
    return this.dataSource.query(
      `SELECT p.*,COALESCE(cp.enabled,false) AS "companyEnabled",COALESCE(cp."settlementMode",'INVOICE') AS "settlementMode"
       FROM delivery_partners p
       LEFT JOIN company_delivery_partner_preferences cp ON cp."partnerId"=p.id AND cp."companyId"=$1
       WHERE p.status <> 'SUSPENDED' ORDER BY p.priority,p.name`,
      [companyId],
    );
  }

  async saveCompanyPreference(uid: string, partnerId: string, raw: Record<string, unknown>) {
    const companyId = await this.companyId(uid);
    const partner = await this.partner(partnerId);
    const mode = String(raw.settlementMode || 'INVOICE').toUpperCase();
    if (!['PREPAID','INVOICE'].includes(mode)) throw new BadRequestException('Forma de liquidação inválida.');
    if (mode === 'PREPAID' && partner.supportsPrepaidBalance !== true) throw new BadRequestException('Este parceiro não aceita saldo pré-pago.');
    const rows = await this.dataSource.query(
      `INSERT INTO company_delivery_partner_preferences("companyId","partnerId",enabled,"settlementMode") VALUES ($1,$2,$3,$4) ON CONFLICT ("companyId","partnerId") DO UPDATE SET enabled=EXCLUDED.enabled,"settlementMode"=EXCLUDED."settlementMode","updatedAt"=now() RETURNING *`,
      [companyId, partnerId, raw.enabled !== false, mode],
    );
    return rows[0];
  }

  async quote(uid: string, raw: Record<string, unknown>) {
    this.assertFeature('localDeliveryPartners');
    const mode = String(raw.mode || 'DELIVERY').toUpperCase();
    if (!['DELIVERY','ROUND_TRIP'].includes(mode)) throw new BadRequestException('Modalidade de entrega inválida.');
    const items = this.cleanItems(raw.items);
    const aggregate = await this.aggregateItems(items);
    const destinationAddressId = String(raw.destinationAddressId || '').trim();
    if (!destinationAddressId) throw new BadRequestException('Selecione um endereço de entrega.');
    const destinationRows = await this.dataSource.query(`SELECT * FROM delivery_addresses WHERE id=$1 AND "userId"=$2 AND active=true LIMIT 1`, [destinationAddressId, uid]);
    const destination = destinationRows[0];
    if (!destination) throw new BadRequestException('Endereço de entrega não encontrado.');
    const originLocationId = String(raw.originLocationId || '').trim() || await this.resolveOrigin(aggregate);
    const originRows = await this.dataSource.query(`SELECT * FROM company_fulfillment_locations WHERE id=$1 AND "companyId"=$2 AND active=true AND "allowsDeliveryOrigin"=true LIMIT 1`, [originLocationId, aggregate.companyId]);
    const origin = originRows[0];
    if (!origin) throw new BadRequestException('Origem de entrega não configurada para esta empresa.');
    const distanceMeters = this.optionalNonNegativeInt(raw.distanceMeters);

    const settingsRows = await this.dataSource.query(`SELECT * FROM company_commerce_settings WHERE "companyId"=$1 LIMIT 1`, [aggregate.companyId]);
    if (settingsRows[0]?.platformPartnersEnabled !== true) throw new BadRequestException('A empresa ainda não habilitou parceiros de entrega da plataforma.');
    if (aggregate.items.some((item) => item.disableLocalPartners)) throw new BadRequestException('Um dos produtos não aceita entrega por parceiro local.');

    const partners = await this.dataSource.query(
      `SELECT p.*,cp."settlementMode"
       FROM delivery_partners p
       JOIN company_delivery_partner_preferences cp ON cp."partnerId"=p.id AND cp."companyId"=$1 AND cp.enabled=true
       WHERE p.status='ACTIVE' ORDER BY p.priority,p.name`,
      [aggregate.companyId],
    );
    const options: any[] = [];
    for (const partnerRow of partners) {
      const restriction = this.partnerRestriction(partnerRow, aggregate, destination);
      if (restriction) {
        options.push({ partnerId: partnerRow.id, partnerName: partnerRow.name, partnerType: partnerRow.type, eligible: false, reason: restriction });
        continue;
      }
      const tables = await this.dataSource.query(
        `SELECT * FROM delivery_partner_rate_tables WHERE "partnerId"=$1 AND active=true AND "startsAt"<=now() AND ("endsAt" IS NULL OR "endsAt">now()) ORDER BY version DESC LIMIT 1`,
        [partnerRow.id],
      );
      const table = tables[0];
      if (!table) {
        options.push({ partnerId: partnerRow.id, partnerName: partnerRow.name, partnerType: partnerRow.type, eligible: false, reason: 'Parceiro sem tabela de preço vigente.' });
        continue;
      }
      const cacheKey = this.quoteCacheKey({ aggregate, origin, destination, partnerId: partnerRow.id, tableVersion: table.version, mode, distanceMeters });
      const cachedRows = await this.dataSource.query(`SELECT * FROM delivery_quote_cache WHERE "cacheKey"=$1 AND "expiresAt">now() LIMIT 1`, [cacheKey]).catch(() => []);
      if (cachedRows[0]?.quoteSnapshot) {
        const snapshot = cachedRows[0].quoteSnapshot;
        const quote = await this.persistQuote(uid, aggregate.companyId, origin.id, destination.id, partnerRow.id, table.id, snapshot.rateRuleId || null, mode, snapshot.amountCents, snapshot.partnerPayableCents, snapshot.estimatedMinutes ?? null, snapshot.distanceMeters ?? distanceMeters, aggregate, origin, destination, snapshot);
        options.push({ ...snapshot, quoteId: quote.id, expiresAt: quote.expiresAt });
        continue;
      }
      const rules = await this.dataSource.query(`SELECT * FROM delivery_partner_rate_rules WHERE "rateTableId"=$1 ORDER BY priority,id`, [table.id]);
      const selected = rules.find((rule: any) => this.ruleMatches(rule, aggregate, destination, distanceMeters));
      if (!selected) {
        const needsDistance = rules.some((rule: any) => rule.minDistanceMeters != null || rule.maxDistanceMeters != null);
        options.push({ partnerId: partnerRow.id, partnerName: partnerRow.name, partnerType: partnerRow.type, eligible: false, reason: needsDistance && distanceMeters == null ? 'É necessário calcular a distância para este serviço.' : 'Nenhuma regra vigente atende este endereço ou volume.' });
        continue;
      }
      const amountCents = this.rulePrice(selected, aggregate, mode, distanceMeters);
      const snapshot = {
        partnerId: partnerRow.id,
        partnerName: partnerRow.name,
        partnerType: partnerRow.type,
        serviceType: 'LOCAL',
        eligible: true,
        amountCents,
        partnerPayableCents: amountCents,
        estimatedMinutes: selected.estimatedMinutes == null ? null : Number(selected.estimatedMinutes),
        distanceMeters,
        rateTableId: table.id,
        rateTableVersion: Number(table.version),
        rateRuleId: selected.id,
        mode,
      };
      await this.dataSource.query(
        `INSERT INTO delivery_quote_cache("cacheKey","rateTableId","quoteSnapshot","expiresAt") VALUES ($1,$2,$3::jsonb,now()+interval '10 minutes') ON CONFLICT ("cacheKey") DO UPDATE SET "rateTableId"=EXCLUDED."rateTableId","quoteSnapshot"=EXCLUDED."quoteSnapshot","expiresAt"=EXCLUDED."expiresAt"`,
        [cacheKey, table.id, JSON.stringify(snapshot)],
      );
      const quote = await this.persistQuote(uid, aggregate.companyId, origin.id, destination.id, partnerRow.id, table.id, selected.id, mode, amountCents, amountCents, snapshot.estimatedMinutes, distanceMeters, aggregate, origin, destination, snapshot);
      options.push({ ...snapshot, quoteId: quote.id, expiresAt: quote.expiresAt });
    }
    return { companyId: aggregate.companyId, origin: this.addressSnapshot(origin), destination: this.addressSnapshot(destination), aggregate, options };
  }

  async companyJobs(uid: string) {
    const companyId = await this.companyId(uid);
    return this.dataSource.query(
      `SELECT j.*,p.name AS "partnerName",p.type AS "partnerType",o."paymentStatus",o.status AS "orderStatus"
       FROM delivery_partner_jobs j JOIN delivery_partners p ON p.id=j."partnerId" JOIN classified_orders o ON o.id=j."orderId"
       WHERE j."companyId"=$1 ORDER BY j."createdAt" DESC LIMIT 500`,
      [companyId],
    );
  }

  async callPartner(uid: string, orderId: string) {
    this.assertFeature('localDeliveryPartners');
    const companyId = await this.companyId(uid);
    const rows = await this.dataSource.query(`SELECT * FROM classified_orders WHERE id=$1 AND "companyId"=$2 LIMIT 1`, [orderId, companyId]);
    const order = rows[0];
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    if (!order.deliveryQuoteSnapshot?.partnerId) throw new BadRequestException('Este pedido não possui entrega parceira selecionada.');
    if (!order.deliveryAddressSnapshot || !order.fulfillmentLocationSnapshot) throw new BadRequestException('Pedido sem snapshots de coleta e destino.');
    if (!['APPROVED'].includes(String(order.paymentStatus)) && Number(order.deliveryPartnerPayableCents || 0) <= 0) throw new BadRequestException('A entrega ainda não está pronta para despacho.');
    const partner = await this.partner(String(order.deliveryQuoteSnapshot.partnerId));
    const preferenceRows = await this.dataSource.query(`SELECT * FROM company_delivery_partner_preferences WHERE "companyId"=$1 AND "partnerId"=$2 AND enabled=true LIMIT 1`, [companyId, partner.id]);
    const settlementMode = order.paymentStatus === 'APPROVED' && Number(order.shippingCents || 0) > 0 ? 'ONLINE_PAYMENT' : String(preferenceRows[0]?.settlementMode || 'INVOICE');
    const created = await this.dataSource.query(
      `INSERT INTO delivery_partner_jobs("orderId","companyId","partnerId","quoteId",status,"pickupSnapshot","destinationSnapshot","amountCents","partnerPayableCents","settlementMode","dispatchChannel","createdByUserId") VALUES ($1,$2,$3,$4,'CREATED',$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11) ON CONFLICT ("orderId") WHERE status NOT IN ('CANCELED') DO NOTHING RETURNING *`,
      [order.id, companyId, partner.id, order.deliveryQuoteSnapshot?.id || null, JSON.stringify(order.fulfillmentLocationSnapshot), JSON.stringify(order.deliveryAddressSnapshot), Number(order.shippingCents || 0), Number(order.deliveryPartnerPayableCents || order.shippingCents || 0), settlementMode, partner.channelType, uid],
    );
    const job = created[0] || (await this.dataSource.query(`SELECT * FROM delivery_partner_jobs WHERE "orderId"=$1 AND status NOT IN ('CANCELED') ORDER BY "createdAt" DESC LIMIT 1`, [order.id]))[0];
    const message = this.dispatchMessage(job, order, partner);
    const called = await this.dataSource.query(
      `UPDATE delivery_partner_jobs SET status=CASE WHEN status='CREATED' THEN 'CALLED' ELSE status END,"calledAt"=COALESCE("calledAt",now()),"dispatchReference"=$2,"updatedAt"=now() WHERE id=$1 RETURNING *`,
      [job.id, partner.channelTarget || null],
    );
    await this.jobEvent(job.id, 'PARTNER_CALLED', job.status, called[0].status, uid, { channelType: partner.channelType, channelTarget: partner.channelTarget || null });
    return { job: called[0], partner: { id: partner.id, name: partner.name, type: partner.type, channelType: partner.channelType, channelTarget: partner.channelTarget || null }, dispatchMessage: message };
  }

  async transitionJob(uid: string, jobId: string, rawStatus: unknown, metadata: Record<string, unknown> = {}) {
    const companyId = await this.companyId(uid);
    const status = String(rawStatus || '').trim().toUpperCase();
    const allowed = ['ACCEPTED','PICKED_UP','IN_TRANSIT','DELIVERED','CANCELED','PROBLEM'];
    if (!allowed.includes(status)) throw new BadRequestException('Status de entrega inválido.');
    const rows = await this.dataSource.query(`SELECT * FROM delivery_partner_jobs WHERE id=$1 AND "companyId"=$2 LIMIT 1`, [jobId, companyId]);
    const job = rows[0];
    if (!job) throw new NotFoundException('Corrida não encontrada.');
    if (['DELIVERED','CANCELED'].includes(job.status)) throw new BadRequestException('Esta corrida já foi encerrada.');
    const updated = await this.dataSource.query(
      `UPDATE delivery_partner_jobs SET status=$2,"acceptedAt"=CASE WHEN $2='ACCEPTED' THEN COALESCE("acceptedAt",now()) ELSE "acceptedAt" END,"pickedUpAt"=CASE WHEN $2='PICKED_UP' THEN COALESCE("pickedUpAt",now()) ELSE "pickedUpAt" END,"deliveredAt"=CASE WHEN $2='DELIVERED' THEN COALESCE("deliveredAt",now()) ELSE "deliveredAt" END,"canceledAt"=CASE WHEN $2='CANCELED' THEN COALESCE("canceledAt",now()) ELSE "canceledAt" END,"problemAt"=CASE WHEN $2='PROBLEM' THEN COALESCE("problemAt",now()) ELSE "problemAt" END,"updatedAt"=now() WHERE id=$1 RETURNING *`,
      [jobId, status],
    );
    await this.jobEvent(jobId, 'STATUS_CHANGED', job.status, status, uid, metadata);
    if (status === 'DELIVERED') await this.settleDeliveredJob(updated[0]);
    return updated[0];
  }

  async wallet(uid: string) {
    const companyId = await this.companyId(uid);
    const wallet = await this.dataSource.query(`SELECT * FROM company_delivery_wallets WHERE "companyId"=$1 LIMIT 1`, [companyId]);
    const movements = await this.dataSource.query(`SELECT * FROM company_delivery_wallet_movements WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 200`, [companyId]);
    const invoices = await this.dataSource.query(`SELECT * FROM company_delivery_invoices WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 200`, [companyId]);
    return { wallet: wallet[0] || { companyId, balanceCents: 0 }, movements, invoices };
  }

  async adminPartners() {
    return this.dataSource.query(`SELECT * FROM delivery_partners ORDER BY status,priority,name`);
  }

  async adminSavePartner(uid: string, raw: Record<string, unknown>, id?: string) {
    const type = String(raw.type || 'MOTOBOY').toUpperCase();
    const status = String(raw.status || 'ACTIVE').toUpperCase();
    if (!['MOTOBOY','BIKE','TRANSPORTADORA','MELHOR_ENVIO'].includes(type)) throw new BadRequestException('Tipo de parceiro inválido.');
    if (!['ACTIVE','INACTIVE','SUSPENDED'].includes(status)) throw new BadRequestException('Status de parceiro inválido.');
    const channelType = String(raw.channelType || 'WHATSAPP_INDIVIDUAL').toUpperCase();
    if (!['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED','WHATSAPP_GROUP_MANUAL','INTEGRATION'].includes(channelType)) throw new BadRequestException('Canal operacional inválido.');
    const values = [
      String(raw.name || '').trim().slice(0,160), type, status, this.int(raw.priority,0,100000,100),
      JSON.stringify(Array.isArray(raw.cities) ? raw.cities.slice(0,200) : []), this.nullInt(raw.maxWeightGrams), this.nullNumber(raw.maxLengthCm), this.nullNumber(raw.maxWidthCm), this.nullNumber(raw.maxHeightCm), this.nullNumber(raw.maxVolumeCm3), raw.supportsRoundTrip === true, channelType, String(raw.channelTarget || '').trim().slice(0,255) || null, String(raw.pixKey || '').trim().slice(0,255) || null, this.int(raw.payoutDeadlineHours,1,720,24), raw.supportsPrepaidBalance === true, String(raw.contactName || '').trim().slice(0,160) || null, String(raw.contactPhone || '').trim().slice(0,40) || null, String(raw.notes || '').trim().slice(0,4000) || null,
    ];
    if (!values[0]) throw new BadRequestException('Informe o nome do parceiro.');
    const rows = id
      ? await this.dataSource.query(`UPDATE delivery_partners SET name=$2,type=$3,status=$4,priority=$5,cities=$6::jsonb,"maxWeightGrams"=$7,"maxLengthCm"=$8,"maxWidthCm"=$9,"maxHeightCm"=$10,"maxVolumeCm3"=$11,"supportsRoundTrip"=$12,"channelType"=$13,"channelTarget"=$14,"pixKey"=$15,"payoutDeadlineHours"=$16,"supportsPrepaidBalance"=$17,"contactName"=$18,"contactPhone"=$19,notes=$20,"updatedAt"=now() WHERE id=$1 RETURNING *`, [id, ...values])
      : await this.dataSource.query(`INSERT INTO delivery_partners(name,type,status,priority,cities,"maxWeightGrams","maxLengthCm","maxWidthCm","maxHeightCm","maxVolumeCm3","supportsRoundTrip","channelType","channelTarget","pixKey","payoutDeadlineHours","supportsPrepaidBalance","contactName","contactPhone",notes,"createdByUserId") VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`, [...values, uid]);
    if (!rows[0]) throw new NotFoundException('Parceiro não encontrado.');
    return rows[0];
  }

  async adminRateTables(partnerId: string) {
    await this.partner(partnerId);
    const tables = await this.dataSource.query(`SELECT * FROM delivery_partner_rate_tables WHERE "partnerId"=$1 ORDER BY version DESC`, [partnerId]);
    for (const table of tables) {
      table.rules = await this.dataSource.query(`SELECT * FROM delivery_partner_rate_rules WHERE "rateTableId"=$1 ORDER BY priority,id`, [table.id]);
    }
    return tables;
  }

  async adminCreateRateTable(uid: string, partnerId: string, raw: Record<string, unknown>) {
    await this.partner(partnerId);
    const latest = await this.dataSource.query(`SELECT COALESCE(max(version),0)::int AS version FROM delivery_partner_rate_tables WHERE "partnerId"=$1`, [partnerId]);
    const version = Number(latest[0]?.version || 0) + 1;
    const startsAt = this.date(raw.startsAt) || new Date().toISOString();
    const endsAt = this.date(raw.endsAt);
    const rows = await this.dataSource.query(`INSERT INTO delivery_partner_rate_tables("partnerId",version,name,"startsAt","endsAt",active,"createdByUserId") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [partnerId, version, String(raw.name || `Tabela v${version}`).trim().slice(0,160), startsAt, endsAt, raw.active !== false, uid]);
    return rows[0];
  }

  async adminCreateRateRule(rateTableId: string, raw: Record<string, unknown>) {
    const tables = await this.dataSource.query(`SELECT id FROM delivery_partner_rate_tables WHERE id=$1 LIMIT 1`, [rateTableId]);
    if (!tables[0]) throw new NotFoundException('Tabela de frete não encontrada.');
    const rows = await this.dataSource.query(
      `INSERT INTO delivery_partner_rate_rules("rateTableId",priority,city,state,neighborhood,"zipCodeStart","zipCodeEnd","minDistanceMeters","maxDistanceMeters","fixedPriceCents","minimumPriceCents","perKmCents","roundTripAdditionalCents","weightAdditionalPerKgCents","maxWeightGrams","maxLengthCm","maxWidthCm","maxHeightCm","maxVolumeCm3","estimatedMinutes") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [rateTableId, this.int(raw.priority,0,100000,100), this.text(raw.city,120), this.text(raw.state,2)?.toUpperCase() || null, this.text(raw.neighborhood,140), this.digits(raw.zipCodeStart), this.digits(raw.zipCodeEnd), this.nullNonNegativeInt(raw.minDistanceMeters), this.nullNonNegativeInt(raw.maxDistanceMeters), this.nullNonNegativeInt(raw.fixedPriceCents), this.int(raw.minimumPriceCents,0,100_000_000,0), this.int(raw.perKmCents,0,100_000_000,0), this.int(raw.roundTripAdditionalCents,0,100_000_000,0), this.int(raw.weightAdditionalPerKgCents,0,100_000_000,0), this.nullInt(raw.maxWeightGrams), this.nullNumber(raw.maxLengthCm), this.nullNumber(raw.maxWidthCm), this.nullNumber(raw.maxHeightCm), this.nullNumber(raw.maxVolumeCm3), this.nullNonNegativeInt(raw.estimatedMinutes)],
    );
    return rows[0];
  }

  async adminDashboard() {
    const [jobs, invoices, partnerBalances, payouts] = await Promise.all([
      this.dataSource.query(`SELECT j.*,p.name AS "partnerName",c.name AS "companyName" FROM delivery_partner_jobs j JOIN delivery_partners p ON p.id=j."partnerId" JOIN companies c ON c.id=j."companyId" ORDER BY j."createdAt" DESC LIMIT 300`),
      this.dataSource.query(`SELECT i.*,c.name AS "companyName" FROM company_delivery_invoices i JOIN companies c ON c.id=i."companyId" WHERE i.status IN ('OPEN','OVERDUE') ORDER BY i."dueAt" LIMIT 300`),
      this.dataSource.query(`SELECT p.id,p.name,COALESCE(sum(l."amountCents"),0)::bigint AS "balanceCents" FROM delivery_partners p LEFT JOIN delivery_partner_ledger_entries l ON l."partnerId"=p.id GROUP BY p.id ORDER BY p.name`),
      this.dataSource.query(`SELECT po.*,p.name AS "partnerName" FROM delivery_partner_payouts po JOIN delivery_partners p ON p.id=po."partnerId" ORDER BY po."createdAt" DESC LIMIT 300`),
    ]);
    return { jobs, invoices, partnerBalances, payouts };
  }

  async adminCreditWallet(uid: string, companyId: string, amountRaw: unknown, metadata: Record<string, unknown> = {}) {
    this.assertFeature('deliveryBalance');
    const amountCents = this.int(amountRaw,1,100_000_000,0);
    if (!amountCents) throw new BadRequestException('Valor de crédito inválido.');
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`INSERT INTO company_delivery_wallets("companyId","balanceCents") VALUES ($1,0) ON CONFLICT ("companyId") DO NOTHING`, [companyId]);
      const rows = await manager.query(`UPDATE company_delivery_wallets SET "balanceCents"="balanceCents"+$2,"updatedAt"=now() WHERE "companyId"=$1 RETURNING *`, [companyId, amountCents]);
      if (!rows[0]) throw new NotFoundException('Empresa não encontrada para saldo.');
      const ref = `ADMIN_TOPUP:${Date.now()}:${uid}`;
      await manager.query(`INSERT INTO company_delivery_wallet_movements("companyId",type,"amountCents","balanceAfterCents","referenceType","referenceId",metadata) VALUES ($1,'TOPUP',$2,$3,'ADMIN_CREDIT',$4,$5::jsonb)`, [companyId, amountCents, Number(rows[0].balanceCents), ref, JSON.stringify(metadata)]);
      return rows[0];
    });
  }

  async adminCreatePayout(uid: string, partnerId: string, amountRaw?: unknown) {
    const partner = await this.partner(partnerId);
    const balanceRows = await this.dataSource.query(`SELECT COALESCE(sum("amountCents"),0)::bigint AS balance FROM delivery_partner_ledger_entries WHERE "partnerId"=$1`, [partnerId]);
    const balance = Number(balanceRows[0]?.balance || 0);
    const amountCents = amountRaw == null ? balance : this.int(amountRaw,1,100_000_000,0);
    if (amountCents <= 0 || amountCents > balance) throw new BadRequestException('Valor de repasse inválido para o saldo do parceiro.');
    const rows = await this.dataSource.query(`INSERT INTO delivery_partner_payouts("partnerId",status,"amountCents","pixKeySnapshot","createdByUserId") VALUES ($1,'PENDING',$2,$3,$4) RETURNING *`, [partnerId, amountCents, partner.pixKey || null, uid]);
    return rows[0];
  }

  async adminMarkPayoutPaid(uid: string, payoutId: string, providerTransferId?: unknown) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM delivery_partner_payouts WHERE id=$1 FOR UPDATE`, [payoutId]);
      const payout = rows[0];
      if (!payout) throw new NotFoundException('Repasse não encontrado.');
      if (payout.status === 'PAID') return payout;
      if (['CANCELED','FAILED'].includes(payout.status)) throw new BadRequestException('Este repasse não pode ser marcado como pago.');
      const updated = await manager.query(`UPDATE delivery_partner_payouts SET status='PAID',"providerTransferId"=$2,"paidAt"=now(),"updatedAt"=now() WHERE id=$1 RETURNING *`, [payoutId, String(providerTransferId || '').trim().slice(0,180) || null]);
      await manager.query(`INSERT INTO delivery_partner_ledger_entries("partnerId",type,"amountCents","referenceType","referenceId",description,metadata) VALUES ($1,'PAYOUT',$2,'PAYOUT',$3,'Liquidação de parceiro',$4::jsonb) ON CONFLICT (type,"referenceType","referenceId") DO NOTHING`, [payout.partnerId, -Number(payout.amountCents), payout.id, JSON.stringify({ actorUserId: uid, providerTransferId: updated[0].providerTransferId })]);
      return updated[0];
    });
  }

  private async settleDeliveredJob(job: any) {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`INSERT INTO delivery_partner_ledger_entries("partnerId","companyId","jobId",type,"amountCents","referenceType","referenceId",description) VALUES ($1,$2,$3,'PAYABLE',$4,'DELIVERY_JOB',$3,'Entrega concluída') ON CONFLICT (type,"referenceType","referenceId") DO NOTHING`, [job.partnerId, job.companyId, job.id, Number(job.partnerPayableCents)]);
      if (job.settlementMode === 'ONLINE_PAYMENT') return;
      if (job.settlementMode === 'PREPAID') {
        await manager.query(`INSERT INTO company_delivery_wallets("companyId","balanceCents") VALUES ($1,0) ON CONFLICT ("companyId") DO NOTHING`, [job.companyId]);
        const wallets = await manager.query(`SELECT * FROM company_delivery_wallets WHERE "companyId"=$1 FOR UPDATE`, [job.companyId]);
        const balance = Number(wallets[0]?.balanceCents || 0);
        if (balance >= Number(job.partnerPayableCents)) {
          const next = balance - Number(job.partnerPayableCents);
          await manager.query(`UPDATE company_delivery_wallets SET "balanceCents"=$2,"updatedAt"=now() WHERE "companyId"=$1`, [job.companyId, next]);
          await manager.query(`INSERT INTO company_delivery_wallet_movements("companyId",type,"amountCents","balanceAfterCents","referenceType","referenceId") VALUES ($1,'DELIVERY_DEBIT',$2,$3,'DELIVERY_JOB',$4) ON CONFLICT (type,"referenceType","referenceId") DO NOTHING`, [job.companyId, -Number(job.partnerPayableCents), next, job.id]);
          return;
        }
      }
      await manager.query(`INSERT INTO company_delivery_invoices("companyId","jobId",status,"amountCents","dueAt",metadata) VALUES ($1,$2,'OPEN',$3,now()+interval '24 hours',$4::jsonb) ON CONFLICT DO NOTHING`, [job.companyId, job.id, Number(job.partnerPayableCents), JSON.stringify({ reason: job.settlementMode === 'PREPAID' ? 'INSUFFICIENT_PREPAID_BALANCE' : 'DELIVERY_INVOICE' })]);
    });
  }

  private async persistQuote(uid: string, companyId: string, originLocationId: string, destinationAddressId: string, partnerId: string, rateTableId: string, rateRuleId: string | null, mode: string, amountCents: number, partnerPayableCents: number, estimatedMinutes: number | null, distanceMeters: number | null, aggregate: DeliveryAggregate, origin: any, destination: any, snapshot: Record<string, unknown>) {
    const rows = await this.dataSource.query(`INSERT INTO delivery_quotes("companyId","buyerUserId","originLocationId","destinationAddressId","partnerId","rateTableId","rateRuleId",mode,"amountCents","partnerPayableCents","estimatedMinutes","distanceMeters","eligible","inputSnapshot","quoteSnapshot","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13::jsonb,$14::jsonb,now()+interval '10 minutes') RETURNING *`, [companyId, uid, originLocationId, destinationAddressId, partnerId, rateTableId, rateRuleId, mode, amountCents, partnerPayableCents, estimatedMinutes, distanceMeters, JSON.stringify({ aggregate, origin: this.addressSnapshot(origin), destination: this.addressSnapshot(destination) }), JSON.stringify(snapshot)]);
    return rows[0];
  }

  private partnerRestriction(partner: any, aggregate: DeliveryAggregate, destination: any) {
    const cities = Array.isArray(partner.cities) ? partner.cities : [];
    if (cities.length) {
      const supported = cities.some((entry: any) => String(entry?.city || entry || '').toLowerCase() === String(destination.city || '').toLowerCase() && (!entry?.state || String(entry.state).toUpperCase() === String(destination.state).toUpperCase()));
      if (!supported) return 'Parceiro não atende esta cidade.';
    }
    if (partner.maxWeightGrams != null) {
      if (aggregate.weightGrams == null) return 'Informe o peso dos produtos para usar este parceiro.';
      if (aggregate.weightGrams > Number(partner.maxWeightGrams)) return 'Peso excede o limite do parceiro.';
    }
    const dimensions: Array<[number | null, unknown, string]> = [[aggregate.maxLengthCm, partner.maxLengthCm, 'comprimento'], [aggregate.maxWidthCm, partner.maxWidthCm, 'largura'], [aggregate.maxHeightCm, partner.maxHeightCm, 'altura'], [aggregate.volumeCm3, partner.maxVolumeCm3, 'volume']];
    for (const [value, limit, label] of dimensions) {
      if (limit != null && value == null) return `Informe ${label} dos produtos para usar este parceiro.`;
      if (limit != null && value != null && value > Number(limit)) return `${label[0].toUpperCase()}${label.slice(1)} excede o limite do parceiro.`;
    }
    return null;
  }

  private ruleMatches(rule: any, aggregate: DeliveryAggregate, destination: any, distanceMeters: number | null) {
    if (rule.city && String(rule.city).toLowerCase() !== String(destination.city).toLowerCase()) return false;
    if (rule.state && String(rule.state).toUpperCase() !== String(destination.state).toUpperCase()) return false;
    if (rule.neighborhood && String(rule.neighborhood).toLowerCase() !== String(destination.neighborhood).toLowerCase()) return false;
    const zip = String(destination.zipCode || '').replace(/\D/g, '');
    if (rule.zipCodeStart && zip < String(rule.zipCodeStart).replace(/\D/g, '')) return false;
    if (rule.zipCodeEnd && zip > String(rule.zipCodeEnd).replace(/\D/g, '')) return false;
    if ((rule.minDistanceMeters != null || rule.maxDistanceMeters != null) && distanceMeters == null) return false;
    if (rule.minDistanceMeters != null && Number(distanceMeters) < Number(rule.minDistanceMeters)) return false;
    if (rule.maxDistanceMeters != null && Number(distanceMeters) > Number(rule.maxDistanceMeters)) return false;
    if (rule.maxWeightGrams != null && (aggregate.weightGrams == null || aggregate.weightGrams > Number(rule.maxWeightGrams))) return false;
    if (rule.maxLengthCm != null && (aggregate.maxLengthCm == null || aggregate.maxLengthCm > Number(rule.maxLengthCm))) return false;
    if (rule.maxWidthCm != null && (aggregate.maxWidthCm == null || aggregate.maxWidthCm > Number(rule.maxWidthCm))) return false;
    if (rule.maxHeightCm != null && (aggregate.maxHeightCm == null || aggregate.maxHeightCm > Number(rule.maxHeightCm))) return false;
    if (rule.maxVolumeCm3 != null && (aggregate.volumeCm3 == null || aggregate.volumeCm3 > Number(rule.maxVolumeCm3))) return false;
    return true;
  }

  private rulePrice(rule: any, aggregate: DeliveryAggregate, mode: string, distanceMeters: number | null) {
    let cents = rule.fixedPriceCents == null ? 0 : Number(rule.fixedPriceCents);
    if (rule.fixedPriceCents == null && Number(rule.perKmCents || 0) > 0 && distanceMeters != null) cents += Math.ceil(distanceMeters / 1000) * Number(rule.perKmCents || 0);
    if (aggregate.weightGrams != null && Number(rule.weightAdditionalPerKgCents || 0) > 0) cents += Math.ceil(aggregate.weightGrams / 1000) * Number(rule.weightAdditionalPerKgCents || 0);
    if (mode === 'ROUND_TRIP') cents += Number(rule.roundTripAdditionalCents || 0);
    return Math.max(Number(rule.minimumPriceCents || 0), Math.round(cents));
  }

  private async aggregateItems(items: QuoteItemInput[]): Promise<DeliveryAggregate> {
    const ids = items.map((item) => item.listingId);
    const rows = await this.dataSource.query(
      `SELECT l.id,l.title,l.status,l."listingType",l."companyId",s."weightGrams",s."lengthCm",s."widthCm",s."heightCm",s."volumeCm3",COALESCE(s."disableLocalPartners",false) AS "disableLocalPartners" FROM classified_listings l LEFT JOIN classified_listing_shipping s ON s."listingId"=l.id WHERE l.id=ANY($1::uuid[])`,
      [ids],
    );
    if (rows.length !== ids.length) throw new BadRequestException('Um produto do carrinho não foi encontrado.');
    const companyIds = [...new Set(rows.map((row: any) => row.companyId).filter(Boolean))];
    if (companyIds.length !== 1 || rows.some((row: any) => row.status !== 'PUBLISHED' || row.listingType !== 'PRODUCT')) throw new BadRequestException('A cotação aceita somente produtos publicados da mesma empresa.');
    const normalized = items.map((item) => {
      const row = rows.find((candidate: any) => candidate.id === item.listingId);
      return { listingId: row.id, quantity: item.quantity, title: row.title, weightGrams: row.weightGrams == null ? null : Number(row.weightGrams), lengthCm: row.lengthCm == null ? null : Number(row.lengthCm), widthCm: row.widthCm == null ? null : Number(row.widthCm), heightCm: row.heightCm == null ? null : Number(row.heightCm), volumeCm3: row.volumeCm3 == null ? null : Number(row.volumeCm3), disableLocalPartners: row.disableLocalPartners === true };
    });
    const weightsKnown = normalized.every((item) => item.weightGrams != null);
    const volumesKnown = normalized.every((item) => item.volumeCm3 != null);
    return {
      companyId: companyIds[0] as string,
      items: normalized,
      weightGrams: weightsKnown ? normalized.reduce((sum, item) => sum + Number(item.weightGrams) * item.quantity, 0) : null,
      maxLengthCm: this.maxKnown(normalized.map((item) => item.lengthCm)),
      maxWidthCm: this.maxKnown(normalized.map((item) => item.widthCm)),
      maxHeightCm: this.maxKnown(normalized.map((item) => item.heightCm)),
      volumeCm3: volumesKnown ? normalized.reduce((sum, item) => sum + Number(item.volumeCm3) * item.quantity, 0) : null,
    };
  }

  private async resolveOrigin(aggregate: DeliveryAggregate) {
    const listingOrigins = await this.dataSource.query(`SELECT DISTINCT "originLocationId" FROM classified_listing_shipping WHERE "listingId"=ANY($1::uuid[]) AND "originLocationId" IS NOT NULL`, [aggregate.items.map((item) => item.listingId)]);
    if (listingOrigins.length > 1) throw new BadRequestException('Os produtos usam origens diferentes e não podem ser combinados nesta entrega.');
    if (listingOrigins[0]?.originLocationId) return String(listingOrigins[0].originLocationId);
    const rows = await this.dataSource.query(`SELECT id FROM company_fulfillment_locations WHERE "companyId"=$1 AND active=true AND "allowsDeliveryOrigin"=true ORDER BY "isDefaultDeliveryOrigin" DESC,"createdAt" ASC LIMIT 1`, [aggregate.companyId]);
    if (!rows[0]) throw new BadRequestException('A empresa ainda não cadastrou uma origem de entrega.');
    return String(rows[0].id);
  }

  private cleanItems(raw: unknown): QuoteItemInput[] {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100) throw new BadRequestException('Informe os produtos para cotação.');
    return raw.map((entry: any) => {
      const listingId = String(entry?.listingId || '').trim();
      const quantity = this.int(entry?.quantity, 1, 999, 1);
      if (!/^[0-9a-f-]{36}$/i.test(listingId)) throw new BadRequestException('Produto inválido na cotação.');
      return { listingId, quantity };
    });
  }

  private addressSnapshot(row: any) {
    return { id: row.id || null, label: row.label || row.name || null, zipCode: row.zipCode || null, street: row.street || null, number: row.number || null, complement: row.complement || null, neighborhood: row.neighborhood || null, city: row.city || null, state: row.state || null, placeId: row.placeId || null, latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude) };
  }

  private quoteCacheKey(input: Record<string, unknown>) {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }

  private dispatchMessage(job: any, order: any, partner: any) {
    const pickup = job.pickupSnapshot || {};
    const destination = job.destinationSnapshot || {};
    return [`PiraNegócios · corrida ${job.id}`, `Pedido: ${order.id}`, `Parceiro: ${partner.name}`, `Coleta: ${pickup.street || ''}, ${pickup.number || ''} · ${pickup.neighborhood || ''} · ${pickup.city || ''}/${pickup.state || ''}`, `Destino: ${destination.street || ''}, ${destination.number || ''} · ${destination.neighborhood || ''} · ${destination.city || ''}/${destination.state || ''}`, `Valor parceiro: R$ ${(Number(job.partnerPayableCents || 0) / 100).toFixed(2).replace('.', ',')}`].join('\n');
  }

  private async jobEvent(jobId: string, action: string, fromStatus: string | null, toStatus: string | null, actorUserId: string, metadata: Record<string, unknown>) {
    await this.dataSource.query(`INSERT INTO delivery_partner_job_events("jobId",action,"fromStatus","toStatus","actorUserId",metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [jobId, action, fromStatus, toStatus, actorUserId, JSON.stringify(metadata)]);
  }

  private async partner(id: string) {
    const rows = await this.dataSource.query(`SELECT * FROM delivery_partners WHERE id=$1 LIMIT 1`, [id]);
    if (!rows[0]) throw new NotFoundException('Parceiro de entrega não encontrado.');
    return rows[0];
  }

  private async companyId(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY' || !identity.company?.id) throw new ForbiddenException('Esta operação exige o workspace Business.');
    return identity.company.id;
  }

  private assertFeature(name: 'localDeliveryPartners' | 'deliveryBalance') {
    const flags = classifiedsCommerceFeatureFlags();
    if (!flags[name]) throw new BadRequestException(`Recurso ${name} ainda não está habilitado neste ambiente.`);
  }

  private maxKnown(values: Array<number | null>) {
    return values.every((value) => value != null) ? Math.max(...values.map((value) => Number(value))) : null;
  }

  private int(value: unknown, min: number, max: number, fallback: number) { const n = Math.round(Number(value)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
  private nullInt(value: unknown) { if (value === null || value === undefined || value === '') return null; const n = Math.round(Number(value)); return Number.isFinite(n) && n > 0 ? n : null; }
  private nullNumber(value: unknown) { if (value === null || value === undefined || value === '') return null; const n = Number(String(value).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; }
  private nullNonNegativeInt(value: unknown) { if (value === null || value === undefined || value === '') return null; const n = Math.round(Number(value)); return Number.isFinite(n) && n >= 0 ? n : null; }
  private optionalNonNegativeInt(value: unknown) { return this.nullNonNegativeInt(value); }
  private text(value: unknown, max: number) { return String(value || '').trim().slice(0, max) || null; }
  private digits(value: unknown) { return String(value || '').replace(/\D/g, '').slice(0, 8) || null; }
  private date(value: unknown) { const text = String(value || '').trim(); if (!text) return null; const date = new Date(text); if (!Number.isFinite(date.getTime())) throw new BadRequestException('Data inválida.'); return date.toISOString(); }
}
