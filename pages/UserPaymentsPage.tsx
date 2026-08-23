import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BellRing, CalendarClock, CheckCircle2, Clock3, Copy, Crown, Eye, EyeOff, QrCode, ReceiptText, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

function money(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const statusLabel: Record<string, string> = {
  PENDING: "Aguardando Pix",
  PAID: "Pago",
  EXPIRED: "Expirado",
  CANCELED: "Cancelado",
  REFUNDED: "Estornado",
};

export function UserPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [billing, setBilling] = useState<any>({ lifetimeFree: false, isOpenToWork: false, entitlements: [], subscriptions: [] });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerCpf, setPayerCpf] = useState("");
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [paymentsResponse, catalogResponse, creditsResponse, billingResponse] = await Promise.all([
        api.get("/payments/me"),
        api.get("/payments/catalog"),
        api.get("/payments/me/credits"),
        api.get("/payments/me/billing-status"),
      ]);
      setPayments(Array.isArray(paymentsResponse.data) ? paymentsResponse.data : []);
      setProducts(Array.isArray(catalogResponse.data) ? catalogResponse.data : []);
      setCredits(creditsResponse.data || {});
      setBilling(billingResponse.data || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const availableProducts = useMemo(
    () => products.filter((product) => [
      "RESUME_REANALYSIS",
      "RESUME_AI_IMPROVEMENT",
      "RESUME_AI_IMPORT",
      "JOB_MATCH_30D",
      "RESUME_BOOST_7D",
      "RESUME_BOOST_15D",
      "PREMIUM_MONTHLY",
    ].includes(product.code)),
    [products],
  );

  const activeEntitlement = (feature: string) => (billing.entitlements || []).find((item: any) => item.feature === feature && item.active);
  const matchAccess = activeEntitlement("JOB_MATCH_PREMIUM");
  const boostAccess = activeEntitlement("RESUME_BOOST");
  const earlyAlertAccess = activeEntitlement("EARLY_JOB_ALERTS");
  const activeSubscription = (billing.subscriptions || []).find((item: any) => item.status === "ACTIVE" && new Date(item.currentPeriodEnd).getTime() > Date.now());

  const buy = async (productCode: string) => {
    const product = products.find((item) => item.code === productCode);
    const includesBoost = Array.isArray(product?.benefits) && product.benefits.some((benefit: any) => benefit?.kind === "ENTITLEMENT" && benefit?.feature === "RESUME_BOOST");
    if (includesBoost && !billing.isOpenToWork) {
      const accepted = window.confirm(
        "Seu perfil está oculto do Banco de Talentos. Ao ativar este Impulso, a opção “Estou buscando oportunidades” será ligada automaticamente para que seu currículo possa receber destaque. Você poderá ocultá-lo novamente quando quiser; nesse caso, o Impulso continuará funcionando normalmente nas candidaturas, mas deixará de aparecer no Banco de Talentos. Deseja continuar?",
      );
      if (!accepted) return;
    }

    setBuying(productCode);
    setMessage("");
    setCheckout(null);
    setCopied(false);
    try {
      const payload: any = { productCode };
      if (product?.billingType === "RECURRING") {
        payload.payer = { name: payerName.trim(), document: payerCpf.replace(/\D/g, "") };
      }
      const response = await api.post("/payments/pix", payload);
      if (response.data?.paymentRequired === false) {
        setCheckout(null);
        setMessage(response.data?.message || "Recurso ativado sem cobrança.");
        await load();
        return;
      }
      setCheckout(response.data);
      if (!response.data?.checkoutReady) {
        setMessage("A cobrança foi criada, mas a Efí não devolveu um QR Code utilizável. Confira a configuração do provedor.");
      }
      await load();
    } catch (error: any) {
      const raw = error?.response?.data?.message;
      setMessage(Array.isArray(raw) ? raw.join(" · ") : raw || "Não foi possível iniciar o pagamento Pix agora.");
    } finally {
      setBuying(null);
    }
  };

  const copyPix = async () => {
    if (!checkout?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(String(checkout.pixCopyPaste));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione o código Pix abaixo e copie manualmente.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/user/curriculo" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-terracotta-600"><ArrowLeft className="h-4 w-4" /> Voltar ao currículo</Link>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Minha conta</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900">Pagamentos e benefícios</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Compras, consultas de IA, Match Inteligente, impulso do currículo e assinatura ficam reunidos aqui. Os pagamentos aceitos são exclusivamente Pix.</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><QrCode className="mr-2 inline h-4 w-4" /> Pix via Efí Bank</div>
      </div>

      {billing.lifetimeFree && (
        <section className="flex items-start gap-3 rounded-[26px] border border-amber-300 bg-amber-50 p-5"><Crown className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" /><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-700">Conta Vitalícia</p><h2 className="mt-1 font-bold text-stone-950">Recursos pagos sem custo</h2><p className="mt-1 text-sm leading-6 text-stone-600">Análises e Match não exigem créditos ou pagamento. Produtos temporários, como Impulso, podem ser ativados normalmente sem gerar Pix.</p></div></section>
      )}

      {boostAccess && (
        <section className={`relative overflow-hidden rounded-[28px] border p-5 shadow-sm ${billing.isOpenToWork ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-lime-50" : "border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50"}`}>
          <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${billing.isOpenToWork ? "bg-emerald-300/30" : "bg-orange-300/35"}`} />
          <div className="relative flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${billing.isOpenToWork ? "bg-emerald-600 text-white" : "bg-orange-500 text-white"}`}><Zap className="h-5 w-5 animate-pulse" /></span>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-black uppercase tracking-[.16em] ${billing.isOpenToWork ? "text-emerald-700" : "text-orange-700"}`}>Impulso ativo</p>
              <h2 className="mt-1 font-bold text-stone-950">{billing.isOpenToWork ? "Seu currículo está recebendo mais exposição" : "Seu currículo está oculto do Banco de Talentos"}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600">{billing.isOpenToWork ? `Destaque ativo no Banco de Talentos e nas suas candidaturas até ${dateLabel(boostAccess.expiresAt)}.` : `O Impulso continua ativo até ${dateLabel(boostAccess.expiresAt)} e suas candidaturas continuam destacadas. Como “Estou buscando oportunidades” está desligado, seu currículo não aparece no Banco de Talentos.`}</p>
              {!billing.isOpenToWork && <Link to="/user/perfil" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black text-white"><Eye className="h-4 w-4" /> Ativar exibição do currículo</Link>}
            </div>
            {billing.isOpenToWork ? <Eye className="h-5 w-5 text-emerald-600" /> : <EyeOff className="h-5 w-5 text-orange-600" />}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <CreditCardValue label="Reanálises" value={credits.RESUME_REANALYSIS || 0} />
        <CreditCardValue label="Otimizações com IA" value={credits.RESUME_AI_IMPROVEMENT || 0} />
        <CreditCardValue label="Novas importações por IA" value={credits.RESUME_AI_IMPORT || 0} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccessCard icon={<Sparkles className="h-5 w-5" />} label="Match Inteligente" active={billing.lifetimeFree || Boolean(matchAccess)} detail={billing.lifetimeFree ? "Incluído no vitalício" : matchAccess ? `Até ${dateLabel(matchAccess.expiresAt)}` : "Não ativo"} />
        <AccessCard icon={<Zap className="h-5 w-5" />} label="Impulso do currículo" active={Boolean(boostAccess)} warning={Boolean(boostAccess && !billing.isOpenToWork)} detail={boostAccess ? billing.isOpenToWork ? `Até ${dateLabel(boostAccess.expiresAt)}` : "Ativo nas candidaturas · banco oculto" : "Não ativo"} />
        <AccessCard icon={<BellRing className="h-5 w-5" />} label="Vagas em primeira mão" active={Boolean(earlyAlertAccess)} detail={earlyAlertAccess ? `Até ${dateLabel(earlyAlertAccess.expiresAt)}` : "Benefício do plano mensal"} />
        <AccessCard icon={<CalendarClock className="h-5 w-5" />} label="Plano Destaque" active={Boolean(activeSubscription)} detail={activeSubscription ? `Até ${dateLabel(activeSubscription.currentPeriodEnd)}` : "Sem assinatura ativa"} />
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" /></span><div><h2 className="font-bold text-stone-900">Recursos e planos</h2><p className="text-xs text-stone-500">Preços e promoções são administrados pela plataforma.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {availableProducts.map((product) => {
            const recurring = product.billingType === "RECURRING";
            return (
              <div key={product.code} className={`rounded-2xl border p-4 ${product.code === "PREMIUM_MONTHLY" ? "border-violet-200 bg-violet-50/40" : "border-stone-200 bg-[#fffdfa]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-bold text-stone-900">{product.name}</p><p className="mt-1 text-xs leading-5 text-stone-500">{product.description}</p>{product.durationDays && <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-violet-600">{recurring ? `Pix Automático · ciclo de ${product.durationDays} dias` : `Validade: ${product.durationDays} dias`}</p>}</div>
                  <div className="text-right">{product.promotionActive && <p className="text-[10px] font-bold text-stone-400 line-through">{money(product.originalPriceCents)}</p>}<p className="text-xl font-black text-stone-900">{billing.lifetimeFree ? "Grátis" : money(product.effectivePriceCents)}</p>{recurring && !billing.lifetimeFree && <p className="text-[9px] font-bold text-stone-400">por ciclo</p>}</div>
                </div>

                {recurring && !billing.lifetimeFree && (
                  <div className="mt-4 rounded-xl border border-violet-100 bg-white/80 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">Dados para o Pix Automático</p>
                    <p className="mt-1 text-[11px] leading-4 text-stone-500">No ambiente real, a Efí usa estes dados para vincular a autorização da cobrança mensal. Em DEV a simulação continua funcionando sem cobrança.</p>
                    <div className="mt-3 grid gap-2">
                      <input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="Nome completo" autoComplete="name" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-300" />
                      <input value={payerCpf} onChange={(event) => setPayerCpf(event.target.value)} placeholder="CPF" inputMode="numeric" autoComplete="off" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-300" />
                    </div>
                  </div>
                )}

                <button type="button" onClick={() => void buy(product.code)} disabled={buying === product.code} className="mt-4 w-full rounded-xl bg-[#2b211c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{buying === product.code ? "Processando..." : billing.lifetimeFree ? "Ativar grátis" : recurring ? "Autorizar Pix Automático" : "Pagar com Pix"}</button>
              </div>
            );
          })}
        </div>

        {message && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />{message}</div>}

        {checkout?.pixCopyPaste && (
          <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Cobrança Efí criada</p><h3 className="mt-1 font-bold text-stone-950">Escaneie o QR ou use o Pix copia e cola</h3><p className="mt-1 text-xs text-stone-500">{checkout.product?.billingType === "RECURRING" ? "Este primeiro Pix também inicia a autorização do seu plano com Pix Automático." : "A liberação acontece automaticamente quando a Efí confirmar o pagamento."}</p></div>
              {checkout.expiresAt && <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-stone-500">Expira {dateLabel(checkout.expiresAt)}</span>}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
              {checkout.qrCodeBase64 ? (
                <div className="flex min-h-[210px] items-center justify-center rounded-2xl border border-emerald-100 bg-white p-3">
                  <img src={checkout.qrCodeBase64} alt="QR Code Pix Efí" className="h-auto max-h-[190px] w-auto max-w-full" />
                </div>
              ) : (
                <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-white/70 p-4 text-center text-xs text-stone-400">Use o código Pix ao lado para pagar.</div>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Pix copia e cola</p>
                <div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs leading-5 text-stone-700">{checkout.pixCopyPaste}</div>
                <button type="button" onClick={() => void copyPix()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"><Copy className="h-3.5 w-3.5" /> {copied ? "Copiado!" : "Copiar código Pix"}</button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-stone-500" /><div><h2 className="font-bold text-stone-900">Histórico de pagamentos</h2><p className="text-xs text-stone-500">Seu registro financeiro dentro do PiraNegócios.</p></div></div>
        {loading ? <p className="mt-5 text-sm text-stone-400">Carregando...</p> : payments.length === 0 ? <p className="mt-5 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Você ainda não realizou nenhuma compra.</p> : <div className="mt-5 space-y-2">{payments.map((payment) => <div key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${payment.status === "PAID" ? "bg-emerald-100 text-emerald-700" : payment.status === "CANCELED" || payment.status === "EXPIRED" ? "bg-stone-100 text-stone-500" : "bg-amber-100 text-amber-700"}`}>{payment.status === "PAID" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><div><p className="text-sm font-bold text-stone-900">{payment.productName || payment.productCode}</p><p className="mt-1 text-xs text-stone-400">{dateLabel(payment.createdAt)} · Pix{payment.provider ? ` ${payment.provider}` : ""} · {statusLabel[payment.status] || payment.status}</p></div></div><p className="text-lg font-black text-stone-900">{money(payment.amountCents)}</p></div>)}</div>}
      </section>
    </div>
  );
}

function CreditCardValue({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-2 text-3xl font-black text-stone-900">{value}</p><p className="mt-1 text-xs text-stone-400">crédito(s) disponível(is)</p></div>;
}

function AccessCard({ icon, label, active, warning = false, detail }: { icon: React.ReactNode; label: string; active: boolean; warning?: boolean; detail: string }) {
  const shell = warning ? "border-orange-200 bg-orange-50" : active ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white";
  const accent = warning ? "text-orange-700" : active ? "text-emerald-700" : "text-stone-400";
  const text = warning ? "text-orange-800" : active ? "text-emerald-800" : "text-stone-500";
  return <div className={`rounded-2xl border p-4 shadow-sm ${shell}`}><div className={`flex items-center gap-2 ${accent}`}>{icon}<p className="text-xs font-black uppercase tracking-wider">{label}</p></div><p className={`mt-2 text-sm font-bold ${text}`}>{detail}</p></div>;
}
