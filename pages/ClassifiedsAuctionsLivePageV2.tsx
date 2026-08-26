import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bolt,
  CheckCircle2,
  Clock3,
  Crown,
  Flame,
  Gavel,
  ImageIcon,
  Loader2,
  LockKeyhole,
  MapPin,
  Menu,
  Radio,
  ShieldCheck,
  Sparkles,
  Tags,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { AuctionBidderSetup } from '../components/classifieds/AuctionBidderSetup';
import { SeoHead } from '../components/SeoHead';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, SOCKET_PATH, api } from '../lib/api';
import {
  auctionCurrentValue,
  invalidatePublicAuctions,
  loadPublicAuctionDetail,
  loadPublicAuctions,
  type PublicClassifiedAuction,
} from '../lib/classifiedsAuctions';
import type { ClassifiedListing, ClassifiedLimits, ClassifiedWorkspaceContextData } from '../types/classifieds';

type SellerState = {
  context: ClassifiedWorkspaceContextData | null;
  limits: ClassifiedLimits | null;
  listings: ClassifiedListing[];
};

type AuctionSocketUpdate = {
  auctionId?: string;
  reason?: 'BID' | 'EXTENDED' | 'ENDED' | 'CANCELED' | 'CREATED';
  snapshot?: Partial<PublicClassifiedAuction> | null;
  at?: string;
};

const emptySeller: SellerState = { context: null, limits: null, listings: [] };
const SOFT_CLOSE_SECONDS = 30;

