import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FlaskConical,
  Pencil,
  Percent,
  QrCode,
  ReceiptText,
  RefreshCw,
  Save,
  ShoppingBag,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { api } from "../lib/api";

type PurchaseMode = "SUBSCRIPTION" | "ONE_TIME";

function money(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "—";
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function toReais(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
}
function toCents(value: string) {
  const raw = String(value || "").replace(/R\$/gi, "").replace(/\s/g, "").trim();
  let normalized = raw;
  if (raw.includes(",") && raw.includes(".")) {
    normalized = raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (raw.includes(",")) normalized = raw.replace(",", ".");
  normalized = normalized.replace(/[^0-9.]/g, "");
  return Math.max(0, Math.round((Number(normalized) || 0) * 100));
}
function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function paymentModeLabel(payment: any) {
  return payment?.purchaseMode === "SUBSCRIPTION" || payment?.metadata?.purchaseMode === "SUBSCRIPTION"
    ? "ASSINATURA · PIX AUTOMÁTICO"
    : "AVULSO · PIX";
}

export function AdminPaymentsPage() {
  const [summary, setSummary] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any>({ products: [], highlights: {} });
  const [devMode, setDevMode] = useState(false);
  const [devSaving, setDevSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productDraft, setProductDraft] = useState<any>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [summaryResponse, productResponse, paymentResponse, performanceResponse, devResponse] = await Promise.all([
      api.get("/admin/payments/summary"),
      api.get("/admin/payments/commercial-products"),
      api.get("/admin/payments?limit=250"),
      api.get("/admin/payments/performance"),
      api.get("/admin/payments/dev-mode"),
    ]);
    setSummary(summaryResponse.data || {});
    setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
    setPayments(Array.isArray(paymentResponse.data) ? paymentResponse.data : []);
    setPerformance(performanceResponse.data || { products: [], highlights: {} });
    setDevMode(Boolean(devResponse.data?.enabled));
  };

  useEffect(() => {
    void load().catch((error) => setMessage(error?.response?.data?.message || "Não foi possível carregar pagamentos."));
  }, []);

  const paidConversion = useMemo(() => {
    const total = Number(summary.total || 0);
    return total > 0 ? Math.round((Number(summary.paid || 0) / total) * 100) : 0;
  }, [summary]);

  const refreshFinancial = async () => {
    const [summaryResponse, productResponse, paymentResponse, performanceResponse] = await Promise.all([
      api.get("/admin/payments/summary"),
      api.get("/admin/payments/commercial-products"),
      api.get("/admin/payments?limit=250"),
      api.get("/admin/payments/performance"),
    ]);
    setSummary(summaryResponse.data || {});
    setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
    setPayments(Array.isArray(paymentResponse.data) ? paymentResponse.data : []);
    setPerformance(performanceResponse.data || { products: [], highlights: {} });
  };

  const toggleDevMode = async (enabled: boolean) => {
    setDevSaving(true);
    setMessage("");
    try {
      const response = await api.patch("/admin/payments/dev-mode", { enabled });
      setDevMode(Boolean(response.data?.enabled));
      setMessage(enabled ? "Modo DEV ativado. Simulações de Pix estão liberadas." : "Modo DEV desativado. Simulações de Pix foram bloqueadas.");
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível alterar o modo DEV.");
    } finally {
      setDevSaving(false);
    }
  };

  const openProduct = (product: any) => {
    const subscriptionEnabled = product.subscriptionPriceCents !== null && product.subscriptionPriceCents !== undefined;
    const oneTimeEnabled = product.oneTimePriceCents !== null && product.oneTimePriceCents !== undefined;
    setEditingProduct(product);
    setProductDraft({
      name: product.name || "",
      description: product.description || "",
      subscriptionEnabled,
      subscriptionPrice: toReais(product.subscriptionPriceCents),
      oneTimeEnabled,
      oneTimePrice: toReais(product.oneTimePriceCents),
      preferredPurchaseMode: product.preferredPurchaseMode || (subscriptionEnabled ? "SUBSCRIPTION" : "ONE_TIME"),
      promoPrice: toReais(product.promotionalPriceCents),
      promotionStartsAt: product.promotionStartsAt ? String(product.promotionStartsAt).slice(0, 16) : "",
      promotionEndsAt: product.promotionEndsAt ? String(product.promotionEndsAt).slice(0, 16) : "",
      freeUses: Number(product.freeUses || 0),
      durationDays: product.durationDays === null || product.durationDays === undefined ? null : Number(product.durationDays),
    });
  };

  const setCommercialModeEnabled = (mode: PurchaseMode, enabled: boolean) => {
    setProductDraft((current: any) => {
      const next = {
        ...current,
        ...(mode === "SUBSCRIPTION" ? { subscriptionEnabled: enabled } : { oneTimeEnabled: enabled }),
      };
      if (!enabled && next.preferredPurchaseMode === mode) {
        if (mode === "SUBSCRIPTION" && next.oneTimeEnabled) next.preferredPurchaseMode = "ONE_TIME";
        if (mode === "ONE_TIME" && next.subscriptionEnabled) next.preferredPurchaseMode = "SUBSCRIPTION";
      }
      return next;
    });
  };

  const saveProduct = async () => {
    if (!editingProduct) return;
    const subscriptionPrice = productDraft.subscriptionEnabled ? toCents(productDraft.subscriptionPrice) : null;
    const oneTimePrice = productDraft.oneTimeEnabled ? toCents(productDraft.oneTimePrice) : null;
    if (subscriptionPrice === null && oneTimePrice === null) {
      setMessage("Habilite pelo menos uma modalidade: assinatura ou compra avulsa.");
      return;
    }
    if (subscriptionPrice !== null && subscriptionPrice <= 0) {
      setMessage("Informe um valor maior que zero para a assinatura.");
      return;
    }
    if (oneTimePrice !== null && oneTimePrice <= 0) {
      setMessage("Informe um valor maior que zero para a compra avulsa.");
      return;
    }

    setSaving(editingProduct.code);
    setMessage("");
    try {
      const commercial = await api.patch(`/admin/payments/commercial-products/${editingProduct.code}`, {
        subscriptionPriceCents: subscriptionPrice,
        oneTimePriceCents: oneTimePrice,
        preferredPurchaseMode: productDraft.preferredPurchaseMode,
      });
      await api.patch(`/admin/payments/products/${editingProduct.code}`, {
        name: productDraft.name,
        description: productDraft.description,
        promotionalPriceCents: productDraft.promoPrice ? toCents(productDraft.promoPrice) : null,
        promotionStartsAt: productDraft.promotionStartsAt || null,
        promotionEndsAt: productDraft.promotionEndsAt || null,
        freeUses: Number(productDraft.freeUses || 0),
      });
      if (editingProduct.durationDays !== null && editingProduct.durationDays !== undefined) {
        await api.patch(`/admin/payments/products/${editingProduct.code}/duration`, {
          durationDays: Math.max(1, Number(productDraft.durationDays || editingProduct.durationDays || 30)),
        });
      }
      setMessage(`${commercial.data?.name || editingProduct.name} atualizado com preços separados por modalidade.`);
      setEditingProduct(null);
      await refreshFinancial();
    } catch (error: any) {
      const raw = error?.response?.data?.message;
      setMessage(Array.isArray(raw) ? raw.join(" · ") : raw || "Não foi possível salvar o produto.");
    } finally {
      setSaving(null);
    }
  };

  const toggleProductAvailability = async (product: any, enabled: boolean) => {
    setSaving(`toggle-${product.code}`);
    setMessage("");
    try {
      await api.patch(`/admin/payments/products/${product.code}`, { enabled });
      setProducts((current) => current.map((item) => item.code === product.code ? { ...item, enabled } : item));
      setMessage(`${product.name} ${enabled ? "disponibilizado" : "ocultado para novas compras"}.`);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível alterar a disponibilidade.");
    } finally {
      setSaving(null);
    }
  };

  const simulatePayment = async (id: string) => {
    if (!devMode) return setMessage("Ative o modo DEV antes de simular um pagamento.");
    if (!window.confirm("DEV: simular aprovação deste pagamento? O benefício será liberado, mas o valor não entrará na receita real.")) return;
    setSimulating(id);
    setMessage("");
    try {
      await api.post(`/admin/payments/${id}/simulate`);
      setMessage("Pagamento aprovado em modo DEV. O benefício foi liberado sem contabilizar receita real.");
      await refreshFinancial();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível simular a aprovação deste pagamento.");
    } finally {
      setSimulating(null);
    }
  };

  const highlights = performance?.highlights || {};
  const performanceRows = Array.isArray(performance?.products) ? performance.products : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Financeiro · Comercialização</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900">Pagamentos e monetização</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Cada produto pode ter assinatura por Pix Automático, compra avulsa por Pix ou as duas opções, com preços independentes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void refreshFinancial()} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-xs font-black text-stone-600"><RefreshCw className="h-4 w-4" /> Atualizar</button>
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${devMode ? "border-violet-200 bg-violet-50" : "border-stone-200 bg-white"}`}><FlaskConical className={`h-5 w-5 ${devMode ? "text-violet-600" : "text-stone-400"}`} /><div><p className="text-xs font-black text-stone-900">Modo DEV</p><p className="text-[10px] text-stone-500">{devMode ? "Simulações liberadas" : "Simulações bloqueadas"}</p></div><Switch checked={devMode} disabled={devSaving} onChange={(value) => void toggleDevMode(value)} label="Modo DEV" /></div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Receita confirmada" value={money(summary.paidAmountCents || 0)} icon={<BadgeDollarSign className="h-4 w-4" />} />
        <Metric label="Pagamentos pagos" value={String(summary.paid || 0)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Metric label="Pendentes" value={String(summary.pending || 0)} icon={<Clock3 className="h-4 w-4" />} />
        <Metric label="Conversão" value={`${paidConversion}%`} icon={<ReceiptText className="h-4 w-4" />} />
        <Metric label="Simulações DEV" value={String(summary.simulated || 0)} icon={<FlaskConical className="h-4 w-4" />} />
      </section>

      {devMode && <section className="rounded-3xl border border-violet-200 bg-violet-50 p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white"><FlaskConical className="h-4 w-4" /></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-violet-700">Modo DEV ativo</p><p className="mt-1 text-sm leading-6 text-violet-800/80">Pagamentos pendentes podem ser aprovados manualmente. Simulações ficam fora da receita e dos indicadores comerciais reais.</p></div></div></section>}

      <section className="space-y-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Performance comercial</p><h2 className="mt-1 text-xl font-bold text-stone-950">Desempenho dos produtos</h2></div>
        <div className="grid gap-3 md:grid-cols-3">
          <HighlightCard icon={<Trophy className="h-5 w-5" />} label="Mais vendido" product={highlights.topSelling} value={highlights.topSelling ? `${highlights.topSelling.sales} venda(s)` : "Sem vendas"} />
          <HighlightCard icon={<TrendingUp className="h-5 w-5" />} label="Maior receita" product={highlights.topRevenue} value={highlights.topRevenue ? money(highlights.topRevenue.revenue) : "Sem receita"} />
          <HighlightCard icon={<Percent className="h-5 w-5" />} label="Maior aderência" product={highlights.topConversion} value={highlights.topConversion ? `${highlights.topConversion.conversionPercent}% conversão` : "Sem amostra"} />
        </div>
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-4 py-3">Produto</th><th className="px-4 py-3 text-right">Checkouts</th><th className="px-4 py-3 text-right">Vendas</th><th className="px-4 py-3">Conversão</th><th className="px-4 py-3 text-right">Receita</th></tr></thead><tbody>{performanceRows.map((item: any) => <tr key={item.code} className="border-b border-stone-100 last:border-0"><td className="px-4 py-3"><p className="font-bold text-stone-900">{item.name}</p><p className="text-[10px] text-stone-400">{item.code}</p></td><td className="px-4 py-3 text-right text-stone-600">{item.checkouts}</td><td className="px-4 py-3 text-right font-bold text-stone-900">{item.sales}</td><td className="px-4 py-3 font-bold text-stone-700">{item.conversionPercent}%</td><td className="px-4 py-3 text-right font-black text-stone-900">{money(item.revenue)}</td></tr>)}</tbody></table></div></div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-5 sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-violet-600">Comercialização</p><h2 className="mt-1 text-lg font-bold text-stone-900">Assinatura x compra avulsa</h2><p className="mt-1 text-xs text-stone-500">Configure os valores de cada modalidade. A opção principal aparece destacada para o usuário.</p></div><div className="flex gap-2"><span className="rounded-full bg-violet-100 px-3 py-1.5 text-[10px] font-black text-violet-700">ASSINATURA · PIX AUTOMÁTICO</span><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black text-emerald-700">AVULSO · PIX</span></div></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Assinatura</th><th className="px-4 py-3">Compra avulsa</th><th className="px-4 py-3">Principal</th><th className="px-4 py-3 text-center">Disponível</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>{products.map((product) => <tr key={product.code} onClick={() => openProduct(product)} className="cursor-pointer border-b border-stone-100 transition hover:bg-stone-50 last:border-0"><td className="px-4 py-4"><p className="font-bold text-stone-900">{product.name}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-terracotta-600">{product.code}</p></td><td className="px-4 py-4">{product.subscriptionPriceCents !== null && product.subscriptionPriceCents !== undefined ? <div><p className="font-black text-violet-800">{money(product.subscriptionPriceCents)}</p><p className="text-[9px] font-bold uppercase text-violet-500">Pix Automático</p></div> : <span className="text-stone-300">Desativada</span>}</td><td className="px-4 py-4">{product.oneTimePriceCents !== null && product.oneTimePriceCents !== undefined ? <div><p className="font-black text-stone-900">{money(product.oneTimePriceCents)}</p><p className="text-[9px] font-bold uppercase text-stone-400">Pix</p></div> : <span className="text-stone-300">Desativada</span>}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${product.preferredPurchaseMode === "SUBSCRIPTION" ? "bg-violet-100 text-violet-700" : "bg-stone-100 text-stone-600"}`}>{product.preferredPurchaseMode === "SUBSCRIPTION" ? "ASSINATURA" : "AVULSO"}</span></td><td className="px-4 py-4 text-center" onClick={(event) => event.stopPropagation()}><Switch checked={Boolean(product.enabled)} disabled={saving === `toggle-${product.code}`} onChange={(value) => void toggleProductAvailability(product, value)} label={`Disponibilidade de ${product.name}`} /></td><td className="px-4 py-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openProduct(product); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100 hover:text-stone-900"><Pencil className="h-3.5 w-3.5" /> Configurar <ChevronRight className="h-3.5 w-3.5" /></button></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><ShoppingBag className="h-5 w-5 text-stone-500" /><div><h2 className="text-lg font-bold text-stone-900">Registro de pagamentos</h2><p className="mt-1 text-xs text-stone-500">Cada transação informa se foi assinatura por Pix Automático ou compra avulsa por Pix.</p></div></div>
        <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-3 py-3">Usuário</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Modalidade</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Criado</th><th className="px-3 py-3"></th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-stone-100"><td className="px-3 py-3"><p className="font-bold text-stone-800">{payment.fullName || payment.displayName || "Usuário"}</p><p className="text-xs text-stone-400">{payment.email}</p></td><td className="px-3 py-3 text-stone-600">{payment.productName || payment.productCode}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${paymentModeLabel(payment).startsWith("ASSINATURA") ? "bg-violet-100 text-violet-700" : "bg-stone-100 text-stone-600"}`}>{paymentModeLabel(payment)}</span></td><td className="px-3 py-3 font-bold text-stone-900">{money(payment.amountCents)}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${payment.isSimulation ? "bg-violet-100 text-violet-700" : payment.status === "PAID" ? "bg-emerald-100 text-emerald-700" : payment.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>{payment.isSimulation ? "DEV · SIMULADO" : payment.status}</span></td><td className="px-3 py-3 text-xs text-stone-400">{dateLabel(payment.createdAt)}</td><td className="px-3 py-3 text-right">{devMode && payment.status === "PENDING" && <button type="button" onClick={() => void simulatePayment(payment.id)} disabled={simulating === payment.id} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 disabled:opacity-50"><FlaskConical className="h-3.5 w-3.5" />{simulating === payment.id ? "Simulando..." : "DEV · Aprovar"}</button>}</td></tr>)}</tbody></table>{payments.length === 0 && <p className="py-8 text-center text-sm text-stone-400">Nenhum pagamento registrado.</p>}</div>
      </section>

      {message && <div className="sticky bottom-4 z-30 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-lg"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>}

      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={() => setEditingProduct(null)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white/95 p-5 backdrop-blur sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-terracotta-600">{editingProduct.code}</p><h2 className="mt-1 text-xl font-bold text-stone-950">Configurar comercialização</h2><p className="mt-1 text-xs text-stone-500">Assinatura e compra avulsa são ofertas independentes do mesmo produto.</p></div><button type="button" onClick={() => setEditingProduct(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500"><X className="h-4 w-4" /></button></div>
            <div className="space-y-6 p-5 sm:p-6">
              <Field label="Nome comercial" value={productDraft.name || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, name: value }))} />
              <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Descrição</span><textarea rows={3} value={productDraft.description || ""} onChange={(event) => setProductDraft((current: any) => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-terracotta-400" /></label>

              <div className="grid gap-4 lg:grid-cols-2">
                <CommerceEditor title="Assinatura" subtitle="Pix Automático · opção recomendada ao usuário" enabled={Boolean(productDraft.subscriptionEnabled)} price={productDraft.subscriptionPrice || ""} active={productDraft.preferredPurchaseMode === "SUBSCRIPTION"} onEnabled={(value) => setCommercialModeEnabled("SUBSCRIPTION", value)} onPrice={(value) => setProductDraft((current: any) => ({ ...current, subscriptionPrice: value }))} onPrefer={() => setProductDraft((current: any) => ({ ...current, preferredPurchaseMode: "SUBSCRIPTION" }))} />
                <CommerceEditor title="Compra avulsa" subtitle="Pix comum · cobrança única" enabled={Boolean(productDraft.oneTimeEnabled)} price={productDraft.oneTimePrice || ""} active={productDraft.preferredPurchaseMode === "ONE_TIME"} onEnabled={(value) => setCommercialModeEnabled("ONE_TIME", value)} onPrice={(value) => setProductDraft((current: any) => ({ ...current, oneTimePrice: value }))} onPrefer={() => setProductDraft((current: any) => ({ ...current, preferredPurchaseMode: "ONE_TIME" }))} />
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Promoção</p><p className="mt-1 text-xs leading-5 text-amber-800/80">A promoção existente aplica-se à modalidade marcada como principal. Os preços normais de assinatura e avulso continuam independentes.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Preço promocional (R$)" value={productDraft.promoPrice || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, promoPrice: value }))} placeholder="Opcional" /><Field label="Início" value={productDraft.promotionStartsAt || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, promotionStartsAt: value }))} type="datetime-local" /><Field label="Fim" value={productDraft.promotionEndsAt || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, promotionEndsAt: value }))} type="datetime-local" /></div></div>

              <div className="grid gap-4 sm:grid-cols-2">{editingProduct.durationDays !== null && editingProduct.durationDays !== undefined && <Field label="Duração do ciclo/acesso (dias)" value={String(productDraft.durationDays ?? editingProduct.durationDays)} onChange={(value) => setProductDraft((current: any) => ({ ...current, durationDays: Math.max(1, Number(value || 1)) }))} type="number" />}<Field label="Usos gratuitos" value={String(productDraft.freeUses ?? 0)} onChange={(value) => setProductDraft((current: any) => ({ ...current, freeUses: Math.max(0, Number(value || 0)) }))} type="number" /></div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-stone-200 bg-white/95 p-4 backdrop-blur sm:px-6"><button type="button" onClick={() => setEditingProduct(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-stone-500">Cancelar</button><button type="button" onClick={() => void saveProduct()} disabled={saving === editingProduct.code} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving === editingProduct.code ? "Salvando..." : "Salvar alterações"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommerceEditor({ title, subtitle, enabled, price, active, onEnabled, onPrice, onPrefer }: { title: string; subtitle: string; enabled: boolean; price: string; active: boolean; onEnabled: (value: boolean) => void; onPrice: (value: string) => void; onPrefer: () => void }) {
  return <div className={`rounded-2xl border p-4 ${active ? "border-violet-300 bg-violet-50" : "border-stone-200 bg-stone-50"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-stone-950">{title}</p><p className="mt-1 text-[11px] leading-5 text-stone-500">{subtitle}</p></div><Switch checked={enabled} onChange={onEnabled} label={`Habilitar ${title}`} /></div><div className="mt-4"><Field label="Valor (R$)" value={price} onChange={onPrice} placeholder="0,00" disabled={!enabled} /></div><button type="button" disabled={!enabled} onClick={onPrefer} className={`mt-3 w-full rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider ${active ? "bg-violet-700 text-white" : "bg-white text-stone-500 ring-1 ring-stone-200"} disabled:opacity-40`}>{active ? "Opção principal" : "Tornar principal"}</button></div>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-stone-400"><p className="text-[10px] font-black uppercase tracking-[.14em]">{label}</p>{icon}</div><p className="mt-3 text-2xl font-black text-stone-900">{value}</p></div>;
}
function HighlightCard({ icon, label, product, value }: { icon: React.ReactNode; label: string; product?: any; value: string }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-terracotta-600">{icon}<p className="text-[10px] font-black uppercase tracking-[.14em]">{label}</p></div><p className="mt-3 truncate font-bold text-stone-900">{product?.name || "Ainda sem dados"}</p><p className="mt-1 text-sm font-black text-stone-700">{value}</p></div>;
}
function Switch({ checked, onChange, disabled = false, label }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-emerald-500" : "bg-stone-300"} disabled:opacity-50`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} /></button>;
}
function Field({ label, value, onChange, placeholder, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</span><input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-terracotta-400 disabled:bg-stone-100 disabled:text-stone-400" /></label>;
}
