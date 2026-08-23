import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Clock3, FileText, History, Loader2, Lock, QrCode, Sparkles, TrendingUp, WandSparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

function money(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function scoreClass(score: number) {
  if (score >= 75) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 55) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

export function ResumeEvolutionPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any>({ analyses: [], improvements: [], publications: [] });
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<any>(null);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [historyResponse, statusResponse] = await Promise.all([
        api.get("/payments/me/resume-history"),
        api.get("/ai/status"),
      ]);
      setHistory(historyResponse.data || { analyses: [], improvements: [], publications: [] });
      setAiStatus(statusResponse.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const analyses = Array.isArray(history.analyses) ? history.analyses : [];
  const publications = Array.isArray(history.publications) ? history.publications : [];
  const currentScore = profile?.aiAnalysis?.score !== undefined ? Math.max(0, Math.min(100, Math.round(Number(profile.aiAnalysis.score)))) : null;
  const reanalysisProduct = aiStatus?.products?.reanalysis;
  const improvementProduct = aiStatus?.products?.improvement;
  const reanalysisCredit = Number(aiStatus?.credits?.RESUME_REANALYSIS || 0);
  const improvementCredit = Number(aiStatus?.credits?.RESUME_AI_IMPROVEMENT || 0);
  const freeAnalysis = Boolean(aiStatus?.freeResumeAnalysisAvailable);
  const paymentAccessOverride = Boolean(aiStatus?.paymentAccessOverride);
  const accessLabel = aiStatus?.devMode ? "Liberado em DEV" : aiStatus?.lifetimeFree ? "Incluído no vitalício" : "Disponível";

  const bestScore = useMemo(() => analyses.reduce((best: number, item: any) => Math.max(best, Number(item.score || 0)), currentScore || 0), [analyses, currentScore]);
  const firstScore = analyses.length > 0 ? Number(analyses[analyses.length - 1]?.score || 0) : currentScore;
  const totalGain = currentScore !== null && firstScore !== null ? currentScore - Number(firstScore || 0) : 0;

  const buy = async (productCode: string) => {
    setWorking(productCode);
    setMessage("");
    try {
      const response = await api.post("/payments/pix", { productCode });
      if (response.data?.paymentRequired === false) {
        await load();
        setMessage(response.data?.message || "Recurso liberado sem cobrança.");
        return;
      }
      navigate("/user/pagamentos");
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível criar o Pix agora.");
    } finally {
      setWorking(null);
    }
  };

  const reanalyze = async () => {
    if (!profile) return;
    const canRun = paymentAccessOverride || freeAnalysis || reanalysisCredit > 0 || Number(reanalysisProduct?.effectivePriceCents || 0) === 0;
    if (!canRun) return void buy("RESUME_REANALYSIS");
    setWorking("reanalyze");
    setMessage("");
    try {
      await api.post("/ai/review-resume", { profile }, { timeout: 90000 });
      await refreshProfile();
      await load();
      setMessage("Currículo reavaliado. Sua nova pontuação já entrou no histórico.");
    } catch (error: any) {
      if (error?.response?.data?.code === "PAYMENT_REQUIRED") return void buy("RESUME_REANALYSIS");
      setMessage(error?.response?.data?.message || "Não foi possível reavaliar o currículo agora.");
    } finally {
      setWorking(null);
    }
  };

  const requestImprovement = async () => {
    const canRun = paymentAccessOverride || improvementCredit > 0 || Number(improvementProduct?.effectivePriceCents || 0) === 0;
    if (!canRun) return void buy("RESUME_AI_IMPROVEMENT");
    setWorking("improve");
    setMessage("");
    try {
      const response = await api.post("/ai/improve-resume", {}, { timeout: 120000 });
      const nextProposal = response.data;
      setProposal(nextProposal);
      const ids = (nextProposal?.proposal?.changes || []).map((change: any) => String(change.id));
      setSelectedChanges(new Set(ids));
    } catch (error: any) {
      if (error?.response?.data?.code === "PAYMENT_REQUIRED") return void buy("RESUME_AI_IMPROVEMENT");
      setMessage(error?.response?.data?.message || "Não foi possível preparar as melhorias agora.");
    } finally {
      setWorking(null);
    }
  };

  const applyProposal = async () => {
    if (!proposal?.id || selectedChanges.size === 0) return;
    setWorking("apply");
    setMessage("");
    try {
      const response = await api.post(`/ai/improve-resume/${proposal.id}/apply`, { selectedChangeIds: Array.from(selectedChanges) }, { timeout: 120000 });
      await refreshProfile();
      setProposal(null);
      setSelectedChanges(new Set());
      await load();
      setMessage(response.data?.analysisError || "Melhorias aplicadas ao rascunho e currículo reavaliado.");
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível aplicar as melhorias agora.");
    } finally {
      setWorking(null);
    }
  };

  const unpublish = async () => {
    if (profile?.resumeStatus !== "PUBLISHED") return;
    if (!window.confirm("Tirar seu currículo do ar? O rascunho e todo o histórico continuarão preservados.")) return;
    setWorking("unpublish");
    try {
      await api.patch("/users/me", { resumeStatus: "DRAFT" });
      await refreshProfile();
      await load();
      setMessage("Currículo despublicado. A última versão continua guardada no histórico.");
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível despublicar o currículo.");
    } finally {
      setWorking(null);
    }
  };

  const toggleChange = (id: string) => setSelectedChanges((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/user/curriculo" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-terracotta-600"><ArrowLeft className="h-4 w-4" /> Voltar ao currículo</Link>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Currículo · Evolução</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900">Veja como seu currículo evoluiu</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Notas, publicações e melhorias ficam aqui. No celular, o editor continua leve; a história completa mora nesta tela.</p>
        </div>
        <Link to="/user/pagamentos" className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 shadow-sm"><QrCode className="h-4 w-4" /> Pagamentos</Link>
      </header>

      {paymentAccessOverride && (
        <div className={`rounded-2xl border p-4 text-sm font-semibold ${aiStatus?.devMode ? "border-violet-200 bg-violet-50 text-violet-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {aiStatus?.devMode ? "Modo DEV ativo: análises e melhorias podem ser testadas sem cobrança nem consumo de créditos." : "Conta vitalícia: análises e melhorias estão liberadas sem cobrança nem consumo de créditos."}
        </div>
      )}
      {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">{message}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Pontuação atual" value={currentScore === null ? "--" : `${currentScore}/100`} />
        <Metric label="Melhor pontuação" value={analyses.length || currentScore !== null ? `${bestScore}/100` : "--"} />
        <Metric label="Evolução total" value={analyses.length > 1 || totalGain !== 0 ? `${totalGain >= 0 ? "+" : ""}${totalGain} pts` : "--"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-violet-600">IA de carreira</p><h2 className="mt-1 text-xl font-bold text-stone-900">Fortalecer meu currículo</h2><p className="mt-1 text-sm leading-6 text-stone-500">Você decide o que entra. A IA propõe, compara e nunca aplica automaticamente.</p></div>
            <WandSparkles className="h-6 w-6 text-violet-500" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ActionCard
              title={currentScore === null ? "Fazer primeira análise" : "Reavaliar currículo"}
              description={paymentAccessOverride ? (aiStatus?.devMode ? "Teste liberado pelo modo DEV." : "Incluído no acesso vitalício.") : freeAnalysis ? "Sua primeira análise é gratuita." : reanalysisCredit > 0 ? `Você tem ${reanalysisCredit} crédito disponível.` : "Atualize a pontuação depois das suas mudanças."}
              price={paymentAccessOverride ? accessLabel : freeAnalysis || reanalysisCredit > 0 ? "Disponível" : money(reanalysisProduct?.effectivePriceCents || 199)}
              loading={working === "reanalyze" || working === "RESUME_REANALYSIS"}
              onClick={() => void reanalyze()}
            />
            <ActionCard
              title="Melhorar com IA"
              description={paymentAccessOverride ? (aiStatus?.devMode ? "Teste liberado pelo modo DEV, sem consumir crédito." : "Incluído no acesso vitalício.") : "Receba sugestões profissionais, escolha quais aceitar e ganhe nova análise ao final."}
              price={paymentAccessOverride ? accessLabel : improvementCredit > 0 ? `${improvementCredit} crédito` : money(improvementProduct?.effectivePriceCents || 499)}
              loading={working === "improve" || working === "RESUME_AI_IMPROVEMENT"}
              featured
              onClick={() => void requestImprovement()}
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Publicação atual</p><h2 className="mt-1 text-lg font-bold text-stone-900">{profile?.resumeStatus === "PUBLISHED" ? "Currículo online" : "Somente rascunho"}</h2></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${profile?.resumeStatus === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{profile?.resumeStatus === "PUBLISHED" ? "Publicado" : "Rascunho"}</span></div>
          <p className="mt-3 text-sm leading-6 text-stone-500">Publicar cria uma nova versão no histórico. Despublicar não apaga a versão anterior nem o seu rascunho.</p>
          {profile?.resumeStatus === "PUBLISHED" ? (
            <button type="button" onClick={() => void unpublish()} disabled={working === "unpublish"} className="mt-5 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-50">{working === "unpublish" ? "Despublicando..." : "Despublicar currículo"}</button>
          ) : (
            <Link to="/user/curriculo?stage=publish" className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#2b211c] px-4 py-3 text-sm font-bold text-white">Revisar e publicar rascunho</Link>
          )}
        </div>
      </section>

      {proposal && (
        <section className="rounded-[30px] border border-violet-200 bg-white p-5 shadow-xl shadow-violet-950/5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Comparativo antes × depois</p><h2 className="mt-1 text-2xl font-bold text-stone-900">Escolha o que a IA pode mudar</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">{proposal.proposal?.summary || "Revise cada sugestão. Itens desmarcados continuam exatamente como estão."}</p></div><button type="button" onClick={() => { setProposal(null); setSelectedChanges(new Set()); }} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-500">Fechar</button></div>
          <div className="mt-6 space-y-3">
            {(proposal.proposal?.changes || []).map((change: any) => {
              const selected = selectedChanges.has(String(change.id));
              return <button key={change.id} type="button" onClick={() => toggleChange(String(change.id))} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-violet-300 bg-violet-50/50" : "border-stone-200 bg-stone-50/60 opacity-75"}`}>
                <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${selected ? "border-violet-500 bg-violet-600 text-white" : "border-stone-300 bg-white text-transparent"}`}><Check className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-stone-900">{change.label}</p><span className="text-[9px] font-black uppercase tracking-wider text-violet-500">{change.type}</span></div><p className="mt-1 text-xs leading-5 text-stone-500">{change.reason}</p><div className="mt-3 grid gap-2 md:grid-cols-2"><CompareBox label="Antes" value={change.before} /><CompareBox label="Sugestão" value={change.after} after /></div></div></div>
              </button>;
            })}
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-stone-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{selectedChanges.size} melhoria(s) selecionada(s)</p><p className="mt-1 text-xs text-white/50">Ao aplicar, seu rascunho é atualizado e a nova análise incluída é executada.</p></div><button type="button" onClick={() => void applyProposal()} disabled={working === "apply" || selectedChanges.size === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{working === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Aplicar selecionadas</button></div>
        </section>
      )}

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-emerald-600" /><div><h2 className="font-bold text-stone-900">Histórico de pontuação</h2><p className="text-xs text-stone-500">A nota antiga nunca some. Cada nova análise vira um marco.</p></div></div>
        {loading ? <p className="mt-5 text-sm text-stone-400">Carregando...</p> : analyses.length === 0 ? <p className="mt-5 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Sua primeira análise ainda não foi feita.</p> : <div className="mt-5 space-y-2">{analyses.map((item: any, index: number) => {
          const older = analyses[index + 1];
          const delta = older ? Number(item.score) - Number(older.score) : null;
          return <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-stone-200 p-4"><span className={`flex h-12 w-16 shrink-0 items-center justify-center rounded-xl border text-lg font-black ${scoreClass(Number(item.score || 0))}`}>{item.score}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-stone-900">{item.source === "IMPROVEMENT" ? "Após otimização com IA" : item.source === "REANALYSIS" ? "Nova análise" : "Análise inicial"}</p><p className="mt-1 text-xs text-stone-400">{dateLabel(item.createdAt)}</p></div>{delta !== null && <span className={`rounded-full px-2.5 py-1 text-xs font-black ${delta >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{delta >= 0 ? "+" : ""}{delta}</span>}</div>;
        })}</div>}
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><History className="h-5 w-5 text-stone-500" /><div><h2 className="font-bold text-stone-900">Versões publicadas</h2><p className="text-xs text-stone-500">Cada publicação fica preservada para você acompanhar a evolução.</p></div></div>
        {publications.length === 0 ? <p className="mt-5 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Nenhuma versão foi publicada ainda.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">{publications.map((version: any) => <div key={version.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Versão {version.version}</p><p className="mt-1 text-sm font-bold text-stone-900">Publicada em {dateLabel(version.publishedAt)}</p></div>{version.score !== null && version.score !== undefined && <span className={`rounded-xl border px-2.5 py-1.5 text-xs font-black ${scoreClass(Number(version.score))}`}>{version.score}/100</span>}</div><div className="mt-3 flex items-center justify-between text-xs text-stone-400"><span>{version.status === "PUBLISHED" ? "Versão online" : "Versão arquivada"}</span>{version.unpublishedAt && <span>Retirada em {dateLabel(version.unpublishedAt)}</span>}</div></div>)}</div>}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-2 text-3xl font-black text-stone-900">{value}</p></div>;
}
function ActionCard({ title, description, price, onClick, loading, featured = false }: { title: string; description: string; price: string; onClick: () => void; loading: boolean; featured?: boolean }) {
  return <button type="button" onClick={onClick} disabled={loading} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 disabled:opacity-50 ${featured ? "border-violet-200 bg-violet-50/60" : "border-stone-200 bg-stone-50/70"}`}><div className="flex items-start justify-between gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${featured ? "bg-violet-100 text-violet-700" : "bg-white text-stone-600"}`}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : featured ? <WandSparkles className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</span><span className="text-sm font-black text-stone-900">{price}</span></div><p className="mt-3 text-sm font-bold text-stone-900">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{description}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-terracotta-600">Continuar <ChevronRight className="h-3.5 w-3.5" /></span></button>;
}
function CompareBox({ label, value, after = false }: { label: string; value: unknown; after?: boolean }) {
  const text = Array.isArray(value) ? value.join(" · ") : String(value || "");
  return <div className={`rounded-xl border p-3 ${after ? "border-emerald-200 bg-emerald-50/70" : "border-stone-200 bg-white"}`}><p className={`text-[9px] font-black uppercase tracking-wider ${after ? "text-emerald-600" : "text-stone-400"}`}>{label}</p><p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-stone-700">{text || "Sem conteúdo"}</p></div>;
}
