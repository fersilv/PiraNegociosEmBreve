import React, { useState } from 'react';
import { BadgeCheck, Building2, ChevronDown, Compass, Home, LogOut, Menu, MessageCircle, Plus, Settings2, Store, User, X } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { useClassifiedsWorkspace } from '../../contexts/ClassifiedsWorkspaceContext';
import type { ClassifiedIdentityType, ClassifiedPublicationChannel } from '../../types/classifieds';

const BUSINESS_SEGMENT_SUGGESTIONS = [
  'Loja', 'Restaurante', 'Pizzaria', 'Bar', 'Lanchonete', 'Fast-food', 'Brechó',
  'Prestador de serviços', 'Autônomo', 'Tecnologia', 'Assistência técnica',
  'Imobiliária', 'Veículos', 'Moda', 'Beleza', 'Construção', 'Agro', 'Pet', 'Outros',
];

export function ClassifiedsWorkspaceGate({ children }: { children: React.ReactNode }) {
  const { data, loading, error, selectIdentity, acceptPersonalTerms, configureCompany } = useClassifiedsWorkspace();
  const [working, setWorking] = useState(false);
  const [canSellProducts, setCanSellProducts] = useState(true);
  const [canOfferServices, setCanOfferServices] = useState(false);
  const [segments, setSegments] = useState<string[]>([]);
  const [segmentInput, setSegmentInput] = useState('');
  const [pageSectionLabel, setPageSectionLabel] = useState('');
  const [channels, setChannels] = useState<ClassifiedPublicationChannel[]>(['CLASSIFIEDS', 'COMPANY_PAGE']);

  const run = async (action: () => Promise<void>) => {
    if (working) return;
    setWorking(true);
    try { await action(); } finally { setWorking(false); }
  };

  if (loading || !data) return <WorkspaceLoading error={error} />;

  if (data.needsIdentitySelection) {
    return <FirstIdentityChoice data={data} working={working} error={error} choose={(identity) => run(() => selectIdentity(identity))} />;
  }

  if (data.activeIdentity === 'PERSONAL' && !data.personal.termsAccepted) {
    return (
      <OnboardingFrame mode="PERSONAL" title="Ative seu PiraNegócios Personal" subtitle="Seu espaço pessoal para vender, comprar e negociar com segurança dentro da plataforma." error={error}>
        <div className="rounded-3xl border border-[#e6c8bd] bg-white p-5 text-sm leading-6 text-[#654a43]">
          Ao continuar, você concorda com os Termos de Uso dos Classificados. Seus anúncios pessoais aparecem como Particular e ficam separados de qualquer empresa vinculada à sua conta.
          <Link to="/classificados/termos" target="_blank" className="ml-1 font-black text-[#a84f34] underline">Ler os Termos dos Classificados</Link>
        </div>
        <button disabled={working} onClick={() => run(acceptPersonalTerms)} className="mt-5 w-full rounded-2xl bg-[#9f4e3d] px-5 py-3.5 text-sm font-black text-white disabled:opacity-60">{working ? 'Ativando...' : 'Aceitar e entrar como Personal'}</button>
      </OnboardingFrame>
    );
  }

  if (data.activeIdentity === 'COMPANY' && data.company && !data.company.verified) {
    return (
      <OnboardingFrame mode="BUSINESS" title={`${data.company.name} ainda precisa ser verificada`} subtitle="Empresas ganham identidade comercial, selo de verificação, vitrine na página e recursos próprios de catálogo." error={error}>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">Para proteger compradores e a reputação do marketplace, apenas empresas verificadas podem publicar como Business.</div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link to="/company/perfil" className="rounded-2xl bg-[#0d4542] px-5 py-3.5 text-center text-sm font-black text-white">Verificação da empresa</Link>
          <button disabled={working} onClick={() => run(() => selectIdentity('PERSONAL'))} className="rounded-2xl border border-[#b9d7d2] bg-white px-5 py-3.5 text-sm font-black text-[#155a55]">Entrar como Personal</button>
        </div>
      </OnboardingFrame>
    );
  }

  if (data.activeIdentity === 'COMPANY' && data.company && !data.company.termsAccepted) {
    const addSegment = (value: string) => {
      const clean = value.trim();
      if (!clean || segments.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
      setSegments((current) => [...current, clean].slice(0, 20));
      setSegmentInput('');
    };
    const toggleChannel = (channel: ClassifiedPublicationChannel) => {
      setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
    };
    return (
      <OnboardingFrame mode="BUSINESS" title={`Leve ${data.company.name} para os Classificados`} subtitle="Configure uma vez. Depois, o PiraNegócios lembra que você entrou como Business e aplica estas escolhas como padrão." error={error}>
        <div className="space-y-6">
          <section>
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#44736e]">Como sua empresa atua?</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ToggleCard checked={canSellProducts} onClick={() => setCanSellProducts((value) => !value)} icon={<Store className="h-5 w-5" />} title="Venda de produtos" text="Novos, usados, cardápio, catálogo e itens com variações." />
              <ToggleCard checked={canOfferServices} onClick={() => setCanOfferServices((value) => !value)} icon={<Settings2 className="h-5 w-5" />} title="Prestação de serviços" text="Preço, a partir de, negociável ou orçamento." />
            </div>
          </section>

          <section>
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#44736e]">Ramo / segmentos</p>
            <p className="mt-1 text-xs text-stone-500">Pode escolher vários. Uma loja de eletrônicos que também faz manutenção, por exemplo, não precisa caber em uma caixinha só.</p>
            <div className="mt-3 flex flex-wrap gap-2">{BUSINESS_SEGMENT_SUGGESTIONS.map((segment) => <button key={segment} type="button" onClick={() => segments.includes(segment) ? setSegments((current) => current.filter((item) => item !== segment)) : addSegment(segment)} className={`rounded-full px-3 py-2 text-xs font-bold ${segments.includes(segment) ? 'bg-[#0d4542] text-white' : 'bg-[#edf5f3] text-[#376662]'}`}>{segment}</button>)}</div>
            <div className="mt-3 flex gap-2"><input value={segmentInput} onChange={(event) => setSegmentInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSegment(segmentInput); } }} placeholder="Outro ramo ou atividade" className="min-w-0 flex-1 rounded-2xl border border-[#c9dedb] px-4 py-3 text-sm outline-none focus:border-[#3a827b]" /><button type="button" onClick={() => addSegment(segmentInput)} className="rounded-2xl bg-[#dcece9] px-4 text-xs font-black text-[#155a55]">Adicionar</button></div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-black uppercase tracking-[.14em] text-[#44736e]">Nome da vitrine na página</span><input value={pageSectionLabel} onChange={(event) => setPageSectionLabel(event.target.value)} placeholder="Ex.: Cardápio, Produtos, Imóveis" className="mt-2 w-full rounded-2xl border border-[#c9dedb] px-4 py-3 text-sm outline-none focus:border-[#3a827b]" /></label>
            <div><span className="text-xs font-black uppercase tracking-[.14em] text-[#44736e]">Novos anúncios aparecem por padrão em</span><div className="mt-2 space-y-2"><ChannelCheck checked={channels.includes('CLASSIFIEDS')} onClick={() => toggleChannel('CLASSIFIEDS')} label="Classificados" /><ChannelCheck checked={channels.includes('COMPANY_PAGE')} onClick={() => toggleChannel('COMPANY_PAGE')} label="Página da empresa" /></div></div>
          </section>

          <div className="rounded-3xl border border-[#c9dedb] bg-[#f4faf8] p-5 text-sm leading-6 text-[#315f5a]">
            Ao ativar o Business, você aceita os <Link to="/classificados/termos" target="_blank" className="font-black underline">Termos de Uso dos Classificados</Link> em nome da empresa. Cada anúncio ainda poderá alterar discretamente onde será exibido.
          </div>
          <button disabled={working || (!canSellProducts && !canOfferServices) || channels.length === 0} onClick={() => run(() => configureCompany({ acceptedTerms: true, canSellProducts, canOfferServices, businessSegments: segments, defaultPublicationChannels: channels, pageSectionLabel: pageSectionLabel || null }))} className="w-full rounded-2xl bg-[#0d4542] px-5 py-3.5 text-sm font-black text-white disabled:opacity-50">{working ? 'Ativando Business...' : 'Aceitar e ativar PiraNegócios Business'}</button>
        </div>
      </OnboardingFrame>
    );
  }

  return <>{children}</>;
}

export function ClassifiedsWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { data, selectIdentity } = useClassifiedsWorkspace();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  if (!data?.activeIdentity) return null;

  const business = data.activeIdentity === 'COMPANY';
  const identityName = business ? data.company?.name || 'Empresa' : data.personal.name;
  const nav = [
    { to: '/classificados/painel', label: 'Painel', icon: <Home className="h-5 w-5" /> },
    { to: '/classificados', label: 'Explorar', icon: <Compass className="h-5 w-5" />, publicLink: true },
    { to: '/classificados/publicar', label: 'Novo anúncio', icon: <Plus className="h-5 w-5" /> },
    { to: '/classificados/conversas', label: 'Conversas', icon: <MessageCircle className="h-5 w-5" /> },
    { to: '/classificados/configuracoes', label: 'Configurações', icon: <Settings2 className="h-5 w-5" /> },
  ];

  const switchIdentity = async (identity: ClassifiedIdentityType) => {
    await selectIdentity(identity);
    setIdentityOpen(false);
    setMobileOpen(false);
    navigate('/classificados/painel');
  };

  const palette = business
    ? { page: 'bg-[#f1f7f5] text-[#173936]', side: 'bg-[#0c302f]', accent: 'bg-[#2f8b7d]', soft: 'bg-[#dcece9] text-[#155a55]', muted: 'text-[#91b7b2]' }
    : { page: 'bg-[#fff7f1] text-[#3e2925]', side: 'bg-[#3a222b]', accent: 'bg-[#d86b4d]', soft: 'bg-[#f7dfd4] text-[#994b39]', muted: 'text-[#d6a99d]' };

  return (
    <div className={`min-h-screen ${palette.page}`}>
      <aside className={`fixed inset-y-0 left-0 z-40 hidden w-[286px] flex-col text-white md:flex ${palette.side}`}>
        <WorkspaceBrand business={business} />
        <div className="relative mx-4 mt-2">
          <button onClick={() => setIdentityOpen((value) => !value)} className="flex w-full items-center gap-3 rounded-[20px] border border-white/10 bg-white/[.07] p-3.5 text-left">
            <IdentityAvatar business={business} name={identityName} />
            <span className="min-w-0 flex-1"><span className={`block text-[9px] font-black uppercase tracking-[.18em] ${palette.muted}`}>{business ? 'Workspace Business' : 'Workspace Personal'}</span><span className="mt-1 block truncate text-sm font-black">{identityName}</span>{business && data.company?.verified && <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-emerald-200"><BadgeCheck className="h-3 w-3" /> Empresa verificada</span>}</span>
            {data.company?.available && <ChevronDown className="h-4 w-4 text-white/45" />}
          </button>
          {identityOpen && data.company?.available && <IdentityMenu active={data.activeIdentity} personalName={data.personal.name} companyName={data.company.name} onSelect={switchIdentity} />}
        </div>
        <p className={`px-6 pb-2 pt-7 text-[9px] font-black uppercase tracking-[.2em] ${palette.muted}`}>Classificados</p>
        <nav className="flex-1 space-y-1 px-4">{nav.map((item) => item.publicLink ? <Link key={item.to} to={item.to} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/62 transition hover:bg-white/[.07] hover:text-white">{item.icon}{item.label}</Link> : <NavLink key={item.to} to={item.to} end={item.to === '/classificados/painel'} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${isActive ? 'bg-white text-stone-900 shadow-lg' : 'text-white/62 hover:bg-white/[.07] hover:text-white'}`}>{item.icon}{item.label}</NavLink>)}</nav>
        <div className="border-t border-white/10 p-4"><button onClick={async () => { await auth.signOut(); window.location.replace('/'); }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/55 hover:bg-white/[.06] hover:text-white"><LogOut className="h-5 w-5" /> Sair</button></div>
      </aside>

      <div className="min-h-screen md:pl-[286px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-black/[.06] bg-white/80 px-4 backdrop-blur-xl md:px-7">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white md:hidden"><Menu className="h-4 w-4" /></button><div className="min-w-0"><p className={`text-[9px] font-black uppercase tracking-[.2em] ${business ? 'text-[#37756f]' : 'text-[#ac5c46]'}`}>PiraNegócios {business ? 'Business' : 'Personal'}</p><p className="mt-0.5 truncate text-sm font-black">{identityName} · Classificados</p></div></div>
          <Link to="/classificados/publicar" className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black text-white shadow-sm ${palette.accent}`}><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo anúncio</span></Link>
        </header>
        <main className="p-4 pb-24 sm:p-6 md:p-8 md:pb-10">{children}</main>
      </div>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}><aside onClick={(event) => event.stopPropagation()} className={`flex h-full w-[86%] max-w-[330px] flex-col p-4 text-white ${palette.side}`}><div className="flex items-center justify-between"><WorkspaceBrand business={business} compact /><button onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><X className="h-4 w-4" /></button></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[.07] p-3"><p className={`text-[9px] font-black uppercase tracking-[.18em] ${palette.muted}`}>{business ? 'Business' : 'Personal'}</p><p className="mt-1 truncate text-sm font-black">{identityName}</p>{data.company?.available && <div className="mt-3 flex gap-2"><button onClick={() => switchIdentity('PERSONAL')} className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black">Personal</button><button onClick={() => switchIdentity('COMPANY')} className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black">Business</button></div>}</div><nav className="mt-5 space-y-1">{nav.map((item) => <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/72 hover:bg-white/[.07]">{item.icon}{item.label}</Link>)}</nav></aside></div>}
    </div>
  );
}

function FirstIdentityChoice({ data, working, error, choose }: { data: NonNullable<ReturnType<typeof useClassifiedsWorkspace>['data']>; working: boolean; error: string; choose: (identity: ClassifiedIdentityType) => void }) {
  return <div className="min-h-screen bg-[#f4f1ed] px-4 py-10 text-stone-900"><div className="mx-auto max-w-4xl"><div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.2em] text-stone-400">PiraNegócios Classificados</p><h1 className="mt-3 font-serif text-3xl font-black sm:text-5xl">Como você quer entrar?</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-500">Essa escolha define o workspace inteiro. O PiraNegócios lembra o último perfil usado e você pode trocar depois.</p></div>{error && <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}<div className="mt-8 grid gap-4 md:grid-cols-2"><button disabled={working} onClick={() => choose('PERSONAL')} className="group rounded-[30px] border border-[#e3cbbf] bg-[#fff8f3] p-7 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f1d5c7] text-[#994b39]"><User className="h-6 w-6" /></div><p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-[#b76850]">PiraNegócios Personal</p><h2 className="mt-1 text-2xl font-black">{data.personal.name}</h2><p className="mt-3 text-sm leading-6 text-stone-500">Venda seus próprios itens, compre e negocie como particular. Seus anúncios ficam separados da empresa.</p><span className="mt-6 inline-flex rounded-2xl bg-[#9f4e3d] px-4 py-3 text-xs font-black text-white">Entrar como Personal</span></button>{data.company && <button disabled={working || !data.company.available} onClick={() => choose('COMPANY')} className="group relative rounded-[30px] border-2 border-[#5a9d95] bg-[#f3faf8] p-7 text-left shadow-[0_20px_60px_rgba(21,90,85,.12)] transition hover:-translate-y-1 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-55"><span className="absolute right-5 top-5 rounded-full bg-[#0d4542] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-white">Recomendado para negócios</span><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d6ebe7] text-[#155a55]"><Building2 className="h-6 w-6" /></div><p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">PiraNegócios Business</p><div className="mt-1 flex items-center gap-2"><h2 className="text-2xl font-black">{data.company.name}</h2>{data.company.verified && <BadgeCheck className="h-5 w-5 text-emerald-600" />}</div><p className="mt-3 text-sm leading-6 text-stone-500">Identidade empresarial, selo de verificação, catálogo, página da empresa e apresentação comercial mais forte.</p><span className="mt-6 inline-flex rounded-2xl bg-[#0d4542] px-4 py-3 text-xs font-black text-white">Entrar como Business</span></button>}</div></div></div>;
}

function OnboardingFrame({ mode, title, subtitle, error, children }: { mode: 'PERSONAL' | 'BUSINESS'; title: string; subtitle: string; error?: string; children: React.ReactNode }) {
  const business = mode === 'BUSINESS';
  return <div className={`min-h-screen px-4 py-10 ${business ? 'bg-[#edf6f4]' : 'bg-[#fff4ed]'}`}><div className="mx-auto max-w-3xl"><p className={`text-[10px] font-black uppercase tracking-[.2em] ${business ? 'text-[#44736e]' : 'text-[#b76850]'}`}>PiraNegócios {business ? 'Business' : 'Personal'} · Classificados</p><h1 className="mt-3 font-serif text-3xl font-black text-stone-900 sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">{subtitle}</p>{error && <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}<div className="mt-7 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[.06] sm:p-7">{children}</div></div></div>;
}

function ToggleCard({ checked, onClick, icon, title, text }: { checked: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) { return <button type="button" onClick={onClick} className={`rounded-3xl border p-4 text-left transition ${checked ? 'border-[#4b8f87] bg-[#edf7f5] ring-2 ring-[#4b8f87]/15' : 'border-stone-200 bg-white'}`}><div className="flex items-start gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${checked ? 'bg-[#0d4542] text-white' : 'bg-stone-100 text-stone-500'}`}>{icon}</span><span><span className="block text-sm font-black text-stone-900">{title}</span><span className="mt-1 block text-xs leading-5 text-stone-500">{text}</span></span></div></button>; }
function ChannelCheck({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-xs font-black ${checked ? 'border-[#72aaa3] bg-[#eef8f6] text-[#155a55]' : 'border-stone-200 bg-white text-stone-500'}`}><span className={`h-4 w-4 rounded-md border ${checked ? 'border-[#155a55] bg-[#155a55] shadow-[inset_0_0_0_3px_white]' : 'border-stone-300'}`} />{label}</button>; }
function WorkspaceLoading({ error }: { error?: string }) { return <div className="flex min-h-screen items-center justify-center bg-[#f5f2ef] px-4"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-stone-200 border-t-stone-700" /><p className="mt-4 text-sm font-bold text-stone-500">Abrindo seus Classificados...</p>{error && <p className="mt-3 text-xs text-red-600">{error}</p>}</div></div>; }
function WorkspaceBrand({ business, compact = false }: { business: boolean; compact?: boolean }) { return <Link to="/" className={`flex items-center gap-3 ${compact ? '' : 'px-5 pb-4 pt-6'}`}><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white font-serif text-lg font-black text-stone-900">P</span><span><span className="block font-serif text-lg font-black leading-none">PiraNegócios</span><span className={`mt-1 block text-[9px] font-black uppercase tracking-[.22em] ${business ? 'text-[#91b7b2]' : 'text-[#d6a99d]'}`}>{business ? 'Business' : 'Personal'}</span></span></Link>; }
function IdentityAvatar({ business, name }: { business: boolean; name: string }) { return <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${business ? 'bg-[#2f8b7d]' : 'bg-[#d86b4d]'}`}>{business ? <Building2 className="h-5 w-5" /> : <span className="text-sm font-black">{name.charAt(0).toUpperCase()}</span>}</span>; }
function IdentityMenu({ active, personalName, companyName, onSelect }: { active: ClassifiedIdentityType; personalName: string; companyName: string; onSelect: (identity: ClassifiedIdentityType) => void }) { return <div className="absolute left-0 right-0 top-[78px] z-50 rounded-[20px] border border-stone-200 bg-white p-2 text-stone-900 shadow-2xl"><button onClick={() => onSelect('PERSONAL')} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${active === 'PERSONAL' ? 'bg-[#fff1e9]' : 'hover:bg-stone-50'}`}><User className="h-4 w-4 text-[#a84f34]" /><span><span className="block text-xs font-black">{personalName}</span><span className="text-[10px] text-stone-400">PiraNegócios Personal</span></span></button><button onClick={() => onSelect('COMPANY')} className={`mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${active === 'COMPANY' ? 'bg-[#eaf6f3]' : 'hover:bg-stone-50'}`}><Building2 className="h-4 w-4 text-[#155a55]" /><span><span className="block text-xs font-black">{companyName}</span><span className="text-[10px] text-stone-400">PiraNegócios Business</span></span></button></div>; }
