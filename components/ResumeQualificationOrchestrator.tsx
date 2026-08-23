import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, WandSparkles, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

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

function findResumeScoreCard() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>('p')).find(
    (element) => (element.textContent || '').trim() === 'Qualidade do currículo',
  );
  return heading?.closest<HTMLElement>('section') || null;
}

function findScorePrimaryButton(section: HTMLElement) {
  return Array.from(section.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    if (button.dataset.resumeScoreCollapse === 'true') return false;
    const label = (button.textContent || '').trim();
    return label.includes('Reavaliar currículo') || label.includes('Analisar meu currículo');
  }) || null;
}

function setIfDifferent(element: HTMLElement, attribute: string, value: string) {
  if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
}

export function ResumeQualificationOrchestrator() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [firstResult, setFirstResult] = useState<any>(null);
  const [improvementOfferOpen, setImprovementOfferOpen] = useState(false);
  const autoAttemptedRef = useRef(false);
  const onResumePage = location.pathname === '/user/curriculo';

  const storedSignature = String((profile?.aiAnalysis as any)?.resumeSignature || '');
  const liveSignature = useMemo(() => profile ? currentResumeSignature(profile) : '', [profile]);
  const hasAnalysis = Boolean(profile?.hasAiAnalyzed && profile?.aiAnalysis);
  const analysisStale = Boolean(hasAnalysis && (!storedSignature || storedSignature !== liveSignature));
  const firstQualificationEligible = Boolean(
    onResumePage
    && profile
    && hasResumeContent(profile)
    && !hasAnalysis
    && status?.enabled
    && status?.freeResumeAnalysisAvailable !== false,
  );

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
      setPreviewVisible(false);
      return;
    }

    let lastVisible: boolean | null = null;
    const detect = () => {
      const visible = Boolean(document.querySelector('#resume-preview-area'));
      if (visible !== lastVisible) {
        lastVisible = visible;
        setPreviewVisible(visible);
      }
    };

    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    detect();
    return () => observer.disconnect();
  }, [onResumePage]);

  useEffect(() => {
    if (!firstQualificationEligible || previewVisible || reviewing) return;

    const dismissLegacyOffer = () => {
      const modal = Array.from(document.querySelectorAll<HTMLElement>('div.fixed.inset-0')).find((element) => {
        const text = element.textContent || '';
        return text.includes('Seu currículo está pronto.') && text.includes('Quero ver minha pontuação');
      });
      const later = Array.from(modal?.querySelectorAll<HTMLButtonElement>('button') || [])
        .find((button) => (button.textContent || '').includes('Agora não'));
      if (later) later.click();
    };

    const observer = new MutationObserver(dismissLegacyOffer);
    observer.observe(document.body, { childList: true, subtree: true });
    dismissLegacyOffer();
    return () => observer.disconnect();
  }, [firstQualificationEligible, previewVisible, reviewing]);

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
      await refreshProfile();
      await loadStatus();
      if (automatic && response.data?.score !== undefined) {
        setFirstResult(response.data);
        window.dispatchEvent(new CustomEvent('resume:first-qualification-complete', { detail: response.data }));
      }
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
    if (!firstQualificationEligible || !previewVisible || reviewing || autoAttemptedRef.current) return;
    autoAttemptedRef.current = true;
    void runReview(true);
  }, [firstQualificationEligible, previewVisible, reviewing, runReview]);

  useEffect(() => {
    if (!firstResult) return;
    const timer = window.setTimeout(() => setFirstResult(null), 6500);
    return () => window.clearTimeout(timer);
  }, [firstResult]);

  useEffect(() => {
    if (!onResumePage) {
      delete document.body.dataset.resumeAnalysisStale;
      delete document.body.dataset.resumeQualificationRunning;
      return;
    }
    if (analysisStale) document.body.dataset.resumeAnalysisStale = 'true';
    else delete document.body.dataset.resumeAnalysisStale;
    if (reviewing) document.body.dataset.resumeQualificationRunning = 'true';
    else delete document.body.dataset.resumeQualificationRunning;
    return () => {
      delete document.body.dataset.resumeAnalysisStale;
      delete document.body.dataset.resumeQualificationRunning;
    };
  }, [analysisStale, onResumePage, reviewing]);

  useEffect(() => {
    if (!onResumePage) return;

    let disposed = false;
    let frame: number | null = null;

    const updateToggle = (section: HTMLElement, toggle: HTMLButtonElement) => {
      const collapsed = section.classList.contains('resume-score-card-collapsed');
      const nextText = collapsed ? '+' : '−';
      const nextTitle = collapsed ? 'Ver detalhes da qualificação' : 'Minimizar qualificação';
      if (toggle.textContent !== nextText) toggle.textContent = nextText;
      if (toggle.title !== nextTitle) toggle.title = nextTitle;
      setIfDifferent(toggle, 'aria-label', nextTitle);
    };

    const syncCard = () => {
      if (disposed) return;
      const section = findResumeScoreCard();
      if (!section) return;

      if (!section.classList.contains('resume-score-card-managed')) {
        section.classList.add('resume-score-card-managed');
      }
      const staleValue = analysisStale ? 'true' : 'false';
      if (section.dataset.resumeScoreStale !== staleValue) {
        section.dataset.resumeScoreStale = staleValue;
      }

      if (!section.dataset.resumeCollapseInitialized) {
        section.dataset.resumeCollapseInitialized = 'true';
        if (hasAnalysis) section.classList.add('resume-score-card-collapsed');
      }

      let toggle = section.querySelector<HTMLButtonElement>('[data-resume-score-collapse="true"]');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.dataset.resumeScoreCollapse = 'true';
        toggle.className = 'resume-score-card-toggle';
        toggle.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          section.classList.toggle('resume-score-card-collapsed');
          updateToggle(section, toggle!);
        });
        section.appendChild(toggle);
      }
      updateToggle(section, toggle);

      const primary = findScorePrimaryButton(section);
      if (!primary) return;

      if (hasAnalysis && !analysisStale) {
        if (primary.dataset.resumeManagedAction !== 'improve') primary.dataset.resumeManagedAction = 'improve';
        if (primary.title !== 'Conheça e aplique as melhorias sugeridas pela sua qualificação') {
          primary.title = 'Conheça e aplique as melhorias sugeridas pela sua qualificação';
        }
      } else if (hasAnalysis && analysisStale) {
        if (primary.dataset.resumeManagedAction !== 'review') primary.dataset.resumeManagedAction = 'review';
        if (primary.title !== 'Atualize a nota para considerar suas alterações') {
          primary.title = 'Atualize a nota para considerar suas alterações';
        }
      } else {
        if (primary.dataset.resumeManagedAction) delete primary.dataset.resumeManagedAction;
        if (primary.hasAttribute('title')) primary.removeAttribute('title');
      }
    };

    const scheduleSync = () => {
      if (disposed || frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        syncCard();
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleSync();

    return () => {
      disposed = true;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [analysisStale, hasAnalysis, onResumePage, previewVisible, profile?.aiAnalysis]);

  useEffect(() => {
    if (!onResumePage) return;

    const interceptManagedAction = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('button[data-resume-managed-action]');
      if (!button) return;
      const action = button.dataset.resumeManagedAction;
      if (action !== 'improve' && action !== 'review') return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (action === 'improve') {
        setImprovementOfferOpen(true);
      } else if (!reviewing) {
        void runReview(false);
      }
    };

    window.addEventListener('click', interceptManagedAction, true);
    return () => window.removeEventListener('click', interceptManagedAction, true);
  }, [onResumePage, reviewing, runReview]);

  if (!onResumePage) return null;

  const reanalysisPrice = money(status?.products?.reanalysis?.effectivePriceCents);
  const improvementPrice = money(status?.products?.improvement?.effectivePriceCents);
  const improvementCredits = Number(status?.credits?.RESUME_AI_IMPROVEMENT || 0);
  const improvementIncluded = Boolean(
    status?.paymentAccessOverride
    || improvementCredits > 0
    || status?.resumeImprovementPaymentRequired === false,
  );

  const continueToImprovement = () => {
    setImprovementOfferOpen(false);
    const button = document.querySelector<HTMLButtonElement>('.resume-studio-ai-button');
    if (button && !button.disabled) {
      button.click();
      return;
    }
    setError('Não foi possível iniciar as melhorias agora. Atualize a página e tente novamente.');
  };

  return (
    <>
      <style>{`
        .resume-studio-header .resume-studio-ai-button {
          display: none !important;
        }

        .resume-score-card-managed {
          position: relative !important;
          transition: padding .18s ease, border-color .18s ease, background .18s ease !important;
        }

        .resume-score-card-managed[data-resume-score-stale="true"] {
          border-color: rgba(217,119,6,.42) !important;
          background: linear-gradient(135deg, rgba(255,251,235,.98), rgba(255,255,255,.98)) !important;
        }

        .resume-score-card-toggle {
          position: absolute;
          top: 7px;
          right: 7px;
          z-index: 4;
          display: flex;
          width: 24px;
          height: 24px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(124,58,237,.14);
          border-radius: 8px;
          background: rgba(255,255,255,.86);
          color: #7c3aed;
          font-size: 15px;
          font-weight: 900;
          line-height: 1;
          box-shadow: 0 4px 12px rgba(45,31,24,.06);
        }

        .resume-score-card-managed > div > .min-w-0.flex-1 > div:first-child {
          padding-right: 25px;
        }

        .resume-score-card-managed.resume-score-card-collapsed {
          padding: 9px !important;
          border-radius: 15px !important;
        }

        .resume-score-card-managed.resume-score-card-collapsed > div {
          gap: 8px !important;
        }

        .resume-score-card-managed.resume-score-card-collapsed > div > div:first-child {
          width: 30px !important;
          height: 30px !important;
          border-radius: 10px !important;
        }

        .resume-score-card-managed.resume-score-card-collapsed > div > div:first-child svg {
          width: 14px !important;
          height: 14px !important;
        }

        .resume-score-card-managed.resume-score-card-collapsed > div > .min-w-0.flex-1 > .mt-3 {
          display: none !important;
        }

        .resume-score-card-managed.resume-score-card-collapsed > div > .min-w-0.flex-1 > div:first-child p:last-child {
          display: none !important;
        }

        .resume-score-card-managed.resume-score-card-collapsed > div > .min-w-0.flex-1 > div:first-child p:first-child {
          font-size: 9px !important;
          line-height: 1.15 !important;
        }

        .resume-score-card-managed.resume-score-card-collapsed > div > .min-w-0.flex-1 > div:first-child .text-2xl {
          font-size: 18px !important;
          line-height: 1 !important;
        }

        .resume-score-card-managed.resume-score-card-collapsed button[data-resume-managed-action],
        .resume-score-card-managed.resume-score-card-collapsed > div > .min-w-0.flex-1 > button:last-child {
          margin-top: 7px !important;
          width: 100% !important;
          justify-content: center !important;
          padding: 7px 9px !important;
          border-radius: 10px !important;
        }

        button[data-resume-managed-action="improve"],
        button[data-resume-managed-action="review"] {
          font-size: 0 !important;
        }

        button[data-resume-managed-action="improve"] svg,
        button[data-resume-managed-action="review"] svg {
          display: none !important;
        }

        button[data-resume-managed-action="improve"]::after,
        button[data-resume-managed-action="review"]::after {
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
        }

        button[data-resume-managed-action="improve"]::after {
          content: '✦  Aplicar melhorias';
        }

        button[data-resume-managed-action="review"]::after {
          content: 'Reavaliar currículo${reanalysisPrice ? ` · ${reanalysisPrice}` : ''}';
        }

        .resume-score-card-managed[data-resume-score-stale="true"] button[data-resume-managed-action="review"] {
          background: #d97706 !important;
        }
      `}</style>

      {reviewing && (
        <div className="fixed inset-0 z-[140] cursor-progress bg-transparent" aria-live="polite" role="status">
          <div className="fixed bottom-5 right-5 flex max-w-[300px] items-center gap-3 rounded-2xl border border-violet-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-700" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.13em] text-violet-600">Qualificando</p>
              <p className="truncate text-xs font-bold text-stone-800">Atualizando nota e recomendações…</p>
            </div>
          </div>
        </div>
      )}

      {!reviewing && firstResult && previewVisible && (
        <div className="fixed bottom-5 right-5 z-[84] flex items-center gap-3 rounded-2xl border border-violet-200 bg-white/95 px-3.5 py-3 shadow-xl backdrop-blur">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Sparkles className="h-4 w-4" /></span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.12em] text-violet-600">Currículo qualificado</p>
            <p className="text-sm font-black text-stone-900">{Math.max(0, Math.min(100, Math.round(Number(firstResult.score || 0))))}<span className="text-[10px] text-stone-400">/100</span></p>
          </div>
          <button type="button" onClick={() => setFirstResult(null)} className="ml-1 text-stone-400 hover:text-stone-700" aria-label="Fechar"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {improvementOfferOpen && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-stone-950/25 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Aplicar melhorias no currículo">
          <div className="w-full max-w-[390px] overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-2xl">
            <div className="border-b border-stone-100 bg-gradient-to-br from-violet-50 to-white p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><WandSparkles className="h-4.5 w-4.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[.15em] text-violet-600">Melhoria com IA</p>
                      <h2 className="mt-1 text-base font-black text-stone-950">Aplicar melhorias sugeridas</h2>
                    </div>
                    <button type="button" onClick={() => setImprovementOfferOpen(false)} className="text-stone-400 hover:text-stone-700" aria-label="Fechar"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-stone-500">A IA usa a sua qualificação atual como checklist, prepara o antes × depois e você escolhe exatamente o que será aplicado.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
                <span className="text-xs font-bold text-stone-600">Valor do serviço</span>
                <strong className="text-sm font-black text-stone-950">{improvementPrice || 'Sem cobrança'}</strong>
              </div>
              {improvementCredits > 0 && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">Você já possui {improvementCredits} crédito(s) para esta melhoria.</p>}
              {status?.paymentAccessOverride && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">Esta ação está incluída no seu acesso atual.</p>}
              <div className="grid gap-1.5 text-[11px] leading-5 text-stone-600">
                <span>✓ Ataca os pontos apontados na qualificação</span>
                <span>✓ Mostra cada alteração antes de aplicar</span>
                <span>✓ Não inventa experiência ou formação</span>
                <span>✓ Nova qualificação já incluída no final</span>
              </div>
            </div>

            <div className="flex gap-2 border-t border-stone-100 bg-stone-50/70 p-4">
              <button type="button" onClick={() => setImprovementOfferOpen(false)} className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-black text-stone-600 hover:bg-stone-100">Agora não</button>
              <button type="button" onClick={continueToImprovement} className="flex-[1.35] rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-black text-white hover:bg-violet-700">
                {improvementIncluded && improvementCredits > 0 ? 'Usar crédito e continuar' : improvementIncluded && status?.paymentAccessOverride ? 'Continuar' : `Continuar${improvementPrice ? ` · ${improvementPrice}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {!reviewing && error && (
        <div className="fixed bottom-5 left-1/2 z-[175] w-[min(540px,calc(100vw-28px))] -translate-x-1/2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-xs text-rose-700 shadow-xl">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 shrink-0" /> {error}</div>
        </div>
      )}
    </>
  );
}
