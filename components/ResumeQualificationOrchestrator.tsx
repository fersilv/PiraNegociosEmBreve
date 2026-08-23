import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, Loader2, RefreshCw, Sparkles } from 'lucide-react';
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

export function ResumeQualificationOrchestrator() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
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
    const detect = () => setPreviewVisible(Boolean(document.querySelector('#resume-preview-area')));
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

  if (!onResumePage) return null;

  const reanalysisPrice = money(status?.products?.reanalysis?.effectivePriceCents);

  return (
    <>
      <style>{`
        body[data-resume-analysis-stale="true"] .resume-studio-ai-button {
          opacity: .46 !important;
          filter: saturate(.45);
          transform: scale(.98);
        }
        body[data-resume-analysis-stale="true"] .resume-studio-ai-button:hover {
          opacity: .72 !important;
        }
      `}</style>

      {reviewing && (
        <div className="fixed inset-0 z-[140] flex items-start justify-end bg-stone-950/10 p-4 pt-24 backdrop-blur-[1px] cursor-progress">
          <div className="w-full max-w-sm rounded-3xl border border-violet-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Loader2 className="h-5 w-5 animate-spin" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Qualificando currículo</p>
                <p className="mt-1 text-sm font-black text-stone-900">Analisando a versão que está no preview</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">A nota, os 7 critérios e as sugestões serão atualizados juntos. Outras ações de IA ficam bloqueadas enquanto isso.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!reviewing && analysisStale && previewVisible && (
        <div className="fixed right-4 top-24 z-[82] w-[min(390px,calc(100vw-32px))] rounded-3xl border border-amber-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <RefreshCw className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-amber-700">Currículo alterado</p>
              <p className="mt-1 text-sm font-black text-stone-900">Sua nota continua salva, mas avalia a versão anterior.</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">Como você editou o currículo manualmente, o próximo passo em destaque é atualizar a qualificação. Melhorar com IA continua disponível, mas não é a ação principal agora.</p>
              <button
                type="button"
                onClick={() => void runReview(false)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white hover:bg-amber-700"
              >
                <BrainCircuit className="h-4 w-4" /> Atualizar minha nota{reanalysisPrice ? ` · ${reanalysisPrice}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {!reviewing && error && (
        <div className="fixed bottom-5 left-1/2 z-[145] w-[min(540px,calc(100vw-28px))] -translate-x-1/2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-xs text-rose-700 shadow-xl">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 shrink-0" /> {error}</div>
        </div>
      )}
    </>
  );
}
