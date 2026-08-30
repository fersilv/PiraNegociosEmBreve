import React, { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Truck,
} from 'lucide-react';
import { api } from '../lib/api';

type CoverageCity = { ibgeId?: number | null; city: string; state: string };
type Municipality = { id: number; nome: string };
type WhatsAppInstance = { id: string; name: string; phoneNumber?: string | null; status?: string; connected?: boolean; active?: boolean };
type WhatsAppGroup = { id: string; name: string };
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
type ChannelBinding = {
  partnerId?: string;
  instanceId?: string | null;
  targetType?: string;
  targetId?: string | null;
  targetLabel?: string | null;
  instanceName?: string | null;
};
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
  weightAdditionalPerKgCents?: number | null;
  maxWeightGrams?: number | null;
  maxLengthCm?: number | null;
  maxWidthCm?: number | null;
  maxHeightCm?: number | null;
  maxVolumeCm3?: number | null;
  estimatedMinutes?: number | null;
};
type RateTable = { id: string; version: number; name: string; active: boolean; startsAt?: string; rules?: RateRule[] };
type RuleMode = 'DISTANCE' | 'NEIGHBORHOOD' | 'ZIP_RANGE' | 'CITY' | 'GENERAL';

const STATES = [
  [12,'AC','Acre'],[27,'AL','Alagoas'],[16,'AP','Amapá'],[13,'AM','Amazonas'],[29,'BA','Bahia'],[23,'CE','Ceará'],[53,'DF','Distrito Federal'],[32,'ES','Espírito Santo'],[52,'GO','Goiás'],[21,'MA','Maranhão'],[51,'MT','Mato Grosso'],[50,'MS','Mato Grosso do Sul'],[31,'MG','Minas Gerais'],[15,'PA','Pará'],[25,'PB','Paraíba'],[41,'PR','Paraná'],[26,'PE','Pernambuco'],[22,'PI','Piauí'],[33,'RJ','Rio de Janeiro'],[24,'RN','Rio Grande do Norte'],[43,'RS','Rio Grande do Sul'],[11,'RO','Rondônia'],[14,'RR','Roraima'],[42,'SC','Santa Catarina'],[35,'SP','São Paulo'],[28,'SE','Sergipe'],[17,'TO','Tocantins'],
].map(([id, uf, name]) => ({ id: Number(id), uf: String(uf), name: String(name) }));

const TYPE_OPTIONS = [
  { value: 'MOTOBOY', label: 'Motoboy' },
  { value: 'BIKE', label: 'Bike / bicicleta' },
  { value: 'TRANSPORTADORA', label: 'Transportadora local' },
  { value: 'MELHOR_ENVIO', label: 'Melhor Envio / integração futura' },
];
const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP_INDIVIDUAL', label: 'WhatsApp individual' },
  { value: 'WHATSAPP_GROUP_INTEGRATED', label: 'Grupo do WhatsApp integrado' },
  { value: 'WHATSAPP_GROUP_MANUAL', label: 'Grupo cadastrado manualmente' },
  { value: 'INTEGRATION', label: 'Integração / API externa' },
];

const emptyPartner = {
  name: '', type: 'MOTOBOY', status: 'ACTIVE', priority: 100, cities: [] as CoverageCity[],
  maxWeightKg: '', maxLengthCm: '', maxWidthCm: '', maxHeightCm: '', maxVolumeCm3: '',
  supportsRoundTrip: false, supportsPrepaidBalance: false,
  channelType: 'WHATSAPP_INDIVIDUAL', channelTarget: '', channelTargetLabel: '', channelInstanceId: '',
  pixKey: '', payoutDeadlineHours: 24, contactName: '', contactPhone: '', notes: '',
};
const emptyRule = {
  mode: 'DISTANCE' as RuleMode, state: '', city: '', neighborhood: '', zipCodeStart: '', zipCodeEnd: '',
  minDistanceKm: '', maxDistanceKm: '', fixedPrice: '', minimumPrice: '', perKm: '', roundTripAdditional: '',
  weightAdditionalPerKg: '', maxWeightKg: '', maxLengthCm: '', maxWidthCm: '', maxHeightCm: '', maxVolumeCm3: '', estimatedMinutes: '45',
};

