import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Banknote,
  Building2,
  Check,
  CreditCard,
  Crown,
  Gavel,
  Loader2,
  RefreshCw,
  Repeat2,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';

type PlanKey = 'FREE' | 'PLUS' | 'ELITE';
type PurchaseMode = 'SUBSCRIPTION' | 'ONE_TIME';
type RuleKind = 'SALE' | 'AUCTION';
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
type RuleDraft = { percentage: string; minimum: string; maximum: string; enabled: boolean };
type CommercialDraft = {
  subscriptionEnabled: boolean;
  subscriptionPrice: string;
  oneTimeEnabled: boolean;
  oneTimePrice: string;
  preferredPurchaseMode: PurchaseMode;
  durationDays: number;
};
type ProviderRoute = {
  paymentType: 'PIX' | 'PIX_AUTOMATICO';
  enabled: boolean;
  providerCode?: string | null;
  providerName?: string | null;
};

const PLANS: PlanKey[] = ['FREE', 'PLUS', 'ELITE'];
const EMPTY_RULE: RuleDraft = { percentage: '', minimum: '0,00', maximum: '', enabled: true };
const PRODUCT_CODE: Partial<Record<PlanKey, string>> = {
  PLUS: 'COMPANY_PLUS_MONTHLY',
  ELITE: 'COMPANY_ELITE_MONTHLY',
};
const PLAN_META: Record<PlanKey, { label: string; eyebrow: string; description: string }> = {
  FREE: {
    label: 'Free',
    eyebrow: 'Entrada',
    description: 'Plano sem cobrança. As regras abaixo controlam apenas taxas transacionais dos Classificados.',
  },
  PLUS: {
    label: 'Plus',
    eyebrow: 'Empresarial',
    description: 'Plano empresarial intermediário com preço recorrente e avulso independentes.',
  },
  ELITE: {
    label: 'Elite',
    eyebrow: 'Empresarial premium',
    description: 'Plano empresarial completo, com condições comerciais próprias e taxas de marketplace configuráveis.',
  },
};

