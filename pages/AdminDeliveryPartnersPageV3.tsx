import React, { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  WalletCards,
} from 'lucide-react';
import { api } from '../lib/api';

type CoverageCity = { ibgeId?: number | null; city: string; state: string };
type Municipality = { id: number; nome: string };
type Partner = {
  id: string;
  name: string;
  type: string;
  status: string;
  priority?: number;
  cities?: Array<CoverageCity | string>;
  maxWeightGrams?: number | null;
  maxLengthCm?: number | null;
  maxWidthCm?: number | null;
  maxHeightCm?: number | null;
  maxVolumeCm3?: number | null;
  supportsRoundTrip?: boolean;
  supportsPrepaidBalance?: boolean;
  channelType?: string;
  channelTarget?: string | null;
  pixKey?: string | null;
  payoutDeadlineHours?: number;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
};
type ChannelBinding = { instanceId?: string | null; targetType?: string; targetId?: string | null; targetLabel?: string | null };
type WhatsAppInstance = { id: string; name: string; phoneNumber?: string | null; status?: string; connected?: boolean; active?: boolean };
type WhatsAppGroup = { id: string; name: string };
type RateRule = {
  id: string;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  zipCodeStart?: string | null;
  zipCodeEnd?: string | null;
  minDistanceMeters?: number | null;
  maxDistanceMeters?: number | null;
  fixedPriceCents?: number | null;
  minimumPriceCents?: number | null;
  perKmCents?: number | null;
  roundTripAdditionalCents?: number | null;
  estimatedMinutes?: number | null;
};
type RateTable = { id: string; version: number; name: string; active: boolean; rules?: RateRule[] };
type Tab = 'GENERAL' | 'COVERAGE' | 'DISPATCH' | 'PRICING';
type RuleMode = 'DISTANCE' | 'NEIGHBORHOOD' | 'ZIP_RANGE' | 'CITY' | 'GENERAL';

const STATES = [
  [12,'AC','Acre'],[27,'AL','Alagoas'],[16,'AP','Amapá'],[13,'AM','Amazonas'],[29,'BA','Bahia'],[23,'CE','Ceará'],[53,'DF','Distrito Federal'],[32,'ES','Espírito Santo'],[52,'GO','Goiás'],[21,'MA','Maranhão'],[51,'MT','Mato Grosso'],[50,'MS','Mato Grosso do Sul'],[31,'MG','Minas Gerais'],[15,'PA','Pará'],[25,'PB','Paraíba'],[41,'PR','Paraná'],[26,'PE','Pernambuco'],[22,'PI','Piauí'],[33,'RJ','Rio de Janeiro'],[24,'RN','Rio Grande do Norte'],[43,'RS','Rio Grande do Sul'],[11,'RO','Rondônia'],[14,'RR','Roraima'],[42,'SC','Santa Catarina'],[35,'SP','São Paulo'],[28,'SE','Sergipe'],[17,'TO','Tocantins'],
].map(([id, uf, name]) => ({ id: Number(id), uf: String(uf), name: String(name) }));

const TYPE_OPTIONS = [
  { value: 'MOTOBOY', label: 'Motoboy' },
  { value: 'BIKE', label: 'Bike / bicicleta' },
  { value: 'TRANSPORTADORA', label: 'Transportadora local' },
  { value: 'MELHOR_ENVIO', label: 'Integração / Melhor Envio' },
];
const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP_INDIVIDUAL', label: 'WhatsApp individual' },
  { value: 'WHATSAPP_GROUP_INTEGRATED', label: 'Grupo do WhatsApp integrado' },
  { value: 'WHATSAPP_GROUP_MANUAL', label: 'Grupo manual' },
  { value: 'INTEGRATION', label: 'Integração / API' },
];

const emptyForm = {
  name: '', type: 'MOTOBOY', status: 'ACTIVE', priority: 100, cities: [] as CoverageCity[],
  maxWeightKg: '', maxLengthCm: '', maxWidthCm: '', maxHeightCm: '', maxVolumeCm3: '',
  supportsRoundTrip: false, supportsPrepaidBalance: false,
  pixKey: '', payoutDeadlineHours: 24, contactName: '', contactPhone: '', notes: '',
  channelType: 'WHATSAPP_INDIVIDUAL', channelTarget: '', channelTargetLabel: '', channelInstanceId: '',
};
const emptyRule = {
  mode: 'DISTANCE' as RuleMode, state: '', city: '', neighborhood: '', zipCodeStart: '', zipCodeEnd: '',
  minDistanceKm: '', maxDistanceKm: '', fixedPrice: '', minimumPrice: '', perKm: '', roundTripAdditional: '', estimatedMinutes: '45',
};

