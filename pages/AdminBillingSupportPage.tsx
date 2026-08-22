import React, { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarClock, Crown, Gift, Loader2, Search, Sparkles, UserCog, WalletCards, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const CREDIT_FEATURES = [
  ["RESUME_REANALYSIS", "Reanálises"],
  ["RESUME_AI_IMPROVEMENT", "Otimizações IA"],
  ["RESUME_AI_IMPORT", "Organizações por IA"],
] as const;

function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function money(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AdminBillingSupportPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [support, setSupport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [creditDrafts, setCreditDrafts] = useState<Record<string, number>>({});

  const searchUsers = async (value = query) => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/payments/users?q=${encodeURIComponent(value)}&limit=50`);
      setUsers(Array.isArray(response.data) ? response.data : []);
    } finally {
      setLoading(false);
    }
  };

  const loadSupport = async (userId: string) => {
    setSelectedId(userId);
    setWorking("load");
    setMessage("");
    try {
      const response = await api.get(`/admin/payments/users/${userId}/support`);
      setSupport(response.data);
      setCreditDrafts(Object.fromEntries(CREDIT_FEATURES.map(([feature]) => [feature, Number(response.data?.credits?.[feature] || 0)])));
      setNote(response.data?.billing?.note || "");
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível carregar o financeiro deste usuário.");
    } finally {
      setWorking("");
    }
  };

  useEffect(() => { void searchUsers(""); }, []);

  const refresh = async () => {
    if (selectedId) await loadSupport(selectedId);
    await searchUsers(query);
  };

  const setLifetime = async (enabled: boolean) => {
    if (!selectedId) return;
    if (enabled && !window.confirm("Marcar esta conta como VITALÍCIA? Recursos pagos deixarão de exigir cobrança para este usuário.")) return;
    setWorking("lifetime");
    try {
      await api.patch(`/admin/payments/users/${selectedId}/lifetime`, { enabled, note });
      setMessage(enabled ? "Conta vitalícia ativada." : "Conta vitalícia removida.");
      await refresh();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível alterar a conta vitalícia.");
    } finally { setWorking(""); }
  };

  const saveCredit = async (feature: string) => {
    if (!selectedId) return;
    setWorking(`credit-${feature}`);
    try {
      await api.patch(`/admin/payments/users/${selectedId}/credits/${feature}`, { quantity: Number(creditDrafts[feature] || 0), note });
      setMessage("Saldo de consultas atualizado e registrado no histórico de suporte.");
      await refresh();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível atualizar o saldo.");
    } finally { setWorking(""); }
  };

  const grantFeature = async (feature: "JOB_MATCH_PREMIUM" | "RESUME_BOOST", days: number) => {
    if (!selectedId) return;
    setWorking(`feature-${feature}`);
    try {
      await api.post(`/admin/payments/users/${selectedId}/entitlements/${feature}`, { durationDays: days, note });
      setMessage(`${feature === "RESUME_BOOST" ? "Impulso" : "Match Inteligente"} concedido por ${days} dias.`);
      await refresh();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível conceder o benefício.");
    } finally { setWorking(""); }
  };

  const revokeFeature = async (feature: "JOB_MATCH_PREMIUM" | "RESUME_BOOST") => {
    if (!selectedId || !window.confirm("Revogar este benefício agora?")) return;
    setWorking(`revoke-${feature}`);
    try {
      await api.post(`/admin/payments/users/${selectedId}/entitlements/${feature}/revoke`, { note });
      setMessage("Benefício revogado.");
      await refresh();
    } finally { setWorking(""); }
  };

  const activateSubscription = async () => {
    if (!selectedId) return;
    setWorking("subscription");
    try {
      await api.post(`/admin/payments/users/${selectedId}/subscriptions`, { productCode: "PREMIUM_MONTHLY", durationDays: 30, note });
      setMessage("Plano Destaque ativado/estendido por 30 dias.");
      await refresh();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível ativar a assinatura.");
    } finally { setWorking(""); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <Link to="/admin/pagamentos" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-terracotta-600"><ArrowLeft className="h-4 w-4" /> Pagamentos</Link>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">Suporte · Financeiro do usuário</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-stone-950">Benefícios, consultas e assinaturas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Resolva falhas de IA, cortesias e acessos sem criar pagamentos fictícios. Toda alteração manual fica separada do financeiro real.</p>
      </header>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-4 top-3.5 h-4 w-4 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void searchUsers()} placeholder="Nome ou e-mail do usuário" className="w-full rounded-xl border border-stone-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-400" /></div><button onClick={() => void searchUsers()} className="rounded-xl bg-stone-900 px-5 text-sm font-bold text-white">Buscar</button></div>
        {loading ? <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{users.map((item) => <button key={item.id} onClick={() => void loadSupport(item.id)} className={`rounded-2xl border p-4 text-left ${selectedId === item.id ? "border-violet-300 bg-violet-50" : "border-stone-200 bg-stone-50/50"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-stone-900">{item.fullName || item.displayName || "Usuário"}</p><p className="truncate text-xs text-stone-400">{item.email}</p></div>{item.lifetimeFree ? <Crown className="h-4 w-4 text-amber-500" /> : item.subscriptionActive ? <BadgeCheck className="h-4 w-4 text-emerald-500" /> : null}</div><div className="mt-3 flex gap-2 text-[9px] font-black uppercase tracking-wider"><span className="rounded-full bg-white px-2 py-1 text-stone-500">{item.totalCredits || 0} créditos</span>{item.subscriptionActive && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Assinante</span>}{item.lifetimeFree && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Vitalício</span>}</div></button>)}</div>}
      </section>

      {support && (
        <>
          <section className="grid gap-4 lg:grid-cols-[1fr_.7fr]">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-stone-400">Conta selecionada</p><h2 className="mt-1 text-xl font-bold text-stone-950">{support.user.fullName || support.user.displayName}</h2><p className="text-sm text-stone-500">{support.user.email}</p></div><UserCog className="h-6 w-6 text-violet-500" /></div>
              <label className="mt-5 block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Observação do suporte</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Ex.: crédito devolvido após erro na análise" className="w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-violet-400" /></label>
            </div>
            <div className={`rounded-3xl border p-5 shadow-sm ${support.billing?.lifetimeFree ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}><div className="flex items-center gap-3"><Crown className="h-6 w-6 text-amber-500" /><div><h2 className="font-bold text-stone-950">Conta Vitalícia</h2><p className="text-xs leading-5 text-stone-500">Não exige pagamento em recursos pagos. Impulso continua sendo ativado por período, mas sem Pix.</p></div></div><button disabled={working === "lifetime"} onClick={() => void setLifetime(!support.billing?.lifetimeFree)} className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-black ${support.billing?.lifetimeFree ? "border border-amber-300 bg-white text-amber-700" : "bg-amber-500 text-white"}`}>{support.billing?.lifetimeFree ? "Remover vitalício" : "Ativar conta vitalícia"}</button></div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-violet-500" /><div><h2 className="font-bold text-stone-950">Consultas e créditos</h2><p className="text-xs text-stone-500">Defina o saldo exato. Ideal para devolver consulta após erro.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-3">{CREDIT_FEATURES.map(([feature, label]) => <div key={feature} className="rounded-2xl bg-stone-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-stone-400">{label}</p><input type="number" min={0} value={creditDrafts[feature] ?? 0} onChange={(event) => setCreditDrafts((current) => ({ ...current, [feature]: Math.max(0, Number(event.target.value || 0)) }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-2xl font-black" /><button disabled={working === `credit-${feature}`} onClick={() => void saveCredit(feature)} className="mt-3 w-full rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white">Salvar saldo</button></div>)}</div></section>

          <section className="grid gap-4 lg:grid-cols-3">
            <BenefitCard icon={<Sparkles className="h-5 w-5" />} title="Match Inteligente" description="Libere a pontuação premium por período." active={support.entitlements?.some((item: any) => item.feature === "JOB_MATCH_PREMIUM" && item.active)} expiry={support.entitlements?.find((item: any) => item.feature === "JOB_MATCH_PREMIUM")?.expiresAt} onGrant={() => void grantFeature("JOB_MATCH_PREMIUM", 30)} onRevoke={() => void revokeFeature("JOB_MATCH_PREMIUM")} grantLabel="+30 dias" />
            <BenefitCard icon={<Zap className="h-5 w-5" />} title="Impulso de currículo" description="Prioridade dentro da mesma faixa de compatibilidade." active={support.entitlements?.some((item: any) => item.feature === "RESUME_BOOST" && item.active)} expiry={support.entitlements?.find((item: any) => item.feature === "RESUME_BOOST")?.expiresAt} onGrant={() => void grantFeature("RESUME_BOOST", 15)} onRevoke={() => void revokeFeature("RESUME_BOOST")} grantLabel="+15 dias" />
            <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5"><div className="flex items-center gap-3 text-violet-700"><CalendarClock className="h-5 w-5" /><h3 className="font-bold">Plano Destaque mensal</h3></div><p className="mt-2 text-xs leading-5 text-stone-600">Ativa/estende 30 dias de assinatura, Match e Impulso.</p><button disabled={working === "subscription"} onClick={() => void activateSubscription()} className="mt-5 w-full rounded-xl bg-violet-700 px-4 py-3 text-xs font-black text-white">Ativar / +30 dias</button>{support.subscriptions?.[0] && <p className="mt-3 text-[10px] font-bold text-violet-700">{support.subscriptions[0].status} · até {dateLabel(support.subscriptions[0].currentPeriodEnd)}</p>}</div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-stone-950">Últimos pagamentos</h2><div className="mt-4 space-y-2">{support.payments?.slice(0, 10).map((payment: any) => <div key={payment.id} className="flex items-center justify-between rounded-xl bg-stone-50 p-3"><div><p className="text-xs font-bold text-stone-800">{payment.productName || payment.productCode}</p><p className="text-[10px] text-stone-400">{dateLabel(payment.createdAt)} · {payment.isSimulation ? "DEV" : payment.status}</p></div><strong className="text-sm">{money(payment.amountCents)}</strong></div>)}{!support.payments?.length && <p className="text-sm text-stone-400">Nenhum pagamento.</p>}</div></div>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-stone-950">Ajustes de suporte</h2><div className="mt-4 space-y-2">{support.creditLedger?.slice(0, 10).map((entry: any) => <div key={entry.id} className="rounded-xl bg-stone-50 p-3"><div className="flex justify-between"><p className="text-xs font-bold text-stone-800">{entry.feature}</p><strong className={`text-xs ${Number(entry.delta) > 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(entry.delta) > 0 ? "+" : ""}{entry.delta}</strong></div><p className="mt-1 text-[10px] text-stone-400">{dateLabel(entry.createdAt)} · {entry.reason}</p>{entry.note && <p className="mt-1 text-[11px] text-stone-600">{entry.note}</p>}</div>)}{!support.creditLedger?.length && <p className="text-sm text-stone-400">Nenhum ajuste manual ainda.</p>}</div></div>
          </section>
        </>
      )}

      {message && <div className="sticky bottom-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800 shadow-lg">{message}</div>}
    </div>
  );
}

function BenefitCard({ icon, title, description, active, expiry, onGrant, onRevoke, grantLabel }: { icon: React.ReactNode; title: string; description: string; active: boolean; expiry?: string; onGrant: () => void; onRevoke: () => void; grantLabel: string }) {
  return <div className={`rounded-3xl border p-5 ${active ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"}`}><div className={`flex items-center gap-3 ${active ? "text-emerald-700" : "text-stone-600"}`}>{icon}<h3 className="font-bold">{title}</h3></div><p className="mt-2 text-xs leading-5 text-stone-500">{description}</p><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-stone-400">{active ? `Ativo até ${dateLabel(expiry)}` : "Inativo"}</p><div className="mt-4 flex gap-2"><button onClick={onGrant} className="flex-1 rounded-xl bg-stone-900 px-3 py-2.5 text-xs font-black text-white"><Gift className="mr-1 inline h-3.5 w-3.5" /> {grantLabel}</button>{active && <button onClick={onRevoke} className="rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-bold text-red-600">Revogar</button>}</div></div>;
}
