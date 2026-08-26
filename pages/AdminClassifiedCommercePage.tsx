import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, Building2, Loader2, Percent, Save, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

type PlanKey = 'FREE' | 'PLUS' | 'ELITE';

type Rule = {
  id: string;
  scope: 'PLAN' | 'COMPANY';
  plan?: PlanKey | null;
  companyId?: string | null;
  companyName?: string | null;
  percentage: number | null;
  minimumFeeCents: number;
  maximumFeeCents: number | null;
  enabled: boolean;
};

type Draft = {
  percentage: string;
  minimum: string;
  maximum: string;
  enabled: boolean;
};

type PaymentProduct = {
  code: string;
  name?: string;
  priceCents?: number;
};

const PLANS = ['FREE', 'PLUS', 'ELITE'] as const;
const PLAN_PRODUCT_CODES: Partial<Record<PlanKey, string>> = {
  PLUS: 'COMPANY_PLUS_MONTHLY',
  ELITE: 'COMPANY_ELITE_MONTHLY',
};
const EMPTY_DRAFT: Draft = { percentage: '', minimum: '0,00', maximum: '', enabled: true };

export default function AdminClassifiedCommercePage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [planPrices, setPlanPrices] = useState<Record<PlanKey, string>>({ FREE: '0,00', PLUS: '', ELITE: '' });
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [companyDraft, setCompanyDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [feeResponse, productsResponse] = await Promise.all([
        api.get('/admin/classifieds-commerce/fee-rules'),
        api.get('/admin/payments/products'),
      ]);
      const rows = Array.isArray(feeResponse.data) ? feeResponse.data as Rule[] : [];
      const products = Array.isArray(productsResponse.data) ? productsResponse.data as PaymentProduct[] : [];
      setRules(rows);

      const next: Record<string, Draft> = {};
      for (const plan of PLANS) {
        const rule = rows.find((item) => item.scope === 'PLAN' && item.plan === plan);
        next[plan] = fromRule(rule);
      }
      setDrafts(next);

      const productByCode = new Map(products.map((product) => [product.code, product]));
      setPlanPrices({
        FREE: '0,00',
        PLUS: toReais(productByCode.get('COMPANY_PLUS_MONTHLY')?.priceCents ?? 0),
        ELITE: toReais(productByCode.get('COMPANY_ELITE_MONTHLY')?.priceCents ?? 0),
      });
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível carregar as comissões e os valores dos planos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setCompanies([]); return; }
    const timer = window.setTimeout(() => {
      api.get(`/admin/classifieds-commerce/companies?q=${encodeURIComponent(text)}`)
        .then((response) => setCompanies(Array.isArray(response.data) ? response.data : []))
        .catch(() => setCompanies([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const customRules = useMemo(() => rules.filter((item) => item.scope === 'COMPANY'), [rules]);

  const savePlan = async (plan: PlanKey) => {
    const draft = drafts[plan];
    if (!draft || working) return;
    setWorking(plan);
    setMessage('');
    try {
      const requests: Promise<any>[] = [
        api.patch(`/admin/classifieds-commerce/fee-rules/plans/${plan}`, payload(draft)),
      ];
      const productCode = PLAN_PRODUCT_CODES[plan];
      if (productCode) {
        requests.push(api.patch(`/admin/payments/products/${productCode}`, {
          priceCents: toCents(planPrices[plan]),
        }));
      }
      await Promise.all(requests);
      setMessage(plan === 'FREE'
        ? 'Comissão do plano Free atualizada.'
        : `Plano ${plan}: mensalidade e comissão atualizadas.`);
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || `Não foi possível salvar o plano ${plan}.`);
    } finally {
      setWorking('');
    }
  };

  const chooseCompany = (company: any) => {
    setSelectedCompany(company);
    setQuery(company.name || '');
    setCompanies([]);
    const existing = rules.find((item) => item.scope === 'COMPANY' && item.companyId === company.id);
    setCompanyDraft(fromRule(existing));
  };

  const saveCompany = async () => {
    if (!selectedCompany || working) return;
    setWorking(`company-${selectedCompany.id}`);
    setMessage('');
    try {
      await api.patch(`/admin/classifieds-commerce/fee-rules/companies/${selectedCompany.id}`, payload(companyDraft));
      setMessage(`Regra Custom de ${selectedCompany.name} salva.`);
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível salvar a regra Custom.');
    } finally {
      setWorking('');
    }
  };

  const removeCustom = async (rule: Rule) => {
    if (!rule.companyId || working) return;
    if (!window.confirm(`Remover a regra Custom de ${rule.companyName || 'esta empresa'}? Ela voltará a usar a regra do plano.`)) return;
    setWorking(`delete-${rule.companyId}`);
    setMessage('');
    try {
      await api.delete(`/admin/classifieds-commerce/fee-rules/companies/${rule.companyId}`);
      setMessage('Regra Custom removida. A empresa voltou a herdar a taxa do plano.');
      if (selectedCompany?.id === rule.companyId) { setSelectedCompany(null); setQuery(''); }
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível remover a regra Custom.');
    } finally {
      setWorking('');
    }
  };

  if (loading && !Object.keys(drafts).length) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Classificados · monetização</p>
        <h1 className="mt-1 font-serif text-3xl font-black">Comissões de venda online</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Defina a mensalidade dos planos empresariais e a comissão cobrada somente quando uma empresa usa o recebimento online dos Classificados. Uma regra Custom por empresa sempre substitui a comissão do plano.</p>
      </header>

      {message && <div className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">{message}</div>}

      <section className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanRuleCard
            key={plan}
            plan={plan}
            draft={drafts[plan] || { ...EMPTY_DRAFT }}
            price={planPrices[plan]}
            onPriceChange={(value) => setPlanPrices((current) => ({ ...current, [plan]: value }))}
            onChange={(draft) => setDrafts((current) => ({ ...current, [plan]: draft }))}
            saving={working === plan}
            onSave={() => void savePlan(plan)}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Building2 className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Contrato especial</p><h2 className="text-lg font-black">Regra Custom por empresa</h2></div></div>
          <p className="mt-3 text-xs leading-5 text-stone-500">Use para negociações comerciais específicas. Enquanto a regra Custom estiver ativa, mudanças no Free/Plus/Elite não alteram a comissão daquela empresa.</p>
          <label className="relative mt-5 block"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); if (selectedCompany && event.target.value !== selectedCompany.name) setSelectedCompany(null); }} placeholder="Buscar empresa por nome, CNPJ ou CPF" className="h-12 w-full rounded-2xl bg-stone-50 pl-11 pr-4 text-sm font-semibold outline-none ring-1 ring-stone-200 focus:bg-white" /></label>
          {companies.length > 0 && <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-lg">{companies.map((company) => <button key={company.id} onClick={() => chooseCompany(company)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-stone-50"><div><p className="text-sm font-black">{company.name}</p><p className="mt-0.5 text-[10px] text-stone-400">{company.city ? `${company.city}/${company.state || ''}` : 'Local não informado'}</p></div>{(company.isVerified || company.verificationStatus === 'VERIFIED') && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase text-emerald-700">Verificada</span>}</button>)}</div>}

          {selectedCompany && <div className="mt-5 rounded-2xl bg-stone-50 p-4"><p className="text-xs font-black">{selectedCompany.name}</p><RuleFields draft={companyDraft} onChange={setCompanyDraft} /><button onClick={() => void saveCompany()} disabled={Boolean(working)} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 text-sm font-black text-white disabled:opacity-50">{working === `company-${selectedCompany.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar regra Custom</button></div>}
        </div>

        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
          <div className="flex items-center gap-3"><BadgeDollarSign className="h-5 w-5 text-stone-500" /><h2 className="text-lg font-black">Empresas com regra Custom</h2></div>
          {customRules.length ? <div className="mt-4 space-y-2">{customRules.map((rule) => <div key={rule.id} className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{rule.companyName || rule.companyId}</p><p className="mt-1 text-xs text-stone-500">{formatPercent(rule.percentage)}% · mínimo {money(rule.minimumFeeCents)} · teto {rule.maximumFeeCents == null ? 'sem teto' : money(rule.maximumFeeCents)} · {rule.enabled ? 'ativa' : 'desativada'}</p></div><div className="flex gap-2"><button onClick={() => chooseCompany({ id: rule.companyId, name: rule.companyName || rule.companyId })} className="rounded-xl bg-white px-3 py-2 text-xs font-black ring-1 ring-stone-200">Editar</button><button onClick={() => void removeCustom(rule)} disabled={Boolean(working)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 disabled:opacity-50" aria-label="Remover regra"><Trash2 className="h-4 w-4" /></button></div></div>)}</div> : <div className="py-12 text-center text-sm text-stone-400">Nenhuma empresa possui taxa Custom. Todas herdam a comissão do plano.</div>}
        </div>
      </section>

      <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-5 text-xs leading-5 text-blue-900"><strong>Importante:</strong> mensalidade do plano e comissão sobre venda são coisas diferentes. A empresa pode usar Classificados sem conectar pagamento online; a comissão só existe quando uma venda passa pelo checkout do marketplace.</div>
    </div>
  );
}

function PlanRuleCard({
  plan,
  draft,
  price,
  onPriceChange,
  onChange,
  saving,
  onSave,
}: {
  plan: PlanKey;
  draft: Draft;
  price: string;
  onPriceChange: (value: string) => void;
  onChange: (draft: Draft) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const labels = { FREE: 'Free', PLUS: 'Plus', ELITE: 'Elite' };
  const free = plan === 'FREE';
  return (
    <article className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-stone-200">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Plano</p><h2 className="mt-1 text-xl font-black">{labels[plan]}</h2><p className="mt-1 text-xs font-bold text-stone-500">{free ? 'Grátis' : `${money(toCents(price))}/mês`}</p></div>
        <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${draft.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>{draft.enabled ? 'Ativa' : 'Desativada'}</span>
      </div>
      <div className="mt-4">
        <MoneyInput label="Mensalidade do plano" value={free ? '0,00' : price} setValue={onPriceChange} disabled={free} />
        {free && <p className="mt-1 text-[10px] text-stone-400">O plano Free permanece R$ 0,00.</p>}
      </div>
      <RuleFields draft={draft} onChange={onChange} />
      <button onClick={onSave} disabled={saving || draft.percentage === '' || (!free && !price.trim())} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 text-sm font-black text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar {labels[plan]}</button>
    </article>
  );
}

function RuleFields({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  return (
    <div className="mt-4 space-y-3">
      <label className="block">
        <span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">Comissão (%)</span>
        <div className="relative mt-1"><Percent className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input type="number" min="0" max="100" step="0.01" value={draft.percentage} onChange={(event) => onChange({ ...draft, percentage: event.target.value })} className={inputClass} /></div>
      </label>
      <div className="grid grid-cols-2 gap-3"><MoneyInput label="Taxa mínima" value={draft.minimum} setValue={(value) => onChange({ ...draft, minimum: value })} /><MoneyInput label="Teto máximo" value={draft.maximum} setValue={(value) => onChange({ ...draft, maximum: value })} placeholder="Sem teto" /></div>
      <label className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200"><span className="text-xs font-black text-stone-600">Regra ativa</span><input type="checkbox" checked={draft.enabled} onChange={(event) => onChange({ ...draft, enabled: event.target.checked })} /></label>
    </div>
  );
}

function MoneyInput({ label, value, setValue, placeholder = '0,00', disabled = false }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string; disabled?: boolean }) {
  return <label className="block"><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span><div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-400">R$</span><input value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className={`${inputClass} pl-9 disabled:bg-stone-100 disabled:text-stone-400`} /></div></label>;
}

const inputClass = 'h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold outline-none focus:border-stone-400';

function fromRule(rule?: Rule): Draft {
  return {
    // Keep the canonical decimal dot for input[type=number]. Browsers reject "2,5" as a controlled numeric value.
    percentage: rule?.percentage == null ? '' : String(rule.percentage),
    minimum: toReais(rule?.minimumFeeCents ?? 0),
    maximum: rule?.maximumFeeCents == null ? '' : toReais(rule.maximumFeeCents),
    enabled: rule?.enabled !== false,
  };
}

function payload(draft: Draft) {
  return {
    percentage: Number(String(draft.percentage).replace(',', '.')),
    minimumFeeCents: toCents(draft.minimum),
    maximumFeeCents: draft.maximum.trim() ? toCents(draft.maximum) : null,
    enabled: draft.enabled,
  };
}

function toCents(value: string) {
  const raw = String(value || '').replace(/R\$/gi, '').replace(/\s/g, '');
  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  else if (raw.includes(',')) normalized = raw.replace(',', '.');
  return Math.max(0, Math.round((Number(normalized.replace(/[^0-9.]/g, '')) || 0) * 100));
}

function toReais(value: number) {
  return (Number(value || 0) / 100).toFixed(2).replace('.', ',');
}

function money(value: number) {
  return (Number(value || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number | null) {
  return value == null ? '—' : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
