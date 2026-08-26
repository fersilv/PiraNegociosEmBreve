const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`updated ${file}`);
  }
}

patch('backend/src/classifieds/classifieds.module.ts', (input) => {
  let source = input;
  if (!source.includes("./classifieds-auction-management.controller")) {
    source = source.replace(
      "import { ClassifiedsAuctionPublicController } from './classifieds-auction-public.controller';",
      "import { ClassifiedsAuctionManagementController } from './classifieds-auction-management.controller';\nimport { ClassifiedsAuctionManagementService } from './classifieds-auction-management.service';\nimport { ClassifiedsAuctionGateway } from './classifieds-auction.gateway';\nimport { ClassifiedsAuctionPublicController } from './classifieds-auction-public.controller';",
    );
  }
  if (!source.includes('ClassifiedsAuctionManagementController,')) {
    source = source.replace('    ClassifiedsAuctionPublicController,', '    ClassifiedsAuctionPublicController,\n    ClassifiedsAuctionManagementController,');
  }
  if (!source.includes('    ClassifiedsAuctionGateway,')) {
    source = source.replace('    ClassifiedsEntitlementsService,', '    ClassifiedsEntitlementsService,\n    ClassifiedsAuctionGateway,');
  }
  if (!source.includes('    ClassifiedsAuctionManagementService,')) {
    source = source.replace('    ClassifiedsAuctionPublicService,', '    ClassifiedsAuctionPublicService,\n    ClassifiedsAuctionManagementService,');
  }
  if (!source.includes("from './classifieds-auction-management.service'")) throw new Error('Auction management service import missing.');
  if (!source.includes('ClassifiedsAuctionGateway,')) throw new Error('Auction gateway provider missing.');
  return source;
});

patch('backend/src/classifieds/classifieds-auction.gateway.ts', (input) => {
  let source = input;
  source = source.replace(
    "  publishAuctionChanged(auctionId: string, reason: 'BID' | 'EXTENDED' | 'ENDED' | 'CANCELED' | 'CREATED') {\n    const id = this.auctionId(auctionId);\n    if (!id || !this.server) return;\n    const payload = { auctionId: id, reason, at: new Date().toISOString() };",
    "  publishAuctionChanged(\n    auctionId: string,\n    reason: 'BID' | 'EXTENDED' | 'ENDED' | 'CANCELED' | 'CREATED',\n    snapshot?: Record<string, unknown> | null,\n  ) {\n    const id = this.auctionId(auctionId);\n    if (!id || !this.server) return;\n    const payload = { auctionId: id, reason, snapshot: snapshot || null, at: new Date().toISOString() };",
  );
  if (!source.includes('snapshot: snapshot || null')) throw new Error('Auction gateway snapshot support missing.');
  return source;
});

