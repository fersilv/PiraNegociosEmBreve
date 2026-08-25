import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, MessageCircle, PackageOpen, ShoppingBag, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ClassifiedListingCard } from '../classifieds/ClassifiedListingCard';
import { api } from '../../lib/api';
import type { ClassifiedListing } from '../../types/classifieds';

export function CompanyClassifiedsShowcase({ companyId, companyName }: { companyId?: string; companyName?: string }) {
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [pageSectionLabel, setPageSectionLabel] = useState('');
  const [loading, setLoading] = useState(Boolean(companyId));

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    api.get(`/classifieds/company/${companyId}/listings`)
      .then((response) => {
        if (!active) return;
        const payload = response.data;
        setItems(Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []);
        setPageSectionLabel(Array.isArray(payload) ? '' : String(payload?.pageSectionLabel || '').trim());
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setPageSectionLabel('');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId]);

  const products = useMemo(() => items.filter((item) => item.listingType !== 'SERVICE'), [items]);
  const services = useMemo(() => items.filter((item) => item.listingType === 'SERVICE'), [items]);
  const automaticTitle = products.length && services.length ? 'Produtos e serviços' : services.length ? 'Serviços' : 'Produtos';
  const title = pageSectionLabel || automaticTitle;

  if (!companyId || (!loading && !items.length)) return null;

  return (
    <section id="vitrine" className="border-t border-stone-200 bg-[#f7f6f3] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-stone-400"><ShoppingBag className="h-4 w-4" /> Vitrine no PiraNegócios</div>
            <h2 className="mt-2 font-serif text-3xl font-black tracking-[-.03em] sm:text-4xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Itens que {companyName || 'esta empresa'} escolheu exibir na própria página. A negociação pode continuar pelo chat interno do anúncio.</p>
          </div>
          <Link to="/classificados/busca?sellerType=company" className="inline-flex items-center gap-2 text-xs font-black text-stone-700 hover:text-stone-950">Explorar Classificados <ArrowRight className="h-4 w-4" /></Link>
        </div>

        {loading ? <div className="mt-8 flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : <>
          {products.length > 0 && <CatalogGroup icon={<PackageOpen className="h-4 w-4" />} label={services.length ? 'Produtos' : undefined} items={products} />}
          {services.length > 0 && <CatalogGroup icon={<Wrench className="h-4 w-4" />} label={products.length ? 'Serviços' : undefined} items={services} />}
          <div className="mt-8 rounded-[24px] border border-stone-200 bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100"><MessageCircle className="h-5 w-5" /></span><div><h3 className="text-sm font-black">Negocie sem perder o contexto</h3><p className="mt-1 text-xs leading-5 text-stone-500">Abra um item para conversar com a empresa. A conversa fica vinculada ao anúncio e permanece no seu histórico.</p></div></div>
            <Link to="/classificados" className="mt-4 inline-flex rounded-2xl bg-stone-900 px-4 py-3 text-xs font-black text-white sm:mt-0">Ver marketplace</Link>
          </div>
        </>}
      </div>
    </section>
  );
}

function CatalogGroup({ icon, label, items }: { icon: React.ReactNode; label?: string; items: ClassifiedListing[] }) {
  return <div className="mt-8">{label && <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-stone-500">{icon}{label}</div>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{items.slice(0, 10).map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} />)}</div>{items.length > 10 && <p className="mt-4 text-xs font-bold text-stone-400">+ {items.length - 10} item(ns) disponíveis na vitrine da empresa.</p>}</div>;
}
