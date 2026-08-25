import React from 'react';
import { ImageIcon, MapPin } from 'lucide-react';
import type { ClassifiedListingType, ClassifiedPriceType } from '../../types/classifieds';

export type ClassifiedPreviewValue = {
  title: string;
  price: string;
  priceType: ClassifiedPriceType;
  listingType: ClassifiedListingType;
  city: string;
  state: string;
  neighborhood: string;
  images: string[];
};

export function ClassifiedListingPreview({ value }: { value: ClassifiedPreviewValue }) {
  const image = value.images[0];
  const title = value.title.trim() || 'Seu anúncio vai aparecer assim';
  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_60px_rgba(45,33,28,.12)] ring-1 ring-[#4b3328]/10">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#eee8e2]">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-[#a7968c]"><ImageIcon className="h-9 w-9" /><span className="text-[10px] font-bold uppercase tracking-[.12em]">Sua foto principal</span></div>}<span className="absolute left-3 top-3 rounded-full bg-[#2d211c]/85 px-2.5 py-1 text-[9px] font-black uppercase text-white backdrop-blur">Prévia</span></div>
      <div className="p-4"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#9b8275]">{value.listingType === 'SERVICE' ? 'Serviço' : 'Produto'}</p><p className="mt-1.5 text-xl font-black text-[#2d211c]">{priceText(value.price, value.priceType)}</p><h3 className="mt-1.5 text-sm font-bold leading-5 text-[#554239]">{title}</h3><p className="mt-3 flex items-center gap-1 text-[11px] text-[#9b8275]"><MapPin className="h-3.5 w-3.5" />{[value.neighborhood, value.city, value.state].filter(Boolean).join(', ') || 'Localização do anúncio'}</p>{value.images.length > 1 && <p className="mt-3 text-[10px] font-bold text-stone-400">+ {value.images.length - 1} foto{value.images.length > 2 ? 's' : ''}</p>}</div>
    </div>
  );
}

function priceText(price: string, type: ClassifiedPriceType) {
  if (type === 'CONTACT') return 'Solicite um orçamento';
  const numeric = Number(String(price || '').replace(',', '.'));
  if (!Number.isFinite(numeric)) return 'Preço do anúncio';
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric);
  if (type === 'NEGOTIABLE') return `${formatted} · negociável`;
  if (type === 'STARTING_AT') return `A partir de ${formatted}`;
  return formatted;
}
