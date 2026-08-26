import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bolt,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Gavel,
  ImageIcon,
  Loader2,
  LockKeyhole,
  MapPin,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuctionBidderSetup } from '../components/classifieds/AuctionBidderSetup';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';
import { useAuth } from '../contexts/AuthContext';
import {
  auctionCurrentValue,
  invalidatePublicAuctions,
  loadPublicAuctionDetail,
  loadPublicAuctions,
  type PublicClassifiedAuction,
} from '../lib/classifiedsAuctions';
import { api } from '../lib/api';
import type { ClassifiedListing, ClassifiedLimits, ClassifiedWorkspaceContextData } from '../types/classifieds';

type SellerContext = {
  context: ClassifiedWorkspaceContextData | null;
  limits: ClassifiedLimits | null;
  listings: ClassifiedListing[];
};

const emptySellerContext: SellerContext = { context: null, limits: null, listings: [] };

export default function ClassifiedsAuctionsLivePage() {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [auctions, setAuctions] = useState<PublicClassifiedAuction[]>([]);
  const [detail, setDetail] = useState<PublicClassifiedAuction | null>(null);
  const [seller, setSeller] = useState<SellerContext>(emptySellerContext);
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
  const [createForm, setCreateForm] = useState({ listingId: '', startPrice: '', minIncrement: '5', endsAt: '' });

  const load = async (force = false) => {
    setLoading(true);
    try {
      const rows = await loadPublicAuctions(force);
      setAuctions(rows);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os leilões ao vivo.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!auctionId) { setDetail(null); return; }
    setDetailLoading(true);
    loadPublicAuctionDetail(auctionId)
      .then((row) => active && setDetail(row))
      .catch((requestError: any) => active && setError(requestError?.response?.data?.message || 'Leilão não encontrado.'))
      .finally(() => active && setDetailLoading(false));
    return () => { active = false; };
  }, [auctionId]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setSeller(emptySellerContext);
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
      const listings = listingsResult.status === 'fulfilled' && Array.isArray(listingsResult.value.data) ? listingsResult.value.data as ClassifiedListing[] : [];
      setSeller({ context, limits, listings });
      const whatsappVerified = whatsappResult.status === 'fulfilled' && Boolean(whatsappResult.value.data?.verified);
      setBidderReady(Boolean((user.email || profile?.email) && profile?.photoURL && whatsappVerified));
    });
    return () => { active = false; };
  }, [user?.uid, profile?.photoURL, profile?.email]);

  const liveAuctions = useMemo(() => auctions.filter((auction) => auction.live && new Date(auction.endsAt).getTime() > now), [auctions, now]);
  const featured = liveAuctions[0] || null;
  const totalBids = liveAuctions.reduce((sum, auction) => sum + Number(auction.bidCount || 0), 0);
  const totalValue = liveAuctions.reduce((sum, auction) => sum + auctionCurrentValue(auction), 0);
  const companyId = seller.context?.activeIdentity === 'COMPANY' ? seller.context.company?.id : null;
  const canCreate = Boolean(user && seller.context?.activeIdentity === 'COMPANY' && seller.limits?.auctionCreation && String(seller.limits?.plan).toUpperCase() === 'ELITE');
  const eligibleListings = seller.listings.filter((listing) => listing.listingType === 'PRODUCT' && listing.status === 'PUBLISHED' && !liveAuctions.some((auction) => auction.listingId === listing.id));

  const goToAuction = (auction: PublicClassifiedAuction) => navigate(`/classificados/leiloes/${auction.id}`);

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
    const minimum = Number(detail.nextMinimum || detail.startPrice || 0);
    setBidAmount((current) => current || minimum.toFixed(2).replace('.', ','));
    requestAnimationFrame(() => document.getElementById('auction-bid-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const submitBid = async () => {
    if (!detail || !user || bidding) return;
    if (!bidderReady) { setSetupOpen(true); return; }
    setBidding(true); setError('');
    try {
      await api.post(`/classifieds/auctions/${detail.id}/bids`, { amount: bidAmount });
      invalidatePublicAuctions();
      const [nextDetail, nextList] = await Promise.all([loadPublicAuctionDetail(detail.id), loadPublicAuctions(true)]);
      setDetail(nextDetail);
      setAuctions(nextList);
      setBidAmount(Number(nextDetail.nextMinimum || 0).toFixed(2).replace('.', ','));
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'Não foi possível registrar o lance.';
      setError(message);
      if (/WhatsApp|foto|e-mail|perfil/i.test(String(message))) setSetupOpen(true);
    } finally { setBidding(false); }
  };

  const createAuction = async () => {
    if (!canCreate || creating) return;
    setCreating(true); setError('');
    try {
      const endsAt = createForm.endsAt ? new Date(`${createForm.endsAt}:00-03:00`).toISOString() : '';
      const response = await api.post('/classifieds/me/auctions', {
        listingId: createForm.listingId,
        startPrice: createForm.startPrice,
        minIncrement: createForm.minIncrement,
        endsAt,
      });
      invalidatePublicAuctions();
      await load(true);
      setCreateOpen(false);
      setCreateForm({ listingId: '', startPrice: '', minIncrement: '5', endsAt: '' });
      if (response.data?.id) navigate(`/classificados/leiloes/${response.data.id}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível abrir o leilão.');
    } finally { setCreating(false); }
  };

  const cancelAuction = async () => {
    if (!detail || !canCreate || detail.companyId !== companyId || detail.bidCount > 0) return;
    if (!window.confirm('Cancelar este leilão sem lances?')) return;
    try {
      await api.post(`/classifieds/me/auctions/${detail.id}/cancel`);
      invalidatePublicAuctions();
      navigate('/classificados/leiloes');
      await load(true);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível cancelar o leilão.');
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0d0908] text-white">
      <SeoHead title="Leilões ao vivo | PiraNegócios Classificados" description="Acompanhe leilões públicos de produtos da região, veja lances em tempo real e participe com sua conta PiraNegócios." canonical={`${window.location.origin}/classificados/leiloes`} />
      <div className="relative z-50 bg-[#f6f4f1] text-[#2d211c]"><Navbar /></div>

      <main className="relative">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="auction-orb absolute -left-32 top-20 h-[420px] w-[420px] rounded-full bg-[#ff5e36]/12 blur-[110px]" />
          <div className="auction-orb auction-orb-delay absolute right-[-180px] top-[280px] h-[520px] w-[520px] rounded-full bg-[#ffb347]/8 blur-[130px]" />
          <div className="absolute inset-0 opacity-[.14] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
        </div>

        <section className="relative border-b border-white/[.07]">
          <div className="mx-auto max-w-7xl px-4 pb-8 pt-7 sm:px-6 lg:px-8 lg:pb-11 lg:pt-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6b43]/25 bg-[#ff6b43]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.19em] text-[#ff9a78]"><Radio className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" /> Arena pública · ao vivo</div>
                <h1 className="mt-4 max-w-4xl font-serif text-4xl font-black leading-[.93] tracking-[-.045em] sm:text-6xl lg:text-[72px]">O relógio corre.<br /><span className="auction-text">O lance decide.</span></h1>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-white/48 sm:text-base sm:leading-7">Entre para assistir. Crie sua conta somente quando quiser disputar. Cada produto tem uma sala pública, lance atual e contagem regressiva aberta.</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">
                <LiveMetric icon={<Gavel className="h-4 w-4" />} value={String(liveAuctions.length)} label="leilões agora" />
                <LiveMetric icon={<Bolt className="h-4 w-4" />} value={String(totalBids)} label="lances registrados" />
                <LiveMetric icon={<Flame className="h-4 w-4" />} value={money(totalValue)} label="em disputa" />
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-white/[.07] pt-5">
              <Link to="/classificados" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-4 py-2 text-xs font-black text-white/70 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar aos Classificados</Link>
              {!user && <Link to={`/login?returnTo=${encodeURIComponent('/classificados/leiloes')}&intent=auction`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-[#241612]">Entrar para participar <ArrowRight className="h-4 w-4" /></Link>}
              {canCreate && <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff5f39] to-[#ff8b55] px-4 py-2 text-xs font-black text-white shadow-[0_8px_30px_rgba(255,95,57,.22)]"><Crown className="h-4 w-4" /> Criar leilão Elite</button>}
            </div>
          </div>
        </section>

        {error && <div className="relative mx-auto mt-5 max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between gap-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs font-bold text-red-200"><span>{error}</span><button onClick={() => setError('')} aria-label="Fechar"><X className="h-4 w-4" /></button></div></div>}

        {loading ? <LoadingArena /> : liveAuctions.length ? <>
          {featured && <section className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
            <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#ff8664]">No centro da arena</p><h2 className="mt-1 font-serif text-2xl font-black sm:text-3xl">Disputa em destaque</h2></div><button type="button" onClick={() => goToAuction(featured)} className="hidden items-center gap-1 text-xs font-black text-white/50 hover:text-white sm:flex">Abrir sala <ChevronRight className="h-4 w-4" /></button></div>
            <FeaturedAuction auction={featured} now={now} onOpen={() => goToAuction(featured)} />
          </section>}

          <AuctionTicker auctions={liveAuctions} />

          <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#ff8664]">Salas abertas</p><h2 className="mt-1 font-serif text-2xl font-black sm:text-3xl">Escolha sua disputa</h2></div><p className="hidden max-w-md text-right text-xs leading-5 text-white/35 md:block">Você pode acompanhar tudo sem login. A conta só é exigida na hora de registrar um lance.</p></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{liveAuctions.map((auction, index) => <AuctionCard key={auction.id} auction={auction} now={now} hot={index < 2} onOpen={() => goToAuction(auction)} />)}</div>
          </section>
        </> : <EmptyArena canCreate={canCreate} onCreate={() => setCreateOpen(true)} />}

        <section className="relative border-t border-white/[.07] bg-white/[.025]">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:px-6 md:grid-cols-3 lg:px-8">
            <TrustPoint icon={<ShieldCheck className="h-5 w-5" />} title="Identidade antes do lance" text="E-mail, WhatsApp confirmado e foto de perfil são exigidos para participar." />
            <TrustPoint icon={<Radio className="h-5 w-5" />} title="Vitrine pública" text="Assistir aos leilões e acompanhar valores não exige cadastro." />
            <TrustPoint icon={<LockKeyhole className="h-5 w-5" />} title="Negociação direta" text="Nesta fase, pagamento e entrega são combinados diretamente com o anunciante após o encerramento." />
          </div>
        </section>
      </main>

      {(auctionId || detailLoading) && <AuctionRoom
        auction={detail}
        loading={detailLoading}
        now={now}
        loggedIn={Boolean(user)}
        bidderReady={bidderReady}
        bidAmount={bidAmount}
        setBidAmount={setBidAmount}
        bidding={bidding}
        onParticipate={participate}
        onBid={() => void submitBid()}
        onClose={() => navigate('/classificados/leiloes')}
        canCancel={Boolean(detail && canCreate && detail.companyId === companyId && detail.bidCount === 0)}
        onCancel={() => void cancelAuction()}
      />}

      {setupOpen && user && <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-md sm:items-center"><button className="fixed inset-0" aria-label="Fechar configuração" onClick={() => setSetupOpen(false)} /><div className="relative z-10 w-full max-w-3xl"><AuctionBidderSetup onClose={() => setSetupOpen(false)} onReady={() => { setBidderReady(true); setSetupOpen(false); if (detail) setBidAmount(Number(detail.nextMinimum || 0).toFixed(2).replace('.', ',')); }} /></div></div>}

      {createOpen && canCreate && <CreateAuctionModal listings={eligibleListings} form={createForm} setForm={setCreateForm} creating={creating} onCreate={() => void createAuction()} onClose={() => setCreateOpen(false)} />}

      <style>{`
        @keyframes auctionOrb{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(55px,30px,0) scale(1.12)}}
        @keyframes auctionTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes auctionGlow{0%,100%{opacity:.45;transform:scale(.98)}50%{opacity:.9;transform:scale(1.02)}}
        @keyframes auctionPingSoft{0%{transform:scale(.8);opacity:.9}100%{transform:scale(2.6);opacity:0}}
        .auction-orb{animation:auctionOrb 14s ease-in-out infinite}.auction-orb-delay{animation-delay:-6s}.auction-text{background:linear-gradient(90deg,#fff,#ff9f7e 45%,#ffd08f);-webkit-background-clip:text;background-clip:text;color:transparent}.auction-ticker-track{animation:auctionTicker 32s linear infinite}.auction-glow{animation:auctionGlow 3.2s ease-in-out infinite}.auction-ping{animation:auctionPingSoft 1.8s ease-out infinite}
        @media (prefers-reduced-motion:reduce){.auction-orb,.auction-ticker-track,.auction-glow,.auction-ping{animation:none!important}}
      `}</style>
    </div>
  );
}

function FeaturedAuction({ auction, now, onOpen }: { auction: PublicClassifiedAuction; now: number; onOpen: () => void }) {
  const countdown = splitCountdown(new Date(auction.endsAt).getTime() - now);
  return <button type="button" onClick={onOpen} className="group relative grid w-full overflow-hidden rounded-[34px] border border-white/10 bg-[#17100e] text-left shadow-[0_35px_120px_rgba(0,0,0,.32)] lg:grid-cols-[1.05fr_.95fr]">
    <div className="relative min-h-[330px] overflow-hidden sm:min-h-[420px] lg:min-h-[500px]">
      {auction.image ? <img src={auction.image} alt={auction.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" /> : <div className="absolute inset-0 flex items-center justify-center bg-[#241613] text-white/20"><ImageIcon className="h-16 w-16" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-[#120a08] via-[#120a08]/15 to-black/10 lg:bg-gradient-to-r lg:from-transparent lg:via-black/10 lg:to-[#17100e]" />
      <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-2 text-[9px] font-black uppercase tracking-[.15em] backdrop-blur-md"><span className="relative flex h-2 w-2"><span className="auction-ping absolute inset-0 rounded-full bg-[#ff6842]" /><span className="relative h-2 w-2 rounded-full bg-[#ff6842]" /></span> Ao vivo</div>
      <div className="absolute inset-x-5 bottom-5 lg:hidden"><p className="text-[9px] font-black uppercase tracking-[.15em] text-white/50">{auction.companyName}</p><h3 className="mt-1 font-serif text-3xl font-black leading-none">{auction.title}</h3></div>
    </div>
    <div className="relative flex flex-col justify-center p-6 sm:p-8 lg:p-10">
      <div className="auction-glow pointer-events-none absolute right-[-80px] top-[-80px] h-64 w-64 rounded-full bg-[#ff5e36]/12 blur-[80px]" />
      <div className="relative hidden lg:block"><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.18em] text-[#ff8866]">{auction.sellerVerifiedSnapshot && <BadgeCheck className="h-4 w-4" />} {auction.companyName}</p><h3 className="mt-3 font-serif text-4xl font-black leading-[.98] tracking-[-.035em] xl:text-5xl">{auction.title}</h3><p className="mt-4 line-clamp-3 text-sm leading-6 text-white/42">{auction.description}</p></div>
      <div className="relative mt-1 grid grid-cols-2 gap-3 lg:mt-8">
        <div className="rounded-2xl border border-white/10 bg-white/[.045] p-4"><p className="text-[8px] font-black uppercase tracking-[.15em] text-white/35">Lance atual</p><p className="mt-1 text-2xl font-black tracking-tight text-[#ff9c78] sm:text-3xl">{money(auctionCurrentValue(auction))}</p><p className="mt-2 text-[10px] font-bold text-white/35">Próximo: {money(auction.nextMinimum)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.045] p-4"><p className="text-[8px] font-black uppercase tracking-[.15em] text-white/35">Movimento</p><p className="mt-1 flex items-center gap-2 text-2xl font-black sm:text-3xl"><Users className="h-5 w-5 text-[#ff8a68]" /> {auction.bidCount}</p><p className="mt-2 text-[10px] font-bold text-white/35">lance{auction.bidCount === 1 ? '' : 's'} até agora</p></div>
      </div>
      <div className="relative mt-3 rounded-2xl border border-[#ff6b43]/20 bg-[#ff6b43]/[.07] p-4"><p className="text-[8px] font-black uppercase tracking-[.15em] text-[#ff8b69]">Tempo restante</p><div className="mt-2 grid grid-cols-4 gap-2">{countdown.map((item) => <div key={item.label} className="rounded-xl bg-black/20 px-2 py-3 text-center"><strong className="block text-xl font-black sm:text-2xl">{item.value}</strong><span className="mt-1 block text-[7px] font-black uppercase tracking-[.12em] text-white/30">{item.label}</span></div>)}</div></div>
      <div className="relative mt-4 inline-flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-[#241612]"><span className="text-xs font-black">Entrar na sala de disputa</span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#241612] text-white"><ArrowRight className="h-4 w-4" /></span></div>
    </div>
  </button>;
}

function AuctionTicker({ auctions }: { auctions: PublicClassifiedAuction[] }) {
  const rows = [...auctions, ...auctions];
  return <div className="relative overflow-hidden border-y border-white/[.07] bg-[#ff633c] py-3 text-[#22130f]"><div className="auction-ticker-track flex w-max items-center whitespace-nowrap">{rows.map((auction, index) => <div key={`${auction.id}-${index}`} className="flex items-center gap-3 px-6 text-[10px] font-black uppercase tracking-[.12em]"><Gavel className="h-3.5 w-3.5" /><span>{auction.title}</span><span className="opacity-55">{money(auctionCurrentValue(auction))}</span><span className="h-1 w-1 rounded-full bg-[#22130f]/35" /></div>)}</div></div>;
}

function AuctionCard({ auction, now, hot, onOpen }: { auction: PublicClassifiedAuction; now: number; hot?: boolean; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="group relative overflow-hidden rounded-[28px] border border-white/[.09] bg-white/[.045] text-left transition duration-300 hover:-translate-y-1 hover:border-[#ff7049]/30 hover:bg-white/[.07]">
    <div className="relative aspect-[1.32/1] overflow-hidden bg-[#211511]">{auction.image ? <img src={auction.image} alt={auction.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" /> : <div className="flex h-full items-center justify-center text-white/15"><ImageIcon className="h-12 w-12" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-[#120a08]/95 via-transparent to-black/15" />
      <div className="absolute left-3 top-3 flex items-center gap-2"><span className="flex items-center gap-1.5 rounded-full bg-[#ff633c] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.12em]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" /> Live</span>{hot && auction.bidCount > 0 && <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.12em] backdrop-blur"><Flame className="mr-1 inline h-3 w-3 text-[#ff8b69]" /> Aquecido</span>}</div>
      <div className="absolute inset-x-4 bottom-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[.14em] text-white/45">Lance atual</p><p className="mt-1 text-2xl font-black tracking-tight">{money(auctionCurrentValue(auction))}</p></div><span className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-[9px] font-black backdrop-blur"><Clock3 className="mr-1 inline h-3 w-3 text-[#ff8b69]" /> {compactCountdown(new Date(auction.endsAt).getTime() - now)}</span></div></div>
    </div>
    <div className="p-4"><div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.13em] text-[#ff8d6b]">{auction.sellerVerifiedSnapshot && <BadgeCheck className="h-3.5 w-3.5" />}{auction.companyName}</div><h3 className="mt-2 line-clamp-2 text-base font-black leading-tight">{auction.title}</h3><div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[.07] pt-3"><span className="flex items-center gap-1.5 text-[9px] font-bold text-white/35"><Users className="h-3.5 w-3.5" /> {auction.bidCount} lance{auction.bidCount === 1 ? '' : 's'}</span><span className="flex items-center gap-1.5 text-[9px] font-bold text-white/35"><MapPin className="h-3.5 w-3.5" /> {auction.city}/{auction.state}</span><ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white" /></div></div>
  </button>;
}

function AuctionRoom({ auction, loading, now, loggedIn, bidderReady, bidAmount, setBidAmount, bidding, onParticipate, onBid, onClose, canCancel, onCancel }: { auction: PublicClassifiedAuction | null; loading: boolean; now: number; loggedIn: boolean; bidderReady: boolean; bidAmount: string; setBidAmount: (value: string) => void; bidding: boolean; onParticipate: () => void; onBid: () => void; onClose: () => void; canCancel: boolean; onCancel: () => void }) {
  return <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#090605]/96 backdrop-blur-xl"><div className="sticky top-0 z-20 border-b border-white/[.07] bg-[#0d0908]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"><button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-xs font-black text-white/55 hover:text-white"><ArrowLeft className="h-4 w-4" /> Todos os leilões</button><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#ff8664]"><Radio className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" /> Sala ao vivo</div></div></div>
    {loading || !auction ? <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff7049]" /></div> : <div className="mx-auto grid max-w-7xl gap-8 px-4 py-7 sm:px-6 lg:grid-cols-[1.12fr_.88fr] lg:px-8 lg:py-10">
      <div className="min-w-0"><div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#18100e] shadow-[0_35px_100px_rgba(0,0,0,.28)]"><div className="relative aspect-[1.18/1] overflow-hidden sm:aspect-[1.45/1]">{auction.image ? <img src={auction.image} alt={auction.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/15"><ImageIcon className="h-16 w-16" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-[#120a08] via-transparent to-black/10" /><span className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-[#ff633c] px-3 py-2 text-[9px] font-black uppercase tracking-[.14em]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" /> Leilão ao vivo</span></div><div className="p-5 sm:p-7"><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#ff8d6b]">{auction.sellerVerifiedSnapshot && <BadgeCheck className="h-4 w-4" />}{auction.companyName}</p><h1 className="mt-2 font-serif text-3xl font-black leading-[.98] tracking-[-.035em] sm:text-5xl">{auction.title}</h1><p className="mt-4 text-sm leading-6 text-white/45">{auction.description}</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[10px] font-bold text-white/50"><MapPin className="mr-1 inline h-3.5 w-3.5" /> {auction.neighborhood ? `${auction.neighborhood}, ` : ''}{auction.city}/{auction.state}</span><Link to={`/classificados/anuncio/${auction.slug}`} className="rounded-full bg-white/[.06] px-3 py-1.5 text-[10px] font-black text-white/65 hover:bg-white/10">Ver anúncio completo</Link></div></div></div>
        <div className="mt-5 rounded-[28px] border border-white/[.08] bg-white/[.035] p-5"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-white/35">Histórico público</p><h2 className="mt-1 text-lg font-black">Últimos lances</h2></div><span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[9px] font-black text-white/45">nomes protegidos</span></div><div className="mt-4 space-y-2">{auction.bids?.length ? auction.bids.slice(0, 10).map((bid, index) => <div key={bid.id} className={`flex items-center justify-between gap-4 rounded-2xl px-4 py-3 ${index === 0 ? 'border border-[#ff7049]/20 bg-[#ff7049]/[.08]' : 'bg-white/[.035]'}`}><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${index === 0 ? 'bg-[#ff633c] text-white' : 'bg-white/[.06] text-white/35'}`}>{index === 0 ? <Trophy className="h-4 w-4" /> : <Gavel className="h-3.5 w-3.5" />}</span><div><p className="text-xs font-black">{bid.bidderName}</p><p className="text-[9px] text-white/30">{new Date(bid.createdAt).toLocaleString('pt-BR')}</p></div></div><strong className={index === 0 ? 'text-[#ff9c78]' : 'text-white/70'}>{money(bid.amount)}</strong></div>) : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/35">Ainda não há lances. O primeiro pode ser seu.</div>}</div></div>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start"><div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#18100e] shadow-[0_30px_100px_rgba(0,0,0,.30)]"><div className="border-b border-white/[.07] p-5 sm:p-6"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#ff8664]">Lance líder</p><p className="mt-2 text-4xl font-black tracking-[-.04em] sm:text-5xl">{money(auctionCurrentValue(auction))}</p><div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold text-white/35"><span>{auction.bidCount} lance{auction.bidCount === 1 ? '' : 's'}</span><span>mín. próximo {money(auction.nextMinimum)}</span></div></div><div className="p-5 sm:p-6"><p className="text-[8px] font-black uppercase tracking-[.15em] text-white/35">Encerra em</p><div className="mt-3 grid grid-cols-4 gap-2">{splitCountdown(new Date(auction.endsAt).getTime() - now).map((item) => <div key={item.label} className="rounded-xl bg-white/[.045] px-1 py-3 text-center"><strong className="block text-xl font-black">{item.value}</strong><span className="mt-1 block text-[6px] font-black uppercase tracking-[.12em] text-white/25">{item.label}</span></div>)}</div></div><div id="auction-bid-box" className="border-t border-white/[.07] p-5 sm:p-6">{!loggedIn ? <><div className="rounded-2xl border border-[#ff7049]/20 bg-[#ff7049]/[.07] p-4"><p className="flex items-center gap-2 text-xs font-black"><LockKeyhole className="h-4 w-4 text-[#ff8b69]" /> Quer entrar na disputa?</p><p className="mt-2 text-[10px] leading-5 text-white/42">Assistir é público. Para dar lance, entre ou crie sua conta e volte exatamente para esta sala.</p></div><button type="button" onClick={onParticipate} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-[#21130f]">Entrar para dar lance <ArrowRight className="h-4 w-4" /></button></> : !bidderReady ? <><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.07] p-4"><p className="flex items-center gap-2 text-xs font-black text-amber-200"><ShieldCheck className="h-4 w-4" /> Falta liberar seu passe</p><p className="mt-2 text-[10px] leading-5 text-white/42">Confirme WhatsApp e foto de perfil sem sair do leilão.</p></div><button type="button" onClick={onParticipate} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff633c] text-sm font-black text-white">Completar perfil <Sparkles className="h-4 w-4" /></button></> : <><label className="block"><span className="text-[9px] font-black uppercase tracking-[.13em] text-white/35">Seu lance</span><div className="relative mt-2"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-white/30">R$</span><input value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} inputMode="decimal" placeholder={Number(auction.nextMinimum).toFixed(2).replace('.', ',')} className="h-14 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-xl font-black text-white outline-none focus:border-[#ff7049]/50" /></div></label><p className="mt-2 text-[9px] leading-4 text-white/28">O lance mínimo agora é {money(auction.nextMinimum)}. Lances registrados não podem ser apagados.</p><button type="button" onClick={onBid} disabled={bidding || !bidAmount.trim()} className="mt-4 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5d37] to-[#ff8a55] px-5 py-3.5 text-sm font-black text-white shadow-[0_14px_35px_rgba(255,93,55,.22)] disabled:opacity-40">{bidding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gavel className="h-5 w-5" />} Confirmar lance</button></>}</div>{canCancel && <div className="border-t border-white/[.07] p-4"><button onClick={onCancel} className="w-full rounded-xl bg-red-500/10 px-4 py-2 text-xs font-black text-red-300 hover:bg-red-500/15">Cancelar leilão sem lances</button></div>}</div><div className="mt-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-4 text-[9px] leading-4 text-white/30"><strong className="text-white/55">Negociação direta:</strong> nesta versão, o PiraNegócios organiza a disputa e conecta vencedor e anunciante. Não há custódia/escrow do valor.</div></aside>
    </div>}
  </div>;
}

function CreateAuctionModal({ listings, form, setForm, creating, onCreate, onClose }: { listings: ClassifiedListing[]; form: { listingId: string; startPrice: string; minIncrement: string; endsAt: string }; setForm: React.Dispatch<React.SetStateAction<{ listingId: string; startPrice: string; minIncrement: string; endsAt: string }>>; creating: boolean; onCreate: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-xl sm:items-center"><button className="fixed inset-0" onClick={onClose} aria-label="Fechar" /><div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[30px] border border-white/10 bg-[#18100e] text-white shadow-[0_40px_120px_rgba(0,0,0,.45)]"><div className="flex items-start justify-between gap-4 border-b border-white/[.07] p-5 sm:p-6"><div><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em] text-[#ff8b69]"><Crown className="h-4 w-4" /> Recurso Elite</p><h2 className="mt-2 font-serif text-3xl font-black">Abrir um leilão</h2><p className="mt-2 text-xs leading-5 text-white/40">Escolha um produto publicado, lance inicial, incremento e horário de encerramento.</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[.06] text-white/50 hover:bg-white/10"><X className="h-4 w-4" /></button></div><div className="space-y-4 p-5 sm:p-6"><FieldDark label="Produto"><select value={form.listingId} onChange={(event) => setForm((current) => ({ ...current, listingId: event.target.value }))} className="auction-field"><option value="">Selecione um produto</option>{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}</select></FieldDark><div className="grid gap-3 sm:grid-cols-2"><FieldDark label="Lance inicial"><input value={form.startPrice} onChange={(event) => setForm((current) => ({ ...current, startPrice: event.target.value }))} inputMode="decimal" placeholder="100,00" className="auction-field" /></FieldDark><FieldDark label="Incremento mínimo"><input value={form.minIncrement} onChange={(event) => setForm((current) => ({ ...current, minIncrement: event.target.value }))} inputMode="decimal" placeholder="5,00" className="auction-field" /></FieldDark></div><FieldDark label="Encerra em"><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="auction-field" /></FieldDark>{!listings.length && <p className="rounded-2xl border border-amber-300/15 bg-amber-300/[.07] p-3 text-xs leading-5 text-amber-100">Nenhum produto publicado está disponível para um novo leilão. Produtos que já estão em disputa não aparecem aqui.</p>}<button type="button" onClick={onCreate} disabled={creating || !form.listingId || !form.startPrice || !form.minIncrement || !form.endsAt} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5d37] to-[#ff8a55] text-sm font-black disabled:opacity-35">{creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gavel className="h-5 w-5" />} Colocar produto na arena</button></div><style>{`.auction-field{width:100%;height:46px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(0,0,0,.18);padding:0 13px;color:white;font-size:13px;font-weight:800;outline:none}.auction-field:focus{border-color:rgba(255,112,73,.55)}.auction-field option{color:#21130f}`}</style></div></div>;
}

function EmptyArena({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="overflow-hidden rounded-[34px] border border-dashed border-white/15 bg-white/[.035] px-6 py-16 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#ff633c]/10 text-[#ff8664]"><Gavel className="h-7 w-7" /></span><p className="mt-5 text-[9px] font-black uppercase tracking-[.18em] text-[#ff8664]">Arena silenciosa por enquanto</p><h2 className="mt-2 font-serif text-3xl font-black">Nenhum leilão está correndo agora.</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/40">Quando uma empresa Elite abrir uma disputa, ela aparece aqui instantaneamente e qualquer pessoa poderá acompanhar.</p>{canCreate && <button type="button" onClick={onCreate} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#21130f]"><Crown className="h-4 w-4" /> Abrir o primeiro leilão</button>}</div></section>;
}

function LoadingArena() { return <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="overflow-hidden rounded-[28px] border border-white/[.06] bg-white/[.03]"><div className="aspect-[1.32/1] animate-pulse bg-white/[.05]" /><div className="space-y-2 p-4"><div className="h-3 w-1/3 animate-pulse rounded bg-white/[.06]" /><div className="h-5 w-3/4 animate-pulse rounded bg-white/[.06]" /><div className="h-3 animate-pulse rounded bg-white/[.04]" /></div></div>)}</div></section>; }
function LiveMetric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) { return <div className="min-w-[126px] rounded-2xl border border-white/[.08] bg-white/[.045] px-4 py-3 backdrop-blur"><div className="flex items-center gap-2 text-[#ff8866]">{icon}<strong className="text-lg font-black text-white">{value}</strong></div><p className="mt-1 text-[8px] font-black uppercase tracking-[.12em] text-white/30">{label}</p></div>; }
function TrustPoint({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[.055] text-[#ff8968]">{icon}</span><div><p className="text-xs font-black">{title}</p><p className="mt-1 text-[10px] leading-5 text-white/35">{text}</p></div></div>; }
function FieldDark({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-white/35">{label}</span>{children}</label>; }

function splitCountdown(ms: number) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [
    { label: 'dias', value: String(days).padStart(2, '0') },
    { label: 'horas', value: String(hours).padStart(2, '0') },
    { label: 'min', value: String(minutes).padStart(2, '0') },
    { label: 'seg', value: String(seconds).padStart(2, '0') },
  ];
}
function compactCountdown(ms: number) { const parts = splitCountdown(ms); if (Number(parts[0].value) > 0) return `${Number(parts[0].value)}d ${parts[1].value}h`; if (Number(parts[1].value) > 0) return `${Number(parts[1].value)}h ${parts[2].value}m`; return `${parts[2].value}:${parts[3].value}`; }
function money(value: unknown) { const numeric = Number(value); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: numeric % 1 === 0 ? 0 : 2 }).format(Number.isFinite(numeric) ? numeric : 0); }
