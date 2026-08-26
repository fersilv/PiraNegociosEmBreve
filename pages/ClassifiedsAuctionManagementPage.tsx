import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Gavel, Loader2, Mail, MessageCircle, Phone, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Settlement = 'PENDING' | 'CONTACTED' | 'AGREED' | 'COMPLETED' | 'CANCELED';
type AuctionRow = {
  id: string; title: string; companyName: string; image?: string | null; status: 'OPEN' | 'ENDED' | 'CANCELED';
  startsAt: string; endsAt: string; startPrice: number; minIncrement: number; currentBid?: number | null; finalAmount?: number | null;
  bidCount: number; owned: boolean; won: boolean; participated: boolean; scheduled: boolean; live: boolean;
  settlementStatus: Settlement; conversationId?: string | null;
};
type AuctionDetail = AuctionRow & {
  description?: string; city?: string; state?: string;
  winnerContact?: { name?: string; personName?: string; email?: string; phone?: string; whatsappVerified?: boolean; photoURL?: string; companyName?: string } | null;
  sellerContact?: { name?: string; phone?: string; logoURL?: string } | null;
};
type Filter = 'ALL' | 'LIVE' | 'SCHEDULED' | 'WON' | 'ENDED';

export default function ClassifiedsAuctionManagementPage() {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AuctionRow[]>([]);
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/classifieds/me/auction-management')
      .then((response) => setRows(Array.isArray(response.data) ? response.data : []))
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Não foi possível carregar seu histórico de leilões.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!auctionId) { setDetail(null); return; }
    setDetailLoading(true);
    api.get(`/classifieds/me/auction-management/${auctionId}`)
      .then((response) => setDetail(response.data as AuctionDetail))
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Não foi possível abrir este leilão.'))
      .finally(() => setDetailLoading(false));
  }, [auctionId]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (filter === 'LIVE') return row.live;
    if (filter === 'SCHEDULED') return row.scheduled;
    if (filter === 'WON') return row.won;
    if (filter === 'ENDED') return row.status !== 'OPEN';
    return true;
  }), [rows, filter]);

  const updateSettlement = async (status: Settlement) => {
    if (!detail?.owned || working) return;
    setWorking(true); setError('');
    try {
      const response = await api.patch(`/classifieds/me/auction-management/${detail.id}/settlement`, { status });
      const next = response.data?.settlementStatus || status;
      setDetail((current) => current ? { ...current, settlementStatus: next } : current);
      setRows((current) => current.map((row) => row.id === detail.id ? { ...row, settlementStatus: next } : row));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível atualizar a negociação.');
    } finally { setWorking(false); }
  };

  if (loading) return <Loading />;
  if (auctionId) return <DetailPage detail={detail} loading={detailLoading} error={error} working={working} onBack={() => navigate('/classificados/gestao/leiloes')} onSettlement={updateSettlement} />;

  const counts = { live: rows.filter((row) => row.live).length, scheduled: rows.filter((row) => row.scheduled).length, won: rows.filter((row) => row.won).length, ended: rows.filter((row) => row.status !== 'OPEN').length };
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ad5c45]">Leilões · sua conta</p><h1 className="mt-1 font-serif text-3xl font-black">Disputas, arrematações e pós-venda</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">O leilão não desaparece quando o relógio zera. Acompanhe salas abertas, agendamentos, itens arrematados e a negociação depois do martelo.</p></div><Link to="/classificados/gestao/leiloes/arena" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#3a222b] px-5 py-3 text-sm font-black text-white shadow-sm"><Gavel className="h-4 w-4" /> Abrir arena / criar leilão</Link></header>
    {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Ao vivo" value={counts.live} /><Metric label="Agendados" value={counts.scheduled} /><Metric label="Arrematados por mim" value={counts.won} /><Metric label="Encerrados" value={counts.ended} /></section>
    <div className="flex flex-wrap gap-2">{([['ALL','Todos'],['LIVE','Ao vivo'],['SCHEDULED','Agendados'],['WON','Arrematados por mim'],['ENDED','Encerrados']] as Array<[Filter,string]>).map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={`rounded-full px-4 py-2 text-xs font-black ${filter === id ? 'bg-[#3a222b] text-white' : 'bg-white text-stone-500 ring-1 ring-stone-200'}`}>{label}</button>)}</div>
    {filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((row) => <HistoryCard key={row.id} auction={row} onOpen={() => navigate(`/classificados/gestao/leiloes/${row.id}`)} />)}</div> : <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center text-sm text-stone-500">Nenhum leilão neste filtro ainda.</div>}
  </div>;
}

