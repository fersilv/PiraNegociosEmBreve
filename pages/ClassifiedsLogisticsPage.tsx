import React, { useEffect, useState } from 'react';
import { Building2, Check, Loader2, MapPin, PackageCheck, Plus, RefreshCw, Save, Trash2, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';

type Address = {
  id: string;
  label: string;
  zipCode: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
  active: boolean;
};

type CompanySettings = {
  onlinePaymentsEnabled: boolean;
  pixEnabled: boolean;
  cardEnabled: boolean;
  defaultPixDiscountBps: number;
  defaultMaxInstallments: number;
  defaultInterestFreeInstallments: number;
  pickupEnabled: boolean;
  ownDeliveryEnabled: boolean;
  platformPartnersEnabled: boolean;
  defaultStockTracking: boolean;
  defaultLowStockThreshold?: number | null;
};

type Location = Address & {
  name: string;
  allowsPickup: boolean;
  allowsDeliveryOrigin: boolean;
  isDefaultPickup: boolean;
  isDefaultDeliveryOrigin: boolean;
  pickupInstructions?: string | null;
};

type Partner = {
  id: string;
  name: string;
  type: string;
  status: string;
  companyEnabled: boolean;
  settlementMode: 'PREPAID' | 'INVOICE';
  supportsPrepaidBalance?: boolean;
};

const emptyAddress = {
  label: 'Principal', zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', isDefault: false, active: true,
};

const emptyLocation = {
  name: 'Loja / retirada', zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', allowsPickup: true, allowsDeliveryOrigin: true, isDefaultPickup: false, isDefaultDeliveryOrigin: false, pickupInstructions: '', active: true,
};

export default function ClassifiedsLogisticsPage() {
  const { data } = useClassifiedsWorkspace();
  const business = data?.activeIdentity === 'COMPANY';
  const [features, setFeatures] = useState<any>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [addressForm, setAddressForm] = useState({ ...emptyAddress });
  const [locationForm, setLocationForm] = useState({ ...emptyLocation });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [featuresResponse, addressesResponse] = await Promise.all([
        api.get('/classifieds/commerce/features'),
        api.get('/classifieds/commerce/addresses'),
      ]);
      setFeatures(featuresResponse.data || {});
      setAddresses(Array.isArray(addressesResponse.data) ? addressesResponse.data : []);
      if (business) {
        const [settingsResponse, locationsResponse, partnersResponse] = await Promise.all([
          api.get('/classifieds/commerce/company/settings'),
          api.get('/classifieds/commerce/company/locations'),
          api.get('/classifieds/delivery/company/partners').catch(() => ({ data: [] })),
        ]);
        setSettings(settingsResponse.data as CompanySettings);
        setLocations(Array.isArray(locationsResponse.data) ? locationsResponse.data : []);
        setPartners(Array.isArray(partnersResponse.data) ? partnersResponse.data : []);
      } else {
        setSettings(null); setLocations([]); setPartners([]);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar as configurações de logística.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [business, data?.company?.id]);

  const createAddress = async () => {
    if (working) return;
    setWorking(true); setError(''); setNotice('');
    try {
      await api.post('/classifieds/commerce/addresses', addressForm);
      setAddressForm({ ...emptyAddress });
      setNotice('Endereço salvo.');
      await load();
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar o endereço.'); }
    finally { setWorking(false); }
  };

  const setDefault = async (id: string) => {
    if (working) return;
    setWorking(true); setError('');
    try { await api.post(`/classifieds/commerce/addresses/${id}/default`); await load(); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível definir o endereço padrão.'); }
    finally { setWorking(false); }
  };

  const removeAddress = async (id: string) => {
    if (working || !window.confirm('Remover este endereço da lista ativa? O histórico de pedidos é preservado.')) return;
    setWorking(true); setError('');
    try { await api.delete(`/classifieds/commerce/addresses/${id}`); await load(); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível remover o endereço.'); }
    finally { setWorking(false); }
  };

  const saveSettings = async () => {
    if (!settings || working) return;
    setWorking(true); setError(''); setNotice('');
    try {
      const response = await api.patch('/classifieds/commerce/company/settings', settings);
      setSettings(response.data);
      setNotice('Configuração comercial padrão atualizada.');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar a configuração da empresa.'); }
    finally { setWorking(false); }
  };

  const createLocation = async () => {
    if (working) return;
    setWorking(true); setError(''); setNotice('');
    try {
      await api.post('/classifieds/commerce/company/locations', locationForm);
      setLocationForm({ ...emptyLocation });
      setNotice('Ponto da empresa salvo.');
      await load();
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar o ponto da empresa.'); }
    finally { setWorking(false); }
  };

  const removeLocation = async (id: string) => {
    if (working || !window.confirm('Desativar este ponto? Pedidos antigos continuam com o snapshot original.')) return;
    setWorking(true); setError('');
    try { await api.delete(`/classifieds/commerce/company/locations/${id}`); await load(); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível desativar o ponto.'); }
    finally { setWorking(false); }
  };

  const togglePartner = async (partner: Partner, enabled: boolean, settlementMode = partner.settlementMode || 'INVOICE') => {
    if (working) return;
    setWorking(true); setError('');
    try {
      await api.patch(`/classifieds/delivery/company/partners/${partner.id}`, { enabled, settlementMode });
      await load();
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível atualizar o parceiro.'); }
    finally { setWorking(false); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Comércio e recebimento</p><h1 className="mt-1 font-serif text-3xl font-black">Logística e endereços</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Endereço do comprador, retirada, origem de entrega e parceiros ficam no mesmo lugar. Produtos Business herdam os padrões da empresa, salvo exceção no próprio anúncio.</p></div>
        <button onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </header>
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-[#b06448]" /><div><h2 className="font-serif text-xl font-black">Meus endereços</h2><p className="text-xs text-stone-500">Compartilhados em qualquer workspace pessoal desta conta.</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {addresses.filter((item) => item.active).map((item) => <div key={item.id} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black">{item.label}</p><p className="mt-1 text-xs leading-5 text-stone-500">{item.street}, {item.number}{item.complement ? ` · ${item.complement}` : ''}<br />{item.neighborhood} · {item.city}/{item.state} · {item.zipCode}</p></div>{item.isDefault && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">PADRÃO</span>}</div><div className="mt-3 flex gap-2">{!item.isDefault && <button disabled={working} onClick={() => void setDefault(item.id)} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black ring-1 ring-stone-200"><Check className="mr-1 inline h-3 w-3" /> Usar como padrão</button>}<button disabled={working} onClick={() => void removeAddress(item.id)} className="ml-auto rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-600"><Trash2 className="mr-1 inline h-3 w-3" /> Remover</button></div></div>)}
        </div>
        <div className="mt-5 rounded-2xl border border-dashed border-stone-300 p-4"><p className="text-xs font-black text-stone-600">Adicionar endereço</p><AddressFields value={addressForm} onChange={setAddressForm} labelKey="label" /><label className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-600"><input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))} /> Tornar padrão</label><button disabled={working} onClick={() => void createAddress()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-stone-900 px-4 text-xs font-black text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Salvar endereço</button></div>
      </section>

      {business && settings && <>
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-[#276b64]" /><div><h2 className="font-serif text-xl font-black">Padrões comerciais da empresa</h2><p className="text-xs text-stone-500">Anúncios usam estes valores por padrão. Uma exceção por produto pode sobrescrever a logística.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Toggle label="Pagamento online" checked={settings.onlinePaymentsEnabled} onChange={(value) => setSettings({ ...settings, onlinePaymentsEnabled: value })} /><Toggle label="Pix" checked={settings.pixEnabled} onChange={(value) => setSettings({ ...settings, pixEnabled: value })} /><Toggle label="Cartão" checked={settings.cardEnabled} onChange={(value) => setSettings({ ...settings, cardEnabled: value })} /><Toggle label="Retirada" checked={settings.pickupEnabled} onChange={(value) => setSettings({ ...settings, pickupEnabled: value })} /><Toggle label="Entrega própria" checked={settings.ownDeliveryEnabled} onChange={(value) => setSettings({ ...settings, ownDeliveryEnabled: value })} /><Toggle label="Parceiros da plataforma" checked={settings.platformPartnersEnabled} onChange={(value) => setSettings({ ...settings, platformPartnersEnabled: value })} /><Toggle label="Controle de estoque padrão" checked={settings.defaultStockTracking} onChange={(value) => setSettings({ ...settings, defaultStockTracking: value })} /></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><NumberField label="Desconto Pix (%)" value={Number(settings.defaultPixDiscountBps || 0) / 100} onChange={(value) => setSettings({ ...settings, defaultPixDiscountBps: Math.max(0, Math.round(value * 100)) })} /><NumberField label="Máx. parcelas" value={settings.defaultMaxInstallments} onChange={(value) => setSettings({ ...settings, defaultMaxInstallments: Math.max(1, Math.round(value)) })} /><NumberField label="Parcelas sem juros" value={settings.defaultInterestFreeInstallments} onChange={(value) => setSettings({ ...settings, defaultInterestFreeInstallments: Math.max(0, Math.round(value)) })} /></div><button disabled={working} onClick={() => void saveSettings()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0d4542] px-5 text-xs font-black text-white"><Save className="h-4 w-4" /> Salvar padrões</button></section>

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><div className="flex items-center gap-3"><PackageCheck className="h-5 w-5 text-[#276b64]" /><div><h2 className="font-serif text-xl font-black">Pontos de retirada e origem</h2><p className="text-xs text-stone-500">Cadastre loja, depósito ou unidade. O histórico de pedidos guarda snapshot mesmo se o ponto for desativado.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{locations.filter((item: any) => item.active).map((item: any) => <div key={item.id} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><div className="flex justify-between gap-3"><div><p className="text-sm font-black">{item.name}</p><p className="mt-1 text-xs leading-5 text-stone-500">{item.street}, {item.number} · {item.neighborhood}<br />{item.city}/{item.state} · {item.zipCode}</p></div><div className="flex flex-col items-end gap-1">{item.isDefaultPickup && <Tag>RETIRADA PADRÃO</Tag>}{item.isDefaultDeliveryOrigin && <Tag>ORIGEM PADRÃO</Tag>}</div></div><p className="mt-2 text-[10px] font-bold text-stone-400">{item.allowsPickup ? 'Retirada habilitada' : 'Sem retirada'} · {item.allowsDeliveryOrigin ? 'Pode ser origem de entrega' : 'Não é origem'}</p><button disabled={working} onClick={() => void removeLocation(item.id)} className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-600">Desativar</button></div>)}</div><div className="mt-5 rounded-2xl border border-dashed border-stone-300 p-4"><p className="text-xs font-black">Adicionar ponto da empresa</p><AddressFields value={locationForm} onChange={setLocationForm} labelKey="name" /><div className="mt-3 grid gap-2 sm:grid-cols-2"><Toggle label="Permitir retirada" checked={locationForm.allowsPickup} onChange={(value) => setLocationForm((current) => ({ ...current, allowsPickup: value }))} /><Toggle label="Usar como origem de entrega" checked={locationForm.allowsDeliveryOrigin} onChange={(value) => setLocationForm((current) => ({ ...current, allowsDeliveryOrigin: value }))} /><Toggle label="Retirada padrão" checked={locationForm.isDefaultPickup} onChange={(value) => setLocationForm((current) => ({ ...current, isDefaultPickup: value }))} /><Toggle label="Origem padrão" checked={locationForm.isDefaultDeliveryOrigin} onChange={(value) => setLocationForm((current) => ({ ...current, isDefaultDeliveryOrigin: value }))} /></div><label className="mt-3 block"><span className="text-[10px] font-black uppercase text-stone-400">Instruções de retirada</span><textarea rows={2} value={locationForm.pickupInstructions} onChange={(event) => setLocationForm((current) => ({ ...current, pickupInstructions: event.target.value }))} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" /></label><button disabled={working} onClick={() => void createLocation()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-stone-900 px-4 text-xs font-black text-white"><Plus className="h-4 w-4" /> Salvar ponto</button></div></section>

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><div className="flex items-center gap-3"><Truck className="h-5 w-5 text-[#276b64]" /><div><h2 className="font-serif text-xl font-black">Parceiros de entrega</h2><p className="text-xs text-stone-500">A empresa escolhe quem pode aparecer nas cotações e se a liquidação será por fatura ou saldo, quando suportado.</p></div></div>{!features?.localDeliveryPartners ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-800">Parceiros locais estão instalados, mas a feature flag ainda está desligada neste ambiente.</p> : <div className="mt-4 space-y-2">{partners.map((partner) => <div key={partner.id} className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-black">{partner.name}</p><p className="mt-1 text-[10px] font-bold text-stone-400">{partner.type} · {partner.status}</p></div><select value={partner.settlementMode || 'INVOICE'} disabled={!partner.companyEnabled || working} onChange={(event) => void togglePartner(partner, true, event.target.value as any)} className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold"><option value="INVOICE">Fatura</option>{partner.supportsPrepaidBalance && <option value="PREPAID">Saldo pré-pago</option>}</select><button disabled={working} onClick={() => void togglePartner(partner, !partner.companyEnabled)} className={`h-10 rounded-xl px-4 text-xs font-black ${partner.companyEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>{partner.companyEnabled ? 'Habilitado' : 'Habilitar'}</button></div>)}</div>}</section>
      </>}
    </div>
  );
}

function AddressFields({ value, onChange, labelKey }: { value: any; onChange: React.Dispatch<React.SetStateAction<any>>; labelKey: 'label' | 'name' }) {
  const field = (key: string, label: string, span = '') => <label className={span}><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span><input value={value[key] || ''} onChange={(event) => onChange((current: any) => ({ ...current, [key]: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#8fbeb8]" /></label>;
  return <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{field(labelKey, labelKey === 'label' ? 'Nome do endereço' : 'Nome do ponto')}{field('zipCode','CEP')}{field('street','Rua','lg:col-span-2')}{field('number','Número')}{field('complement','Complemento')}{field('neighborhood','Bairro')}{field('city','Cidade')}{field('state','UF')}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 text-left text-xs font-black ring-1 ${checked ? 'bg-[#e7f2ef] text-[#155a55] ring-[#b9d7d2]' : 'bg-stone-50 text-stone-500 ring-stone-200'}`}><span>{label}</span><span className={`h-5 w-9 rounded-full p-0.5 ${checked ? 'bg-[#2f8b7d]' : 'bg-stone-300'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} /></span></button>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span><input type="number" min={0} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm font-bold" /></label>;
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#e7f2ef] px-2 py-1 text-[8px] font-black text-[#276b64]">{children}</span>;
}
