const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) { fs.writeFileSync(file, next); console.log(`updated ${file}`); }
}

patch('App.tsx', (input) => {
  let source = input;
  if (!source.includes('path="/classificados/gestao/leiloes/arena"')) {
    source = source.replace(
      '<Route path="/classificados/gestao/leiloes" element={<ClassifiedsWorkspacePage />} />',
      '<Route path="/classificados/gestao/leiloes" element={<ClassifiedsWorkspacePage />} />\n              <Route path="/classificados/gestao/leiloes/arena" element={<ClassifiedsWorkspacePage />} />',
    );
  }
  if (!source.includes('/classificados/gestao/leiloes/arena')) throw new Error('Authenticated auction arena route missing.');
  return source;
});

patch('pages/ClassifiedsWorkspacePage.tsx', (input) => {
  let source = input;
  if (!source.includes('isIntegratedAuctionArena')) {
    source = source.replace(
      "  const isIntegratedLiveAuction = location.pathname.startsWith('/classificados/gestao/leiloes/') && location.pathname.endsWith('/ao-vivo');",
      "  const isIntegratedAuctionArena = location.pathname === '/classificados/gestao/leiloes/arena';\n  const isIntegratedLiveAuction = location.pathname.startsWith('/classificados/gestao/leiloes/') && location.pathname.endsWith('/ao-vivo');",
    );
    source = source.replace(
      '  if (isIntegratedLiveAuction) page = <ClassifiedsAuctionsLivePageV2 embedded />;',
      '  if (isIntegratedAuctionArena || isIntegratedLiveAuction) page = <ClassifiedsAuctionsLivePageV2 embedded />;',
    );
  }
  if (!source.includes('isIntegratedAuctionArena || isIntegratedLiveAuction')) throw new Error('Integrated auction arena switch missing.');
  return source;
});

patch('pages/ClassifiedsAuctionManagementPage.tsx', (input) => {
  let source = input;
  if (!source.includes('Abrir arena / criar leilão')) {
    const from = `<header><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ad5c45]">Leilões · sua conta</p><h1 className="mt-1 font-serif text-3xl font-black">Disputas, arrematações e pós-venda</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">O leilão não desaparece quando o relógio zera. Acompanhe salas abertas, agendamentos, itens arrematados e a negociação depois do martelo.</p></header>`;
    const to = `<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ad5c45]">Leilões · sua conta</p><h1 className="mt-1 font-serif text-3xl font-black">Disputas, arrematações e pós-venda</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">O leilão não desaparece quando o relógio zera. Acompanhe salas abertas, agendamentos, itens arrematados e a negociação depois do martelo.</p></div><Link to="/classificados/gestao/leiloes/arena" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#3a222b] px-5 py-3 text-sm font-black text-white shadow-sm"><Gavel className="h-4 w-4" /> Abrir arena / criar leilão</Link></header>`;
    if (!source.includes(from)) throw new Error('Auction management header anchor missing.');
    source = source.replace(from, to);
  }
  return source;
});

console.log('Authenticated auction management keeps arena and Elite creation reachable.');
