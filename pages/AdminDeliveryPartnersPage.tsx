import React, { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  Building2,
  CircleDollarSign,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Truck,
  WalletCards,
} from 'lucide-react';
import { api } from '../lib/api';

type CoverageCity = {
  ibgeId?: number | null;
  city: string;
  state: string;
};

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

type RateTable = {
  id: string;
  version: number;
  name: string;
  startsAt?: string;
  endsAt?: string | null;
  active: boolean;
  rules?: RateRule[];
};

type Municipality = { id: number; nome: string };
type RuleMode = 'DISTANCE' | 'NEIGHBORHOOD' | 'ZIP_RANGE' | 'CITY' | 'GENERAL';

const STATES = [
  { id: 12, uf: 'AC', name: 'Acre' },
  { id: 27, uf: 'AL', name: 'Alagoas' },
  { id: 16, uf: 'AP', name: 'Amapá' },
  { id: 13, uf: 'AM', name: 'Amazonas' },
  { id: 29, uf: 'BA', name: 'Bahia' },
  { id: 23, uf: 'CE', name: 'Ceará' },
  { id: 53, uf: 'DF', name: 'Distrito Federal' },
  { id: 32, uf: 'ES', name: 'Espírito Santo' },
  { id: 52, uf: 'GO', name: 'Goiás' },
  { id: 21, uf: 'MA', name: 'Maranhão' },
  { id: 51, uf: 'MT', name: 'Mato Grosso' },
  { id: 50, uf: 'MS', name: 'Mato Grosso do Sul' },
  { id: 31, uf: 'MG', name: 'Minas Gerais' },
  { id: 15, uf: 'PA', name: 'Pará' },
  { id: 25, uf: 'PB', name: 'Paraíba' },
  { id: 41, uf: 'PR', name: 'Paraná' },
  { id: 26, uf: 'PE', name: 'Pernambuco' },
  { id: 22, uf: 'PI', name: 'Piauí' },
  { id: 33, uf: 'RJ', name: 'Rio de Janeiro' },
  { id: 24, uf: 'RN', name: 'Rio Grande do Norte' },
  { id: 43, uf: 'RS', name: 'Rio Grande do Sul' },
  { id: 11, uf: 'RO', name: 'Rondônia' },
  { id: 14, uf: 'RR', name: 'Roraima' },
  { id: 42, uf: 'SC', name: 'Santa Catarina' },
  { id: 35, uf: 'SP', name: 'São Paulo' },
  { id: 28, uf: 'SE', name: 'Sergipe' },
  { id: 17, uf: 'TO', name: 'Tocantins' },
] as const;

const PARTNER_TYPES = [
  { value: 'MOTOBOY', label: 'Motoboy' },
  { value: 'BIKE', label: 'Bike / bicicleta' },
  { value: 'TRANSPORTADORA', label: 'Transportadora local' },
  { value: 'MELHOR_ENVIO', label: 'Melhor Envio / integração futura' },
];

const CHANNELS = [
  { value: 'WHATSAPP_INDIVIDUAL', label: 'WhatsApp individual' },
  { value: 'WHATSAPP_GROUP_INTEGRATED', label: 'Grupo WhatsApp integrado' },
  { value: 'WHATSAPP_GROUP_MANUAL', label: 'Grupo WhatsApp manual' },
  { value: 'INTEGRATION', label: 'Integração / API' },
];

const blankPartner = {
  name: '',
  type: 'MOTOBOY',
  status: 'ACTIVE',
  priority: 100,
  cities: [] as CoverageCity[],
  maxWeightKg: '',
  maxLengthCm: '',
  maxWidthCm: '',
  maxHeightCm: '',
  maxVolumeCm3: '',
  supportsRoundTrip: false,
  supportsPrepaidBalance: false,
  channelType: 'WHATSAPP_INDIVIDUAL',
  channelTarget: '',
  pixKey: '',
  payoutDeadlineHours: 24,
  contactName: '',
  contactPhone: '',
  notes: '',
};

const blankRule = {
  mode: 'DISTANCE' as RuleMode,
  state: '',
  city: '',
  neighborhood: '',
  zipCodeStart: '',
  zipCodeEnd: '',
  minDistanceKm: '',
  maxDistanceKm: '',
  fixedPrice: '',
  minimumPrice: '',
  perKm: '',
  roundTripAdditional: '',
  weightAdditionalPerKg: '',
  maxWeightKg: '',
  maxLengthCm: '',
  maxWidthCm: '',
  maxHeightCm: '',
  estimatedMinutes: '45',
};

