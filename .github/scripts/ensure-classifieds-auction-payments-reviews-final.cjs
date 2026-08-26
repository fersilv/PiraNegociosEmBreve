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

patch('components/classifieds/ClassifiedsWorkspaceLayout.tsx', (input) => {
  let source = input;
  const sales = `    ...(business ? [{ to: '/classificados/vendas', label: 'Vendas', icon: <ShoppingCart className="h-5 w-5" /> }] : []),`;
  if (source.includes(sales) && !source.includes("to: '/classificados/recebimentos'")) {
    source = source.replace(sales, `${sales}\n    ...(business ? [{ to: '/classificados/recebimentos', label: 'Recebimentos', icon: <BadgeDollarSign className="h-5 w-5" /> }] : []),`);
  }
  const settings = `    { to: '/classificados/configuracoes', label: 'Configurações', icon: <Settings2 className="h-5 w-5" /> },`;
  if (source.includes(settings) && !source.includes("to: '/classificados/avaliacoes'")) {
    source = source.replace(settings, `    { to: '/classificados/avaliacoes', label: 'Avaliações', icon: <BadgeCheck className="h-5 w-5" /> },\n${settings}`);
  }
  return source;
});

patch('pages/ClassifiedsSalesPage.tsx', (input) => {
  let source = input;
  if (!source.includes('/classificados/recebimentos')) {
    const anchor = `      {(error || notice) &&`;
    if (source.includes(anchor)) {
      source = source.replace(anchor, `      <div className="flex flex-wrap gap-2"><Link to="/classificados/recebimentos" className="inline-flex rounded-full bg-white px-3 py-2 text-xs font-black text-[#397c75] ring-1 ring-stone-200">Formas de recebimento</Link><Link to="/classificados/avaliacoes" className="inline-flex rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 ring-1 ring-stone-200">Avaliações de compras</Link></div>\n\n${anchor}`);
    }
  }
  return source;
});

