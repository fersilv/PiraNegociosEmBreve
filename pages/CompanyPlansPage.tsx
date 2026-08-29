import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  Check,
  CircleMinus,
  Crown,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { PaymentCheckoutModal } from '../components/payments/PaymentCheckoutModal';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import {
  cleanPaymentDocument,
  forgetRememberedPayerDocument,
  isValidPaymentDocumentLength,
  loadRememberedPayerDocument,
  paymentDocumentPlaceholder,
  saveRememberedPayerDocument,
  type PaymentDocumentType,
} from '../lib/paymentPayer';

type PlanId = 'FREE' | 'PLUS' | 'ELITE';
type PurchaseMode = 'SUBSCRIPTION' | 'ONE_TIME';
type Benefit = {
  id: string;
  label: string;
  description?: string;
  category?: 'WHATSAPP' | 'VISIBILITY';
};
type Offer = {
  mode?: PurchaseMode;
  enabled?: boolean;
  available?: boolean;
  priceCents?: number | null;
  effectivePriceCents?: number | null;
  promotionActive?: boolean;
  paymentType?: 'PIX' | 'PIX_AUTOMATICO';
  recommended?: boolean;
  benefitIds?: string[];
  benefits?: Benefit[];
  lostComparedToSubscription?: Benefit[];
  unavailableReason?: string | null;
};
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
  productCode?: string;
  preferredPurchaseMode?: PurchaseMode;
  durationDays?: number | null;
  offers?: {
    subscription?: Offer;
    oneTime?: Offer;
  } | null;
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
  isTrial: boolean;
  trialEndsAt?: string | null;
  trialTargetPlan?: PlanId | null;
  hasPaidSubscription: boolean;
  hasRecurringSubscription?: boolean;
  purchaseMode?: PurchaseMode | null;
  latestCheckout?: null | {
    id?: string;
    status?: string | null;
    productName?: string | null;
    createdAt?: string | null;
    paidAt?: string | null;
    purchaseMode?: PurchaseMode | null;
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
    purchaseMode?: PurchaseMode | null;
    benefits?: Benefit[];
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

type Selection = { planId: PlanId; purchaseMode: PurchaseMode } | null;

export function CompanyPlansPage() {
  const { profile, user } = useAuth();
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<PlansPayload>({});
  const [selection, setSelection] = useState<Selection>(null);
  const [payer, setPayer] = useState({ name: '', document: '', email: '', documentType: 'CPF' as PaymentDocumentType });
  const [rememberDocument, setRememberDocument] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get('/company/plans');
      const next = response.data || {};
      setData(next);
      if (Array.isArray(next.warnings)) {
        next.warnings.forEach((warning: string) => toast(warning, 'warning'));
      }
    } catch (requestError: any) {
      toast(requestError?.response?.data?.message || 'Não foi possível carregar os dados do plano da empresa.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const accountName = String(profile?.fullName || profile?.displayName || profile?.name || '').trim();
    const accountEmail = String(profile?.email || user?.email || '').trim();
    const remembered = loadRememberedPayerDocument();
    setPayer((current) => ({
      ...current,
      name: current.name || accountName,
      email: current.email || accountEmail,
      document: current.document || remembered?.document || '',
      documentType: current.document ? current.documentType : remembered?.type || current.documentType,
    }));
    setRememberDocument(Boolean(remembered));
  }, [profile?.displayName, profile?.email, profile?.fullName, profile?.name, user?.email]);

  const billing = data.billing;
  const currentPlanId = billing?.plan || data.current?.basePlan || data.current?.plan || 'FREE';
  const currentPlan = useMemo(
    () => (data.plans || []).find((plan) => plan.id === currentPlanId) || null,
    [data.plans, currentPlanId],
  );
  const chosen = useMemo(
    () => (data.plans || []).find((plan) => plan.id === selection?.planId) || null,
    [data.plans, selection?.planId],
  );
  const chosenOffer = selection?.purchaseMode === 'ONE_TIME'
    ? chosen?.offers?.oneTime
    : chosen?.offers?.subscription;

  const choose = (planId: PlanId, purchaseMode: PurchaseMode) => {
    setSelection({ planId, purchaseMode });
  };

  const createCheckout = () => {
    if (!selection || selection.planId === 'FREE') throw new Error('Selecione um plano pago.');
    const name = payer.name.trim();
    const email = payer.email.trim();
    const document = cleanPaymentDocument(payer.document);
    if (name.length < 3) throw new Error('Informe o nome completo do pagador.');
    if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido para a cobrança.');
    if (!isValidPaymentDocumentLength(payer.documentType, document)) {
      throw new Error(`Informe um ${payer.documentType} válido com ${payer.documentType === 'CNPJ' ? 14 : 11} dígitos.`);
    }
    if (rememberDocument) saveRememberedPayerDocument(payer.documentType, document);
    else forgetRememberedPayerDocument();
    return api.post('/company/plans/checkout', {
      plan: selection.planId,
      purchaseMode: selection.purchaseMode,
      payer: {
        name,
        document,
        documentType: payer.documentType,
        email,
      },
    });
  };

  const setRenewal = async (renew: boolean) => {
    if (submitting || billing?.purchaseMode === 'ONE_TIME') return;
    setSubmitting(true);
    try {
      await api.patch('/company/plans/cancel-at-period-end', { enabled: !renew });
      toast(renew ? 'Renovação automática mantida.' : 'A renovação será encerrada ao final do período atual.', 'success');
      await load();
    } catch (requestError: any) {
      toast(requestError?.response?.data?.message || 'Não foi possível alterar a renovação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando planos e formas de compra...</div>;
  }

  const currentBenefits = data.current?.benefits?.map((benefit) => benefit.label) || currentPlan?.features || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">Empresa · Financeiro</p>
          <h1 className="mt-1 font-serif text-4xl font-black text-stone-950">Plano e cobrança</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Escolha entre assinatura com renovação automática ou compra avulsa por período. A assinatura pode incluir benefícios exclusivos.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" /> Atualizar dados</button>
      </header>

      <section className="overflow-hidden rounded-[30px] bg-[#172522] text-white shadow-xl">
        <div className="grid lg:grid-cols-[1.15fr_.85fr]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-white/70">{billing?.statusLabel || 'Plano gratuito'}</span>
              {billing?.purchaseMode === 'ONE_TIME' && <span className="rounded-full bg-emerald-300/15 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-emerald-100">Compra avulsa</span>}
              {billing?.purchaseMode === 'SUBSCRIPTION' && <span className="rounded-full bg-violet-300/15 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-violet-100">Assinatura</span>}
              {billing?.isTrial && <span className="rounded-full bg-violet-400/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-violet-100">Elite temporário</span>}
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-white/40">Plano atual</p>
            <div className="mt-1 flex flex-wrap items-end gap-3"><h2 className="font-serif text-5xl font-black">{billing?.isTrial ? 'Elite' : currentPlan?.name || currentPlanId}</h2><p className="pb-1 text-sm font-bold text-white/50">{billing?.purchaseMode === 'ONE_TIME' ? 'acesso por período' : billing?.priceCents ? `${money(billing.priceCents)}/período` : 'sem mensalidade'}</p></div>
            {billing?.isTrial && <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100/80">Você está usando recursos Elite durante o período gratuito. A assinatura-base é {billing.trialTargetPlan || currentPlanId}.</p>}
            {currentPlan?.description && <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">{currentPlan.description}</p>}
            {data.company?.name && <p className="mt-5 text-xs font-bold text-white/40">Acesso vinculado a {data.company.name}</p>}
          </div>
          <div className="border-t border-white/10 bg-white/[.04] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">{billing?.purchaseMode === 'ONE_TIME' ? 'Acesso válido até' : 'Próxima cobrança'}</p>
            <p className="mt-2 text-3xl font-black">{billing?.purchaseMode === 'ONE_TIME' ? formatDateLong(billing.periodEnd) : billing?.nextChargeAt ? money(billing.nextChargeCents || billing.priceCents) : 'Sem cobrança agendada'}</p>
            <p className="mt-2 text-sm text-white/55">{billing?.purchaseMode === 'ONE_TIME' ? 'Não existe renovação automática nesta compra.' : billing?.nextChargeAt ? formatDateLong(billing.nextChargeAt) : billing?.cancelAtPeriodEnd ? 'A renovação foi cancelada.' : currentPlanId === 'FREE' ? 'O plano Free não gera cobrança.' : 'Nenhuma cobrança futura está registrada.'}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <MiniInfo icon={<CalendarClock className="h-4 w-4" />} label="Período vigente" value={periodLabel(billing)} />
              <MiniInfo icon={<RefreshCw className="h-4 w-4" />} label="Renovação" value={billing?.purchaseMode === 'ONE_TIME' ? 'Não renova' : billing?.renewalEnabled ? 'Automática' : billing?.cancelAtPeriodEnd ? 'Cancelada' : 'Não aplicável'} />
              <MiniInfo icon={<ReceiptText className="h-4 w-4" />} label="Modalidade" value={billing?.purchaseMode === 'ONE_TIME' ? 'Compra avulsa' : billing?.purchaseMode === 'SUBSCRIPTION' ? 'Assinatura' : 'Gratuito'} />
              <MiniInfo icon={<BadgeCheck className="h-4 w-4" />} label="Status" value={billing?.statusLabel || 'Gratuito'} />
            </div>
          </div>
        </div>
      </section>

      {billing?.hasRecurringSubscription && (
        <section className="flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-stone-200 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-black text-stone-900">Renovação da assinatura</p><p className="mt-1 text-xs leading-5 text-stone-500">{billing.cancelAtPeriodEnd ? `Seu acesso pago permanece até ${formatDate(billing.periodEnd)} e depois volta ao Free.` : `A assinatura renova automaticamente em ${formatDate(billing.nextChargeAt || billing.periodEnd)}.`}</p></div>
          <button disabled={submitting} onClick={() => void setRenewal(Boolean(billing.cancelAtPeriodEnd))} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black ${billing.cancelAtPeriodEnd ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-700'}`}>{billing.cancelAtPeriodEnd ? 'Manter renovação' : 'Cancelar renovação'}</button>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <ScopeCard icon={<UsersRound className="h-5 w-5" />} eyebrow="Seu acesso" title="Benefícios ativos" description="Estes são os benefícios efetivamente vinculados à sua contratação atual." items={currentBenefits} />
        <ScopeCard icon={<Store className="h-5 w-5" />} eyebrow="Módulo" title="Marketplace" description={data.scopes?.marketplace?.summary || 'Recursos empresariais para anúncios e vendas.'} items={[
          `Até ${data.scopes?.marketplace?.photoLimit || 10} fotos por anúncio empresarial`,
          data.scopes?.marketplace?.onlineSales ? 'Recebimento online pode ser habilitado pela empresa' : 'Venda direta por chat e oferta',
          data.scopes?.marketplace?.auctionCreation ? 'Criação de leilões liberada' : 'Leilões: criação disponível conforme o plano',
          'Taxas de intermediação de vendas e leilões seguem a regra vigente do plano ou contrato da empresa',
        ]} />
      </section>

      {billing?.latestCheckout && (
        <section className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500"><ReceiptText className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Último movimento financeiro</p><p className="mt-1 text-sm font-black">{billing.latestCheckout.productName || 'Plano empresarial'} · {billing.latestCheckout.status || 'registrado'}</p><p className="mt-1 text-[10px] text-stone-400">Criado em {formatDateTime(billing.latestCheckout.createdAt)}</p></div></div>
        </section>
      )}

      <section>
        <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Comparar</p><h2 className="mt-1 font-serif text-3xl font-black">Todos os planos</h2><p className="mt-2 text-sm text-stone-500">Compare preço e benefícios. Se o avulso tiver menos recursos, mostramos a diferença antes de você confirmar a compra.</p></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {(data.plans || []).map((plan) => <PlanCard key={plan.id} plan={plan} currentPlanId={currentPlanId} isTrial={Boolean(billing?.isTrial)} trialTargetPlan={billing?.trialTargetPlan || null} onChoose={choose} />)}
        </div>
      </section>

      <PaymentCheckoutModal
        open={Boolean(chosen && chosen.id !== 'FREE' && selection)}
        onClose={() => setSelection(null)}
        title={chosen ? selection?.purchaseMode === 'ONE_TIME' ? `Comprar ${chosen.name} avulso` : `Assinar ${chosen.name}` : 'Novo pagamento'}
        description={chosen && chosenOffer?.effectivePriceCents !== null && chosenOffer?.effectivePriceCents !== undefined
          ? selection?.purchaseMode === 'ONE_TIME'
            ? `${money(Number(chosenOffer.effectivePriceCents))} em pagamento único, sem renovação automática.`
            : `${money(Number(chosenOffer.effectivePriceCents))} por período com renovação automática${chosen.includesEliteTrial ? ` · ${chosen.eliteTrialDays || 15} dias de Elite conforme elegibilidade` : ''}.`
          : undefined}
        amountCents={chosenOffer?.effectivePriceCents ?? null}
        productCode={chosen?.productCode || null}
        confirmLabel={selection?.purchaseMode === 'ONE_TIME' ? 'Pagar avulso com Pix' : 'Autorizar Pix Automático'}
        creatingLabel={selection?.purchaseMode === 'ONE_TIME' ? 'Gerando Pix...' : 'Preparando autorização...'}
        createCheckout={createCheckout}
        onCompleted={async () => {
          const completedMode = selection?.purchaseMode;
          setSelection(null);
          toast(completedMode === 'ONE_TIME' ? 'Compra avulsa confirmada. O plano foi ativado sem renovação automática.' : 'Assinatura confirmada. Plano e benefícios foram atualizados.', 'success');
          window.dispatchEvent(new Event('piranegocios:payment-completed'));
          await load();
        }}
      >
        {chosen && selection && (
          <>
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <ModeChoice
                active={selection.purchaseMode === 'SUBSCRIPTION'}
                disabled={!chosen.offers?.subscription?.available}
                title="Assinatura"
                price={chosen.offers?.subscription?.effectivePriceCents}
                caption={chosen.offers?.subscription?.available ? 'Pix Automático · renovação automática' : chosen.offers?.subscription?.unavailableReason || 'Indisponível'}
                recommended
                onClick={() => setSelection({ planId: chosen.id, purchaseMode: 'SUBSCRIPTION' })}
              />
              <ModeChoice
                active={selection.purchaseMode === 'ONE_TIME'}
                disabled={!chosen.offers?.oneTime?.available}
                title="Compra avulsa"
                price={chosen.offers?.oneTime?.effectivePriceCents}
                caption={chosen.offers?.oneTime?.available ? 'Pix · pagamento único · sem renovação' : chosen.offers?.oneTime?.unavailableReason || 'Indisponível'}
                onClick={() => setSelection({ planId: chosen.id, purchaseMode: 'ONE_TIME' })}
              />
            </div>
            <OfferBenefitComparison offer={chosenOffer} purchaseMode={selection.purchaseMode} />
          </>
        )}

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Dados de cobrança</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Nome e e-mail já vêm da sua conta, mas continuam editáveis para esta cobrança.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Nome do pagador" value={payer.name} onChange={(value) => setPayer((current) => ({ ...current, name: value }))} placeholder="Nome completo" />
            <Field label="E-mail financeiro" value={payer.email} onChange={(value) => setPayer((current) => ({ ...current, email: value }))} placeholder="financeiro@empresa.com" type="email" />
            <label className="text-xs font-black text-stone-500">Tipo de documento<select value={payer.documentType} onChange={(event) => setPayer((current) => ({ ...current, documentType: event.target.value as PaymentDocumentType, document: '' }))} className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold outline-none focus:border-stone-400"><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select></label>
            <Field label={payer.documentType} value={payer.document} onChange={(value) => setPayer((current) => ({ ...current, document: value }))} placeholder={paymentDocumentPlaceholder(payer.documentType)} inputMode="numeric" />
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-semibold leading-5 text-stone-600"><input type="checkbox" checked={rememberDocument} onChange={(event) => setRememberDocument(event.target.checked)} className="mt-1 h-4 w-4 rounded border-stone-300" /><span>Lembrar este documento neste dispositivo nas próximas transações.</span></label>
        </div>
      </PaymentCheckoutModal>
    </div>
  );
}

function PlanCard({ plan, currentPlanId, isTrial, trialTargetPlan, onChoose }: { plan: Plan; currentPlanId: PlanId; isTrial: boolean; trialTargetPlan: PlanId | null; onChoose: (id: PlanId, mode: PurchaseMode) => void }) {
  const current = !isTrial && currentPlanId === plan.id;
  const trialBase = isTrial && trialTargetPlan === plan.id;
  const elite = plan.id === 'ELITE';
  const subscription = plan.offers?.subscription;
  const oneTime = plan.offers?.oneTime;
  const subscriptionConfigured = Boolean(subscription?.enabled);
  const oneTimeConfigured = Boolean(oneTime?.enabled);
  const recurringBenefits = subscription?.benefits || [];
  const lostBenefits = oneTime?.lostComparedToSubscription || [];
  return (
    <article className={`flex min-h-[560px] flex-col rounded-[28px] border p-6 ${elite ? 'border-violet-200 bg-gradient-to-b from-violet-50 to-white' : plan.id === 'PLUS' ? 'border-amber-200 bg-gradient-to-b from-amber-50 to-white' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${elite ? 'bg-violet-900 text-white' : plan.id === 'PLUS' ? 'bg-amber-400 text-stone-950' : 'bg-stone-100 text-stone-600'}`}>{elite ? <Crown className="h-5 w-5" /> : plan.id === 'PLUS' ? <Zap className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</span>{(current || trialBase) && <span className="rounded-full bg-stone-900 px-3 py-1 text-[9px] font-black uppercase text-white">{trialBase ? 'Período gratuito' : 'Seu plano'}</span>}</div>
      <h3 className="mt-5 font-serif text-3xl font-black">{plan.name}</h3>
      {plan.id === 'FREE' ? <div className="mt-2 text-3xl font-black">Grátis</div> : subscriptionConfigured ? <div className="mt-2"><div className="flex items-end gap-1"><span className="text-3xl font-black">{money(Number(subscription?.effectivePriceCents || 0))}</span><span className="pb-1 text-xs font-bold text-stone-400">/período</span></div><p className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-violet-600">Assinatura · renovação automática</p></div> : oneTimeConfigured ? <div className="mt-2"><div className="text-3xl font-black">{money(Number(oneTime?.effectivePriceCents || 0))}</div><p className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-emerald-700">Compra avulsa · Pix</p></div> : null}
      <p className="mt-3 text-sm leading-6 text-stone-500">{plan.description}</p>
      {plan.includesEliteTrial && subscriptionConfigured && <div className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700"><Sparkles className="mr-1 inline h-3.5 w-3.5" /> {plan.eliteTrialDays || 15} dias de Elite na assinatura, conforme elegibilidade</div>}
      <div className="my-5 h-px bg-stone-200" />

      {plan.id === 'FREE' ? (
        <ul className="flex-1 space-y-2.5">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-xs leading-5 text-stone-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>)}</ul>
      ) : (
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Na assinatura</p>
          <ul className="mt-2 space-y-2">{recurringBenefits.map((benefit) => <li key={benefit.id} className="flex gap-2 text-xs leading-5 text-stone-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />{benefit.label}</li>)}</ul>
          {oneTimeConfigured && lostBenefits.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-[.12em] text-amber-700">Escolhendo avulso, você abre mão de</p>
              <ul className="mt-2 space-y-1.5">{lostBenefits.map((benefit) => <li key={benefit.id} className="flex gap-2 text-[10px] leading-4 text-amber-900"><CircleMinus className="mt-0.5 h-3.5 w-3.5 shrink-0" />{benefit.label}</li>)}</ul>
            </div>
          )}
          {oneTimeConfigured && lostBenefits.length === 0 && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700">O avulso mantém os mesmos benefícios configurados para a assinatura.</p>}
        </div>
      )}

      {plan.id === 'FREE' ? (
        <button disabled className="mt-5 rounded-2xl bg-stone-100 px-4 py-3 text-xs font-black text-stone-400">Plano gratuito</button>
      ) : (
        <div className="mt-5 space-y-2">
          {subscriptionConfigured && <button disabled={!subscription?.available || current || trialBase} onClick={() => onChoose(plan.id, 'SUBSCRIPTION')} className="w-full rounded-2xl bg-violet-700 px-4 py-3 text-xs font-black text-white disabled:bg-stone-100 disabled:text-stone-400">{current ? 'Plano atual' : trialBase ? 'Assinatura em período gratuito' : subscription?.available ? `Assinar ${plan.name}` : 'Assinatura indisponível'}</button>}
          {oneTimeConfigured && <button disabled={!oneTime?.available || current || trialBase} onClick={() => onChoose(plan.id, 'ONE_TIME')} className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-xs font-black text-stone-700 disabled:bg-stone-50 disabled:text-stone-300">{current ? 'Plano atual' : oneTime?.available ? `Comprar avulso · ${money(Number(oneTime.effectivePriceCents || 0))}` : 'Compra avulsa indisponível'}</button>}
          {!subscriptionConfigured && !oneTimeConfigured && <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-[10px] font-bold text-amber-700">Este plano ainda não possui oferta disponível.</p>}
        </div>
      )}
    </article>
  );
}

function OfferBenefitComparison({ offer, purchaseMode }: { offer?: Offer; purchaseMode: PurchaseMode }) {
  if (!offer) return null;
  const benefits = offer.benefits || [];
  const lost = purchaseMode === 'ONE_TIME' ? offer.lostComparedToSubscription || [] : [];
  return (
    <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-500">Benefícios desta escolha</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
          <p className="text-xs font-black text-stone-900">Você recebe</p>
          <ul className="mt-2 space-y-1.5">{benefits.map((benefit) => <li key={benefit.id} className="flex gap-2 text-[10px] leading-4 text-stone-600"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{benefit.label}</li>)}</ul>
        </div>
        {purchaseMode === 'ONE_TIME' && (
          <div className={`rounded-xl p-3 ring-1 ${lost.length ? 'bg-amber-50 ring-amber-200' : 'bg-emerald-50 ring-emerald-200'}`}>
            <p className={`text-xs font-black ${lost.length ? 'text-amber-900' : 'text-emerald-900'}`}>{lost.length ? 'Você não leva do recorrente' : 'Sem perda de benefícios'}</p>
            {lost.length ? <ul className="mt-2 space-y-1.5">{lost.map((benefit) => <li key={benefit.id} className="flex gap-2 text-[10px] leading-4 text-amber-900"><CircleMinus className="mt-0.5 h-3.5 w-3.5 shrink-0" />{benefit.label}</li>)}</ul> : <p className="mt-2 text-[10px] leading-4 text-emerald-800">Nesta configuração, a compra avulsa mantém os mesmos benefícios da assinatura.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function ModeChoice({ active, disabled, title, price, caption, recommended = false, onClick }: { active: boolean; disabled?: boolean; title: string; price?: number | null; caption: string; recommended?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : 'border-stone-200 bg-white'} disabled:cursor-not-allowed disabled:opacity-45`}><div className="flex items-center justify-between gap-2"><p className="text-sm font-black text-stone-900">{title}</p>{recommended && <span className="rounded-full bg-violet-600 px-2 py-1 text-[8px] font-black uppercase text-white">Recomendado</span>}</div><p className="mt-2 text-xl font-black text-stone-950">{price !== null && price !== undefined ? money(Number(price)) : 'Indisponível'}</p><p className="mt-1 text-[10px] leading-4 text-stone-500">{caption}</p></button>;
}

function ScopeCard({ icon, eyebrow, title, description, items }: { icon: React.ReactNode; eyebrow: string; title: string; description: string; items: string[] }) {
  return <article className="rounded-[26px] bg-white p-6 ring-1 ring-stone-200"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef8f6] text-[#397c75]">{icon}</span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">{eyebrow}</p><h2 className="mt-1 font-serif text-2xl font-black">{title}</h2></div></div><p className="mt-4 text-sm leading-6 text-stone-500">{description}</p><ul className="mt-5 space-y-2.5">{items.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-stone-600"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#397c75]" />{item}</li>)}</ul></article>;
}
function MiniInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl bg-white/[.06] p-3"><div className="flex items-center gap-2 text-white/45">{icon}<span className="text-[9px] font-black uppercase tracking-[.1em]">{label}</span></div><p className="mt-2 text-xs font-black text-white/85">{value}</p></div>; }
function Field({ label, value, onChange, placeholder, type = 'text', inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) { return <label className="text-xs font-black text-stone-500">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} className="mt-2 h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm font-semibold outline-none focus:border-stone-400" /></label>; }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100); }
function formatDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR') : '—'; }
function formatDateLong(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'; }
function formatDateTime(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function periodLabel(billing?: Billing) { if (!billing?.periodStart && !billing?.periodEnd) return billing?.isTrial ? 'Período gratuito' : 'Sem período'; return `${formatDate(billing.periodStart)} → ${formatDate(billing.periodEnd)}`; }
