import React, { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CheckCircle2, Clock3, QrCode, ReceiptText, Save, Sparkles } from "lucide-react";
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
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [summaryResponse, productResponse, paymentResponse] = await Promise.all([
      api.get("/admin/payments/summary"),
      api.get("/admin/payments/products"),
      api.get("/admin/payments?limit=250"),
    ]);
    setSummary(summaryResponse.data || {});
    const nextProducts = Array.isArray(productResponse.data) ? productResponse.data : [];
    setProducts(nextProducts);
    setDrafts(Object.fromEntries(nextProducts.map((product: any) => [product.code, {
      price: toReais(product.priceCents),
      promoPrice: toReais(product.promotionalPriceCents),
      promotionStartsAt: product.promotionStartsAt ? String(product.promotionStartsAt).slice(0, 16) : "",
      promotionEndsAt: product.promotionEndsAt ? String(product.promotionEndsAt).slice(0, 16) : "",
      enabled: Boolean(product.enabled),
      freeUses: Number(product.freeUses || 0),
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
      setMessage(`${product.name} atualizado.`);
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível salvar o produto.");
    } finally {
      setSaving(null);
    }
  };

  const confirmPayment = async (id: string) => {
    if (!window.confirm("Confirmar este Pix manualmente? Use isso apenas enquanto o webhook do provedor não estiver conectado.")) return;
    setConfirming(id);
    try {
      await api.post(`/admin/payments/${id}/confirm`);
      await load();
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Financeiro · Pix</p>
        <h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">Pagamentos e monetização</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Gerencie preços, promoções, franquias gratuitas e o histórico de pagamentos. O checkout desta área aceita somente Pix.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Receita confirmada" value={money(summary.paidAmountCents || 0)} icon={<BadgeDollarSign className="h-4 w-4" />} />
        <Metric label="Pagamentos pagos" value={String(summary.paid || 0)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Metric label="Aguardando Pix" value={String(summary.pending || 0)} icon={<Clock3 className="h-4 w-4" />} />
        <Metric label="Conversão registrada" value={`${paidConversion}%`} icon={<ReceiptText className="h-4 w-4" />} />
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-stone-900">Produtos e regras</h2><p className="mt-1 text-xs text-stone-500">Preço, promoção, disponibilidade e quantidade de usos gratuitos são administráveis daqui.</p></div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><QrCode className="mr-1.5 inline h-3.5 w-3.5" /> Somente Pix</div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {products.map((product) => {
            const draft = drafts[product.code] || {};
            return (
              <div key={product.code} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-terracotta-600">{product.code}</p><h3 className="mt-1 font-bold text-stone-900">{product.name}</h3><p className="mt-1 text-xs leading-5 text-stone-500">{product.description}</p></div><Sparkles className="h-5 w-5 shrink-0 text-violet-400" /></div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Preço normal (R$)" value={draft.price ?? ""} onChange={(value) => patchDraft(product.code, { price: value })} />
                  <Field label="Preço promocional" value={draft.promoPrice ?? ""} onChange={(value) => patchDraft(product.code, { promoPrice: value })} placeholder="Opcional" />
                  <Field label="Início promoção" value={draft.promotionStartsAt ?? ""} onChange={(value) => patchDraft(product.code, { promotionStartsAt: value })} type="datetime-local" />
                  <Field label="Fim promoção" value={draft.promotionEndsAt ?? ""} onChange={(value) => patchDraft(product.code, { promotionEndsAt: value })} type="datetime-local" />
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
        <div><h2 className="text-lg font-bold text-stone-900">Registro de pagamentos</h2><p className="mt-1 text-xs text-stone-500">Histórico financeiro com usuário, produto, valor e situação do Pix.</p></div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-400"><th className="px-3 py-3">Usuário</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Criado</th><th className="px-3 py-3"></th></tr></thead>
            <tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-stone-100"><td className="px-3 py-3"><p className="font-bold text-stone-800">{payment.fullName || payment.displayName || "Usuário"}</p><p className="text-xs text-stone-400">{payment.email}</p></td><td className="px-3 py-3 text-stone-600">{payment.productName || payment.productCode}</td><td className="px-3 py-3 font-bold text-stone-900">{money(payment.amountCents)}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${payment.status === "PAID" ? "bg-emerald-100 text-emerald-700" : payment.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>{payment.status}</span></td><td className="px-3 py-3 text-xs text-stone-400">{dateLabel(payment.createdAt)}</td><td className="px-3 py-3 text-right">{payment.status === "PENDING" && <button type="button" onClick={() => void confirmPayment(payment.id)} disabled={confirming === payment.id} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50">{confirming === payment.id ? "Confirmando..." : "Confirmar teste"}</button>}</td></tr>)}</tbody>
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
