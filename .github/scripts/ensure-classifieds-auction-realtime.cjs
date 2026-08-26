const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'backend/src/classifieds/classifieds-auction.service.ts';
let source = fs.readFileSync(file, 'utf8');

function replace(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Auction realtime patch missing ${label}`);
  source = source.replace(from, to);
}

replace(
  "import { ClassifiedsIdentityService } from './classifieds-identity.service';",
  "import { ClassifiedsIdentityService } from './classifieds-identity.service';\nimport { ClassifiedsAuctionGateway } from './classifieds-auction.gateway';",
  'gateway import',
);

replace(
  "const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;",
  "const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;\nconst SOFT_CLOSE_SECONDS = 30;",
  'soft-close constant',
);

replace(
  "    private readonly identities: ClassifiedsIdentityService,\n    private readonly notifications: NotificationsService,\n  ) {}",
  "    private readonly identities: ClassifiedsIdentityService,\n    private readonly notifications: NotificationsService,\n    private readonly auctionGateway: ClassifiedsAuctionGateway,\n  ) {}",
  'gateway injection',
);

replace(
  "    this.timer = setInterval(() => void this.closeDue().catch(() => undefined), 60_000);",
  "    this.timer = setInterval(() => void this.closeDue().catch(() => undefined), 1_000);",
  'realtime close timer',
);

replace(
  "        `SELECT a.*, l.title FROM classified_auctions a\n         JOIN classified_listings l ON l.id = a.\"listingId\"",
  "        `SELECT a.*, l.title, (a.\"endsAt\" > now()) AS \"clockOpen\" FROM classified_auctions a\n         JOIN classified_listings l ON l.id = a.\"listingId\"",
  'database clock in bid lock',
);

replace(
  "      if (new Date(auction.endsAt).getTime() <= Date.now()) {\n        throw new BadRequestException('O prazo deste leilão terminou.');\n      }",
  "      if (!auction.clockOpen) {\n        throw new BadRequestException('O prazo deste leilão terminou.');\n      }",
  'database clock bid validation',
);

replace(
  "      const bidRows = await manager.query(\n        `INSERT INTO classified_auction_bids (\"auctionId\",\"bidderUserId\",\"bidderCompanyId\",amount)\n         VALUES ($1,$2,$3,$4) RETURNING *`,\n        [auctionId, uid, bidderCompanyId, amount],\n      );\n      return { auction, bid: bidRows[0], previous };",
  "      const bidRows = await manager.query(\n        `INSERT INTO classified_auction_bids (\"auctionId\",\"bidderUserId\",\"bidderCompanyId\",amount)\n         VALUES ($1,$2,$3,$4) RETURNING *`,\n        [auctionId, uid, bidderCompanyId, amount],\n      );\n\n      const extensionRows = await manager.query(\n        `UPDATE classified_auctions\n         SET \"endsAt\" = now() + interval '${SOFT_CLOSE_SECONDS} seconds', \"updatedAt\" = now()\n         WHERE id = $1\n           AND status = 'OPEN'\n           AND \"endsAt\" <= now() + interval '${SOFT_CLOSE_SECONDS} seconds'\n         RETURNING \"endsAt\"`,\n        [auctionId],\n      );\n      return { auction, bid: bidRows[0], previous, extended: Boolean(extensionRows[0]), extendedEndsAt: extensionRows[0]?.endsAt || null };",
  'atomic soft close',
);

replace(
  "    await this.notifyIdentity(result.auction.sellerUserId, result.auction.companyId, {\n      title: `Novo lance: ${this.currency(amount)}`,\n      message: `“${result.auction.title}” recebeu um novo lance.`,\n      type: 'classified_auction_bid',\n      link: `/classificados/leiloes/${auctionId}`,\n    }).catch(() => undefined);\n\n    return this.detail(uid, auctionId);",
  "    await this.notifyIdentity(result.auction.sellerUserId, result.auction.companyId, {\n      title: `Novo lance: ${this.currency(amount)}`,\n      message: result.extended\n        ? `“${result.auction.title}” recebeu um novo lance e o relógio voltou para ${SOFT_CLOSE_SECONDS} segundos.`\n        : `“${result.auction.title}” recebeu um novo lance.`,\n      type: 'classified_auction_bid',\n      link: `/classificados/leiloes/${auctionId}`,\n    }).catch(() => undefined);\n\n    this.auctionGateway.publishAuctionChanged(auctionId, result.extended ? 'EXTENDED' : 'BID');\n    const detail = await this.detail(uid, auctionId);\n    return { ...detail, softCloseExtended: result.extended, softCloseSeconds: SOFT_CLOSE_SECONDS };",
  'bid broadcast',
);

replace(
  "    return this.detail(uid, rows[0].id);\n  }\n\n  async bid(uid: string, auctionId: string, rawAmount: unknown) {",
  "    const detail = await this.detail(uid, rows[0].id);\n    this.auctionGateway.publishAuctionChanged(rows[0].id, 'CREATED');\n    return detail;\n  }\n\n  async bid(uid: string, auctionId: string, rawAmount: unknown) {",
  'create broadcast',
);

replace(
  "      return updated[0];\n    });\n  }\n\n  async assertOffersAllowed(listingId: string) {",
  "      return updated[0];\n    });\n    if (canceled?.id) this.auctionGateway.publishAuctionChanged(auctionId, 'CANCELED');\n    return canceled;\n  }\n\n  async assertOffersAllowed(listingId: string) {",
  'cancel broadcast tail',
);

replace(
  "    return this.dataSource.transaction(async (manager) => {\n      const rows = await manager.query(\n        `SELECT * FROM classified_auctions WHERE id = $1 FOR UPDATE`,",
  "    const canceled = await this.dataSource.transaction(async (manager) => {\n      const rows = await manager.query(\n        `SELECT * FROM classified_auctions WHERE id = $1 FOR UPDATE`,",
  'cancel transaction binding',
);

replace(
  "      const rows = await manager.query(`SELECT * FROM classified_auctions WHERE id = $1 FOR UPDATE`, [auctionId]);\n      const auction = rows[0];\n      if (!auction || auction.status !== 'OPEN' || new Date(auction.endsAt).getTime() > Date.now()) return;",
  "      const rows = await manager.query(`SELECT *, (\"endsAt\" <= now()) AS \"clockDue\" FROM classified_auctions WHERE id = $1 FOR UPDATE`, [auctionId]);\n      const auction = rows[0];\n      if (!auction || auction.status !== 'OPEN' || !auction.clockDue) return;",
  'database clock close validation',
);

replace(
  "    if (closed) {\n      await this.notifyClosed(closed).catch(() => undefined);\n      return true;\n    }",
  "    if (closed) {\n      await this.notifyClosed(closed).catch(() => undefined);\n      this.auctionGateway.publishAuctionChanged(auctionId, 'ENDED');\n      return true;\n    }",
  'close broadcast',
);

if (!source.includes('softCloseExtended: result.extended') || !source.includes("publishAuctionChanged(auctionId, result.extended ? 'EXTENDED' : 'BID')") || !source.includes("publishAuctionChanged(auctionId, 'CANCELED')") || !source.includes('clockOpen') || !source.includes('clockDue') || !source.includes('1_000')) {
  throw new Error('Auction realtime/soft-close patch was not applied.');
}

fs.writeFileSync(file, source);
console.log('Auction realtime rooms and 30-second soft close verified.');
