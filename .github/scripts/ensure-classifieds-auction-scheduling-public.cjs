const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) { fs.writeFileSync(file, next); console.log(`updated ${file}`); }
}

patch('backend/src/classifieds/classifieds-auction-public.service.ts', (input) => {
  let source = input;
  source = source.replace(
    `      live: row.status === 'OPEN' && new Date(row.endsAt).getTime() > Date.now(),`,
    `      scheduled: row.status === 'OPEN' && new Date(row.startsAt).getTime() > Date.now(),\n      live: row.status === 'OPEN' && new Date(row.startsAt).getTime() <= Date.now() && new Date(row.endsAt).getTime() > Date.now(),`,
  );
  source = source.replace(
    '`SELECT a.id, a."listingId", a."startPrice", a."minIncrement", a."endsAt",',
    '`SELECT a.id, a."listingId", a."startPrice", a."minIncrement", a."startsAt", a."endsAt",',
  );
  if (!source.includes('startsAt: row.startsAt,\n      endsAt: row.endsAt,')) {
    source = source.replace('      bidCount: Number(row.bidCount || 0),\n      endsAt: row.endsAt,', '      bidCount: Number(row.bidCount || 0),\n      startsAt: row.startsAt,\n      endsAt: row.endsAt,');
  }
  if (!source.includes('scheduled: row.status')) throw new Error('Scheduled public auction state missing.');
  return source;
});

patch('lib/classifiedsAuctions.ts', (input) => {
  let source = input;
  if (!source.includes('scheduled?: boolean;')) {
    source = source.replace('  live: boolean;', '  live: boolean;\n  scheduled?: boolean;');
  }
  return source;
});

patch('pages/ClassifiedsAuctionsLivePageV2.tsx', (input) => {
  let source = input;
  if (!source.includes('const scheduledAuctions = useMemo')) {
    source = source.replace(
      `  const totalBids = liveAuctions.reduce((sum, auction) => sum + Number(auction.bidCount || 0), 0);`,
      `  const scheduledAuctions = useMemo(\n    () => auctions.filter((auction) => auction.scheduled || (auction.status === 'OPEN' && new Date(auction.startsAt).getTime() > now)),\n    [auctions, now],\n  );\n  const totalBids = liveAuctions.reduce((sum, auction) => sum + Number(auction.bidCount || 0), 0);`,
    );
  }
  source = source.replace(
    `          totalBids={totalBids}\n          canCreate={canCreate}`,
    `          totalBids={totalBids}\n          scheduled={scheduledAuctions}\n          canCreate={canCreate}`,
  );
  source = source.replace(
    `function AuctionLobby({ auctions, loading, now, totalBids, canCreate, onCreate, onOpen }: { auctions: PublicClassifiedAuction[]; loading: boolean; now: number; totalBids: number; canCreate: boolean; onCreate: () => void; onOpen: (id: string) => void }) {`,
    `function AuctionLobby({ auctions, loading, now, totalBids, scheduled, canCreate, onCreate, onOpen }: { auctions: PublicClassifiedAuction[]; loading: boolean; now: number; totalBids: number; scheduled: PublicClassifiedAuction[]; canCreate: boolean; onCreate: () => void; onOpen: (id: string) => void }) {`,
  );
  if (!source.includes('Próximos leilões')) {
    const anchor = `      {loading ? <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#ff7b57]" /></div> : auctions.length ? <>`;
    const replacement = `      {scheduled.length > 0 && <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8"><div className="mb-4"><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#ff8a68]">Agenda pública</p><h2 className="mt-1 font-serif text-3xl font-black">Próximos leilões</h2><p className="mt-2 text-xs leading-5 text-white/38">As páginas ficam públicas antes da abertura para divulgação, compartilhamento e indexação. Os lances só são liberados no horário marcado.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{scheduled.map((auction) => <button key={auction.id} onClick={() => onOpen(auction.id)} className="overflow-hidden rounded-[24px] border border-blue-300/15 bg-[#11141a] text-left"><AuctionImage auction={auction} /><div className="p-4"><span className="rounded-full bg-blue-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.12em] text-blue-200">Agendado</span><h3 className="mt-3 line-clamp-2 font-black">{auction.title}</h3><p className="mt-2 text-xs font-bold text-white/45">Começa em {new Date(auction.startsAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p><p className="mt-3 text-sm font-black text-[#ff9b79]">Lance inicial {money(auction.startPrice)}</p></div></button>)}</div></section>}\n\n${anchor}`;
    if (!source.includes(anchor)) throw new Error('Auction lobby scheduled section anchor missing.');
    source = source.replace(anchor, replacement);
  }
  if (!source.includes('const scheduled = new Date(auction.startsAt).getTime() > now;')) {
    source = source.replace(
      `  const remaining = Math.max(0, new Date(auction.endsAt).getTime() - now);\n  const ending = remaining <= SOFT_CLOSE_SECONDS * 1000;`,
      `  const startsIn = Math.max(0, new Date(auction.startsAt).getTime() - now);\n  const scheduled = new Date(auction.startsAt).getTime() > now;\n  const remaining = Math.max(0, new Date(auction.endsAt).getTime() - now);\n  const ending = !scheduled && remaining <= SOFT_CLOSE_SECONDS * 1000;`,
    );
  }
  if (!source.includes('Este leilão está agendado')) {
    const bidAnchor = `{!loggedIn ? <><div className="rounded-2xl border border-[#ff7049]/20`;
    const bidReplacement = `{scheduled ? <div className="rounded-2xl border border-blue-300/20 bg-blue-400/[.07] p-4"><p className="text-xs font-black text-blue-100">Este leilão está agendado</p><p className="mt-2 text-[10px] leading-5 text-white/45">Os lances abrem em {compactCountdown(startsIn)}. Início: {new Date(auction.startsAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</p></div> : !loggedIn ? <><div className="rounded-2xl border border-[#ff7049]/20`;
    if (!source.includes(bidAnchor)) throw new Error('Scheduled room bid gate anchor missing.');
    source = source.replace(bidAnchor, bidReplacement);
  }
  if (!source.includes('Próximos leilões') || !source.includes('Este leilão está agendado')) throw new Error('Scheduled auction public UI patch incomplete.');
  return source;
});

console.log('Scheduled auctions are public, indexable and distinct from live auctions.');
