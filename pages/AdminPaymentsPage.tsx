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

function money(cents: number) {
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
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  }
  normalized = normalized.replace(/[^0-9.]/g, "");
  return Math.max(0, Math.round((Number(normalized) || 0) * 100));
}
function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function AdminPaymentsPage() {
  const [summary, setSummary] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [matchOverview, setMatchOverview] = useState<any>({});
  const [performance, setPerformance] = useState<any>({ products: [], highlights: {} });
  const [devMode, setDevMode] = useState(false);
  const [devSaving, setDevSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productDraft, setProductDraft] = useState<any>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [preparingMatch, setPreparingMatch] = useState(false);
  const [prepProgress, setPrepProgress] = useState<any>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [summaryResponse, productResponse, paymentResponse, matchResponse, performanceResponse, devResponse] = await Promise.all([
      api.get("/admin/payments/summary"),
      api.get("/admin/payments/products"),
      api.get("/admin/payments?limit=250"),
      api.get("/admin/job-match/overview").catch(() => ({ data: {} })),
      api.get("/admin/payments/performance"),
      api.get("/admin/payments/dev-mode"),
    ]);
    setSummary(summaryResponse.data || {});
    setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
    setPayments(Array.isArray(paymentResponse.data) ? paymentResponse.data : []);
    setMatchOverview(matchResponse.data || {});
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
      api.get("/admin/payments/products"),
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
    setEditingProduct(product);
    setProductDraft({
      name: product.name || "",
      description: product.description || "",
      price: toReais(product.priceCents),
      promoPrice: toReais(product.promotionalPriceCents),
      promotionStartsAt: product.promotionStartsAt ? String(product.promotionStartsAt).slice(0, 16) : "",
      promotionEndsAt: product.promotionEndsAt ? String(product.promotionEndsAt).slice(0, 16) : "",
      freeUses: Number(product.freeUses || 0),
      durationDays: product.durationDays === null || product.durationDays === undefined ? null : Number(product.durationDays),
    });
  };

  const saveProduct = async () => {
    if (!editingProduct) return;
    setSaving(editingProduct.code);
    setMessage("");
    try {
      await api.patch(`/admin/payments/products/${editingProduct.code}`, {
        name: productDraft.name,
        description: productDraft.description,
        priceCents: toCents(productDraft.price),
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
      setMessage(`${editingProduct.name} atualizado.`);
      setEditingProduct(null);
      await refreshFinancial();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível salvar o produto.");
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
    if (!devMode) {
      setMessage("Ative o modo DEV antes de simular um pagamento.");
      return;
    }
    if (!window.confirm("DEV: simular aprovação deste Pix? O benefício será liberado para o usuário, mas o valor NÃO entrará na receita real.")) return;
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

  const refreshMatchOverview = async () => {
    const response = await api.get("/admin/job-match/overview");
    setMatchOverview(response.data || {});
  };

  const prepareActiveJobs = async () => {
    if (preparingMatch) return;
    if (!window.confirm("Preparar as vagas ativas sem ficha válida do Match Inteligente? Vagas sem matchProfile fornecido pela origem podem gerar chamada de IA.")) return;
    setPreparingMatch(true);
    setMessage("");
    try {
      const queueResponse = await api.get("/admin/job-match/backfill/queue?limit=500");
      const queue = Array.isArray(queueResponse.data) ? queueResponse.data : [];
      if (!queue.length) {
        setPrepProgress({ total: 0, completed: 0, succeeded: 0, failed: 0, current: "", errors: [] });
        setMessage("Todas as vagas ativas já estão preparadas para o Match Inteligente.");
        await refreshMatchOverview();
        return;
      }

      let succeeded = 0;
      let failed = 0;
      const errors: any[] = [];
      setPrepProgress({ total: queue.length, completed: 0, succeeded, failed, current: "Iniciando...", errors });

      for (let index = 0; index < queue.length; index += 1) {
        const item = queue[index];
        setPrepProgress({ total: queue.length, completed: index, succeeded, failed, current: item.title, errors: [...errors] });
        try {
          const response = await api.post(`/admin/job-match/backfill/jobs/${item.id}`);
          if (response.data?.success) succeeded += 1;
          else {
            failed += 1;
            errors.push({ id: item.id, title: item.title, error: response.data?.error || "Falha sem detalhe." });
          }
        } catch (error: any) {
          failed += 1;
          errors.push({ id: item.id, title: item.title, error: error?.response?.data?.message || "Falha ao preparar vaga." });
        }
        setPrepProgress({ total: queue.length, completed: index + 1, succeeded, failed, current: index + 1 === queue.length ? "Concluído" : queue[index + 1]?.title || "", errors: [...errors] });
        if ((index + 1) % 3 === 0 || index + 1 === queue.length) await refreshMatchOverview().catch(() => undefined);
      }
      setMessage(`${succeeded} vaga(s) preparada(s).${failed ? ` ${failed} falharam e ficaram disponíveis para nova tentativa.` : " Nenhum erro."}`);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível preparar as vagas ativas.");
    } finally {
      setPreparingMatch(false);
    }
  };

  const highlights = performance?.highlights || {};
  const performanceRows = Array.isArray(performance?.products) ? performance.products : [];
  const progressPercent = prepProgress?.total ? Math.round((Number(prepProgress.completed || 0) / Number(prepProgress.total)) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Financeiro · Pix</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900">Pagamentos e monetização</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Gerencie produtos, preços, promoções, vendas e recursos premium. O checkout aceita somente Pix.</p>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${devMode ? "border-violet-250 bg-violet-50" : "border-stone-200 bg-white"}`}>
          <FlaskConical className={`h-5 w-5 ${devMode ? "text-violet-600" : "text-stone-400"}`} />
          <div><p className="text-xs font-black text-stone-900">Modo DEV</p><p className="text-[10px] text-stone-500">{devMode ? "Simulações liberadas" : "Simulações bloqueadas"}</p></div>
          <Switch checked={devMode} disabled={devSaving} onChange={(value) => void toggleDevMode(value)} label="Modo DEV" />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Receita confirmada" value={money(summary.paidAmountCents || 0)} icon={<BadgeDollarSign className="h-4 w-4" />} />
        <Metric label="Pagamentos pagos" value={String(summary.paid || 0)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Metric label="Aguardando Pix" value={String(summary.pending || 0)} icon={<Clock3 className="h-4 w-4" />} />
        <Metric label="Conversão registrada" value={`${paidConversion}%`} icon={<ReceiptText className="h-4 w-4" />} />
        <Metric label="Simulações DEV" value={String(summary.simulated || 0)} icon={<FlaskConical className="h-4 w-4" />} />
      </section>

      {devMode && (
        <section className="rounded-3xl border border-violet-200 bg-violet-50 p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white"><FlaskConical className="h-4 w-4" /></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-violet-700">Modo DEV ativo</p><p className="mt-1 text-sm leading-6 text-violet-800/80">Pagamentos pendentes podem ser aprovados manualmente para testar benefícios. Simulações continuam fora da receita, conversão e ranking comercial reais.</p></div></div>
        </section>
      )}

      <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-sky-700">Match Inteligente · preparação das vagas</p>
            <h2 className="mt-1 text-lg font-bold text-stone-950">A IA roda quando a vaga fica ativa</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">Vagas novas são preparadas automaticamente. Quando a API externa já envia <strong>matchProfile</strong>, essa ficha é reaproveitada e a chamada de IA interna é evitada.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="rounded-full bg-white px-3 py-1.5 text-stone-600">Ativas {Number(matchOverview.active || 0)}</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">Prontas {Number(matchOverview.ready || 0)}</span>
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-700">Pendentes {Number(matchOverview.pending || 0)}</span>
              <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-700">Erros {Number(matchOverview.error || 0)}</span>
              <span className="rounded-full bg-stone-200 px-3 py-1.5 text-stone-600">Sem ficha {Number(matchOverview.missing || 0)}</span>
            </div>
            {prepProgress && prepProgress.total > 0 && (
              <div className="mt-5 rounded-2xl border border-sky-200 bg-white/75 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-stone-900">{prepProgress.completed}/{prepProgress.total} processadas</p><p className="mt-1 truncate text-xs text-stone-500">{preparingMatch ? `Agora: ${prepProgress.current}` : "Processamento concluído"}</p></div><strong className="text-sm text-sky-700">{progressPercent}%</strong></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100"><div className="h-full rounded-full bg-sky-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} /></div>
                <div className="mt-3 flex gap-4 text-[11px] font-bold"><span className="text-emerald-700">✓ {prepProgress.succeeded} prontas</span><span className="text-red-600">! {prepProgress.failed} falharam</span></div>
                {prepProgress.errors?.length > 0 && !preparingMatch && <div className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-xl bg-red-50 p-3">{prepProgress.errors.map((item: any) => <p key={item.id} className="text-[10px] text-red-700"><strong>{item.title}:</strong> {item.error}</p>)}</div>}
              </div>
            )}
          </div>
          <button type="button" disabled={preparingMatch} onClick={() => void prepareActiveJobs()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${preparingMatch ? "animate-spin" : ""}`} /> {preparingMatch ? "Preparando..." : "Preparar vagas ativas"}</button>
        </div>
      </section>

      <section className="space-y-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Performance comercial</p><h2 className="mt-1 text-xl font-bold text-stone-950">Desempenho dos produtos</h2><p className="mt-1 text-xs text-stone-500">Somente transações reais entram nestes indicadores. “Maior aderência” considera conversão de checkout em pagamento, priorizando produtos com pelo menos 3 checkouts quando houver amostra suficiente.</p></div>
        <div className="grid gap-3 md:grid-cols-3">
          <HighlightCard icon={<Trophy className="h-5 w-5" />} label="Mais vendido" product={highlights.topSelling} value={highlights.topSelling ? `${highlights.topSelling.sales} venda(s)` : "Sem vendas"} />
          <HighlightCard icon={<TrendingUp className="h-5 w-5" />} label="Maior receita" product={highlights.topRevenue} value={highlights.topRevenue ? money(highlights.topRevenue.revenue) : "Sem receita"} />
          <HighlightCard icon={<Percent className="h-5 w-5" />} label="Maior aderência" product={highlights.topConversion} value={highlights.topConversion ? `${highlights.topConversion.conversionPercent}% conversão` : "Sem amostra"} />
        </div>
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-4 py-3">Produto</th><th className="px-4 py-3 text-right">Checkouts</th><th className="px-4 py-3 text-right">Vendas</th><th className="px-4 py-3 text-right">Compradores</th><th className="px-4 py-3">Conversão</th><th className="px-4 py-3 text-right">Participação</th><th className="px-4 py-3 text-right">Receita</th></tr></thead>
              <tbody>{performanceRows.map((item: any) => <tr key={item.code} className="border-b border-stone-100 last:border-0"><td className="px-4 py-3"><p className="font-bold text-stone-900">{item.name}</p><p className="text-[10px] text-stone-400">{item.code}</p></td><td className="px-4 py-3 text-right text-stone-600">{item.checkouts}</td><td className="px-4 py-3 text-right font-bold text-stone-900">{item.sales}</td><td className="px-4 py-3 text-right text-stone-600">{item.buyers}</td><td className="px-4 py-3"><div className="flex min-w-32 items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Number(item.conversionPercent || 0))}%` }} /></div><span className="w-11 text-right text-xs font-bold text-stone-700">{item.conversionPercent}%</span></div></td><td className="px-4 py-3 text-right text-stone-600">{item.salesSharePercent}%</td><td className="px-4 py-3 text-right font-black text-stone-900">{money(item.revenue)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-5 sm:p-6">
          <div><h2 className="text-lg font-bold text-stone-900">Produtos e regras</h2><p className="mt-1 text-xs text-stone-500">Clique em um produto para alterar preço, promoção, duração e demais regras.</p></div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><QrCode className="mr-1.5 inline h-3.5 w-3.5" /> Somente Pix</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Preço</th><th className="px-4 py-3">Promoção</th><th className="px-4 py-3">Duração</th><th className="px-4 py-3">Cobrança</th><th className="px-4 py-3 text-center">Disponível</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>{products.map((product) => <tr key={product.code} onClick={() => openProduct(product)} className="cursor-pointer border-b border-stone-100 transition hover:bg-stone-50 last:border-0"><td className="px-4 py-4"><p className="font-bold text-stone-900">{product.name}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-terracotta-600">{product.code}</p></td><td className="px-4 py-4 font-bold text-stone-900">{money(product.priceCents)}</td><td className="px-4 py-4">{product.promotionalPriceCents !== null && product.promotionalPriceCents !== undefined ? <span className="font-bold text-emerald-700">{money(product.promotionalPriceCents)}</span> : <span className="text-stone-400">Sem promoção</span>}</td><td className="px-4 py-4 text-stone-600">{product.durationDays ? `${product.durationDays} dias` : "Uso avulso"}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${product.billingType === "RECURRING" ? "bg-violet-100 text-violet-700" : "bg-stone-100 text-stone-600"}`}>{product.billingType === "RECURRING" ? "RECORRENTE" : "AVULSO"}</span></td><td className="px-4 py-4 text-center" onClick={(event) => event.stopPropagation()}><Switch checked={Boolean(product.enabled)} disabled={saving === `toggle-${product.code}`} onChange={(value) => void toggleProductAvailability(product, value)} label={`Disponibilidade de ${product.name}`} /></td><td className="px-4 py-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openProduct(product); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100 hover:text-stone-900"><Pencil className="h-3.5 w-3.5" /> Configurar <ChevronRight className="h-3.5 w-3.5" /></button></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div><h2 className="text-lg font-bold text-stone-900">Registro de pagamentos</h2><p className="mt-1 text-xs text-stone-500">Histórico financeiro com usuário, produto, valor e situação do Pix.</p></div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-3 py-3">Usuário</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Criado</th><th className="px-3 py-3"></th></tr></thead>
            <tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-stone-100"><td className="px-3 py-3"><p className="font-bold text-stone-800">{payment.fullName || payment.displayName || "Usuário"}</p><p className="text-xs text-stone-400">{payment.email}</p></td><td className="px-3 py-3 text-stone-600">{payment.productName || payment.productCode}</td><td className="px-3 py-3 font-bold text-stone-900">{money(payment.amountCents)}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${payment.isSimulation ? "bg-violet-100 text-violet-700" : payment.status === "PAID" ? "bg-emerald-100 text-emerald-700" : payment.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>{payment.isSimulation ? "DEV · SIMULADO" : payment.status}</span></td><td className="px-3 py-3 text-xs text-stone-400">{dateLabel(payment.createdAt)}</td><td className="px-3 py-3 text-right">{devMode && payment.status === "PENDING" && <button type="button" onClick={() => void simulatePayment(payment.id)} disabled={simulating === payment.id} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:opacity-50"><FlaskConical className="h-3.5 w-3.5" />{simulating === payment.id ? "Simulando..." : "DEV · Aprovar"}</button>}</td></tr>)}</tbody>
          </table>
          {payments.length === 0 && <p className="py-8 text-center text-sm text-stone-400">Nenhum pagamento registrado.</p>}
        </div>
      </section>

      {message && <div className="sticky bottom-4 z-30 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-lg"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>}

      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={() => setEditingProduct(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white/95 p-5 backdrop-blur sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-terracotta-600">{editingProduct.code}</p><h2 className="mt-1 text-xl font-bold text-stone-950">Configurar produto</h2><p className="mt-1 text-xs text-stone-500">{editingProduct.billingType === "RECURRING" ? "Cobrança recorrente" : "Compra avulsa"} · Pix</p></div><button type="button" onClick={() => setEditingProduct(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500"><X className="h-4 w-4" /></button></div>
            <div className="space-y-5 p-5 sm:p-6">
              <Field label="Nome comercial" value={productDraft.name || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, name: value }))} />
              <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Descrição</span><textarea rows={4} value={productDraft.description || ""} onChange={(event) => setProductDraft((current: any) => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-terracotta-400" /></label>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Preço normal (R$)" value={productDraft.price || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, price: value }))} /><Field label="Preço promocional (R$)" value={productDraft.promoPrice || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, promoPrice: value }))} placeholder="Opcional" /><Field label="Início da promoção" value={productDraft.promotionStartsAt || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, promotionStartsAt: value }))} type="datetime-local" /><Field label="Fim da promoção" value={productDraft.promotionEndsAt || ""} onChange={(value) => setProductDraft((current: any) => ({ ...current, promotionEndsAt: value }))} type="datetime-local" />{editingProduct.durationDays !== null && editingProduct.durationDays !== undefined && <Field label={editingProduct.billingType === "RECURRING" ? "Duração do ciclo (dias)" : "Duração do acesso (dias)"} value={String(productDraft.durationDays ?? editingProduct.durationDays)} onChange={(value) => setProductDraft((current: any) => ({ ...current, durationDays: Math.max(1, Number(value || 1)) }))} type="number" />}<Field label="Usos gratuitos" value={String(productDraft.freeUses ?? 0)} onChange={(value) => setProductDraft((current: any) => ({ ...current, freeUses: Math.max(0, Number(value || 0)) }))} type="number" /></div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-stone-200 bg-white/95 p-4 backdrop-blur sm:px-6"><button type="button" onClick={() => setEditingProduct(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-stone-500">Cancelar</button><button type="button" onClick={() => void saveProduct()} disabled={saving === editingProduct.code} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving === editingProduct.code ? "Salvando..." : "Salvar alterações"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
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

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-terracotta-400" /></label>;
}
