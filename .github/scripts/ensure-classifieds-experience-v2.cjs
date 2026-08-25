const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`updated ${file}`);
  }
}

function replace(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Classifieds experience v2 missing ${label}`);
  return source.replace(from, to);
}

patch('components/classifieds/ClassifiedsWorkspaceLayout.tsx', (input) => {
  let source = input;
  source = replace(
    source,
    "import { BadgeCheck, Building2, ChevronDown, Compass, Home, LogOut, Menu, MessageCircle, Plus, Settings2, Store, User, X } from 'lucide-react';",
    "import { BadgeCheck, BadgeDollarSign, BarChart3, Briefcase, Building2, ChevronDown, Compass, Home, LogOut, Menu, MessageCircle, Plus, Settings2, Store, User, Wrench, X } from 'lucide-react';",
    'workspace icon imports',
  );
  source = replace(
    source,
    `  const nav = [\n    { to: '/classificados/painel', label: 'Painel', icon: <Home className=\"h-5 w-5\" /> },\n    { to: '/classificados', label: 'Explorar', icon: <Compass className=\"h-5 w-5\" />, publicLink: true },\n    { to: '/classificados/publicar', label: 'Novo anúncio', icon: <Plus className=\"h-5 w-5\" /> },\n    { to: '/classificados/conversas', label: 'Conversas', icon: <MessageCircle className=\"h-5 w-5\" /> },\n    { to: '/classificados/configuracoes', label: 'Configurações', icon: <Settings2 className=\"h-5 w-5\" /> },\n  ];`,
    `  const nav = [\n    { to: '/classificados/painel', label: 'Painel', icon: <Home className=\"h-5 w-5\" /> },\n    { to: '/classificados/explorar', label: 'Explorar', icon: <Compass className=\"h-5 w-5\" /> },\n    ...(!business || data.company?.canSellProducts !== false ? [{ to: '/classificados/anuncios', label: 'Meus anúncios', icon: <Store className=\"h-5 w-5\" /> }] : []),\n    ...(!business || data.company?.canOfferServices !== false ? [{ to: '/classificados/servicos', label: 'Meus serviços', icon: <Wrench className=\"h-5 w-5\" /> }] : []),\n    { to: '/classificados/ofertas', label: 'Ofertas', icon: <BadgeDollarSign className=\"h-5 w-5\" /> },\n    { to: '/classificados/conversas', label: 'Conversas', icon: <MessageCircle className=\"h-5 w-5\" /> },\n    { to: '/classificados/analytics', label: 'Analytics', icon: <BarChart3 className=\"h-5 w-5\" /> },\n    { to: '/classificados/publicar', label: 'Novo anúncio', icon: <Plus className=\"h-5 w-5\" /> },\n    { to: '/classificados/configuracoes', label: 'Configurações', icon: <Settings2 className=\"h-5 w-5\" /> },\n  ];`,
    'workspace internal nav',
  );
  source = replace(
    source,
    `<WorkspaceBrand business={business} />\n        <div className=\"relative mx-4 mt-2\">`,
    `<WorkspaceBrand business={business} />\n        <div className=\"mx-4 mb-3 grid grid-cols-2 gap-2\"><Link to=\"/user\" className=\"flex items-center justify-center gap-1.5 rounded-xl bg-white/[.07] px-2 py-2 text-[10px] font-black text-white/70 hover:bg-white/[.12] hover:text-white\"><Briefcase className=\"h-3.5 w-3.5\" /> Career</Link>{data.company?.available && <Link to=\"/company\" className=\"flex items-center justify-center gap-1.5 rounded-xl bg-white/[.07] px-2 py-2 text-[10px] font-black text-white/70 hover:bg-white/[.12] hover:text-white\"><Building2 className=\"h-3.5 w-3.5\" /> Business</Link>}</div>\n        <div className=\"relative mx-4 mt-2\">`,
    'desktop workspace switcher',
  );
  source = replace(
    source,
    `<nav className=\"flex-1 space-y-1 px-4\">{nav.map((item) => item.publicLink ? <Link key={item.to} to={item.to} className=\"flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/62 transition hover:bg-white/[.07] hover:text-white\">{item.icon}{item.label}</Link> : <NavLink key={item.to} to={item.to} end={item.to === '/classificados/painel'} className={({ isActive }) => \`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition \${isActive ? 'bg-white text-stone-900 shadow-lg' : 'text-white/62 hover:bg-white/[.07] hover:text-white'}\`}>{item.icon}{item.label}</NavLink>)}</nav>`,
    `<nav className=\"flex-1 space-y-1 overflow-y-auto px-4 pb-3\">{nav.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/classificados/painel'} className={({ isActive }) => \`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition \${isActive ? 'bg-white text-stone-900 shadow-lg' : 'text-white/62 hover:bg-white/[.07] hover:text-white'}\`}>{item.icon}{item.label}</NavLink>)}</nav>`,
    'desktop nav rendering',
  );
  source = replace(
    source,
    `<div className=\"mt-4 rounded-2xl border border-white/10 bg-white/[.07] p-3\">`,
    `<div className=\"mt-4 grid grid-cols-2 gap-2\"><Link to=\"/user\" onClick={() => setMobileOpen(false)} className=\"flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black\"><Briefcase className=\"h-3.5 w-3.5\" /> Career</Link>{data.company?.available && <Link to=\"/company\" onClick={() => setMobileOpen(false)} className=\"flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black\"><Building2 className=\"h-3.5 w-3.5\" /> Business</Link>}</div><div className=\"mt-3 rounded-2xl border border-white/10 bg-white/[.07] p-3\">`,
    'mobile workspace switcher',
  );
  source = replace(
    source,
    `<div className=\"text-center\"><p className=\"text-[10px] font-black uppercase tracking-[.2em] text-stone-400\">PiraNegócios Classificados</p>`,
    `<div className=\"mb-6 flex justify-center gap-2\"><Link to=\"/user\" className=\"rounded-xl bg-white px-4 py-2 text-xs font-black text-stone-600 shadow-sm ring-1 ring-stone-200\">Voltar para Career</Link>{data.company?.available && <Link to=\"/company\" className=\"rounded-xl bg-white px-4 py-2 text-xs font-black text-stone-600 shadow-sm ring-1 ring-stone-200\">Ir para Business</Link>}</div><div className=\"text-center\"><p className=\"text-[10px] font-black uppercase tracking-[.2em] text-stone-400\">PiraNegócios Classificados</p>`,
    'identity choice exit',
  );
  source = replace(
    source,
    `<div className=\"mx-auto max-w-3xl\"><p className={\`text-[10px] font-black uppercase tracking-[.2em] \${business ? 'text-[#44736e]' : 'text-[#b76850]'}\`}>`,
    `<div className=\"mx-auto max-w-3xl\"><div className=\"mb-5 flex flex-wrap gap-2\"><Link to=\"/user\" className=\"rounded-xl bg-white px-4 py-2 text-xs font-black text-stone-600 shadow-sm ring-1 ring-black/[.06]\">Agora não · voltar para Career</Link>{business && <Link to=\"/company\" className=\"rounded-xl bg-white px-4 py-2 text-xs font-black text-stone-600 shadow-sm ring-1 ring-black/[.06]\">Voltar para Business</Link>}</div><p className={\`text-[10px] font-black uppercase tracking-[.2em] \${business ? 'text-[#44736e]' : 'text-[#b76850]'}\`}>`,
    'onboarding exit',
  );
  return source;
});