export default function ClassifiedsAuctionsLivePageV2({ embedded = false }: { embedded?: boolean } = {}) {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [auctions, setAuctions] = useState<PublicClassifiedAuction[]>([]);
  const [detail, setDetail] = useState<PublicClassifiedAuction | null>(null);
  const [seller, setSeller] = useState<SellerState>(emptySeller);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidderReady, setBidderReady] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [online, setOnline] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [extensionPulse, setExtensionPulse] = useState(false);
  const [createForm, setCreateForm] = useState({ listingId: '', startPrice: '', minIncrement: '5', startsAt: '', endsAt: '' });

  const loadList = async (force = false) => {
    try {
      const rows = await loadPublicAuctions(force);
      setAuctions(rows);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os leilões.');
    }
  };

  const loadDetail = async (id: string, silent = false) => {
    if (!silent) setDetailLoading(true);
    try {
      const row = await loadPublicAuctionDetail(id);
      setDetail(row);
      setBidAmount((current) => current || toInputMoney(row.nextMinimum));
    } catch (requestError: any) {
      if (!silent) setError(requestError?.response?.data?.message || 'Leilão não encontrado.');
    } finally {
      if (!silent) setDetailLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadPublicAuctions()
      .then((rows) => active && setAuctions(rows))
      .catch((requestError: any) => active && setError(requestError?.response?.data?.message || 'Não foi possível carregar os leilões.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!auctionId) {
      setDetail(null);
      setOnline(0);
      return;
    }
    void loadDetail(auctionId);
  }, [auctionId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#090605';
    return () => { document.body.style.backgroundColor = previous; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setSeller(emptySeller);
      setBidderReady(false);
      return;
    }
    Promise.allSettled([
      api.get('/classifieds/me/context'),
      api.get('/classifieds/me/limits'),
      api.get('/classifieds/me/listings'),
      api.get('/whatsapp/phone/status'),
    ]).then(([contextResult, limitsResult, listingsResult, whatsappResult]) => {
      if (!active) return;
      const context = contextResult.status === 'fulfilled' ? contextResult.value.data as ClassifiedWorkspaceContextData : null;
      const limits = limitsResult.status === 'fulfilled' ? limitsResult.value.data as ClassifiedLimits : null;
      const listings = listingsResult.status === 'fulfilled' && Array.isArray(listingsResult.value.data)
        ? listingsResult.value.data as ClassifiedListing[]
        : [];
      setSeller({ context, limits, listings });
      const whatsappVerified = whatsappResult.status === 'fulfilled' && Boolean(whatsappResult.value.data?.verified);
      setBidderReady(Boolean((user.email || profile?.email) && profile?.photoURL && whatsappVerified));
    });
    return () => { active = false; };
  }, [user?.uid, profile?.photoURL, profile?.email]);

  useEffect(() => {
    let socket: Socket | null = null;
    let disposed = false;
    let refreshTimer: number | null = null;

    const refresh = (payload: AuctionSocketUpdate) => {
      if (auctionId && payload.auctionId === auctionId && payload.snapshot) {
        setDetail((current) => current ? { ...current, ...payload.snapshot } : current);
        if (payload.snapshot.nextMinimum != null) setBidAmount((current) => {
          const parsed = parseMoneyInput(current);
          const nextMinimum = Number(payload.snapshot?.nextMinimum || 0);
          return !Number.isFinite(parsed) || parsed < nextMinimum ? toInputMoney(nextMinimum) : current;
        });
      }
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        invalidatePublicAuctions();
        if (payload.reason === 'EXTENDED' && (!auctionId || payload.auctionId === auctionId)) {
          setExtensionPulse(true);
          window.setTimeout(() => setExtensionPulse(false), 2600);
        }
        if (auctionId && payload.auctionId === auctionId) void loadDetail(auctionId, true);
        void loadList(true);
      }, 60);
    };

    void (async () => {
      const token = user ? await user.getIdToken().catch(() => '') : '';
      if (disposed) return;
      const socketOrigin = new URL(API_URL, window.location.origin).origin;
      socket = io(`${socketOrigin}/auctions`, {
        path: SOCKET_PATH,
        transports: ['websocket', 'polling'],
        auth: { token },
        reconnection: true,
        reconnectionDelay: 600,
        reconnectionDelayMax: 3500,
      });
      socket.on('connect', () => {
        setSocketConnected(true);
        if (auctionId) socket?.emit('auction:join', { auctionId });
      });
      socket.on('disconnect', () => setSocketConnected(false));
      socket.on('auction:presence', (payload: { auctionId?: string; online?: number }) => {
        if (payload?.auctionId === auctionId) setOnline(Math.max(0, Number(payload.online || 0)));
      });
      socket.on('auction:update', refresh);
    })();

    return () => {
      disposed = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (socket) {
        socket.emit('auction:leave');
        socket.disconnect();
      }
      setSocketConnected(false);
    };
  }, [auctionId, user?.uid]);

  useEffect(() => {
    if (!auctionId) return;
    const timer = window.setInterval(() => {
      if (!socketConnected) void loadDetail(auctionId, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [auctionId, socketConnected]);

  useEffect(() => {
    if (!setupOpen && !createOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [setupOpen, createOpen]);

  const liveAuctions = useMemo(
    () => auctions.filter((auction) => auction.live && new Date(auction.endsAt).getTime() > now),
    [auctions, now],
  );
  const totalBids = liveAuctions.reduce((sum, auction) => sum + Number(auction.bidCount || 0), 0);
  const companyId = seller.context?.activeIdentity === 'COMPANY' ? seller.context.company?.id : null;
  const canCreate = Boolean(
    user
      && seller.context?.activeIdentity === 'COMPANY'
      && seller.limits?.auctionCreation
      && String(seller.limits?.plan).toUpperCase() === 'ELITE',
  );
  const eligibleListings = seller.listings.filter(
    (listing) => listing.listingType === 'PRODUCT'
      && listing.status === 'PUBLISHED'
      && !liveAuctions.some((auction) => auction.listingId === listing.id),
  );

  const participate = () => {
    if (!detail) return;
    const returnTo = `/classificados/leiloes/${detail.id}`;
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}&intent=auction`);
      return;
    }
    if (!bidderReady) {
      setSetupOpen(true);
      return;
    }
    fillSuggestedBid(0);
    requestAnimationFrame(() => document.getElementById('auction-bid-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const fillSuggestedBid = (extraIncrements: number) => {
    if (!detail) return;
    const minimum = Number(detail.nextMinimum || detail.startPrice || 0);
    const increment = Number(detail.minIncrement || 0);
    setBidAmount(toInputMoney(minimum + (increment * extraIncrements)));
    setError('');
  };

  const bidValidation = useMemo(() => validateBid(detail, bidAmount), [detail, bidAmount]);

  const submitBid = async () => {
    if (!detail || !user || bidding || !bidValidation.valid) return;
    if (!bidderReady) {
      setSetupOpen(true);
      return;
    }
    setBidding(true);
    setError('');
    try {
      const response = await api.post(`/classifieds/auctions/${detail.id}/bids`, { amount: parseMoneyInput(bidAmount) });
      const next = response.data as PublicClassifiedAuction & { softCloseExtended?: boolean };
      setDetail(next);
      setBidAmount(toInputMoney(next.nextMinimum));
      invalidatePublicAuctions();
      if (next.softCloseExtended) {
        setExtensionPulse(true);
        window.setTimeout(() => setExtensionPulse(false), 2600);
      }
      await loadList(true);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'Não foi possível registrar o lance.';
      setError(message);
      if (/WhatsApp|foto|e-mail|perfil/i.test(String(message))) setSetupOpen(true);
      if (/próximo lance mínimo/i.test(String(message))) {
        invalidatePublicAuctions();
        await loadDetail(detail.id);
      }
    } finally {
      setBidding(false);
    }
  };

  const createAuction = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    setError('');
    try {
      const startsAt = createForm.startsAt ? new Date(`${createForm.startsAt}:00-03:00`).toISOString() : '';
      const endsAt = createForm.endsAt ? new Date(`${createForm.endsAt}:00-03:00`).toISOString() : '';
      const response = await api.post('/classifieds/me/auctions', {
        listingId: createForm.listingId,
        startPrice: parseMoneyInput(createForm.startPrice),
        minIncrement: parseMoneyInput(createForm.minIncrement),
        startsAt: startsAt || undefined,
        endsAt,
      });
      invalidatePublicAuctions();
      setCreateOpen(false);
      setCreateForm({ listingId: '', startPrice: '', minIncrement: '5', startsAt: '', endsAt: '' });
      await loadList(true);
      if (response.data?.id) navigate(`/classificados/leiloes/${response.data.id}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível abrir o leilão.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090605] text-white">
      <SeoHead
        title={detail ? `${detail.title} | Leilão ao vivo` : 'Leilões ao vivo | PiraNegócios'}
        description="Acompanhe leilões públicos da região com lances e presença em tempo real."
        canonical={`${window.location.origin}${auctionId ? `/classificados/leiloes/${auctionId}` : '/classificados/leiloes'}`}
      />
      {!embedded && <AuctionNavbar user={Boolean(user)} />}

      {auctionId ? (
        <AuctionRoomPage
          auction={detail}
          loading={detailLoading}
          now={now}
          online={online}
          socketConnected={socketConnected}
          extensionPulse={extensionPulse}
          loggedIn={Boolean(user)}
          bidderReady={bidderReady}
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          validation={bidValidation}
          bidding={bidding}
          canCancel={Boolean(detail && canCreate && detail.companyId === companyId && detail.bidCount === 0)}
          onBack={() => navigate('/classificados/leiloes')}
          onParticipate={participate}
          onFillSuggestion={fillSuggestedBid}
          onBid={() => void submitBid()}
          onSetup={() => setSetupOpen(true)}
        />
      ) : (
        <AuctionLobby
          auctions={liveAuctions}
          loading={loading}
          now={now}
          totalBids={totalBids}
          canCreate={canCreate}
          onCreate={() => setCreateOpen(true)}
          onOpen={(id) => navigate(`/classificados/leiloes/${id}`)}
        />
      )}

      {error && (
        <div className="fixed bottom-5 left-1/2 z-[170] w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border border-red-400/25 bg-[#2b1010] px-4 py-3 text-sm font-bold text-red-100 shadow-2xl">
          <div className="flex items-center justify-between gap-4"><span>{error}</span><button onClick={() => setError('')} aria-label="Fechar"><X className="h-4 w-4" /></button></div>
        </div>
      )}

      {setupOpen && user && (
        <ModalShell onClose={() => setSetupOpen(false)}>
          <AuctionBidderSetup
            onClose={() => setSetupOpen(false)}
            onReady={() => {
              setBidderReady(true);
              setSetupOpen(false);
              fillSuggestedBid(0);
            }}
          />
        </ModalShell>
      )}

      {createOpen && canCreate && (
        <ModalShell onClose={() => setCreateOpen(false)}>
          <CreateAuctionPanel
            listings={eligibleListings}
            form={createForm}
            setForm={setCreateForm}
            creating={creating}
            onCreate={() => void createAuction()}
            onClose={() => setCreateOpen(false)}
          />
        </ModalShell>
      )}
    </div>
  );
}

function AuctionNavbar({ user }: { user: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.08] bg-[#0c0807] shadow-[0_14px_50px_rgba(0,0,0,.22)]">
      <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/classificados" className="flex items-center gap-3">
          <img src="/brand/symbol-terracotta.png" alt="" className="h-9 w-9 object-contain" />
          <span><strong className="block font-serif text-lg leading-none">PiraNegócios</strong><span className="mt-1 block text-[8px] font-black uppercase tracking-[.18em] text-[#ff8a68]">Classificados · Arena</span></span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/classificados" className="rounded-xl px-3.5 py-2 text-sm font-bold text-white/55 hover:bg-white/[.06] hover:text-white">Classificados</Link>
          <Link to="/classificados/leiloes" className="inline-flex items-center gap-2 rounded-xl bg-[#ff633c]/12 px-3.5 py-2 text-sm font-black text-[#ff9677]"><Gavel className="h-4 w-4" /> Leilões ao vivo</Link>
          {user ? <Link to="/classificados/explorar" className="ml-2 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#21130f]"><User className="h-4 w-4" /> Meu Classificados</Link> : <Link to="/login?returnTo=%2Fclassificados%2Fleiloes" className="ml-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#21130f]">Entrar</Link>}
        </nav>
        <button type="button" onClick={() => setMobileOpen((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] md:hidden" aria-label="Menu"><Menu className="h-5 w-5" /></button>
      </div>
      {mobileOpen && <div className="border-t border-white/[.08] bg-[#0c0807] px-4 py-4 md:hidden"><div className="mx-auto flex max-w-7xl flex-col gap-2"><Link onClick={() => setMobileOpen(false)} to="/classificados" className="rounded-xl px-3 py-3 text-sm font-bold text-white/65">Classificados</Link><Link onClick={() => setMobileOpen(false)} to="/classificados/leiloes" className="rounded-xl bg-[#ff633c]/12 px-3 py-3 text-sm font-black text-[#ff9677]">Leilões ao vivo</Link><Link onClick={() => setMobileOpen(false)} to={user ? '/classificados/explorar' : '/login?returnTo=%2Fclassificados%2Fleiloes'} className="rounded-xl bg-white px-3 py-3 text-center text-sm font-black text-[#21130f]">{user ? 'Meu Classificados' : 'Entrar'}</Link></div></div>}
    </header>
  );
}

function AuctionLobby({ auctions, loading, now, totalBids, canCreate, onCreate, onOpen }: { auctions: PublicClassifiedAuction[]; loading: boolean; now: number; totalBids: number; canCreate: boolean; onCreate: () => void; onOpen: (id: string) => void }) {
  const featured = auctions[0] || null;
  return (
    <main>
      <section className="border-b border-white/[.07] bg-[radial-gradient(circle_at_20%_10%,rgba(255,99,60,.17),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(255,174,87,.08),transparent_30%),#090605]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><span className="inline-flex items-center gap-2 rounded-full border border-[#ff714b]/25 bg-[#ff633c]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.18em] text-[#ff9a7b]"><Radio className="h-3.5 w-3.5" /> Arena em tempo real</span><h1 className="mt-5 max-w-4xl font-serif text-5xl font-black leading-[.9] tracking-[-.045em] sm:text-7xl">Lance, reação,<br /><span className="text-[#ff8b68]">martelo.</span></h1><p className="mt-5 max-w-2xl text-sm leading-7 text-white/48">Salas públicas, relógio transparente e proteção anti-sniping: qualquer lance válido nos 30 segundos finais reinicia o cronômetro para 30 segundos.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[440px]"><Metric icon={<Gavel className="h-4 w-4" />} value={String(auctions.length)} label="ao vivo" /><Metric icon={<Bolt className="h-4 w-4" />} value={String(totalBids)} label="lances" /><Metric icon={<ShieldCheck className="h-4 w-4" />} value="30s" label="anti-sniping" /></div>
          </div>
          {canCreate && <button onClick={onCreate} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5d37] to-[#ff8b56] px-5 py-3 text-sm font-black shadow-[0_16px_45px_rgba(255,93,55,.22)]"><Crown className="h-4 w-4" /> Criar leilão Elite</button>}
        </div>
      </section>

      {loading ? <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#ff7b57]" /></div> : auctions.length ? <>
        {featured && <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#ff8a68]">Fecha primeiro</p><button onClick={() => onOpen(featured.id)} className="mt-3 grid w-full overflow-hidden rounded-[34px] border border-white/10 bg-[#17100e] text-left shadow-[0_32px_100px_rgba(0,0,0,.28)] lg:grid-cols-[1.05fr_.95fr]"><AuctionImage auction={featured} large /><div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#ff9474]">{featured.companyName}</p><h2 className="mt-2 font-serif text-4xl font-black leading-[.95]">{featured.title}</h2><p className="mt-5 text-[10px] font-black uppercase tracking-[.14em] text-white/30">Lance atual</p><p className="mt-1 text-4xl font-black text-[#ff9b79]">{money(auctionCurrentValue(featured))}</p><div className="mt-5 grid grid-cols-3 gap-2"><MiniStat label="Incremento" value={money(featured.minIncrement)} /><MiniStat label="Lances" value={String(featured.bidCount)} /><MiniStat label="Restante" value={compactCountdown(new Date(featured.endsAt).getTime() - now)} /></div><div className="mt-5 inline-flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#21130f]"><span>Entrar na sala</span><ArrowRight className="h-4 w-4" /></div></div></button></section>}
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8"><div className="mb-5 flex items-end justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#ff8a68]">Salas abertas</p><h2 className="mt-1 font-serif text-3xl font-black">Disputas acontecendo agora</h2></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{auctions.map((auction) => <AuctionCard key={auction.id} auction={auction} now={now} onOpen={() => onOpen(auction.id)} />)}</div></section>
      </> : <EmptyLobby canCreate={canCreate} onCreate={onCreate} />}
    </main>
  );
}

function AuctionRoomPage({ auction, loading, now, online, socketConnected, extensionPulse, loggedIn, bidderReady, bidAmount, setBidAmount, validation, bidding, canCancel, onBack, onParticipate, onFillSuggestion, onBid, onSetup }: { auction: PublicClassifiedAuction | null; loading: boolean; now: number; online: number; socketConnected: boolean; extensionPulse: boolean; loggedIn: boolean; bidderReady: boolean; bidAmount: string; setBidAmount: (value: string) => void; validation: BidValidation; bidding: boolean; canCancel: boolean; onBack: () => void; onParticipate: () => void; onFillSuggestion: (extra: number) => void; onBid: () => void; onSetup: () => void }) {
  if (loading || !auction) return <main className="flex min-h-[calc(100vh-70px)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff7049]" /></main>;
  const remaining = Math.max(0, new Date(auction.endsAt).getTime() - now);
  const ending = remaining <= SOFT_CLOSE_SECONDS * 1000;
  const ended = auction.status !== 'OPEN' || remaining <= 0;

  return (
    <main className="min-h-[calc(100vh-70px)] bg-[#090605]">
      {extensionPulse && <div className="border-b border-[#ff9b68]/25 bg-[#ff633c] px-4 py-3 text-center text-xs font-black uppercase tracking-[.12em] text-[#21120e]">⚡ Novo lance nos segundos finais. Relógio reiniciado para 30 segundos.</div>}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-black text-white/55 hover:text-white"><ArrowLeft className="h-4 w-4" /> Todos os leilões</button><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[.13em] ${socketConnected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}><span className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-emerald-400' : 'bg-amber-300'}`} /> {socketConnected ? 'Tempo real conectado' : 'Reconectando'}</span><span className="inline-flex items-center gap-2 rounded-full bg-white/[.05] px-3 py-2 text-[9px] font-black text-white/55"><Users className="h-3.5 w-3.5" /> {online} {online === 1 ? 'pessoa na sala' : 'pessoas na sala'}</span></div></div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
          <section className="min-w-0 space-y-5"><div className="overflow-hidden rounded-[30px] border border-white/[.09] bg-[#17100e]"><AuctionImage auction={auction} large /><div className="p-5 sm:p-7"><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#ff8e6d]">{auction.sellerVerifiedSnapshot && <BadgeCheck className="h-4 w-4" />}{auction.companyName}</p><h1 className="mt-2 font-serif text-3xl font-black leading-[.98] sm:text-5xl">{auction.title}</h1><p className="mt-4 text-sm leading-6 text-white/45">{auction.description}</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white/[.05] px-3 py-1.5 text-[10px] font-bold text-white/50"><MapPin className="mr-1 inline h-3.5 w-3.5" /> {auction.neighborhood ? `${auction.neighborhood}, ` : ''}{auction.city}/{auction.state}</span><Link to={`/classificados/anuncio/${auction.slug}`} className="rounded-full bg-white/[.05] px-3 py-1.5 text-[10px] font-black text-white/65">Ver anúncio completo</Link></div></div></div>

            <div className="rounded-[28px] border border-white/[.08] bg-[#14100f] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-white/30">Histórico público</p><h2 className="mt-1 text-lg font-black">Últimos lances</h2></div><span className="rounded-full bg-white/[.05] px-3 py-1.5 text-[9px] font-black text-white/40">nomes protegidos</span></div><div className="mt-4 space-y-2">{auction.bids?.length ? auction.bids.slice(0, 12).map((bid, index) => <div key={bid.id} className={`flex items-center justify-between gap-4 rounded-2xl px-4 py-3 ${index === 0 ? 'border border-[#ff7049]/20 bg-[#ff7049]/[.08]' : 'bg-white/[.035]'}`}><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${index === 0 ? 'bg-[#ff633c]' : 'bg-white/[.06] text-white/35'}`}>{index === 0 ? <Trophy className="h-4 w-4" /> : <Gavel className="h-3.5 w-3.5" />}</span><div><p className="text-xs font-black">{bid.bidderName}</p><p className="text-[9px] text-white/28">{new Date(bid.createdAt).toLocaleString('pt-BR')}</p></div></div><strong className={index === 0 ? 'text-[#ff9c78]' : 'text-white/70'}>{money(bid.amount)}</strong></div>) : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/35">Ainda não há lances. O primeiro pode ser seu.</div>}</div></div>
          </section>

          <aside className="min-w-0 lg:sticky lg:top-[94px] lg:self-start"><div className={`overflow-hidden rounded-[30px] border bg-[#17100e] shadow-[0_24px_80px_rgba(0,0,0,.24)] ${ending && !ended ? 'border-[#ff633c]/55' : 'border-white/[.09]'}`}>
            <div className="border-b border-white/[.07] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#ff8664]">Lance líder</p><p className="mt-2 text-4xl font-black tracking-[-.04em] sm:text-5xl">{money(auctionCurrentValue(auction))}</p></div><span className="rounded-xl bg-white/[.05] px-3 py-2 text-right"><span className="block text-[7px] font-black uppercase tracking-[.13em] text-white/28">Lances</span><strong className="mt-1 block text-lg">{auction.bidCount}</strong></span></div><div className="mt-4 grid grid-cols-2 gap-2"><InfoBox label="Incremento mínimo" value={money(auction.minIncrement)} /><InfoBox label="Próximo mínimo" value={money(auction.nextMinimum)} /></div></div>

            <div className={`p-5 sm:p-6 ${ending && !ended ? 'bg-[#ff633c]/[.07]' : ''}`}><div className="flex items-center justify-between gap-3"><p className="text-[8px] font-black uppercase tracking-[.14em] text-white/30">{ended ? 'Encerrado' : 'Tempo restante'}</p>{ending && !ended && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff633c] px-2.5 py-1 text-[8px] font-black uppercase tracking-[.1em]"><Flame className="h-3 w-3" /> reta final</span>}</div><div className="mt-3 grid grid-cols-4 gap-2">{splitCountdown(remaining).map((item) => <div key={item.label} className={`rounded-xl px-1 py-3 text-center ${ending && !ended ? 'bg-[#ff633c]/12' : 'bg-white/[.045]'}`}><strong className="block text-xl font-black">{item.value}</strong><span className="mt-1 block text-[6px] font-black uppercase tracking-[.12em] text-white/25">{item.label}</span></div>)}</div><div className="mt-3 rounded-xl border border-[#ff8f68]/15 bg-[#ff633c]/[.06] px-3 py-2 text-[9px] leading-4 text-[#ffb199]"><Bolt className="mr-1 inline h-3.5 w-3.5" /> Lance válido nos últimos <strong>30 segundos</strong> reinicia o relógio para 30s. A prorrogação pode acontecer quantas vezes forem necessárias.</div></div>

            <div id="auction-bid-box" className="border-t border-white/[.07] p-5 sm:p-6">{ended ? <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm font-black text-white/60">Este leilão encerrou. O resultado final será confirmado pelo servidor.</div> : !loggedIn ? <><div className="rounded-2xl border border-[#ff7049]/20 bg-[#ff7049]/[.07] p-4"><p className="flex items-center gap-2 text-xs font-black"><LockKeyhole className="h-4 w-4 text-[#ff8b69]" /> Quer disputar?</p><p className="mt-2 text-[10px] leading-5 text-white/42">Assistir é público. Para registrar um lance, entre ou crie sua conta.</p></div><button onClick={onParticipate} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-[#21130f]">Entrar para dar lance <ArrowRight className="h-4 w-4" /></button></> : !bidderReady ? <><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.07] p-4"><p className="flex items-center gap-2 text-xs font-black text-amber-200"><ShieldCheck className="h-4 w-4" /> Complete o passe</p><p className="mt-2 text-[10px] leading-5 text-white/42">WhatsApp verificado e foto de perfil são obrigatórios para participar.</p></div><button onClick={onSetup} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff633c] text-sm font-black">Completar perfil <Sparkles className="h-4 w-4" /></button></> : <><div className="flex items-center justify-between gap-3"><label className="text-[9px] font-black uppercase tracking-[.13em] text-white/35">Seu lance</label><span className="text-[9px] font-black text-white/30">Incremento {money(auction.minIncrement)}</span></div><div className="relative mt-2"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-white/30">R$</span><input value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} inputMode="decimal" placeholder={toInputMoney(auction.nextMinimum)} className={`h-14 w-full rounded-2xl border bg-black/20 pl-11 pr-4 text-xl font-black text-white outline-none ${validation.valid ? 'border-emerald-400/30 focus:border-emerald-400/60' : bidAmount.trim() ? 'border-red-400/35 focus:border-red-400/65' : 'border-white/10 focus:border-[#ff7049]/50'}`} /></div><div className="mt-2 min-h-8">{validation.message && <p className={`text-[9px] leading-4 ${validation.valid ? 'text-emerald-300' : 'text-red-300'}`}>{validation.message}</p>}</div><div className="mt-2 grid grid-cols-3 gap-2"><SuggestionButton label="Mínimo" value={money(auction.nextMinimum)} onClick={() => onFillSuggestion(0)} /><SuggestionButton label="+1 inc." value={money(Number(auction.nextMinimum) + Number(auction.minIncrement))} onClick={() => onFillSuggestion(1)} /><SuggestionButton label="+3 inc." value={money(Number(auction.nextMinimum) + Number(auction.minIncrement) * 3)} onClick={() => onFillSuggestion(3)} /></div><button onClick={onBid} disabled={bidding || !validation.valid} className="mt-4 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5d37] to-[#ff8a55] px-5 py-3.5 text-sm font-black shadow-[0_14px_35px_rgba(255,93,55,.22)] disabled:cursor-not-allowed disabled:opacity-35">{bidding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gavel className="h-5 w-5" />} Confirmar lance</button></>}</div>
          </div>{canCancel && <p className="mt-3 text-center text-[9px] text-white/25">A empresa anunciante pode cancelar enquanto não houver nenhum lance.</p>}</aside>
        </div>
      </div>
    </main>
  );
}

function AuctionImage({ auction, large = false }: { auction: PublicClassifiedAuction; large?: boolean }) {
  return <div className={`relative overflow-hidden bg-[#201410] ${large ? 'min-h-[320px] sm:min-h-[430px]' : 'aspect-[1.35/1]'}`}>{auction.image ? <img src={auction.image} alt={auction.title} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-white/15"><ImageIcon className="h-14 w-14" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-[#120a08]/85 via-transparent to-black/10" /><span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-[#ff633c] px-3 py-1.5 text-[8px] font-black uppercase tracking-[.12em]"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Ao vivo</span></div>;
}

function AuctionCard({ auction, now, onOpen }: { auction: PublicClassifiedAuction; now: number; onOpen: () => void }) {
  return <button onClick={onOpen} className="group overflow-hidden rounded-[26px] border border-white/[.08] bg-[#15100e] text-left transition hover:-translate-y-1 hover:border-[#ff7049]/30"><AuctionImage auction={auction} /><div className="p-4"><p className="text-[8px] font-black uppercase tracking-[.13em] text-[#ff8c6b]">{auction.companyName}</p><h3 className="mt-2 line-clamp-2 text-base font-black">{auction.title}</h3><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[.12em] text-white/28">Lance atual</p><p className="mt-1 text-2xl font-black">{money(auctionCurrentValue(auction))}</p></div><span className="rounded-xl bg-white/[.05] px-2.5 py-2 text-[9px] font-black text-white/50"><Clock3 className="mr-1 inline h-3.5 w-3.5 text-[#ff8b69]" /> {compactCountdown(new Date(auction.endsAt).getTime() - now)}</span></div><div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[.06] pt-3"><span className="text-[9px] font-bold text-white/35">Incremento {money(auction.minIncrement)}</span><span className="text-right text-[9px] font-bold text-white/35">{auction.bidCount} lance{auction.bidCount === 1 ? '' : 's'}</span></div></div></button>;
}

function CreateAuctionPanel({ listings, form, setForm, creating, onCreate, onClose }: { listings: ClassifiedListing[]; form: { listingId: string; startPrice: string; minIncrement: string; startsAt: string; endsAt: string }; setForm: React.Dispatch<React.SetStateAction<{ listingId: string; startPrice: string; minIncrement: string; startsAt: string; endsAt: string }>>; creating: boolean; onCreate: () => void; onClose: () => void }) {
  const increment = parseMoneyInput(form.minIncrement);
  const start = parseMoneyInput(form.startPrice);
  const incrementValid = Number.isFinite(increment) && increment > 0;
  const startValid = Number.isFinite(start) && start > 0;
  const formValid = Boolean(form.listingId && startValid && incrementValid && form.endsAt);
  return <section className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-[#17100e] text-white shadow-[0_35px_100px_rgba(0,0,0,.5)]"><div className="flex items-start justify-between gap-4 border-b border-white/[.07] p-5 sm:p-6"><div><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#ff8b69]"><Crown className="h-4 w-4" /> Elite</p><h2 className="mt-2 font-serif text-3xl font-black">Abrir leilão</h2><p className="mt-2 text-xs leading-5 text-white/40">O incremento é a diferença mínima que cada novo lance precisa superar.</p></div><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[.06] text-white/50"><X className="h-4 w-4" /></button></div><div className="space-y-4 p-5 sm:p-6"><DarkField label="Produto"><select value={form.listingId} onChange={(event) => setForm((current) => ({ ...current, listingId: event.target.value }))} className="auction-input"><option value="">Selecione</option>{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}</select></DarkField><div className="grid gap-3 sm:grid-cols-2"><DarkField label="Lance inicial"><input value={form.startPrice} onChange={(event) => setForm((current) => ({ ...current, startPrice: event.target.value }))} inputMode="decimal" placeholder="100,00" className={`auction-input ${form.startPrice && !startValid ? 'auction-input-error' : ''}`} /></DarkField><DarkField label="Incremento mínimo"><input value={form.minIncrement} onChange={(event) => setForm((current) => ({ ...current, minIncrement: event.target.value }))} inputMode="decimal" placeholder="5,00" className={`auction-input ${form.minIncrement && !incrementValid ? 'auction-input-error' : ''}`} />{form.minIncrement && <p className={`mt-1 text-[9px] ${incrementValid ? 'text-emerald-300' : 'text-red-300'}`}>{incrementValid ? `Cada novo lance deverá subir pelo menos ${money(increment)}.` : 'Informe um incremento maior que zero.'}</p>}</DarkField></div><div className="grid gap-3 sm:grid-cols-2"><DarkField label="Começa em · opcional"><input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} className="auction-input" /><p className="mt-1 text-[9px] leading-4 text-white/30">Deixe vazio para começar imediatamente. Agendado, o leilão já ganha URL pública antes da abertura.</p></DarkField><DarkField label="Encerra em"><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="auction-input" /></DarkField></div><div className="rounded-2xl border border-[#ff7049]/15 bg-[#ff633c]/[.06] p-3 text-[10px] leading-5 text-[#ffb099]"><Bolt className="mr-1 inline h-3.5 w-3.5" /> Anti-sniping automático: lance aceito faltando até 30s redefine o encerramento para 30s a partir daquele lance.</div>{!listings.length && <p className="rounded-2xl border border-amber-300/15 bg-amber-300/[.07] p-3 text-xs text-amber-100">Nenhum produto publicado disponível.</p>}<button onClick={onCreate} disabled={creating || !formValid} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5d37] to-[#ff8a55] text-sm font-black disabled:opacity-35">{creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gavel className="h-5 w-5" />} Colocar na arena</button></div><style>{`.auction-input{width:100%;height:46px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:#0d0908;padding:0 13px;color:white;font-size:13px;font-weight:800;outline:none}.auction-input:focus{border-color:rgba(255,112,73,.55)}.auction-input-error{border-color:rgba(248,113,113,.55)}.auction-input option{color:#21130f}`}</style></section>;
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto bg-[#050302] px-4 py-8 sm:items-center"><button className="fixed inset-0 cursor-default" aria-label="Fechar" onClick={onClose} /><div className="relative z-10 w-full max-w-3xl">{children}</div></div>;
}

function SuggestionButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-white/[.08] bg-white/[.045] px-2 py-2.5 text-left hover:border-[#ff7049]/30 hover:bg-[#ff633c]/[.07]"><span className="block text-[7px] font-black uppercase tracking-[.1em] text-white/30">{label}</span><strong className="mt-1 block text-[10px] text-white/70">{value}</strong></button>;
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="rounded-2xl border border-white/[.08] bg-[#15100e] p-3"><div className="flex items-center gap-2 text-[#ff8c6b]">{icon}<strong className="text-lg text-white">{value}</strong></div><p className="mt-1 text-[8px] font-black uppercase tracking-[.12em] text-white/28">{label}</p></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/[.045] p-3"><span className="block text-[7px] font-black uppercase tracking-[.11em] text-white/28">{label}</span><strong className="mt-1 block text-xs">{value}</strong></div>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/[.045] p-3"><span className="block text-[7px] font-black uppercase tracking-[.11em] text-white/28">{label}</span><strong className="mt-1 block text-sm text-white/80">{value}</strong></div>;
}

function DarkField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.13em] text-white/35">{label}</span>{children}</label>;
}

function EmptyLobby({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return <section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8"><Gavel className="mx-auto h-12 w-12 text-[#ff7049]/40" /><h2 className="mt-4 font-serif text-3xl font-black">A arena está silenciosa.</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/40">Quando um produto entrar em leilão, ele aparecerá aqui.</p>{canCreate && <button onClick={onCreate} className="mt-6 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#21130f]">Abrir primeiro leilão</button>}</section>;
}

type BidValidation = { valid: boolean; message: string };

function validateBid(auction: PublicClassifiedAuction | null, raw: string): BidValidation {
  if (!auction || !raw.trim()) return { valid: false, message: '' };
  const amount = parseMoneyInput(raw);
  if (!Number.isFinite(amount) || amount <= 0) return { valid: false, message: 'Digite um valor de lance válido.' };
  const minimum = Number(auction.nextMinimum || 0);
  const increment = Number(auction.minIncrement || 0);
  if (amount + 0.0001 < minimum) {
    return {
      valid: false,
      message: `Lance insuficiente. O mínimo é ${money(minimum)} porque o incremento obrigatório é ${money(increment)}. Faltam ${money(minimum - amount)}.`,
    };
  }
  return { valid: true, message: `Lance válido. Você está respeitando o incremento mínimo de ${money(increment)}.` };
}

function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return NaN;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  return Number(normalized);
}

function toInputMoney(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(2).replace('.', ',') : '';
}

function money(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(number) ? number : 0);
}

function splitCountdown(ms: number) {
  let seconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  return [
    { label: 'dias', value: String(days).padStart(2, '0') },
    { label: 'horas', value: String(hours).padStart(2, '0') },
    { label: 'min', value: String(minutes).padStart(2, '0') },
    { label: 'seg', value: String(seconds).padStart(2, '0') },
  ];
}

function compactCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.floor(total / 60)}m ${total % 60}s`;
  if (total < 86400) return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
  return `${Math.floor(total / 86400)}d ${Math.floor((total % 86400) / 3600)}h`;
}
