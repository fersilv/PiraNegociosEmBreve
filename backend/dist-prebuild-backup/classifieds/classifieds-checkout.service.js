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
exports.ClassifiedsCheckoutService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const typeorm_1 = require("typeorm");
const payment_provider_config_service_1 = require("../payments/payment-provider-config.service");
const notifications_service_1 = require("../notifications/notifications.service");
const classifieds_entitlements_service_1 = require("./classifieds-entitlements.service");
const classifieds_marketplace_payments_service_1 = require("./classifieds-marketplace-payments.service");
const classifieds_marketplace_terms_service_1 = require("./classifieds-marketplace-terms.service");
const classifieds_sales_service_1 = require("./classifieds-sales.service");
let ClassifiedsCheckoutService = class ClassifiedsCheckoutService {
    dataSource;
    marketplacePayments;
    providerConfig;
    sales;
    entitlements;
    terms;
    notifications;
    expirationTimer = null;
    constructor(dataSource, marketplacePayments, providerConfig, sales, entitlements, terms, notifications) {
        this.dataSource = dataSource;
        this.marketplacePayments = marketplacePayments;
        this.providerConfig = providerConfig;
        this.sales = sales;
        this.entitlements = entitlements;
        this.terms = terms;
        this.notifications = notifications;
    }
    onModuleInit() {
        this.expirationTimer = setInterval(() => {
            void this.expirePendingOrders().catch(() => undefined);
        }, 60_000);
        this.expirationTimer.unref?.();
        void this.expirePendingOrders().catch(() => undefined);
    }
    onModuleDestroy() {
        if (this.expirationTimer)
            clearInterval(this.expirationTimer);
    }
    async config(uid, listingId) {
        const listing = await this.checkoutListing(listingId);
        this.assertNotSeller(uid, listing);
        await this.marketplacePayments.sellerMercadoPagoCredentials(listing.companyId);
        const platform = await this.platformMercadoPagoConfig();
        if (!platform.publicKey) {
            throw new common_1.ServiceUnavailableException('A Public Key da aplicação Mercado Pago do PiraNegócios não está configurada em Admin → Pagamentos → Formas de pagamento.');
        }
        const pricing = this.sales.effectivePricing(listing.price, listing.commerceConfig);
        const terms = await this.terms.status(uid);
        const stockQuantity = this.stockQuantity(listing.commerceConfig);
        const fulfillmentModes = this.fulfillmentModes(listing);
        const buyer = await this.dataSource.query(`SELECT email,"displayName","fullName","socialName",address,city,state FROM users WHERE id=$1 LIMIT 1`, [uid]);
        return {
            listing: {
                id: listing.id,
                slug: listing.slug,
                title: listing.title,
                image: listing.image || null,
                companyName: listing.companyName,
            },
            provider: 'MERCADO_PAGO',
            publicKey: platform.publicKey,
            pricing,
            paymentMethods: ['PIX', 'CARD'],
            fulfillmentModes,
            stockQuantity,
            available: stockQuantity == null || stockQuantity > 0,
            buyer: {
                email: buyer[0]?.email || '',
                name: buyer[0]?.socialName || buyer[0]?.displayName || buyer[0]?.fullName || '',
                deliveryAddress: buyer[0]?.address || '',
                city: buyer[0]?.city || '',
                state: buyer[0]?.state || '',
            },
            terms: {
                version: classifieds_marketplace_terms_service_1.CLASSIFIEDS_PAYMENT_TERMS_VERSION,
                accepted: terms.buyerAccepted,
                url: terms.termsUrl,
            },
        };
    }
    async acceptBuyerTerms(uid, metadata = {}) {
        return this.terms.accept(uid, 'ONLINE_PAYMENT_BUYER', metadata);
    }
    async purchases(uid) {
        const rows = await this.dataSource.query(`SELECT o.*,l.title,l.slug,i.url AS image,c.name AS "companyName"
       FROM classified_orders o
       JOIN classified_listings l ON l.id=o."listingId"
       JOIN companies c ON c.id=o."companyId"
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images WHERE "listingId"=l.id
         ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1
       ) i ON true
       WHERE o."buyerUserId"=$1 ORDER BY o."createdAt" DESC LIMIT 500`, [uid]).catch(() => []);
        return rows.map((row) => this.presentOrder(row));
    }
    async createPayment(uid, listingId, body) {
        await this.terms.assertAccepted(uid, 'ONLINE_PAYMENT_BUYER');
        const method = this.paymentMethod(body.paymentMethod);
        const quantity = this.quantity(body.quantity);
        const idempotencyKey = this.idempotencyKey(body.idempotencyKey);
        const previous = await this.dataSource.query(`SELECT o.*,l.title,l.slug,i.url AS image,c.name AS "companyName"
       FROM classified_orders o
       JOIN classified_listings l ON l.id=o."listingId"
       JOIN companies c ON c.id=o."companyId"
       LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC LIMIT 1) i ON true
       WHERE o."idempotencyKey"=$1 LIMIT 1`, [idempotencyKey]).catch(() => []);
        if (previous[0]) {
            if (previous[0].buyerUserId !== uid || previous[0].listingId !== listingId) {
                throw new common_1.BadRequestException('Chave de idempotência já utilizada em outra compra.');
            }
            return this.presentOrder(previous[0]);
        }
        const buyerRows = await this.dataSource.query(`SELECT id,email,"displayName","fullName","socialName" FROM users WHERE id=$1 LIMIT 1`, [uid]);
        const buyer = buyerRows[0];
        if (!buyer?.email)
            throw new common_1.BadRequestException('Sua conta precisa ter e-mail válido para o pagamento online.');
        const prepared = await this.dataSource.transaction(async (manager) => {
            const rows = await manager.query(`SELECT l.*,c.name AS "companyName",c."ownerId" AS "companyOwnerId",
                i.url AS image
         FROM classified_listings l
         JOIN companies c ON c.id=l."companyId"
         LEFT JOIN LATERAL (
           SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1
         ) i ON true
         WHERE l.id=$1 FOR UPDATE OF l`, [listingId]);
            const listing = rows[0];
            this.assertCheckoutListing(listing);
            this.assertNotSeller(uid, listing);
            const fulfillmentMode = this.fulfillmentMode(body.fulfillmentMode, this.fulfillmentModes(listing));
            const fulfillmentData = this.fulfillmentData(body.fulfillmentData);
            if (fulfillmentMode === 'DELIVERY' && !fulfillmentData.address) {
                throw new common_1.BadRequestException('Informe o endereço de entrega antes de pagar.');
            }
            const pricing = this.sales.effectivePricing(listing.price, listing.commerceConfig);
            const unitPrice = method === 'PIX' ? pricing.pixPrice : pricing.cardPrice;
            if (unitPrice == null || !Number.isFinite(Number(unitPrice)) || Number(unitPrice) <= 0) {
                throw new common_1.BadRequestException('Este produto está sem preço válido para a forma de pagamento selecionada.');
            }
            const stock = this.stockQuantity(listing.commerceConfig);
            if (stock != null && stock < quantity)
                throw new common_1.BadRequestException('Estoque insuficiente para esta quantidade.');
            if (stock != null) {
                const nextConfig = this.withStock(listing.commerceConfig, stock - quantity);
                await manager.query(`UPDATE classified_listings SET "commerceConfig"=$2::jsonb,"updatedAt"=now() WHERE id=$1`, [listingId, JSON.stringify(nextConfig)]);
                listing.commerceConfig = nextConfig;
            }
            const plan = await this.entitlements.companyPlan(listing.companyId);
            const feeRule = await this.sales.resolveFeeRule(listing.companyId, plan);
            if (!feeRule)
                throw new common_1.BadRequestException('A comissão de vendas online ainda não foi configurada para esta empresa.');
            const unitPriceCents = this.toCents(unitPrice);
            const totalCents = unitPriceCents * quantity;
            const platformFeeCents = this.sales.calculatePlatformFee(totalCents, feeRule);
            const sellerNetCents = totalCents - platformFeeCents;
            const baseCurrent = pricing.currentPrice == null ? Number(unitPrice) : Number(pricing.currentPrice);
            const discountCents = Math.max(0, (this.toCents(baseCurrent) * quantity) - totalCents);
            const expiresAt = new Date(Date.now() + (method === 'PIX' ? 35 * 60_000 : 24 * 60 * 60_000));
            const orderRows = await manager.query(`INSERT INTO classified_orders
         ("companyId","listingId","buyerUserId",quantity,"unitPriceCents","discountCents","totalCents",
          "platformFeeCents","sellerNetCents","paymentProvider","paymentMethod","paymentStatus",status,
          "fulfillmentMode","fulfillmentData","idempotencyKey","termsVersion","stockReserved","expiresAt",metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'MERCADO_PAGO',$10,'PENDING','CREATED',$11,$12::jsonb,$13,$14,$15,$16,$17::jsonb)
         RETURNING *`, [
                listing.companyId,
                listing.id,
                uid,
                quantity,
                unitPriceCents,
                discountCents,
                totalCents,
                platformFeeCents,
                sellerNetCents,
                method,
                fulfillmentMode,
                JSON.stringify(fulfillmentData),
                idempotencyKey,
                classifieds_marketplace_terms_service_1.CLASSIFIEDS_PAYMENT_TERMS_VERSION,
                stock != null,
                expiresAt,
                JSON.stringify({ pricingSnapshot: pricing, feeRule: { ...feeRule, plan } }),
            ]);
            await manager.query(`INSERT INTO classified_order_events("orderId",type,"toStatus","actorUserId",metadata)
         VALUES ($1,'CHECKOUT_CREATED','CREATED',$2,$3::jsonb)`, [orderRows[0].id, uid, JSON.stringify({ method, quantity, fulfillmentMode })]);
            return { order: orderRows[0], listing, pricing, feeRule };
        });
        const credentials = await this.marketplacePayments.sellerMercadoPagoCredentials(prepared.order.companyId);
        const platform = await this.platformMercadoPagoConfig();
        const providerRequest = this.paymentPayload(prepared.order, prepared.listing, buyer, method, body, platform.publicApiBaseUrl);
        const providerResult = await this.callMercadoPagoPayment(credentials.accessToken, idempotencyKey, providerRequest)
            .catch(async (error) => {
            await this.dataSource.query(`UPDATE classified_orders SET "paymentStatus"='IN_PROCESS',"providerStatusDetail"=$2,"updatedAt"=now() WHERE id=$1`, [prepared.order.id, String(error instanceof Error ? error.message : error).slice(0, 160)]).catch(() => undefined);
            return null;
        });
        if (!providerResult) {
            return this.orderById(prepared.order.id, {
                processing: true,
                message: 'O Mercado Pago ainda não confirmou a criação do pagamento. O pedido ficou protegido contra duplicidade e será reconciliado pelo webhook.',
            });
        }
        if (!providerResult.ok) {
            const ambiguous = providerResult.status >= 500;
            if (!ambiguous)
                await this.releaseReservedStock(prepared.order.id, 'PAYMENT_REJECTED');
            await this.dataSource.query(`UPDATE classified_orders SET "paymentStatus"=$2,"providerStatusDetail"=$3,"updatedAt"=now() WHERE id=$1`, [prepared.order.id, ambiguous ? 'IN_PROCESS' : 'REJECTED', String(providerResult.data?.message || providerResult.data?.error || `HTTP ${providerResult.status}`).slice(0, 160)]);
            if (!ambiguous) {
                throw new common_1.BadRequestException(this.providerError(providerResult.data));
            }
            return this.orderById(prepared.order.id, {
                processing: true,
                message: 'O provedor está processando a solicitação. Não tente pagar duas vezes; acompanhe em Minhas compras.',
            });
        }
        const payment = providerResult.data || {};
        await this.applyProviderPayment(prepared.order.id, payment, 'CHECKOUT_RESPONSE');
        return this.orderById(prepared.order.id);
    }
    async mercadoPagoWebhook(headers, query, body) {
        const paymentId = String(body?.data?.id || query?.['data.id'] || query?.id || '').trim();
        if (!paymentId)
            return { received: true, ignored: 'missing_payment_id' };
        await this.verifyWebhook(headers, paymentId);
        let orderRows = await this.dataSource.query(`SELECT * FROM classified_orders WHERE "paymentProvider"='MERCADO_PAGO' AND "providerPaymentId"=$1 LIMIT 1`, [paymentId]).catch(() => []);
        let companyId = orderRows[0]?.companyId || null;
        if (!companyId) {
            const sellerUserId = String(body?.user_id || query?.user_id || '').trim();
            if (sellerUserId) {
                const connections = await this.dataSource.query(`SELECT "companyId" FROM company_classified_payment_connections
           WHERE provider='MERCADO_PAGO' AND status='CONNECTED' AND "externalUserId"=$1 LIMIT 1`, [sellerUserId]).catch(() => []);
                companyId = connections[0]?.companyId || null;
            }
        }
        if (!companyId)
            return { received: true, ignored: 'seller_not_resolved' };
        const credentials = await this.marketplacePayments.sellerMercadoPagoCredentials(companyId);
        const payment = await this.fetchMercadoPagoPayment(credentials.accessToken, paymentId);
        if (!orderRows[0] && payment?.external_reference) {
            orderRows = await this.dataSource.query(`SELECT * FROM classified_orders WHERE id=$1 AND "companyId"=$2 LIMIT 1`, [String(payment.external_reference), companyId]).catch(() => []);
        }
        const order = orderRows[0];
        if (!order)
            return { received: true, ignored: 'order_not_resolved' };
        await this.applyProviderPayment(order.id, payment, 'WEBHOOK');
        return { received: true };
    }
    async expirePendingOrders() {
        const rows = await this.dataSource.query(`SELECT id FROM classified_orders
       WHERE "stockReserved"=true AND "expiresAt" IS NOT NULL AND "expiresAt" <= now()
         AND "paymentStatus" IN ('PENDING','IN_PROCESS') LIMIT 200`).catch(() => []);
        for (const row of rows) {
            await this.releaseReservedStock(row.id, 'PAYMENT_EXPIRED').catch(() => undefined);
            await this.dataSource.query(`UPDATE classified_orders SET "paymentStatus"='CANCELED',status='CANCELED',"canceledAt"=COALESCE("canceledAt",now()),"updatedAt"=now()
         WHERE id=$1 AND "paymentStatus" IN ('PENDING','IN_PROCESS')`, [row.id]).catch(() => undefined);
        }
        return { expired: rows.length };
    }
    async checkoutListing(listingId) {
        const rows = await this.dataSource.query(`SELECT l.*,c.name AS "companyName",c."ownerId" AS "companyOwnerId",i.url AS image
       FROM classified_listings l
       JOIN companies c ON c.id=l."companyId"
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1
       ) i ON true
       WHERE l.id=$1 LIMIT 1`, [listingId]);
        const listing = rows[0];
        this.assertCheckoutListing(listing);
        return listing;
    }
    assertCheckoutListing(listing) {
        if (!listing || listing.status !== 'PUBLISHED')
            throw new common_1.NotFoundException('Produto não encontrado ou indisponível.');
        if (listing.listingType !== 'PRODUCT' || !listing.companyId) {
            throw new common_1.BadRequestException('Compra online está disponível somente para produtos Business.');
        }
        if (listing.commerceConfig?.onlineCheckout?.enabled !== true) {
            throw new common_1.BadRequestException('Este produto não está habilitado para compra online.');
        }
    }
    assertNotSeller(uid, listing) {
        if (listing.sellerUserId === uid)
            throw new common_1.BadRequestException('Você não pode comprar o próprio anúncio.');
    }
    paymentMethod(value) {
        const method = String(value || '').trim().toUpperCase();
        if (!['PIX', 'CARD'].includes(method))
            throw new common_1.BadRequestException('Forma de pagamento inválida.');
        return method;
    }
    quantity(value) {
        const quantity = Math.floor(Number(value || 1));
        if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50)
            throw new common_1.BadRequestException('Quantidade inválida.');
        return quantity;
    }
    idempotencyKey(value) {
        const key = String(value || '').trim();
        if (!/^[A-Za-z0-9_-]{16,120}$/.test(key))
            throw new common_1.BadRequestException('Chave de idempotência inválida.');
        return key;
    }
    fulfillmentModes(listing) {
        const declared = Array.isArray(listing.deliveryModes) ? listing.deliveryModes : [];
        const checkout = Array.isArray(listing.commerceConfig?.onlineCheckout?.fulfillmentModes)
            ? listing.commerceConfig.onlineCheckout.fulfillmentModes
            : [];
        const raw = checkout.length ? checkout : declared.length ? declared : ['ARRANGE'];
        const modes = raw.map((item) => String(item).toUpperCase())
            .filter((item) => ['ARRANGE', 'PICKUP', 'DELIVERY'].includes(item));
        const fallback = ['ARRANGE'];
        return [...new Set(modes.length ? modes : fallback)];
    }
    fulfillmentMode(value, allowed) {
        const mode = String(value || allowed[0] || 'ARRANGE').trim().toUpperCase();
        if (!allowed.includes(mode))
            throw new common_1.BadRequestException('Forma de recebimento não disponível neste anúncio.');
        return mode;
    }
    fulfillmentData(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            note: String(source.note || '').trim().slice(0, 500) || null,
            address: String(source.address || '').trim().slice(0, 500) || null,
        };
    }
    stockQuantity(config) {
        const value = config?.onlineCheckout?.stockQuantity;
        if (value === null || value === undefined || value === '')
            return null;
        const number = Math.floor(Number(value));
        return Number.isFinite(number) ? Math.max(0, number) : null;
    }
    withStock(configRaw, stockQuantity) {
        const config = configRaw && typeof configRaw === 'object' ? structuredClone(configRaw) : {};
        config.onlineCheckout = config.onlineCheckout && typeof config.onlineCheckout === 'object' ? config.onlineCheckout : {};
        config.onlineCheckout.stockQuantity = Math.max(0, Math.floor(stockQuantity));
        return config;
    }
    toCents(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0)
            throw new common_1.BadRequestException('Preço inválido para checkout.');
        return Math.round(number * 100);
    }
    paymentPayload(order, listing, buyer, method, input, configuredApiBase) {
        const amount = Number(order.totalCents) / 100;
        const fee = Number(order.platformFeeCents) / 100;
        const publicApiBase = String(configuredApiBase || process.env.PUBLIC_API_ORIGIN || process.env.PUBLIC_API_URL || 'https://piranegocios.com.br/api').replace(/\/$/, '');
        const common = {
            transaction_amount: amount,
            application_fee: fee,
            description: String(listing.title || 'Compra PiraNegócios').slice(0, 250),
            external_reference: order.id,
            notification_url: `${publicApiBase}/classifieds/payments/mercado-pago/webhook`,
            payer: { email: String(buyer.email) },
            metadata: { classified_order_id: order.id, listing_id: listing.id, platform: 'PIRANEGOCIOS' },
        };
        if (method === 'PIX') {
            return {
                ...common,
                payment_method_id: 'pix',
                date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString(),
            };
        }
        const token = String(input.token || input.formData?.token || '').trim();
        const paymentMethodId = String(input.paymentMethodId || input.formData?.payment_method_id || '').trim();
        const issuerId = String(input.issuerId || input.formData?.issuer_id || '').trim();
        const installments = Math.max(1, Math.min(24, Math.floor(Number(input.installments || input.formData?.installments || 1))));
        if (!token || !paymentMethodId)
            throw new common_1.BadRequestException('O Mercado Pago não retornou token/cartão válido. Tente novamente.');
        const identification = input.payer?.identification || input.formData?.payer?.identification;
        return {
            ...common,
            token,
            payment_method_id: paymentMethodId,
            ...(issuerId ? { issuer_id: issuerId } : {}),
            installments,
            payer: {
                email: String(buyer.email),
                ...(identification?.type && identification?.number
                    ? { identification: { type: String(identification.type), number: String(identification.number).replace(/\D/g, '').slice(0, 32) } }
                    : {}),
            },
        };
    }
    async callMercadoPagoPayment(accessToken, idempotencyKey, payload) {
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'content-type': 'application/json',
                accept: 'application/json',
                'X-Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(25_000),
        });
        const text = await response.text();
        let data = {};
        try {
            data = JSON.parse(text || '{}');
        }
        catch {
            data = { message: text.slice(0, 500) };
        }
        return { ok: response.ok, status: response.status, data };
    }
    async fetchMercadoPagoPayment(accessToken, paymentId) {
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
            headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
            signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok)
            throw new common_1.ServiceUnavailableException(`Não foi possível reconciliar o pagamento Mercado Pago (${response.status}).`);
        return response.json();
    }
    async applyProviderPayment(orderId, payment, source) {
        const providerId = payment?.id == null ? null : String(payment.id);
        const mapped = this.mapPaymentStatus(payment?.status);
        const statusDetail = String(payment?.status_detail || '').slice(0, 160) || null;
        const pixData = payment?.point_of_interaction?.transaction_data;
        const safeMetadata = {
            mercadoPago: {
                status: payment?.status || null,
                statusDetail,
                paymentTypeId: payment?.payment_type_id || null,
                paymentMethodId: payment?.payment_method_id || null,
                pixCopyPaste: pixData?.qr_code || null,
                pixQrCodeBase64: pixData?.qr_code_base64 || null,
                ticketUrl: pixData?.ticket_url || null,
            },
        };
        const beforeRows = await this.dataSource.query(`SELECT * FROM classified_orders WHERE id=$1 LIMIT 1`, [orderId]);
        const before = beforeRows[0];
        if (!before)
            return;
        if (['REJECTED', 'CANCELED'].includes(mapped)) {
            await this.releaseReservedStock(orderId, `PROVIDER_${mapped}`);
        }
        else if (mapped === 'APPROVED') {
            await this.commitReservedStock(orderId);
        }
        const orderStatus = mapped === 'APPROVED'
            ? (before.status === 'CREATED' ? 'PAID' : before.status)
            : mapped === 'CANCELED' && before.status === 'CREATED' ? 'CANCELED' : before.status;
        const updated = await this.dataSource.query(`UPDATE classified_orders SET
         "providerPaymentId"=COALESCE($2,"providerPaymentId"),
         "paymentStatus"=$3::varchar,
         status=$4::varchar,
         "providerStatusDetail"=$5::varchar,
         "paidAt"=CASE WHEN $3::varchar='APPROVED' THEN COALESCE("paidAt",now()) ELSE "paidAt" END,
         "canceledAt"=CASE WHEN $4::varchar='CANCELED' THEN COALESCE("canceledAt",now()) ELSE "canceledAt" END,
         metadata=COALESCE(metadata,'{}'::jsonb) || $6::jsonb,
         "updatedAt"=now()
       WHERE id=$1 RETURNING *`, [orderId, providerId, mapped, orderStatus, statusDetail, JSON.stringify(safeMetadata)]);
        await this.dataSource.query(`INSERT INTO classified_order_events("orderId",type,"fromStatus","toStatus",metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb)`, [orderId, source === 'WEBHOOK' ? 'PAYMENT_WEBHOOK' : 'PAYMENT_RESPONSE', before.paymentStatus, mapped, JSON.stringify({ providerId, statusDetail })]).catch(() => undefined);
        if (before.paymentStatus !== mapped && updated[0]) {
            await this.notifyPaymentChange(updated[0], mapped).catch(() => undefined);
        }
    }
    mapPaymentStatus(value) {
        const status = String(value || '').toLowerCase();
        if (status === 'approved')
            return 'APPROVED';
        if (status === 'rejected')
            return 'REJECTED';
        if (status === 'cancelled' || status === 'canceled')
            return 'CANCELED';
        if (status === 'refunded')
            return 'REFUNDED';
        if (status === 'in_process' || status === 'in_mediation' || status === 'authorized')
            return 'IN_PROCESS';
        return 'PENDING';
    }
    async notifyPaymentChange(order, status) {
        const listingRows = await this.dataSource.query(`SELECT title,"sellerUserId" FROM classified_listings WHERE id=$1 LIMIT 1`, [order.listingId]);
        const listing = listingRows[0];
        const label = status === 'APPROVED' ? 'Pagamento aprovado' : status === 'REJECTED' ? 'Pagamento recusado' : status === 'CANCELED' ? 'Pagamento cancelado' : status === 'REFUNDED' ? 'Pagamento estornado' : 'Pagamento em processamento';
        await Promise.allSettled([
            this.notifications.notifyUser(order.buyerUserId, {
                title: label,
                message: `${listing?.title || 'Sua compra'} · ${this.currencyCents(order.totalCents)}.`,
                type: 'classified_payment_status',
                link: '/classificados/compras',
            }),
            this.notifications.notifyCompany(order.companyId, {
                title: status === 'APPROVED' ? 'Nova venda paga 🎉' : label,
                message: `${listing?.title || 'Pedido'} · ${this.currencyCents(order.totalCents)}.`,
                type: 'classified_sale_payment_status',
                link: '/classificados/vendas',
            }),
        ]);
    }
    async releaseReservedStock(orderId, reason) {
        await this.dataSource.transaction(async (manager) => {
            const orders = await manager.query(`SELECT * FROM classified_orders WHERE id=$1 FOR UPDATE`, [orderId]);
            const order = orders[0];
            if (!order?.stockReserved)
                return;
            const listings = await manager.query(`SELECT * FROM classified_listings WHERE id=$1 FOR UPDATE`, [order.listingId]);
            const listing = listings[0];
            if (listing) {
                const stock = this.stockQuantity(listing.commerceConfig);
                if (stock != null) {
                    await manager.query(`UPDATE classified_listings SET "commerceConfig"=$2::jsonb,"updatedAt"=now() WHERE id=$1`, [listing.id, JSON.stringify(this.withStock(listing.commerceConfig, stock + Number(order.quantity || 1)))]);
                }
            }
            await manager.query(`UPDATE classified_orders SET "stockReserved"=false,"updatedAt"=now() WHERE id=$1`, [orderId]);
            await manager.query(`INSERT INTO classified_order_events("orderId",type,metadata) VALUES ($1,'STOCK_RELEASED',$2::jsonb)`, [orderId, JSON.stringify({ reason })]);
        });
    }
    async commitReservedStock(orderId) {
        await this.dataSource.query(`UPDATE classified_orders SET "stockReserved"=false,"updatedAt"=now() WHERE id=$1 AND "stockReserved"=true`, [orderId]);
    }
    async orderById(orderId, extra = {}) {
        const rows = await this.dataSource.query(`SELECT o.*,l.title,l.slug,i.url AS image,c.name AS "companyName"
       FROM classified_orders o
       JOIN classified_listings l ON l.id=o."listingId"
       JOIN companies c ON c.id=o."companyId"
       LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC LIMIT 1) i ON true
       WHERE o.id=$1 LIMIT 1`, [orderId]);
        if (!rows[0])
            throw new common_1.NotFoundException('Pedido não encontrado.');
        return { ...this.presentOrder(rows[0]), ...extra };
    }
    presentOrder(row) {
        const mp = row.metadata?.mercadoPago || {};
        return {
            id: row.id,
            listingId: row.listingId,
            title: row.title,
            slug: row.slug,
            image: row.image || null,
            companyName: row.companyName,
            quantity: Number(row.quantity || 1),
            unitPriceCents: Number(row.unitPriceCents || 0),
            discountCents: Number(row.discountCents || 0),
            totalCents: Number(row.totalCents || 0),
            paymentProvider: row.paymentProvider,
            paymentMethod: row.paymentMethod,
            paymentStatus: row.paymentStatus,
            providerStatusDetail: row.providerStatusDetail || null,
            status: row.status,
            fulfillmentMode: row.fulfillmentMode,
            fulfillmentData: row.fulfillmentData || null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            expiresAt: row.expiresAt || null,
            pix: row.paymentMethod === 'PIX' ? {
                copyPaste: mp.pixCopyPaste || null,
                qrCodeBase64: mp.pixQrCodeBase64 || null,
                ticketUrl: mp.ticketUrl || null,
            } : null,
        };
    }
    async platformMercadoPagoConfig() {
        return this.providerConfig.getSecretConfig('MERCADO_PAGO');
    }
    async verifyWebhook(headers, paymentId) {
        const config = await this.platformMercadoPagoConfig();
        const secret = String(config.webhookSecret || '').trim();
        if (!secret)
            throw new common_1.ServiceUnavailableException('Assinatura secreta do webhook Mercado Pago não configurada.');
        const signature = String(headers['x-signature'] || headers['X-Signature'] || '').trim();
        const requestId = String(headers['x-request-id'] || headers['X-Request-Id'] || '').trim();
        const parts = Object.fromEntries(signature.split(',').map((part) => part.trim().split('=').map((value) => value.trim())).filter((pair) => pair.length === 2));
        const ts = String(parts.ts || '');
        const v1 = String(parts.v1 || '').toLowerCase();
        if (!ts || !v1 || !requestId)
            throw new common_1.ForbiddenException('Webhook Mercado Pago sem assinatura válida.');
        const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
        const expected = (0, crypto_1.createHmac)('sha256', secret).update(manifest).digest('hex').toLowerCase();
        const receivedBuffer = Buffer.from(v1, 'utf8');
        const expectedBuffer = Buffer.from(expected, 'utf8');
        if (receivedBuffer.length !== expectedBuffer.length || !(0, crypto_1.timingSafeEqual)(receivedBuffer, expectedBuffer)) {
            throw new common_1.ForbiddenException('Assinatura do webhook Mercado Pago inválida.');
        }
    }
    providerError(data) {
        const cause = Array.isArray(data?.cause) ? data.cause[0] : null;
        return String(cause?.description || data?.message || data?.error || 'O Mercado Pago recusou o pagamento.').slice(0, 500);
    }
    currencyCents(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0) / 100);
    }
};
exports.ClassifiedsCheckoutService = ClassifiedsCheckoutService;
exports.ClassifiedsCheckoutService = ClassifiedsCheckoutService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_marketplace_payments_service_1.ClassifiedsMarketplacePaymentsService,
        payment_provider_config_service_1.PaymentProviderConfigService,
        classifieds_sales_service_1.ClassifiedsSalesService,
        classifieds_entitlements_service_1.ClassifiedsEntitlementsService,
        classifieds_marketplace_terms_service_1.ClassifiedsMarketplaceTermsService,
        notifications_service_1.NotificationsService])
], ClassifiedsCheckoutService);
//# sourceMappingURL=classifieds-checkout.service.js.map