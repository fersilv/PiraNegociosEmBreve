import React, { useState } from 'react';
import { Heart, ImageIcon, MapPin, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import type { ClassifiedListing } from '../../types/classifieds';

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
  const promotionActive = Boolean(
    promotion && Number.isFinite(promo)
      && (startsAt == null || startsAt <= now)
      && (endsAt == null || endsAt > now),
  );
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

export function ClassifiedListingCard({
  listing,
  compact = false,
  onFavoriteChange,
  detailBasePath = '/classificados/anuncio',
}: {
  listing: ClassifiedListing;
  compact?: boolean;
  onFavoriteChange?: (listingId: string, favorited: boolean) => void;
  detailBasePath?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [favorited, setFavorited] = useState(Boolean(listing.isFavorite));
  const [savingFavorite, setSavingFavorite] = useState(false);
  const image = listing.images?.[0]?.url;
  const pricing = classifiedCommercePricing(listing);
  const pixSpecial = listing.commerceConfig?.paymentPricing?.pix?.enabled && pricing.pixPrice != null && pricing.currentPrice != null && pricing.pixPrice < pricing.currentPrice;
  const card = listing.commerceConfig?.paymentPricing?.card;

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
    } finally {
      setSavingFavorite(false);
    }
  };

  return (
    <Link
      to={`${detailBasePath}/${encodeURIComponent(listing.slug)}`}
      className="group min-w-0 overflow-hidden rounded-[18px] bg-white shadow-[0_8px_26px_rgba(45,33,28,.055)] ring-1 ring-[#4b3328]/10 transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(45,33,28,.10)] sm:rounded-[22px]"
    >
      <div className={`relative overflow-hidden bg-[#eee8e2] ${compact ? 'aspect-[1.12/1]' : 'aspect-square sm:aspect-[4/3]'}`}>
        {image ? <img src={image} alt={listing.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" /> : <div className="flex h-full items-center justify-center text-[#9e8d84]"><ImageIcon className="h-9 w-9" /></div>}
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5 sm:left-3 sm:top-3">{pricing.promotionActive && <span className="rounded-full bg-[#d45442] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white shadow-sm">Oferta</span>}{listing.isFeatured && <span className="rounded-full bg-[#2d211c]/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white backdrop-blur">Destaque</span>}{listing.commerceConfig?.onlineCheckout?.enabled && <span className="rounded-full bg-blue-600/95 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.1em] text-white">Compra online</span>}</div>
        <button type="button" onClick={toggleFavorite} disabled={savingFavorite} aria-label={favorited ? 'Remover dos favoritos' : 'Salvar nos favoritos'} className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/94 text-[#3e3029] shadow-sm backdrop-blur transition hover:scale-105 disabled:opacity-60 sm:right-3 sm:top-3"><Heart className={`h-4.5 w-4.5 ${favorited ? 'fill-[#c96847] text-[#c96847]' : ''}`} /></button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#9b8275] sm:text-[10px]"><span>{listing.condition === 'NEW' ? 'Novo' : listing.condition === 'REFURBISHED' ? 'Recondicionado' : listing.condition === 'NOT_APPLICABLE' ? 'Serviço' : 'Usado'}</span>{listing.sellerVerifiedSnapshot && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Anunciante verificado" />}</div>
        {pricing.promotionActive && pricing.basePrice != null && <p className="mt-1.5 text-[10px] font-bold text-[#a69389] line-through sm:text-xs">{money(pricing.basePrice)}</p>}
        <p className={`${pricing.promotionActive ? 'mt-0.5 text-[#b74435]' : 'mt-1.5 text-[#2d211c]'} text-[15px] font-black leading-tight tracking-[-.025em] sm:text-lg`}>{classifiedPrice(listing)}</p>
        {pixSpecial && <p className="mt-1 text-[10px] font-black text-emerald-700 sm:text-xs">{money(pricing.pixPrice)} no Pix</p>}
        {card?.enabled && pricing.cardPrice != null && <p className="mt-1 text-[9px] font-semibold text-[#8c776c] sm:text-[10px]">Cartão {money(pricing.cardPrice)} · até {pricing.maxInstallments}x{pricing.interestFreeInstallments > 0 ? ` · ${pricing.interestFreeInstallments}x sem juros` : ''}</p>}
        <h3 className="mt-1.5 overflow-hidden text-[12px] font-semibold leading-[1.35] text-[#554239] sm:text-sm" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{listing.title}</h3>
        <p className="mt-2 flex min-w-0 items-center gap-1 text-[10px] font-medium text-[#9b8275] sm:text-xs"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city} - {listing.state}</span></p>
      </div>
    </Link>
  );
}

function money(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric) : '—';
}
