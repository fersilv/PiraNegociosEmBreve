import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, Check, Clock3, Loader2, MessageCircle, RotateCcw, ShoppingCart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ClassifiedOffer } from '../types/classifieds';

type Tab = 'negotiating' | 'received' | 'sent' | 'history';
type OfferWithConversation = ClassifiedOffer & { conversationId?: string | null };

export default function ClassifiedsOffersPage() {
  const [offers, setOffers] = useState<OfferWithConversation[]>([]);
  const [tab, setTab] = useState<Tab>('negotiating');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/classifieds/me/offers'); setOffers(Array.isArray(response.data) ? response.data : []); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível carregar as negociações.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const groups = useMemo(() => ({
    negotiating: offers.filter((offer) => ['PENDING','ACCEPTED'].includes(offer.status)),
    received: offers.filter((offer) => offer.role === 'SELLER' && offer.status === 'PENDING'),
    sent: offers.filter((offer) => offer.role === 'BUYER'),
    history: offers.filter((offer) => !['PENDING','ACCEPTED'].includes(offer.status)),
  }), [offers]);
  const visible = groups[tab];

  const respond = async (offer: OfferWithConversation, decision: 'ACCEPTED' | 'REJECTED') => {
    if (workingId) return;
    setWorkingId(offer.id); setError('');
    try {
      const response = await api.post(`/classifieds/me/offers/${offer.id}/respond`, { decision });
      setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, ...response.data } : item));
      if (decision === 'ACCEPTED') setTab('negotiating');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível responder a oferta.'); }
    finally { setWorkingId(null); }
  };

  const withdraw = async (offer: OfferWithConversation) => {
    if (workingId) return;
    setWorkingId(offer.id); setError('');
    try { const response = await api.post(`/classifieds/me/offers/${offer.id}/withdraw`); setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, ...response.data, status: 'WITHDRAWN' } : item)); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível retirar a oferta.'); }
    finally { setWorkingId(null); }
  };

  const revokeAcceptance = async (offer: OfferWithConversation) => {
    if (workingId) return;
    setWorkingId(offer.id); setError('');
    try { const response = await api.post(`/classifieds/me/offers/${offer.id}/revoke-acceptance`); setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, ...response.data, status: 'REVOKED' } : item)); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível retirar o aceite.'); }
    finally { setWorkingId(null); }
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Ofertas e negociações</p><h1 className="mt-1 font-serif text-3xl font-black">Negociações</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Uma oferta aceita continua ativa aqui até virar compra, expirar ou ter o aceite retirado. O chat guarda o histórico da negociação, mas a compra acontece no checkout do produto.</p></header>
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs leading-5 text-stone-600"><strong>Oferta aceita não some nem vira pedido sozinha.</strong> Ela libera o preço negociado para o comprador finalizar a compra no mesmo checkout do produto.</div>
    {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3"><TabButton active={tab === 'negotiating'} onClick={() => setTab('negotiating')} label={`Em negociação (${groups.negotiating.length})`} /><TabButton active={tab === 'received'} onClick={() => setTab('received')} label={`Aguardando resposta (${groups.received.length})`} /><TabButton active={tab === 'sent'} onClick={() => setTab('sent')} label={`Minhas ofertas (${groups.sent.length})`} /><TabButton active={tab === 'history'} onClick={() => setTab('history')} label={`Encerradas (${groups.history.length})`} /></div>
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map((offer) => <OfferCard key={offer.id} offer={offer} working={workingId === offer.id} respond={respond} withdraw={withdraw} revokeAcceptance={revokeAcceptance} />)}</div> : <Empty tab={tab} />}
  </div>;
}

