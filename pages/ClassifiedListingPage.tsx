import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  ImageIcon,
  MapPin,
  Phone,
  Share2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ClassifiedListingCard, classifiedPrice } from '../components/classifieds/ClassifiedListingCard';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { ClassifiedListing } from '../types/classifieds';

export default function ClassifiedListingPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/classifieds/listings/${encodeURIComponent(slug || '')}`)
      .then((response) => {
        if (!active) return;
        setListing(response.data as ClassifiedListing);
        setFavorited(Boolean(response.data?.isFavorite));
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  const images = listing?.images || [];
  const whatsapp = useMemo(() => digits(listing?.contactWhatsapp || ''), [listing?.contactWhatsapp]);
  const phone = listing?.contactPhone || '';

  const toggleFavorite = async () => {
    if (!listing) return;
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (savingFavorite) return;
    setSavingFavorite(true);
    try {
      const response = await api.post(`/classifieds/listings/${listing.id}/favorite`);
      setFavorited(Boolean(response.data?.favorited));
    } finally {
      setSavingFavorite(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: listing?.title || 'Classificado', url }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url).catch(() => undefined);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!listing) return <div className="min-h-screen bg-[#f6f4f1]"><Navbar /><div className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="font-serif text-3xl font-bold">Anúncio não encontrado</h1><Link to="/classificados" className="mt-5 inline-flex rounded-xl bg-[#2d211c] px-4 py-3 text-sm font-bold text-white">Voltar aos classificados</Link></div></div>;

  return (
    <div className="min-h-screen bg-[#f6f4f1] pb-24 text-[#2d211c] md:pb-0">
      <SeoHead title={`${listing.title} | Classificados PiraNegócios`} description={listing.description.slice(0, 155)} canonical={`${window.location.origin}/classificados/anuncio/${listing.slug}`} />
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs font-semibold text-[#806b60]">
          <div className="min-w-0 truncate"><Link to="/classificados" className="hover:text-[#2d211c]">Classificados</Link><span className="mx-2">/</span><Link to={`/classificados/categoria/${listing.categorySlug}`} className="hover:text-[#2d211c]">{listing.categorySlug.replace(/-/g, ' ')}</Link></div>
          <div className="flex shrink-0 gap-2"><button onClick={share} className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-[#4b3328]/10" aria-label="Compartilhar"><Share2 className="h-4 w-4" /></button><button onClick={toggleFavorite} disabled={savingFavorite} className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-[#4b3328]/10 disabled:opacity-50" aria-label="Favoritar"><Heart className={`h-4 w-4 ${favorited ? 'fill-[#c96847] text-[#c96847]' : ''}`} /></button></div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px] xl:gap-8">
          <div className="min-w-0">
            <Gallery images={images} title={listing.title} selected={selectedImage} setSelected={setSelectedImage} />

            <section className="mt-5 rounded-[24px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">{conditionLabel(listing.condition)}</p><h1 className="mt-1 text-2xl font-bold tracking-[-.025em] sm:text-3xl">{listing.title}</h1><p className="mt-3 text-3xl font-black tracking-[-.035em] text-[#2d211c] sm:text-4xl">{classifiedPrice(listing)}</p></div>
                <div className="flex flex-col gap-2 text-xs font-semibold text-[#806b60]"><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#c96847]" />{listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city} - {listing.state}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{relativeDate(listing.publishedAt || listing.createdAt)}</span><span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" />{listing.viewsCount || 0} visualizações</span></div>
              </div>
            </section>

            {listing.attributes && Object.keys(listing.attributes).length > 0 && <section className="mt-5 rounded-[24px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7"><SectionTitle>Características</SectionTitle><div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">{Object.entries(listing.attributes).map(([key, value]) => <div key={key}><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#9b8275]">{attributeLabel(key)}</p><p className="mt-1 text-sm font-bold text-[#4e3b32]">{String(value ?? 'Não informado')}</p></div>)}</div></section>}

            <section className="mt-5 rounded-[24px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7"><SectionTitle>Descrição</SectionTitle><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#604c42] sm:text-base sm:leading-8">{listing.description}</p></section>

            <section className="mt-5 rounded-[24px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><h2 className="font-bold">Negocie com segurança</h2><p className="mt-1 text-sm leading-6 text-[#806b60]">Confira o produto e os dados do anunciante antes de pagar. Evite antecipar valores quando você ainda não verificou a oferta e nunca compartilhe senhas ou códigos de acesso.</p></div></div></section>
          </div>

          <aside className="hidden lg:block"><SellerPanel listing={listing} whatsapp={whatsapp} phone={phone} /></aside>
        </div>

        {listing.related?.length ? <section className="mt-10 sm:mt-14"><div className="flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">Você também pode gostar</p><h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">Anúncios relacionados</h2></div><Link to={`/classificados/categoria/${listing.categorySlug}`} className="text-xs font-black text-[#a84f34]">Ver categoria</Link></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{listing.related.slice(0, 10).map((item) => <ClassifiedListingCard key={item.id} listing={item} compact />)}</div></section> : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#4b3328]/10 bg-white/96 p-3 backdrop-blur-xl md:hidden"><div className="mx-auto flex max-w-lg gap-2">{whatsapp ? <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Vi seu anúncio “${listing.title}” no PiraNegócios.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white"><Smartphone className="h-4 w-4" /> WhatsApp</a> : null}{phone ? <a href={`tel:${digits(phone)}`} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2d211c] px-4 text-sm font-black text-white"><Phone className="h-4 w-4" /> Ligar</a> : null}{!whatsapp && !phone ? <div className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-[#eee8e2] text-xs font-bold text-[#806b60]">Contato não informado</div> : null}</div></div>
    </div>
  );
}

function Gallery({ images, title, selected, setSelected }: { images: Array<{ url: string }>; title: string; selected: number; setSelected: (index: number) => void }) {
  if (!images.length) return <div className="flex aspect-[4/3] items-center justify-center rounded-[24px] bg-[#e9e4df] text-[#9e8d84] sm:aspect-[16/10]"><ImageIcon className="h-12 w-12" /></div>;
  return <><div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:hidden">{images.map((image, index) => <div key={`${image.url}-${index}`} className="aspect-square w-[86vw] max-w-[420px] shrink-0 snap-center overflow-hidden rounded-[22px] bg-[#e9e4df]"><img src={image.url} alt={`${title} · foto ${index + 1}`} className="h-full w-full object-cover" /></div>)}</div><div className="hidden sm:grid sm:grid-cols-[1fr_104px] sm:gap-3"><div className="relative aspect-[16/10] overflow-hidden rounded-[26px] bg-[#e9e4df]"><img src={images[selected]?.url || images[0].url} alt={title} className="h-full w-full object-cover" />{images.length > 1 && <><button onClick={() => setSelected((selected - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"><ChevronLeft className="h-5 w-5" /></button><button onClick={() => setSelected((selected + 1) % images.length)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"><ChevronRight className="h-5 w-5" /></button></>}</div><div className="grid content-start gap-2 overflow-y-auto">{images.slice(0, 6).map((image, index) => <button key={`${image.url}-${index}`} onClick={() => setSelected(index)} className={`aspect-square overflow-hidden rounded-xl ring-2 ${selected === index ? 'ring-[#c96847]' : 'ring-transparent'}`}><img src={image.url} alt="" className="h-full w-full object-cover" /></button>)}</div></div></>;
}

function SellerPanel({ listing, whatsapp, phone }: { listing: ClassifiedListing; whatsapp: string; phone: string }) {
  const seller = listing.seller;
  return <div className="sticky top-[96px] space-y-4"><div className="rounded-[26px] bg-white p-6 shadow-[0_18px_50px_rgba(45,33,28,.08)] ring-1 ring-[#4b3328]/10"><p className="text-3xl font-black tracking-[-.035em]">{classifiedPrice(listing)}</p><div className="mt-6 border-t border-[#4b3328]/10 pt-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#9b8275]">Anunciante</p><div className="mt-3 flex items-center gap-3">{seller?.photoURL ? <img src={seller.photoURL} alt="" className="h-12 w-12 rounded-2xl object-contain ring-1 ring-[#4b3328]/10" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2e8df] font-serif text-xl font-bold">{seller?.name?.charAt(0) || '?'}</div>}<div className="min-w-0"><div className="flex items-center gap-1.5"><p className="truncate font-bold">{seller?.name || 'Anunciante'}</p>{seller?.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Anunciante verificado" />}</div><p className="mt-0.5 text-xs text-[#8b756a]">{seller?.type === 'COMPANY' ? 'Empresa' : 'Particular'}{seller?.city ? ` · ${seller.city}${seller.state ? ` - ${seller.state}` : ''}` : ''}</p></div></div></div><div className="mt-6 grid gap-2">{whatsapp ? <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Vi seu anúncio “${listing.title}” no PiraNegócios.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white"><Smartphone className="h-4 w-4" /> Chamar no WhatsApp</a> : null}{phone ? <a href={`tel:${digits(phone)}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2d211c] text-sm font-black text-white"><Phone className="h-4 w-4" /> Ligar para anunciante</a> : null}{!whatsapp && !phone ? <div className="rounded-2xl bg-[#f4f0ec] px-4 py-4 text-center text-xs font-semibold text-[#806b60]">O anunciante não informou contato público.</div> : null}</div></div><div className="rounded-[22px] bg-[#fffaf5] p-5 ring-1 ring-[#4b3328]/10"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">Código do anúncio</p><p className="mt-2 font-mono text-xs text-[#806b60]">{listing.id.slice(0, 8).toUpperCase()}</p></div></div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) { return <h2 className="font-serif text-2xl font-bold tracking-[-.02em]">{children}</h2>; }
function digits(value: string) { return String(value || '').replace(/\D/g, ''); }
function conditionLabel(value: string) { return value === 'NEW' ? 'Produto novo' : value === 'REFURBISHED' ? 'Recondicionado' : value === 'NOT_APPLICABLE' ? 'Serviço' : 'Produto usado'; }
function relativeDate(value?: string | null) { if (!value) return 'Publicado recentemente'; const date = new Date(value); const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000)); if (days === 0) return 'Publicado hoje'; if (days === 1) return 'Publicado ontem'; if (days < 30) return `Publicado há ${days} dias`; return date.toLocaleDateString('pt-BR'); }
function attributeLabel(key: string) { const labels: Record<string, string> = { brand: 'Marca', model: 'Modelo', year: 'Ano', mileage: 'Quilometragem', transmission: 'Câmbio', fuel: 'Combustível', dealType: 'Negociação', propertyType: 'Tipo', bedrooms: 'Quartos', bathrooms: 'Banheiros', parking: 'Vagas', area: 'Área', warranty: 'Garantia', storage: 'Armazenamento', specs: 'Configuração', size: 'Tamanho', serviceArea: 'Área de atuação', serviceMode: 'Atendimento', coverage: 'Região atendida' }; return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()); }

function DetailSkeleton() { return <div className="min-h-screen bg-[#f6f4f1]"><Navbar /><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><div className="grid gap-6 lg:grid-cols-[1fr_370px]"><div><div className="aspect-[16/10] animate-pulse rounded-[26px] bg-[#e6e1dc]" /><div className="mt-5 h-44 animate-pulse rounded-[24px] bg-white" /></div><div className="hidden h-96 animate-pulse rounded-[26px] bg-white lg:block" /></div></div></div>; }
