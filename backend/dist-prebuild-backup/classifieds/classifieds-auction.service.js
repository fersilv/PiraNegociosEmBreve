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
exports.ClassifiedsAuctionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const notifications_service_1 = require("../notifications/notifications.service");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
const classifieds_auction_gateway_1 = require("./classifieds-auction.gateway");
const MIN_DURATION_MS = 60 * 60 * 1000;
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SOFT_CLOSE_SECONDS = 30;
const AUCTION_RELIST_COOLDOWN_HOURS = 48;
const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;
let ClassifiedsAuctionService = class ClassifiedsAuctionService {
    dataSource;
    identities;
    notifications;
    auctionGateway;
    timer = null;
    constructor(dataSource, identities, notifications, auctionGateway) {
        this.dataSource = dataSource;
        this.identities = identities;
        this.notifications = notifications;
        this.auctionGateway = auctionGateway;
    }
    onModuleInit() {
        this.timer = setInterval(() => void this.closeDue().catch(() => undefined), 1_000);
        this.timer.unref?.();
        void this.closeDue().catch(() => undefined);
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async list(uid) {
        await this.closeDue().catch(() => undefined);
        const identity = await this.identities.active(uid);
        const companyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const rows = await this.dataSource.query(`SELECT a.*, l.title, l.slug, l.description, l.city, l.state, l.status AS "listingStatus",
              c.name AS "companyName", c."logoURL" AS "companyLogo",
              i.url AS image,
              hb.amount AS "currentBid", hb.id AS "currentBidId",
              hb."bidderUserId" AS "currentBidderUserId", hb."bidderCompanyId" AS "currentBidderCompanyId",
              COALESCE(bc."bidCount", 0)::int AS "bidCount"
       FROM classified_auctions a
       JOIN classified_listings l ON l.id = a."listingId"
       JOIN companies c ON c.id = a."companyId"
       LEFT JOIN LATERAL (
         SELECT b.* FROM classified_auction_bids b
         WHERE b."auctionId" = a.id
         ORDER BY b.amount DESC, b."createdAt" ASC LIMIT 1
       ) hb ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId" = a.id
       ) bc ON true
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images
         WHERE "listingId" = l.id ORDER BY "sortOrder" ASC LIMIT 1
       ) i ON true
       WHERE a.status IN ('SCHEDULED','OPEN') OR a."updatedAt" >= now() - interval '30 days'
       ORDER BY CASE a.status WHEN 'OPEN' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END, a."startsAt" ASC, a."endsAt" ASC, a."updatedAt" DESC`);
        return rows.map((row) => this.decorate(row, uid, companyId));
    }
    async detail(uid, auctionId) {
        await this.closeOneIfDue(auctionId).catch(() => undefined);
        const identity = await this.identities.active(uid);
        const companyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const rows = await this.dataSource.query(`SELECT a.*, l.title, l.slug, l.description, l.city, l.state, l.status AS "listingStatus",
              c.name AS "companyName", c."logoURL" AS "companyLogo",
              i.url AS image,
              hb.amount AS "currentBid", hb.id AS "currentBidId",
              hb."bidderUserId" AS "currentBidderUserId", hb."bidderCompanyId" AS "currentBidderCompanyId",
              COALESCE(bc."bidCount", 0)::int AS "bidCount"
       FROM classified_auctions a
       JOIN classified_listings l ON l.id = a."listingId"
       JOIN companies c ON c.id = a."companyId"
       LEFT JOIN LATERAL (
         SELECT b.* FROM classified_auction_bids b
         WHERE b."auctionId" = a.id
         ORDER BY b.amount DESC, b."createdAt" ASC LIMIT 1
       ) hb ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId" = a.id
       ) bc ON true
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images
         WHERE "listingId" = l.id ORDER BY "sortOrder" ASC LIMIT 1
       ) i ON true
       WHERE a.id = $1 LIMIT 1`, [auctionId]);
        if (!rows[0])
            throw new common_1.NotFoundException('Leilão não encontrado.');
        const bids = await this.dataSource.query(`SELECT b.id, b.amount, b."bidderUserId", b."bidderCompanyId", b."createdAt",
              COALESCE(c.name, u."socialName", u."displayName", u."fullName", 'Participante') AS "bidderName"
       FROM classified_auction_bids b
       LEFT JOIN companies c ON c.id = b."bidderCompanyId"
       LEFT JOIN users u ON u.id = b."bidderUserId"
       WHERE b."auctionId" = $1
       ORDER BY b.amount DESC, b."createdAt" ASC LIMIT 30`, [auctionId]);
        return {
            ...this.decorate(rows[0], uid, companyId),
            bids: bids.map((bid) => ({
                id: bid.id,
                amount: bid.amount,
                createdAt: bid.createdAt,
                mine: companyId ? bid.bidderCompanyId === companyId : !bid.bidderCompanyId && bid.bidderUserId === uid,
                bidderName: this.maskName(bid.bidderName),
            })),
            settlement: {
                mode: 'DIRECT',
                protectedPayment: false,
                message: 'Nesta versão, o pagamento e a entrega são combinados diretamente entre vencedor e anunciante.',
            },
        };
    }
    async create(uid, body) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY') {
            throw new common_1.ForbiddenException('Somente empresas podem criar leilões.');
        }
        const companyId = identity.company.id;
        const listingId = String(body.listingId || '').trim();
        if (!listingId)
            throw new common_1.BadRequestException('Escolha um produto para o leilão.');
        const listingRows = await this.dataSource.query(`SELECT * FROM classified_listings
       WHERE id = $1 AND "companyId" = $2 AND "listingType" = 'PRODUCT' AND status = 'PUBLISHED'
       LIMIT 1`, [listingId, companyId]);
        const listing = listingRows[0];
        if (!listing)
            throw new common_1.BadRequestException('O leilão precisa usar um produto publicado desta empresa.');
        const [active, pendingOffers] = await Promise.all([
            this.dataSource.query(`SELECT id FROM classified_auctions WHERE "listingId" = $1 AND status IN ('SCHEDULED','OPEN') LIMIT 1`, [listingId]),
            this.dataSource.query(`SELECT id FROM classified_offers WHERE "listingId" = $1 AND status = 'PENDING' LIMIT 1`, [listingId]).catch(() => []),
        ]);
        if (active[0])
            throw new common_1.BadRequestException('Este produto já está em um leilão ativo.');
        const cooldown = await this.dataSource.query(`SELECT COALESCE("closedAt","updatedAt") + interval '${AUCTION_RELIST_COOLDOWN_HOURS} hours' AS "cooldownUntil"
       FROM classified_auctions WHERE "listingId"=$1 AND status IN ('ENDED','CANCELED')
         AND COALESCE("closedAt","updatedAt") > now() - interval '${AUCTION_RELIST_COOLDOWN_HOURS} hours'
       ORDER BY COALESCE("closedAt","updatedAt") DESC LIMIT 1`, [listingId]);
        if (cooldown[0]) {
            const until = new Date(cooldown[0].cooldownUntil).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            throw new common_1.BadRequestException(`Este produto está em quarentena de leilão por ${AUCTION_RELIST_COOLDOWN_HOURS} horas. Novo leilão disponível após ${until}.`);
        }
        if (pendingOffers[0]) {
            throw new common_1.BadRequestException('Resolva ou aguarde expirar as ofertas pendentes deste produto antes de abrir um leilão.');
        }
        const startPrice = this.money(body.startPrice);
        const minIncrement = this.money(body.minIncrement ?? 1);
        if (!startPrice)
            throw new common_1.BadRequestException('Informe um lance inicial válido.');
        if (!minIncrement)
            throw new common_1.BadRequestException('Informe um incremento mínimo válido.');
        const requestedStartsAt = body.startsAt ? this.parseEndsAt(body.startsAt) : new Date();
        const startsAt = requestedStartsAt.getTime() < Date.now() ? new Date() : requestedStartsAt;
        const endsAt = this.parseEndsAt(body.endsAt);
        if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() - Date.now() > MAX_SCHEDULE_AHEAD_MS) {
            throw new common_1.BadRequestException('O início do leilão pode ser agendado em até 90 dias.');
        }
        const duration = endsAt.getTime() - startsAt.getTime();
        if (!Number.isFinite(endsAt.getTime()) || duration < MIN_DURATION_MS) {
            throw new common_1.BadRequestException('Entre o início e o encerramento, o leilão deve durar pelo menos 60 minutos.');
        }
        if (duration > MAX_DURATION_MS) {
            throw new common_1.BadRequestException('O leilão pode durar no máximo 30 dias nesta versão.');
        }
        const rows = await this.dataSource.query(`INSERT INTO classified_auctions
        ("listingId","companyId","sellerUserId",status,"startPrice","minIncrement","startsAt","endsAt")
       VALUES ($1,$2,$3,CASE WHEN $6 > now() THEN 'SCHEDULED' ELSE 'OPEN' END,$4,$5,$6,$7) RETURNING *`, [listingId, companyId, uid, startPrice, minIncrement, startsAt, endsAt]);
        const detail = await this.detail(uid, rows[0].id);
        this.auctionGateway.publishAuctionChanged(rows[0].id, 'CREATED');
        return detail;
    }
    async bid(uid, auctionId, rawAmount) {
        await this.closeOneIfDue(auctionId).catch(() => undefined);
        const identity = await this.identities.active(uid);
        const bidderCompanyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const amount = this.money(rawAmount);
        if (!amount)
            throw new common_1.BadRequestException('Informe um lance válido.');
        const result = await this.dataSource.transaction(async (manager) => {
            const auctionRows = await manager.query(`SELECT a.*, l.title, (a."endsAt" > now()) AS "clockOpen" FROM classified_auctions a
         JOIN classified_listings l ON l.id = a."listingId"
         WHERE a.id = $1 FOR UPDATE`, [auctionId]);
            const auction = auctionRows[0];
            if (!auction)
                throw new common_1.NotFoundException('Leilão não encontrado.');
            if (auction.status !== 'OPEN')
                throw new common_1.BadRequestException('Este leilão já foi encerrado.');
            if (new Date(auction.startsAt).getTime() > Date.now())
                throw new common_1.BadRequestException('Este leilão ainda não começou.');
            if (!auction.clockOpen) {
                throw new common_1.BadRequestException('O prazo deste leilão terminou.');
            }
            if (auction.sellerUserId === uid || (bidderCompanyId && auction.companyId === bidderCompanyId)) {
                throw new common_1.BadRequestException('A empresa anunciante não pode dar lance no próprio leilão.');
            }
            const topRows = await manager.query(`SELECT * FROM classified_auction_bids WHERE "auctionId" = $1
         ORDER BY amount DESC, "createdAt" ASC LIMIT 1`, [auctionId]);
            const previous = topRows[0] || null;
            const minimum = previous
                ? Number(previous.amount) + Number(auction.minIncrement)
                : Number(auction.startPrice);
            if (Number(amount) + 0.0001 < minimum) {
                throw new common_1.BadRequestException(`O próximo lance mínimo é ${this.currency(minimum)}.`);
            }
            const bidRows = await manager.query(`INSERT INTO classified_auction_bids ("auctionId","bidderUserId","bidderCompanyId",amount)
         VALUES ($1,$2,$3,$4) RETURNING *`, [auctionId, uid, bidderCompanyId, amount]);
            const extensionRows = await manager.query(`UPDATE classified_auctions
         SET "endsAt" = now() + interval '${SOFT_CLOSE_SECONDS} seconds', "updatedAt" = now()
         WHERE id = $1
           AND status = 'OPEN'
           AND "endsAt" <= now() + interval '${SOFT_CLOSE_SECONDS} seconds'
         RETURNING "endsAt"`, [auctionId]);
            return { auction, bid: bidRows[0], previous, extended: Boolean(extensionRows[0]), extendedEndsAt: extensionRows[0]?.endsAt || null };
        });
        if (result.previous && result.previous.bidderUserId !== uid) {
            await this.notifyIdentity(result.previous.bidderUserId, result.previous.bidderCompanyId, {
                title: 'Seu lance foi superado',
                message: `Há um novo maior lance em “${result.auction.title}”.`,
                type: 'classified_auction_outbid',
                link: `/classificados/leiloes/${auctionId}`,
            }).catch(() => undefined);
        }
        await this.notifyIdentity(result.auction.sellerUserId, result.auction.companyId, {
            title: `Novo lance: ${this.currency(amount)}`,
            message: result.extended
                ? `“${result.auction.title}” recebeu um novo lance e o relógio voltou para ${SOFT_CLOSE_SECONDS} segundos.`
                : `“${result.auction.title}” recebeu um novo lance.`,
            type: 'classified_auction_bid',
            link: `/classificados/leiloes/${auctionId}`,
        }).catch(() => undefined);
        this.auctionGateway.publishAuctionChanged(auctionId, result.extended ? 'EXTENDED' : 'BID');
        const detail = await this.detail(uid, auctionId);
        return { ...detail, softCloseExtended: result.extended, softCloseSeconds: SOFT_CLOSE_SECONDS };
    }
    async cancel(uid, auctionId) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Somente a empresa anunciante pode cancelar o leilão.');
        const companyId = identity.company.id;
        const canceled = await this.dataSource.transaction(async (manager) => {
            const rows = await manager.query(`SELECT * FROM classified_auctions WHERE id = $1 FOR UPDATE`, [auctionId]);
            const auction = rows[0];
            if (!auction || auction.companyId !== companyId)
                throw new common_1.NotFoundException('Leilão não encontrado para esta empresa.');
            if (!['SCHEDULED', 'OPEN'].includes(auction.status))
                throw new common_1.BadRequestException('Este leilão não pode mais ser cancelado.');
            const countRows = await manager.query(`SELECT count(*)::int AS count FROM classified_auction_bids WHERE "auctionId" = $1`, [auctionId]);
            if (Number(countRows[0]?.count || 0) > 0) {
                throw new common_1.BadRequestException('Um leilão com lances não pode ser cancelado.');
            }
            const updated = await manager.query(`UPDATE classified_auctions SET status = 'CANCELED', "closedAt" = now(), "updatedAt" = now()
         WHERE id = $1 RETURNING *`, [auctionId]);
            return updated[0];
        });
        if (canceled?.id)
            this.auctionGateway.publishAuctionChanged(auctionId, 'CANCELED');
        return canceled;
    }
    async assertOffersAllowed(listingId) {
        await this.closeDue().catch(() => undefined);
        const rows = await this.dataSource.query(`SELECT id FROM classified_auctions WHERE "listingId" = $1 AND status = 'OPEN' AND "endsAt" > now() LIMIT 1`, [listingId]);
        if (rows[0]) {
            throw new common_1.BadRequestException('Este produto está em leilão. Enquanto o leilão estiver aberto, propostas diretas ficam desativadas.');
        }
    }
    async closeDue() {
        const due = await this.dataSource.query(`SELECT id FROM classified_auctions WHERE status = 'OPEN' AND "endsAt" <= now() ORDER BY "endsAt" ASC LIMIT 100`).catch(() => []);
        let closed = 0;
        for (const row of due) {
            const didClose = await this.closeOneIfDue(row.id).catch(() => false);
            if (didClose)
                closed += 1;
        }
        return { closed };
    }
    async closeOneIfDue(auctionId) {
        let closed = null;
        await this.dataSource.transaction(async (manager) => {
            const rows = await manager.query(`SELECT *, ("endsAt" <= now()) AS "clockDue" FROM classified_auctions WHERE id = $1 FOR UPDATE`, [auctionId]);
            const auction = rows[0];
            if (!auction || auction.status !== 'OPEN' || !auction.clockDue)
                return;
            closed = await this.finalizeLocked(manager, auction);
        });
        if (closed) {
            await this.notifyClosed(closed).catch(() => undefined);
            this.auctionGateway.publishAuctionChanged(auctionId, 'ENDED');
            return true;
        }
        return false;
    }
    async finalizeLocked(manager, auction) {
        const topRows = await manager.query(`SELECT * FROM classified_auction_bids WHERE "auctionId" = $1
       ORDER BY amount DESC, "createdAt" ASC LIMIT 1`, [auction.id]);
        const winner = topRows[0] || null;
        const rows = await manager.query(`UPDATE classified_auctions
       SET status = 'ENDED', "winnerUserId" = $2, "winnerCompanyId" = $3,
           "winningBidId" = $4, "finalAmount" = $5, "closedAt" = now(), "updatedAt" = now()
       WHERE id = $1 AND status = 'OPEN' RETURNING *`, [auction.id, winner?.bidderUserId || null, winner?.bidderCompanyId || null, winner?.id || null, winner?.amount || null]);
        if (rows[0] && winner) {
            await manager.query(`UPDATE classified_listings SET status = 'PAUSED', "updatedAt" = now()
         WHERE id = $1 AND status = 'PUBLISHED'`, [auction.listingId]);
        }
        return rows[0] ? { ...rows[0], title: auction.title || null } : null;
    }
    async notifyClosed(auction) {
        const listingRows = await this.dataSource.query(`SELECT title FROM classified_listings WHERE id = $1 LIMIT 1`, [auction.listingId]);
        const title = listingRows[0]?.title || auction.title || 'Leilão';
        if (auction.winnerUserId) {
            await this.notifyIdentity(auction.winnerUserId, auction.winnerCompanyId, {
                title: 'Você venceu o leilão 🏆',
                message: `Seu lance de ${this.currency(auction.finalAmount)} venceu “${title}”. O item foi reservado; combine pagamento e entrega com o anunciante.`,
                type: 'classified_auction_won',
                link: `/classificados/leiloes/${auction.id}`,
            });
            await this.notifyIdentity(auction.sellerUserId, auction.companyId, {
                title: 'Leilão encerrado com vencedor',
                message: `“${title}” terminou em ${this.currency(auction.finalAmount)} e foi pausado como reservado. Combine pagamento e entrega com o vencedor.`,
                type: 'classified_auction_sold',
                link: `/classificados/leiloes/${auction.id}`,
            });
        }
        else {
            await this.notifyIdentity(auction.sellerUserId, auction.companyId, {
                title: 'Leilão encerrado sem lances',
                message: `“${title}” terminou sem nenhum lance.`,
                type: 'classified_auction_ended',
                link: `/classificados/leiloes/${auction.id}`,
            });
        }
    }
    decorate(row, uid, companyId) {
        const owned = companyId ? row.companyId === companyId : false;
        const leading = companyId
            ? row.currentBidderCompanyId === companyId
            : !row.currentBidderCompanyId && row.currentBidderUserId === uid;
        const won = companyId
            ? row.winnerCompanyId === companyId
            : !row.winnerCompanyId && row.winnerUserId === uid;
        const current = row.currentBid == null ? Number(row.startPrice) : Number(row.currentBid);
        const nextMinimum = row.currentBid == null ? Number(row.startPrice) : current + Number(row.minIncrement);
        return {
            ...row,
            owned,
            leading,
            won,
            currentBid: row.currentBid,
            nextMinimum: nextMinimum.toFixed(2),
            paymentMode: 'DIRECT',
        };
    }
    async notifyIdentity(userId, companyId, data) {
        const ids = new Set();
        if (userId)
            ids.add(userId);
        if (companyId) {
            const rows = await this.dataSource.query(`SELECT u.id FROM users u WHERE u."companyId" = $1 AND (u."isCompanyAdmin" = true OR u.type = 'ADMIN')
         UNION SELECT c."ownerId" AS id FROM companies c WHERE c.id = $1 AND c."ownerId" IS NOT NULL`, [companyId]).catch(() => []);
            rows.forEach((row) => row.id && ids.add(row.id));
        }
        await Promise.all([...ids].map((id) => this.notifications.notifyUser(id, data).catch(() => undefined)));
    }
    parseEndsAt(value) {
        let raw = String(value || '').trim();
        if (!raw)
            return new Date(NaN);
        const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
        if (!hasZone && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)) {
            raw = `${raw}${raw.length === 16 ? ':00' : ''}-03:00`;
        }
        return new Date(raw);
    }
    money(value) {
        const parsed = Number(String(value ?? '').replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999_999_999.99)
            return null;
        return parsed.toFixed(2);
    }
    currency(value) {
        const parsed = Number(value);
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(parsed) ? parsed : 0);
    }
    maskName(value) {
        const name = String(value || 'Participante').trim();
        if (name.length <= 2)
            return `${name.charAt(0) || 'P'}***`;
        return `${name.charAt(0)}${'*'.repeat(Math.min(5, Math.max(2, name.length - 2)))}${name.charAt(name.length - 1)}`;
    }
};
exports.ClassifiedsAuctionService = ClassifiedsAuctionService;
exports.ClassifiedsAuctionService = ClassifiedsAuctionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService,
        notifications_service_1.NotificationsService,
        classifieds_auction_gateway_1.ClassifiedsAuctionGateway])
], ClassifiedsAuctionService);
//# sourceMappingURL=classifieds-auction.service.js.map