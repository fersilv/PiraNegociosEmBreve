import React, { useEffect, useState } from 'react';
import { Clock3, Gavel, Heart, ImageIcon, MapPin, ShieldCheck, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveAuctionForListing, auctionCurrentValue } from '../../lib/classifiedsAuctions';
import { api } from '../../lib/api';
import type { ClassifiedListing } from '../../types/classifieds';
import { ClassifiedMediaFrame } from './ClassifiedMediaFrame';

export function classifiedCommercePricing(listing: Pick<ClassifiedListing, 'price' | 'priceType' | 'commerceConfig'>) {
  if (listing.priceType === 'CONTACT') {
    return { basePrice: null, currentPrice: null, promotionActive: false, pixPrice: null, cardPrice: null, maxInstallments: 1, interestFreeInstallments: 0, promotionEndsAt: null };
  }
  const base = Number(listing.price);
  const promotion = listing.commerceConfig?.promotion;
  const startsAt = promotion?.startsAt ? new Date(promotion.startsAt).getTime() : null;
  const endsAt = promotion?.endsAt ? new Date(promotion.endsAt).getTime() : null;
  const promo = Number(promotion?.price);
  const now = Date.now();
  const promotionActive = Boolean(promotion && Number.isFinite(promo) && (startsAt == null || startsAt <= now) && (endsAt == null || endsAt > now));
  const current = promotionActive ? promo : base;
  const pix = listing.commerceConfig?.paymentPricing?.pix;
  const discount = Number(pix?.discountValue || 0);
  const pixPrice = pix?.enabled && Number.isFinite(current)
    ? pix.discountType === 'FIXED' ? current - discount : current * (1 - discount / 100)
    : current;
  const card = listing.commerceConfig?.paymentPricing?.card;
  const cardPrice = card?.enabled && card.price != null ? Number(card.price) : current;
  return {
    basePrice: Number.isFinite(base) ? base : null,
    currentPrice: Number.isFinite(current) ? Math.max(0, current) : null,
    promotionActive,
    promotionEndsAt: promotionActive ? promotion?.endsAt || null : null,
    pixPrice: Number.isFinite(pixPrice) ? Math.max(0, pixPrice) : null,
    cardPrice: Number.isFinite(cardPrice) ? Math.max(0, cardPrice) : null,
    maxInstallments: card?.enabled ? Math.max(1, Number(card.maxInstallments || 1)) : 1,
    interestFreeInstallments: card?.enabled ? Math.max(0, Number(card.interestFreeInstallments || 0)) : 0,
  };
}

export function classifiedPrice(listing: Pick<ClassifiedListing, 'price' | 'priceType' | 'commerceConfig'>) {
  if (listing.priceType === 'CONTACT') return 'Solicite um orçamento';
  const pricing = classifiedCommercePricing(listing);
  const numeric = pricing.currentPrice;
  if (numeric == null || !Number.isFinite(numeric)) return 'Preço a combinar';
  const formatted = money(numeric);
  if (listing.priceType === 'NEGOTIABLE') return `${formatted} · negociável`;
  if (listing.priceType === 'STARTING_AT') return `A partir de ${formatted}`;
  return formatted;
}

