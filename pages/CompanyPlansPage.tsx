import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  Check,
  Crown,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
  WalletCards,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { PaymentCheckoutModal } from '../components/payments/PaymentCheckoutModal';

type PlanId = 'FREE' | 'PLUS' | 'ELITE';
type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  effectivePriceCents?: number;
  originalPriceCents?: number;
  promotionalPriceCents?: number | null;
  promotionActive?: boolean;
  monthly: boolean;
  description: string;
  features: string[];
  current?: boolean;
  available?: boolean;
  includesEliteTrial?: boolean;
  eliteTrialDays?: number;
};
type Billing = {
  currency: 'BRL';
  plan: PlanId;
  planName: string;
  status: string;
  statusLabel: string;
  priceCents: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  nextChargeAt?: string | null;
  nextChargeCents?: number | null;
  cancelAtPeriodEnd: boolean;
  renewalEnabled: boolean;
  provider?: string | null;
  isTrial: boolean;
  trialEndsAt?: string | null;
  trialTargetPlan?: PlanId | null;
  hasPaidSubscription: boolean;
  latestCheckout?: null | {
    id?: string;
    status?: string | null;
    productName?: string | null;
    createdAt?: string | null;
    paidAt?: string | null;
    provider?: string | null;
  };
};
type PlansPayload = {
  company?: { id: string; name: string };
  current?: {
    plan: PlanId;
    basePlan?: PlanId;
    status: string;
    active: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
    isTrial?: boolean;
    trialEndsAt?: string | null;
    trialTargetPlan?: PlanId | null;
    advertisingEligible?: boolean;
    jobHighlightEligible?: boolean;
  };
  plans?: Plan[];
  trial?: {
    days: number;
    active: boolean;
    eligibleOnSubscription: boolean;
    used: boolean;
    restrictions?: string[];
  };
  billing?: Billing;
  scopes?: {
    recruitment?: { label: string; summary: string };
    marketplace?: { label: string; summary: string; photoLimit?: number; onlineSales?: boolean; auctionCreation?: boolean };
  };
  degraded?: boolean;
  warnings?: string[];
};

