import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, Crown, QrCode, ReceiptText, Sparkles, Zap } from "lucide-react";
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
  const [billing, setBilling] = useState<any>({ lifetimeFree: false, entitlements: [], subscriptions: [] });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<any>(null);
  const [message, setMessage] = useState("");

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
      "RESUME_BOOST_15D",
      "PREMIUM_MONTHLY",
    ].includes(product.code)),
    [products],
  );

  const activeEntitlement = (feature: string) => (billing.entitlements || []).find((item: any) => item.feature === feature && item.active);
  const matchAccess = activeEntitlement("JOB_MATCH_PREMIUM");
  const boostAccess = activeEntitlement("RESUME_BOOST");
  const activeSubscription = (billing.subscriptions || []).find((item: any) => item.status === "ACTIVE" && new Date(item.currentPeriodEnd).getTime() > Date.now());

  const buy = async (productCode: string) => {
    setBuying(productCode);
    setMessage("");
    try {
      const response = await api.post("/payments/pix", { productCode });
      if (response.data?.paymentRequired === false) {
        setCheckout(null);
        setMessage(response.data?.message || "Recurso ativado sem cobrança.");
        await load();
        return;
      }
      setCheckout(response.data);
      if (!response.data?.checkoutReady) {
        setMessage(response.data?.product?.billingType === "RECURRING"
          ? "A assinatura foi criada, mas o Pix recorrente ainda depende da conexão com o provedor de pagamentos."
          : "O pedido Pix foi criado, mas a geração automática do QR Code ainda não está conectada neste ambiente.");
      }
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível iniciar o pagamento Pix agora.");
    } finally {
      setBuying(null);
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><QrCode className="mr-2 inline h-4 w-4" /> Somente Pix</div>
      </div>

      {billing.lifetimeFree && (
        <section className="flex items-start gap-3 rounded-[26px] border border-amber-300 bg-amber-50 p-5"><Crown className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" /><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-700">Conta Vitalícia</p><h2 className="mt-1 font-bold text-stone-950">Recursos pagos sem custo</h2><p className="mt-1 text-sm leading-6 text-stone-600">Análises e Match não exigem créditos ou pagamento. Produtos temporários, como Impulso, podem ser ativados normalmente sem gerar Pix.</p></div></section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <CreditCardValue label="Reanálises" value={credits.RESUME_REANALYSIS || 0} />
        <CreditCardValue label="Otimizações com IA" value={credits.RESUME_AI_IMPROVEMENT || 0} />
        <CreditCardValue label="Novas importações por IA" value={credits.RESUME_AI_IMPORT || 0} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <AccessCard icon={<Sparkles className="h-5 w-5" />} label="Match Inteligente" active={billing.lifetimeFree || Boolean(matchAccess)} detail={billing.lifetimeFree ? "Incluído no vitalício" : matchAccess ? `Até ${dateLabel(matchAccess.expiresAt)}` : "Não ativo"} />
        <AccessCard icon={<Zap className="h-5 w-5" />} label="Impulso do currículo" active={Boolean(boostAccess)} detail={boostAccess ? `Até ${dateLabel(boostAccess.expiresAt)}` : "Não ativo"} />
        <AccessCard icon={<CalendarClock className="h-5 w-5" />} label="Plano Destaque" active={Boolean(activeSubscription)} detail={activeSubscription ? `Até ${dateLabel(activeSubscription.currentPeriodEnd)}` : "Sem assinatura ativa"} />
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" /></span><div><h2 className="font-bold text-stone-900">Recursos e planos</h2><p className="text-xs text-stone-500">Preços e promoções são administrados pela plataforma.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {availableProducts.map((product) => (
            <div key={product.code} className={`rounded-2xl border p-4 ${product.code === "PREMIUM_MONTHLY" ? "border-violet-200 bg-violet-50/40" : "border-stone-200 bg-[#fffdfa]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-bold text-stone-900">{product.name}</p><p className="mt-1 text-xs leading-5 text-stone-500">{product.description}</p>{product.durationDays && <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-violet-600">{product.billingType === "RECURRING" ? `Renovação a cada ${product.durationDays} dias` : `Validade: ${product.durationDays} dias`}</p>}</div>
                <div className="text-right">{product.promotionActive && <p className="text-[10px] font-bold text-stone-400 line-through">{money(product.originalPriceCents)}</p>}<p className="text-xl font-black text-stone-900">{billing.lifetimeFree ? "Grátis" : money(product.effectivePriceCents)}</p>{product.billingType === "RECURRING" && !billing.lifetimeFree && <p className="text-[9px] font-bold text-stone-400">por ciclo</p>}</div>
              </div>
              <button type="button" onClick={() => void buy(product.code)} disabled={buying === product.code} className="mt-4 w-full rounded-xl bg-[#2b211c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{buying === product.code ? "Processando..." : billing.lifetimeFree ? "Ativar grátis" : product.billingType === "RECURRING" ? "Assinar com Pix" : "Pagar com Pix"}</button>
            </div>
          ))}
        </div>
        {message && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{message}</div>}
        {checkout?.pixCopyPaste && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Pix copia e cola</p><div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-stone-700">{checkout.pixCopyPaste}</div></div>}
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-stone-500" /><div><h2 className="font-bold text-stone-900">Histórico de pagamentos</h2><p className="text-xs text-stone-500">Seu registro financeiro dentro do PiraNegócios.</p></div></div>
        {loading ? <p className="mt-5 text-sm text-stone-400">Carregando...</p> : payments.length === 0 ? <p className="mt-5 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Você ainda não realizou nenhuma compra.</p> : <div className="mt-5 space-y-2">{payments.map((payment) => <div key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${payment.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{payment.status === "PAID" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><div><p className="text-sm font-bold text-stone-900">{payment.productName || payment.productCode}</p><p className="mt-1 text-xs text-stone-400">{dateLabel(payment.createdAt)} · Pix · {statusLabel[payment.status] || payment.status}</p></div></div><p className="text-lg font-black text-stone-900">{money(payment.amountCents)}</p></div>)}</div>}
      </section>
    </div>
  );
}

function CreditCardValue({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-2 text-3xl font-black text-stone-900">{value}</p><p className="mt-1 text-xs text-stone-400">crédito(s) disponível(is)</p></div>;
}

function AccessCard({ icon, label, active, detail }: { icon: React.ReactNode; label: string; active: boolean; detail: string }) {
  return <div className={`rounded-2xl border p-4 shadow-sm ${active ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"}`}><div className={`flex items-center gap-2 ${active ? "text-emerald-700" : "text-stone-400"}`}>{icon}<p className="text-xs font-black uppercase tracking-wider">{label}</p></div><p className={`mt-2 text-sm font-bold ${active ? "text-emerald-800" : "text-stone-500"}`}>{detail}</p></div>;
}
