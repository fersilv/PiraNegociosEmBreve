import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Gavel, Loader2, MessageCircle, Plus, Trophy, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { api } from '../lib/api';
import type { ClassifiedListing } from '../types/classifieds';

type Auction = {
  id: string;
  listingId: string;
  companyId: string;
  status: 'OPEN' | 'ENDED' | 'CANCELED';
  title: string;
  slug: string;
  description?: string;
  city?: string;
  state?: string;
  companyName: string;
  companyLogo?: string | null;
  image?: string | null;
  startPrice: string | number;
  minIncrement: string | number;
  currentBid?: string | number | null;
  finalAmount?: string | number | null;
  nextMinimum: string | number;
  bidCount: number;
  endsAt: string;
  owned: boolean;
  leading: boolean;
  won: boolean;
  winnerUserId?: string | null;
  winningBidId?: string | null;
  bids?: Array<{ id: string; amount: string | number; createdAt: string; mine: boolean; bidderName: string }>;
  settlement?: { mode: 'DIRECT'; protectedPayment: false; message: string };
};

export default function ClassifiedsAuctionsPage() {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { data } = useClassifiedsWorkspace();
  const business = data?.activeIdentity === 'COMPANY';
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [detail, setDetail] = useState<Auction | null>(null);
  const [products, setProducts] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [form, setForm] = useState({ listingId: '', startPrice: '', minIncrement: '10', endsAt: '' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const requests: Promise<any>[] = [api.get('/classifieds/auctions')];
      if (business) requests.push(api.get('/classifieds/me/listings'));
      const responses = await Promise.all(requests);
      const list = Array.isArray(responses[0].data) ? responses[0].data as Auction[] : [];
      setAuctions(list);
      if (business) {
        const mine = Array.isArray(responses[1]?.data) ? responses[1].data as ClassifiedListing[] : [];
        setProducts(mine.filter((item) => item.listingType !== 'SERVICE' && item.status === 'PUBLISHED'));
      }
      if (auctionId) {
        const response = await api.get(`/classifieds/auctions/${auctionId}`);
        setDetail(response.data as Auction);
        setBidAmount(String(response.data?.nextMinimum || ''));
      } else setDetail(null);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os leilões.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [auctionId, data?.activeIdentity, data?.company?.id]);

  const active = useMemo(() => auctions.filter((item) => item.status === 'OPEN'), [auctions]);
  const mine = useMemo(() => auctions.filter((item) => item.owned), [auctions]);

  const createAuction = async () => {
    if (working) return;
    setWorking(true); setError('');
    try {
      const response = await api.post('/classifieds/me/auctions', form);
      setCreateOpen(false);
      setForm({ listingId: '', startPrice: '', minIncrement: '10', endsAt: '' });
      navigate(`/classificados/leiloes/${response.data.id}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível criar o leilão.');
    } finally { setWorking(false); }
  };

  const bid = async () => {
    if (!detail || working) return;
    setWorking(true); setError('');
    try {
      const response = await api.post(`/classifieds/auctions/${detail.id}/bids`, { amount: bidAmount });
      setDetail(response.data as Auction);
      setBidAmount(String(response.data?.nextMinimum || ''));
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível registrar o lance.');
    } finally { setWorking(false); }
  };

  const cancel = async () => {
    if (!detail || working) return;
    setWorking(true); setError('');
    try {
      await api.post(`/classifieds/me/auctions/${detail.id}/cancel`);
      navigate('/classificados/leiloes');
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível cancelar o leilão.');
    } finally { setWorking(false); }
  };

  const openConversation = async () => {
    if (!detail || working) return;
    setWorking(true); setError('');
    try {
      const response = await api.post(`/classifieds/listings/${detail.listingId}/conversations`);
      if (response.data?.id) navigate(`/classificados/conversas/${response.data.id}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível abrir a negociação.');
    } finally { setWorking(false); }
  };

  if (loading) return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-700">Disputa por tempo</p><h1 className="mt-1 font-serif text-3xl font-black">Leilões</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Lances acontecem dentro do PiraNegócios. Nesta primeira versão, pagamento e entrega são combinados diretamente entre vencedor e anunciante.</p></div>
        {business && <button onClick={() => setCreateOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0d4542] px-5 text-sm font-black text-white"><Plus className="h-4 w-4" /> Criar leilão</button>}
      </header>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Pagamento protegido ainda não está ativo.</strong> Vencer um leilão registra o compromisso e abre a negociação, mas o PiraNegócios não retém nem libera dinheiro nesta versão.</div>
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {detail ? (
        <AuctionDetail auction={detail} bidAmount={bidAmount} setBidAmount={setBidAmount} working={working} onBid={bid} onCancel={cancel} onConversation={openConversation} onBack={() => navigate('/classificados/leiloes')} />
      ) : (
        <>
          <section><div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-2xl font-black">Acontecendo agora</h2><span className="text-xs font-bold text-stone-400">{active.length} ativos</span></div>{active.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{active.map((auction) => <AuctionCard key={auction.id} auction={auction} onOpen={() => navigate(`/classificados/leiloes/${auction.id}`)} />)}</div> : <Empty text="Nenhum leilão aberto neste momento." />}</section>
          {business && <section><div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-2xl font-black">Leilões da empresa</h2><span className="text-xs font-bold text-stone-400">{mine.length}</span></div>{mine.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{mine.map((auction) => <AuctionCard key={auction.id} auction={auction} onOpen={() => navigate(`/classificados/leiloes/${auction.id}`)} />)}</div> : <Empty text="A empresa ainda não criou nenhum leilão." />}</section>}
        </>
      )}

      {createOpen && business && <CreateAuctionModal products={products} form={form} setForm={setForm} working={working} onCreate={createAuction} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function AuctionCard({ auction, onOpen }: { auction: Auction; onOpen: () => void }) {
  const value = auction.status === 'ENDED' ? auction.finalAmount : auction.currentBid ?? auction.startPrice;
  return <button onClick={onOpen} className="overflow-hidden rounded-[24px] bg-white text-left shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="aspect-[16/10] bg-stone-100">{auction.image ? <img src={auction.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Gavel className="h-9 w-9 text-stone-300" /></div>}</div><div className="p-4"><div className="flex items-center justify-between gap-2"><Status status={auction.status} /><span className="text-[10px] font-bold text-stone-400">{auction.bidCount} {auction.bidCount === 1 ? 'lance' : 'lances'}</span></div><h3 className="mt-3 line-clamp-2 text-base font-black text-stone-900">{auction.title}</h3><p className="mt-2 text-xl font-black text-stone-900">{money(value)}</p><p className="mt-1 text-xs text-stone-500">{auction.status === 'OPEN' ? auction.currentBid ? 'Maior lance atual' : 'Lance inicial' : auction.finalAmount ? 'Valor final' : 'Sem vencedor'}</p>{auction.status === 'OPEN' && <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-amber-700"><Clock3 className="h-3.5 w-3.5" /> {timeLeft(auction.endsAt)}</p>}{auction.leading && auction.status === 'OPEN' && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Você está liderando 🏁</p>}{auction.won && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">Você venceu este leilão 🏆</p>}</div></button>;
}

function AuctionDetail({ auction, bidAmount, setBidAmount, working, onBid, onCancel, onConversation, onBack }: { auction: Auction; bidAmount: string; setBidAmount: (value: string) => void; working: boolean; onBid: () => void; onCancel: () => void; onConversation: () => void; onBack: () => void }) {
  const current = auction.currentBid ?? auction.startPrice;
  return <div><button onClick={onBack} className="mb-4 rounded-xl bg-white px-4 py-2 text-xs font-black text-stone-600 ring-1 ring-stone-200">← Todos os leilões</button><div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]"><section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-stone-200"><div className="aspect-[16/10] bg-stone-100">{auction.image ? <img src={auction.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Gavel className="h-12 w-12 text-stone-300" /></div>}</div><div className="p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2"><Status status={auction.status} /><span className="text-xs font-bold text-stone-400">{auction.companyName}</span></div><h2 className="mt-3 font-serif text-3xl font-black">{auction.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">{auction.description}</p><p className="mt-4 text-xs font-bold text-stone-400">{auction.city} - {auction.state}</p></div></section><aside className="space-y-4"><div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-stone-200"><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">{auction.status === 'OPEN' ? auction.currentBid ? 'Maior lance' : 'Lance inicial' : 'Resultado'}</p><p className="mt-2 text-3xl font-black">{money(auction.status === 'ENDED' ? auction.finalAmount : current)}</p>{auction.status === 'OPEN' && <><p className="mt-2 flex items-center gap-1.5 text-xs font-black text-amber-700"><Clock3 className="h-4 w-4" /> {timeLeft(auction.endsAt)}</p><p className="mt-1 text-xs text-stone-400">Incremento mínimo: {money(auction.minIncrement)}</p></>}{auction.leading && auction.status === 'OPEN' && <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-xs font-black text-emerald-700">Seu lance está na frente.</div>}{!auction.owned && auction.status === 'OPEN' && <div className="mt-5"><label className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Seu lance</label><div className="mt-2 flex gap-2"><input type="number" min={Number(auction.nextMinimum)} step="0.01" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-black outline-none focus:border-stone-400" /><button disabled={working} onClick={onBid} className="rounded-2xl bg-stone-900 px-5 text-sm font-black text-white disabled:opacity-50">Dar lance</button></div><p className="mt-2 text-[10px] text-stone-400">Próximo lance mínimo: {money(auction.nextMinimum)}</p></div>}{auction.owned && auction.status === 'OPEN' && auction.bidCount === 0 && <button disabled={working} onClick={onCancel} className="mt-5 w-full rounded-2xl bg-red-50 px-4 py-3 text-xs font-black text-red-700 disabled:opacity-50">Cancelar leilão</button>}{auction.status === 'ENDED' && auction.won && <button disabled={working} onClick={onConversation} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-4 py-3 text-sm font-black text-white"><MessageCircle className="h-4 w-4" /> Abrir negociação</button>}{auction.status === 'ENDED' && auction.owned && auction.winnerUserId && <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900"><Trophy className="mb-2 h-5 w-5" />O leilão teve vencedor. O pagamento e a entrega devem ser combinados diretamente nesta versão.</div>}</div><div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-stone-200"><h3 className="text-sm font-black">Histórico de lances</h3><div className="mt-3 space-y-2">{auction.bids?.length ? auction.bids.map((bid, index) => <div key={bid.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${index === 0 ? 'bg-amber-50' : 'bg-stone-50'}`}><span className="font-bold text-stone-600">{bid.mine ? 'Você' : bid.bidderName}</span><span className="font-black">{money(bid.amount)}</span></div>) : <p className="py-5 text-center text-xs text-stone-400">Ainda não há lances.</p>}</div></div></aside></div></div>;
}

function CreateAuctionModal({ products, form, setForm, working, onCreate, onClose }: { products: ClassifiedListing[]; form: { listingId: string; startPrice: string; minIncrement: string; endsAt: string }; setForm: React.Dispatch<React.SetStateAction<{ listingId: string; startPrice: string; minIncrement: string; endsAt: string }>>; working: boolean; onCreate: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4"><button className="absolute inset-0" onClick={onClose} aria-label="Fechar" /><div className="relative w-full max-w-xl rounded-[28px] bg-white p-5 shadow-2xl sm:p-7"><button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"><X className="h-4 w-4" /></button><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397c75]">Business</p><h2 className="mt-1 font-serif text-2xl font-black">Criar leilão</h2><p className="mt-2 text-sm leading-6 text-stone-500">Escolha um produto publicado. Produtos com leilão aberto deixam de aceitar propostas diretas até o encerramento.</p><div className="mt-6 space-y-4"><Field label="Produto"><select value={form.listingId} onChange={(event) => setForm((current) => ({ ...current, listingId: event.target.value }))} className={inputClass}><option value="">Selecione um produto</option>{products.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Lance inicial"><input type="number" min="0.01" step="0.01" value={form.startPrice} onChange={(event) => setForm((current) => ({ ...current, startPrice: event.target.value }))} className={inputClass} placeholder="100,00" /></Field><Field label="Incremento mínimo"><input type="number" min="0.01" step="0.01" value={form.minIncrement} onChange={(event) => setForm((current) => ({ ...current, minIncrement: event.target.value }))} className={inputClass} /></Field></div><Field label="Encerra em"><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className={inputClass} /></Field></div><button disabled={working || !form.listingId || !form.startPrice || !form.endsAt} onClick={onCreate} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0d4542] px-5 py-3.5 text-sm font-black text-white disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Abrir leilão</button></div></div>;
}

function Status({ status }: { status: Auction['status'] }) { const map = status === 'OPEN' ? ['Aberto', 'bg-emerald-50 text-emerald-700'] : status === 'ENDED' ? ['Encerrado', 'bg-stone-100 text-stone-600'] : ['Cancelado', 'bg-red-50 text-red-600']; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] ${map[1]}`}>{map[0]}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-[24px] border border-dashed border-stone-300 bg-white px-6 py-12 text-center"><Gavel className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-bold text-stone-500">{text}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.12em] text-stone-400">{label}</span>{children}</label>; }
const inputClass = 'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-stone-400';
function money(value: unknown) { const number = Number(value); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(number) ? number : 0); }
function timeLeft(value: string) { const diff = new Date(value).getTime() - Date.now(); if (diff <= 0) return 'Encerrando...'; const hours = Math.floor(diff / 3_600_000); const minutes = Math.floor((diff % 3_600_000) / 60_000); if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h restantes`; return `${hours}h ${minutes}min restantes`; }