export function ClassifiedListingCard({ listing, compact = false, onFavoriteChange, detailBasePath = '/classificados/anuncio', onClick }: {
  listing: ClassifiedListing;
  compact?: boolean;
  onFavoriteChange?: (listingId: string, favorited: boolean) => void;
  detailBasePath?: string;
  onClick?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [favorited, setFavorited] = useState(Boolean(listing.isFavorite));
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [now, setNow] = useState(Date.now());
  const auction = useLiveAuctionForListing(listing.id);
  const image = listing.images?.[0]?.url;
  const pricing = classifiedCommercePricing(listing);
  const pixSpecial = listing.commerceConfig?.paymentPricing?.pix?.enabled && pricing.pixPrice != null && pricing.currentPrice != null && pricing.pixPrice < pricing.currentPrice;
  const card = listing.commerceConfig?.paymentPricing?.card;

  useEffect(() => {
    if (!auction) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [auction?.id]);

  const toggleFavorite = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (savingFavorite) return;
    setSavingFavorite(true);
    try {
      const response = await api.post(`/classifieds/listings/${listing.id}/favorite`);
      const next = Boolean(response.data?.favorited);
      setFavorited(next);
      onFavoriteChange?.(listing.id, next);
    } finally { setSavingFavorite(false); }
  };

  const target = auction ? `/classificados/leiloes/${encodeURIComponent(auction.id)}` : `${detailBasePath}/${encodeURIComponent(listing.slug)}`;
  const remaining = auction ? countdownLabel(new Date(auction.endsAt).getTime() - now) : '';

  return <Link to={target} onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined} className={`group relative min-w-0 overflow-hidden rounded-[18px] bg-white transition sm:rounded-[22px] ${auction ? 'shadow-[0_16px_45px_rgba(92,28,18,.16)] ring-2 ring-[#e5653f]/35 hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(92,28,18,.24)]' : 'shadow-[0_8px_26px_rgba(45,33,28,.055)] ring-1 ring-[#4b3328]/10 hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(45,33,28,.10)]'}`}>
    {auction && <div className="absolute inset-x-0 top-0 z-20 h-[3px] overflow-hidden bg-[#421f18]"><div className="h-full w-1/2 animate-[auctionSweep_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[#ffb08b] to-transparent motion-reduce:animate-none" /></div>}
    <div className={`relative overflow-hidden ${auction ? 'bg-[#21120e]' : 'bg-[#eee8e2]'} ${compact ? 'aspect-[1.12/1]' : 'aspect-square sm:aspect-[4/3]'}`}>
      {image ? <ClassifiedMediaFrame src={image} alt={listing.title} className="h-full w-full" imageClassName={`transition duration-500 group-hover:scale-[1.02] ${auction ? 'brightness-[.82] saturate-[1.08]' : ''}`} /> : <div className="flex h-full items-center justify-center text-[#9e8d84]"><ImageIcon className="h-9 w-9" /></div>}
      {auction && <div className="absolute inset-0 bg-gradient-to-t from-[#1c0e0b]/85 via-transparent to-[#1c0e0b]/15" />}
      <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5 sm:left-3 sm:top-3">{auction ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff633c] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.13em] text-white shadow-[0_8px_25px_rgba(255,99,60,.35)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" /> Leilão ao vivo</span> : <>{pricing.promotionActive && <span className="rounded-full bg-[#d45442] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white shadow-sm">Oferta</span>}{listing.isFeatured && <span className="rounded-full bg-[#2d211c]/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white backdrop-blur">Destaque</span>}{listing.commerceConfig?.onlineCheckout?.enabled && <span className="rounded-full bg-blue-600/95 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.1em] text-white">Compra online</span>}</>}</div>
      <button type="button" onClick={toggleFavorite} disabled={savingFavorite} aria-label={favorited ? 'Remover dos favoritos' : 'Salvar nos favoritos'} className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/94 text-[#3e3029] shadow-sm backdrop-blur transition hover:scale-105 disabled:opacity-60 sm:right-3 sm:top-3"><Heart className={`h-4.5 w-4.5 ${favorited ? 'fill-[#c96847] text-[#c96847]' : ''}`} /></button>
      {auction && <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-white"><div><p className="text-[8px] font-black uppercase tracking-[.15em] text-white/55">Lance atual</p><p className="mt-0.5 text-lg font-black tracking-tight sm:text-xl">{money(auctionCurrentValue(auction))}</p></div><div className="rounded-xl border border-white/15 bg-black/30 px-2.5 py-2 text-right backdrop-blur-md"><p className="flex items-center justify-end gap-1 text-[9px] font-black"><Clock3 className="h-3 w-3 text-[#ff9a75]" /> {remaining}</p><p className="mt-1 flex items-center gap-1 text-[8px] font-bold text-white/55"><Users className="h-3 w-3" /> {auction.bidCount} lance{auction.bidCount === 1 ? '' : 's'}</p></div></div>}
    </div>
    <div className={`p-3 sm:p-4 ${auction ? 'bg-gradient-to-b from-[#fff8f4] to-white' : ''}`}>{auction ? <><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.12em] text-[#d15132]"><Gavel className="h-3.5 w-3.5" /> Disputa aberta</div>{listing.sellerVerifiedSnapshot && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Anunciante verificado" />}</div><h3 className="mt-2 overflow-hidden text-[13px] font-black leading-[1.3] text-[#2d211c] sm:text-[15px]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{listing.title}</h3><div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e8d7ce] pt-3"><span className="text-[9px] font-bold text-[#8c776c]">Próximo a partir de <strong className="text-[#3e2a21]">{money(auction.nextMinimum)}</strong></span><span className="rounded-full bg-[#2d211c] px-3 py-1.5 text-[9px] font-black text-white">Entrar no leilão</span></div></> : <><div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#9b8275] sm:text-[10px]"><span>{listing.condition === 'NEW' ? 'Novo' : listing.condition === 'REFURBISHED' ? 'Recondicionado' : listing.condition === 'NOT_APPLICABLE' ? 'Serviço' : 'Usado'}</span>{listing.sellerVerifiedSnapshot && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Anunciante verificado" />}</div>{pricing.promotionActive && pricing.basePrice != null && <p className="mt-1.5 text-[10px] font-bold text-[#a69389] line-through sm:text-xs">{money(pricing.basePrice)}</p>}<p className={`${pricing.promotionActive ? 'mt-0.5 text-[#b74435]' : 'mt-1.5 text-[#2d211c]'} text-[15px] font-black leading-tight tracking-[-.025em] sm:text-lg`}>{classifiedPrice(listing)}</p>{pixSpecial && <p className="mt-1 text-[10px] font-black text-emerald-700 sm:text-xs">{money(pricing.pixPrice)} no Pix</p>}{card?.enabled && pricing.cardPrice != null && <p className="mt-1 text-[9px] font-semibold text-[#8c776c] sm:text-[10px]">Cartão {money(pricing.cardPrice)} · até {pricing.maxInstallments}x{pricing.interestFreeInstallments > 0 ? ` · ${pricing.interestFreeInstallments}x sem juros` : ''}</p>}<h3 className="mt-1.5 overflow-hidden text-[12px] font-semibold leading-[1.35] text-[#554239] sm:text-sm" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{listing.title}</h3></>}<p className="mt-2 flex min-w-0 items-center gap-1 text-[10px] font-medium text-[#9b8275] sm:text-xs"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city} - {listing.state}</span></p></div>
    <style>{`@keyframes auctionSweep{0%{transform:translateX(-120%)}50%,100%{transform:translateX(240%)}}`}</style>
  </Link>;
}

function countdownLabel(ms: number) { if (ms <= 0) return 'encerrando'; const totalSeconds = Math.floor(ms / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`; if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`; return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
function money(value: unknown) { const numeric = Number(value); return Number.isFinite(numeric) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: numeric % 1 === 0 ? 0 : 2 }).format(numeric) : '—'; }
