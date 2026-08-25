import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  Crown,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(cents || 0) / 100,
  );

type PlanId = "FREE" | "PLUS" | "ELITE";
type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  monthly: boolean;
  description: string;
  features: string[];
  current?: boolean;
};

type CurrentPlan = {
  plan: PlanId;
  active: boolean;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  advertisingEligible?: boolean;
};

export function CompanyPlansPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<{
    company?: { id: string; name: string };
    current?: CurrentPlan;
    plans?: Plan[];
  }>({});
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [payer, setPayer] = useState({ name: "", document: "", email: "" });
  const [checkout, setCheckout] = useState<any>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/company/plans");
      setData(response.data || {});
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível carregar os planos da empresa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const chosen = useMemo(
    () => (data.plans || []).find((plan) => plan.id === selected) || null,
    [data.plans, selected],
  );

  const subscribe = async () => {
    if (!selected || selected === "FREE") return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await api.post("/company/plans/checkout", {
        plan: selected,
        payer: {
          name: payer.name.trim() || undefined,
          document: payer.document.replace(/\D/g, "") || undefined,
          email: payer.email.trim() || undefined,
        },
      });
      setCheckout(response.data || null);
      if (response.data?.devSimulation) {
        setMessage(`Plano ${selected} ativado em modo DEV.`);
        await load();
      } else {
        setMessage("Checkout criado. Conclua a autorização/pagamento para ativar o plano da empresa.");
      }
    } catch (error: any) {
      const payload = error?.response?.data;
      setMessage(payload?.message || payload?.error || error?.message || "Não foi possível iniciar a assinatura.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRenewal = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      await api.patch("/company/plans/cancel-at-period-end", { enabled: true });
      setMessage("A renovação foi marcada para encerrar ao final do período atual.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível alterar a renovação.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyPix = async () => {
    const value = String(checkout?.pixCopyPaste || "");
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setMessage("Código Pix copiado.");
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center text-stone-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando planos...
      </div>
    );
  }

  const current = data.current?.plan || "FREE";
  const subscriptionUrl = checkout?.metadata?.subscriptionCheckoutUrl || checkout?.metadata?.ticketUrl;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="overflow-hidden rounded-[32px] bg-[#1b1b18] p-7 text-white shadow-xl sm:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
              <Sparkles className="h-3.5 w-3.5" /> PiraNegócios Business
            </div>
            <h1 className="mt-4 font-serif text-4xl font-black sm:text-5xl">Planos da empresa</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              Comece no Free e transforme o WhatsApp em uma central de recrutamento conforme sua operação cresce.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Plano atual</p>
            <div className="mt-1 flex items-center gap-2 text-xl font-black">
              <BadgeCheck className="h-5 w-5" /> {current}
            </div>
            {data.current?.currentPeriodEnd && (
              <p className="mt-1 text-xs text-white/45">
                Vigente até {new Date(data.current.currentPeriodEnd).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {(data.plans || []).map((plan) => {
          const active = current === plan.id;
          const elite = plan.id === "ELITE";
          const plus = plan.id === "PLUS";
          return (
            <article
              key={plan.id}
              className={`relative flex min-h-[560px] flex-col rounded-[30px] border p-6 shadow-sm ${
                elite
                  ? "border-violet-200 bg-gradient-to-b from-violet-50 to-white"
                  : plus
                    ? "border-amber-200 bg-gradient-to-b from-amber-50 to-white"
                    : "border-stone-200 bg-white"
              }`}
            >
              {active && (
                <span className="absolute right-5 top-5 rounded-full bg-stone-900 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-white">
                  Seu plano
                </span>
              )}
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${elite ? "bg-violet-900 text-white" : plus ? "bg-amber-400 text-stone-950" : "bg-stone-100 text-stone-700"}`}>
                {elite ? <Crown className="h-5 w-5" /> : plus ? <Zap className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
              <h2 className="mt-5 font-serif text-3xl font-black text-stone-950">{plan.name}</h2>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-3xl font-black text-stone-950">{plan.priceCents ? money(plan.priceCents) : "Grátis"}</span>
                {plan.monthly && <span className="pb-1 text-xs font-bold text-stone-400">/mês</span>}
              </div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-stone-500">{plan.description}</p>
              <div className="my-5 h-px bg-stone-200/80" />
              <ul className="flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm leading-5 text-stone-700">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${elite ? "bg-violet-100 text-violet-700" : plus ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"}`}>
                      <Check className="h-3 w-3" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={active || plan.id === "FREE"}
                onClick={() => {
                  setSelected(plan.id);
                  setCheckout(null);
                  setMessage("");
                }}
                className={`mt-6 w-full rounded-2xl px-4 py-3.5 text-xs font-black transition disabled:cursor-default ${
                  active || plan.id === "FREE"
                    ? "bg-stone-100 text-stone-400"
                    : elite
                      ? "bg-violet-900 text-white hover:bg-violet-800"
                      : "bg-stone-900 text-white hover:bg-black"
                }`}
              >
                {active ? "Plano atual" : plan.id === "FREE" ? "Incluído" : `Assinar ${plan.name}`}
              </button>
            </article>
          );
        })}
      </div>

      {chosen && chosen.id !== "FREE" && (
        <section className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">Assinatura mensal</p>
              <h3 className="mt-2 font-serif text-3xl font-black text-stone-950">Ativar {chosen.name}</h3>
              <p className="mt-2 text-sm text-stone-500">{money(chosen.priceCents)} por mês via método recorrente habilitado no PiraNegócios.</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-xs font-bold text-stone-400 hover:text-stone-700">Fechar</button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="text-xs font-bold text-stone-600">Nome do pagador<input value={payer.name} onChange={(e) => setPayer((v) => ({ ...v, name: e.target.value }))} className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-500" placeholder="Nome completo" /></label>
            <label className="text-xs font-bold text-stone-600">CPF<input value={payer.document} onChange={(e) => setPayer((v) => ({ ...v, document: e.target.value }))} className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-500" placeholder="000.000.000-00" /></label>
            <label className="text-xs font-bold text-stone-600">E-mail<input value={payer.email} onChange={(e) => setPayer((v) => ({ ...v, email: e.target.value }))} className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-500" placeholder="financeiro@empresa.com" /></label>
          </div>
          <button type="button" disabled={submitting} onClick={() => void subscribe()} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-3.5 text-xs font-black text-white disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Criar assinatura
          </button>
        </section>
      )}

      {checkout && !checkout.devSimulation && (
        <section className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Checkout criado</p>
          <h3 className="mt-2 font-serif text-2xl font-black text-emerald-950">Conclua a autorização para ativar o plano</h3>
          {subscriptionUrl && <a href={subscriptionUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-2xl bg-emerald-900 px-5 py-3 text-xs font-black text-white">Abrir checkout recorrente</a>}
          {checkout.qrCodeBase64 && <img src={checkout.qrCodeBase64.startsWith("data:") ? checkout.qrCodeBase64 : `data:image/png;base64,${checkout.qrCodeBase64}`} alt="QR Code Pix" className="mt-5 h-48 w-48 rounded-2xl bg-white p-2" />}
          {checkout.pixCopyPaste && (
            <div className="mt-5 flex max-w-2xl gap-2 rounded-2xl border border-emerald-200 bg-white p-2">
              <code className="min-w-0 flex-1 truncate px-2 py-2 text-xs text-stone-600">{checkout.pixCopyPaste}</code>
              <button type="button" onClick={() => void copyPix()} className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white"><Copy className="h-4 w-4" /></button>
            </div>
          )}
          <button type="button" onClick={() => void load()} className="mt-5 inline-flex items-center gap-2 text-xs font-black text-emerald-900"><RefreshCw className="h-4 w-4" /> Já paguei, atualizar plano</button>
        </section>
      )}

      {data.current?.active && !data.current.cancelAtPeriodEnd && (
        <section className="flex flex-col gap-4 rounded-[26px] border border-stone-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-black text-stone-900">Renovação automática ativa</p><p className="mt-1 text-xs text-stone-500">Você pode solicitar o encerramento ao fim do período atual sem perder o acesso imediatamente.</p></div>
          <button type="button" disabled={submitting} onClick={() => void cancelRenewal()} className="rounded-2xl border border-stone-200 px-4 py-3 text-xs font-bold text-stone-600 hover:bg-stone-50">Encerrar ao fim do período</button>
        </section>
      )}

      {data.current?.advertisingEligible && (
        <section className="rounded-[26px] border border-violet-200 bg-violet-50 p-5 text-violet-950">
          <div className="flex gap-3"><Crown className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-black">Elegível aos destaques Meta + Google</p><p className="mt-1 text-xs leading-5 text-violet-800/75">Enquanto o Elite estiver ativo, sua empresa integra a fila de elegibilidade dos destaques publicitários do PiraNegócios. A seleção e distribuição seguem a operação das campanhas ativas.</p></div></div>
        </section>
      )}

      {message && <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700">{message}</div>}
    </div>
  );
}
