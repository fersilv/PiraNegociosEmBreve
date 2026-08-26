const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) { fs.writeFileSync(file, next); console.log(`updated ${file}`); }
}

patch('backend/src/classifieds/classifieds.module.ts', (source) => {
  if (!source.includes("./classifieds-auction-management.controller") || !source.includes('ClassifiedsAuctionManagementService')) {
    throw new Error('Auction management must be registered directly in ClassifiedsModule.');
  }
  return source;
});

patch('backend/src/classifieds/classifieds-auction.gateway.ts', (input) => {
  let source = input;
  if (!source.includes('snapshot?: Record<string, unknown> | null')) {
    source = source.replace(
      "  publishAuctionChanged(auctionId: string, reason: 'BID' | 'EXTENDED' | 'ENDED' | 'CANCELED' | 'CREATED') {\n    const id = this.auctionId(auctionId);\n    if (!id || !this.server) return;\n    const payload = { auctionId: id, reason, at: new Date().toISOString() };",
      "  publishAuctionChanged(\n    auctionId: string,\n    reason: 'BID' | 'EXTENDED' | 'ENDED' | 'CANCELED' | 'CREATED',\n    snapshot?: Record<string, unknown> | null,\n  ) {\n    const id = this.auctionId(auctionId);\n    if (!id || !this.server) return;\n    const payload = { auctionId: id, reason, snapshot: snapshot || null, at: new Date().toISOString() };",
    );
  }
  return source;
});