export function CompanyPlansPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<PlansPayload>({});
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [payer, setPayer] = useState({ name: '', document: '', email: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/company/plans');
      setData(response.data || {});
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os dados de assinatura da empresa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const billing = data.billing;
  const currentPlanId = billing?.plan || data.current?.basePlan || data.current?.plan || 'FREE';
  const currentPlan = useMemo(
    () => (data.plans || []).find((plan) => plan.id === currentPlanId) || null,
    [data.plans, currentPlanId],
  );
  const chosen = useMemo(
    () => (data.plans || []).find((plan) => plan.id === selected) || null,
    [data.plans, selected],
  );

  const createSubscriptionCheckout = () => {
    if (!selected || selected === 'FREE') throw new Error('Selecione um plano pago.');
    return api.post('/company/plans/checkout', {
      plan: selected,
      payer: {
        name: payer.name.trim() || undefined,
        document: payer.document.replace(/\D/g, '') || undefined,
        email: payer.email.trim() || undefined,
      },
    });
  };

  const setRenewal = async (renew: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      await api.patch('/company/plans/cancel-at-period-end', { enabled: !renew });
      setMessage(renew ? 'Renovação automática mantida.' : 'A renovação será encerrada ao final do período atual.');
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível alterar a renovação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando assinatura e planos...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">Empresa · Financeiro</p>
          <h1 className="mt-1 font-serif text-4xl font-black text-stone-950">Plano e cobrança</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Veja exatamente qual plano está ativo, quando acontece a próxima cobrança, quais recursos estão incluídos e o que muda ao trocar de plano.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" /> Atualizar dados</button>
      </header>

      {(error || message) && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
      {data.warnings?.map((warning) => <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">{warning}</div>)}

      <section className="overflow-hidden rounded-[30px] bg-[#172522] text-white shadow-xl">
        <div className="grid lg:grid-cols-[1.15fr_.85fr]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-white/70">{billing?.statusLabel || 'Plano gratuito'}</span>
              {billing?.isTrial && <span className="rounded-full bg-violet-400/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-violet-100">Elite temporário</span>}
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-white/40">Plano atual</p>
            <div className="mt-1 flex flex-wrap items-end gap-3"><h2 className="font-serif text-5xl font-black">{billing?.isTrial ? 'Elite' : currentPlan?.name || currentPlanId}</h2><p className="pb-1 text-sm font-bold text-white/50">{billing?.priceCents ? `${money(billing.priceCents)}/mês` : 'sem mensalidade'}</p></div>
            {billing?.isTrial && <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100/80">Você está usando recursos Elite durante o período gratuito. A assinatura-base é {billing.trialTargetPlan || currentPlanId}.</p>}
            {currentPlan?.description && <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">{currentPlan.description}</p>}
            {data.company?.name && <p className="mt-5 text-xs font-bold text-white/40">Assinatura vinculada a {data.company.name}</p>}
          </div>
          <div className="border-t border-white/10 bg-white/[.04] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">Próxima cobrança</p>
            <p className="mt-2 text-3xl font-black">{billing?.nextChargeAt ? money(billing.nextChargeCents || billing.priceCents) : 'Sem cobrança agendada'}</p>
            <p className="mt-2 text-sm text-white/55">{billing?.nextChargeAt ? formatDateLong(billing.nextChargeAt) : billing?.cancelAtPeriodEnd ? 'A renovação foi cancelada.' : currentPlanId === 'FREE' ? 'O plano Free não gera cobrança.' : 'Nenhuma cobrança futura está registrada.'}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <MiniInfo icon={<CalendarClock className="h-4 w-4" />} label="Período vigente" value={periodLabel(billing)} />
              <MiniInfo icon={<RefreshCw className="h-4 w-4" />} label="Renovação" value={billing?.renewalEnabled ? 'Automática' : billing?.cancelAtPeriodEnd ? 'Cancelada' : 'Não aplicável'} />
              <MiniInfo icon={<WalletCards className="h-4 w-4" />} label="Provedor" value={billing?.provider || 'Não aplicável'} />
              <MiniInfo icon={<ReceiptText className="h-4 w-4" />} label="Status" value={billing?.statusLabel || 'Gratuito'} />
            </div>
          </div>
        </div>
      </section>

      {billing?.hasPaidSubscription && (
        <section className="flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-stone-200 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-black text-stone-900">Renovação da assinatura</p><p className="mt-1 text-xs leading-5 text-stone-500">{billing.cancelAtPeriodEnd ? `Seu acesso pago permanece até ${formatDate(billing.periodEnd)} e depois volta ao Free.` : `A assinatura renova automaticamente em ${formatDate(billing.nextChargeAt || billing.periodEnd)}.`}</p></div>
          <button disabled={submitting} onClick={() => void setRenewal(Boolean(billing.cancelAtPeriodEnd))} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black ${billing.cancelAtPeriodEnd ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-700'}`}>{billing.cancelAtPeriodEnd ? 'Manter renovação' : 'Cancelar renovação'}</button>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <ScopeCard icon={<UsersRound className="h-5 w-5" />} eyebrow="Módulo" title="Recrutamento" description={data.scopes?.recruitment?.summary || 'Recursos empresariais para vagas, candidatos e operação pelo WhatsApp.'} items={currentPlan?.features || []} />
        <ScopeCard icon={<Store className="h-5 w-5" />} eyebrow="Módulo" title="Marketplace" description={data.scopes?.marketplace?.summary || 'Recursos empresariais para anúncios e vendas.'} items={[
          `Até ${data.scopes?.marketplace?.photoLimit || 10} fotos por anúncio empresarial`,
          data.scopes?.marketplace?.onlineSales ? 'Recebimento online pode ser habilitado pela empresa' : 'Venda direta por chat e oferta',
          data.scopes?.marketplace?.auctionCreation ? 'Criação de leilões liberada' : 'Leilões: criação disponível no Elite',
          'Taxas de intermediação de vendas e leilões seguem a regra vigente do plano ou contrato da empresa',
        ]} />
      </section>

      {billing?.latestCheckout && (
        <section className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500"><ReceiptText className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Último movimento de assinatura</p><p className="mt-1 text-sm font-black">{billing.latestCheckout.productName || 'Assinatura empresarial'} · {billing.latestCheckout.status || 'registrado'}</p><p className="mt-1 text-[10px] text-stone-400">Criado em {formatDateTime(billing.latestCheckout.createdAt)}{billing.latestCheckout.provider ? ` · ${billing.latestCheckout.provider}` : ''}</p></div></div>
        </section>
      )}

      <section>
        <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Comparar</p><h2 className="mt-1 font-serif text-3xl font-black">Todos os planos</h2><p className="mt-2 text-sm text-stone-500">Os preços abaixo são os valores vigentes configurados no PiraNegócios.</p></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {(data.plans || []).map((plan) => <PlanCard key={plan.id} plan={plan} currentPlanId={currentPlanId} isTrial={Boolean(billing?.isTrial)} trialTargetPlan={billing?.trialTargetPlan || null} onChoose={(id) => { setSelected(id); setMessage(''); setError(''); }} />)}
        </div>
      </section>

      <PaymentCheckoutModal
        open={Boolean(chosen && chosen.id !== 'FREE')}
        onClose={() => setSelected(null)}
        title={chosen ? `Assinar ${chosen.name}` : 'Nova assinatura'}
        description={chosen ? `${money(chosen.effectivePriceCents ?? chosen.priceCents)} por mês${chosen.includesEliteTrial ? ` · ${chosen.eliteTrialDays || 15} dias de Elite conforme elegibilidade` : ''}.` : undefined}
        amountCents={chosen?.effectivePriceCents ?? chosen?.priceCents ?? null}
        confirmLabel="Continuar assinatura"
        creatingLabel="Preparando autorização..."
        createCheckout={createSubscriptionCheckout}
        onCompleted={async () => {
          setSelected(null);
          setMessage('Assinatura confirmada. Plano e benefícios foram atualizados.');
          window.dispatchEvent(new Event('piranegocios:payment-completed'));
          await load();
        }}
      >
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Dados de cobrança</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Preencha apenas o necessário para a autorização. A cobrança recorrente é concluída no ambiente seguro do provedor.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="Nome do pagador" value={payer.name} onChange={(value) => setPayer((current) => ({ ...current, name: value }))} placeholder="Nome completo" />
            <Field label="CPF" value={payer.document} onChange={(value) => setPayer((current) => ({ ...current, document: value }))} placeholder="000.000.000-00" />
            <Field label="E-mail financeiro" value={payer.email} onChange={(value) => setPayer((current) => ({ ...current, email: value }))} placeholder="financeiro@empresa.com" />
          </div>
        </div>
      </PaymentCheckoutModal>
    </div>
  );
}

function PlanCard({ plan, currentPlanId, isTrial, trialTargetPlan, onChoose }: { plan: Plan; currentPlanId: PlanId; isTrial: boolean; trialTargetPlan: PlanId | null; onChoose: (id: PlanId) => void }) {
  const current = !isTrial && currentPlanId === plan.id;
  const trialBase = isTrial && trialTargetPlan === plan.id;
  const elite = plan.id === 'ELITE';
  return (
    <article className={`flex min-h-[500px] flex-col rounded-[28px] border p-6 ${elite ? 'border-violet-200 bg-gradient-to-b from-violet-50 to-white' : plan.id === 'PLUS' ? 'border-amber-200 bg-gradient-to-b from-amber-50 to-white' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${elite ? 'bg-violet-900 text-white' : plan.id === 'PLUS' ? 'bg-amber-400 text-stone-950' : 'bg-stone-100 text-stone-600'}`}>{elite ? <Crown className="h-5 w-5" /> : plan.id === 'PLUS' ? <Zap className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</span>{(current || trialBase) && <span className="rounded-full bg-stone-900 px-3 py-1 text-[9px] font-black uppercase text-white">{trialBase ? 'Assinatura-base' : 'Seu plano'}</span>}</div>
      <h3 className="mt-5 font-serif text-3xl font-black">{plan.name}</h3>
      <div className="mt-2 flex items-end gap-1"><span className="text-3xl font-black">{plan.priceCents ? money(plan.effectivePriceCents ?? plan.priceCents) : 'Grátis'}</span>{plan.monthly && <span className="pb-1 text-xs font-bold text-stone-400">/mês</span>}</div>
      {plan.promotionActive && plan.originalPriceCents && <p className="mt-1 text-xs font-bold text-stone-400 line-through">de {money(plan.originalPriceCents)}</p>}
      <p className="mt-3 text-sm leading-6 text-stone-500">{plan.description}</p>
      {plan.includesEliteTrial && <div className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700"><Sparkles className="mr-1 inline h-3.5 w-3.5" /> {plan.eliteTrialDays || 15} dias de Elite conforme elegibilidade</div>}
      <div className="my-5 h-px bg-stone-200" />
      <ul className="flex-1 space-y-2.5">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-xs leading-5 text-stone-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>)}</ul>
      <button disabled={current || trialBase || plan.id === 'FREE'} onClick={() => onChoose(plan.id)} className="mt-5 rounded-2xl bg-stone-950 px-4 py-3 text-xs font-black text-white disabled:bg-stone-100 disabled:text-stone-400">{current ? 'Plano atual' : trialBase ? 'Assinatura em período gratuito' : plan.id === 'FREE' ? 'Plano gratuito' : `Assinar ${plan.name}`}</button>
    </article>
  );
}

function ScopeCard({ icon, eyebrow, title, description, items }: { icon: React.ReactNode; eyebrow: string; title: string; description: string; items: string[] }) {
  return <article className="rounded-[26px] bg-white p-6 ring-1 ring-stone-200"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef8f6] text-[#397c75]">{icon}</span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">{eyebrow}</p><h2 className="mt-1 font-serif text-2xl font-black">{title}</h2></div></div><p className="mt-4 text-sm leading-6 text-stone-500">{description}</p><ul className="mt-5 space-y-2.5">{items.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-stone-600"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#397c75]" />{item}</li>)}</ul></article>;
}
function MiniInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl bg-white/[.06] p-3"><div className="flex items-center gap-2 text-white/45">{icon}<span className="text-[9px] font-black uppercase tracking-[.1em]">{label}</span></div><p className="mt-2 text-xs font-black text-white/85">{value}</p></div>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-xs font-black text-stone-500">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm font-semibold outline-none focus:border-stone-400" /></label>; }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100); }
function formatDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR') : '—'; }
function formatDateLong(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'; }
function formatDateTime(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function periodLabel(billing?: Billing) { if (!billing?.periodStart && !billing?.periodEnd) return billing?.isTrial ? 'Período gratuito' : 'Sem período'; return `${formatDate(billing.periodStart)} → ${formatDate(billing.periodEnd)}`; }
