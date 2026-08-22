import React, { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CheckCircle2, Clock3, FlaskConical, QrCode, ReceiptText, RefreshCw, Save, Sparkles } from "lucide-react";
import { api } from "../lib/api";

function money(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function toReais(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
}
function toCents(value: string) {
  const normalized = String(value || "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
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
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [preparingMatch, setPreparingMatch] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [summaryResponse, productResponse, paymentResponse, matchResponse] = await Promise.all([
      api.get("/admin/payments/summary"),
      api.get("/admin/payments/products"),
      api.get("/admin/payments?limit=250"),
      api.get("/admin/job-match/overview").catch(() => ({ data: {} })),
    ]);
    setSummary(summaryResponse.data || {});
    setMatchOverview(matchResponse.data || {});
    const nextProducts = Array.isArray(productResponse.data) ? productResponse.data : [];
    setProducts(nextProducts);
    setDrafts(Object.fromEntries(nextProducts.map((product: any) => [product.code, {
      price: toReais(product.priceCents),
      promoPrice: toReais(product.promotionalPriceCents),
      promotionStartsAt: product.promotionStartsAt ? String(product.promotionStartsAt).slice(0, 16) : "",
      promotionEndsAt: product.promotionEndsAt ? String(product.promotionEndsAt).slice(0, 16) : "",
      enabled: Boolean(product.enabled),
      freeUses: Number(product.freeUses || 0),
      durationDays: product.durationDays === null || product.durationDays === undefined ? null : Number(product.durationDays),
    }])));
    setPayments(Array.isArray(paymentResponse.data) ? paymentResponse.data : []);
  };

  useEffect(() => { void load().catch((error) => setMessage(error?.response?.data?.message || "Não foi possível carregar pagamentos.")); }, []);

  const paidConversion = useMemo(() => {
    const total = Number(summary.total || 0);
    return total > 0 ? Math.round((Number(summary.paid || 0) / total) * 100) : 0;
  }, [summary]);

  const patchDraft = (code: string, patch: Record<string, unknown>) => setDrafts((current) => ({ ...current, [code]: { ...(current[code] || {}), ...patch } }));

  const saveProduct = async (product: any) => {
    const draft = drafts[product.code] || {};
    setSaving(product.code);
    setMessage("");
    try {
      await api.patch(`/admin/payments/products/${product.code}`, {
        priceCents: toCents(draft.price),
        promotionalPriceCents: draft.promoPrice ? toCents(draft.promoPrice) : null,
        promotionStartsAt: draft.promotionStartsAt || null,
        promotionEndsAt: draft.promotionEndsAt || null,
        enabled: Boolean(draft.enabled),
        freeUses: Number(draft.freeUses || 0),
      });
      if (product.durationDays !== null && product.durationDays !== undefined) {
        await api.patch(`/admin/payments/products/${product.code}/duration`, {
          durationDays: Number(draft.durationDays || product.durationDays || 30),
        });
      }
      setMessage(`${product.name} atualizado.`);
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível salvar o produto.");
    } finally {
      setSaving(null);
    }
  };

  const simulatePayment = async (id: string) => {
    if (!window.confirm("DEV: simular aprovação deste Pix? O benefício será liberado para o usuário, mas o valor NÃO entrará na receita real.")) return;
    setSimulating(id);
    setMessage("");
    try {
      await api.post(`/admin/payments/${id}/simulate`);
      setMessage("Pagamento aprovado em modo DEV. O benefício foi liberado sem contabilizar receita real.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível simular a aprovação deste pagamento.");
    } finally {
      setSimulating(null);
    }
  };

  const prepareActiveJobs = async () => {
    if (!window.confirm("Preparar as vagas ativas que ainda não possuem ficha do Match Inteligente? Cada vaga pendente pode gerar uma chamada de IA.")) return;
    setPreparingMatch(true);
    setMessage("");
    try {
      const response = await api.post("/admin/job-match/backfill?limit=100");
      setMatchOverview(response.data?.overview || {});
      setMessage(`${Number(response.data?.processed || 0)} vaga(s) processada(s) para o Match Inteligente.`);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível preparar as vagas ativas.");
    } finally {
      setPreparingMatch(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Financeiro · Pix</p>
        <h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">Pagamentos e monetização</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Gerencie preços, promoções, recursos premium e o histórico de pagamentos. O checkout desta área aceita somente Pix.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Receita confirmada" value={money(summary.paidAmountCents || 0)} icon={<BadgeDollarSign className="h-4 w-4" />} />
        <Metric label="Pagamentos pagos" value={String(summary.paid || 0)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Metric label="Aguardando Pix" value={String(summary.pending || 0)} icon={<Clock3 className="h-4 w-4" />} />
        <Metric label="Conversão registrada" value={`${paidConversion}%`} icon={<ReceiptText className="h-4 w-4" />} />
        <Metric label="Simulações DEV" value={String(summary.simulated || 0)} icon={<FlaskConical className="h-4 w-4" />} />
      </section>

      <section className="rounded-3xl border border-violet-200 bg-violet-50 p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white"><FlaskConical className="h-4 w-4" /></span>
          <div><p className="text-xs font-black uppercase tracking-[.14em] text-violet-700">Modo DEV de pagamentos</p><p className="mt-1 text-sm leading-6 text-violet-800/80">Use <strong>DEV · Aprovar</strong> para testar o fluxo completo de compra. A simulação libera créditos e acessos temporários exatamente como um Pix pago, mas fica marcada no histórico e não soma receita nem conversão financeira real.</p></div>
        </div>
      </section>

      <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-sky-700">Match Inteligente · preparação das vagas</p>
            <h2 className="mt-1 text-lg font-bold text-stone-950">A IA roda quando a vaga fica ativa</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">Novas ativações são preparadas automaticamente. Este botão serve somente para o estoque de vagas que já estava ativo antes da implantação ou para fichas que falharam.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="rounded-full bg-white px-3 py-1.5 text-stone-600">Ativas {Number(matchOverview.active || 0)}</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">Prontas {Number(matchOverview.ready || 0)}</span>
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-700">Pendentes {Number(matchOverview.pending || 0)}</span>
              <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-700">Erros {Number(matchOverview.error || 0)}</span>
              <span className="rounded-full bg-stone-200 px-3 py-1.5 text-stone-600">Sem ficha {Number(matchOverview.missing || 0)}</span>
            </div>
          </div>
          <button type="button" disabled={preparingMatch} onClick={() => void prepareActiveJobs()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${preparingMatch ? "animate-spin" : ""}`} /> {preparingMatch ? "Preparando..." : "Preparar vagas ativas"}</button>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-stone-900">Produtos e regras</h2><p className="mt-1 text-xs text-stone-500">Preço, promoção, duração e disponibilidade são administráveis daqui.</p></div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><QrCode className="mr-1.5 inline h-3.5 w-3.5" /> Somente Pix</div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {products.map((product) => {
            const draft = drafts[product.code] || {};
            const hasDuration = product.durationDays !== null && product.durationDays !== undefined;
            return (
              <div key={product.code} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-terracotta-600">{product.code}</p><h3 className="mt-1 font-bold text-stone-900">{product.name}</h3><p className="mt-1 text-xs leading-5 text-stone-500">{product.description}</p>{product.billingType === "RECURRING" && <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-violet-600">Produto recorrente</p>}</div><Sparkles className="h-5 w-5 shrink-0 text-violet-400" /></div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Preço normal (R$)" value={draft.price ?? ""} onChange={(value) => patchDraft(product.code, { price: value })} />
                  <Field label="Preço promocional" value={draft.promoPrice ?? ""} onChange={(value) => patchDraft(product.code, { promoPrice: value })} placeholder="Opcional" />
                  <Field label="Início promoção" value={draft.promotionStartsAt ?? ""} onChange={(value) => patchDraft(product.code, { promotionStartsAt: value })} type="datetime-local" />
                  <Field label="Fim promoção" value={draft.promotionEndsAt ?? ""} onChange={(value) => patchDraft(product.code, { promotionEndsAt: value })} type="datetime-local" />
                  {hasDuration && <Field label={product.billingType === "RECURRING" ? "Duração do ciclo (dias)" : "Duração do acesso (dias)"} value={String(draft.durationDays ?? product.durationDays ?? 30)} onChange={(value) => patchDraft(product.code, { durationDays: Math.max(1, Number(value || 1)) })} type="number" />}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5">
                  <label className="text-xs font-bold text-stone-600">Usos gratuitos</label>
                  <input type="number" min={0} value={draft.freeUses ?? 0} onChange={(event) => patchDraft(product.code, { freeUses: Math.max(0, Number(event.target.value || 0)) })} className="w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-right text-sm" />
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-white px-3 py-2.5"><span className="text-xs font-bold text-stone-600">Produto disponível</span><input type="checkbox" checked={Boolean(draft.enabled)} onChange={(event) => patchDraft(product.code, { enabled: event.target.checked })} /></label>
                <button type="button" onClick={() => void saveProduct(product)} disabled={saving === product.code} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving === product.code ? "Salvando..." : "Salvar regras"}</button>
              </div>
            );
          })}
        </div>
        {message && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{message}</div>}
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div><h2 className="text-lg font-bold text-stone-900">Registro de pagamentos</h2><p className="mt-1 text-xs text-stone-500">Histórico financeiro com usuário, produto, valor e situação do Pix. Testes DEV ficam identificados e fora da receita real.</p></div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-3 py-3">Usuário</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Criado</th><th className="px-3 py-3"></th></tr></thead>
            <tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-stone-100"><td className="px-3 py-3"><p className="font-bold text-stone-800">{payment.fullName || payment.displayName || "Usuário"}</p><p className="text-xs text-stone-400">{payment.email}</p></td><td className="px-3 py-3 text-stone-600">{payment.productName || payment.productCode}</td><td className="px-3 py-3 font-bold text-stone-900">{money(payment.amountCents)}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${payment.isSimulation ? "bg-violet-100 text-violet-700" : payment.status === "PAID" ? "bg-emerald-100 text-emerald-700" : payment.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>{payment.isSimulation ? "DEV · SIMULADO" : payment.status}</span></td><td className="px-3 py-3 text-xs text-stone-400">{dateLabel(payment.createdAt)}</td><td className="px-3 py-3 text-right">{payment.status === "PENDING" && <button type="button" onClick={() => void simulatePayment(payment.id)} disabled={simulating === payment.id} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:opacity-50"><FlaskConical className="h-3.5 w-3.5" />{simulating === payment.id ? "Simulando..." : "DEV · Aprovar"}</button>}</td></tr>)}</tbody>
          </table>
          {payments.length === 0 && <p className="py-8 text-center text-sm text-stone-400">Nenhum pagamento registrado.</p>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-stone-400"><p className="text-[10px] font-black uppercase tracking-[.14em]">{label}</p>{icon}</div><p className="mt-3 text-2xl font-black text-stone-900">{value}</p></div>;
}
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-terracotta-400" /></label>;
}