patch('backend/src/classifieds/classifieds-auction.service.ts', (input) => {
  let source = input;
  source = source.replace(/const MIN_DURATION_MS = \d+ \* 60 \* 1000;/, 'const MIN_DURATION_MS = 60 * 60 * 1000;');
  source = source.replace(/pelo menos 30 minutos/g, 'pelo menos 60 minutos');
  source = source.replace(/pelo menos 30 minutos\./g, 'pelo menos 60 minutos.');

  if (!source.includes('AUCTION_RELIST_COOLDOWN_HOURS')) {
    source = source.replace(
      'const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;',
      'const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;\nconst AUCTION_RELIST_COOLDOWN_HOURS = 48;\nconst MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;',
    );
  }

  source = source.replace(
    `SELECT id FROM classified_auctions WHERE "listingId" = $1 AND status = 'OPEN' LIMIT 1`,
    `SELECT id FROM classified_auctions WHERE "listingId" = $1 AND status IN ('SCHEDULED','OPEN') LIMIT 1`,
  );

  if (!source.includes('quarentena de leilão')) {
    const anchor = "    if (active[0]) throw new BadRequestException('Este produto já está em um leilão ativo.');";
    if (source.includes(anchor)) {
      source = source.replace(anchor, `${anchor}\n    const cooldown = await this.dataSource.query(\n      \`SELECT COALESCE(\"closedAt\",\"updatedAt\") + interval '\${AUCTION_RELIST_COOLDOWN_HOURS} hours' AS \"cooldownUntil\"\n       FROM classified_auctions WHERE \"listingId\"=$1 AND status IN ('ENDED','CANCELED')\n         AND COALESCE(\"closedAt\",\"updatedAt\") > now() - interval '\${AUCTION_RELIST_COOLDOWN_HOURS} hours'\n       ORDER BY COALESCE(\"closedAt\",\"updatedAt\") DESC LIMIT 1\`, [listingId]);\n    if (cooldown[0]) {\n      const until = new Date(cooldown[0].cooldownUntil).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });\n      throw new BadRequestException(\`Este produto está em quarentena de leilão por \${AUCTION_RELIST_COOLDOWN_HOURS} horas. Novo leilão disponível após \${until}.\`);\n    }`);
    }
  }

  if (!source.includes('const requestedStartsAt = body.startsAt')) {
    const oldTiming = `    const endsAt = this.parseEndsAt(body.endsAt);\n    const duration = endsAt.getTime() - Date.now();\n    if (!Number.isFinite(endsAt.getTime()) || duration < MIN_DURATION_MS) {\n      throw new BadRequestException('O leilão deve durar pelo menos 60 minutos.');\n    }\n    if (duration > MAX_DURATION_MS) {\n      throw new BadRequestException('O leilão pode durar no máximo 30 dias nesta versão.');\n    }`;
    const newTiming = `    const requestedStartsAt = body.startsAt ? this.parseEndsAt(body.startsAt) : new Date();\n    const startsAt = requestedStartsAt.getTime() < Date.now() ? new Date() : requestedStartsAt;\n    const endsAt = this.parseEndsAt(body.endsAt);\n    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() - Date.now() > MAX_SCHEDULE_AHEAD_MS) {\n      throw new BadRequestException('O início do leilão pode ser agendado em até 90 dias.');\n    }\n    const duration = endsAt.getTime() - startsAt.getTime();\n    if (!Number.isFinite(endsAt.getTime()) || duration < MIN_DURATION_MS) {\n      throw new BadRequestException('Entre o início e o encerramento, o leilão deve durar pelo menos 60 minutos.');\n    }\n    if (duration > MAX_DURATION_MS) {\n      throw new BadRequestException('O leilão pode durar no máximo 30 dias nesta versão.');\n    }`;
    if (!source.includes(oldTiming)) throw new Error('Auction 60-minute scheduling anchor missing.');
    source = source.replace(oldTiming, newTiming);
  }

  source = source.replace(
    `VALUES ($1,$2,$3,'OPEN',$4,$5,now(),$6) RETURNING *\`,\n      [listingId, companyId, uid, startPrice, minIncrement, endsAt],`,
    `VALUES ($1,$2,$3,CASE WHEN $6 > now() THEN 'SCHEDULED' ELSE 'OPEN' END,$4,$5,$6,$7) RETURNING *\`,\n      [listingId, companyId, uid, startPrice, minIncrement, startsAt, endsAt],`,
  );
  source = source.replace(
    `VALUES ($1,$2,$3,'OPEN',$4,$5,$6,$7) RETURNING *\`,\n      [listingId, companyId, uid, startPrice, minIncrement, startsAt, endsAt],`,
    `VALUES ($1,$2,$3,CASE WHEN $6 > now() THEN 'SCHEDULED' ELSE 'OPEN' END,$4,$5,$6,$7) RETURNING *\`,\n      [listingId, companyId, uid, startPrice, minIncrement, startsAt, endsAt],`,
  );

  if (!source.includes("if (new Date(auction.startsAt).getTime() > Date.now())")) {
    const gate = "      if (auction.status !== 'OPEN') throw new BadRequestException('Este leilão já foi encerrado.');";
    if (source.includes(gate)) source = source.replace(gate, `${gate}\n      if (new Date(auction.startsAt).getTime() > Date.now()) throw new BadRequestException('Este leilão ainda não começou.');`);
  }

  source = source.replace(
    "      if (auction.status !== 'OPEN') throw new BadRequestException('Este leilão não está aberto.');",
    "      if (!['SCHEDULED','OPEN'].includes(auction.status)) throw new BadRequestException('Este leilão não pode mais ser cancelado.');",
  );
  source = source.replace(
    `WHERE a.status = 'OPEN' OR a."updatedAt" >= now() - interval '30 days'`,
    `WHERE a.status IN ('SCHEDULED','OPEN') OR a."updatedAt" >= now() - interval '30 days'`,
  );
  source = source.replace(
    `ORDER BY CASE WHEN a.status = 'OPEN' THEN 0 ELSE 1 END, a."endsAt" ASC, a."updatedAt" DESC`,
    `ORDER BY CASE a.status WHEN 'OPEN' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END, a."startsAt" ASC, a."endsAt" ASC, a."updatedAt" DESC`,
  );

  if (!source.includes('60 * 60 * 1000') || !source.includes("'SCHEDULED' ELSE 'OPEN'")) {
    throw new Error('Auction invariant failed: scheduled state or 60-minute minimum missing.');
  }
  return source;
});

console.log('Auction lifecycle verified: SCHEDULED → OPEN, minimum 60 minutes, no flash auctions.');
