import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  FileText,
  History,
  Loader2,
  Minus,
  Printer,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WandSparkles,
  X,
} from "lucide-react";
import { ResumeBuilderPage } from "./ResumeBuilderPage";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { PaymentCheckoutModal } from "../components/payments/PaymentCheckoutModal";

type AiAction = "improve" | "apply" | null;

type ScoreResult = {
  before: number | null;
  after: number | null;
  note?: string | null;
};

const AI_PROGRESS: Record<Exclude<AiAction, null>, string[]> = {
  improve: [
    "Lendo seu currículo sem alterar nada ainda.",
    "Localizando trechos que podem ficar mais fortes e objetivos.",
    "Montando sugestões antes × depois para você escolher.",
    "Finalizando a proposta de otimização.",
  ],
  apply: [
    "Aplicando somente as melhorias que você selecionou.",
    "Atualizando o rascunho do currículo.",
    "Reavaliando a nova versão.",
    "Comparando a pontuação antes × depois.",
  ],
};

function scoreOf(profile: any): number | null {
  const raw = profile?.aiAnalysis?.score;
  if (raw === undefined || raw === null || Number.isNaN(Number(raw))) return null;
  return Math.max(0, Math.min(100, Math.round(Number(raw))));
}

function apiMessage(error: any, fallback: string) {
  const raw = error?.response?.data?.message;
  if (Array.isArray(raw)) return raw.join(" · ");
  return raw || error?.message || fallback;
}