function DetailPage({ detail, loading, error, working, onBack, onSettlement }: { detail: AuctionDetail | null; loading: boolean; error: string; working: boolean; onBack: () => void; onSettlement: (status: Settlement) => void }) {
  if (loading || !detail) return <Loading />;
  return <div className="mx-auto max-w-6xl space-y-5"><button onClick={onBack} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-stone-600 ring-1 ring-stone-200">← Todos os leilões</button>{error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}<div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]"><section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-stone-200"><div className="aspect-[16/9] bg-stone-100">{detail.image ? <img src={detail.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Gavel className="h-12 w-12 text-stone-300" /></div>}</div><div className="p-6"><Status auction={detail} /><h1 className="mt-3 font-serif text-3xl font-black">{detail.title}</h1><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">{detail.description}</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Info label="Lance inicial" value={money(detail.startPrice)} /><Info label="Incremento" value={money(detail.minIncrement)} /><Info label="Resultado" value={detail.finalAmount ? money(detail.finalAmount) : detail.currentBid ? money(detail.currentBid) : 'Sem lance'} /></div></div></section><aside className="space-y-4">{detail.live && <Link to={`/classificados/gestao/leiloes/${detail.id}/ao-vivo`} className="flex items-center gap-3 rounded-[24px] bg-[#261614] p-5 text-white"><Gavel className="h-5 w-5 text-[#ff8f6e]" /><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#ff8f6e]">Sala ativa</p><p className="mt-1 font-black">Entrar no leilão em tempo real</p></div></Link>}{detail.won && <Contact title="Você arrematou" contact={detail.sellerContact} conversationId={detail.conversationId} />}{detail.owned && detail.status === 'ENDED' && detail.finalAmount && <><Contact title="Dados do arrematante" contact={detail.winnerContact} conversationId={detail.conversationId} /><div className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">Andamento da negociação</p><p className="mt-2 text-lg font-black">{settlementLabel(detail.settlementStatus)}</p><div className="mt-4 grid grid-cols-2 gap-2">{(['PENDING','CONTACTED','AGREED','COMPLETED'] as Settlement[]).map((status) => <button key={status} disabled={working} onClick={() => onSettlement(status)} className={`rounded-xl px-3 py-2.5 text-xs font-black ${detail.settlementStatus === status ? 'bg-[#3a222b] text-white' : 'bg-stone-100 text-stone-600'}`}>{settlementLabel(status)}</button>)}</div></div></>}</aside></div></div>;
}

function Contact({ title, contact, conversationId }: { title: string; contact?: any; conversationId?: string | null }) { return <div className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><p className="text-[10px] font-black uppercase tracking-[.15em] text-stone-400">{title}</p>{contact ? <><div className="mt-3 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100"><UserRound className="h-5 w-5 text-stone-400" /></span><div><p className="font-black">{contact.name || contact.personName}</p>{contact.personName && contact.name !== contact.personName && <p className="text-xs text-stone-400">{contact.personName}</p>}</div></div><div className="mt-4 space-y-2">{contact.phone && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"><Phone className="h-4 w-4" /> {contact.phone}{contact.whatsappVerified ? ' · WhatsApp verificado' : ''}</div>}{contact.email && <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs font-black text-stone-600"><Mail className="h-4 w-4" /> {contact.email}</div>}{conversationId && <Link to={`/classificados/conversas/${conversationId}`} className="flex items-center gap-2 rounded-xl bg-[#3a222b] px-3 py-2 text-xs font-black text-white"><MessageCircle className="h-4 w-4" /> Abrir negociação no chat</Link>}</div></> : <p className="mt-3 text-sm text-stone-500">Dados de contato ainda indisponíveis.</p>}</div>; }
function HistoryCard({ auction, onOpen }: { auction: AuctionRow; onOpen: () => void }) { const value = auction.status === 'ENDED' ? auction.finalAmount : auction.currentBid ?? auction.startPrice; return <button onClick={onOpen} className="overflow-hidden rounded-[26px] bg-white text-left shadow-sm ring-1 ring-stone-200"><div className="aspect-[16/9] bg-stone-100">{auction.image ? <img src={auction.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Gavel className="h-9 w-9 text-stone-300" /></div>}</div><div className="p-4"><div className="flex items-center justify-between"><Status auction={auction} /><span className="text-[10px] font-bold text-stone-400">{auction.bidCount} lances</span></div><h3 className="mt-3 line-clamp-2 font-black">{auction.title}</h3><p className="mt-2 text-2xl font-black">{money(value)}</p>{auction.won && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800"><Trophy className="mr-1 inline h-4 w-4" /> Você arrematou</p>}{auction.status === 'ENDED' && auction.finalAmount && <p className="mt-2 text-[10px] font-black uppercase text-stone-400">Negociação · {settlementLabel(auction.settlementStatus)}</p>}</div></button>; }
function Status({ auction }: { auction: AuctionRow }) { const label = auction.scheduled ? 'Agendado' : auction.live ? 'Ao vivo' : auction.status === 'ENDED' ? 'Encerrado' : 'Cancelado'; const cls = auction.live ? 'bg-red-50 text-red-700' : auction.scheduled ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-700'; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] ${cls}`}>{label}</span>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-stone-50 p-4"><p className="text-[9px] font-black uppercase text-stone-400">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>; }
function Loading() { return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>; }
function settlementLabel(status: Settlement) { return ({ PENDING: 'Pendente', CONTACTED: 'Contato iniciado', AGREED: 'Negócio combinado', COMPLETED: 'Concluído', CANCELED: 'Cancelado' } as Record<Settlement,string>)[status] || status; }
function money(value: unknown) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)); }
