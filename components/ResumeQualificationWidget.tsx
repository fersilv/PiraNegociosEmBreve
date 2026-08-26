import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
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

function cleanText(value: unknown, max = 3500) {
  return String(value || '').trim().slice(0, max);
}

function cleanSkills(value: unknown, limit = 40) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanText(item, 160)).filter(Boolean))).slice(0, limit);
}

function signaturePayload(value: any) {
  const profile = value && typeof value === 'object' ? value : {};
  const preferences = profile.resumePreferences && typeof profile.resumePreferences === 'object'
    ? profile.resumePreferences
    : {};

  const experiences = Array.isArray(profile.experiences)
    ? profile.experiences.slice(0, 30).map((experience: any) => ({
        company: cleanText(experience?.company, 240),
        role: cleanText(experience?.role, 240),
        startDate: cleanText(experience?.startDate, 80),
        endDate: cleanText(experience?.endDate, 80),
        current: Boolean(experience?.current),
        description: cleanText(experience?.description, 3500),
        skills: cleanSkills(experience?.skills, 30),
        timeline: Array.isArray(experience?.timeline)
          ? experience.timeline.slice(0, 20).map((stage: any) => ({
              role: cleanText(stage?.role, 240),
              startDate: cleanText(stage?.startDate, 80),
              endDate: cleanText(stage?.endDate, 80),
              current: Boolean(stage?.current),
              description: cleanText(stage?.description, 3000),
              skills: cleanSkills(stage?.skills, 24),
            }))
          : [],
      }))
    : [];

  const education = Array.isArray(profile.education)
    ? profile.education.slice(0, 20).map((item: any) => ({
        institution: cleanText(item?.institution, 240),
        degree: cleanText(item?.degree, 240),
        fieldOfStudy: cleanText(item?.fieldOfStudy, 240),
        startYear: cleanText(item?.startYear, 40),
        endYear: cleanText(item?.endYear, 40),
        current: Boolean(item?.current),
        status: cleanText(item?.status, 80),
        description: cleanText(item?.description, 1800),
        skills: cleanSkills(item?.skills, 20),
      }))
    : [];

  const courses = Array.isArray(profile.courses)
    ? profile.courses.slice(0, 30).map((item: any) => ({
        name: cleanText(item?.name, 240),
        institution: cleanText(item?.institution, 240),
        year: cleanText(item?.year, 40),
        type: cleanText(item?.type, 80),
        description: cleanText(item?.description, 1200),
        skills: cleanSkills(item?.skills, 20),
      }))
    : [];

  const languages = Array.isArray(profile.languages)
    ? profile.languages.slice(0, 20).map((item: any) => ({
        name: cleanText(item?.name, 120),
        level: cleanText(item?.level, 120),
      }))
    : [];

  return {
    headline: cleanText(preferences.headline, 320),
    bio: cleanText(profile.bio, 4000),
    experiences,
    education,
    skills: cleanSkills(profile.skills, 60),
    courses,
    languages,
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
  if (score >= 90) return 'Currículo forte. Agora é lapidação';
  if (score >= 75) return 'Boa base. Ainda há espaço para ganhar impacto';
  if (score >= 50) return 'Seu currículo pode ficar mais competitivo';
  return 'Há oportunidades claras de evolução';
}

function scoreCopy(score: number | null, stale: boolean) {
  if (stale) return 'Você alterou o conteúdo depois da última análise. A nota mostrada ainda representa a versão anterior.';
  if (score === null) return 'A primeira qualificação identifica pontos fortes e mostra onde vale melhorar.';
  if (score >= 90) return 'As próximas melhorias tendem a ser refinamentos e podem não aumentar a nota.';
  if (score >= 75) return 'A IA encontrou oportunidades práticas para deixar o documento mais claro, direto e convincente.';
  return 'A qualificação encontrou pontos concretos que podem fortalecer conteúdo, apresentação e leitura ATS.';
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
  const analysisStale = Boolean(hasAnalysis && storedSignature && liveSignature && storedSignature !== liveSignature);
  const suggestions = Array.isArray(analysis?.suggestions) ? analysis.suggestions : [];

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

    let cancelled = false;
    let frame: number | null = null;

    const mountOnce = () => {
      if (cancelled) return;

      const sidebar = document.getElementById('resume-builder-sidebar');
      const body = sidebar?.querySelector<HTMLElement>(':scope > .p-5');

      if (!body) return;

      const directSections = Array.from(body.querySelectorAll<HTMLElement>(':scope > section'));
      const legacy = directSections.find((section) => {
        const text = section.textContent || '';
        return text.includes('Qualidade do currículo') || text.includes('Análise profissional');
      }) || null;

      if (legacy) {
        hiddenLegacyRef.current = legacy;
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
      setTarget(root);
    };

    const scheduleMount = () => {
      if (cancelled || frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        mountOnce();
      });
    };

    const observer = new MutationObserver(scheduleMount);
    observer.observe(document.body, { childList: true, subtree: true });
    mountOnce();

    return () => {
      cancelled = true;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
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

  if (!onResumePage || !target) return null;

  const reanalysisPrice = money(status?.products?.reanalysis?.effectivePriceCents);
  const improvementPrice = money(status?.products?.improvement?.effectivePriceCents);
  const reanalysisCredits = Number(status?.credits?.RESUME_REANALYSIS || 0);
  const improvementCredits = Number(status?.credits?.RESUME_AI_IMPROVEMENT || 0);
  const accessOverride = Boolean(status?.paymentAccessOverride);

  const improvementLabel = `Aprimorar com IA${improvementPrice ? ` · ${improvementPrice}` : ''}`;

  const primaryAction: 'review' | 'improve' = !hasAnalysis || analysisStale ? 'review' : 'improve';
  const primaryLabel = !hasAnalysis
    ? 'Analisar currículo grátis'
    : analysisStale
      ? `Atualizar nota${reanalysisPrice ? ` · ${reanalysisPrice}` : ''}`
      : improvementLabel;

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

  const card = (
    <section className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.115),rgba(255,255,255,.055))] text-white shadow-[0_12px_30px_rgba(0,0,0,.12)]">
      <div className="p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/15">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-200/75">Qualidade do currículo</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-white/60">{scoreHeadline(score)}</p>
          </div>
          {score !== null && (
            <div className="shrink-0 text-right">
              <span className="text-[22px] font-black leading-none tracking-tight text-white">{score}</span>
              <span className="text-[9px] font-bold text-white/45">/100</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
            aria-label={expanded ? 'Recolher detalhes' : 'Ver detalhes'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        <p className="mt-2.5 text-[11px] leading-[1.45] text-white/55">{scoreCopy(score, analysisStale)}</p>

        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={handlePrimary}
            disabled={reviewing || !status?.enabled}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${analysisStale ? 'bg-amber-500 text-stone-950 hover:bg-amber-400' : 'bg-white text-stone-950 hover:bg-stone-100'}`}
          >
            {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primaryAction === 'improve' ? <WandSparkles className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="truncate">{primaryLabel}</span>
          </button>

          {hasAnalysis && (
            <button
              type="button"
              onClick={() => setOfferAction(analysisStale ? 'improve' : 'review')}
              disabled={reviewing || !status?.enabled}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-[11px] font-black text-white/85 transition hover:bg-white/10 disabled:opacity-50"
            >
              {analysisStale ? (
                <WandSparkles className="h-3.5 w-3.5 text-violet-200" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 text-violet-200" />
              )}
              <span className="truncate">
                {analysisStale
                  ? improvementLabel
                  : `Fazer nova análise${reanalysisPrice ? ` · ${reanalysisPrice}` : ''}`}
              </span>
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-3 max-h-[250px] overflow-y-auto border-t border-white/8 pt-3 pr-1">
            {analysisStale && (
              <div className="mb-3 rounded-xl border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-[10px] leading-4 text-amber-100">
                Sua nota pertence à versão anterior. Você pode atualizar a nota ou seguir direto para outra melhoria.
              </div>
            )}
            {analysis?.feedbackText ? (
              <p className="text-[11px] leading-4 text-white/58">{analysis.feedbackText}</p>
            ) : (
              <p className="text-[11px] text-white/45">A análise detalhada aparecerá aqui quando a qualificação terminar.</p>
            )}
            {suggestions.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">Onde vale evoluir</p>
                {suggestions.slice(0, 3).map((suggestion: string, index: number) => (
                  <div key={`${suggestion}-${index}`} className="flex items-start gap-2 rounded-xl bg-white/5 px-2.5 py-2 text-[10px] leading-4 text-white/62">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-violet-200" />
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate('/user/curriculo/evolucao')}
              className="mt-3 text-[10px] font-black text-violet-200 hover:text-white"
            >
              Ver evolução completa →
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-[10px] leading-4 text-rose-100">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Fechar erro"><X className="h-3 w-3" /></button>
          </div>
        )}
      </div>
    </section>
  );

  const modal = offerAction ? (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-stone-950/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="w-full max-w-[410px] overflow-hidden rounded-3xl border border-stone-200 bg-white text-stone-900 shadow-2xl">
        <div className="border-b border-stone-100 bg-[linear-gradient(145deg,#faf5ff,#fff)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              {offerAction === 'improve' ? <WandSparkles className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.15em] text-violet-600">{offerAction === 'improve' ? 'Melhoria com IA' : 'Nova qualificação'}</p>
                  <h3 className="mt-1 text-lg font-black text-stone-950">{offerAction === 'improve' ? 'Aprimorar seu currículo' : 'Fazer nova análise'}</h3>
                </div>
                <button type="button" onClick={() => setOfferAction(null)} className="text-stone-400" aria-label="Fechar"><X className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                {offerAction === 'improve'
                  ? 'A IA usa sua qualificação como checklist. Se os principais pontos já foram resolvidos, a nova rodada pode apenas lapidar o texto e a nota pode continuar igual.'
                  : 'Use quando você alterou manualmente o conteúdo e quer medir novamente a versão atual.'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {offerAction === 'improve' ? (
            <>
              <div className="rounded-2xl bg-stone-50 p-3 text-xs leading-5 text-stone-600">
                <strong>O que está incluído:</strong> diagnóstico atual como plano, antes × depois para sua aprovação e nova qualificação depois das alterações escolhidas.
              </div>
              {analysisStale && (
                <button
                  type="button"
                  onClick={() => setOfferAction('review')}
                  className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-800"
                >
                  Atualizar nota primeiro{reanalysisPrice ? ` · ${reanalysisPrice}` : ''}
                </button>
              )}
              <p className="text-[11px] leading-4 text-stone-400">
                Melhorias não garantem aumento de pontuação. Quanto mais forte estiver o currículo, maior a chance de a próxima rodada ser apenas refinamento.
              </p>
            </>
          ) : (
            <div className="rounded-2xl bg-stone-50 p-3 text-xs leading-5 text-stone-600">
              {accessOverride || reanalysisCredits > 0
                ? 'Você já tem acesso a esta qualificação.'
                : `Valor da atualização: ${reanalysisPrice || 'conforme configuração atual'}.`}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/70 px-5 py-4">
          <button type="button" onClick={() => setOfferAction(null)} className="text-xs font-bold text-stone-500">Agora não</button>
          <button type="button" onClick={continueOffer} className="rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white">
            {offerAction === 'improve'
              ? `Continuar${!accessOverride && improvementCredits <= 0 && improvementPrice ? ` · ${improvementPrice}` : ''}`
              : `Analisar novamente${!accessOverride && reanalysisCredits <= 0 && reanalysisPrice ? ` · ${reanalysisPrice}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const toast = toastScore !== null ? (
    <div className="fixed bottom-5 left-1/2 z-[220] -translate-x-1/2 rounded-full border border-violet-100 bg-white px-4 py-2.5 text-xs font-black text-stone-800 shadow-xl">
      ✨ Currículo qualificado · {toastScore}/100
    </div>
  ) : null;

  return createPortal(<>{card}{modal}{toast}</>, target);
}
