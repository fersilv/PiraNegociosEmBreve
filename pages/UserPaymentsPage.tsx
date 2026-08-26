import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Crown,
  Eye,
  EyeOff,
  ReceiptText,
  Sparkles,
  WalletCards,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PaymentCheckoutModal } from '../components/payments/PaymentCheckoutModal';

function money(cents?: number | null) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dateLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function providerLabel(code?: string | null) {
  if (code === 'EFI') return 'Efí Bank';
  if (code === 'MERCADO_PAGO') return 'Mercado Pago';
  return code || 'PiraNegócios';
}

const statusLabel: Record<string, string> = {
  PENDING: 'Aguardando pagamento',
  PAID: 'Pago',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
  REFUNDED: 'Estornado',
};

const purchasableCodes = [
  'RESUME_REANALYSIS',
  'RESUME_AI_IMPROVEMENT',
  'RESUME_AI_IMPORT',
  'JOB_MATCH_30D',
  'RESUME_BOOST_7D',
  'RESUME_BOOST_15D',
  'PREMIUM_MONTHLY',
];

export function UserPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [billing, setBilling] = useState<any>({
    lifetimeFree: false,
    isOpenToWork: false,
    entitlements: [],
    subscriptions: [],
  });
  const [paymentRoutes, setPaymentRoutes] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [payerName, setPayerName] = useState('');
  const [payerCpf, setPayerCpf] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [paymentsResponse, catalogResponse, creditsResponse, billingResponse, providerResponse] = await Promise.all([
        api.get('/payments/me'),
        api.get('/payments/catalog'),
        api.get('/payments/me/credits'),
        api.get('/payments/me/billing-status'),
        api.get('/payments/provider').catch(() => ({ data: {} })),
      ]);
      setPayments(Array.isArray(paymentsResponse.data) ? paymentsResponse.data : []);
      setProducts(Array.isArray(catalogResponse.data) ? catalogResponse.data : []);
      setCredits(creditsResponse.data || {});
      setBilling(billingResponse.data || {});
      setPaymentRoutes(providerResponse.data || {});
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível atualizar seus dados financeiros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const availableProducts = useMemo(
    () => products.filter((product) => purchasableCodes.includes(product.code)),
    [products],
  );

  const activeEntitlement = (feature: string) => (billing.entitlements || [])
    .find((item: any) => item.feature === feature && item.active);
  const matchAccess = activeEntitlement('JOB_MATCH_PREMIUM');
  const boostAccess = activeEntitlement('RESUME_BOOST');
  const earlyAlertAccess = activeEntitlement('EARLY_JOB_ALERTS');
  const activeSubscription = (billing.subscriptions || []).find(
    (item: any) => item.status === 'ACTIVE' && new Date(item.currentPeriodEnd).getTime() > Date.now(),
  );

  const pixRoute = paymentRoutes?.PIX || { available: false };
  const automaticRoute = paymentRoutes?.PIX_AUTOMATICO || { available: false };

  const openProduct = (product: any) => {
    const includesBoost = Array.isArray(product?.benefits)
      && product.benefits.some((benefit: any) => benefit?.kind === 'ENTITLEMENT' && benefit?.feature === 'RESUME_BOOST');
    if (includesBoost && !billing.isOpenToWork) {
      const accepted = window.confirm(
        'Seu perfil está oculto do Banco de Talentos. Ao ativar este recurso, “Estou buscando oportunidades” será ligado para que o currículo possa receber destaque. Deseja continuar?',
      );
      if (!accepted) return;
    }
    setMessage('');
    setPayerName('');
    setPayerCpf('');
    setSelectedProduct(product);
  };

  const selectedRecurring = selectedProduct?.billingType === 'RECURRING';
  const selectedRoute = selectedRecurring ? automaticRoute : pixRoute;
  const needsEfiRecurringData = Boolean(
    selectedProduct
    && !billing.lifetimeFree
    && selectedRecurring
    && selectedRoute?.code === 'EFI',
  );

  const createSelectedCheckout = async () => {
    if (!selectedProduct) throw new Error('Selecione um recurso.');
    if (!billing.lifetimeFree && selectedRoute?.available !== true) {
      throw new Error(selectedRecurring ? 'Pix Automático está temporariamente indisponível.' : 'Pix está temporariamente indisponível.');
    }

    const payload: any = { productCode: selectedProduct.code };
    if (needsEfiRecurringData) {
      const cpf = payerCpf.replace(/\D/g, '');
      if (cpf.length !== 11) throw new Error('Informe um CPF com 11 dígitos para autorizar o Pix Automático.');
      if (payerName.trim().length < 3) throw new Error('Informe o nome completo para autorizar o Pix Automático.');
      payload.payer = { name: payerName.trim(), document: cpf };
    }
    return api.post('/payments/pix', payload);
  };

  const selectedAmount = billing.lifetimeFree
    ? 0
    : Number(selectedProduct?.effectivePriceCents ?? selectedProduct?.priceCents ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/user" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-terracotta-600"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Minha conta · Financeiro</p>
          <h1 className="mt-1 font-serif text-4xl font-black text-stone-950">Carteira e histórico</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Aqui ficam seus créditos, benefícios ativos e comprovantes. Quando você compra algum recurso, o pagamento acontece em uma janela própria sem tirar você do que estava fazendo.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
          <img src="/brand/pix.svg" alt="Pix" className="h-7 w-auto" />
          <div><p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Pagamento</p><p className="text-xs font-bold text-stone-700">Pix no próprio fluxo</p></div>
        </div>
      </header>

      {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">{message}</div>}

      {billing.lifetimeFree && (
        <section className="flex items-start gap-3 rounded-[26px] border border-amber-300 bg-amber-50 p-5">
          <Crown className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-700">Conta vitalícia</p><h2 className="mt-1 font-bold text-stone-950">Recursos pagos sem custo</h2><p className="mt-1 text-sm leading-6 text-stone-600">Quando um benefício elegível for ativado, nenhuma cobrança será criada.</p></div>
        </section>
      )}

      <section>
        <div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Disponível agora</p><h2 className="mt-1 font-serif text-2xl font-black text-stone-950">Seus benefícios</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <BenefitCard icon={<Sparkles className="h-5 w-5" />} label="Match Inteligente" active={billing.lifetimeFree || Boolean(matchAccess)} detail={billing.lifetimeFree ? 'Incluído no vitalício' : matchAccess ? `Até ${dateLabel(matchAccess.expiresAt)}` : 'Não ativo'} />
          <BenefitCard icon={<Zap className="h-5 w-5" />} label="Impulso do currículo" active={Boolean(boostAccess)} warning={Boolean(boostAccess && !billing.isOpenToWork)} detail={boostAccess ? billing.isOpenToWork ? `Até ${dateLabel(boostAccess.expiresAt)}` : 'Ativo nas candidaturas · banco oculto' : 'Não ativo'} />
          <BenefitCard icon={<BellRing className="h-5 w-5" />} label="Vagas em primeira mão" active={Boolean(earlyAlertAccess)} detail={earlyAlertAccess ? `Até ${dateLabel(earlyAlertAccess.expiresAt)}` : 'Não ativo'} />
          <BenefitCard icon={<CalendarClock className="h-5 w-5" />} label="Plano Destaque" active={Boolean(activeSubscription)} detail={activeSubscription ? `Até ${dateLabel(activeSubscription.currentPeriodEnd)}` : 'Sem assinatura ativa'} />
        </div>
      </section>

      {boostAccess && !billing.isOpenToWork && (
        <section className="flex items-start justify-between gap-4 rounded-[24px] border border-orange-200 bg-orange-50 p-5">
          <div className="flex gap-3"><EyeOff className="mt-0.5 h-5 w-5 text-orange-600" /><div><h3 className="text-sm font-black text-orange-950">Impulso ativo, perfil oculto</h3><p className="mt-1 text-xs leading-5 text-orange-800/80">O destaque segue valendo nas candidaturas, mas você não aparece no Banco de Talentos enquanto “Estou buscando oportunidades” estiver desligado.</p></div></div>
          <Link to="/user/perfil" className="shrink-0 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black text-white"><Eye className="mr-1 inline h-3.5 w-3.5" /> Exibir perfil</Link>
        </section>
      )}

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-terracotta-600" /><div><h2 className="font-serif text-2xl font-black text-stone-950">Créditos</h2><p className="text-xs text-stone-500">Saldo para ações pontuais do currículo.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <CreditCardValue label="Reanálises" value={credits.RESUME_REANALYSIS || 0} />
          <CreditCardValue label="Otimizações com IA" value={credits.RESUME_AI_IMPROVEMENT || 0} />
          <CreditCardValue label="Importações com IA" value={credits.RESUME_AI_IMPORT || 0} />
        </div>
      </section>

      <section>
        <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Comprar ou renovar</p><h2 className="mt-1 font-serif text-2xl font-black text-stone-950">Recursos disponíveis</h2><p className="mt-1 text-xs text-stone-500">O botão abre o pagamento por cima desta tela. Nada de redirecionamento para checkout genérico.</p></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {availableProducts.map((product) => {
            const recurring = product.billingType === 'RECURRING';
            const route = recurring ? automaticRoute : pixRoute;
            const unavailable = !billing.lifetimeFree && route?.available !== true;
            return (
              <article key={product.code} className={`flex flex-col rounded-[24px] border p-5 ${product.code === 'PREMIUM_MONTHLY' ? 'border-violet-200 bg-violet-50/50' : 'border-stone-200 bg-white'}`}>
                <div className="flex-1"><p className="text-sm font-black text-stone-950">{product.name}</p><p className="mt-2 text-xs leading-5 text-stone-500">{product.description}</p>{product.durationDays && <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-violet-600">{recurring ? `Recorrente · ciclo de ${product.durationDays} dias` : `Validade: ${product.durationDays} dias`}</p>}</div>
                <div className="mt-5 flex items-end justify-between gap-3"><div>{product.promotionActive && <p className="text-[10px] font-bold text-stone-400 line-through">{money(product.originalPriceCents)}</p>}<p className="text-xl font-black text-stone-950">{billing.lifetimeFree ? 'Grátis' : money(product.effectivePriceCents)}</p></div><button type="button" disabled={unavailable} onClick={() => openProduct(product)} className="rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white disabled:bg-stone-200 disabled:text-stone-400">{unavailable ? 'Indisponível' : recurring ? 'Assinar' : 'Comprar'}</button></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-stone-500" /><div><h2 className="font-serif text-2xl font-black text-stone-950">Histórico financeiro</h2><p className="text-xs text-stone-500">Cobranças e confirmações ficam aqui para consulta. Esta área não é mais etapa do checkout.</p></div></div>
        {loading ? <p className="mt-5 text-sm text-stone-400">Carregando...</p> : payments.length === 0 ? <p className="mt-5 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Você ainda não realizou nenhuma compra.</p> : <div className="mt-5 space-y-2">{payments.map((payment) => <div key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${payment.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>{payment.status === 'PAID' ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><div><p className="text-sm font-bold text-stone-900">{payment.productName || payment.productCode}</p><p className="mt-1 text-xs text-stone-400">{dateLabel(payment.createdAt)} · {providerLabel(payment.provider)} · {statusLabel[payment.status] || payment.status}</p></div></div><p className="text-lg font-black text-stone-900">{money(payment.amountCents)}</p></div>)}</div>}
      </section>

      <PaymentCheckoutModal
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name || 'Pagamento'}
        description={selectedProduct?.description || undefined}
        amountCents={selectedAmount}
        productCode={selectedProduct?.code || null}
        confirmLabel={billing.lifetimeFree ? 'Ativar agora' : selectedRecurring ? 'Continuar assinatura' : 'Gerar Pix'}
        creatingLabel={selectedRecurring ? 'Preparando autorização...' : 'Gerando Pix...'}
        createCheckout={createSelectedCheckout}
        onCompleted={async () => {
          setMessage(selectedRecurring ? 'Assinatura confirmada e benefícios atualizados.' : 'Pagamento confirmado e recurso liberado.');
          await load();
        }}
      >
        {needsEfiRecurringData && <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-violet-700">Dados para autorização</p><p className="mt-1 text-xs leading-5 text-stone-500">A Efí precisa destes dados para iniciar o Pix Automático.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="Nome completo" autoComplete="name" className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs outline-none focus:border-violet-300" /><input value={payerCpf} onChange={(event) => setPayerCpf(event.target.value)} placeholder="CPF" inputMode="numeric" autoComplete="off" className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs outline-none focus:border-violet-300" /></div></div>}
      </PaymentCheckoutModal>
    </div>
  );
}

function CreditCardValue({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-stone-50 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-2 text-3xl font-black text-stone-900">{value}</p><p className="mt-1 text-xs text-stone-400">crédito(s)</p></div>;
}

function BenefitCard({ icon, label, active, warning = false, detail }: { icon: React.ReactNode; label: string; active: boolean; warning?: boolean; detail: string }) {
  const shell = warning ? 'border-orange-200 bg-orange-50' : active ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white';
  const accent = warning ? 'text-orange-700' : active ? 'text-emerald-700' : 'text-stone-400';
  const text = warning ? 'text-orange-800' : active ? 'text-emerald-800' : 'text-stone-500';
  return <div className={`rounded-2xl border p-4 shadow-sm ${shell}`}><div className={`flex items-center gap-2 ${accent}`}>{icon}<p className="text-xs font-black uppercase tracking-wider">{label}</p></div><p className={`mt-2 text-sm font-bold ${text}`}>{detail}</p></div>;
}