export function ResumeBuilderStudio() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [aiAction, setAiAction] = useState<AiAction>(null);
  const [aiStage, setAiStage] = useState(0);
  const [aiError, setAiError] = useState("");
  const [proposal, setProposal] = useState<any>(null);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [paymentProduct, setPaymentProduct] = useState<any | null>(null);

  const aiBusy = Boolean(aiAction);
  const progressMessages = aiAction ? AI_PROGRESS[aiAction] : [];

  useEffect(() => {
    if (!aiAction) {
      setAiStage(0);
      return;
    }
    setAiStage(0);
    const timer = window.setInterval(() => {
      setAiStage((current) => Math.min(AI_PROGRESS[aiAction].length - 1, current + 1));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [aiAction]);

  useEffect(() => {
    if (!scoreResult) return;
    const timer = window.setTimeout(() => setScoreResult(null), 9000);
    return () => window.clearTimeout(timer);
  }, [scoreResult]);

  const requestImprovement = useCallback(async () => {
    if (!profile || aiBusy) return;
    setAiError("");
    setScoreResult(null);
    setProposal(null);
    setSelectedChanges(new Set());
    setAiAction("improve");
    try {
      const response = await api.post("/ai/improve-resume", {}, { timeout: 180000 });
      const nextProposal = response.data;
      const ids = (nextProposal?.proposal?.changes || []).map((change: any) => String(change.id));
      setProposal(nextProposal);
      setSelectedChanges(new Set(ids));
    } catch (error: any) {
      if (error?.response?.data?.code === "PAYMENT_REQUIRED") {
        setPaymentProduct(error.response.data.product || {
          code: error.response.data.productCode || "RESUME_AI_IMPROVEMENT",
          name: "Otimização profissional com IA",
          description: "Crédito para preparar uma nova proposta de melhoria do currículo.",
        });
        return;
      }
      setAiError(apiMessage(error, "Não foi possível preparar as melhorias agora."));
    } finally {
      setAiAction(null);
    }
  }, [aiBusy, profile]);

  const applyProposal = useCallback(async () => {
    if (!proposal?.id || selectedChanges.size === 0 || aiBusy) return;
    const before = scoreOf(profile);
    setAiError("");
    setScoreResult(null);
    setAiAction("apply");
    try {
      const response = await api.post(
        `/ai/improve-resume/${proposal.id}/apply`,
        { selectedChangeIds: Array.from(selectedChanges) },
        { timeout: 180000 },
      );
      const analysis = response.data?.analysis;
      const after = analysis?.score !== undefined
        ? Math.max(0, Math.min(100, Math.round(Number(analysis.score))))
        : null;
      await refreshProfile();
      setProposal(null);
      setSelectedChanges(new Set());
      setScoreResult({ before, after, note: response.data?.analysisError || null });
    } catch (error: any) {
      setAiError(apiMessage(error, "Não foi possível aplicar as melhorias agora."));
    } finally {
      setAiAction(null);
    }
  }, [aiBusy, profile, proposal, refreshProfile, selectedChanges]);

  const toggleChange = (id: string) => {
    if (aiBusy) return;
    setSelectedChanges((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scoreDelta = useMemo(() => {
    if (
      scoreResult?.before === null ||
      scoreResult?.after === null ||
      scoreResult?.before === undefined ||
      scoreResult?.after === undefined
    ) return null;
    return scoreResult.after - scoreResult.before;
  }, [scoreResult]);

  return (
    <div className="resume-studio">
      <ResumeStudioTheme />

      <header className="resume-studio-header">
        <div className="resume-studio-header__inner">
          <div className="resume-studio-header__identity">
            <Link to="/user" className="resume-studio-back" aria-label="Voltar ao meu espaço">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="resume-studio-brandline">
                <span className="resume-studio-kicker">PiraNegócios Career</span>
                <span className="resume-studio-dot" />
                <span className="resume-studio-kicker resume-studio-kicker--muted">Currículo</span>
              </div>
              <h1 className="resume-studio-title resume-studio-title--desktop">Seu currículo profissional</h1>
              <h1 className="resume-studio-title resume-studio-title--mobile">Currículo</h1>
            </div>
          </div>

          <div className="resume-studio-header__actions">
            <button
              type="button"
              onClick={() => void requestImprovement()}
              disabled={aiBusy}
              className="resume-studio-ai-button"
              aria-hidden="true"
              tabIndex={-1}
            >
              <WandSparkles className="h-3.5 w-3.5" />
              Melhorar com IA
            </button>

            <button
              type="button"
              onClick={() => navigate("/user/curriculo/evolucao")}
              className="resume-studio-action resume-studio-action--evolution"
              aria-label="Evolução do currículo"
              title="Evolução do currículo"
            >
              <History className="h-4 w-4" />
              <span>Evolução</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/user/curriculo?stage=publish")}
              className="resume-studio-action"
              aria-label="Versões do currículo"
              title="Versões"
            >
              <FileText className="h-4 w-4" />
              <span>Versões</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="resume-studio-action resume-studio-action--pdf"
              aria-label="Salvar currículo em PDF"
              title="PDF"
            >
              <Printer className="h-4 w-4" />
              <span>PDF</span>
            </button>

            <span className="resume-studio-status">
              <ShieldCheck className="h-3.5 w-3.5" />
              Integrado ao seu perfil
            </span>
          </div>
        </div>
      </header>

      <main className="resume-studio-body">
        <ResumeBuilderPage />
      </main>

      {aiBusy && aiAction && (
        <div className="resume-ai-blocker" role="status" aria-live="polite">
          <div className="resume-ai-progress-card">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-600">IA trabalhando</p>
                <h2 className="mt-1 text-sm font-black text-stone-950">
                  {aiAction === "improve" ? "Preparando suas melhorias" : "Aplicando e medindo o resultado"}
                </h2>
                <p className="mt-1 text-[11px] leading-4 text-stone-500">Outras ações ficam bloqueadas até esta etapa terminar.</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {progressMessages.map((message, index) => (
                <div
                  key={message}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] transition ${
                    index === aiStage
                      ? "bg-violet-50 font-bold text-violet-800"
                      : index < aiStage
                        ? "text-emerald-700"
                        : "text-stone-400"
                  }`}
                >
                  {index < aiStage ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : index === aiStage ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                  <span>{message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {proposal && !aiBusy && (
        <aside className="resume-ai-proposal" aria-label="Sugestões de melhoria do currículo">
          <div className="resume-ai-proposal__header">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Antes × depois</p>
              <h2 className="mt-1 text-lg font-black text-stone-950">Escolha o que entra no currículo</h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {proposal.proposal?.summary || "A IA sugeriu mudanças. Você mantém o controle de cada uma."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setProposal(null);
                setSelectedChanges(new Set());
              }}
              className="resume-ai-close"
              aria-label="Fechar sugestões"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="resume-ai-proposal__list">
            {(proposal.proposal?.changes || []).map((change: any) => {
              const id = String(change.id);
              const selected = selectedChanges.has(id);
              const before = Array.isArray(change.before) ? change.before.join(" · ") : String(change.before || "");
              const after = Array.isArray(change.after) ? change.after.join(" · ") : String(change.after || "");
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleChange(id)}
                  className={`resume-ai-change ${selected ? "resume-ai-change--selected" : ""}`}
                >
                  <span className={`resume-ai-check ${selected ? "resume-ai-check--selected" : ""}`}>
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-xs font-black text-stone-900">{change.label || "Melhoria sugerida"}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-stone-500">{change.reason || ""}</span>
                    <span className="mt-2 grid gap-1.5">
                      <span className="rounded-lg bg-stone-100 px-2.5 py-2 text-[10px] leading-4 text-stone-500">
                        <strong className="text-stone-400">Antes:</strong> {before || "Sem conteúdo"}
                      </span>
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-2 text-[10px] leading-4 text-emerald-800">
                        <strong className="text-emerald-600">Depois:</strong> {after || "Sem conteúdo"}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="resume-ai-proposal__footer">
            <div>
              <p className="text-xs font-black text-stone-900">{selectedChanges.size} selecionada(s)</p>
              <p className="text-[10px] text-stone-400">Depois de aplicar, a pontuação é recalculada.</p>
            </div>
            <button
              type="button"
              onClick={() => void applyProposal()}
              disabled={selectedChanges.size === 0}
              className="resume-ai-apply"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Aplicar e reavaliar
            </button>
          </div>
        </aside>
      )}

      {scoreResult && (
        <div className="resume-score-result">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                scoreDelta !== null && scoreDelta > 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {scoreDelta !== null && scoreDelta > 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <Minus className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Resultado da reavaliação</p>
              {scoreResult.after !== null ? (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  {scoreResult.before !== null && <span className="text-sm font-bold text-stone-400">{scoreResult.before}</span>}
                  {scoreResult.before !== null && <span className="text-stone-300">→</span>}
                  <span className="text-2xl font-black text-stone-950">
                    {scoreResult.after}<span className="text-xs text-stone-400">/100</span>
                  </span>
                  {scoreDelta !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        scoreDelta > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : scoreDelta < 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {scoreDelta > 0 ? "+" : ""}{scoreDelta} pts
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm font-bold text-stone-800">Currículo atualizado. A pontuação não pôde ser recalculada desta vez.</p>
              )}
              {scoreDelta === 0 && (
                <p className="mt-1 text-[11px] text-stone-500">A redação melhorou, mas os critérios globais da nota permaneceram na mesma faixa.</p>
              )}
              {scoreResult.note && <p className="mt-1 text-[11px] text-amber-700">{scoreResult.note}</p>}
            </div>
            <button type="button" onClick={() => setScoreResult(null)} className="ml-auto text-stone-400" aria-label="Fechar resultado">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {aiError && !aiBusy && (
        <div className="resume-ai-error">
          <span>{aiError}</span>
          <button type="button" onClick={() => setAiError("")} aria-label="Fechar erro">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PaymentCheckoutModal
        open={Boolean(paymentProduct)}
        onClose={() => setPaymentProduct(null)}
        title={paymentProduct?.name || "Otimização profissional com IA"}
        description={paymentProduct?.description || "Adquira um crédito para continuar sem sair do seu currículo."}
        amountCents={Number(paymentProduct?.effectivePriceCents ?? paymentProduct?.priceCents ?? 0)}
        confirmLabel="Gerar Pix e continuar"
        createCheckout={() => api.post("/payments/pix", { productCode: paymentProduct?.code || "RESUME_AI_IMPROVEMENT" })}
        onCompleted={async () => {
          setPaymentProduct(null);
          window.setTimeout(() => void requestImprovement(), 0);
        }}
      />
    </div>
  );
}

function ResumeStudioTheme() {
  return (
    <style>{`
      .resume-studio {
        --rs-ink: #241914;
        --rs-line: rgba(75, 51, 38, .12);
        min-height: 100vh;
        color: var(--rs-ink);
        background: linear-gradient(180deg, #f8f3ed 0%, #f2ebe3 100%);
      }

      .resume-studio-header {
        position: sticky;
        top: 0;
        z-index: 70;
        border-bottom: 1px solid var(--rs-line);
        background: rgba(249, 244, 238, .97);
        backdrop-filter: blur(18px);
      }

      .resume-studio-header__inner {
        display: flex;
        min-height: 76px;
        max-width: 1600px;
        margin: 0 auto;
        padding: 12px 24px;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }

      .resume-studio-header__identity,
      .resume-studio-header__actions {
        display: flex;
        min-width: 0;
        align-items: center;
      }

      .resume-studio-header__identity { gap: 12px; }
      .resume-studio-header__actions { margin-left: auto; gap: 8px; }

      .resume-studio-back,
      .resume-studio-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--rs-line);
        background: #fffdfa;
        color: #66584f;
        box-shadow: 0 6px 20px rgba(65,43,29,.04);
        transition: .16s ease;
      }

      .resume-studio-back {
        width: 42px;
        height: 42px;
        flex: 0 0 auto;
        border-radius: 14px;
      }

      .resume-studio-action {
        gap: 6px;
        min-height: 36px;
        padding: 8px 11px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 850;
        white-space: nowrap;
      }

      .resume-studio-back:hover,
      .resume-studio-action:hover { border-color: rgba(196,91,60,.3); color: #b55236; }

      .resume-studio-status {
        display: inline-flex;
        min-height: 36px;
        align-items: center;
        gap: 6px;
        padding: 8px 11px;
        border: 1px solid var(--rs-line);
        border-radius: 999px;
        background: rgba(255,253,250,.72);
        color: #8b7d74;
        font-size: 10px;
        font-weight: 800;
        white-space: nowrap;
      }

      .resume-studio-brandline { display:flex; align-items:center; gap:7px; }
      .resume-studio-kicker { font-size:9px; font-weight:850; letter-spacing:.18em; text-transform:uppercase; color:#b55236; }
      .resume-studio-kicker--muted { color:#9b8b81; }
      .resume-studio-dot { width:3px; height:3px; border-radius:999px; background:#cabbb0; }
      .resume-studio-title { margin-top:2px; max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:Georgia,serif; font-size:22px; line-height:1.1; font-weight:800; color:#241914; }
      .resume-studio-title--mobile { display:none; }

      .resume-studio-ai-button { display:none !important; }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > header { display:none !important; }
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col,
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center,
      .resume-studio-body #resume-builder-root { min-height:auto !important; background:transparent !important; }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b {
        position:sticky;
        top:76px;
        z-index:30;
        padding:11px 20px !important;
        border-bottom:1px solid var(--rs-line) !important;
        background:rgba(248,243,237,.97) !important;
        backdrop-filter:blur(14px);
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main { overflow:visible !important; padding:28px 20px 56px !important; }
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl { max-width:920px !important; }
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .bg-white.rounded-2xl.border {
        border-color:var(--rs-line) !important;
        border-radius:28px !important;
        background:#fffdfa !important;
        padding:28px !important;
        box-shadow:0 22px 65px rgba(66,43,28,.07) !important;
      }

      .resume-studio-body #resume-builder-root {
        display:grid !important;
        grid-template-columns:330px minmax(0,1fr);
        align-items:start;
        width:100% !important;
        height:auto !important;
        overflow:visible !important;
      }

      .resume-studio-body #resume-builder-sidebar {
        position:sticky !important;
        top:92px !important;
        align-self:start !important;
        width:330px !important;
        height:auto !important;
        max-height:calc(100vh - 108px) !important;
        overflow-x:hidden !important;
        overflow-y:auto !important;
        overscroll-behavior:contain;
        scrollbar-width:thin;
        border:1px solid var(--rs-line) !important;
        border-radius:0 0 24px 0 !important;
        background:#2b211c !important;
        color:white !important;
        box-shadow:12px 18px 42px rgba(43,33,28,.10);
      }

      .resume-studio-body #resume-builder-sidebar > div:first-child {
        position:sticky;
        top:0;
        z-index:5;
        border-color:rgba(255,255,255,.08) !important;
        background:rgba(43,33,28,.97);
        backdrop-filter:blur(14px);
      }
      .resume-studio-body #resume-builder-sidebar > div:first-child button:first-child { color:rgba(255,255,255,.72) !important; }
      .resume-studio-body #resume-builder-sidebar > .p-5 { overflow:visible !important; }

      .resume-studio-body #resume-preview-area {
        display:flex !important;
        width:100%;
        min-width:0;
        min-height:auto !important;
        height:auto !important;
        overflow:visible !important;
        align-items:flex-start !important;
        justify-content:center !important;
        padding:34px 28px 70px !important;
        background:#ebe4dc !important;
      }
      .resume-studio-body #resume-preview-area > div { flex:0 0 auto; filter:drop-shadow(0 24px 42px rgba(42,29,21,.17)); }

      .resume-ai-blocker {
        position:fixed;
        inset:76px 0 0;
        z-index:90;
        display:flex;
        align-items:flex-start;
        justify-content:flex-end;
        padding:18px;
        background:rgba(244,238,231,.22);
        cursor:progress;
      }
      .resume-ai-progress-card {
        width:min(390px,calc(100vw - 28px));
        border:1px solid rgba(124,58,237,.16);
        border-radius:22px;
        background:rgba(255,253,250,.985);
        padding:16px;
        box-shadow:0 24px 70px rgba(49,33,24,.20);
      }

      .resume-ai-proposal {
        position:fixed;
        z-index:85;
        top:94px;
        right:18px;
        width:min(430px,calc(100vw - 36px));
        max-height:calc(100vh - 116px);
        display:flex;
        flex-direction:column;
        overflow:hidden;
        border:1px solid rgba(124,58,237,.18);
        border-radius:26px;
        background:rgba(255,253,250,.985);
        box-shadow:0 28px 80px rgba(43,33,28,.22);
      }
      .resume-ai-proposal__header { display:flex; gap:12px; align-items:flex-start; padding:18px; border-bottom:1px solid rgba(75,51,38,.09); }
      .resume-ai-proposal__list { flex:1; overflow:auto; padding:12px; display:grid; gap:9px; }
      .resume-ai-proposal__footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-top:1px solid rgba(75,51,38,.09); background:#fffaf5; }
      .resume-ai-close { display:flex; width:34px; height:34px; flex:0 0 auto; align-items:center; justify-content:center; border-radius:12px; background:#f5f1ed; color:#78716c; }
      .resume-ai-change { display:flex; gap:10px; width:100%; border:1px solid rgba(75,51,38,.10); border-radius:16px; padding:11px; background:#fff; transition:.16s; }
      .resume-ai-change--selected { border-color:rgba(124,58,237,.30); background:#faf7ff; }
      .resume-ai-check { margin-top:2px; display:flex; width:20px; height:20px; flex:0 0 auto; align-items:center; justify-content:center; border:1px solid #d6d3d1; border-radius:7px; color:transparent; }
      .resume-ai-check--selected { border-color:#7c3aed; background:#7c3aed; color:white; }
      .resume-ai-apply { display:inline-flex; align-items:center; justify-content:center; gap:6px; border-radius:12px; background:#6d28d9; padding:10px 13px; color:white; font-size:11px; font-weight:900; white-space:nowrap; }
      .resume-ai-apply:disabled { opacity:.4; }

      .resume-score-result,
      .resume-ai-error {
        position:fixed;
        z-index:100;
        left:50%;
        bottom:22px;
        transform:translateX(-50%);
        width:min(560px,calc(100vw - 28px));
        border:1px solid rgba(75,51,38,.12);
        border-radius:22px;
        background:rgba(255,253,250,.98);
        padding:14px 16px;
        box-shadow:0 22px 65px rgba(43,33,28,.20);
      }
      .resume-ai-error { display:flex; align-items:center; justify-content:space-between; gap:12px; border-color:#fecaca; color:#b91c1c; }

      @media (max-width:980px) {
        .resume-studio-body #resume-builder-root { display:block !important; }
        .resume-studio-body #resume-builder-sidebar {
          position:relative !important;
          top:auto !important;
          width:100% !important;
          max-height:none !important;
          overflow:visible !important;
          border-radius:0 !important;
          border-left:0 !important;
          border-right:0 !important;
        }
        .resume-studio-body #resume-builder-sidebar > div:first-child { position:relative; top:auto; }
        .resume-studio-body #resume-preview-area { padding:24px 12px 56px !important; }
      }

      @media (max-width:640px) {
        .resume-studio-header__inner {
          min-height:60px;
          padding:8px 10px;
          gap:8px;
        }
        .resume-studio-header__identity { gap:8px; min-width:0; flex:1 1 auto; }
        .resume-studio-back { width:38px; height:38px; border-radius:13px; }
        .resume-studio-brandline { display:none; }
        .resume-studio-title--desktop { display:none; }
        .resume-studio-title--mobile { display:block; max-width:none; margin:0; font-family:inherit; font-size:16px; line-height:1; font-weight:900; }
        .resume-studio-header__actions { flex:0 0 auto; gap:5px; }
        .resume-studio-status { display:none; }
        .resume-studio-action {
          width:38px;
          height:38px;
          min-height:38px;
          padding:0;
          border-radius:13px;
        }
        .resume-studio-action span { display:none; }
        .resume-studio-action--evolution { display:none; }

        .resume-studio-body #resume-builder-sidebar > div:first-child {
          min-height:44px;
          padding:8px 14px !important;
          background:#2b211c !important;
        }
        .resume-studio-body #resume-builder-sidebar > div:first-child button:last-child { display:none !important; }
        .resume-studio-body #resume-builder-sidebar > div:first-child button:first-child {
          font-size:12px !important;
          gap:6px !important;
        }

        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b { top:60px; padding-inline:10px !important; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main { padding:18px 10px 42px !important; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .bg-white.rounded-2xl.border { padding:18px !important; border-radius:22px !important; }

        .resume-studio-body #resume-builder-sidebar > .p-5 { padding:16px !important; }
        .resume-studio-body #resume-preview-area { padding:18px 8px 44px !important; }

        .resume-ai-blocker { inset:60px 0 0; padding:10px; align-items:flex-end; }
        .resume-ai-progress-card { width:100%; border-radius:18px; padding:13px; }
        .resume-ai-proposal { top:auto; right:8px; left:8px; bottom:8px; width:auto; max-height:74vh; border-radius:22px; }
        .resume-ai-proposal__footer { align-items:flex-end; }
        .resume-ai-apply { padding:10px 11px; }
        .resume-score-result,
        .resume-ai-error { bottom:10px; border-radius:18px; padding:12px 13px; }
      }

      @media print {
        @page { size:210mm 297mm; margin:0; }
        html, body {
          width:210mm !important;
          min-width:210mm !important;
          margin:0 !important;
          padding:0 !important;
          background:white !important;
          overflow:visible !important;
          -webkit-print-color-adjust:exact !important;
          print-color-adjust:exact !important;
        }
        .resume-studio-header,
        .resume-studio-body #resume-builder-sidebar,
        .resume-ai-blocker,
        .resume-ai-proposal,
        .resume-score-result,
        .resume-ai-error { display:none !important; }
        .resume-studio,
        .resume-studio-body,
        .resume-studio-body #resume-builder-root,
        .resume-studio-body #resume-preview-area {
          display:block !important;
          width:210mm !important;
          min-width:210mm !important;
          max-width:210mm !important;
          margin:0 !important;
          padding:0 !important;
          border:0 !important;
          background:white !important;
          box-shadow:none !important;
          overflow:visible !important;
        }
        .resume-studio-body #resume-preview-area > div {
          width:210mm !important;
          transform:none !important;
          filter:none !important;
        }
      }
    `}</style>
  );
}