export default function AdminDeliveryPartnersPageV3() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [tab, setTab] = useState<Tab>('GENERAL');
  const [query, setQuery] = useState('');
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [tables, setTables] = useState<RateTable[]>([]);
  const [municipalities, setMunicipalities] = useState<Record<string, Municipality[]>>({});
  const [municipalityLoading, setMunicipalityLoading] = useState<Record<string, boolean>>({});
  const [coverageUf, setCoverageUf] = useState('');
  const [coverageCityId, setCoverageCityId] = useState('');
  const [tableName, setTableName] = useState('Tabela vigente');
  const [rule, setRule] = useState({ ...emptyRule });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const coverage = normalizeCities(form.cities);
  const connectedInstances = useMemo(() => instances.filter((item) => item.active !== false && (item.connected === true || item.status === 'CONNECTED')), [instances]);
  const filteredPartners = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return partners;
    return partners.filter((partner) => `${partner.name} ${typeLabel(partner.type)} ${normalizeCities(partner.cities).map((city) => `${city.city} ${city.state}`).join(' ')}`.toLocaleLowerCase('pt-BR').includes(needle));
  }, [partners, query]);
  const totalCities = useMemo(() => new Set(partners.flatMap((partner) => normalizeCities(partner.cities).map((city) => `${city.state}:${city.ibgeId || city.city.toLowerCase()}`))).size, [partners]);

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (coverageUf) void loadMunicipalities(coverageUf); }, [coverageUf]);
  useEffect(() => { if (rule.state) void loadMunicipalities(rule.state); }, [rule.state]);
  useEffect(() => {
    if (form.channelType === 'WHATSAPP_GROUP_INTEGRATED' && form.channelInstanceId) void loadGroups(form.channelInstanceId);
    else setGroups([]);
  }, [form.channelType, form.channelInstanceId]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [partnerResponse, instanceResponse] = await Promise.all([
        api.get('/admin/classifieds-delivery/partners'),
        api.get('/admin/whatsapp/instances').catch(() => ({ data: [] })),
      ]);
      setPartners(Array.isArray(partnerResponse.data) ? partnerResponse.data : []);
      setInstances(Array.isArray(instanceResponse.data) ? instanceResponse.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os parceiros.');
    } finally { setLoading(false); }
  };

  const loadMunicipalities = async (uf: string) => {
    const state = STATES.find((item) => item.uf === String(uf).toUpperCase());
    if (!state || municipalities[state.uf]?.length) return;
    const key = `pn:ibge:municipios:${state.uf}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached?.savedAt && Date.now() - Number(cached.savedAt) < 30 * 24 * 60 * 60 * 1000 && Array.isArray(cached.items)) {
        setMunicipalities((current) => ({ ...current, [state.uf]: cached.items }));
        return;
      }
    } catch { /* cache opcional */ }
    setMunicipalityLoading((current) => ({ ...current, [state.uf]: true }));
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state.id}/municipios?orderBy=nome`);
      if (!response.ok) throw new Error('IBGE indisponível');
      const data = await response.json();
      const items = Array.isArray(data) ? data.map((item: any) => ({ id: Number(item.id), nome: String(item.nome || '') })).filter((item: Municipality) => item.id && item.nome) : [];
      setMunicipalities((current) => ({ ...current, [state.uf]: items }));
      try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items })); } catch { /* opcional */ }
    } catch {
      setError(`Não foi possível carregar as cidades de ${state.uf}.`);
    } finally { setMunicipalityLoading((current) => ({ ...current, [state.uf]: false })); }
  };

  const loadGroups = async (instanceId: string) => {
    try {
      const response = await api.get(`/admin/whatsapp/instances/${instanceId}/groups`);
      setGroups((Array.isArray(response.data) ? response.data : []).map(normalizeGroup).filter((item: WhatsAppGroup) => item.id));
    } catch (requestError: any) {
      setGroups([]);
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os grupos dessa instância.');
    }
  };

  const selectPartner = async (partner: Partner) => {
    if (!validUuid(partner?.id)) {
      setError('O cadastro selecionado está sem um identificador válido. Atualize a lista; se persistir, o registro precisa ser corrigido no banco.');
      return;
    }
    setSelected(partner); setTab('GENERAL'); setError(''); setNotice(''); setCoverageUf(''); setCoverageCityId('');
    setForm(formFromPartner(partner));
    const [tableResponse, bindingResponse] = await Promise.all([
      api.get(`/admin/classifieds-delivery/partners/${partner.id}/rate-tables`).catch(() => ({ data: [] })),
      api.get(`/admin/classifieds-delivery/partners/${partner.id}/channel-binding`).catch(() => ({ data: null })),
    ]);
    const binding = (bindingResponse.data || null) as ChannelBinding | null;
    setForm((current: any) => ({
      ...current,
      channelType: binding?.targetType || partner.channelType || 'WHATSAPP_INDIVIDUAL',
      channelTarget: binding?.targetId || partner.channelTarget || '',
      channelTargetLabel: binding?.targetLabel || '',
      channelInstanceId: binding?.instanceId || '',
    }));
    setTables(Array.isArray(tableResponse.data) ? tableResponse.data : []);
  };

  const startNew = () => {
    setSelected(null); setForm({ ...emptyForm, cities: [] }); setTables([]); setGroups([]); setTab('GENERAL'); setError(''); setNotice(''); setCoverageUf(''); setCoverageCityId('');
  };

  const corePayload = (citiesOverride?: CoverageCity[], statusOverride?: string) => ({
    name: String(form.name || '').trim(), type: form.type, status: statusOverride || form.status, priority: Number(form.priority || 100),
    cities: citiesOverride ?? normalizeCities(form.cities),
    maxWeightGrams: nullableKgToGrams(form.maxWeightKg), maxLengthCm: nullableNumber(form.maxLengthCm), maxWidthCm: nullableNumber(form.maxWidthCm), maxHeightCm: nullableNumber(form.maxHeightCm), maxVolumeCm3: nullableNumber(form.maxVolumeCm3),
    supportsRoundTrip: Boolean(form.supportsRoundTrip), supportsPrepaidBalance: Boolean(form.supportsPrepaidBalance),
    channelType: form.channelType || 'WHATSAPP_INDIVIDUAL', channelTarget: String(form.channelTarget || '').trim() || null,
    pixKey: String(form.pixKey || '').trim() || null, payoutDeadlineHours: Number(form.payoutDeadlineHours || 24),
    contactName: String(form.contactName || '').trim() || null, contactPhone: String(form.contactPhone || '').trim() || null, notes: String(form.notes || '').trim() || null,
  });

  const saveGeneral = async () => {
    if (working) return;
    const cities = normalizeCities(form.cities);
    if (!String(form.name || '').trim()) return setError('Informe o nome do parceiro.');
    if (!cities.length) return setError('Inclua pelo menos uma cidade na aba Abrangência.');
    setWorking(true); setError(''); setNotice('');
    try {
      const response = selected
        ? await api.put(`/admin/classifieds-delivery/partners/${selected.id}`, corePayload())
        : await api.post('/admin/classifieds-delivery/partners', corePayload());
      const saved = response.data as Partner;
      const partnerId = String(saved?.id || selected?.id || '');
      if (!validUuid(partnerId)) throw new Error('O backend salvou o parceiro, mas não retornou um ID válido.');
      const normalizedSaved = { ...saved, id: partnerId } as Partner;
      setSelected(normalizedSaved);
      setForm((current: any) => ({ ...current, ...formFromPartner(normalizedSaved), cities: normalizeCities(saved?.cities || cities) }));
      setPartners((current) => upsertPartner(current, normalizedSaved));
      setNotice(selected ? 'Dados gerais atualizados.' : 'Parceiro criado. Agora configure despacho e preços nas abas ao lado.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Não foi possível salvar o parceiro.');
    } finally { setWorking(false); }
  };

  const persistCoverage = async (next: CoverageCity[], message: string) => {
    if (!next.length) return setError('O parceiro precisa manter pelo menos uma cidade atendida. Desative o parceiro se ele não atender nenhuma cidade.');
    setForm((current: any) => ({ ...current, cities: next }));
    if (!selected) { setNotice('Abrangência adicionada ao novo parceiro. Salve os dados gerais para criar o cadastro.'); return; }
    if (!validUuid(selected.id)) return setError('Não foi possível salvar a abrangência porque o parceiro está sem ID válido.');
    setWorking(true); setError('');
    try {
      const response = await api.put(`/admin/classifieds-delivery/partners/${selected.id}`, corePayload(next));
      const saved = { ...(response.data || selected), id: selected.id, cities: next } as Partner;
      setSelected(saved); setPartners((current) => upsertPartner(current, saved)); setNotice(message);
    } catch (requestError: any) {
      setForm((current: any) => ({ ...current, cities: normalizeCities(selected.cities) }));
      setError(requestError?.response?.data?.message || 'Não foi possível atualizar a abrangência.');
    } finally { setWorking(false); }
  };

  const addCoverage = async () => {
    const city = (municipalities[coverageUf] || []).find((item) => String(item.id) === coverageCityId);
    if (!coverageUf || !city) return;
    const next = normalizeCities(form.cities);
    if (next.some((item) => item.state === coverageUf && (item.ibgeId === city.id || item.city.toLowerCase() === city.nome.toLowerCase()))) return setNotice('Essa cidade já está na abrangência.');
    await persistCoverage([...next, { ibgeId: city.id, city: city.nome, state: coverageUf }], `${city.nome}/${coverageUf} incluída na abrangência.`);
    setCoverageCityId('');
  };

  const removeCoverage = async (index: number) => {
    const current = normalizeCities(form.cities);
    const removed = current[index];
    const next = current.filter((_, itemIndex) => itemIndex !== index);
    await persistCoverage(next, `${removed.city}/${removed.state} removida da abrangência.`);
  };

  const saveChannel = async () => {
    if (!selected || !validUuid(selected.id) || working) return setError('Salve o parceiro antes de configurar o despacho.');
    const integrated = ['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED'].includes(form.channelType);
    if (integrated && !form.channelInstanceId) return setError('Selecione a instância do WhatsApp.');
    if (form.channelType !== 'INTEGRATION' && !String(form.channelTarget || '').trim()) return setError('Informe ou selecione o destino operacional.');
    setWorking(true); setError(''); setNotice('');
    try {
      const targetLabel = form.channelType === 'WHATSAPP_GROUP_INTEGRATED' ? groups.find((group) => group.id === form.channelTarget)?.name || form.channelTargetLabel || null : form.channelTargetLabel || null;
      await api.put(`/admin/classifieds-delivery/partners/${selected.id}/channel-binding`, {
        targetType: form.channelType,
        instanceId: integrated ? form.channelInstanceId : null,
        targetId: String(form.channelTarget || '').trim() || null,
        targetLabel,
        metadata: { source: 'ADMIN_PARTNERS_V3' },
      });
      setNotice('Canal de despacho atualizado.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível atualizar o canal de despacho.');
    } finally { setWorking(false); }
  };

  const deactivate = async () => {
    if (!selected || working || !window.confirm(`Desativar ${selected.name}? O histórico de corridas e repasses será preservado.`)) return;
    setWorking(true); setError('');
    try {
      const response = await api.put(`/admin/classifieds-delivery/partners/${selected.id}`, corePayload(undefined, 'INACTIVE'));
      const saved = { ...(response.data || selected), id: selected.id, status: 'INACTIVE' } as Partner;
      setSelected(saved); setForm((current: any) => ({ ...current, status: 'INACTIVE' })); setPartners((current) => upsertPartner(current, saved)); setNotice('Parceiro desativado. O histórico foi preservado.');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível desativar o parceiro.'); }
    finally { setWorking(false); }
  };

  const createTable = async () => {
    if (!selected || !validUuid(selected.id) || working) return;
    setWorking(true); setError('');
    try {
      await api.post(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`, { name: tableName.trim() || 'Tabela vigente', active: true, startsAt: new Date().toISOString() });
      await reloadTables(selected.id); setNotice('Nova versão de tabela criada.');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível criar a tabela.'); }
    finally { setWorking(false); }
  };

  const reloadTables = async (partnerId: string) => {
    const response = await api.get(`/admin/classifieds-delivery/partners/${partnerId}/rate-tables`);
    setTables(Array.isArray(response.data) ? response.data : []);
  };

  const createRule = async (tableId: string) => {
    if (!selected || working) return;
    if (rule.mode !== 'GENERAL' && (!rule.state || !rule.city)) return setError('Selecione UF e cidade.');
    if (rule.mode === 'NEIGHBORHOOD' && !rule.neighborhood.trim()) return setError('Informe o bairro.');
    if (rule.mode === 'ZIP_RANGE' && (digits(rule.zipCodeStart).length !== 8 || digits(rule.zipCodeEnd).length !== 8)) return setError('Informe a faixa de CEP completa.');
    if (rule.mode === 'DISTANCE' && rule.minDistanceKm === '' && rule.maxDistanceKm === '') return setError('Informe a faixa de distância.');
    if (!rule.fixedPrice && !rule.perKm && !rule.minimumPrice) return setError('Configure preço fixo, mínimo ou por km.');
    setWorking(true); setError('');
    try {
      await api.post(`/admin/classifieds-delivery/rate-tables/${tableId}/rules`, {
        priority: 100,
        state: rule.mode === 'GENERAL' ? null : rule.state,
        city: rule.mode === 'GENERAL' ? null : rule.city,
        neighborhood: rule.mode === 'NEIGHBORHOOD' ? rule.neighborhood.trim() : null,
        zipCodeStart: rule.mode === 'ZIP_RANGE' ? digits(rule.zipCodeStart) : null,
        zipCodeEnd: rule.mode === 'ZIP_RANGE' ? digits(rule.zipCodeEnd) : null,
        minDistanceMeters: rule.mode === 'DISTANCE' ? kmToMeters(rule.minDistanceKm) : null,
        maxDistanceMeters: rule.mode === 'DISTANCE' ? kmToMeters(rule.maxDistanceKm) : null,
        fixedPriceCents: moneyToCents(rule.fixedPrice), minimumPriceCents: moneyToCents(rule.minimumPrice) || 0,
        perKmCents: moneyToCents(rule.perKm) || 0, roundTripAdditionalCents: moneyToCents(rule.roundTripAdditional) || 0,
        estimatedMinutes: nullableInteger(rule.estimatedMinutes),
      });
      await reloadTables(selected.id); setRule((current) => ({ ...emptyRule, mode: current.mode, state: current.state, city: current.city })); setNotice('Regra de preço adicionada.');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar a regra.'); }
    finally { setWorking(false); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  return <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
    <header className="rounded-[30px] bg-[#171714] px-6 py-6 text-white shadow-xl sm:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#df9b7f]">Admin · Operação</p><h1 className="mt-2 font-serif text-4xl font-black">Parceiros</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Central própria para modalidades de frete da plataforma. Cadastro, abrangência, capacidade, despacho, repasse e precificação ficam separados para cada alteração não derrubar as outras.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={startNew} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-stone-950"><Plus className="h-4 w-4" /> Novo parceiro</button><button onClick={() => void load()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-4 text-xs font-black text-white ring-1 ring-white/10"><RefreshCw className="h-4 w-4" /> Atualizar</button></div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Parceiros" value={partners.length} /><Metric label="Ativos" value={partners.filter((item) => item.status === 'ACTIVE').length} /><Metric label="Cidades cobertas" value={totalCities} /></div>
    </header>

    {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    {notice && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}

    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-stone-200 xl:sticky xl:top-24 xl:self-start">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Parceiro ou cidade" className="h-11 w-full rounded-2xl bg-stone-50 pl-10 pr-3 text-sm font-semibold outline-none ring-1 ring-stone-200 focus:bg-white" /></div>
        <div className="mt-4 max-h-[68vh] space-y-2 overflow-y-auto pr-1">{filteredPartners.map((partner) => <button key={partner.id} onClick={() => void selectPartner(partner)} className={`w-full rounded-2xl p-3 text-left ring-1 transition ${selected?.id === partner.id ? 'bg-[#fff1e9] ring-[#e6b9a8]' : 'bg-stone-50 ring-stone-200 hover:bg-white'}`}><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#b06448] ring-1 ring-stone-200">{partner.type === 'BIKE' ? <Bike className="h-4 w-4" /> : <Truck className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-black">{partner.name}</p><StatusDot status={partner.status} /></div><p className="mt-1 truncate text-[9px] font-bold text-stone-400">{typeLabel(partner.type)} · {normalizeCities(partner.cities).length} cidade(s)</p></div><ChevronRight className="h-4 w-4 text-stone-300" /></div></button>)}{!filteredPartners.length && <p className="py-8 text-center text-xs font-bold text-stone-400">Nenhum parceiro encontrado.</p>}</div>
      </aside>

      <main className="min-w-0 space-y-4">
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">{selected ? 'Parceiro selecionado' : 'Novo cadastro'}</p><h2 className="mt-1 font-serif text-3xl font-black">{selected?.name || 'Novo parceiro de frete'}</h2>{selected && <p className="mt-1 text-xs font-bold text-stone-400">ID {selected.id}</p>}</div>{selected && <div className="flex gap-2"><span className={`rounded-full px-3 py-2 text-[10px] font-black ${selected.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{statusLabel(selected.status)}</span>{selected.status === 'ACTIVE' && <button disabled={working} onClick={() => void deactivate()} className="rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-700">Desativar</button>}</div>}</div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{([
            ['GENERAL','Geral',<Package className="h-4 w-4" />],['COVERAGE','Abrangência',<MapPin className="h-4 w-4" />],['DISPATCH','Despacho',<MessageCircle className="h-4 w-4" />],['PRICING','Preços',<CircleDollarSign className="h-4 w-4" />],
          ] as Array<[Tab,string,React.ReactNode]>).map(([value,label,icon]) => <button key={value} onClick={() => setTab(value)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-black ${tab === value ? 'bg-stone-950 text-white' : 'bg-stone-100 text-stone-600'}`}>{icon}{label}</button>)}</div>
        </section>

        {tab === 'GENERAL' && <Panel title="Dados gerais e capacidade" description="Salvar aqui não mexe no vínculo do WhatsApp. Abrangência também possui persistência própria.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Nome comercial" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Select label="Tipo" value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={TYPE_OPTIONS} /><Select label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[{value:'ACTIVE',label:'Ativo'},{value:'INACTIVE',label:'Inativo'},{value:'SUSPENDED',label:'Suspenso'}]} /><Field label="Prioridade" type="number" value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} /></div>
          <h3 className="mt-6 text-xs font-black uppercase tracking-[.12em] text-stone-400">Limites físicos</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Peso máx. (kg)" type="number" value={form.maxWeightKg} onChange={(value) => setForm({ ...form, maxWeightKg: value })} /><Field label="Comprimento (cm)" type="number" value={form.maxLengthCm} onChange={(value) => setForm({ ...form, maxLengthCm: value })} /><Field label="Largura (cm)" type="number" value={form.maxWidthCm} onChange={(value) => setForm({ ...form, maxWidthCm: value })} /><Field label="Altura (cm)" type="number" value={form.maxHeightCm} onChange={(value) => setForm({ ...form, maxHeightCm: value })} /><Field label="Volume (cm³)" type="number" value={form.maxVolumeCm3} onChange={(value) => setForm({ ...form, maxVolumeCm3: value })} /></div>
          <div className="mt-4 flex flex-wrap gap-2"><Toggle checked={form.supportsRoundTrip} onChange={(value) => setForm({ ...form, supportsRoundTrip: value })} label="Permite ida e volta" /><Toggle checked={form.supportsPrepaidBalance} onChange={(value) => setForm({ ...form, supportsPrepaidBalance: value })} label="Aceita saldo pré-pago" /></div>
          <h3 className="mt-6 text-xs font-black uppercase tracking-[.12em] text-stone-400">Repasse</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Chave Pix" value={form.pixKey} onChange={(value) => setForm({ ...form, pixKey: value })} /><Field label="Prazo (horas)" type="number" value={form.payoutDeadlineHours} onChange={(value) => setForm({ ...form, payoutDeadlineHours: value })} /><Field label="Contato" value={form.contactName} onChange={(value) => setForm({ ...form, contactName: value })} /><Field label="Telefone" value={form.contactPhone} onChange={(value) => setForm({ ...form, contactPhone: value })} /></div><label className="mt-3 block"><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">Notas internas</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400" /></label>
          <button disabled={working} onClick={() => void saveGeneral()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-stone-950 px-5 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{working ? 'Salvando...' : selected ? 'Salvar dados gerais' : 'Criar parceiro'}</button>
        </Panel>}

        {tab === 'COVERAGE' && <Panel title="Abrangência" description="UF e município vêm do IBGE. Em parceiros já cadastrados, incluir ou remover uma cidade salva imediatamente.">
          <div className="grid gap-3 md:grid-cols-[190px_minmax(0,1fr)_auto] md:items-end"><StateSelect value={coverageUf} onChange={(value) => { setCoverageUf(value); setCoverageCityId(''); }} /><CitySelect uf={coverageUf} value={coverageCityId} onChange={setCoverageCityId} items={municipalities[coverageUf] || []} loading={Boolean(municipalityLoading[coverageUf])} /><button disabled={!coverageUf || !coverageCityId || working} onClick={() => void addCoverage()} className="h-10 rounded-xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:opacity-40"><Plus className="mr-1 inline h-4 w-4" /> Incluir cidade</button></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{coverage.map((city, index) => <div key={`${city.state}-${city.ibgeId || city.city}-${index}`} className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#b06448] ring-1 ring-stone-200"><MapPin className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{city.city}</p><p className="text-[9px] font-bold text-stone-400">{city.state}{city.ibgeId ? ` · IBGE ${city.ibgeId}` : ' · cadastro legado'}</p></div><button disabled={working} onClick={() => void removeCoverage(index)} title={`Remover ${city.city}`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div>)}{!coverage.length && <div className="col-span-full rounded-2xl border border-dashed border-stone-300 px-5 py-10 text-center text-xs font-bold text-stone-400">Nenhuma cidade cadastrada.</div>}</div>
        </Panel>}

        {tab === 'DISPATCH' && <Panel title="Despacho e WhatsApp" description="O vínculo operacional é salvo separado do parceiro. Um problema no WhatsApp não impede editar nome, cobertura ou preço.">
          {!selected && <Info icon={<ShieldCheck className="h-4 w-4" />} text="Crie o parceiro na aba Geral antes de configurar o despacho." />}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Select label="Canal" value={form.channelType} onChange={(value) => setForm({ ...form, channelType: value, channelTarget: '', channelTargetLabel: '', channelInstanceId: '' })} options={CHANNEL_OPTIONS} />{['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED'].includes(form.channelType) && <Select label="Instância" value={form.channelInstanceId} onChange={(value) => setForm({ ...form, channelInstanceId: value, channelTarget: '', channelTargetLabel: '' })} options={[{value:'',label:'Selecione uma instância'}, ...connectedInstances.map((item) => ({ value:item.id, label:`${item.name}${item.phoneNumber ? ` · ${item.phoneNumber}` : ''}` }))]} />}{form.channelType === 'WHATSAPP_GROUP_INTEGRATED' && <Select label="Grupo" value={form.channelTarget} onChange={(value) => setForm({ ...form, channelTarget: value, channelTargetLabel: groups.find((group) => group.id === value)?.name || '' })} options={[{value:'',label:'Selecione o grupo'}, ...groups.map((group) => ({ value:group.id,label:group.name }))]} />}{form.channelType === 'WHATSAPP_INDIVIDUAL' && <Field label="WhatsApp do parceiro" value={form.channelTarget} onChange={(value) => setForm({ ...form, channelTarget: value })} placeholder="19 99999-9999" />}{form.channelType === 'WHATSAPP_GROUP_MANUAL' && <Field label="Grupo manual / link" value={form.channelTarget} onChange={(value) => setForm({ ...form, channelTarget: value })} />}{form.channelType === 'INTEGRATION' && <Field label="Identificador externo" value={form.channelTarget} onChange={(value) => setForm({ ...form, channelTarget: value })} />}</div>
          {!connectedInstances.length && ['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED'].includes(form.channelType) && <Info icon={<MessageCircle className="h-4 w-4" />} text="Nenhuma instância conectada. Conecte uma em Admin → WhatsApp." />}
          <button disabled={!selected || working} onClick={() => void saveChannel()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0d4542] px-5 text-xs font-black text-white disabled:opacity-40"><Save className="h-4 w-4" /> Salvar canal de despacho</button>
        </Panel>}

        {tab === 'PRICING' && <Panel title="Tabelas de preço" description="Cada nova tabela cria uma versão. As cotações antigas continuam presas à versão histórica.">
          {!selected ? <Info icon={<CircleDollarSign className="h-4 w-4" />} text="Crie o parceiro antes de configurar preços." /> : <><div className="flex flex-col gap-2 sm:flex-row"><input value={tableName} onChange={(event) => setTableName(event.target.value)} className="h-10 flex-1 rounded-xl border border-stone-200 px-3 text-sm" placeholder="Nome da nova versão" /><button disabled={working} onClick={() => void createTable()} className="rounded-xl bg-stone-950 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Criar nova versão</button></div><div className="mt-5 space-y-4">{tables.map((table) => <div key={table.id} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">v{table.version} · {table.name}</p><p className="mt-1 text-[9px] font-bold text-stone-400">{table.active ? 'ATIVA' : 'INATIVA'} · {table.rules?.length || 0} regra(s)</p></div><CircleDollarSign className="h-5 w-5 text-[#b06448]" /></div>{table.rules?.length ? <div className="mt-3 grid gap-2 lg:grid-cols-2">{table.rules.map((item) => <RuleSummary key={item.id} rule={item} />)}</div> : null}<div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-xs font-black">Adicionar regra</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Select label="Tipo" value={rule.mode} onChange={(value) => setRule({ ...emptyRule, mode: value as RuleMode })} options={[{value:'DISTANCE',label:'Faixa de distância'},{value:'NEIGHBORHOOD',label:'Bairro'},{value:'ZIP_RANGE',label:'Faixa de CEP'},{value:'CITY',label:'Cidade inteira'},{value:'GENERAL',label:'Regra geral'}]} />{rule.mode !== 'GENERAL' && <StateSelect value={rule.state} onChange={(value) => setRule({ ...rule, state: value, city: '' })} />}{rule.mode !== 'GENERAL' && <CityNameSelect uf={rule.state} value={rule.city} onChange={(value) => setRule({ ...rule, city: value })} items={municipalities[rule.state] || []} loading={Boolean(municipalityLoading[rule.state])} />}{rule.mode === 'NEIGHBORHOOD' && <Field label="Bairro" value={rule.neighborhood} onChange={(value) => setRule({ ...rule, neighborhood: value })} />}{rule.mode === 'ZIP_RANGE' && <><Field label="CEP inicial" value={rule.zipCodeStart} onChange={(value) => setRule({ ...rule, zipCodeStart: formatZip(value) })} /><Field label="CEP final" value={rule.zipCodeEnd} onChange={(value) => setRule({ ...rule, zipCodeEnd: formatZip(value) })} /></>}{rule.mode === 'DISTANCE' && <><Field label="De (km)" type="number" value={rule.minDistanceKm} onChange={(value) => setRule({ ...rule, minDistanceKm: value })} /><Field label="Até (km)" type="number" value={rule.maxDistanceKm} onChange={(value) => setRule({ ...rule, maxDistanceKm: value })} /></>}</div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Fixo (R$)" value={rule.fixedPrice} onChange={(value) => setRule({ ...rule, fixedPrice: value })} /><Field label="Mínimo (R$)" value={rule.minimumPrice} onChange={(value) => setRule({ ...rule, minimumPrice: value })} /><Field label="Por km (R$)" value={rule.perKm} onChange={(value) => setRule({ ...rule, perKm: value })} /><Field label="Ida/volta + (R$)" value={rule.roundTripAdditional} onChange={(value) => setRule({ ...rule, roundTripAdditional: value })} /><Field label="Estimativa (min)" type="number" value={rule.estimatedMinutes} onChange={(value) => setRule({ ...rule, estimatedMinutes: value })} /></div><button disabled={working} onClick={() => void createRule(table.id)} className="mt-4 rounded-xl bg-[#0d4542] px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">Adicionar regra</button></div></div>)}{!tables.length && <div className="rounded-2xl border border-dashed border-stone-300 px-5 py-10 text-center text-xs font-bold text-stone-400">Nenhuma tabela criada.</div>}</div></>}
        </Panel>}
      </main>
    </div>
  </div>;
}

function formFromPartner(partner: Partner) {
  return {
    ...emptyForm,
    name: partner.name || '', type: partner.type || 'MOTOBOY', status: partner.status || 'ACTIVE', priority: partner.priority ?? 100,
    cities: normalizeCities(partner.cities), maxWeightKg: partner.maxWeightGrams ? Number(partner.maxWeightGrams) / 1000 : '',
    maxLengthCm: partner.maxLengthCm ?? '', maxWidthCm: partner.maxWidthCm ?? '', maxHeightCm: partner.maxHeightCm ?? '', maxVolumeCm3: partner.maxVolumeCm3 ?? '',
    supportsRoundTrip: Boolean(partner.supportsRoundTrip), supportsPrepaidBalance: Boolean(partner.supportsPrepaidBalance),
    pixKey: partner.pixKey || '', payoutDeadlineHours: partner.payoutDeadlineHours || 24, contactName: partner.contactName || '', contactPhone: partner.contactPhone || '', notes: partner.notes || '',
    channelType: partner.channelType || 'WHATSAPP_INDIVIDUAL', channelTarget: partner.channelTarget || '', channelTargetLabel: '', channelInstanceId: '',
  };
}
function normalizeCities(raw: unknown): CoverageCity[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: any) => {
    if (entry && typeof entry === 'object') return { ibgeId: entry.ibgeId == null ? null : Number(entry.ibgeId), city: String(entry.city || entry.name || '').trim(), state: String(entry.state || entry.uf || '').trim().toUpperCase() };
    const text = String(entry || '').trim(); const parts = text.split('/'); return { city: (parts[0] || text).trim(), state: (parts[1] || '').trim().toUpperCase(), ibgeId: null };
  }).filter((entry) => entry.city && /^[A-Z]{2}$/.test(entry.state));
}
function upsertPartner(items: Partner[], partner: Partner) { const exists = items.some((item) => item.id === partner.id); return exists ? items.map((item) => item.id === partner.id ? partner : item) : [partner, ...items]; }
function validUuid(value: unknown) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()); }
function normalizeGroup(group: any): WhatsAppGroup { const id = typeof group?.id === 'string' ? group.id : group?.id?._serialized || group?._serialized || ''; return { id: String(id || ''), name: String(group?.name || group?.subject || group?.formattedTitle || id || 'Grupo') }; }
function typeLabel(type: string) { return ({ MOTOBOY:'Motoboy', BIKE:'Bike', TRANSPORTADORA:'Transportadora', MELHOR_ENVIO:'Integração' } as Record<string,string>)[type] || type; }
function statusLabel(status: string) { return ({ ACTIVE:'Ativo', INACTIVE:'Inativo', SUSPENDED:'Suspenso' } as Record<string,string>)[status] || status; }
function nullableNumber(value: unknown) { if (value === '' || value == null) return null; const n = Number(String(value).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; }
function nullableInteger(value: unknown) { const n = nullableNumber(value); return n == null ? null : Math.round(n); }
function nullableKgToGrams(value: unknown) { const n = nullableNumber(value); return n == null ? null : Math.round(n * 1000); }
function kmToMeters(value: unknown) { const n = nullableNumber(value); return n == null ? null : Math.round(n * 1000); }
function moneyToCents(value: unknown) { if (value === '' || value == null) return null; const n = Number(String(value).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null; }
function digits(value: unknown) { return String(value || '').replace(/\D/g, '').slice(0, 8); }
function formatZip(value: unknown) { const clean = digits(value); return clean.length > 5 ? `${clean.slice(0,5)}-${clean.slice(5)}` : clean; }
function moneyCents(value: unknown) { return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(value || 0) / 100); }

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-white/[.06] px-4 py-3 ring-1 ring-white/10"><p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h3 className="font-serif text-2xl font-black">{title}</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">{description}</p><div className="mt-5">{children}</div></section>; }
function Field({ label, value, onChange, type='text', placeholder='' }: { label:string; value:any; onChange:(value:string)=>void; type?:string; placeholder?:string }) { return <label><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span><input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#8fbeb8]" /></label>; }
function Select({ label, value, onChange, options }: { label:string; value:any; onChange:(value:string)=>void; options:Array<{value:string;label:string}> }) { return <label><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span><select value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold outline-none">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function StateSelect({ value, onChange }: { value:string; onChange:(value:string)=>void }) { return <Select label="UF" value={value} onChange={onChange} options={[{value:'',label:'Selecione a UF'}, ...STATES.map((state) => ({ value:state.uf,label:`${state.uf} · ${state.name}` }))]} />; }
function CitySelect({ uf, value, onChange, items, loading }: { uf:string; value:string; onChange:(value:string)=>void; items:Municipality[]; loading:boolean }) { return <Select label="Cidade" value={value} onChange={onChange} options={[{value:'',label:!uf ? 'Selecione a UF primeiro' : loading ? 'Carregando cidades...' : 'Selecione a cidade'}, ...items.map((item) => ({ value:String(item.id),label:item.nome }))]} />; }
function CityNameSelect({ uf, value, onChange, items, loading }: { uf:string; value:string; onChange:(value:string)=>void; items:Municipality[]; loading:boolean }) { return <Select label="Cidade" value={value} onChange={onChange} options={[{value:'',label:!uf ? 'Selecione a UF primeiro' : loading ? 'Carregando cidades...' : 'Selecione a cidade'}, ...items.map((item) => ({ value:item.nome,label:item.nome }))]} />; }
function Toggle({ checked, onChange, label }: { checked:boolean; onChange:(value:boolean)=>void; label:string }) { return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black ring-1 ${checked ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-stone-50 text-stone-500 ring-stone-200'}`}><span className={`h-2.5 w-2.5 rounded-full ${checked ? 'bg-emerald-500' : 'bg-stone-300'}`} />{label}</button>; }
function StatusDot({ status }: { status:string }) { return <span title={statusLabel(status)} className={`h-2 w-2 shrink-0 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500' : status === 'SUSPENDED' ? 'bg-red-500' : 'bg-stone-300'}`} />; }
function Info({ icon, text }: { icon:React.ReactNode; text:string }) { return <div className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800"><span className="mt-0.5">{icon}</span>{text}</div>; }
function RuleSummary({ rule }: { rule:RateRule }) { const where = rule.neighborhood ? `${rule.neighborhood} · ${rule.city}/${rule.state}` : rule.zipCodeStart || rule.zipCodeEnd ? `CEP ${formatZip(rule.zipCodeStart)} a ${formatZip(rule.zipCodeEnd)}` : rule.minDistanceMeters != null || rule.maxDistanceMeters != null ? `${Number(rule.minDistanceMeters || 0)/1000} a ${rule.maxDistanceMeters == null ? '∞' : Number(rule.maxDistanceMeters)/1000} km` : rule.city ? `${rule.city}/${rule.state}` : 'Regra geral'; const price = rule.fixedPriceCents != null ? moneyCents(rule.fixedPriceCents) : rule.perKmCents ? `${moneyCents(rule.perKmCents)}/km` : `mín. ${moneyCents(rule.minimumPriceCents)}`; return <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200"><p className="text-[10px] font-black text-stone-700">{where}</p><p className="mt-1 text-[9px] font-bold text-stone-400">{price}{rule.estimatedMinutes ? ` · ~${rule.estimatedMinutes} min` : ''}</p></div>; }