export default function AdminDeliveryPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [dashboard, setDashboard] = useState<any>({ jobs: [], invoices: [], partnerBalances: [], payouts: [] });
  const [selected, setSelected] = useState<Partner | null>(null);
  const [form, setForm] = useState<any>({ ...blankPartner });
  const [tables, setTables] = useState<RateTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tableName, setTableName] = useState('Tabela vigente');
  const [rule, setRule] = useState({ ...blankRule });
  const [coverageUf, setCoverageUf] = useState('');
  const [coverageCityId, setCoverageCityId] = useState('');
  const [municipalities, setMunicipalities] = useState<Record<string, Municipality[]>>({});
  const [municipalityLoading, setMunicipalityLoading] = useState<Record<string, boolean>>({});
  const [municipalityError, setMunicipalityError] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [partnersResponse, dashboardResponse] = await Promise.all([
        api.get('/admin/classifieds-delivery/partners'),
        api.get('/admin/classifieds-delivery/dashboard'),
      ]);
      setPartners(Array.isArray(partnersResponse.data) ? partnersResponse.data : []);
      setDashboard(dashboardResponse.data || { jobs: [], invoices: [], partnerBalances: [], payouts: [] });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Não foi possível carregar a operação de entregas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (coverageUf) void ensureMunicipalities(coverageUf);
  }, [coverageUf]);

  useEffect(() => {
    if (rule.state) void ensureMunicipalities(rule.state);
  }, [rule.state]);

  const ensureMunicipalities = async (uf: string, force = false) => {
    const normalized = String(uf || '').toUpperCase();
    if (!normalized || (!force && municipalities[normalized]?.length)) return;
    const state = STATES.find((item) => item.uf === normalized);
    if (!state) return;

    const cacheKey = `pn:ibge:municipios:${normalized}`;
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached?.savedAt && Date.now() - Number(cached.savedAt) < 30 * 24 * 60 * 60 * 1000 && Array.isArray(cached.items)) {
          setMunicipalities((current) => ({ ...current, [normalized]: cached.items }));
          return;
        }
      } catch {
        // Ignora cache local inválido e consulta o IBGE novamente.
      }
    }

    setMunicipalityLoading((current) => ({ ...current, [normalized]: true }));
    setMunicipalityError((current) => ({ ...current, [normalized]: '' }));
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state.id}/municipios?orderBy=nome`);
      if (!response.ok) throw new Error('Falha ao consultar municípios do IBGE.');
      const raw = await response.json();
      const items: Municipality[] = Array.isArray(raw)
        ? raw.map((item: any) => ({ id: Number(item.id), nome: String(item.nome || '') })).filter((item) => item.id && item.nome)
        : [];
      setMunicipalities((current) => ({ ...current, [normalized]: items }));
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items })); } catch { /* storage opcional */ }
    } catch {
      setMunicipalityError((current) => ({ ...current, [normalized]: 'Não foi possível carregar as cidades do IBGE.' }));
    } finally {
      setMunicipalityLoading((current) => ({ ...current, [normalized]: false }));
    }
  };

  const selectPartner = async (partner: Partner) => {
    setSelected(partner);
    setForm({
      name: partner.name,
      type: partner.type,
      status: partner.status,
      priority: partner.priority || 100,
      cities: normalizeCoverageCities(partner.cities),
      maxWeightKg: partner.maxWeightGrams ? Number(partner.maxWeightGrams) / 1000 : '',
      maxLengthCm: partner.maxLengthCm ?? '',
      maxWidthCm: partner.maxWidthCm ?? '',
      maxHeightCm: partner.maxHeightCm ?? '',
      maxVolumeCm3: partner.maxVolumeCm3 ?? '',
      supportsRoundTrip: Boolean(partner.supportsRoundTrip),
      supportsPrepaidBalance: Boolean(partner.supportsPrepaidBalance),
      channelType: partner.channelType || 'WHATSAPP_INDIVIDUAL',
      channelTarget: partner.channelTarget || '',
      pixKey: partner.pixKey || '',
      payoutDeadlineHours: partner.payoutDeadlineHours || 24,
      contactName: partner.contactName || '',
      contactPhone: partner.contactPhone || '',
      notes: partner.notes || '',
    });
    try {
      const response = await api.get(`/admin/classifieds-delivery/partners/${partner.id}/rate-tables`);
      setTables(Array.isArray(response.data) ? response.data : []);
    } catch {
      setTables([]);
    }
  };

  const newPartner = () => {
    setSelected(null);
    setForm({ ...blankPartner, cities: [] });
    setTables([]);
    setCoverageUf('');
    setCoverageCityId('');
    setRule({ ...blankRule });
    setNotice('');
    setError('');
  };

  const addCoverageCity = () => {
    const uf = String(coverageUf || '').toUpperCase();
    const city = (municipalities[uf] || []).find((item) => String(item.id) === String(coverageCityId));
    if (!uf || !city) return;
    const current = normalizeCoverageCities(form.cities);
    const exists = current.some((item) => item.state === uf && item.city.toLocaleLowerCase('pt-BR') === city.nome.toLocaleLowerCase('pt-BR'));
    if (exists) {
      setNotice('Essa cidade já está na cobertura do parceiro.');
      return;
    }
    setForm({ ...form, cities: [...current, { ibgeId: city.id, city: city.nome, state: uf }] });
    setCoverageCityId('');
    setNotice('');
  };

  const removeCoverageCity = (index: number) => {
    const current = normalizeCoverageCities(form.cities);
    setForm({ ...form, cities: current.filter((_, itemIndex) => itemIndex !== index) });
  };

  const savePartner = async () => {
    if (working) return;
    const cities = normalizeCoverageCities(form.cities);
    if (!String(form.name || '').trim()) { setError('Informe o nome do parceiro.'); return; }
    if (!cities.length) { setError('Selecione ao menos uma cidade atendida.'); return; }
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const nullableNumber = (value: any) => String(value ?? '').trim() === '' ? null : Number(value);
      const payload = {
        name: String(form.name || '').trim(),
        type: form.type,
        status: form.status,
        priority: Number(form.priority || 100),
        cities,
        maxWeightGrams: form.maxWeightKg === '' ? null : Math.round(Number(form.maxWeightKg) * 1000),
        maxLengthCm: nullableNumber(form.maxLengthCm),
        maxWidthCm: nullableNumber(form.maxWidthCm),
        maxHeightCm: nullableNumber(form.maxHeightCm),
        maxVolumeCm3: nullableNumber(form.maxVolumeCm3),
        supportsRoundTrip: Boolean(form.supportsRoundTrip),
        supportsPrepaidBalance: Boolean(form.supportsPrepaidBalance),
        channelType: form.channelType,
        channelTarget: String(form.channelTarget || '').trim() || null,
        pixKey: String(form.pixKey || '').trim() || null,
        payoutDeadlineHours: Number(form.payoutDeadlineHours || 24),
        contactName: String(form.contactName || '').trim() || null,
        contactPhone: String(form.contactPhone || '').trim() || null,
        notes: String(form.notes || '').trim() || null,
      };
      const response = selected
        ? await api.put(`/admin/classifieds-delivery/partners/${selected.id}`, payload)
        : await api.post('/admin/classifieds-delivery/partners', payload);
      setNotice(selected ? 'Parceiro atualizado.' : 'Parceiro criado. Agora configure a tabela de preços.');
      await load();
      await selectPartner(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Não foi possível salvar o parceiro.');
    } finally {
      setWorking(false);
    }
  };

  const createTable = async () => {
    if (!selected || working) return;
    setWorking(true);
    setError('');
    try {
      const response = await api.post(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`, {
        name: tableName,
        active: true,
        startsAt: new Date().toISOString(),
      });
      setNotice(`Tabela v${response.data?.version || ''} criada. Agora adicione as faixas e regras.`);
      const tablesResponse = await api.get(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`);
      setTables(Array.isArray(tablesResponse.data) ? tablesResponse.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Não foi possível criar a tabela.');
    } finally {
      setWorking(false);
    }
  };

  const createRule = async (tableId: string) => {
    if (working) return;
    const cents = (value: string) => value === '' ? null : Math.max(0, Math.round(Number(String(value).replace(',', '.')) * 100));
    const kmToMeters = (value: string) => value === '' ? null : Math.max(0, Math.round(Number(String(value).replace(',', '.')) * 1000));
    const kgToGrams = (value: string) => value === '' ? null : Math.max(1, Math.round(Number(String(value).replace(',', '.')) * 1000));
    const scope = rule.mode;

    if (scope !== 'GENERAL' && !rule.state) { setError('Selecione a UF da regra.'); return; }
    if (['DISTANCE', 'NEIGHBORHOOD', 'ZIP_RANGE', 'CITY'].includes(scope) && !rule.city) { setError('Selecione a cidade da regra.'); return; }
    if (scope === 'DISTANCE' && rule.minDistanceKm === '' && rule.maxDistanceKm === '') { setError('Informe a distância mínima, máxima ou ambas.'); return; }
    if (scope === 'NEIGHBORHOOD' && !rule.neighborhood.trim()) { setError('Informe o bairro da regra.'); return; }
    if (scope === 'ZIP_RANGE' && (!digits(rule.zipCodeStart) || !digits(rule.zipCodeEnd))) { setError('Informe o CEP inicial e final.'); return; }
    if (!rule.fixedPrice && !rule.perKm && !rule.minimumPrice) { setError('Informe valor fixo, valor por km ou valor mínimo.'); return; }

    setWorking(true);
    setError('');
    try {
      await api.post(`/admin/classifieds-delivery/rate-tables/${tableId}/rules`, {
        priority: 100,
        city: scope === 'GENERAL' ? null : rule.city || null,
        state: scope === 'GENERAL' ? null : rule.state || null,
        neighborhood: scope === 'NEIGHBORHOOD' ? rule.neighborhood.trim() : null,
        zipCodeStart: scope === 'ZIP_RANGE' ? digits(rule.zipCodeStart) : null,
        zipCodeEnd: scope === 'ZIP_RANGE' ? digits(rule.zipCodeEnd) : null,
        minDistanceMeters: scope === 'DISTANCE' ? kmToMeters(rule.minDistanceKm) : null,
        maxDistanceMeters: scope === 'DISTANCE' ? kmToMeters(rule.maxDistanceKm) : null,
        fixedPriceCents: cents(rule.fixedPrice),
        minimumPriceCents: cents(rule.minimumPrice) || 0,
        perKmCents: cents(rule.perKm) || 0,
        roundTripAdditionalCents: cents(rule.roundTripAdditional) || 0,
        weightAdditionalPerKgCents: cents(rule.weightAdditionalPerKg) || 0,
        maxWeightGrams: kgToGrams(rule.maxWeightKg),
        maxLengthCm: numericOrNull(rule.maxLengthCm),
        maxWidthCm: numericOrNull(rule.maxWidthCm),
        maxHeightCm: numericOrNull(rule.maxHeightCm),
        estimatedMinutes: Number(rule.estimatedMinutes || 0) || null,
      });
      setNotice('Regra adicionada à tabela.');
      setRule((current) => ({ ...blankRule, state: current.state, city: current.city, mode: current.mode }));
      if (selected) {
        const response = await api.get(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`);
        setTables(Array.isArray(response.data) ? response.data : []);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Não foi possível criar a regra.');
    } finally {
      setWorking(false);
    }
  };

  const openInvoices = Array.isArray(dashboard.invoices) ? dashboard.invoices : [];
  const jobs = Array.isArray(dashboard.jobs) ? dashboard.jobs : [];
  const balances = Array.isArray(dashboard.partnerBalances) ? dashboard.partnerBalances : [];
  const payouts = Array.isArray(dashboard.payouts) ? dashboard.payouts : [];
  const balanceTotal = balances.reduce((sum: number, item: any) => sum + Number(item.balanceCents || 0), 0);
  const activeJobs = jobs.filter((item: any) => !['DELIVERED', 'CANCELED'].includes(String(item.status || '').toUpperCase()));
  const selectedCities = normalizeCoverageCities(form.cities);

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Admin · Logística</p>
          <h1 className="mt-1 font-serif text-4xl font-black">Parceiros de frete</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Cadastre cada modalidade local, defina cidades atendidas por IBGE, limites do veículo, canal de despacho, repasse e tabelas de cálculo versionadas.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={newPartner} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-black text-white"><Plus className="h-4 w-4" /> Novo parceiro</button>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" /> Atualizar</button>
        </div>
      </header>

      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Truck className="h-5 w-5" />} label="Parceiros" value={String(partners.length)} />
        <Metric icon={<Bike className="h-5 w-5" />} label="Corridas abertas" value={String(activeJobs.length)} />
        <Metric icon={<WalletCards className="h-5 w-5" />} label="Faturas abertas" value={String(openInvoices.length)} />
        <Metric icon={<CircleDollarSign className="h-5 w-5" />} label="Saldo ledger" value={money(balanceTotal)} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-stone-200 xl:self-start">
          <div className="flex items-center justify-between"><h2 className="font-serif text-xl font-black">Parceiros</h2><span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black text-stone-500">{partners.length}</span></div>
          <div className="mt-4 space-y-2">
            {partners.map((partner) => {
              const coverage = normalizeCoverageCities(partner.cities);
              return <button key={partner.id} onClick={() => void selectPartner(partner)} className={`w-full rounded-2xl p-3 text-left ring-1 ${selected?.id === partner.id ? 'bg-terracotta-50 ring-terracotta-200' : 'bg-stone-50 ring-stone-200'}`}>
                <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black">{partner.name}</p><p className="mt-1 text-[10px] text-stone-400">{partnerTypeLabel(partner.type)} · prioridade {partner.priority || 100}</p></div><span className={`rounded-full px-2 py-1 text-[8px] font-black ${partner.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>{partner.status}</span></div>
                <p className="mt-2 line-clamp-2 text-[10px] font-bold text-stone-500">{coverage.length ? coverage.map((item) => `${item.city}/${item.state}`).join(' · ') : 'Sem cidade configurada'}</p>
              </button>;
            })}
          </div>
        </aside>

        <main className="space-y-5">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">1 · Identificação</p><h2 className="mt-1 font-serif text-xl font-black">{selected ? `Editar ${selected.name}` : 'Novo parceiro'}</h2></div>{selected && <span className="rounded-full bg-stone-100 px-3 py-1 text-[9px] font-black text-stone-500">ID {selected.id.slice(0, 8)}</span>}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TextField label="Nome comercial" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <OptionSelect label="Tipo de entrega" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={PARTNER_TYPES} />
              <OptionSelect label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: 'ACTIVE', label: 'Ativo' }, { value: 'INACTIVE', label: 'Inativo' }, { value: 'SUSPENDED', label: 'Suspenso' }]} />
              <TextField label="Prioridade de exibição" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} type="number" />
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
            <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">2 · Cobertura</p><h2 className="mt-1 font-serif text-xl font-black">Cidades atendidas</h2><p className="mt-1 text-xs leading-5 text-stone-500">A cobertura é estruturada por UF e município do IBGE. Nada de cidade digitada de três jeitos diferentes.</p></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
              <StateSelect label="UF" value={coverageUf} onChange={(value) => { setCoverageUf(value); setCoverageCityId(''); }} />
              <MunicipalitySelect label="Cidade" uf={coverageUf} value={coverageCityId} onChange={setCoverageCityId} items={municipalities[coverageUf] || []} loading={Boolean(municipalityLoading[coverageUf])} />
              <button type="button" disabled={!coverageUf || !coverageCityId} onClick={addCoverageCity} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> Incluir cidade</button>
            </div>
            {coverageUf && municipalityError[coverageUf] && <div className="mt-2 flex items-center gap-2 text-xs font-bold text-red-600"><span>{municipalityError[coverageUf]}</span><button type="button" onClick={() => void ensureMunicipalities(coverageUf, true)} className="underline">Tentar novamente</button></div>}
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedCities.map((item, index) => <span key={`${item.state}-${item.ibgeId || item.city}`} className="inline-flex items-center gap-2 rounded-full bg-terracotta-50 px-3 py-2 text-[10px] font-black text-terracotta-700 ring-1 ring-terracotta-100"><MapPin className="h-3.5 w-3.5" /> {item.city}/{item.state}<button type="button" onClick={() => removeCoverageCity(index)} className="rounded-full p-0.5 hover:bg-white" aria-label={`Remover ${item.city}`}><Trash2 className="h-3 w-3" /></button></span>)}
              {!selectedCities.length && <p className="rounded-2xl bg-stone-50 px-4 py-3 text-xs text-stone-400">Selecione pelo menos uma cidade. É isso que determina onde este frete poderá aparecer para comprador e empresa.</p>}
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
            <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">3 · Capacidade</p><h2 className="mt-1 font-serif text-xl font-black">Limites da modalidade</h2><p className="mt-1 text-xs leading-5 text-stone-500">Se um produto ultrapassar esses limites, a opção deixa de ser elegível. Útil para separar Bike, Motoboy e veículos maiores.</p></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <TextField label="Peso máximo (kg)" value={form.maxWeightKg} onChange={(v) => setForm({ ...form, maxWeightKg: v })} type="number" />
              <TextField label="Comprimento máx. (cm)" value={form.maxLengthCm} onChange={(v) => setForm({ ...form, maxLengthCm: v })} type="number" />
              <TextField label="Largura máx. (cm)" value={form.maxWidthCm} onChange={(v) => setForm({ ...form, maxWidthCm: v })} type="number" />
              <TextField label="Altura máx. (cm)" value={form.maxHeightCm} onChange={(v) => setForm({ ...form, maxHeightCm: v })} type="number" />
              <TextField label="Volume máx. (cm³)" value={form.maxVolumeCm3} onChange={(v) => setForm({ ...form, maxVolumeCm3: v })} type="number" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3"><Toggle label="Aceita corrida com ida e volta" checked={form.supportsRoundTrip} onChange={(v) => setForm({ ...form, supportsRoundTrip: v })} /><Toggle label="Pode consumir saldo pré-pago" checked={form.supportsPrepaidBalance} onChange={(v) => setForm({ ...form, supportsPrepaidBalance: v })} /></div>
          </section>

          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
            <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">4 · Operação e repasse</p><h2 className="mt-1 font-serif text-xl font-black">WhatsApp, contato e Pix</h2><p className="mt-1 text-xs leading-5 text-stone-500">O canal define para onde vai o chamado de retirada/entrega. A chave Pix e o prazo ficam registrados para liquidação do parceiro.</p></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <OptionSelect label="Canal de despacho" value={form.channelType} onChange={(v) => setForm({ ...form, channelType: v })} options={CHANNELS} />
              <TextField label={channelTargetLabel(form.channelType)} value={form.channelTarget} onChange={(v) => setForm({ ...form, channelTarget: v })} />
              <TextField label="Chave Pix para repasse" value={form.pixKey} onChange={(v) => setForm({ ...form, pixKey: v })} />
              <TextField label="Nome do contato" value={form.contactName} onChange={(v) => setForm({ ...form, contactName: v })} />
              <TextField label="Telefone / WhatsApp" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
              <TextField label="Prazo de repasse (horas)" value={form.payoutDeadlineHours} onChange={(v) => setForm({ ...form, payoutDeadlineHours: v })} type="number" />
            </div>
            <label className="mt-4 block"><span className="text-[9px] font-black uppercase text-stone-400">Notas internas</span><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400" placeholder="Ex.: atende fins de semana, não leva bebidas abertas, veículo baú..." /></label>
            <button disabled={working} onClick={() => void savePartner()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-stone-900 px-5 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{working ? 'Salvando...' : 'Salvar parceiro'}</button>
          </section>

          {selected && <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
            <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">5 · Precificação</p><h2 className="mt-1 font-serif text-xl font-black">Tabelas de preço versionadas</h2><p className="mt-1 text-xs text-stone-500">Uma cotação antiga guarda a versão usada. Crie nova tabela quando os preços mudarem em vez de reescrever histórico.</p></div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={tableName} onChange={(e) => setTableName(e.target.value)} className="h-11 flex-1 rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-stone-400" /><button disabled={working} onClick={() => void createTable()} className="rounded-xl bg-[#0d4542] px-4 py-3 text-xs font-black text-white">Criar nova versão</button></div>

            <div className="mt-4 space-y-4">{tables.map((table) => <div key={table.id} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black">v{table.version} · {table.name}</p><p className="mt-1 text-[10px] text-stone-400">{table.active ? 'Ativa' : 'Inativa'} · início {dateTime(table.startsAt)}</p></div><span className="w-fit rounded-full bg-white px-2 py-1 text-[9px] font-black ring-1 ring-stone-200">{table.rules?.length || 0} regra(s)</span></div>

              <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-terracotta-600" /><p className="text-xs font-black">Adicionar regra nesta versão</p></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <OptionSelect label="Tipo de regra" value={rule.mode} onChange={(v) => setRule({ ...blankRule, mode: v as RuleMode })} options={[
                    { value: 'DISTANCE', label: 'Faixa de distância' },
                    { value: 'NEIGHBORHOOD', label: 'Preço por bairro' },
                    { value: 'ZIP_RANGE', label: 'Faixa de CEP' },
                    { value: 'CITY', label: 'Cidade inteira' },
                    { value: 'GENERAL', label: 'Regra geral / fallback' },
                  ]} />
                  {rule.mode !== 'GENERAL' && <StateSelect label="UF" value={rule.state} onChange={(value) => setRule({ ...rule, state: value, city: '' })} />}
                  {rule.mode !== 'GENERAL' && <MunicipalityNameSelect label="Cidade" uf={rule.state} value={rule.city} onChange={(value) => setRule({ ...rule, city: value })} items={municipalities[rule.state] || []} loading={Boolean(municipalityLoading[rule.state])} />}
                  {rule.mode === 'NEIGHBORHOOD' && <TextField label="Bairro" value={rule.neighborhood} onChange={(v) => setRule({ ...rule, neighborhood: v })} />}
                  {rule.mode === 'ZIP_RANGE' && <><TextField label="CEP inicial" value={rule.zipCodeStart} onChange={(v) => setRule({ ...rule, zipCodeStart: formatZip(v) })} /><TextField label="CEP final" value={rule.zipCodeEnd} onChange={(v) => setRule({ ...rule, zipCodeEnd: formatZip(v) })} /></>}
                  {rule.mode === 'DISTANCE' && <><TextField label="De (km)" value={rule.minDistanceKm} onChange={(v) => setRule({ ...rule, minDistanceKm: v })} type="number" /><TextField label="Até (km)" value={rule.maxDistanceKm} onChange={(v) => setRule({ ...rule, maxDistanceKm: v })} type="number" /></>}
                </div>

                <div className="mt-4 border-t border-stone-100 pt-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">Preço</p><div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><TextField label="Valor fixo (R$)" value={rule.fixedPrice} onChange={(v) => setRule({ ...rule, fixedPrice: v })} /><TextField label="Valor mínimo (R$)" value={rule.minimumPrice} onChange={(v) => setRule({ ...rule, minimumPrice: v })} /><TextField label="Por km (R$)" value={rule.perKm} onChange={(v) => setRule({ ...rule, perKm: v })} /><TextField label="Adicional ida/volta (R$)" value={rule.roundTripAdditional} onChange={(v) => setRule({ ...rule, roundTripAdditional: v })} /><TextField label="Adicional por kg (R$)" value={rule.weightAdditionalPerKg} onChange={(v) => setRule({ ...rule, weightAdditionalPerKg: v })} /><TextField label="Estimativa (min)" value={rule.estimatedMinutes} onChange={(v) => setRule({ ...rule, estimatedMinutes: v })} type="number" /></div></div>

                <details className="mt-4 rounded-xl bg-stone-50 p-3"><summary className="cursor-pointer text-[10px] font-black text-stone-600">Limites específicos desta regra</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><TextField label="Peso máx. (kg)" value={rule.maxWeightKg} onChange={(v) => setRule({ ...rule, maxWeightKg: v })} type="number" /><TextField label="Comprimento máx. (cm)" value={rule.maxLengthCm} onChange={(v) => setRule({ ...rule, maxLengthCm: v })} type="number" /><TextField label="Largura máx. (cm)" value={rule.maxWidthCm} onChange={(v) => setRule({ ...rule, maxWidthCm: v })} type="number" /><TextField label="Altura máx. (cm)" value={rule.maxHeightCm} onChange={(v) => setRule({ ...rule, maxHeightCm: v })} type="number" /></div></details>

                {rule.state && municipalityError[rule.state] && <div className="mt-2 text-xs font-bold text-red-600">{municipalityError[rule.state]} <button type="button" className="underline" onClick={() => void ensureMunicipalities(rule.state, true)}>Tentar novamente</button></div>}
                <button disabled={working} onClick={() => void createRule(table.id)} className="mt-4 rounded-xl bg-stone-900 px-4 py-2.5 text-[10px] font-black text-white">Adicionar regra</button>
              </div>

              {table.rules?.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-[10px]"><thead className="text-stone-400"><tr><th className="py-2">Abrangência</th><th>Distância</th><th>Fixo</th><th>Por km</th><th>Mínimo</th><th>Retorno</th><th>Limite</th><th>Estimativa</th></tr></thead><tbody>{table.rules.map((item) => <tr key={item.id} className="border-t border-stone-200"><td className="py-2 font-bold">{ruleScopeLabel(item)}</td><td>{distanceLabel(item)}</td><td>{item.fixedPriceCents == null ? '—' : money(item.fixedPriceCents)}</td><td>{Number(item.perKmCents || 0) ? money(item.perKmCents) : '—'}</td><td>{Number(item.minimumPriceCents || 0) ? money(item.minimumPriceCents) : '—'}</td><td>{Number(item.roundTripAdditionalCents || 0) ? money(item.roundTripAdditionalCents) : '—'}</td><td>{limitLabel(item)}</td><td>{item.estimatedMinutes ? `${item.estimatedMinutes} min` : '—'}</td></tr>)}</tbody></table></div> : null}
            </div>)}</div>
          </section>}
        </main>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-terracotta-600" /><h2 className="font-serif text-xl font-black">Corridas recentes</h2></div><div className="mt-4 space-y-2">{jobs.slice(0, 12).map((job: any) => <div key={job.id} className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-xs"><div><p className="font-black">{job.partnerName} · {job.companyName}</p><p className="mt-1 text-stone-400">{job.status} · {dateTime(job.createdAt)}</p></div><strong>{money(job.partnerPayableCents || job.amountCents || 0)}</strong></div>)}{!jobs.length && <p className="text-xs text-stone-400">Nenhuma corrida registrada.</p>}</div></div>
        <div className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-terracotta-600" /><h2 className="font-serif text-xl font-black">Repasses recentes</h2></div><div className="mt-4 space-y-2">{payouts.slice(0, 12).map((payout: any) => <div key={payout.id} className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-xs"><div><p className="font-black">{payout.partnerName}</p><p className="mt-1 text-stone-400">{payout.status} · {dateTime(payout.createdAt)}</p></div><strong>{money(payout.amountCents || 0)}</strong></div>)}{!payouts.length && <p className="text-xs text-stone-400">Nenhum repasse registrado.</p>}</div></div>
      </section>
    </div>
  );
}

