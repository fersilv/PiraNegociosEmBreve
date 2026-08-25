import React, { useEffect, useState } from 'react';
import { Building2, Check, Store, Wrench } from 'lucide-react';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import type { ClassifiedPublicationChannel } from '../types/classifieds';

export default function ClassifiedsSettingsPage() {
  const { data, configureCompany, error } = useClassifiedsWorkspace();
  const company = data?.company;
  const business = data?.activeIdentity === 'COMPANY';
  const [saving, setSaving] = useState(false);
  const [canSellProducts, setCanSellProducts] = useState(company?.canSellProducts ?? true);
  const [canOfferServices, setCanOfferServices] = useState(company?.canOfferServices ?? false);
  const [segments, setSegments] = useState((company?.businessSegments || []).join(', '));
  const [pageSectionLabel, setPageSectionLabel] = useState(company?.pageSectionLabel || '');
  const [channels, setChannels] = useState<ClassifiedPublicationChannel[]>(company?.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE']);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!company) return;
    setCanSellProducts(company.canSellProducts);
    setCanOfferServices(company.canOfferServices);
    setSegments(company.businessSegments.join(', '));
    setPageSectionLabel(company.pageSectionLabel || '');
    setChannels(company.defaultPublicationChannels);
  }, [company?.id]);

  if (!business || !company) {
    return <div className="mx-auto max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b76850]">PiraNegócios Personal</p><h1 className="mt-1 font-serif text-3xl font-black">Configurações dos Classificados</h1><div className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[.06]"><h2 className="text-lg font-black">Seu perfil Personal está ativo</h2><p className="mt-2 text-sm leading-6 text-stone-500">Seus anúncios pessoais são publicados como Particular e ficam separados da identidade empresarial. Preferências da conta e dados pessoais continuam nas configurações gerais do PiraNegócios.</p></div></div>;
  }

  const toggleChannel = (channel: ClassifiedPublicationChannel) => setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  const save = async () => {
    if (saving || (!canSellProducts && !canOfferServices) || !channels.length) return;
    setSaving(true); setSaved(false);
    try {
      await configureCompany({
        canSellProducts,
        canOfferServices,
        businessSegments: segments.split(',').map((item) => item.trim()).filter(Boolean),
        defaultPublicationChannels: channels,
        pageSectionLabel: pageSectionLabel || null,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">PiraNegócios Business</p>
      <h1 className="mt-1 font-serif text-3xl font-black">Classificados da empresa</h1>
      <p className="mt-2 text-sm leading-6 text-stone-500">Defina o comportamento padrão da vitrine. Você continua podendo alterar os canais de um anúncio específico na hora de publicar.</p>
      {error && <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <div className="mt-6 space-y-5">
        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[.06]">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dcece9] text-[#155a55]"><Building2 className="h-5 w-5" /></span><div><h2 className="font-black">{company.name}</h2><p className="text-xs text-stone-500">Identidade Business verificada e habilitada para os Classificados.</p></div></div>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[.06]">
          <h2 className="font-black">Atuação comercial</h2><p className="mt-1 text-xs leading-5 text-stone-500">Uma empresa pode vender produtos, prestar serviços ou fazer as duas coisas.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><SettingToggle active={canSellProducts} onClick={() => setCanSellProducts((value) => !value)} icon={<Store className="h-5 w-5" />} title="Venda de produtos" /><SettingToggle active={canOfferServices} onClick={() => setCanOfferServices((value) => !value)} icon={<Wrench className="h-5 w-5" />} title="Prestação de serviços" /></div>
          <label className="mt-5 block"><span className="text-xs font-black uppercase tracking-[.13em] text-stone-500">Ramos e segmentos</span><input value={segments} onChange={(event) => setSegments(event.target.value)} placeholder="Ex.: Pizzaria, Restaurante, Delivery" className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#5a9d95]" /><span className="mt-1 block text-[10px] text-stone-400">Separe vários segmentos por vírgula.</span></label>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[.06]">
          <h2 className="font-black">Vitrine na página da empresa</h2><p className="mt-1 text-xs leading-5 text-stone-500">O mesmo anúncio pode existir só no marketplace, só na sua página ou nos dois lugares.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><ChannelOption active={channels.includes('CLASSIFIEDS')} onClick={() => toggleChannel('CLASSIFIEDS')} title="Classificados" text="Entra na busca e nas categorias públicas." /><ChannelOption active={channels.includes('COMPANY_PAGE')} onClick={() => toggleChannel('COMPANY_PAGE')} title="Página da empresa" text="Aparece automaticamente na sua vitrine pública." /></div>
          <label className="mt-5 block"><span className="text-xs font-black uppercase tracking-[.13em] text-stone-500">Nome da seção na sua página</span><input value={pageSectionLabel} onChange={(event) => setPageSectionLabel(event.target.value)} placeholder="Produtos, Serviços, Cardápio, Imóveis..." className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#5a9d95]" /><span className="mt-1 block text-[10px] text-stone-400">A apresentação pode acompanhar o seu ramo sem mudar a estrutura dos anúncios.</span></label>
        </section>

        <div className="flex items-center justify-end gap-3">{saved && <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700"><Check className="h-4 w-4" /> Salvo</span>}<button disabled={saving || (!canSellProducts && !canOfferServices) || !channels.length} onClick={() => void save()} className="rounded-2xl bg-[#0d4542] px-6 py-3.5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar configurações'}</button></div>
      </div>
    </div>
  );
}

function SettingToggle({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) { return <button onClick={onClick} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${active ? 'border-[#5a9d95] bg-[#edf7f5] text-[#155a55]' : 'border-stone-200 bg-white text-stone-500'}`}><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-[#0d4542] text-white' : 'bg-stone-100'}`}>{icon}</span><span className="text-sm font-black">{title}</span>{active && <Check className="ml-auto h-4 w-4" />}</button>; }
function ChannelOption({ active, onClick, title, text }: { active: boolean; onClick: () => void; title: string; text: string }) { return <button onClick={onClick} className={`rounded-2xl border p-4 text-left ${active ? 'border-[#5a9d95] bg-[#edf7f5]' : 'border-stone-200 bg-white'}`}><div className="flex items-center justify-between"><span className="text-sm font-black text-stone-900">{title}</span><span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? 'bg-[#0d4542] text-white' : 'border border-stone-300'}`}>{active && <Check className="h-3 w-3" />}</span></div><p className="mt-2 text-xs leading-5 text-stone-500">{text}</p></button>; }