patch('backend/src/classifieds/classifieds-auction.service.ts', (input) => {
  let source = input;

  if (!source.includes('AUCTION_RELIST_COOLDOWN_HOURS')) {
    source = source.replace(
      'const SOFT_CLOSE_SECONDS = 30;',
      'const SOFT_CLOSE_SECONDS = 30;\nconst AUCTION_RELIST_COOLDOWN_HOURS = 48;\nconst MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;',
    );
  }

  if (!source.includes('quarentena de leilão')) {
    const anchor = "    if (active[0]) throw new BadRequestException('Este produto já está em um leilão ativo.');";
    const addition = `${anchor}\n    const cooldown = await this.dataSource.query(\n      \`SELECT COALESCE(\"closedAt\",\"updatedAt\") + interval '\${AUCTION_RELIST_COOLDOWN_HOURS} hours' AS \"cooldownUntil\"\n       FROM classified_auctions\n       WHERE \"listingId\"=$1 AND status IN ('ENDED','CANCELED')\n         AND COALESCE(\"closedAt\",\"updatedAt\") > now() - interval '\${AUCTION_RELIST_COOLDOWN_HOURS} hours'\n       ORDER BY COALESCE(\"closedAt\",\"updatedAt\") DESC LIMIT 1\`,\n      [listingId],\n    );\n    if (cooldown[0]) {\n      const until = new Date(cooldown[0].cooldownUntil).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });\n      throw new BadRequestException(\`Este produto está em quarentena de leilão por \${AUCTION_RELIST_COOLDOWN_HOURS} horas. Novo leilão disponível após \${until}.\`);\n    }`;
    if (!source.includes(anchor)) throw new Error('Auction cooldown anchor missing.');
    source = source.replace(anchor, addition);
  }

  if (!source.includes('MAX_SCHEDULE_AHEAD_MS')) {
    throw new Error('Auction lifecycle constants were not prepared.');
  }

  const oldTiming = `    const endsAt = this.parseEndsAt(body.endsAt);\n    const duration = endsAt.getTime() - Date.now();\n    if (!Number.isFinite(endsAt.getTime()) || duration < MIN_DURATION_MS) {\n      throw new BadRequestException('O leilão deve durar pelo menos 30 minutos.');\n    }\n    if (duration > MAX_DURATION_MS) {\n      throw new BadRequestException('O leilão pode durar no máximo 30 dias nesta versão.');\n    }`;
  const newTiming = `    const requestedStartsAt = body.startsAt ? this.parseEndsAt(body.startsAt) : new Date();\n    const startsAt = requestedStartsAt.getTime() < Date.now() ? new Date() : requestedStartsAt;\n    const endsAt = this.parseEndsAt(body.endsAt);\n    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() - Date.now() > MAX_SCHEDULE_AHEAD_MS) {\n      throw new BadRequestException('O início do leilão pode ser agendado em até 90 dias.');\n    }\n    const duration = endsAt.getTime() - startsAt.getTime();\n    if (!Number.isFinite(endsAt.getTime()) || duration < MIN_DURATION_MS) {\n      throw new BadRequestException('Entre o início e o encerramento, o leilão deve durar pelo menos 30 minutos.');\n    }\n    if (duration > MAX_DURATION_MS) {\n      throw new BadRequestException('O leilão pode durar no máximo 30 dias nesta versão.');\n    }`;
  if (!source.includes(newTiming)) {
    if (!source.includes(oldTiming)) throw new Error('Auction scheduling timing anchor missing.');
    source = source.replace(oldTiming, newTiming);
  }

  source = source.replace(
    `       VALUES ($1,$2,$3,'OPEN',$4,$5,now(),$6) RETURNING *\`,\n      [listingId, companyId, uid, startPrice, minIncrement, endsAt],`,
    `       VALUES ($1,$2,$3,'OPEN',$4,$5,$6,$7) RETURNING *\`,\n      [listingId, companyId, uid, startPrice, minIncrement, startsAt, endsAt],`,
  );

  source = source.replace(
    '`SELECT a.*, l.title, (a."endsAt" > now()) AS "clockOpen" FROM classified_auctions a',
    '`SELECT a.*, l.title, (a."endsAt" > now()) AS "clockOpen", (a."startsAt" <= now()) AS "clockStarted" FROM classified_auctions a',
  );
  if (!source.includes("if (!auction.clockStarted)")) {
    const anchor = "      if (!auction.clockOpen) {\n        throw new BadRequestException('O prazo deste leilão terminou.');\n      }";
    if (!source.includes(anchor)) throw new Error('Auction bid clock anchor missing.');
    source = source.replace(anchor, `      if (!auction.clockStarted) {\n        throw new BadRequestException('Este leilão ainda não começou.');\n      }\n${anchor}`);
  }

  const oldBroadcast = `    this.auctionGateway.publishAuctionChanged(auctionId, result.extended ? 'EXTENDED' : 'BID');\n    const detail = await this.detail(uid, auctionId);\n    return { ...detail, softCloseExtended: result.extended, softCloseSeconds: SOFT_CLOSE_SECONDS };`;
  const newBroadcast = `    const detail = await this.detail(uid, auctionId);\n    const snapshot = {\n      status: detail.status,\n      currentBid: detail.currentBid == null ? Number(detail.startPrice) : Number(detail.currentBid),\n      nextMinimum: Number(detail.nextMinimum),\n      bidCount: Number(detail.bidCount || 0),\n      startsAt: detail.startsAt,\n      endsAt: detail.endsAt,\n      finalAmount: detail.finalAmount == null ? null : Number(detail.finalAmount),\n      bids: Array.isArray(detail.bids) ? detail.bids.slice(0, 12).map((bid: any) => ({ id: bid.id, amount: Number(bid.amount), createdAt: bid.createdAt, bidderName: bid.bidderName })) : [],\n    };\n    this.auctionGateway.publishAuctionChanged(auctionId, result.extended ? 'EXTENDED' : 'BID', snapshot);\n    return { ...detail, softCloseExtended: result.extended, softCloseSeconds: SOFT_CLOSE_SECONDS };`;
  if (!source.includes(newBroadcast)) {
    if (!source.includes(oldBroadcast)) throw new Error('Auction bid broadcast anchor missing.');
    source = source.replace(oldBroadcast, newBroadcast);
  }

  if (!source.includes('quarentena de leilão') || !source.includes('body.startsAt') || !source.includes('clockStarted') || !source.includes('snapshot = {')) {
    throw new Error('Auction lifecycle patch incomplete.');
  }
  return source;
});

patch('backend/package.json', (input) => {
  const pkg = JSON.parse(input);
  const migration = 'node scripts/run-sql-migration.cjs migrations/20260826_classifieds_auction_aftercare.sql';
  if (!String(pkg.scripts['migrate:classifieds'] || '').includes('20260826_classifieds_auction_aftercare.sql')) {
    pkg.scripts['migrate:classifieds'] = `${pkg.scripts['migrate:classifieds']} && ${migration}`;
  }
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

console.log('Auction scheduling, realtime snapshots, history provider and 48-hour relist cooldown verified.');