export default function AdminClassifiedCommercePage() {
  const [saleRules, setSaleRules] = useState<Rule[]>([]);
  const [auctionRules, setAuctionRules] = useState<Rule[]>([]);
  const [saleDrafts, setSaleDrafts] = useState<Record<string, RuleDraft>>({});
  const [auctionDrafts, setAuctionDrafts] = useState<Record<string, RuleDraft>>({});
  const [commercialDrafts, setCommercialDrafts] = useState<Record<string, CommercialDraft>>({});
  const [routes, setRoutes] = useState<ProviderRoute[]>([]);
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [saleCustom, setSaleCustom] = useState<RuleDraft>({ ...EMPTY_RULE });
  const [auctionCustom, setAuctionCustom] = useState<RuleDraft>({ ...EMPTY_RULE });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [sales, auctions, products, routeResponse] = await Promise.all([
        api.get('/admin/classifieds-commerce/fee-rules'),
        api.get('/admin/classifieds-commerce/auction-fee-rules'),
        api.get('/admin/payments/commercial-products'),
        api.get('/admin/payments/providers/routes'),
      ]);
      const sr = Array.isArray(sales.data) ? sales.data : [];
      const ar = Array.isArray(auctions.data) ? auctions.data : [];
      const ps = Array.isArray(products.data) ? products.data : [];
      setSaleRules(sr);
      setAuctionRules(ar);
      setRoutes(Array.isArray(routeResponse.data) ? routeResponse.data : []);
      setSaleDrafts(Object.fromEntries(PLANS.map((plan) => [plan, fromRule(sr.find((rule: Rule) => rule.scope === 'PLAN' && rule.plan === plan))])));
      setAuctionDrafts(Object.fromEntries(PLANS.map((plan) => [plan, fromRule(ar.find((rule: Rule) => rule.scope === 'PLAN' && rule.plan === plan), '0,99')])));

      const byCode = new Map(ps.map((product: any) => [product.code, product]));
      const nextCommercial: Record<string, CommercialDraft> = {};
      for (const plan of ['PLUS', 'ELITE'] as PlanKey[]) {
        const product = byCode.get(PRODUCT_CODE[plan]) as any;
        const subscriptionEnabled = product?.subscriptionPriceCents !== null && product?.subscriptionPriceCents !== undefined;
        const oneTimeEnabled = product?.oneTimePriceCents !== null && product?.oneTimePriceCents !== undefined;
        nextCommercial[plan] = {
          subscriptionEnabled,
          subscriptionPrice: toReais(product?.subscriptionPriceCents || 0),
          oneTimeEnabled,
          oneTimePrice: toReais(product?.oneTimePriceCents || 0),
          preferredPurchaseMode: product?.preferredPurchaseMode === 'ONE_TIME' ? 'ONE_TIME' : 'SUBSCRIPTION',
          durationDays: Math.max(1, Number(product?.durationDays || 30)),
        };
      }
      setCommercialDrafts(nextCommercial);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar a central de monetização.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCompanies([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api.get(`/admin/classifieds-commerce/companies?q=${encodeURIComponent(q)}`)
        .then((response) => setCompanies(Array.isArray(response.data) ? response.data : []))
        .catch(() => setCompanies([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const routeFor = (paymentType: ProviderRoute['paymentType']) => routes.find((route) => route.paymentType === paymentType);

  const setCommercialMode = (plan: PlanKey, mode: PurchaseMode, enabled: boolean) => {
    setCommercialDrafts((current) => {
      const draft = current[plan];
      if (!draft) return current;
      const next = {
        ...draft,
        ...(mode === 'SUBSCRIPTION' ? { subscriptionEnabled: enabled } : { oneTimeEnabled: enabled }),
      };
      if (!enabled && next.preferredPurchaseMode === mode) {
        if (mode === 'SUBSCRIPTION' && next.oneTimeEnabled) next.preferredPurchaseMode = 'ONE_TIME';
        if (mode === 'ONE_TIME' && next.subscriptionEnabled) next.preferredPurchaseMode = 'SUBSCRIPTION';
      }
      return { ...current, [plan]: next };
    });
  };

  const patchCommercial = (plan: PlanKey, patch: Partial<CommercialDraft>) => {
    setCommercialDrafts((current) => ({
      ...current,
      [plan]: { ...current[plan], ...patch },
    }));
  };

  const savePlan = async (plan: PlanKey) => {
    const sale = saleDrafts[plan] || { ...EMPTY_RULE };
    const auction = auctionDrafts[plan] || { ...EMPTY_RULE, percentage: '0,99' };
    const commercial = commercialDrafts[plan];
    setWorking(`plan-${plan}`);
    setMessage('');
    setError('');
    try {
      const requests: Promise<any>[] = [
        api.patch(`/admin/classifieds-commerce/fee-rules/plans/${plan}`, rulePayload(sale)),
        api.patch(`/admin/classifieds-commerce/auction-fee-rules/plans/${plan}`, rulePayload(auction)),
      ];

      if (PRODUCT_CODE[plan] && commercial) {
        const subscriptionPriceCents = commercial.subscriptionEnabled ? toCents(commercial.subscriptionPrice) : null;
        const oneTimePriceCents = commercial.oneTimeEnabled ? toCents(commercial.oneTimePrice) : null;
        if (subscriptionPriceCents === null && oneTimePriceCents === null) {
          throw new Error(`O plano ${PLAN_META[plan].label} precisa ter assinatura, compra avulsa ou as duas modalidades ativas.`);
        }
        if (subscriptionPriceCents !== null && subscriptionPriceCents <= 0) {
          throw new Error('Informe um valor maior que zero para a assinatura.');
        }
        if (oneTimePriceCents !== null && oneTimePriceCents <= 0) {
          throw new Error('Informe um valor maior que zero para a compra avulsa.');
        }
        const preferredPurchaseMode = commercial.preferredPurchaseMode === 'ONE_TIME' && oneTimePriceCents !== null
          ? 'ONE_TIME'
          : subscriptionPriceCents !== null
            ? 'SUBSCRIPTION'
            : 'ONE_TIME';
        requests.push(api.patch(`/admin/payments/commercial-products/${PRODUCT_CODE[plan]}`, {
          subscriptionPriceCents,
          oneTimePriceCents,
          preferredPurchaseMode,
        }));
        requests.push(api.patch(`/admin/payments/products/${PRODUCT_CODE[plan]}/duration`, {
          durationDays: Math.max(1, Number(commercial.durationDays || 30)),
        }));
      }

      await Promise.all(requests);
      setMessage(`${PLAN_META[plan].label}: preços, modalidades e taxas atualizados.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Não foi possível salvar o plano.');
    } finally {
      setWorking('');
    }
  };

  const choose = (company: any) => {
    setSelected(company);
    setQuery(company.name || '');
    setCompanies([]);
    setSaleCustom(fromRule(saleRules.find((rule) => rule.scope === 'COMPANY' && rule.companyId === company.id)));
    setAuctionCustom(fromRule(auctionRules.find((rule) => rule.scope === 'COMPANY' && rule.companyId === company.id), '0,99'));
  };

  const saveCustom = async (kind: RuleKind) => {
    if (!selected) return;
    setWorking(`${kind}-company`);
    setMessage('');
    setError('');
    try {
      const base = kind === 'SALE' ? 'fee-rules' : 'auction-fee-rules';
      const draft = kind === 'SALE' ? saleCustom : auctionCustom;
      await api.patch(`/admin/classifieds-commerce/${base}/companies/${selected.id}`, rulePayload(draft));
      setMessage(`${kind === 'SALE' ? 'Comissão de venda' : 'Taxa de leilão'} custom de ${selected.name} salva.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível salvar a regra custom.');
    } finally {
      setWorking('');
    }
  };

  const removeCustom = async (kind: RuleKind, rule: Rule) => {
    if (!rule.companyId || !window.confirm(`Remover a regra custom de ${rule.companyName || 'esta empresa'}?`)) return;
    setWorking(`delete-${kind}-${rule.companyId}`);
    try {
      const base = kind === 'SALE' ? 'fee-rules' : 'auction-fee-rules';
      await api.delete(`/admin/classifieds-commerce/${base}/companies/${rule.companyId}`);
      setMessage('Regra custom removida.');
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível remover a regra custom.');
    } finally {
      setWorking('');
    }
  };

  const saleCustoms = useMemo(() => saleRules.filter((rule) => rule.scope === 'COMPANY'), [saleRules]);
  const auctionCustoms = useMemo(() => auctionRules.filter((rule) => rule.scope === 'COMPANY'), [auctionRules]);
  const pixRoute = routeFor('PIX');
  const automaticRoute = routeFor('PIX_AUTOMATICO');

  if (loading && !Object.keys(saleDrafts).length) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="overflow-hidden rounded-[34px] bg-[#181815] text-white shadow-[0_24px_70px_rgba(28,25,20,.18)]">
        <div className="grid lg:grid-cols-[1.3fr_.7fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#c96847]/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.18em] text-[#f3b79f]">Financeiro</span>
              <span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.16em] text-white/45">Centro de monetização</span>
            </div>
            <h1 className="mt-5 max-w-4xl font-serif text-4xl font-black tracking-tight sm:text-5xl">Planos, preços e taxas em um só lugar.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/55">Configure o que a empresa paga pelo plano e o que o PiraNegócios cobra nas transações dos Classificados. Assinatura, compra avulsa, comissão de venda e taxa de leilão são controles independentes.</p>
            <div className="mt-7 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[.12em] text-white/60">
              <span className="rounded-xl bg-white/[.06] px-3 py-2">Planos empresariais</span>
              <span className="rounded-xl bg-white/[.06] px-3 py-2">Classificados</span>
              <span className="rounded-xl bg-white/[.06] px-3 py-2">Contratos custom</span>
            </div>
          </div>
          <div className="border-t border-white/[.08] bg-white/[.035] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/30">Roteamento atual</p>
            <div className="mt-4 space-y-3">
              <GatewayStatus icon={<Repeat2 className="h-4 w-4" />} label="Pix Automático" provider={automaticRoute?.enabled ? automaticRoute.providerName || automaticRoute.providerCode : null} />
              <GatewayStatus icon={<Banknote className="h-4 w-4" />} label="Pix avulso" provider={pixRoute?.enabled ? pixRoute.providerName || pixRoute.providerCode : null} />
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-xs font-black text-stone-950 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar central</button>
          </div>
        </div>
      </section>

      {(message || error) && <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || message}</div>}

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#c96847]">Planos empresariais + Classificados</p>
            <h2 className="mt-1 font-serif text-3xl font-black text-stone-950">Configuração por plano</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Cada card concentra tudo que pertence ao plano. Não é mais necessário caçar mensalidade em uma seção e taxa em outra.</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-500 shadow-sm"><strong className="text-stone-800">Regra:</strong> desligar avulso não desliga recorrente, e vice-versa.</div>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanMonetizationCard
              key={plan}
              plan={plan}
              commercial={commercialDrafts[plan]}
              sale={saleDrafts[plan] || { ...EMPTY_RULE }}
              auction={auctionDrafts[plan] || { ...EMPTY_RULE, percentage: '0,99' }}
              automaticProvider={automaticRoute?.enabled ? automaticRoute.providerName || automaticRoute.providerCode || null : null}
              pixProvider={pixRoute?.enabled ? pixRoute.providerName || pixRoute.providerCode || null : null}
              onCommercialPatch={(patch) => patchCommercial(plan, patch)}
              onModeEnabled={(mode, enabled) => setCommercialMode(plan, mode, enabled)}
              onSaleChange={(draft) => setSaleDrafts((current) => ({ ...current, [plan]: draft }))}
              onAuctionChange={(draft) => setAuctionDrafts((current) => ({ ...current, [plan]: draft }))}
              onSave={() => void savePlan(plan)}
              saving={working === `plan-${plan}`}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-[30px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Building2 className="h-5 w-5" /></span>
            <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Exceções comerciais</p><h2 className="mt-1 text-xl font-black text-stone-950">Contrato custom por empresa</h2><p className="mt-1 text-xs leading-5 text-stone-500">A empresa pode ter condições específicas para venda online e leilão, substituindo a regra padrão do plano.</p></div>
          </div>

          <label className="relative mt-5 block"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); if (selected && event.target.value !== selected.name) setSelected(null); }} placeholder="Buscar empresa por nome ou CNPJ" className="h-12 w-full rounded-2xl bg-stone-50 pl-11 pr-4 text-sm font-semibold outline-none ring-1 ring-stone-200 focus:ring-violet-300" /></label>
          {companies.length > 0 && <div className="mt-2 max-h-56 overflow-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-xl">{companies.map((company) => <button key={company.id} onClick={() => choose(company)} className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-stone-50"><p className="text-sm font-black text-stone-900">{company.name}</p><p className="text-[10px] text-stone-400">{company.city ? `${company.city}/${company.state || ''}` : 'Local não informado'}</p></button>)}</div>}
          {selected ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><CustomBox title="Venda online" icon={<ShoppingCart className="h-4 w-4" />} draft={saleCustom} onChange={setSaleCustom} onSave={() => void saveCustom('SALE')} saving={working === 'SALE-company'} /><CustomBox title="Leilão" icon={<Gavel className="h-4 w-4" />} draft={auctionCustom} onChange={setAuctionCustom} onSave={() => void saveCustom('AUCTION')} saving={working === 'AUCTION-company'} /></div> : <div className="mt-5 rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-5 text-center text-xs leading-5 text-stone-400">Busque e selecione uma empresa para criar ou alterar condições especiais.</div>}
        </div>

        <div className="rounded-[30px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><BadgeDollarSign className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">Contratos ativos</p><h2 className="mt-1 text-xl font-black text-stone-950">Regras customizadas</h2><p className="mt-1 text-xs leading-5 text-stone-500">Visão rápida de empresas que já fogem da tabela padrão.</p></div></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2"><CustomList title="Venda online" kind="SALE" rows={saleCustoms} onEdit={(rule) => choose({ id: rule.companyId, name: rule.companyName || rule.companyId })} onDelete={removeCustom} /><CustomList title="Leilão" kind="AUCTION" rows={auctionCustoms} onEdit={(rule) => choose({ id: rule.companyId, name: rule.companyName || rule.companyId })} onDelete={removeCustom} /></div>
        </div>
      </section>

      <section className="rounded-[26px] border border-sky-200 bg-sky-50 p-5 text-xs leading-6 text-sky-950">
        <strong>Mapa financeiro:</strong> preço da assinatura e preço avulso pertencem ao plano empresarial. Comissão de venda e taxa de leilão pertencem ao módulo Classificados. Uma empresa com contrato custom substitui apenas as taxas transacionais configuradas para ela.
      </section>
    </div>
  );
}

function PlanMonetizationCard({
  plan,
  commercial,
  sale,
  auction,
  automaticProvider,
  pixProvider,
  onCommercialPatch,
  onModeEnabled,
  onSaleChange,
  onAuctionChange,
  onSave,
  saving,
}: {
  plan: PlanKey;
  commercial?: CommercialDraft;
  sale: RuleDraft;
  auction: RuleDraft;
  automaticProvider: string | null;
  pixProvider: string | null;
  onCommercialPatch: (patch: Partial<CommercialDraft>) => void;
  onModeEnabled: (mode: PurchaseMode, enabled: boolean) => void;
  onSaleChange: (draft: RuleDraft) => void;
  onAuctionChange: (draft: RuleDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const meta = PLAN_META[plan];
  const elite = plan === 'ELITE';
  const plus = plan === 'PLUS';
  return (
    <article className={`overflow-hidden rounded-[30px] border bg-white shadow-sm ${elite ? 'border-violet-200' : plus ? 'border-amber-200' : 'border-stone-200'}`}>
      <div className={`p-5 sm:p-6 ${elite ? 'bg-gradient-to-br from-violet-950 to-violet-800 text-white' : plus ? 'bg-gradient-to-br from-amber-300 to-amber-100 text-stone-950' : 'bg-gradient-to-br from-stone-900 to-stone-700 text-white'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${elite ? 'bg-white/10' : plus ? 'bg-white/50' : 'bg-white/10'}`}>{elite ? <Crown className="h-5 w-5" /> : plus ? <Zap className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</span>
            <div><p className={`text-[9px] font-black uppercase tracking-[.16em] ${plus ? 'text-stone-700/60' : 'text-white/45'}`}>{meta.eyebrow}</p><h3 className="mt-0.5 font-serif text-3xl font-black">{meta.label}</h3></div>
          </div>
          {commercial && <span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase ${elite ? 'bg-white/10 text-white/70' : 'bg-white/60 text-stone-700'}`}>{commercial.preferredPurchaseMode === 'SUBSCRIPTION' ? 'Assinatura em destaque' : 'Avulso em destaque'}</span>}
        </div>
        <p className={`mt-4 text-xs leading-5 ${plus ? 'text-stone-700/75' : 'text-white/55'}`}>{meta.description}</p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {plan !== 'FREE' && commercial ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#c96847]">Preço do plano</p><h4 className="mt-1 text-sm font-black text-stone-950">Formas de contratação</h4></div><label className="text-right"><span className="block text-[8px] font-black uppercase tracking-[.1em] text-stone-400">Período</span><div className="mt-1 flex items-center gap-1"><input type="number" min={1} value={commercial.durationDays} onChange={(event) => onCommercialPatch({ durationDays: Math.max(1, Number(event.target.value || 30)) })} className="h-9 w-16 rounded-xl border border-stone-200 bg-stone-50 px-2 text-center text-xs font-black outline-none" /><span className="text-[10px] font-bold text-stone-400">dias</span></div></label></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <PaymentModeBox
                icon={<Repeat2 className="h-4 w-4" />}
                title="Pix Automático"
                caption="Assinatura recorrente"
                provider={automaticProvider}
                enabled={commercial.subscriptionEnabled}
                price={commercial.subscriptionPrice}
                preferred={commercial.preferredPurchaseMode === 'SUBSCRIPTION'}
                onEnabled={(enabled) => onModeEnabled('SUBSCRIPTION', enabled)}
                onPrice={(value) => onCommercialPatch({ subscriptionPrice: value })}
                onPrefer={() => onCommercialPatch({ preferredPurchaseMode: 'SUBSCRIPTION' })}
              />
              <PaymentModeBox
                icon={<Banknote className="h-4 w-4" />}
                title="Pix avulso"
                caption="Pagamento único"
                provider={pixProvider}
                enabled={commercial.oneTimeEnabled}
                price={commercial.oneTimePrice}
                preferred={commercial.preferredPurchaseMode === 'ONE_TIME'}
                onEnabled={(enabled) => onModeEnabled('ONE_TIME', enabled)}
                onPrice={(value) => onCommercialPatch({ oneTimePrice: value })}
                onPrefer={() => onCommercialPatch({ preferredPurchaseMode: 'ONE_TIME' })}
              />
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-stone-400" /><p className="text-xs font-black text-stone-800">Sem cobrança pelo plano</p></div><p className="mt-1 text-[10px] leading-4 text-stone-500">Free não possui assinatura nem compra avulsa.</p></div>
        )}

        <div className="h-px bg-stone-100" />

        <section>
          <div className="mb-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-700">Classificados</p><h4 className="mt-1 text-sm font-black text-stone-950">Taxas transacionais</h4></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <FeeBox icon={<ShoppingCart className="h-4 w-4" />} title="Venda online" draft={sale} onChange={onSaleChange} />
            <FeeBox icon={<Gavel className="h-4 w-4" />} title="Leilão" draft={auction} onChange={onAuctionChange} />
          </div>
        </section>

        <button onClick={onSave} disabled={saving} className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition disabled:opacity-50 ${elite ? 'bg-violet-800 hover:bg-violet-900' : plus ? 'bg-stone-950 hover:bg-black' : 'bg-stone-800 hover:bg-stone-950'}`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar configuração do {meta.label}</button>
      </div>
    </article>
  );
}

function PaymentModeBox({ icon, title, caption, provider, enabled, price, preferred, onEnabled, onPrice, onPrefer }: { icon: React.ReactNode; title: string; caption: string; provider: string | null; enabled: boolean; price: string; preferred: boolean; onEnabled: (enabled: boolean) => void; onPrice: (value: string) => void; onPrefer: () => void }) {
  return <div className={`rounded-2xl border p-4 transition ${enabled ? preferred ? 'border-violet-300 bg-violet-50' : 'border-emerald-200 bg-emerald-50/40' : 'border-stone-200 bg-stone-50'}`}><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl ${enabled ? 'bg-white text-stone-800 shadow-sm' : 'bg-stone-200 text-stone-400'}`}>{icon}</span><div><p className="text-xs font-black text-stone-950">{title}</p><p className="mt-0.5 text-[9px] text-stone-500">{caption}</p></div></div><Switch checked={enabled} onChange={onEnabled} label={`Ativar ${title}`} /></div><div className="mt-3"><MoneyInput label="Valor" value={price} setValue={onPrice} disabled={!enabled} /></div><div className="mt-3 flex items-center justify-between gap-2"><span className={`truncate text-[9px] font-bold ${provider ? 'text-emerald-700' : 'text-amber-700'}`}>{provider ? `Gateway: ${provider}` : 'Gateway não configurado'}</span><button type="button" disabled={!enabled} onClick={onPrefer} className={`shrink-0 rounded-lg px-2 py-1 text-[8px] font-black uppercase ${preferred ? 'bg-violet-700 text-white' : 'bg-white text-stone-500 ring-1 ring-stone-200'} disabled:opacity-40`}>{preferred ? 'Principal' : 'Destacar'}</button></div></div>;
}

function FeeBox({ icon, title, draft, onChange }: { icon: React.ReactNode; title: string; draft: RuleDraft; onChange: (draft: RuleDraft) => void }) {
  const patch = (key: keyof RuleDraft, value: any) => onChange({ ...draft, [key]: value });
  return <div className={`rounded-2xl border p-4 ${draft.enabled ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50 opacity-75'}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-600">{icon}</span><div><p className="text-xs font-black text-stone-950">{title}</p><p className="text-[9px] text-stone-400">Taxa dos Classificados</p></div></div><Switch checked={draft.enabled} onChange={(enabled) => patch('enabled', enabled)} label={`Ativar taxa de ${title}`} /></div><div className="mt-3 grid grid-cols-2 gap-2"><Field label="Percentual (%)"><input value={draft.percentage} disabled={!draft.enabled} onChange={(event) => patch('percentage', event.target.value)} inputMode="decimal" className={inputClass} /></Field><MoneyInput label="Mínimo" value={draft.minimum} setValue={(value) => patch('minimum', value)} disabled={!draft.enabled} /><div className="col-span-2"><MoneyInput label="Teto opcional" value={draft.maximum} setValue={(value) => patch('maximum', value)} disabled={!draft.enabled} /></div></div></div>;
}

function GatewayStatus({ icon, label, provider }: { icon: React.ReactNode; label: string; provider: string | null }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3.5"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${provider ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>{icon}</span><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.12em] text-white/35">{label}</p><p className="mt-1 truncate text-xs font-black text-white/85">{provider || 'Não configurado'}</p></div>{provider && <Check className="h-4 w-4 text-emerald-300" />}</div>;
}

function CustomBox({ title, icon, draft, onChange, onSave, saving }: { title: string; icon: React.ReactNode; draft: RuleDraft; onChange: (draft: RuleDraft) => void; onSave: () => void; saving: boolean }) {
  return <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">{icon}</span><p className="text-xs font-black text-stone-950">{title}</p></div><RuleFields draft={draft} onChange={onChange} /><button onClick={onSave} disabled={saving} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 text-xs font-black text-white disabled:opacity-50">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{saving ? 'Salvando...' : 'Salvar condição'}</button></div>;
}

function CustomList({ title, kind, rows, onEdit, onDelete }: { title: string; kind: RuleKind; rows: Rule[]; onEdit: (rule: Rule) => void; onDelete: (kind: RuleKind, rule: Rule) => void }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">{title}</p>{rows.length ? <div className="mt-2 space-y-2">{rows.map((rule) => <div key={rule.id} className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-stone-900">{rule.companyName || rule.companyId}</p><p className="mt-1 text-[9px] text-stone-500">{formatPercent(rule.percentage)}% · mín. {money(rule.minimumFeeCents)} · {rule.maximumFeeCents == null ? 'sem teto' : `teto ${money(rule.maximumFeeCents)}`}</p></div><button onClick={() => onEdit(rule)} className="rounded-xl bg-white px-3 py-2 text-[9px] font-black text-stone-600 ring-1 ring-stone-200">Editar</button><button onClick={() => onDelete(kind, rule)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <p className="mt-3 rounded-xl bg-stone-50 p-3 text-[10px] text-stone-400">Nenhuma regra custom.</p>}</div>;
}

function RuleFields({ draft, onChange }: { draft: RuleDraft; onChange: (draft: RuleDraft) => void }) {
  const patch = (key: keyof RuleDraft, value: any) => onChange({ ...draft, [key]: value });
  return <div className="mt-4 grid grid-cols-2 gap-3"><Field label="Percentual (%)"><input value={draft.percentage} onChange={(event) => patch('percentage', event.target.value)} inputMode="decimal" className={inputClass} /></Field><Field label="Ativa"><button type="button" onClick={() => patch('enabled', !draft.enabled)} className={`h-11 w-full rounded-xl text-xs font-black ${draft.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-500'}`}>{draft.enabled ? 'Sim' : 'Não'}</button></Field><MoneyInput label="Mínimo" value={draft.minimum} setValue={(value) => patch('minimum', value)} /><MoneyInput label="Teto opcional" value={draft.maximum} setValue={(value) => patch('maximum', value)} /></div>;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-stone-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} /></button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span>{children}</label>;
}

function MoneyInput({ label, value, setValue, disabled = false }: { label: string; value: string; setValue: (value: string) => void; disabled?: boolean }) {
  return <Field label={label}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-400">R$</span><input value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} inputMode="decimal" className={`${inputClass} pl-9 disabled:bg-stone-100 disabled:text-stone-400`} /></div></Field>;
}

const inputClass = 'h-11 w-full rounded-xl bg-white px-3 text-sm font-bold outline-none ring-1 ring-stone-200 focus:ring-[#c96847]/40 disabled:bg-stone-100 disabled:text-stone-400';

function fromRule(rule?: Rule, fallback = ''): RuleDraft {
  return rule
    ? { percentage: String(rule.percentage ?? '').replace('.', ','), minimum: toReais(rule.minimumFeeCents), maximum: rule.maximumFeeCents == null ? '' : toReais(rule.maximumFeeCents), enabled: rule.enabled }
    : { ...EMPTY_RULE, percentage: fallback };
}

function rulePayload(draft: RuleDraft) {
  return {
    percentage: draft.percentage,
    minimumFeeCents: toCents(draft.minimum),
    maximumFeeCents: draft.maximum.trim() === '' ? null : toCents(draft.maximum),
    enabled: draft.enabled,
  };
}

function toCents(value: string) {
  const raw = String(value || '0').replace(/R\$/gi, '').replace(/\s/g, '').trim();
  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  else if (raw.includes(',')) normalized = raw.replace(',', '.');
  normalized = normalized.replace(/[^0-9.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}
function toReais(cents: number) { return (Number(cents || 0) / 100).toFixed(2).replace('.', ','); }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100); }
function formatPercent(value: number | null) { return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