export default function AdminDeliveryPartnersPageV2() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [form, setForm] = useState<any>({ ...emptyPartner });
  const [tables, setTables] = useState<RateTable[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [coverageUf, setCoverageUf] = useState('');
  const [coverageCityId, setCoverageCityId] = useState('');
  const [municipalities, setMunicipalities] = useState<Record<string, Municipality[]>>({});
  const [municipalityLoading, setMunicipalityLoading] = useState<Record<string, boolean>>({});
  const [tableName, setTableName] = useState('Tabela vigente');
  const [rule, setRule] = useState({ ...emptyRule });

  const connectedInstances = useMemo(
    () => instances.filter((item) => item.active !== false && (item.connected === true || item.status === 'CONNECTED')),
    [instances],
  );
  const coverage = normalizeCities(form.cities);

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

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (coverageUf) void loadMunicipalities(coverageUf); }, [coverageUf]);
  useEffect(() => { if (rule.state) void loadMunicipalities(rule.state); }, [rule.state]);
  useEffect(() => {
    if (form.channelType === 'WHATSAPP_GROUP_INTEGRATED' && form.channelInstanceId) void loadGroups(form.channelInstanceId);
    else setGroups([]);
  }, [form.channelType, form.channelInstanceId]);

  const loadMunicipalities = async (uf: string) => {
    const state = STATES.find((item) => item.uf === String(uf).toUpperCase());
    if (!state || municipalities[state.uf]?.length) return;
    const cacheKey = `pn:ibge:municipios:${state.uf}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached?.savedAt && Date.now() - Number(cached.savedAt) < 30 * 24 * 60 * 60 * 1000 && Array.isArray(cached.items)) {
        setMunicipalities((current) => ({ ...current, [state.uf]: cached.items }));
        return;
      }
    } catch { /* cache é só otimização */ }
    setMunicipalityLoading((current) => ({ ...current, [state.uf]: true }));
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state.id}/municipios?orderBy=nome`);
      if (!response.ok) throw new Error('IBGE indisponível');
      const data = await response.json();
      const items = Array.isArray(data) ? data.map((item: any) => ({ id: Number(item.id), nome: String(item.nome || '') })).filter((item: Municipality) => item.id && item.nome) : [];
      setMunicipalities((current) => ({ ...current, [state.uf]: items }));
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items })); } catch { /* opcional */ }
    } catch {
      setError(`Não foi possível carregar as cidades de ${state.uf}. Tente novamente.`);
    } finally { setMunicipalityLoading((current) => ({ ...current, [state.uf]: false })); }
  };

  const loadGroups = async (instanceId: string) => {
    if (!instanceId) return setGroups([]);
    setGroupsLoading(true);
    try {
      const response = await api.get(`/admin/whatsapp/instances/${instanceId}/groups`);
      const rows = Array.isArray(response.data) ? response.data : [];
      setGroups(rows.map(normalizeWhatsAppGroup).filter((item: WhatsAppGroup) => item.id));
    } catch (requestError: any) {
      setGroups([]);
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os grupos dessa instância do WhatsApp.');
    } finally { setGroupsLoading(false); }
  };

  const openPartner = async (partner: Partner) => {
    setSelected(partner); setError(''); setNotice('');
    const [tablesResponse, bindingResponse] = await Promise.all([
      api.get(`/admin/classifieds-delivery/partners/${partner.id}/rate-tables`).catch(() => ({ data: [] })),
      api.get(`/admin/classifieds-delivery/partners/${partner.id}/channel-binding`).catch(() => ({ data: null })),
    ]);
    const binding = (bindingResponse.data || null) as ChannelBinding | null;
    const channelType = binding?.targetType || partner.channelType || 'WHATSAPP_INDIVIDUAL';
    setForm({
      name: partner.name, type: partner.type, status: partner.status, priority: partner.priority || 100,
      cities: normalizeCities(partner.cities),
      maxWeightKg: partner.maxWeightGrams ? Number(partner.maxWeightGrams) / 1000 : '',
      maxLengthCm: partner.maxLengthCm ?? '', maxWidthCm: partner.maxWidthCm ?? '', maxHeightCm: partner.maxHeightCm ?? '', maxVolumeCm3: partner.maxVolumeCm3 ?? '',
      supportsRoundTrip: Boolean(partner.supportsRoundTrip), supportsPrepaidBalance: Boolean(partner.supportsPrepaidBalance),
      channelType, channelTarget: binding?.targetId || partner.channelTarget || '', channelTargetLabel: binding?.targetLabel || '', channelInstanceId: binding?.instanceId || '',
      pixKey: partner.pixKey || '', payoutDeadlineHours: partner.payoutDeadlineHours || 24,
      contactName: partner.contactName || '', contactPhone: partner.contactPhone || '', notes: partner.notes || '',
    });
    setTables(Array.isArray(tablesResponse.data) ? tablesResponse.data : []);
    if (channelType === 'WHATSAPP_GROUP_INTEGRATED' && binding?.instanceId) await loadGroups(binding.instanceId);
  };

  const newPartner = () => {
    setSelected(null); setForm({ ...emptyPartner, cities: [] }); setTables([]); setGroups([]); setCoverageUf(''); setCoverageCityId(''); setError(''); setNotice('');
  };

  const addCoverage = () => {
    const city = (municipalities[coverageUf] || []).find((item) => String(item.id) === coverageCityId);
    if (!coverageUf || !city) return;
    const next = normalizeCities(form.cities);
    if (next.some((item) => item.state === coverageUf && item.ibgeId === city.id)) return setNotice('Essa cidade já está incluída.');
    setForm({ ...form, cities: [...next, { ibgeId: city.id, city: city.nome, state: coverageUf }] });
    setCoverageCityId(''); setNotice('');
  };

  const savePartner = async () => {
    if (working) return;
    const cities = normalizeCities(form.cities);
    if (!String(form.name || '').trim()) return setError('Informe o nome do parceiro.');
    if (!cities.length) return setError('Inclua pelo menos uma cidade atendida.');
    if (['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED'].includes(form.channelType) && !form.channelInstanceId) return setError('Selecione a instância do WhatsApp que será usada para despacho.');
    if (!String(form.channelTarget || '').trim() && form.channelType !== 'INTEGRATION') return setError('Informe ou selecione o destino operacional.');

    setWorking(true); setError(''); setNotice('');
    try {
      const payload = {
        name: String(form.name).trim(), type: form.type, status: form.status, priority: Number(form.priority || 100), cities,
        maxWeightGrams: nullableKgToGrams(form.maxWeightKg), maxLengthCm: nullableNumber(form.maxLengthCm), maxWidthCm: nullableNumber(form.maxWidthCm), maxHeightCm: nullableNumber(form.maxHeightCm), maxVolumeCm3: nullableNumber(form.maxVolumeCm3),
        supportsRoundTrip: Boolean(form.supportsRoundTrip), supportsPrepaidBalance: Boolean(form.supportsPrepaidBalance),
        channelType: form.channelType, channelTarget: String(form.channelTarget || '').trim() || null,
        pixKey: String(form.pixKey || '').trim() || null, payoutDeadlineHours: Number(form.payoutDeadlineHours || 24),
        contactName: String(form.contactName || '').trim() || null, contactPhone: String(form.contactPhone || '').trim() || null, notes: String(form.notes || '').trim() || null,
      };
      const response = selected
        ? await api.put(`/admin/classifieds-delivery/partners/${selected.id}`, payload)
        : await api.post('/admin/classifieds-delivery/partners', payload);
      const saved = response.data as Partner;
      const targetLabel = resolveTargetLabel(form.channelType, form.channelTarget, form.channelTargetLabel, groups);
      await api.put(`/admin/classifieds-delivery/partners/${saved.id}/channel-binding`, {
        targetType: form.channelType,
        instanceId: ['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED'].includes(form.channelType) ? form.channelInstanceId : null,
        targetId: String(form.channelTarget || '').trim() || null,
        targetLabel,
        metadata: { source: 'ADMIN_DELIVERY_PARTNERS' },
      });
      setNotice(selected ? 'Parceiro e canal operacional atualizados.' : 'Parceiro criado. Agora configure a tabela de preços.');
      await load();
      await openPartner(saved);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível salvar o parceiro.');
    } finally { setWorking(false); }
  };

  const createTable = async () => {
    if (!selected || working) return;
    setWorking(true); setError('');
    try {
      await api.post(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`, { name: tableName.trim() || 'Tabela vigente', active: true, startsAt: new Date().toISOString() });
      const response = await api.get(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`);
      setTables(Array.isArray(response.data) ? response.data : []);
      setNotice('Nova versão de tabela criada. O histórico anterior permanece preservado.');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível criar a tabela.'); }
    finally { setWorking(false); }
  };

  const createRule = async (tableId: string) => {
    if (working) return;
    if (rule.mode !== 'GENERAL' && (!rule.state || !rule.city)) return setError('Selecione UF e cidade para esta regra.');
    if (rule.mode === 'NEIGHBORHOOD' && !rule.neighborhood.trim()) return setError('Informe o bairro.');
    if (rule.mode === 'ZIP_RANGE' && (digits(rule.zipCodeStart).length !== 8 || digits(rule.zipCodeEnd).length !== 8)) return setError('Informe a faixa de CEP completa.');
    if (rule.mode === 'DISTANCE' && rule.minDistanceKm === '' && rule.maxDistanceKm === '') return setError('Informe a faixa de distância.');
    if (!rule.fixedPrice && !rule.perKm && !rule.minimumPrice) return setError('Configure ao menos um preço fixo, por km ou mínimo.');
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
        weightAdditionalPerKgCents: moneyToCents(rule.weightAdditionalPerKg) || 0,
        maxWeightGrams: nullableKgToGrams(rule.maxWeightKg), maxLengthCm: nullableNumber(rule.maxLengthCm), maxWidthCm: nullableNumber(rule.maxWidthCm), maxHeightCm: nullableNumber(rule.maxHeightCm), maxVolumeCm3: nullableNumber(rule.maxVolumeCm3),
        estimatedMinutes: nullableInteger(rule.estimatedMinutes),
      });
      const response = await api.get(`/admin/classifieds-delivery/partners/${selected?.id}/rate-tables`);
      setTables(Array.isArray(response.data) ? response.data : []);
      setRule((current) => ({ ...emptyRule, mode: current.mode, state: current.state, city: current.city }));
      setNotice('Regra adicionada.');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar a regra.'); }
    finally { setWorking(false); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Admin · Logística local</p><h1 className="mt-1 font-serif text-4xl font-black text-stone-950">Parceiros de frete</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-stone-500">Cadastre Motoboy, Bike e outras modalidades com cobertura padronizada, capacidade física, WhatsApp operacional, Pix de repasse e tabelas de cálculo por região.</p></div>
      <div className="flex gap-2"><button onClick={newPartner} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-stone-950 px-4 text-xs font-black text-white"><Plus className="h-4 w-4" /> Novo parceiro</button><button onClick={() => void load()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" /> Atualizar</button></div>
    </header>
    {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    {notice && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}

    <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-stone-200 xl:self-start">
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl font-black">Cadastrados</h2><span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black">{partners.length}</span></div>
        <div className="mt-4 space-y-2">{partners.map((partner) => <button key={partner.id} onClick={() => void openPartner(partner)} className={`w-full rounded-2xl p-3 text-left ring-1 ${selected?.id === partner.id ? 'bg-[#fff1e9] ring-[#e9c9bd]' : 'bg-stone-50 ring-stone-200'}`}><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#b06448] ring-1 ring-stone-200">{partner.type === 'BIKE' ? <Bike className="h-4 w-4" /> : <Truck className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-stone-900">{partner.name}</p><p className="mt-1 truncate text-[9px] font-bold text-stone-400">{typeLabel(partner.type)} · {normalizeCities(partner.cities).map((item) => `${item.city}/${item.state}`).join(', ') || 'sem cobertura'}</p></div><ChevronRight className="h-4 w-4 text-stone-300" /></div></button>)}</div>
      </aside>

      <main className="space-y-5">
        <Card eyebrow="1 · Parceiro" title={selected ? `Editar ${selected.name}` : 'Novo parceiro'} description="A modalidade é um produto de frete da plataforma. Ex.: Motoboy, Bike ou transportadora local.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Nome comercial" value={form.name} onChange={(v) => setForm({ ...form, name: v })} /><Select label="Tipo" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPE_OPTIONS} /><Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value:'ACTIVE',label:'Ativo'},{value:'INACTIVE',label:'Inativo'},{value:'SUSPENDED',label:'Suspenso'}]} /><Field label="Prioridade" type="number" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} /></div>
        </Card>

        <Card eyebrow="2 · Cobertura" title="UF e cidades atendidas" description="A cidade vem do IBGE. O parceiro só aparece no cálculo quando o destino estiver numa cidade habilitada.">
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end"><StateSelect value={coverageUf} onChange={(v) => { setCoverageUf(v); setCoverageCityId(''); }} /><CityIdSelect uf={coverageUf} value={coverageCityId} onChange={setCoverageCityId} items={municipalities[coverageUf] || []} loading={Boolean(municipalityLoading[coverageUf])} /><button disabled={!coverageUf || !coverageCityId} onClick={addCoverage} className="h-10 rounded-xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:opacity-40">Incluir cidade</button></div>
          <div className="mt-4 flex flex-wrap gap-2">{coverage.map((city, index) => <span key={`${city.state}-${city.ibgeId || city.city}`} className="inline-flex items-center gap-2 rounded-full bg-[#fff1e9] px-3 py-2 text-[10px] font-black text-[#9f5036]"><MapPin className="h-3.5 w-3.5" />{city.city}/{city.state}<button onClick={() => setForm({ ...form, cities: coverage.filter((_, i) => i !== index) })} aria-label={`Remover ${city.city}`}><Trash2 className="h-3 w-3" /></button></span>)}{!coverage.length && <p className="text-xs font-bold text-stone-400">Nenhuma cidade incluída.</p>}</div>
        </Card>

        <Card eyebrow="3 · Capacidade" title="O que essa modalidade consegue transportar" description="Esses limites eliminam opções incompatíveis. Uma Bike pode aceitar pouco peso; um Motoboy não deve aparecer para uma geladeira.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Peso máx. (kg)" type="number" value={form.maxWeightKg} onChange={(v) => setForm({ ...form, maxWeightKg: v })} /><Field label="Comprimento máx. (cm)" type="number" value={form.maxLengthCm} onChange={(v) => setForm({ ...form, maxLengthCm: v })} /><Field label="Largura máx. (cm)" type="number" value={form.maxWidthCm} onChange={(v) => setForm({ ...form, maxWidthCm: v })} /><Field label="Altura máx. (cm)" type="number" value={form.maxHeightCm} onChange={(v) => setForm({ ...form, maxHeightCm: v })} /><Field label="Volume máx. (cm³)" type="number" value={form.maxVolumeCm3} onChange={(v) => setForm({ ...form, maxVolumeCm3: v })} /></div>
          <div className="mt-4 flex flex-wrap gap-2"><Toggle checked={form.supportsRoundTrip} onChange={(v) => setForm({ ...form, supportsRoundTrip: v })} label="Permite ida e volta" /><Toggle checked={form.supportsPrepaidBalance} onChange={(v) => setForm({ ...form, supportsPrepaidBalance: v })} label="Permite saldo pré-pago" /></div>
        </Card>

        <Card eyebrow="4 · Despacho" title="Canal do parceiro" description="Escolha o WhatsApp real já conectado ao PiraNegócios ou mantenha um grupo manual como contingência.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Canal" value={form.channelType} onChange={(v) => setForm({ ...form, channelType: v, channelTarget: '', channelTargetLabel: '', channelInstanceId: '' })} options={CHANNEL_OPTIONS} />
            {['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED'].includes(form.channelType) && <Select label="Instância do WhatsApp" value={form.channelInstanceId} onChange={(v) => setForm({ ...form, channelInstanceId: v, channelTarget: '', channelTargetLabel: '' })} options={[{ value:'',label:'Selecione uma instância conectada' }, ...connectedInstances.map((item) => ({ value:item.id,label:`${item.name}${item.phoneNumber ? ` · ${item.phoneNumber}` : ''}` }))]} />}
            {form.channelType === 'WHATSAPP_GROUP_INTEGRATED' && <Select label="Grupo conectado" value={form.channelTarget} onChange={(v) => setForm({ ...form, channelTarget: v, channelTargetLabel: groups.find((g) => g.id === v)?.name || '' })} options={[{ value:'',label:groupsLoading ? 'Carregando grupos...' : 'Selecione o grupo' }, ...groups.map((group) => ({ value:group.id,label:group.name }))]} />}
            {form.channelType === 'WHATSAPP_INDIVIDUAL' && <Field label="WhatsApp do motoboy" value={form.channelTarget} onChange={(v) => setForm({ ...form, channelTarget: v.replace(/[^0-9+()\-\s]/g, '') })} placeholder="19 99999-9999" />}
            {form.channelType === 'WHATSAPP_GROUP_MANUAL' && <Field label="Grupo manual / link" value={form.channelTarget} onChange={(v) => setForm({ ...form, channelTarget: v })} placeholder="Nome, link ou identificação do grupo" />}
            {form.channelType === 'INTEGRATION' && <Field label="Identificador da integração" value={form.channelTarget} onChange={(v) => setForm({ ...form, channelTarget: v })} placeholder="Opcional até a integração existir" />}
          </div>
          {['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED'].includes(form.channelType) && !connectedInstances.length && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700"><MessageCircle className="mr-1 inline h-4 w-4" />Nenhuma instância do WhatsApp está conectada. Conecte uma em Admin → WhatsApp antes de usar despacho automático.</div>}
        </Card>

        <Card eyebrow="5 · Repasse" title="Pagamento e prazo do parceiro" description="No online o frete fica contabilizado na plataforma para repasse. No presencial, a empresa pode usar saldo ou receber fatura após a corrida.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Chave Pix" value={form.pixKey} onChange={(v) => setForm({ ...form, pixKey: v })} /><Field label="Prazo de repasse (h)" type="number" value={form.payoutDeadlineHours} onChange={(v) => setForm({ ...form, payoutDeadlineHours: v })} /><Field label="Contato" value={form.contactName} onChange={(v) => setForm({ ...form, contactName: v })} /><Field label="Telefone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} /></div>
          <label className="mt-3 block"><span className="text-[9px] font-black uppercase text-stone-400">Notas internas</span><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400" /></label>
          <button disabled={working} onClick={() => void savePartner()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-stone-950 px-5 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> {working ? 'Salvando...' : 'Salvar parceiro'}</button>
        </Card>

        {selected && <Card eyebrow="6 · Precificação" title="Tabelas e regras de cálculo" description="As tabelas são versionadas. Uma cotação já feita continua ligada à versão que calculou aquele preço.">
          <div className="flex flex-col gap-2 sm:flex-row"><input value={tableName} onChange={(e) => setTableName(e.target.value)} className="h-10 flex-1 rounded-xl border border-stone-200 px-3 text-sm" /><button onClick={() => void createTable()} className="rounded-xl bg-[#0d4542] px-4 py-2 text-xs font-black text-white">Criar nova versão</button></div>
          <div className="mt-4 space-y-4">{tables.map((table) => <div key={table.id} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><div className="flex items-center justify-between"><div><p className="text-sm font-black">v{table.version} · {table.name}</p><p className="mt-1 text-[9px] font-bold text-stone-400">{table.active ? 'Ativa' : 'Inativa'} · {table.rules?.length || 0} regra(s)</p></div><CircleDollarSign className="h-5 w-5 text-[#b06448]" /></div>
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-xs font-black">Adicionar regra</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Regra" value={rule.mode} onChange={(v) => setRule({ ...emptyRule, mode: v as RuleMode })} options={[{value:'DISTANCE',label:'Faixa de distância'},{value:'NEIGHBORHOOD',label:'Bairro'},{value:'ZIP_RANGE',label:'Faixa de CEP'},{value:'CITY',label:'Cidade inteira'},{value:'GENERAL',label:'Regra geral / fallback'}]} />
              {rule.mode !== 'GENERAL' && <StateSelect value={rule.state} onChange={(v) => setRule({ ...rule, state: v, city: '' })} />}
              {rule.mode !== 'GENERAL' && <CityNameSelect uf={rule.state} value={rule.city} onChange={(v) => setRule({ ...rule, city: v })} items={municipalities[rule.state] || []} loading={Boolean(municipalityLoading[rule.state])} />}
              {rule.mode === 'NEIGHBORHOOD' && <Field label="Bairro" value={rule.neighborhood} onChange={(v) => setRule({ ...rule, neighborhood: v })} />}
              {rule.mode === 'ZIP_RANGE' && <><Field label="CEP inicial" value={rule.zipCodeStart} onChange={(v) => setRule({ ...rule, zipCodeStart: formatZip(v) })} /><Field label="CEP final" value={rule.zipCodeEnd} onChange={(v) => setRule({ ...rule, zipCodeEnd: formatZip(v) })} /></>}
              {rule.mode === 'DISTANCE' && <><Field label="De (km)" type="number" value={rule.minDistanceKm} onChange={(v) => setRule({ ...rule, minDistanceKm: v })} /><Field label="Até (km)" type="number" value={rule.maxDistanceKm} onChange={(v) => setRule({ ...rule, maxDistanceKm: v })} /></>}
            </div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Valor fixo (R$)" value={rule.fixedPrice} onChange={(v) => setRule({ ...rule, fixedPrice: v })} /><Field label="Valor mínimo (R$)" value={rule.minimumPrice} onChange={(v) => setRule({ ...rule, minimumPrice: v })} /><Field label="Por km (R$)" value={rule.perKm} onChange={(v) => setRule({ ...rule, perKm: v })} /><Field label="Adicional ida/volta" value={rule.roundTripAdditional} onChange={(v) => setRule({ ...rule, roundTripAdditional: v })} /><Field label="Adicional por kg" value={rule.weightAdditionalPerKg} onChange={(v) => setRule({ ...rule, weightAdditionalPerKg: v })} /><Field label="Estimativa (min)" type="number" value={rule.estimatedMinutes} onChange={(v) => setRule({ ...rule, estimatedMinutes: v })} /></div>
            <details className="mt-3 rounded-xl bg-stone-50 p-3"><summary className="cursor-pointer text-[10px] font-black text-stone-600">Limites só desta regra</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Peso máx. (kg)" type="number" value={rule.maxWeightKg} onChange={(v) => setRule({ ...rule, maxWeightKg: v })} /><Field label="Comprimento (cm)" type="number" value={rule.maxLengthCm} onChange={(v) => setRule({ ...rule, maxLengthCm: v })} /><Field label="Largura (cm)" type="number" value={rule.maxWidthCm} onChange={(v) => setRule({ ...rule, maxWidthCm: v })} /><Field label="Altura (cm)" type="number" value={rule.maxHeightCm} onChange={(v) => setRule({ ...rule, maxHeightCm: v })} /><Field label="Volume (cm³)" type="number" value={rule.maxVolumeCm3} onChange={(v) => setRule({ ...rule, maxVolumeCm3: v })} /></div></details>
            <button disabled={working} onClick={() => void createRule(table.id)} className="mt-4 rounded-xl bg-stone-900 px-4 py-2.5 text-[10px] font-black text-white">Adicionar regra</button></div>
            {!!table.rules?.length && <div className="mt-4 overflow-x-auto"><table className="min-w-[900px] w-full text-left text-[10px]"><thead className="text-stone-400"><tr><th className="py-2">Abrangência</th><th>Distância</th><th>Fixo</th><th>Por km</th><th>Mínimo</th><th>Retorno</th><th>Limites</th></tr></thead><tbody>{table.rules.map((row) => <tr key={row.id} className="border-t border-stone-200"><td className="py-2 font-bold">{scopeLabel(row)}</td><td>{distanceLabel(row)}</td><td>{row.fixedPriceCents == null ? '—' : money(row.fixedPriceCents)}</td><td>{row.perKmCents ? money(row.perKmCents) : '—'}</td><td>{row.minimumPriceCents ? money(row.minimumPriceCents) : '—'}</td><td>{row.roundTripAdditionalCents ? money(row.roundTripAdditionalCents) : '—'}</td><td>{limitsLabel(row)}</td></tr>)}</tbody></table></div>}
          </div>)}</div>
        </Card>}
      </main>
    </div>
  </div>;
}

function Card({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#b06448]">{eyebrow}</p><h2 className="mt-1 font-serif text-xl font-black text-stone-950">{title}</h2><p className="mt-1 max-w-4xl text-xs leading-5 text-stone-500">{description}</p><div className="mt-4">{children}</div></section>;
}
function Field({ label, value, onChange, type='text', placeholder='' }: { label:string; value:any; onChange:(v:string)=>void; type?:string; placeholder?:string }) { return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-stone-400" /></label>; }
function Select({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:Array<{value:string;label:string}> }) { return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold"><option value="" disabled>Selecione...</option>{options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}</select></label>; }
function StateSelect({ value, onChange }: { value:string; onChange:(v:string)=>void }) { return <label><span className="text-[9px] font-black uppercase text-stone-400">UF</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold"><option value="">Selecione...</option>{STATES.map((state) => <option key={state.uf} value={state.uf}>{state.uf} · {state.name}</option>)}</select></label>; }
function CityIdSelect({ uf,value,onChange,items,loading }:{uf:string;value:string;onChange:(v:string)=>void;items:Municipality[];loading:boolean}) { return <label><span className="text-[9px] font-black uppercase text-stone-400">Cidade</span><select disabled={!uf || loading} value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold disabled:bg-stone-50"><option value="">{!uf?'Selecione a UF primeiro':loading?'Carregando...':'Selecione a cidade...'}</option>{items.map((item)=><option key={item.id} value={String(item.id)}>{item.nome}</option>)}</select></label>; }
function CityNameSelect({ uf,value,onChange,items,loading }:{uf:string;value:string;onChange:(v:string)=>void;items:Municipality[];loading:boolean}) { return <label><span className="text-[9px] font-black uppercase text-stone-400">Cidade</span><select disabled={!uf || loading} value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold disabled:bg-stone-50"><option value="">{!uf?'Selecione a UF primeiro':loading?'Carregando...':'Selecione a cidade...'}</option>{items.map((item)=><option key={item.id} value={item.nome}>{item.nome}</option>)}</select></label>; }
function Toggle({ label,checked,onChange }:{label:string;checked:boolean;onChange:(v:boolean)=>void}) { return <button type="button" onClick={()=>onChange(!checked)} className={`rounded-xl px-3 py-2 text-xs font-black ${checked?'bg-emerald-100 text-emerald-700':'bg-stone-100 text-stone-500'}`}>{checked?'✓ ':''}{label}</button>; }
function normalizeCities(value:any):CoverageCity[] { if(!Array.isArray(value))return[]; return value.map((entry:any)=>{ if(entry&&typeof entry==='object'&&!Array.isArray(entry)){const city=String(entry.city||entry.name||'').trim();const state=String(entry.state||entry.uf||'').trim().toUpperCase();return city&&state?{ibgeId:entry.ibgeId==null?null:Number(entry.ibgeId),city,state}:null;} const raw=String(entry||'').trim();const match=raw.match(/^(.+?)\s*(?:\/|-)\s*([A-Za-z]{2})$/);return match?{ibgeId:null,city:match[1].trim(),state:match[2].toUpperCase()}:null;}).filter(Boolean) as CoverageCity[]; }
function normalizeWhatsAppGroup(raw:any):WhatsAppGroup { const id=serializeWid(raw?.id); const name=String(raw?.name||raw?.formattedTitle||raw?.contact?.name||raw?.contact?.pushname||raw?.id?.user||id||'Grupo').trim(); return{id,name}; }
function serializeWid(value:any):string { if(!value)return''; if(typeof value==='string')return value; if(typeof value._serialized==='string')return value._serialized; if(typeof value.user==='string'&&typeof value.server==='string')return `${value.user}@${value.server}`; if(typeof value.id==='string')return value.id; return''; }
function resolveTargetLabel(type:string,target:string,current:string,groups:WhatsAppGroup[]){ if(type==='WHATSAPP_GROUP_INTEGRATED')return groups.find((group)=>group.id===target)?.name||current||target; if(type==='WHATSAPP_INDIVIDUAL')return current||target; return current||target||null; }
function typeLabel(type:string){return TYPE_OPTIONS.find((item)=>item.value===type)?.label||type;}
function nullableNumber(value:any){if(String(value??'').trim()==='')return null;const n=Number(String(value).replace(',','.'));return Number.isFinite(n)&&n>0?n:null;}
function nullableInteger(value:any){if(String(value??'').trim()==='')return null;const n=Math.round(Number(value));return Number.isFinite(n)&&n>=0?n:null;}
function nullableKgToGrams(value:any){const n=nullableNumber(value);return n==null?null:Math.round(n*1000);}
function moneyToCents(value:any){if(String(value??'').trim()==='')return null;const n=Number(String(value).replace(',','.'));return Number.isFinite(n)&&n>=0?Math.round(n*100):null;}
function kmToMeters(value:any){const n=nullableNumber(value);return n==null?null:Math.round(n*1000);}
function digits(value:any){return String(value||'').replace(/\D/g,'').slice(0,8);}
function formatZip(value:any){const raw=digits(value);return raw.length>5?`${raw.slice(0,5)}-${raw.slice(5)}`:raw;}
function money(cents:any){return(Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function scopeLabel(row:RateRule){if(row.neighborhood)return `${row.neighborhood} · ${row.city||''}/${row.state||''}`;if(row.zipCodeStart||row.zipCodeEnd)return `CEP ${formatZip(row.zipCodeStart)} a ${formatZip(row.zipCodeEnd)} · ${row.city||''}/${row.state||''}`;if(row.city)return `${row.city}/${row.state||''}`;return'Regra geral';}
function distanceLabel(row:RateRule){if(row.minDistanceMeters==null&&row.maxDistanceMeters==null)return'—';const min=row.minDistanceMeters==null?'0':(Number(row.minDistanceMeters)/1000).toLocaleString('pt-BR');const max=row.maxDistanceMeters==null?'∞':(Number(row.maxDistanceMeters)/1000).toLocaleString('pt-BR');return`${min} a ${max} km`;}
function limitsLabel(row:RateRule){const parts=[] as string[];if(row.maxWeightGrams!=null)parts.push(`${(Number(row.maxWeightGrams)/1000).toLocaleString('pt-BR')} kg`);if(row.maxLengthCm||row.maxWidthCm||row.maxHeightCm)parts.push(`${row.maxLengthCm||'∞'}×${row.maxWidthCm||'∞'}×${row.maxHeightCm||'∞'} cm`);if(row.maxVolumeCm3)parts.push(`${row.maxVolumeCm3} cm³`);return parts.join(' · ')||'—';}
