import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

const MIN_DURATION_MS = 30 * 60 * 1000;
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ClassifiedsAuctionService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.closeDue().catch(() => undefined), 60_000);
    this.timer.unref?.();
    void this.closeDue().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async list(uid: string) {
    await this.closeDue().catch(() => undefined);
    const identity = await this.identities.active(uid);
    const companyId = identity.type === 'COMPANY' ? identity.company!.id : null;
    const rows = await this.dataSource.query(
      `SELECT a.*, l.title, l.slug, l.description, l.city, l.state, l.status AS "listingStatus",
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
       WHERE a.status = 'OPEN' OR a."updatedAt" >= now() - interval '30 days'
       ORDER BY CASE WHEN a.status = 'OPEN' THEN 0 ELSE 1 END, a."endsAt" ASC, a."updatedAt" DESC`,
    );

    return rows.map((row: any) => this.decorate(row, uid, companyId));
  }

  async detail(uid: string, auctionId: string) {
    await this.closeOneIfDue(auctionId).catch(() => undefined);
    const identity = await this.identities.active(uid);
    const companyId = identity.type === 'COMPANY' ? identity.company!.id : null;
    const rows = await this.dataSource.query(
      `SELECT a.*, l.title, l.slug, l.description, l.city, l.state, l.status AS "listingStatus",
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
       WHERE a.id = $1 LIMIT 1`,
      [auctionId],
    );
    if (!rows[0]) throw new NotFoundException('Leilão não encontrado.');

    const bids = await this.dataSource.query(
      `SELECT b.id, b.amount, b."bidderUserId", b."bidderCompanyId", b."createdAt",
              COALESCE(c.name, u."socialName", u."displayName", u."fullName", 'Participante') AS "bidderName"
       FROM classified_auction_bids b
       LEFT JOIN companies c ON c.id = b."bidderCompanyId"
       LEFT JOIN users u ON u.id = b."bidderUserId"
       WHERE b."auctionId" = $1
       ORDER BY b.amount DESC, b."createdAt" ASC LIMIT 30`,
      [auctionId],
    );

    return {
      ...this.decorate(rows[0], uid, companyId),
      bids: bids.map((bid: any) => ({
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

  async create(uid: string, body: Record<string, unknown>) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY') {
      throw new ForbiddenException('Somente empresas podem criar leilões.');
    }
    const companyId = identity.company!.id;
    const listingId = String(body.listingId || '').trim();
    if (!listingId) throw new BadRequestException('Escolha um produto para o leilão.');

    const listingRows = await this.dataSource.query(
      `SELECT * FROM classified_listings
       WHERE id = $1 AND "companyId" = $2 AND "listingType" = 'PRODUCT' AND status = 'PUBLISHED'
       LIMIT 1`,
      [listingId, companyId],
    );
    const listing = listingRows[0];
    if (!listing) throw new BadRequestException('O leilão precisa usar um produto publicado desta empresa.');

    const [active, pendingOffers] = await Promise.all([
      this.dataSource.query(
        `SELECT id FROM classified_auctions WHERE "listingId" = $1 AND status = 'OPEN' LIMIT 1`,
        [listingId],
      ),
      this.dataSource.query(
        `SELECT id FROM classified_offers WHERE "listingId" = $1 AND status = 'PENDING' LIMIT 1`,
        [listingId],
      ).catch(() => []),
    ]);
    if (active[0]) throw new BadRequestException('Este produto já está em um leilão ativo.');
    if (pendingOffers[0]) {
      throw new BadRequestException('Resolva ou aguarde expirar as ofertas pendentes deste produto antes de abrir um leilão.');
    }

    const startPrice = this.money(body.startPrice);
    const minIncrement = this.money(body.minIncrement ?? 1);
    if (!startPrice) throw new BadRequestException('Informe um lance inicial válido.');
    if (!minIncrement) throw new BadRequestException('Informe um incremento mínimo válido.');

    const endsAt = this.parseEndsAt(body.endsAt);
    const duration = endsAt.getTime() - Date.now();
    if (!Number.isFinite(endsAt.getTime()) || duration < MIN_DURATION_MS) {
      throw new BadRequestException('O leilão deve durar pelo menos 30 minutos.');
    }
    if (duration > MAX_DURATION_MS) {
      throw new BadRequestException('O leilão pode durar no máximo 30 dias nesta versão.');
    }

    const rows = await this.dataSource.query(
      `INSERT INTO classified_auctions
        ("listingId","companyId","sellerUserId",status,"startPrice","minIncrement","startsAt","endsAt")
       VALUES ($1,$2,$3,'OPEN',$4,$5,now(),$6) RETURNING *`,
      [listingId, companyId, uid, startPrice, minIncrement, endsAt],
    );
    return this.detail(uid, rows[0].id);
  }

  async bid(uid: string, auctionId: string, rawAmount: unknown) {
    await this.closeOneIfDue(auctionId).catch(() => undefined);
    const identity = await this.identities.active(uid);
    const bidderCompanyId = identity.type === 'COMPANY' ? identity.company!.id : null;
    const amount = this.money(rawAmount);
    if (!amount) throw new BadRequestException('Informe um lance válido.');

    const result = await this.dataSource.transaction(async (manager) => {
      const auctionRows = await manager.query(
        `SELECT a.*, l.title FROM classified_auctions a
         JOIN classified_listings l ON l.id = a."listingId"
         WHERE a.id = $1 FOR UPDATE`,
        [auctionId],
      );
      const auction = auctionRows[0];
      if (!auction) throw new NotFoundException('Leilão não encontrado.');
      if (auction.status !== 'OPEN') throw new BadRequestException('Este leilão já foi encerrado.');
      if (new Date(auction.endsAt).getTime() <= Date.now()) {
        throw new BadRequestException('O prazo deste leilão terminou.');
      }
      if (auction.sellerUserId === uid || (bidderCompanyId && auction.companyId === bidderCompanyId)) {
        throw new BadRequestException('A empresa anunciante não pode dar lance no próprio leilão.');
      }

      const topRows = await manager.query(
        `SELECT * FROM classified_auction_bids WHERE "auctionId" = $1
         ORDER BY amount DESC, "createdAt" ASC LIMIT 1`,
        [auctionId],
      );
      const previous = topRows[0] || null;
      const minimum = previous
        ? Number(previous.amount) + Number(auction.minIncrement)
        : Number(auction.startPrice);
      if (Number(amount) + 0.0001 < minimum) {
        throw new BadRequestException(`O próximo lance mínimo é ${this.currency(minimum)}.`);
      }

      const bidRows = await manager.query(
        `INSERT INTO classified_auction_bids ("auctionId","bidderUserId","bidderCompanyId",amount)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [auctionId, uid, bidderCompanyId, amount],
      );
      return { auction, bid: bidRows[0], previous };
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
      message: `“${result.auction.title}” recebeu um novo lance.`,
      type: 'classified_auction_bid',
      link: `/classificados/leiloes/${auctionId}`,
    }).catch(() => undefined);

    return this.detail(uid, auctionId);
  }

  async cancel(uid: string, auctionId: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY') throw new ForbiddenException('Somente a empresa anunciante pode cancelar o leilão.');
    const companyId = identity.company!.id;

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT * FROM classified_auctions WHERE id = $1 FOR UPDATE`,
        [auctionId],
      );
      const auction = rows[0];
      if (!auction || auction.companyId !== companyId) throw new NotFoundException('Leilão não encontrado para esta empresa.');
      if (auction.status !== 'OPEN') throw new BadRequestException('Este leilão não está aberto.');
      const countRows = await manager.query(
        `SELECT count(*)::int AS count FROM classified_auction_bids WHERE "auctionId" = $1`,
        [auctionId],
      );
      if (Number(countRows[0]?.count || 0) > 0) {
        throw new BadRequestException('Um leilão com lances não pode ser cancelado.');
      }
      const updated = await manager.query(
        `UPDATE classified_auctions SET status = 'CANCELED', "closedAt" = now(), "updatedAt" = now()
         WHERE id = $1 RETURNING *`,
        [auctionId],
      );
      return updated[0];
    });
  }

  async assertOffersAllowed(listingId: string) {
    await this.closeDue().catch(() => undefined);
    const rows = await this.dataSource.query(
      `SELECT id FROM classified_auctions WHERE "listingId" = $1 AND status = 'OPEN' AND "endsAt" > now() LIMIT 1`,
      [listingId],
    );
    if (rows[0]) {
      throw new BadRequestException('Este produto está em leilão. Enquanto o leilão estiver aberto, propostas diretas ficam desativadas.');
    }
  }

  async closeDue() {
    const due = await this.dataSource.query(
      `SELECT id FROM classified_auctions WHERE status = 'OPEN' AND "endsAt" <= now() ORDER BY "endsAt" ASC LIMIT 100`,
    ).catch(() => []);
    let closed = 0;
    for (const row of due) {
      const didClose = await this.closeOneIfDue(row.id).catch(() => false);
      if (didClose) closed += 1;
    }
    return { closed };
  }

  private async closeOneIfDue(auctionId: string) {
    let closed: any = null;
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM classified_auctions WHERE id = $1 FOR UPDATE`, [auctionId]);
      const auction = rows[0];
      if (!auction || auction.status !== 'OPEN' || new Date(auction.endsAt).getTime() > Date.now()) return;
      closed = await this.finalizeLocked(manager, auction);
    });
    if (closed) {
      await this.notifyClosed(closed).catch(() => undefined);
      return true;
    }
    return false;
  }

  private async finalizeLocked(manager: EntityManager, auction: any) {
    const topRows = await manager.query(
      `SELECT * FROM classified_auction_bids WHERE "auctionId" = $1
       ORDER BY amount DESC, "createdAt" ASC LIMIT 1`,
      [auction.id],
    );
    const winner = topRows[0] || null;
    const rows = await manager.query(
      `UPDATE classified_auctions
       SET status = 'ENDED', "winnerUserId" = $2, "winnerCompanyId" = $3,
           "winningBidId" = $4, "finalAmount" = $5, "closedAt" = now(), "updatedAt" = now()
       WHERE id = $1 AND status = 'OPEN' RETURNING *`,
      [auction.id, winner?.bidderUserId || null, winner?.bidderCompanyId || null, winner?.id || null, winner?.amount || null],
    );
    if (rows[0] && winner) {
      await manager.query(
        `UPDATE classified_listings SET status = 'PAUSED', "updatedAt" = now()
         WHERE id = $1 AND status = 'PUBLISHED'`,
        [auction.listingId],
      );
    }
    return rows[0] ? { ...rows[0], title: auction.title || null } : null;
  }

  private async notifyClosed(auction: any) {
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
    } else {
      await this.notifyIdentity(auction.sellerUserId, auction.companyId, {
        title: 'Leilão encerrado sem lances',
        message: `“${title}” terminou sem nenhum lance.`,
        type: 'classified_auction_ended',
        link: `/classificados/leiloes/${auction.id}`,
      });
    }
  }

  private decorate(row: any, uid: string, companyId: string | null) {
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

  private async notifyIdentity(userId: string, companyId: string | null, data: any) {
    const ids = new Set<string>();
    if (userId) ids.add(userId);
    if (companyId) {
      const rows = await this.dataSource.query(
        `SELECT u.id FROM users u WHERE u."companyId" = $1 AND (u."isCompanyAdmin" = true OR u.type = 'ADMIN')
         UNION SELECT c."ownerId" AS id FROM companies c WHERE c.id = $1 AND c."ownerId" IS NOT NULL`,
        [companyId],
      ).catch(() => []);
      rows.forEach((row: any) => row.id && ids.add(row.id));
    }
    await Promise.all([...ids].map((id) => this.notifications.notifyUser(id, data).catch(() => undefined)));
  }

  private parseEndsAt(value: unknown) {
    let raw = String(value || '').trim();
    if (!raw) return new Date(NaN);
    const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
    if (!hasZone && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)) {
      raw = `${raw}${raw.length === 16 ? ':00' : ''}-03:00`;
    }
    return new Date(raw);
  }

  private money(value: unknown) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999_999_999.99) return null;
    return parsed.toFixed(2);
  }

  private currency(value: unknown) {
    const parsed = Number(value);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(parsed) ? parsed : 0);
  }

  private maskName(value: unknown) {
    const name = String(value || 'Participante').trim();
    if (name.length <= 2) return `${name.charAt(0) || 'P'}***`;
    return `${name.charAt(0)}${'*'.repeat(Math.min(5, Math.max(2, name.length - 2)))}${name.charAt(name.length - 1)}`;
  }
}
