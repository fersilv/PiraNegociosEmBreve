"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifiedsSalesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const notifications_service_1 = require("../notifications/notifications.service");
const classifieds_entitlements_service_1 = require("./classifieds-entitlements.service");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
let ClassifiedsSalesService = class ClassifiedsSalesService {
    dataSource;
    identities;
    entitlements;
    notifications;
    timer = null;
    constructor(dataSource, identities, entitlements, notifications) {
        this.dataSource = dataSource;
        this.identities = identities;
        this.entitlements = entitlements;
        this.notifications = notifications;
    }
    onModuleInit() {
        this.timer = setInterval(() => void this.expirePromotions().catch(() => undefined), 60_000);
        this.timer.unref?.();
        void this.expirePromotions().catch(() => undefined);
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async status(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY') {
            return {
                business: false,
                onlineSalesAvailable: false,
                plan: 'FREE',
                feeRule: null,
                paymentConnections: [],
            };
        }
        const company = identity.company;
        const verified = Boolean(company.isVerified || company.verificationStatus === 'VERIFIED');
        const plan = await this.entitlements.companyPlan(company.id);
        const [connections, feeRule] = await Promise.all([
            this.dataSource.query(`SELECT provider,status,"externalUserId","externalUserName","externalUserEmail","tokenExpiresAt","connectedAt","updatedAt"
         FROM company_classified_payment_connections
         WHERE "companyId" = $1 ORDER BY provider`, [company.id]).catch(() => []),
            this.resolveFeeRule(company.id, plan),
        ]);
        return {
            business: true,
            companyId: company.id,
            companyVerified: verified,
            onlineSalesAvailable: verified && connections.some((row) => row.status === 'CONNECTED'),
            plan,
            feeRule,
            paymentConnections: connections,
        };
    }
    async getListingCommerce(uid, listingId) {
        const listing = await this.assertOwner(uid, listingId);
        return {
            listingId: listing.id,
            listingType: listing.listingType,
            basePrice: listing.price,
            commerceConfig: listing.commerceConfig || null,
            pricing: this.effectivePricing(listing.price, listing.commerceConfig),
        };
    }
    async configureListing(uid, listingId, raw) {
        const identity = await this.identities.active(uid);
        const listing = await this.assertOwner(uid, listingId);
        const config = this.cleanCommerceConfig(raw, listing.price, listing.listingType);
        if (config.onlineCheckout?.enabled) {
            if (!listing.companyId || identity.type !== 'COMPANY' || identity.company.id !== listing.companyId) {
                throw new common_1.ForbiddenException('Recebimento online é exclusivo para anúncios Business.');
            }
            const company = identity.company;
            if (!(company.isVerified || company.verificationStatus === 'VERIFIED')) {
                throw new common_1.ForbiddenException('Somente empresas verificadas podem habilitar recebimento online.');
            }
            const connected = await this.dataSource.query(`SELECT provider FROM company_classified_payment_connections
         WHERE "companyId" = $1 AND status = 'CONNECTED' LIMIT 1`, [company.id]).catch(() => []);
            if (!connected[0]) {
                throw new common_1.BadRequestException('Conecte um provedor de pagamento antes de habilitar compra online.');
            }
            const plan = await this.entitlements.companyPlan(company.id);
            const fee = await this.resolveFeeRule(company.id, plan);
            if (!fee) {
                throw new common_1.BadRequestException('A taxa de vendas online ainda não foi configurada para esta empresa/plano.');
            }
        }
        await this.dataSource.query(`UPDATE classified_listings SET "commerceConfig" = $2::jsonb, "updatedAt" = now() WHERE id = $1`, [listingId, JSON.stringify(config)]);
        return this.getListingCommerce(uid, listingId);
    }
    async inventory(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Estoque é exclusivo do workspace Business.');
        const rows = await this.dataSource.query(`SELECT id,title,status,"updatedAt","commerceConfig"
       FROM classified_listings
       WHERE "companyId" = $1 AND "listingType" = 'PRODUCT' AND status <> 'ARCHIVED'
       ORDER BY "updatedAt" DESC`, [identity.company.id]);
        return rows.map((listing) => this.inventoryItem(listing));
    }
    async updateInventory(uid, listingId, raw) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Estoque é exclusivo do workspace Business.');
        const listing = await this.assertOwner(uid, listingId);
        if (listing.companyId !== identity.company.id || listing.listingType !== 'PRODUCT') {
            throw new common_1.ForbiddenException('Este produto não pode ter estoque gerenciado aqui.');
        }
        const current = listing.commerceConfig || {};
        const checkout = current.onlineCheckout || {};
        const stockQuantity = raw.stockQuantity === null || raw.stockQuantity === ''
            ? null
            : this.int(raw.stockQuantity, 0, 1_000_000, 0);
        const lowStockThreshold = raw.lowStockThreshold === undefined
            ? (checkout.lowStockThreshold ?? null)
            : raw.lowStockThreshold === null || raw.lowStockThreshold === ''
                ? null
                : this.int(raw.lowStockThreshold, 0, 1_000_000, 0);
        const commerceConfig = {
            ...current,
            onlineCheckout: { ...checkout, stockQuantity, lowStockThreshold },
        };
        await this.dataSource.query(`UPDATE classified_listings SET "commerceConfig" = $2::jsonb, "updatedAt" = now() WHERE id = $1`, [listingId, JSON.stringify(commerceConfig)]);
        return this.inventoryItem({ ...listing, commerceConfig, updatedAt: new Date() });
    }
    async dashboard(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('O módulo de Vendas é do workspace Business.');
        const companyId = identity.company.id;
        const [totals, recent, products, calendar] = await Promise.all([
            this.dataSource.query(`SELECT
           count(*)::int AS orders,
           count(*) FILTER (WHERE "paymentStatus" = 'APPROVED')::int AS paid,
           COALESCE(sum("totalCents") FILTER (WHERE "paymentStatus" = 'APPROVED'), 0)::bigint AS revenue,
           COALESCE(sum("platformFeeCents") FILTER (WHERE "paymentStatus" = 'APPROVED'), 0)::bigint AS fees,
           COALESCE(sum("sellerNetCents") FILTER (WHERE "paymentStatus" = 'APPROVED'), 0)::bigint AS net
         FROM classified_orders WHERE "companyId" = $1`, [companyId]).catch(() => [{ orders: 0, paid: 0, revenue: 0, fees: 0, net: 0 }]),
            this.dataSource.query(`SELECT o.*, l.title, l.slug
         FROM classified_orders o JOIN classified_listings l ON l.id = o."listingId"
         WHERE o."companyId" = $1 ORDER BY o."createdAt" DESC LIMIT 30`, [companyId]).catch(() => []),
            this.dataSource.query(`SELECT l.id,l.title,l.slug,
                count(o.id)::int AS orders,
                COALESCE(sum(o.quantity) FILTER (WHERE o."paymentStatus" = 'APPROVED'),0)::int AS units,
                COALESCE(sum(o."totalCents") FILTER (WHERE o."paymentStatus" = 'APPROVED'),0)::bigint AS revenue
         FROM classified_listings l
         LEFT JOIN classified_orders o ON o."listingId" = l.id
         WHERE l."companyId" = $1 AND l."listingType" = 'PRODUCT'
         GROUP BY l.id ORDER BY revenue DESC, units DESC, l."updatedAt" DESC LIMIT 50`, [companyId]).catch(() => []),
            this.dataSource.query(`SELECT date_trunc('day', "createdAt")::date AS day,
                count(*)::int AS orders,
                COALESCE(sum("totalCents") FILTER (WHERE "paymentStatus" = 'APPROVED'),0)::bigint AS revenue
         FROM classified_orders
         WHERE "companyId" = $1 AND "createdAt" >= now() - interval '90 days'
         GROUP BY 1 ORDER BY 1 ASC`, [companyId]).catch(() => []),
        ]);
        return {
            totals: totals[0] || { orders: 0, paid: 0, revenue: 0, fees: 0, net: 0 },
            recentOrders: recent,
            products,
            calendar,
        };
    }
    async orders(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Pedidos são do workspace Business.');
        return this.dataSource.query(`SELECT o.*, l.title, l.slug, u."displayName" AS "buyerName", u.email AS "buyerEmail", u."whatsappPhoneE164" AS "buyerWhatsapp"
       FROM classified_orders o
       JOIN classified_listings l ON l.id = o."listingId"
       LEFT JOIN users u ON u.id = o."buyerUserId"
       WHERE o."companyId" = $1 ORDER BY o."createdAt" DESC LIMIT 500`, [identity.company.id]);
    }
    async updateOrderStatus(uid, orderId, rawStatus) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Pedidos são do workspace Business.');
        const status = String(rawStatus || '').trim().toUpperCase();
        const allowed = ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELED'];
        if (!allowed.includes(status))
            throw new common_1.BadRequestException('Status do pedido inválido.');
        const rows = await this.dataSource.query(`SELECT * FROM classified_orders WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [orderId, identity.company.id]);
        const order = rows[0];
        if (!order)
            throw new common_1.NotFoundException('Pedido não encontrado.');
        if (['COMPLETED', 'CANCELED'].includes(order.status)) {
            throw new common_1.BadRequestException('Este pedido já foi encerrado.');
        }
        const updated = await this.dataSource.transaction(async (manager) => {
            const changed = await manager.query(`UPDATE classified_orders SET status = $2,
           "readyAt" = CASE WHEN $2 = 'READY' THEN now() ELSE "readyAt" END,
           "completedAt" = CASE WHEN $2 = 'COMPLETED' THEN now() ELSE "completedAt" END,
           "canceledAt" = CASE WHEN $2 = 'CANCELED' THEN now() ELSE "canceledAt" END,
           "updatedAt" = now()
         WHERE id = $1 RETURNING *`, [orderId, status]);
            await manager.query(`INSERT INTO classified_order_events ("orderId",type,"fromStatus","toStatus","actorUserId")
         VALUES ($1,'STATUS_CHANGED',$2,$3,$4)`, [orderId, order.status, status, uid]);
            return changed[0];
        });
        await this.notifications.notifyUser(order.buyerUserId, {
            title: 'Pedido atualizado',
            message: `Seu pedido agora está: ${this.statusLabel(status)}.`,
            type: 'classified_order_status',
            link: '/classificados/compras',
        }).catch(() => undefined);
        return updated;
    }
    async appointments(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Agenda é do workspace Business.');
        return this.dataSource.query(`SELECT a.*, l.title, u."displayName" AS "customerName", u.email AS "customerEmail", u."whatsappPhoneE164" AS "customerWhatsapp"
       FROM classified_appointments a
       JOIN classified_listings l ON l.id = a."listingId"
       LEFT JOIN users u ON u.id = a."customerUserId"
       WHERE a."companyId" = $1
       ORDER BY a."startsAt" ASC LIMIT 1000`, [identity.company.id]).catch(() => []);
    }
    async expirePromotions() {
        const rows = await this.dataSource.query(`UPDATE classified_listings
       SET status = 'PAUSED', "updatedAt" = now()
       WHERE status = 'PUBLISHED'
         AND "commerceConfig"->'promotion' IS NOT NULL
         AND upper(COALESCE("commerceConfig"->'promotion'->>'endAction','REVERT')) = 'PAUSE'
         AND NULLIF("commerceConfig"->'promotion'->>'endsAt','')::timestamptz <= now()
       RETURNING id`).catch(() => []);
        return { paused: rows.length };
    }
    async resolveFeeRule(companyId, plan) {
        const custom = await this.dataSource.query(`SELECT * FROM classified_commerce_fee_rules
       WHERE scope = 'COMPANY' AND "companyId" = $1 AND enabled = true LIMIT 1`, [companyId]).catch(() => []);
        const rule = custom[0] || (await this.dataSource.query(`SELECT * FROM classified_commerce_fee_rules
       WHERE scope = 'PLAN' AND plan = $1 AND enabled = true LIMIT 1`, [plan]).catch(() => []))[0];
        if (!rule || rule.rateBps == null)
            return null;
        return {
            source: rule.scope === 'COMPANY' ? 'CUSTOM' : plan,
            rateBps: Number(rule.rateBps),
            percentage: Number(rule.rateBps) / 100,
            minimumFeeCents: Number(rule.minimumFeeCents || 0),
            maximumFeeCents: rule.maximumFeeCents == null ? null : Number(rule.maximumFeeCents),
        };
    }
    calculatePlatformFee(totalCents, rule) {
        let fee = Math.round(totalCents * rule.rateBps / 10_000);
        fee = Math.max(rule.minimumFeeCents || 0, fee);
        if (rule.maximumFeeCents != null)
            fee = Math.min(rule.maximumFeeCents, fee);
        return Math.max(0, Math.min(totalCents, fee));
    }
    effectivePricing(basePrice, config) {
        const base = Number(basePrice);
        const now = Date.now();
        const promotion = config?.promotion;
        const starts = promotion?.startsAt ? new Date(promotion.startsAt).getTime() : null;
        const ends = promotion?.endsAt ? new Date(promotion.endsAt).getTime() : null;
        const promotionActive = Boolean(promotion && Number.isFinite(Number(promotion.price))
            && (starts == null || starts <= now)
            && (ends == null || ends > now));
        const current = promotionActive ? Number(promotion.price) : base;
        const pix = config?.paymentPricing?.pix;
        let pixPrice = current;
        if (pix?.enabled && Number.isFinite(Number(pix.discountValue)) && Number(pix.discountValue) > 0) {
            pixPrice = pix.discountType === 'FIXED'
                ? current - Number(pix.discountValue)
                : current * (1 - Number(pix.discountValue) / 100);
        }
        const card = config?.paymentPricing?.card;
        const cardPrice = card?.enabled && card.price != null ? Number(card.price) : current;
        return {
            basePrice: Number.isFinite(base) ? base : null,
            currentPrice: Number.isFinite(current) ? Math.max(0, current) : null,
            promotionActive,
            promotionEndsAt: promotion?.endsAt || null,
            pixPrice: Number.isFinite(pixPrice) ? Math.max(0, pixPrice) : null,
            cardPrice: Number.isFinite(cardPrice) ? Math.max(0, cardPrice) : null,
            maxInstallments: card?.enabled ? Math.max(1, Number(card.maxInstallments || 1)) : 1,
            interestFreeInstallments: card?.enabled ? Math.max(0, Number(card.interestFreeInstallments || 0)) : 0,
        };
    }
    cleanCommerceConfig(raw, basePriceRaw, listingType) {
        const source = (raw.commerceConfig && typeof raw.commerceConfig === 'object' ? raw.commerceConfig : raw);
        const basePrice = Number(basePriceRaw);
        const promotionSource = source.promotion && typeof source.promotion === 'object' ? source.promotion : null;
        let promotion = null;
        if (promotionSource?.price !== undefined && promotionSource?.price !== null && promotionSource?.price !== '') {
            const price = this.moneyNumber(promotionSource.price, 'Preço promocional inválido.');
            if (Number.isFinite(basePrice) && price >= basePrice) {
                throw new common_1.BadRequestException('O preço promocional deve ser menor que o preço normal.');
            }
            const startsAt = this.optionalDate(promotionSource.startsAt, 'Início da promoção inválido.');
            const endsAt = this.optionalDate(promotionSource.endsAt, 'Fim da promoção inválido.');
            if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
                throw new common_1.BadRequestException('O fim da promoção precisa ser posterior ao início.');
            }
            promotion = {
                price,
                startsAt,
                endsAt,
                endAction: String(promotionSource.endAction || 'REVERT').toUpperCase() === 'PAUSE' ? 'PAUSE' : 'REVERT',
            };
        }
        const pixSource = source.paymentPricing?.pix;
        const pixEnabled = pixSource?.enabled === true;
        const pixDiscountType = String(pixSource?.discountType || 'PERCENT').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENT';
        const pixDiscountValue = pixEnabled ? this.nonNegativeNumber(pixSource?.discountValue || 0, 'Desconto Pix inválido.') : 0;
        if (pixDiscountType === 'PERCENT' && pixDiscountValue > 100) {
            throw new common_1.BadRequestException('O desconto Pix não pode ultrapassar 100%.');
        }
        const cardSource = source.paymentPricing?.card;
        const cardEnabled = cardSource?.enabled === true;
        const cardPrice = cardEnabled && cardSource?.price !== undefined && cardSource?.price !== null && cardSource?.price !== ''
            ? this.moneyNumber(cardSource.price, 'Preço no cartão inválido.')
            : null;
        const maxInstallments = cardEnabled ? this.int(cardSource?.maxInstallments, 1, 24, 1) : 1;
        const interestFreeInstallments = cardEnabled
            ? this.int(cardSource?.interestFreeInstallments, 0, maxInstallments, 0)
            : 0;
        const checkoutSource = source.onlineCheckout && typeof source.onlineCheckout === 'object' ? source.onlineCheckout : {};
        const fulfillmentModes = Array.isArray(checkoutSource.fulfillmentModes)
            ? [...new Set(checkoutSource.fulfillmentModes.map((item) => String(item).toUpperCase()).filter((item) => ['PICKUP', 'DELIVERY'].includes(item)))].slice(0, 2)
            : ['PICKUP'];
        const onlineEnabled = listingType === 'PRODUCT' && checkoutSource.enabled === true;
        return {
            promotion,
            paymentPricing: {
                pix: { enabled: pixEnabled, discountType: pixDiscountType, discountValue: pixDiscountValue },
                card: { enabled: cardEnabled, price: cardPrice, maxInstallments, interestFreeInstallments },
            },
            onlineCheckout: {
                enabled: onlineEnabled,
                fulfillmentModes: fulfillmentModes.length ? fulfillmentModes : ['PICKUP'],
                stockQuantity: checkoutSource.stockQuantity == null || checkoutSource.stockQuantity === '' ? null : this.int(checkoutSource.stockQuantity, 0, 1_000_000, 0),
                lowStockThreshold: checkoutSource.lowStockThreshold == null || checkoutSource.lowStockThreshold === '' ? null : this.int(checkoutSource.lowStockThreshold, 0, 1_000_000, 0),
                orderWhatsappE164: this.phone(checkoutSource.orderWhatsappE164),
            },
        };
    }
    async assertOwner(uid, listingId) {
        const identity = await this.identities.active(uid);
        const rows = await this.dataSource.query(`SELECT * FROM classified_listings WHERE id = $1 LIMIT 1`, [listingId]);
        const listing = rows[0];
        if (!listing)
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        const allowed = identity.type === 'COMPANY'
            ? listing.companyId === identity.company.id
            : !listing.companyId && listing.sellerUserId === uid;
        if (!allowed)
            throw new common_1.ForbiddenException('Este anúncio pertence a outra identidade.');
        return listing;
    }
    inventoryItem(listing) {
        const checkout = listing.commerceConfig?.onlineCheckout || {};
        return {
            id: listing.id,
            title: listing.title,
            status: listing.status,
            updatedAt: listing.updatedAt,
            stockQuantity: checkout.stockQuantity == null ? null : Number(checkout.stockQuantity),
            lowStockThreshold: checkout.lowStockThreshold == null ? null : Number(checkout.lowStockThreshold),
            onlineCheckoutEnabled: checkout.enabled === true,
        };
    }
    moneyNumber(value, message) {
        const n = Number(String(value ?? '').replace(',', '.'));
        if (!Number.isFinite(n) || n < 0 || n > 999_999_999.99)
            throw new common_1.BadRequestException(message);
        return Math.round(n * 100) / 100;
    }
    nonNegativeNumber(value, message) {
        const n = Number(String(value ?? '').replace(',', '.'));
        if (!Number.isFinite(n) || n < 0 || n > 999_999_999.99)
            throw new common_1.BadRequestException(message);
        return n;
    }
    optionalDate(value, message) {
        const text = String(value || '').trim();
        if (!text)
            return null;
        const date = new Date(text);
        if (!Number.isFinite(date.getTime()))
            throw new common_1.BadRequestException(message);
        return date.toISOString();
    }
    int(value, min, max, fallback) {
        const n = Math.round(Number(value));
        return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    }
    phone(value) {
        const text = String(value || '').replace(/\D/g, '');
        return text ? text.slice(0, 20) : null;
    }
    statusLabel(status) {
        return {
            CONFIRMED: 'confirmado', PREPARING: 'em preparação', READY: 'pronto para retirada',
            OUT_FOR_DELIVERY: 'saiu para entrega', COMPLETED: 'concluído', CANCELED: 'cancelado',
        }[status] || status.toLowerCase();
    }
};
exports.ClassifiedsSalesService = ClassifiedsSalesService;
exports.ClassifiedsSalesService = ClassifiedsSalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService,
        classifieds_entitlements_service_1.ClassifiedsEntitlementsService,
        notifications_service_1.NotificationsService])
], ClassifiedsSalesService);
//# sourceMappingURL=classifieds-sales.service.js.map