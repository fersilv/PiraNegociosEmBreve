import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Sparkles, Zap } from 'lucide-react';
import { classifiedCommercePricing, classifiedPrice } from './ClassifiedListingCard';
import type { ClassifiedListing } from '../../types/classifieds';

export type AcceptedClassifiedOffer = {
  id: string;
  amount: number;
  expiresAt: string;
  acceptedAt?: string | null;
  paymentDiscountsSuppressed?: boolean;
};

export function ClassifiedCommercePriceHero({
  listing,
  acceptedOffer,
}: {
  listing: ClassifiedListing;
  acceptedOffer?: AcceptedClassifiedOffer | null;
}) {
  const [now, setNow] = useState(Date.now());
  const pricing = classifiedCommercePricing(listing);
  const acceptedAmount = Number(acceptedOffer?.amount);
  const accepted = Boolean(
    acceptedOffer
      && Number.isFinite(acceptedAmount)
      && acceptedAmount > 0
      && new Date(acceptedOffer.expiresAt).getTime() > now,
  );

  useEffect(() => {
    if (!acceptedOffer?.expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [acceptedOffer?.expiresAt]);

  const benefit = useMemo(() => bestBenefit(listing, pricing), [listing, pricing.basePrice, pricing.currentPrice, pricing.pixPrice, pricing.cardPrice, pricing.interestFreeInstallments, pricing.maxInstallments]);

  if (listing.priceType === 'CONTACT') {
    return <div><p className="text-3xl font-black tracking-[-.035em] text-stone-900">{classifiedPrice(listing)}</p></div>;
  }

  if (accepted && acceptedOffer) {
    const original = Number(pricing.currentPrice ?? listing.price);
    return <div className="rounded-[22px] bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-emerald-200/80">
      <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[.14em]">Oferta aceita</span></div>
      {Number.isFinite(original) && original > acceptedAmount && <p className="mt-3 text-xs font-bold text-stone-400">De <span className="line-through">{money(original)}</span></p>}
      <p className="mt-0.5 text-4xl font-black tracking-[-.045em] text-emerald-800">{money(acceptedAmount)}</p>
      <p className="mt-1 text-[11px] font-bold text-emerald-700">Preço exclusivo da sua oferta. Pix e cartão não aplicam desconto adicional.</p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-emerald-100">
        <span className="text-[10px] font-bold text-stone-500">Tempo para usar a oferta</span>
        <span className="font-mono text-xs font-black text-emerald-800">{countdown(new Date(acceptedOffer.expiresAt).getTime() - now)}</span>
      </div>
    </div>;
  }

  return <div>
    {benefit.secondaryOriginal != null && <p className="text-xs font-bold text-stone-400">{benefit.secondaryLabel} <span className={benefit.strikeSecondary ? 'line-through' : ''}>{money(benefit.secondaryOriginal)}</span></p>}
    <div className="mt-1 flex items-start gap-2">
      {benefit.kind === 'PIX' ? <Zap className="mt-1 h-5 w-5 shrink-0 text-emerald-600" /> : benefit.kind === 'INSTALLMENTS' || benefit.kind === 'CARD' ? <CreditCard className="mt-1 h-5 w-5 shrink-0 text-blue-600" /> : pricing.promotionActive ? <Sparkles className="mt-1 h-5 w-5 shrink-0 text-rose-500" /> : null}
      <div>
        <p className={`font-black tracking-[-.045em] ${benefit.kind === 'INSTALLMENTS' ? 'text-[30px] leading-[1.05] text-blue-800' : benefit.kind === 'PIX' ? 'text-4xl text-emerald-800' : benefit.kind === 'CARD' ? 'text-4xl text-blue-800' : pricing.promotionActive ? 'text-4xl text-rose-700' : 'text-4xl text-stone-900'}`}>{benefit.hero}</p>
        <p className={`mt-1 text-[11px] font-black ${benefit.kind === 'PIX' ? 'text-emerald-700' : benefit.kind === 'INSTALLMENTS' || benefit.kind === 'CARD' ? 'text-blue-700' : 'text-stone-500'}`}>{benefit.caption}</p>
      </div>
    </div>
    {benefit.auxiliary && <p className="mt-2 text-xs font-bold text-stone-500">{benefit.auxiliary}</p>}
    {pricing.promotionActive && pricing.promotionEndsAt && <p className="mt-2 text-[10px] font-black text-rose-600">Preço promocional até {new Date(pricing.promotionEndsAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>}
    {listing.commerceConfig?.onlineCheckout?.enabled === true && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-blue-700"><CheckCircle2 className="h-3.5 w-3.5" /> Compra online disponível</p>}
  </div>;
}

function bestBenefit(listing: ClassifiedListing, pricing: ReturnType<typeof classifiedCommercePricing>) {
  const current = numberOrNull(pricing.currentPrice);
  const pix = numberOrNull(pricing.pixPrice);
  const card = numberOrNull(pricing.cardPrice);
  const originalBase = numberOrNull(pricing.basePrice);
  const pixDiscount = pix != null && current != null && pix < current - 0.0001;
  const cardDiscount = card != null && current != null && card < current - 0.0001;

  if (pixDiscount && (!cardDiscount || Number(pix) <= Number(card))) {
    return {
      kind: 'PIX', hero: money(pix), caption: 'melhor preço no Pix',
      secondaryOriginal: current, secondaryLabel: 'De', strikeSecondary: true,
      auxiliary: installmentAuxiliary(card, pricing.interestFreeInstallments),
    };
  }
  if (cardDiscount && card != null) {
    return {
      kind: 'CARD', hero: money(card), caption: 'melhor preço no cartão',
      secondaryOriginal: current, secondaryLabel: 'De', strikeSecondary: true,
      auxiliary: pricing.interestFreeInstallments > 1 ? `${pricing.interestFreeInstallments}x de ${money(card / pricing.interestFreeInstallments)} sem juros` : null,
    };
  }
  if (current != null && pricing.interestFreeInstallments > 1) {
    const installments = Math.min(pricing.interestFreeInstallments, Math.max(1, pricing.maxInstallments));
    return {
      kind: 'INSTALLMENTS', hero: `${installments}x de ${money(current / installments)}`, caption: 'sem juros no cartão',
      secondaryOriginal: current, secondaryLabel: 'Total', strikeSecondary: false,
      auxiliary: pix != null && pix < current ? `${money(pix)} no Pix` : null,
    };
  }
  const heroValue = current ?? originalBase;
  return {
    kind: pricing.promotionActive ? 'PROMO' : 'BASE',
    hero: heroValue == null ? classifiedPrice(listing) : money(heroValue),
    caption: pricing.promotionActive ? 'preço promocional' : listing.priceType === 'NEGOTIABLE' ? 'valor negociável' : 'preço do produto',
    secondaryOriginal: pricing.promotionActive && originalBase != null && current != null && originalBase > current ? originalBase : null,
    secondaryLabel: 'De', strikeSecondary: true,
    auxiliary: null,
  };
}

function installmentAuxiliary(card: number | null, interestFree: number) {
  if (card == null || interestFree <= 1) return null;
  return `${interestFree}x de ${money(card / interestFree)} sem juros no cartão`;
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number) : '—';
}

function countdown(ms: number) {
  if (ms <= 0) return 'expirada';
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