function normalizeCoverageCities(value: Partner['cities'] | any): CoverageCity[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry: any) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const city = String(entry.city || entry.name || '').trim();
      const state = String(entry.state || entry.uf || '').trim().toUpperCase();
      if (!city || !state) return null;
      return { ibgeId: entry.ibgeId == null ? null : Number(entry.ibgeId), city, state };
    }
    const raw = String(entry || '').trim();
    const match = raw.match(/^(.+?)\s*(?:\/|-)\s*([A-Za-z]{2})$/);
    if (match) return { ibgeId: null, city: match[1].trim(), state: match[2].toUpperCase() };
    return null;
  }).filter(Boolean) as CoverageCity[];
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta-50 text-terracotta-600">{icon}</div><p className="mt-4 text-[9px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-stone-400" /></label>;
}

function OptionSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold outline-none focus:border-stone-400">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function StateSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold outline-none focus:border-stone-400"><option value="">Selecione...</option>{STATES.map((state) => <option key={state.uf} value={state.uf}>{state.uf} · {state.name}</option>)}</select></label>;
}

function MunicipalitySelect({ label, uf, value, onChange, items, loading }: { label: string; uf: string; value: string; onChange: (value: string) => void; items: Municipality[]; loading: boolean }) {
  return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><select value={value} disabled={!uf || loading} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold outline-none disabled:bg-stone-50 disabled:text-stone-400"><option value="">{!uf ? 'Selecione a UF primeiro' : loading ? 'Carregando cidades...' : 'Selecione a cidade...'}</option>{items.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}</select></label>;
}

