const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const file = 'pages/ClassifiedsAuctionsLivePageV2.tsx';
let source = fs.readFileSync(file, 'utf8');

function replace(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Auction UI v3 missing ${label}`);
  source = source.replace(from, to);
}

replace(
  "type AuctionSocketUpdate = {\n  auctionId?: string;\n  reason?: 'BID' | 'EXTENDED' | 'ENDED' | 'CANCELED' | 'CREATED';\n  at?: string;\n};",
  "type AuctionSocketUpdate = {\n  auctionId?: string;\n  reason?: 'BID' | 'EXTENDED' | 'ENDED' | 'CANCELED' | 'CREATED';\n  snapshot?: Partial<PublicClassifiedAuction> | null;\n  at?: string;\n};",
  'socket snapshot type',
);
replace(
  'export default function ClassifiedsAuctionsLivePageV2() {',
  'export default function ClassifiedsAuctionsLivePageV2({ embedded = false }: { embedded?: boolean } = {}) {',
  'embedded component signature',
);
replace(
  "  const [createForm, setCreateForm] = useState({ listingId: '', startPrice: '', minIncrement: '5', endsAt: '' });",
  "  const [createForm, setCreateForm] = useState({ listingId: '', startPrice: '', minIncrement: '5', startsAt: '', endsAt: '' });",
  'scheduled auction form state',
);
replace(
  `  const loadDetail = async (id: string) => {\n    setDetailLoading(true);\n    try {\n      const row = await loadPublicAuctionDetail(id);\n      setDetail(row);\n      setBidAmount((current) => current || toInputMoney(row.nextMinimum));\n    } catch (requestError: any) {\n      setError(requestError?.response?.data?.message || 'Leilão não encontrado.');\n    } finally {\n      setDetailLoading(false);\n    }\n  };`,
  `  const loadDetail = async (id: string, silent = false) => {\n    if (!silent) setDetailLoading(true);\n    try {\n      const row = await loadPublicAuctionDetail(id);\n      setDetail(row);\n      setBidAmount((current) => current || toInputMoney(row.nextMinimum));\n    } catch (requestError: any) {\n      if (!silent) setError(requestError?.response?.data?.message || 'Leilão não encontrado.');\n    } finally {\n      if (!silent) setDetailLoading(false);\n    }\n  };`,
  'silent detail refresh',
);
replace(
  `    const refresh = (payload: AuctionSocketUpdate) => {\n      if (refreshTimer) window.clearTimeout(refreshTimer);\n      refreshTimer = window.setTimeout(() => {\n        invalidatePublicAuctions();`,
  `    const refresh = (payload: AuctionSocketUpdate) => {\n      if (auctionId && payload.auctionId === auctionId && payload.snapshot) {\n        setDetail((current) => current ? { ...current, ...payload.snapshot } : current);\n        if (payload.snapshot.nextMinimum != null) setBidAmount((current) => {\n          const parsed = parseMoneyInput(current);\n          const nextMinimum = Number(payload.snapshot?.nextMinimum || 0);\n          return !Number.isFinite(parsed) || parsed < nextMinimum ? toInputMoney(nextMinimum) : current;\n        });\n      }\n      if (refreshTimer) window.clearTimeout(refreshTimer);\n      refreshTimer = window.setTimeout(() => {\n        invalidatePublicAuctions();`,
  'instant socket snapshot application',
);
source = source.replace('if (auctionId && payload.auctionId === auctionId) void loadDetail(auctionId);', 'if (auctionId && payload.auctionId === auctionId) void loadDetail(auctionId, true);');
source = source.replace('if (!socketConnected) void loadDetail(auctionId);', 'if (!socketConnected) void loadDetail(auctionId, true);');
replace(
  '      <AuctionNavbar user={Boolean(user)} />',
  '      {!embedded && <AuctionNavbar user={Boolean(user)} />}',
  'embedded auction navbar',
);
replace(
  "      const endsAt = createForm.endsAt ? new Date(`${createForm.endsAt}:00-03:00`).toISOString() : '';\n      const response = await api.post('/classifieds/me/auctions', {",
  "      const startsAt = createForm.startsAt ? new Date(`${createForm.startsAt}:00-03:00`).toISOString() : '';\n      const endsAt = createForm.endsAt ? new Date(`${createForm.endsAt}:00-03:00`).toISOString() : '';\n      const response = await api.post('/classifieds/me/auctions', {",
  'scheduled auction create conversion',
);
replace(
  '        minIncrement: parseMoneyInput(createForm.minIncrement),\n        endsAt,',
  '        minIncrement: parseMoneyInput(createForm.minIncrement),\n        startsAt: startsAt || undefined,\n        endsAt,',
  'scheduled auction payload',
);
source = source.replace("setCreateForm({ listingId: '', startPrice: '', minIncrement: '5', endsAt: '' });", "setCreateForm({ listingId: '', startPrice: '', minIncrement: '5', startsAt: '', endsAt: '' });");
source = source.replaceAll(
  "form: { listingId: string; startPrice: string; minIncrement: string; endsAt: string }",
  "form: { listingId: string; startPrice: string; minIncrement: string; startsAt: string; endsAt: string }",
);
source = source.replaceAll(
  "React.SetStateAction<{ listingId: string; startPrice: string; minIncrement: string; endsAt: string }>",
  "React.SetStateAction<{ listingId: string; startPrice: string; minIncrement: string; startsAt: string; endsAt: string }>",
);
replace(
  'const formValid = Boolean(form.listingId && startValid && incrementValid && form.endsAt);',
  'const formValid = Boolean(form.listingId && startValid && incrementValid && form.endsAt);',
  'create form validity',
);
if (!source.includes('label="Começa em')) {
  replace(
    '<DarkField label="Encerra em"><input type="datetime-local" value={form.endsAt}',
    '<div className="grid gap-3 sm:grid-cols-2"><DarkField label="Começa em · opcional"><input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} className="auction-input" /><p className="mt-1 text-[9px] leading-4 text-white/30">Deixe vazio para começar imediatamente. Agendado, o leilão já ganha URL pública antes da abertura.</p></DarkField><DarkField label="Encerra em"><input type="datetime-local" value={form.endsAt}',
    'auction start field',
  );
  replace(
    'onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="auction-input" /></DarkField><div className="rounded-2xl border border-[#ff7049]/15',
    'onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="auction-input" /></DarkField></div><div className="rounded-2xl border border-[#ff7049]/15',
    'auction timing grid close',
  );
}

if (!source.includes('payload.snapshot') || !source.includes('loadDetail(auctionId, true)') || !source.includes('startsAt: startsAt || undefined')) {
  throw new Error('Auction UI v3 realtime/scheduling patch incomplete.');
}
fs.writeFileSync(file, source);
console.log('Auction UI v3 non-blocking realtime and scheduling verified.');