patch('pages/ClassifiedsAuctionsLivePageV2.tsx', (input) => {
  let source = input;

  if (!source.includes('type AuctionCreateForm =')) {
    const anchor = `const emptySeller: SellerState = { context: null, limits: null, listings: [] };`;
    const type = `type AuctionCreateForm = {\n  listingId: string;\n  startPrice: string;\n  minIncrement: string;\n  startsAt: string;\n  endsAt: string;\n  onlinePaymentEnabled: boolean;\n  auctionFeePayer: 'SELLER' | 'BUYER';\n  paymentMethods: Array<'PIX' | 'CARD'>;\n  cardMaxInstallments: number;\n  fulfillmentModes: Array<'ARRANGE' | 'PICKUP' | 'DELIVERY'>;\n  deliveryFee: string;\n  deliveryNote: string;\n};\n\nconst emptyAuctionForm: AuctionCreateForm = {\n  listingId: '', startPrice: '', minIncrement: '5', startsAt: '', endsAt: '',\n  onlinePaymentEnabled: false, auctionFeePayer: 'SELLER', paymentMethods: ['PIX', 'CARD'],\n  cardMaxInstallments: 12, fulfillmentModes: ['ARRANGE', 'PICKUP'], deliveryFee: '', deliveryNote: '',\n};\n`;
    if (source.includes(anchor)) source = source.replace(anchor, `${anchor}\n${type}`);
  }

  source = source.replace(
    `  const [createForm, setCreateForm] = useState({ listingId: '', startPrice: '', minIncrement: '5', startsAt: '', endsAt: '' });`,
    `  const [createForm, setCreateForm] = useState<AuctionCreateForm>({ ...emptyAuctionForm });\n  const [auctionPaymentDefaults, setAuctionPaymentDefaults] = useState<any>(null);`,
  );

  if (!source.includes("api.get('/classifieds/auctions/payment-defaults')")) {
    const anchor = `  const eligibleListings = seller.listings.filter(`;
    if (source.includes(anchor)) {
      const effect = `  useEffect(() => {\n    if (!createOpen || !canCreate) return;\n    let active = true;\n    api.get('/classifieds/auctions/payment-defaults').then((response) => {\n      if (!active) return;\n      const defaults = response.data || {};\n      setAuctionPaymentDefaults(defaults);\n      setCreateForm((current) => ({\n        ...current,\n        auctionFeePayer: defaults.auctionFeePayer === 'BUYER' ? 'BUYER' : 'SELLER',\n        paymentMethods: Array.isArray(defaults.paymentMethods) && defaults.paymentMethods.length ? defaults.paymentMethods : current.paymentMethods,\n        cardMaxInstallments: Number(defaults.cardMaxInstallments || current.cardMaxInstallments),\n        fulfillmentModes: Array.isArray(defaults.fulfillmentModes) && defaults.fulfillmentModes.length ? defaults.fulfillmentModes : current.fulfillmentModes,\n      }));\n    }).catch(() => setAuctionPaymentDefaults(null));\n    return () => { active = false; };\n  }, [createOpen, canCreate]);\n\n`;
      source = source.replace(anchor, `${effect}${anchor}`);
    }
  }

  if (!source.includes('seller-settlement\`, {')) {
    const anchor = `      const response = await api.post('/classifieds/me/auctions', {`;
    const after = `      const response = await api.post('/classifieds/me/auctions', {`;
    if (source.includes(anchor)) source = source.replace(anchor, after);
    const completedPost = `      invalidatePublicAuctions();`;
    if (source.includes(completedPost)) {
      source = source.replace(completedPost, `      const createdAuctionId = String(response.data?.id || '');\n      if (createdAuctionId && createForm.onlinePaymentEnabled) {\n        const parsedDelivery = parseMoneyInput(createForm.deliveryFee);\n        await api.patch(\`/classifieds/auctions/\${createdAuctionId}/seller-settlement\`, {\n          onlinePaymentEnabled: true,\n          auctionFeePayer: createForm.auctionFeePayer,\n          paymentMethods: createForm.paymentMethods,\n          cardMaxInstallments: createForm.cardMaxInstallments,\n          fulfillmentModes: createForm.fulfillmentModes,\n          deliveryFeeCents: Number.isFinite(parsedDelivery) ? Math.max(0, Math.round(parsedDelivery * 100)) : 0,\n          deliveryNote: createForm.deliveryNote || null,\n        });\n      }\n      invalidatePublicAuctions();`);
    }
  }

  source = source.replaceAll(
    `setCreateForm({ listingId: '', startPrice: '', minIncrement: '5', startsAt: '', endsAt: '' });`,
    `setCreateForm({ ...emptyAuctionForm });`,
  );
  source = source.replaceAll(
    `form: { listingId: string; startPrice: string; minIncrement: string; startsAt: string; endsAt: string }`,
    `form: AuctionCreateForm`,
  );
  source = source.replaceAll(
    `React.SetStateAction<{ listingId: string; startPrice: string; minIncrement: string; startsAt: string; endsAt: string }>`,
    `React.SetStateAction<AuctionCreateForm>`,
  );

  if (!source.includes('feeRule={auctionPaymentDefaults?.feeRule}')) {
    source = source.replace(
      `            creating={creating}\n            onCreate={() => void createAuction()}`,
      `            creating={creating}\n            feeRule={auctionPaymentDefaults?.feeRule || null}\n            paymentConnected={auctionPaymentDefaults?.mercadoPagoConnected === true}\n            companyAddress={auctionPaymentDefaults?.companyAddress || ''}\n            onCreate={() => void createAuction()}`,
    );
  }

  source = source.replace(
    `function CreateAuctionPanel({ listings, form, setForm, creating, onCreate, onClose }: { listings: ClassifiedListing[]; form: AuctionCreateForm; setForm: React.Dispatch<React.SetStateAction<AuctionCreateForm>>; creating: boolean; onCreate: () => void; onClose: () => void })`,
    `function CreateAuctionPanel({ listings, form, setForm, creating, feeRule, paymentConnected, companyAddress, onCreate, onClose }: { listings: ClassifiedListing[]; form: AuctionCreateForm; setForm: React.Dispatch<React.SetStateAction<AuctionCreateForm>>; creating: boolean; feeRule?: any; paymentConnected?: boolean; companyAddress?: string; onCreate: () => void; onClose: () => void })`,
  );

  if (!source.includes('<AuctionPaymentOptions form={form}')) {
    const anti = `<div className="rounded-2xl border border-[#ff7049]/15 bg-[#ff633c]/[.06] p-3 text-[10px] leading-5 text-[#ffb099]"><Bolt className="mr-1 inline h-3.5 w-3.5" /> Anti-sniping automático:`;
    if (source.includes(anti)) source = source.replace(anti, `<AuctionPaymentOptions form={form} setForm={setForm} feeRule={feeRule} paymentConnected={paymentConnected} companyAddress={companyAddress} />${anti}`);
  }

  if (!source.includes('function AuctionPaymentOptions(')) {
    const anchor = `function ModalShell({ children, onClose }`;
    const component = `function AuctionPaymentOptions({ form, setForm, feeRule, paymentConnected, companyAddress }: { form: AuctionCreateForm; setForm: React.Dispatch<React.SetStateAction<AuctionCreateForm>>; feeRule?: any; paymentConnected?: boolean; companyAddress?: string }) {\n  const pct = feeRule?.percentage == null ? null : Number(feeRule.percentage);\n  const toggleMethod = (method: 'PIX' | 'CARD') => setForm((current) => { const has = current.paymentMethods.includes(method); const next = has ? current.paymentMethods.filter((item) => item !== method) : [...current.paymentMethods, method]; return { ...current, paymentMethods: next.length ? next : current.paymentMethods }; });\n  const toggleFulfillment = (mode: 'ARRANGE' | 'PICKUP' | 'DELIVERY') => setForm((current) => { const has = current.fulfillmentModes.includes(mode); const next = has ? current.fulfillmentModes.filter((item) => item !== mode) : [...current.fulfillmentModes, mode]; return { ...current, fulfillmentModes: next.length ? next : current.fulfillmentModes }; });\n  return <div className="rounded-2xl border border-blue-300/15 bg-blue-400/[.06] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black text-blue-100">Recebimento online</p><p className="mt-1 text-[9px] leading-4 text-white/35">Opcional. A cobrança vai para a conta Mercado Pago conectada da empresa.</p></div><button type="button" role="switch" aria-checked={form.onlinePaymentEnabled} onClick={() => setForm((current) => ({ ...current, onlinePaymentEnabled: !current.onlinePaymentEnabled }))} className={\`relative h-7 w-12 shrink-0 rounded-full \${form.onlinePaymentEnabled ? 'bg-blue-500' : 'bg-white/15'}\`}><span className={\`absolute top-1 h-5 w-5 rounded-full bg-white transition-all \${form.onlinePaymentEnabled ? 'left-6' : 'left-1'}\`} /></button></div>{form.onlinePaymentEnabled && <div className="mt-4 space-y-4">{!paymentConnected && <p className="rounded-xl bg-amber-300/10 px-3 py-2 text-[9px] leading-4 text-amber-100">Conecte o Mercado Pago em Formas de recebimento antes de publicar o pagamento online.</p>}<div><p className="text-[9px] font-black uppercase tracking-[.12em] text-white/35">Taxa de leilão {pct == null ? '' : `· \${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setForm((current) => ({ ...current, auctionFeePayer: 'SELLER' }))} className={\`rounded-xl border p-3 text-left text-[10px] \${form.auctionFeePayer === 'SELLER' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-white/10 text-white/45'}\`}><strong className="block">Empresa absorve</strong><span className="mt-1 block leading-4">O arrematante não paga a taxa PiraNegócios.</span></button><button type="button" onClick={() => setForm((current) => ({ ...current, auctionFeePayer: 'BUYER' }))} className={\`rounded-xl border p-3 text-left text-[10px] \${form.auctionFeePayer === 'BUYER' ? 'border-[#ff8b69]/35 bg-[#ff633c]/10 text-[#ffb199]' : 'border-white/10 text-white/45'}\`}><strong className="block">Repassar ao arrematante</strong><span className="mt-1 block leading-4">O leilão exibe “arremate + taxa{pct == null ? '' : ` de \${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}”.</span></button></div></div><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-white/35">Meios de pagamento</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => toggleMethod('PIX')} className={\`rounded-full px-3 py-2 text-[9px] font-black \${form.paymentMethods.includes('PIX') ? 'bg-white text-[#21130f]' : 'bg-white/8 text-white/35'}\`}>Pix</button><button type="button" onClick={() => toggleMethod('CARD')} className={\`rounded-full px-3 py-2 text-[9px] font-black \${form.paymentMethods.includes('CARD') ? 'bg-white text-[#21130f]' : 'bg-white/8 text-white/35'}\`}>Cartão</button>{form.paymentMethods.includes('CARD') && <select value={form.cardMaxInstallments} onChange={(event) => setForm((current) => ({ ...current, cardMaxInstallments: Number(event.target.value) }))} className="rounded-full bg-white px-3 py-2 text-[9px] font-black text-[#21130f]">{Array.from({ length: 24 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>até {value}x</option>)}</select>}</div></div><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-white/35">Retirada e entrega</p><div className="mt-2 flex flex-wrap gap-2">{([['PICKUP','Retirada'],['DELIVERY','Entrega'],['ARRANGE','A combinar']] as const).map(([mode,label]) => <button key={mode} type="button" onClick={() => toggleFulfillment(mode)} className={\`rounded-full px-3 py-2 text-[9px] font-black \${form.fulfillmentModes.includes(mode) ? 'bg-white text-[#21130f]' : 'bg-white/8 text-white/35'}\`}>{label}</button>)}</div>{form.fulfillmentModes.includes('PICKUP') && <p className="mt-2 text-[9px] leading-4 text-white/35">Retirada em: <strong className="text-white/60">{companyAddress || 'endereço cadastrado da empresa'}</strong>.</p>}{form.fulfillmentModes.includes('DELIVERY') && <div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={form.deliveryFee} onChange={(event) => setForm((current) => ({ ...current, deliveryFee: event.target.value }))} inputMode="decimal" placeholder="Frete fixo opcional, ex. 15,00" className="auction-input" /><input value={form.deliveryNote} onChange={(event) => setForm((current) => ({ ...current, deliveryNote: event.target.value }))} placeholder="Regra/observação de entrega" className="auction-input" /></div>}</div></div>}</div>;\n}\n\n`;
    if (source.includes(anchor)) source = source.replace(anchor, `${component}${anchor}`);
  }

  source = source.replace(
    `  const remaining = Math.max(0, new Date(auction.endsAt).getTime() - now);\n  const ending = remaining <= SOFT_CLOSE_SECONDS * 1000;\n  const ended = auction.status !== 'OPEN' || remaining <= 0;`,
    `  const startsIn = Math.max(0, new Date(auction.startsAt).getTime() - now);\n  const scheduled = auction.status === 'SCHEDULED' || new Date(auction.startsAt).getTime() > now;\n  const remaining = Math.max(0, new Date(auction.endsAt).getTime() - now);\n  const ending = !scheduled && remaining <= SOFT_CLOSE_SECONDS * 1000;\n  const ended = !scheduled && (auction.status === 'ENDED' || auction.status === 'CANCELED' || remaining <= 0);`,
  );
  source = source.replace(`{ended ? 'Encerrado' : 'Tempo restante'}`, `{scheduled ? 'Começa em' : ended ? 'Encerrado' : 'Tempo restante'}`);
  source = source.replace(`splitCountdown(remaining)`, `splitCountdown(scheduled ? startsIn : remaining)`);

  if (!source.includes('<AuctionFeeNotice auction={auction} />')) {
    const anchor = `<div className="mt-4 grid grid-cols-2 gap-2"><InfoBox label="Incremento mínimo" value={money(auction.minIncrement)} /><InfoBox label="Próximo mínimo" value={money(auction.nextMinimum)} /></div>`;
    if (source.includes(anchor)) source = source.replace(anchor, `${anchor}<AuctionFeeNotice auction={auction} />`);
  }

  source = source.replace(
    `<div id="auction-bid-box" className="border-t border-white/[.07] p-5 sm:p-6">{ended ?`,
    `<div id="auction-bid-box" className="border-t border-white/[.07] p-5 sm:p-6">{scheduled ? <div><div className="rounded-2xl border border-blue-300/20 bg-blue-400/[.07] p-4"><p className="text-xs font-black text-blue-100">Este leilão está agendado</p><p className="mt-2 text-[10px] leading-5 text-white/45">Os lances abrem em {compactCountdown(startsIn)}. Duração mínima: 60 minutos.</p></div><AuctionReminderButton auction={auction} loggedIn={loggedIn} /></div> : ended ?`,
  );

  if (!source.includes('<AuctionPresencePing auction={auction}')) {
    source = source.replace(`<main className="min-h-[calc(100vh-70px)] bg-[#090605]">`, `<main className="min-h-[calc(100vh-70px)] bg-[#090605]"><AuctionPresencePing auction={auction} loggedIn={loggedIn} />`);
  }

  if (!source.includes('function AuctionFeeNotice(')) {
    const anchor = `function MiniStat({ label, value }`;
    const helpers = `function AuctionFeeNotice({ auction }: { auction: PublicClassifiedAuction }) {\n  if (!auction.onlinePaymentEnabled) return null;\n  const settlement = auction.settlement;\n  const buyerPays = (settlement?.auctionFeePayer || auction.auctionFeePayer) === 'BUYER';\n  const percentage = settlement?.auctionFeePercentage ?? auction.auctionFeePercentage;\n  return <div className={\`mt-3 rounded-xl border px-3 py-2 text-[9px] leading-4 \${buyerPays ? 'border-amber-300/20 bg-amber-300/[.07] text-amber-100' : 'border-emerald-300/15 bg-emerald-300/[.05] text-emerald-100'}\`}>{buyerPays ? <><strong>Arremate + taxa de leilão{percentage == null ? '' : ` de \${Number(percentage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}.</strong> A taxa é exibida antes do lance e no fechamento. Eventual entrega é separada.</> : <><strong>Sem taxa de leilão adicional para o arrematante.</strong> A empresa absorve a comissão PiraNegócios.</>}{settlement?.pickupAddress && <span className="mt-1 block text-white/50">Retirada: {settlement.pickupAddress}</span>}</div>;\n}\n\nfunction AuctionReminderButton({ auction, loggedIn }: { auction: PublicClassifiedAuction; loggedIn: boolean }) {\n  const [enabled, setEnabled] = useState(false);\n  const [working, setWorking] = useState(false);\n  useEffect(() => { if (!loggedIn || !(auction.scheduled || auction.status === 'SCHEDULED')) return; let active = true; api.get(\`/classifieds/auctions/\${auction.id}/reminder\`).then((response) => active && setEnabled(response.data?.enabled === true)).catch(() => undefined); return () => { active = false; }; }, [auction.id, auction.status, auction.scheduled, loggedIn]);\n  if (!loggedIn) return <Link to={\`/login?returnTo=\${encodeURIComponent(`/classificados/leiloes/\${auction.id}`)}\`} className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-4 py-3 text-xs font-black text-[#21130f]">Entrar para ativar lembrete</Link>;\n  return <button type="button" disabled={working} onClick={async () => { setWorking(true); try { const response = await api.post(\`/classifieds/auctions/\${auction.id}/reminder\`, { enabled: !enabled }); setEnabled(response.data?.enabled === true); } finally { setWorking(false); } }} className={\`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black \${enabled ? 'bg-blue-500 text-white' : 'bg-white text-[#21130f]'}\`}><Clock3 className="h-4 w-4" /> {working ? 'Salvando...' : enabled ? 'Lembrete ativado' : 'Me lembre'}</button>;\n}\n\nfunction AuctionPresencePing({ auction, loggedIn }: { auction: PublicClassifiedAuction; loggedIn: boolean }) {\n  useEffect(() => { if (!loggedIn || auction.status !== 'OPEN') return; void api.post(\`/classifieds/auctions/\${auction.id}/presence\`).catch(() => undefined); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void api.post(\`/classifieds/auctions/\${auction.id}/presence\`).catch(() => undefined); }, 60_000); return () => window.clearInterval(timer); }, [auction.id, auction.status, loggedIn]);\n  return null;\n}\n\n`;
    if (source.includes(anchor)) source = source.replace(anchor, `${helpers}${anchor}`);
  }

  source = source.replace(`<AuctionLobby\n          auctions={liveAuctions}`, `<AuctionLobby\n          auctions={auctions}`);
  if (!source.includes('const scheduledAuctions = auctions.filter')) {
    source = source.replace(
      `  const featured = auctions[0] || null;`,
      `  const liveLobbyAuctions = auctions.filter((auction) => auction.live);\n  const scheduledAuctions = auctions.filter((auction) => auction.scheduled || auction.status === 'SCHEDULED');\n  const featured = liveLobbyAuctions[0] || null;`,
    );
  }
  source = source.replace(`value={String(auctions.length)} label="ao vivo"`, `value={String(liveLobbyAuctions.length)} label="ao vivo"`);
  source = source.replace(`: auctions.length ? <>`, `: (liveLobbyAuctions.length || scheduledAuctions.length) ? <>`);
  source = source.replace(`{auctions.map((auction) => <AuctionCard`, `{liveLobbyAuctions.map((auction) => <AuctionCard`);
  if (!source.includes('Agenda pública</p><h2')) {
    const anchor = `{featured && <section className="mx-auto max-w-7xl px-4 py-8`;
    const scheduled = `{scheduledAuctions.length > 0 && <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-4"><p className="text-[9px] font-black uppercase tracking-[.18em] text-blue-300">Agenda pública</p><h2 className="mt-1 font-serif text-3xl font-black">Próximos leilões</h2><p className="mt-2 text-xs leading-5 text-white/38">Ative “Me lembre” na sala para receber os avisos antes da abertura.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{scheduledAuctions.map((auction) => <button key={auction.id} onClick={() => onOpen(auction.id)} className="overflow-hidden rounded-[24px] border border-blue-300/15 bg-[#11141a] text-left"><div className="aspect-[1.35/1] overflow-hidden bg-black/20">{auction.image ? <img src={auction.image} alt={auction.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-10 w-10 text-white/15" /></div>}</div><div className="p-4"><span className="rounded-full bg-blue-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.12em] text-blue-200">Agendado</span><h3 className="mt-3 line-clamp-2 font-black">{auction.title}</h3><p className="mt-2 text-xs font-bold text-white/45">{new Date(auction.startsAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p><p className="mt-3 text-sm font-black text-[#ff9b79]">Lance inicial {money(auction.startPrice)}</p>{auction.onlinePaymentEnabled && auction.auctionFeePayer === 'BUYER' && <p className="mt-1 text-[9px] text-amber-200/70">+ taxa de leilão{auction.auctionFeePercentage == null ? '' : ` de \${Number(auction.auctionFeePercentage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</p>}</div></button>)}</div></section>}\n        `;
    if (source.includes(anchor)) source = source.replace(anchor, `${scheduled}${anchor}`);
  }

  return source;
});

console.log('Classifieds final auction payments, reminders, receipt navigation and review navigation verified.');