function MunicipalityNameSelect({ label, uf, value, onChange, items, loading }: { label: string; uf: string; value: string; onChange: (value: string) => void; items: Municipality[]; loading: boolean }) {
  return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><select value={value} disabled={!uf || loading} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold outline-none disabled:bg-stone-50 disabled:text-stone-400"><option value="">{!uf ? 'Selecione a UF primeiro' : loading ? 'Carregando cidades...' : 'Selecione a cidade...'}</option>{items.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}</select></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`rounded-xl px-3 py-2 text-xs font-black ${checked ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{checked ? '✓ ' : ''}{label}</button>;
}

function partnerTypeLabel(value: string) {
  return PARTNER_TYPES.find((item) => item.value === value)?.label || value;
}

function channelTargetLabel(value: string) {
  if (value === 'WHATSAPP_INDIVIDUAL') return 'Número / identificador WhatsApp';
  if (value === 'WHATSAPP_GROUP_INTEGRATED') return 'ID do grupo integrado';
  if (value === 'WHATSAPP_GROUP_MANUAL') return 'Link / identificação do grupo';
  return 'Destino / identificador da integração';
}

function ruleScopeLabel(rule: RateRule) {
  if (rule.neighborhood) return `${rule.neighborhood} · ${rule.city || ''}/${rule.state || ''}`;
  if (rule.zipCodeStart || rule.zipCodeEnd) return `CEP ${formatZip(rule.zipCodeStart || '')} a ${formatZip(rule.zipCodeEnd || '')}${rule.city ? ` · ${rule.city}/${rule.state || ''}` : ''}`;
  if (rule.city) return `${rule.city}/${rule.state || ''}`;
  return 'Regra geral';
}

function distanceLabel(rule: RateRule) {
  if (rule.minDistanceMeters == null && rule.maxDistanceMeters == null) return '—';
  const min = rule.minDistanceMeters == null ? '0' : (Number(rule.minDistanceMeters) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const max = rule.maxDistanceMeters == null ? '∞' : (Number(rule.maxDistanceMeters) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${min} a ${max} km`;
}

function limitLabel(rule: RateRule) {
  const parts: string[] = [];
  if (rule.maxWeightGrams != null) parts.push(`${(Number(rule.maxWeightGrams) / 1000).toLocaleString('pt-BR')} kg`);
  if (rule.maxLengthCm != null || rule.maxWidthCm != null || rule.maxHeightCm != null) parts.push(`${rule.maxLengthCm || '∞'}×${rule.maxWidthCm || '∞'}×${rule.maxHeightCm || '∞'} cm`);
  return parts.join(' · ') || '—';
}

function numericOrNull(value: string) {
  if (String(value ?? '').trim() === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function digits(value: string) { return String(value || '').replace(/\D/g, '').slice(0, 8); }
function formatZip(value: string) { const raw = digits(value); return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw; }
function money(cents: any) { return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function dateTime(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR'); }
