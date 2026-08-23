import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

type OfferAction = 'improve' | 'review' | null;

function signaturePayload(profile: any) {
  const preferences = profile?.resumePreferences && typeof profile.resumePreferences === 'object'
    ? profile.resumePreferences
    : {};
  return {
    headline: String(preferences.headline || '').trim(),
    bio: String(profile?.bio || '').trim(),
    experiences: Array.isArray(profile?.experiences) ? profile.experiences : [],
    education: Array.isArray(profile?.education) ? profile.education : [],
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    courses: Array.isArray(profile?.courses) ? profile.courses : [],
    languages: Array.isArray(profile?.languages) ? profile.languages : [],
  };
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function currentResumeSignature(profile: any) {
  return `resume-v1-${fnv1a(JSON.stringify(signaturePayload(profile)))}`;
}

function hasResumeContent(profile: any) {
  return Boolean(
    String(profile?.bio || '').trim()
    || (Array.isArray(profile?.experiences) && profile.experiences.length > 0)
    || (Array.isArray(profile?.education) && profile.education.length > 0)
    || (Array.isArray(profile?.skills) && profile.skills.length > 0)
    || (Array.isArray(profile?.courses) && profile.courses.length > 0),
  );
}

function money(cents: unknown) {
  const value = Number(cents);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

function boundedScore(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function scoreHeadline(score: number | null) {
  if (score === null) return 'Descubra a força do seu currículo';
  if (score >= 85) return 'Currículo forte, com espaço para lapidar';
  if (score >= 70) return 'Boa base. Dá para ganhar mais impacto';
  if (score >= 50) return 'Seu currículo pode ficar bem mais competitivo';
  return 'Há oportunidades claras de evolução';
}

function scoreCopy(score: number | null, stale: boolean) {
  if (stale) return 'Você alterou o currículo. A nota continua salva, mas representa a versão anterior.';
  if (score === null) return 'A primeira qualificação identifica pontos fortes e mostra onde vale melhorar.';
  if (score >= 85) return 'A IA encontrou ajustes pontuais para reforçar clareza, evidências e leitura por recrutadores.';
  if (score >= 70) return 'A IA já encontrou melhorias práticas para deixar o documento mais direto e convincente.';
  return 'A qualificação encontrou pontos concretos que podem fortalecer apresentação, conteúdo e leitura ATS.';
}

export function ResumeQualificationWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [offerAction, setOfferAction] = useState<OfferAction>(null);
  const [toastScore, setToastScore] = useState<number | null>(null);
  const autoAttemptedRef = useRef(false);
  const hiddenLegacyRef = useRef<HTMLElement | null>(null);
  const mountRootRef = useRef<HTMLElement | null>(null);

  const onResumePage = location.pathname === '/user/curriculo';
  const analysis = profile?.aiAnalysis as any;
  const score = boundedScore(analysis?.score);
  const hasAnalysis = Boolean(profile?.hasAiAnalyzed && analysis);
  const storedSignature = String(analysis?.resumeSignature || '');
  const liveSignature = useMemo(() => profile ? currentResumeSignature(profile) : '', [profile]);
  const analysisStale = Boolean(hasAnalysis && (!storedSignature || storedSignature !== liveSignature));

  const loadStatus = useCallback(async () => {
    if (!onResumePage) return;
    try {
      const response = await api.get('/ai/status');
      setStatus(response.data || null);
    } catch {
      setStatus(null);
    }
  }, [onResumePage]);

  useEffect(() => {
    if (!onResumePage) return;
    void loadStatus();
  }, [loadStatus, onResumePage]);

  useEffect(() => {
    if (!onResumePage) {
      autoAttemptedRef.current = false;
      setTarget(null);
      return;
    }

    const syncMount = () => {
      const sidebar = document.getElementById('resume-builder-sidebar');
      const body = sidebar?.querySelector<HTMLElement>(':scope > .p-5');
      if (!body) {
        if (mountRootRef.current && !mountRootRef.current.isConnected) {
          mountRootRef.current = null;
          setTarget(null);
        }
        return;
      }

      const directSections = Array.from(body.querySelectorAll<HTMLElement>(':scope > section'));
      const legacy = directSections.find((section) => {
        const text = section.textContent || '';
        return text.includes('Qualidade do currículo') || text.includes('Análise profissional');
      }) || null;

      if (legacy && legacy !== hiddenLegacyRef.current) {
        if (hiddenLegacyRef.current) hiddenLegacyRef.current.style.removeProperty('display');
        hiddenLegacyRef.current = legacy;
        legacy.style.display = 'none';
      } else if (legacy && legacy.style.display !== 'none') {
        legacy.style.display = 'none';
      }

      let root = document.getElementById('resume-qualification-widget-root') as HTMLElement | null;
      if (!root || !root.isConnected) {
        root = document.createElement('div');
        root.id = 'resume-qualification-widget-root';
        root.className = 'resume-qualification-widget-root';
        if (legacy) body.insertBefore(root, legacy);
        else body.insertBefore(root, body.children[1] || null);
      }

      mountRootRef.current = root;
      setTarget((current) => current === root ? current : root);
    };

    syncMount();
    const timer = window.setInterval(syncMount, 900);

    return () => {
      window.clearInterval(timer);
      if (hiddenLegacyRef.current) {
        hiddenLegacyRef.current.style.removeProperty('display');
        hiddenLegacyRef.current = null;
      }
      if (mountRootRef.current?.isConnected) mountRootRef.current.remove();
      mountRootRef.current = null;
      setTarget(null);
    };
  }, [onResumePage]);

  const runReview = useCallback(async (automatic = false) => {
    if (!profile || reviewing) return;
    setReviewing(true);
    setError('');
    try {
      const response = await api.post(
        '/ai/review-resume',
        {
          profile: {
            ...profile,
            uploadedResumeFile: undefined,
            publishedResumeSnapshot: undefined,
          },
        },
        { timeout: 180000 },
      );
      const nextScore = boundedScore(response.data?.score);
      await refreshProfile();
      await loadStatus();
      if (automatic && nextScore !== null) setToastScore(nextScore);
    } catch (requestError: any) {
      if (requestError?.response?.data?.code === 'PAYMENT_REQUIRED') {
        navigate('/user/pagamentos');
        return;
      }
      const raw = requestError?.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(' · ') : raw || requestError?.message || 'Não foi possível qualificar o currículo agora.');
    } finally {
      setReviewing(false);
    }
  }, [loadStatus, navigate, profile, refreshProfile, reviewing]);

  useEffect(() => {
    const eligible = Boolean(
      target
      && profile
      && hasResumeContent(profile)
      && !hasAnalysis
      && status?.enabled
      && status?.freeResumeAnalysisAvailable !== false,
    );
    if (!eligible || reviewing || autoAttemptedRef.current) return;
    autoAttemptedRef.current = true;
    void runReview(true);
  }, [hasAnalysis, profile, reviewing, runReview, status, target]);

  useEffect(() => {
    if (toastScore === null) return;
    const timer = window.setTimeout(() => setToastScore(null), 5200);
    return () => window.clearTimeout(timer);
  }, [toastScore]);

  if (!onResumePage) return null;

  const reanalysisPrice = money(status?.products?.reanalysis?.effectivePriceCents);
  const improvementPrice = money(status?.products?.improvement?.effectivePriceCents);
  const reanalysisCredits = Number(status?.credits?.RESUME_REANALYSIS || 0);
  const improvementCredits = Number(status?.credits?.RESUME_AI_IMPROVEMENT || 0);
  const accessOverride = Boolean(status?.paymentAccessOverride);

  const primaryAction = !hasAnalysis
    ? 'review'
    : analysisStale
      ? 'review'
      : 'improve';

  const primaryLabel = !hasAnalysis
    ? 'Analisar currículo grátis'
    : analysisStale
      ? `Atualizar nota${reanalysisPrice ? ` · ${reanalysisPrice}` : ''}`
      : `Aplicar melhorias${improvementPrice ? ` · ${improvementPrice}` : ''}`;

  const handlePrimary = () => {
    if (reviewing) return;
    if (primaryAction === 'improve') {
      setOfferAction('improve');
      return;
    }
    if (!hasAnalysis && status?.freeResumeAnalysisAvailable !== false) {
      void runReview(false);
      return;
    }
    setOfferAction('review');
  };

  const continueOffer = () => {
    const action = offerAction;
    setOfferAction(null);
    if (action === 'review') {
      void runReview(false);
      return;
    }
    if (action === 'improve') {
      const button = document.querySelector<HTMLButtonElement>('.resume-studio-ai-button');
      if (button && !button.disabled) {
        button.click();
        return;
      }
      setError('Não foi possível iniciar as melhorias agora. Atualize a página e tente novamente.');
    }
  };

  const widget = (
    <section className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.115),rgba(255,255,255,.055))] text-white shadow-[0_12px_30px_rgba(0,0,0,.12)]">
      <div className="p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/15">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-200/75">Qualidade do currículo</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-white/58">{scoreHeadline(score)}</p>
          </div>
          {score !== null ? (
            <div className="shrink-0 text-right">
              <span className="text-[22px] font-black leading-none tracking-tight text-white">{score}</span>
              <span className="text-[9px] font-bold text-white/38">/100</span>
            </div>
          ) : (
            <span className="rounded-full bg-white/8 px-2 py-1 text-[9px] font-bold text-white/50">sem nota</span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label={expanded ? 'Minimizar qualificação' : 'Ver detalhes da qualificação'}
            title={expanded ? 'Minimizar' : 'Ver detalhes'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        <p className="mt-2.5 text-[11px] leading-[1.45] text-white/55">{scoreCopy(score, analysisStale)}</p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrimary}
            disabled={reviewing || !status?.enabled}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${analysisStale ? 'bg-amber-500 text-stone-950 hover:bg-amber-400' : 'bg-white text-stone-950 hover:bg-stone-100'}`}
          >
            {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primaryAction === 'improve' ? <WandSparkles className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="truncate">{primaryLabel}</span>
          </button>
          {hasAnalysis && analysisStale && (
            <button
              type="button"
              onClick={() => setOfferAction('improve')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-200 transition hover:bg-white/10"
              title="Aplicar melhorias mesmo sem atualizar a nota"
              aria-label="Aplicar melhorias"
            >
              <WandSparkles className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-3 max-h-[280px] overflow-y-auto border-t border-white/8 pt-3 pr-1">
            {analysisStale && (
              <div className="mb-3 rounded-xl border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-[10px] leading-4 text-amber-100">
                A nota atual avalia a versão anterior. Reavalie para comparar a evolução com precisão.
              </div>
            )}
            {analysis?.feedbackText ? (
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">Diagnóstico</p>
                <p className="mt-1.5 text-[11px] leading-[1.5] text-white/65">{analysis.feedbackText}</p>
              </div>
            ) : (
              <p className="text-[11px] text-white/45">A análise detalhada aparecerá aqui quando a qualificação terminar.</p>
            )}
            {Array.isArray(analysis?.suggestions) && analysis.suggestions.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">Onde vale evoluir</p>
                {analysis.suggestions.slice(0, 3).map((suggestion: string, index: number) => (
                  <div key={`${suggestion}-${index}`} className="flex items-start gap-2 rounded-xl bg-white/5 px-2.5 py-2 text-[10px] leading-4 text-white/62">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-violet-200" />
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            )}
            {hasAnalysis && (
              <button
                type="button"
                onClick={() => navigate('/user/curriculo/evolucao')}
                className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-violet-200 hover:text-white"
              >
                Ver evolução completa <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );

  const offerIsImprovement = offerAction === 'improve';
  const offerPrice = offerIsImprovement ? improvementPrice : reanalysisPrice;
  const offerCredits = offerIsImprovement ? improvementCredits : reanalysisCredits;

  return (
    <>
      <style>{`
        .resume-studio-header .resume-studio-ai-button { display: none !important; }
        .resume-qualification-widget-root { margin: 0 0 1rem 0; }
      `}</style>

      {target && createPortal(widget, target)}

      {reviewing && (
        <div className="fixed inset-0 z-[190] cursor-progress bg-transparent" role="status" aria-live="polite">
          <div className="fixed bottom-5 right-5 flex max-w-[300px] items-center gap-3 rounded-2xl border border-violet-200 bg-white/95 px-4 py-3 text-stone-900 shadow-2xl backdrop-blur">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-700" />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Qualificando currículo</p>
              <p className="truncate text-xs font-bold">Atualizando nota e recomendações…</p>
            </div>
          </div>
        </div>
      )}

      {toastScore !== null && !reviewing && (
        <div className="fixed bottom-5 right-5 z-[185] flex items-center gap-3 rounded-2xl border border-violet-200 bg-white/95 px-3.5 py-3 text-stone-900 shadow-xl backdrop-blur">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Sparkles className="h-4 w-4" /></span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.12em] text-violet-600">Primeira qualificação concluída</p>
            <p className="text-sm font-black">{toastScore}<span className="text-[10px] text-stone-400">/100</span></p>
          </div>
          <button type="button" onClick={() => setToastScore(null)} className="ml-1 text-stone-400 hover:text-stone-700" aria-label="Fechar"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {offerAction && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-stone-950/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="w-full max-w-[390px] overflow-hidden rounded-3xl border border-stone-200 bg-white text-stone-900 shadow-2xl">
            <div className="border-b border-stone-100 bg-[linear-gradient(145deg,#faf5ff,#fff)] p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  {offerIsImprovement ? <WandSparkles className="h-4.5 w-4.5" /> : <RefreshCw className="h-4.5 w-4.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[.15em] text-violet-600">{offerIsImprovement ? 'Melhoria com IA' : 'Nova qualificação'}</p>
                      <h2 className="mt-1 text-base font-black text-stone-950">{offerIsImprovement ? 'Aplique melhorias guiadas pela sua análise' : 'Atualize a nota da versão atual'}</h2>
                    </div>
                    <button type="button" onClick={() => setOfferAction(null)} className="text-stone-400 hover:text-stone-700" aria-label="Fechar"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {offerIsImprovement
                      ? 'A IA usa os pontos da qualificação como checklist, mostra cada antes × depois e só aplica o que você aprovar.'
                      : 'A nova análise considera as alterações feitas no currículo e atualiza nota, diagnóstico e recomendações.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
                <span className="text-xs font-bold text-stone-600">Valor</span>
                <strong className="text-sm font-black text-stone-950">{accessOverride || offerCredits > 0 ? 'Incluído no seu acesso' : offerPrice || 'Sem cobrança'}</strong>
              </div>
              {offerCredits > 0 && !accessOverride && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">Você já possui {offerCredits} crédito(s) para esta ação.</p>
              )}
              {offerIsImprovement && (
                <div className="grid gap-1.5 text-[11px] leading-5 text-stone-600">
                  <span>✓ Usa o diagnóstico atual como plano de trabalho</span>
                  <span>✓ Mostra as alterações antes de aplicar</span>
                  <span>✓ Não inventa experiências, resultados ou formação</span>
                  <span>✓ Nova qualificação já incluída ao final</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-stone-100 bg-stone-50/70 p-4">
              <button type="button" onClick={() => setOfferAction(null)} className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-black text-stone-600 hover:bg-stone-100">Agora não</button>
              <button type="button" onClick={continueOffer} className="flex-[1.35] rounded-xl bg-stone-950 px-3 py-2.5 text-xs font-black text-white hover:bg-stone-800">
                {accessOverride || offerCredits > 0 ? 'Continuar' : `Continuar${offerPrice ? ` · ${offerPrice}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !reviewing && (
        <div className="fixed bottom-5 left-1/2 z-[220] w-[min(540px,calc(100vw-28px))] -translate-x-1/2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-xs text-rose-700 shadow-xl">
          <div className="flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setError('')}><X className="h-4 w-4" /></button></div>
        </div>
      )}
    </>
  );
}