patch('pages/ClassifiedPublishPage.tsx', (input) => {
  let source = input;
  source = replace(
    source,
    "import { ClassifiedCategoryIcon } from '../components/classifieds/ClassifiedCategoryIcon';",
    "import { ClassifiedCategoryIcon } from '../components/classifieds/ClassifiedCategoryIcon';\nimport { ClassifiedListingPreview } from '../components/classifieds/ClassifiedListingPreview';",
    'preview import',
  );
  source = replace(
    source,
    `  const [channelsTouched, setChannelsTouched] = useState(false);`,
    `  const [channelsTouched, setChannelsTouched] = useState(false);\n  const [photoLimit, setPhotoLimit] = useState(1);\n  const [previewOpen, setPreviewOpen] = useState(false);`,
    'publish preview state',
  );
  source = replace(
    source,
    `  useEffect(() => {\n    api.get('/classifieds/categories').then((response) => setCategories(Array.isArray(response.data) ? response.data : [])).catch(() => setCategories([]));\n  }, []);`,
    `  useEffect(() => {\n    api.get('/classifieds/categories').then((response) => setCategories(Array.isArray(response.data) ? response.data : [])).catch(() => setCategories([]));\n    api.get('/classifieds/me/limits').then((response) => setPhotoLimit(Math.max(1, Math.min(6, Number(response.data?.photoLimit) || 1)))).catch(() => setPhotoLimit(1));\n  }, [data?.activeIdentity, data?.company?.id]);`,
    'publish limits load',
  );
  source = replace(
    source,
    `    const available = 12 - form.images.length;\n    const selected = Array.from(files).slice(0, available);\n    if (!selected.length) { setError('Você pode enviar até 12 fotos.'); return; }`,
    `    const available = photoLimit - form.images.length;\n    const selected = Array.from(files).slice(0, Math.max(0, available));\n    if (!selected.length) { setError(photoLimit === 1 ? 'O plano Free permite 1 foto por anúncio. Planos pagos permitem até 6.' : \`Você pode enviar até \${photoLimit} fotos.\`); return; }`,
    'publish photo limit',
  );
  source = replace(
    source,
    `<div className=\"mx-auto max-w-5xl pb-12 text-[#2d211c]\">`,
    `<div className=\"mx-auto max-w-5xl pb-12 text-[#2d211c]\"><aside className=\"fixed right-5 top-28 z-20 hidden w-[280px] 2xl:block\"><p className=\"mb-2 text-[9px] font-black uppercase tracking-[.14em] text-stone-400\">Como está ficando</p><ClassifiedListingPreview value={form} /></aside>`,
    'desktop live preview',
  );
  source = replace(
    source,
    `<button onClick={() => void saveDraft()} disabled={saving} className=\"ml-auto hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#604c42] shadow-sm ring-1 ring-black/[.06] hover:bg-stone-50 sm:inline-flex\">`,
    `<button type=\"button\" onClick={() => setPreviewOpen(true)} className=\"ml-auto inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#604c42] shadow-sm ring-1 ring-black/[.06] sm:hidden\">Prévia</button><button onClick={() => void saveDraft()} disabled={saving} className=\"hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#604c42] shadow-sm ring-1 ring-black/[.06] hover:bg-stone-50 sm:ml-auto sm:inline-flex\">`,
    'mobile preview button',
  );
  source = replace(
    source,
    `      <div className=\"mt-5 flex items-center justify-between gap-3\">`,
    `      <div className=\"mt-3 text-[10px] font-bold text-stone-400\">Fotos permitidas neste workspace: {photoLimit}. {photoLimit === 1 ? 'Planos pagos Business liberam até 6 fotos.' : \`Seu plano permite até \${photoLimit} fotos.\`}</div>\n      <div className=\"mt-5 flex items-center justify-between gap-3\">`,
    'photo entitlement copy',
  );
  source = replace(
    source,
    `      </div>\n    </div>\n  );\n}\n\nfunction TypeCategoryStep`,
    `      </div>\n      {previewOpen && <div className=\"fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 sm:hidden\"><button className=\"absolute inset-0\" aria-label=\"Fechar prévia\" onClick={() => setPreviewOpen(false)} /><div className=\"relative w-full max-w-sm\"><button onClick={() => setPreviewOpen(false)} className=\"absolute -right-2 -top-12 z-10 rounded-full bg-white px-4 py-2 text-xs font-black text-stone-700\">Fechar</button><ClassifiedListingPreview value={form} /></div></div>}\n    </div>\n  );\n}\n\nfunction TypeCategoryStep`,
    'mobile preview modal',
  );
  return source;
});

console.log('Classifieds experience v2 verified.');
