import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Crown,
  Eye,
  EyeOff,
  ReceiptText,
  RefreshCw,
  Sparkles,
  WalletCards,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PaymentCheckoutModal } from '../components/payments/PaymentCheckoutModal';
import { useAuth } from '../contexts/AuthContext';
import { useAiStatus } from '../hooks/useAiStatus';
import {
  cleanPaymentDocument,
  forgetRememberedPayerDocument,
  isValidPaymentDocumentLength,
  loadRememberedPayerDocument,
  paymentDocumentPlaceholder,
  saveRememberedPayerDocument,
  type PaymentDocumentType,
} from '../lib/paymentPayer';

type PurchaseMode = 'SUBSCRIPTION' | 'ONE_TIME';

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

function purchaseModeLabel(payment: any) {
  const recurring = payment?.purchaseMode === 'SUBSCRIPTION'
    || payment?.metadata?.purchaseMode === 'SUBSCRIPTION'
    || payment?.metadata?.paymentType === 'PIX_AUTOMATICO';
  return recurring ? 'Assinatura · Pix Automático' : 'Compra avulsa · Pix';
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

const aiProductCodes = new Set([
  'RESUME_REANALYSIS',
  'RESUME_AI_IMPROVEMENT',
  'RESUME_AI_IMPORT',
  'JOB_MATCH_30D',
]);

export function UserPaymentsPage() {
  const { profile, user } = useAuth();
  const aiStatus = useAiStatus();
  const [payments, setPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [billing, setBilling] = useState<any>({ lifetimeFree: false, isOpenToWork: false, entitlements: [], subscriptions: [] });
  const [paymentRoutes, setPaymentRoutes] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedPurchaseMode, setSelectedPurchaseMode] = useState<PurchaseMode>('SUBSCRIPTION');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerDocumentType, setPayerDocumentType] = useState<PaymentDocumentType>('CPF');
  const [payerDocument, setPayerDocument] = useState('');
  const [rememberDocument, setRememberDocument] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [paymentsResponse, catalogResponse, creditsResponse, billingResponse, providerResponse] = await Promise.all([
        api.get('/payments/me'),
        api.get('/payments/commercial/catalog'),
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

  useEffect(() => {
    const accountName = String(profile?.fullName || profile?.displayName || profile?.name || '').trim();
    const accountEmail = String(profile?.email || user?.email || '').trim();
    if (accountName) setPayerName((current) => current || accountName);
    if (accountEmail) setPayerEmail((current) => current || accountEmail);
    const remembered = loadRememberedPayerDocument();
    if (remembered) {
      setPayerDocumentType(remembered.type);
      setPayerDocument(remembered.document);
      setRememberDocument(true);
    }
  }, [profile?.displayName, profile?.email, profile?.fullName, profile?.name, user?.email]);

  const availableProducts = useMemo(
    () => products.filter((product) => purchasableCodes.includes(product.code) && (aiStatus.enabled || !aiProductCodes.has(product.code))),
    [aiStatus.enabled, products],
  );

  const activeEntitlement = (feature: string) => (billing.entitlements || []).find((item: any) => item.feature === feature && item.active);
  const matchAccess = activeEntitlement('JOB_MATCH_PREMIUM');
  const boostAccess = activeEntitlement('RESUME_BOOST');
  const earlyAlertAccess = activeEntitlement('EARLY_JOB_ALERTS');
  const activeSubscription = (billing.subscriptions || []).find((item: any) => item.status === 'ACTIVE' && new Date(item.currentPeriodEnd).getTime() > Date.now());

  const pixRoute = paymentRoutes?.PIX || { available: false };
  const automaticRoute = paymentRoutes?.PIX_AUTOMATICO || { available: false };

  const openProduct = (product: any, mode?: PurchaseMode) => {
    const includesBoost = Array.isArray(product?.benefits)
      && product.benefits.some((benefit: any) => benefit?.kind === 'ENTITLEMENT' && benefit?.feature === 'RESUME_BOOST');
    if (includesBoost && !billing.isOpenToWork) {
      const accepted = window.confirm('Seu perfil está oculto do Banco de Talentos. Ao ativar este recurso, “Estou buscando oportunidades” será ligado para que o currículo possa receber destaque. Deseja continuar?');
      if (!accepted) return;
    }
    const preferred: PurchaseMode = mode
      || (product?.offers?.subscription?.enabled ? 'SUBSCRIPTION' : 'ONE_TIME');
    setMessage('');
    setSelectedPurchaseMode(preferred);
    setSelectedProduct(product);
  };

  const selectedRecurring = selectedPurchaseMode === 'SUBSCRIPTION';
  const selectedOffer = selectedRecurring ? selectedProduct?.offers?.subscription : selectedProduct?.offers?.oneTime;
  const selectedRoute = selectedRecurring ? automaticRoute : pixRoute;
  const needsPayerData = Boolean(selectedProduct && !billing.lifetimeFree);

  const createSelectedCheckout = async () => {
    if (!selectedProduct) throw new Error('Selecione um recurso.');
    if (!selectedOffer?.enabled) throw new Error('Esta modalidade de compra não está disponível para este produto.');
    if (!billing.lifetimeFree && selectedRoute?.available !== true) {
      throw new Error(selectedRecurring ? 'Pix Automático está temporariamente indisponível.' : 'Pix está temporariamente indisponível.');
    }

    const payload: any = { productCode: selectedProduct.code, purchaseMode: selectedPurchaseMode };
    if (needsPayerData) {
      const name = payerName.trim();
      const email = payerEmail.trim();
      const document = cleanPaymentDocument(payerDocument);
      if (name.length < 3) throw new Error('Informe o nome completo do pagador.');
      if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido para o pagamento.');
      if (!isValidPaymentDocumentLength(payerDocumentType, document)) {
        throw new Error(`Informe um ${payerDocumentType} válido com ${payerDocumentType === 'CNPJ' ? 14 : 11} dígitos.`);
      }
      if (rememberDocument) saveRememberedPayerDocument(payerDocumentType, document);
      else forgetRememberedPayerDocument();
      payload.payer = { name, email, documentType: payerDocumentType, document };
    }
    return api.post('/payments/commercial/checkout', payload);
  };

  const selectedAmount = billing.lifetimeFree ? 0 : Number(selectedOffer?.effectivePriceCents ?? selectedOffer?.priceCents ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/user" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-terracotta-600"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Minha conta · Financeiro</p>
          <h1 className="mt-1 font-serif text-4xl font-black text-stone-950">Transações financeiras</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Assine com Pix Automático ou escolha uma compra avulsa por Pix. Quando as duas opções existirem, a assinatura aparece primeiro para facilitar a renovação sem nova ação a cada ciclo.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" /> Atualizar</button>
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
          {aiStatus.enabled && <BenefitCard icon={<Sparkles className="h-5 w-5" />} label="Match Inteligente" active={billing.lifetimeFree || Boolean(matchAccess)} detail={billing.lifetimeFree ? 'Incluído no vitalício' : matchAccess ? `Até ${dateLabel(matchAccess.expiresAt)}` : 'Não ativo'} />}
          <BenefitCard icon={<Zap className="h-5 w-5" />} label="Impulso do currículo" active={Boolean(boostAccess)} warning={Boolean(boostAccess && !billing.isOpenToWork)} detail={boostAccess ? billing.isOpenToWork ? `Até ${dateLabel(boostAccess.expiresAt)}` : 'Ativo nas candidaturas · banco oculto' : 'Não ativo'} />
          <BenefitCard icon={<BellRing className="h-5 w-5" />} label="Vagas em primeira mão" active={Boolean(earlyAlertAccess)} detail={earlyAlertAccess ? `Até ${dateLabel(earlyAlertAccess.expiresAt)}` : 'Não ativo'} />
          <BenefitCard icon={<CalendarClock className="h-5 w-5" />} label="Assinaturas" active={Boolean(activeSubscription)} detail={activeSubscription ? `Ativa até ${dateLabel(activeSubscription.currentPeriodEnd)}` : 'Nenhuma ativa'} />
        </div>
      </section>

      {boostAccess && !billing.isOpenToWork && (
        <section className="flex items-start justify-between gap-4 rounded-[24px] border border-orange-200 bg-orange-50 p-5">
          <div className="flex gap-3"><EyeOff className="mt-0.5 h-5 w-5 text-orange-600" /><div><h3 className="text-sm font-black text-orange-950">Impulso ativo, perfil oculto</h3><p className="mt-1 text-xs leading-5 text-orange-800/80">O destaque segue valendo nas candidaturas, mas você não aparece no Banco de Talentos enquanto “Estou buscando oportunidades” estiver desligado.</p></div></div>
          <Link to="/user/perfil" className="shrink-0 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black text-white"><Eye className="mr-1 inline h-3.5 w-3.5" /> Exibir perfil</Link>
        </section>
      )}

      {aiStatus.enabled && (
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
          <div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-terracotta-600" /><div><h2 className="font-serif text-2xl font-black text-stone-950">Créditos de IA</h2><p className="text-xs text-stone-500">Saldo para ações inteligentes do currículo.</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <CreditCardValue label="Reanálises" value={credits.RESUME_REANALYSIS || 0} />
            <CreditCardValue label="Otimizações com IA" value={credits.RESUME_AI_IMPROVEMENT || 0} />
            <CreditCardValue label="Importações com IA" value={credits.RESUME_AI_IMPORT || 0} />
          </div>
        </section>
      )}

      <section>
        <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Comprar ou assinar</p><h2 className="mt-1 font-serif text-2xl font-black text-stone-950">Recursos disponíveis</h2><p className="mt-1 text-xs text-stone-500">A assinatura é destacada quando disponível. Compra avulsa continua sempre visível quando o produto permitir.</p></div>
        <div className="grid gap-4 lg:grid-cols-2">
          {availableProducts.map((product) => (
            <ProductCommerceCard
              key={product.code}
              product={product}
              lifetimeFree={Boolean(billing.lifetimeFree)}
              pixAvailable={pixRoute?.available === true}
              automaticAvailable={automaticRoute?.available === true}
              onChoose={(mode) => openProduct(product, mode)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-stone-500" /><div><h2 className="font-serif text-2xl font-black text-stone-950">Histórico financeiro</h2><p className="text-xs text-stone-500">Cobranças avulsas e assinaturas aparecem separadas para você saber exatamente o que autorizou.</p></div></div>
        {loading ? <p className="mt-5 text-sm text-stone-400">Carregando...</p> : payments.length === 0 ? <p className="mt-5 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Você ainda não realizou nenhuma compra.</p> : <div className="mt-5 space-y-2">{payments.map((payment) => <div key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${payment.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>{payment.status === 'PAID' ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><div><p className="text-sm font-bold text-stone-900">{payment.productName || payment.productCode}</p><div className="mt-1 flex flex-wrap gap-1.5"><span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-600">{purchaseModeLabel(payment)}</span><span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-bold text-stone-500">{statusLabel[payment.status] || payment.status}</span></div><p className="mt-2 text-xs text-stone-400">{dateLabel(payment.createdAt)} · {providerLabel(payment.provider)}</p><p className="mt-1 font-mono text-[9px] text-stone-300">{payment.id}</p></div></div><p className="text-lg font-black text-stone-900">{money(payment.amountCents)}</p></div>)}</div>}
      </section>

      <PaymentCheckoutModal
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct ? `${selectedProduct.name} · ${selectedRecurring ? 'Assinatura' : 'Compra avulsa'}` : 'Pagamento'}
        description={selectedRecurring ? 'Pix Automático: autorize uma vez e os próximos ciclos são cobrados conforme a assinatura.' : 'Compra avulsa: uma única cobrança por Pix, sem renovação automática.'}
        amountCents={selectedAmount}
        productCode={selectedProduct?.code || null}
        confirmLabel={billing.lifetimeFree ? 'Ativar agora' : selectedRecurring ? 'Assinar com Pix Automático' : 'Gerar Pix avulso'}
        creatingLabel={selectedRecurring ? 'Preparando autorização...' : 'Gerando Pix...'}
        createCheckout={createSelectedCheckout}
        onCompleted={async () => {
          setMessage(selectedRecurring ? 'Assinatura confirmada e benefícios atualizados.' : 'Pagamento confirmado e recurso liberado.');
          window.dispatchEvent(new Event('piranegocios:payment-completed'));
          await load();
        }}
      >
        {selectedProduct?.offers?.subscription?.enabled && selectedProduct?.offers?.oneTime?.enabled && (
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <ModeButton active={selectedPurchaseMode === 'SUBSCRIPTION'} title="Assinatura" price={billing.lifetimeFree ? 'Grátis' : money(selectedProduct.offers.subscription.effectivePriceCents)} detail="Pix Automático · recomendado" onClick={() => setSelectedPurchaseMode('SUBSCRIPTION')} />
            <ModeButton active={selectedPurchaseMode === 'ONE_TIME'} title="Compra avulsa" price={billing.lifetimeFree ? 'Grátis' : money(selectedProduct.offers.oneTime.effectivePriceCents)} detail="Pix · uma única cobrança" onClick={() => setSelectedPurchaseMode('ONE_TIME')} />
          </div>
        )}
        {needsPayerData && (
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">Dados do pagador</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">Nome e e-mail vêm da sua conta, mas você pode alterá-los para esta transação.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="Nome completo" autoComplete="name" className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs outline-none focus:border-violet-300" />
              <input value={payerEmail} onChange={(event) => setPayerEmail(event.target.value)} placeholder="E-mail" type="email" autoComplete="email" className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs outline-none focus:border-violet-300" />
              <select value={payerDocumentType} onChange={(event) => { setPayerDocumentType(event.target.value as PaymentDocumentType); setPayerDocument(''); }} className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs font-bold outline-none focus:border-violet-300"><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select>
              <input value={payerDocument} onChange={(event) => setPayerDocument(event.target.value)} placeholder={paymentDocumentPlaceholder(payerDocumentType)} inputMode="numeric" autoComplete="off" className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs outline-none focus:border-violet-300" />
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-semibold leading-5 text-stone-600"><input type="checkbox" checked={rememberDocument} onChange={(event) => setRememberDocument(event.target.checked)} className="mt-1 h-4 w-4 rounded border-stone-300" /><span>Lembrar este documento neste dispositivo nas próximas transações.</span></label>
          </div>
        )}
      </PaymentCheckoutModal>
    </div>
  );
}

function ProductCommerceCard({ product, lifetimeFree, pixAvailable, automaticAvailable, onChoose }: { product: any; lifetimeFree: boolean; pixAvailable: boolean; automaticAvailable: boolean; onChoose: (mode: PurchaseMode) => void }) {
  const subscription = product?.offers?.subscription || {};
  const oneTime = product?.offers?.oneTime || {};
  return (
    <article className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">
      <div><p className="text-base font-black text-stone-950">{product.name}</p><p className="mt-2 text-xs leading-5 text-stone-500">{product.description}</p>{product.durationDays && <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-stone-400">Ciclo/validade de {product.durationDays} dias</p>}</div>
      <div className="mt-5 space-y-2.5">
        {subscription.enabled && (
          <div className="rounded-2xl border-2 border-violet-300 bg-violet-50 p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-wider text-violet-800">Assinatura</p><span className="rounded-full bg-violet-700 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">Recomendado</span></div><p className="mt-1 text-[11px] text-violet-700">Pix Automático · autorize uma vez</p></div><p className="text-xl font-black text-stone-950">{lifetimeFree ? 'Grátis' : money(subscription.effectivePriceCents)}</p></div>
            <button type="button" disabled={!lifetimeFree && !automaticAvailable} onClick={() => onChoose('SUBSCRIPTION')} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-black text-white disabled:bg-stone-200 disabled:text-stone-400"><Check className="h-4 w-4" />{!lifetimeFree && !automaticAvailable ? 'Pix Automático indisponível' : 'Assinar'}</button>
          </div>
        )}
        {oneTime.enabled && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-stone-700">Compra avulsa</p><p className="mt-1 text-[11px] text-stone-500">Pix · sem renovação automática</p></div><p className="text-lg font-black text-stone-950">{lifetimeFree ? 'Grátis' : money(oneTime.effectivePriceCents)}</p></div>
            <button type="button" disabled={!lifetimeFree && !pixAvailable} onClick={() => onChoose('ONE_TIME')} className="mt-3 h-10 w-full rounded-xl bg-stone-900 px-4 text-xs font-black text-white disabled:bg-stone-200 disabled:text-stone-400">{!lifetimeFree && !pixAvailable ? 'Pix indisponível' : 'Comprar uma vez'}</button>
          </div>
        )}
      </div>
    </article>
  );
}

function ModeButton({ active, title, price, detail, onClick }: { active: boolean; title: string; price: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-3 text-left transition ${active ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : 'border-stone-200 bg-white hover:bg-stone-50'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-stone-900">{title}</span><span className="text-sm font-black text-stone-950">{price}</span></div><p className="mt-1 text-[10px] font-semibold text-stone-500">{detail}</p></button>;
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