function OfferCard({ offer, working, respond, withdraw, revokeAcceptance }: { offer: OfferWithConversation; working: boolean; respond: (offer: OfferWithConversation, decision: 'ACCEPTED' | 'REJECTED') => void; withdraw: (offer: OfferWithConversation) => void; revokeAcceptance: (offer: OfferWithConversation) => void }) {
  const remaining = ['PENDING','ACCEPTED'].includes(offer.status) ? remainingText(offer.expiresAt) : '';
  const counterpart = offer.role === 'SELLER' ? offer.buyerName || 'Interessado' : offer.sellerName || 'Anunciante';
  const productUrl = `/classificados/explorar/${encodeURIComponent(offer.slug)}`;
  return <article className={`overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ${offer.status === 'ACCEPTED' ? 'ring-emerald-300' : 'ring-stone-200'}`}>
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 p-4"><Link to={productUrl} className="aspect-square overflow-hidden rounded-2xl bg-stone-100">{offer.image ? <img src={offer.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><BadgeDollarSign className="h-7 w-7 text-stone-300" /></div>}</Link><div className="min-w-0"><div className="flex items-start justify-between gap-2"><Status status={offer.status} /><span className="text-[10px] font-bold text-stone-400">{new Date(offer.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div><Link to={productUrl} className="mt-2 block truncate text-sm font-black text-stone-900 hover:underline">{offer.title}</Link><p className="mt-1 text-xs text-stone-400">{offer.role === 'SELLER' ? 'Oferta de' : 'Oferta para'} <span className="font-bold text-stone-600">{counterpart}</span></p><p className="mt-2 text-xl font-black text-[#a84f34]">{currency(offer.amount)}</p>{offer.price != null && <p className="text-[10px] text-stone-400">Preço do anúncio: {currency(offer.price)}</p>}{remaining && <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700"><Clock3 className="h-3.5 w-3.5" /> {remaining}</p>}</div></div>

    {offer.status === 'ACCEPTED' && <div className="border-t border-emerald-100 bg-emerald-50/80 p-4 text-xs leading-5 text-emerald-950">{offer.role === 'BUYER' ? <><strong className="block text-sm">Sua oferta foi aceita.</strong><span>O checkout já reconhece {currency(offer.amount)} como seu preço exclusivo.</span><Link to={productUrl} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white"><ShoppingCart className="h-4 w-4" /> Comprar por {currency(offer.amount)}</Link></> : <><strong>Oferta aceita e aguardando o comprador.</strong> Ela continua visível nesta negociação até ser usada, expirar ou você retirar o aceite.{!offer.orderId && <button disabled={working} onClick={() => revokeAcceptance(offer)} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-black text-red-700 ring-1 ring-red-200 disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Retirar aceite</button>}{offer.orderId && <p className="mt-2 font-bold text-emerald-800">O comprador já iniciou uma compra com este preço. A partir daqui, acompanhe em Minhas vendas.</p>}</>}</div>}
    {offer.status === 'REVOKED' && <div className="border-t border-red-100 bg-red-50/70 p-3 text-xs leading-5 text-red-800"><strong>Aceite retirado pela empresa.</strong> O preço especial deixou de estar disponível.</div>}
    {offer.status === 'CONSUMED' && <div className="border-t border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-blue-800"><strong>Oferta utilizada.</strong> O preço negociado já foi convertido em compra.</div>}
    {offer.status === 'PENDING' && <div className="border-t border-stone-100 bg-stone-50/70 p-3">{offer.role === 'SELLER' ? <div className="grid grid-cols-2 gap-2"><button disabled={working} onClick={() => respond(offer, 'REJECTED')} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-black text-stone-600 ring-1 ring-stone-200 disabled:opacity-50"><X className="h-4 w-4" /> Recusar</button><button disabled={working} onClick={() => respond(offer, 'ACCEPTED')} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-black text-white disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aceitar</button></div> : <button disabled={working} onClick={() => withdraw(offer)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-black text-stone-600 ring-1 ring-stone-200 disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Retirar oferta</button>}</div>}
    {offer.conversationId && <div className="border-t border-stone-100 px-3 py-2"><Link to={`/classificados/conversas/${offer.conversationId}`} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-[#7f4938] hover:bg-[#fff1eb]"><MessageCircle className="h-4 w-4" /> Conversa desta negociação</Link></div>}
  </article>;
}

function Status({ status }: { status: ClassifiedOffer['status'] }) { const map: Record<ClassifiedOffer['status'], [string, string]> = { PENDING: ['Pendente', 'bg-amber-50 text-amber-700'], ACCEPTED: ['Aceita', 'bg-emerald-50 text-emerald-700'], REJECTED: ['Recusada', 'bg-red-50 text-red-700'], EXPIRED: ['Expirada', 'bg-stone-100 text-stone-500'], WITHDRAWN: ['Retirada pelo comprador', 'bg-stone-100 text-stone-500'], REVOKED: ['Aceite retirado', 'bg-red-50 text-red-700'], CONSUMED: ['Utilizada', 'bg-blue-50 text-blue-700'] }; const [label, style] = map[status]; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] ${style}`}>{label}</span>; }
function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} className={`rounded-full px-3 py-2 text-xs font-black ${active ? 'bg-[#3a222b] text-white' : 'bg-stone-100 text-stone-500'}`}>{label}</button>; }
function Empty({ tab }: { tab: Tab }) { const copy = tab === 'negotiating' ? ['Nenhuma negociação ativa','Ofertas pendentes e aceitas aparecem aqui para comprador e vendedor.'] : tab === 'received' ? ['Nenhuma oferta aguardando você','Novas ofertas recebidas aparecem aqui.'] : tab === 'sent' ? ['Você ainda não fez ofertas','Explore os produtos e faça uma proposta quando o anúncio aceitar negociação.'] : ['Histórico vazio','Ofertas encerradas ficam guardadas aqui.']; return <div className="rounded-[26px] border border-dashed border-stone-300 bg-white px-6 py-14 text-center"><BadgeDollarSign className="mx-auto h-9 w-9 text-stone-300" /><h2 className="mt-4 font-serif text-2xl font-black">{copy[0]}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{copy[1]}</p>{tab === 'sent' && <Link to="/classificados/explorar" className="mt-5 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black text-white">Explorar produtos</Link>}</div>; }
function currency(value: unknown) { const n = Number(value); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0); }
function remainingText(expiresAt: string) { const ms = new Date(expiresAt).getTime() - Date.now(); if (ms <= 0) return 'Expirando agora'; const hours = Math.ceil(ms / 3_600_000); return hours > 24 ? `${Math.ceil(hours / 24)} dias restantes` : `${hours}h restantes`; }
