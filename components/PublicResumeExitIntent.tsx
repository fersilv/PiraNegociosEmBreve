import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  LogIn,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const EXIT_INTENT_KEY = 'pira-public-resume-exit-intent-v1';
const DRAFT_KEY = 'pira-public-resume-draft-v1';
const PUBLIC_RESUME_PATHS = new Set([
  '/criador-de-curriculo',
  '/criar-curriculo',
  '/curriculo-online',
]);

function readDraftEnvelope(): { profile?: any; [key: string]: any } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.profile && typeof parsed.profile === 'object') return parsed;
    return { profile: parsed };
  } catch {
    return null;
  }
}

function draftProfile() {
  return readDraftEnvelope()?.profile || null;
}

function hasMeaningfulDraft() {
  const profile = draftProfile();
  if (!profile || typeof profile !== 'object') return false;
  return Boolean(
    String(profile.fullName || '').trim()
    || String(profile.bio || '').trim()
    || String(profile.resumePreferences?.headline || '').trim()
    || profile.experiences?.length
    || profile.education?.length
    || profile.skills?.length
    || profile.courses?.length
  );
}

function isReadyForCurrentAiCheckout() {
  const profile = draftProfile();
  if (!profile || typeof profile !== 'object') return false;
  return Boolean(
    String(profile.fullName || '').trim()
    && (String(profile.email || '').trim() || String(profile.phone || '').trim())
    && (profile.experiences?.length || profile.education?.length)
    && profile.skills?.length
  );
}

function checkoutOrAiIsOpen() {
  const buttons = Array.from(document.querySelectorAll('button'));
  const checkoutButton = buttons.some((button) => {
    const text = String(button.textContent || '').trim();
    return text === 'Gerar Pix' || text === 'Copiar Pix';
  });
  if (checkoutButton) return true;
  return String(document.body?.textContent || '').includes('IA trabalhando no seu currículo');
}

function clickAiReviewAction() {
  const button = Array.from(document.querySelectorAll('button')).find((item) =>
    String(item.textContent || '').includes('Analisar currículo'),
  );
  if (button instanceof HTMLButtonElement) {
    button.click();
    return true;
  }
  return false;
}

export function PublicResumeExitIntent() {
  const { user } = useAuth();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [reviewPriceCents, setReviewPriceCents] = useState(199);
  const mountedAt = useRef(Date.now());
  const path = location.pathname.replace(/\/$/, '') || '/';
  const isPublicResume = PUBLIC_RESUME_PATHS.has(path);
  const aiReady = isReadyForCurrentAiCheckout();

  useEffect(() => {
    if (!isPublicResume) return;
    let active = true;
    api.get('/public-resume/catalog')
      .then((response) => {
        if (!active || !Array.isArray(response.data)) return;
        const review = response.data.find((item: any) => item?.code === 'PUBLIC_RESUME_AI_REVIEW');
        const price = Number(review?.effectivePriceCents ?? review?.priceCents);
        if (Number.isFinite(price) && price > 0) setReviewPriceCents(price);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isPublicResume]);

  useEffect(() => {
    if (!isPublicResume) return;
    if (!window.matchMedia?.('(pointer: fine)').matches) return;
    if (sessionStorage.getItem(EXIT_INTENT_KEY) === '1') return;

    mountedAt.current = Date.now();
    const onMouseOut = (event: MouseEvent) => {
      if (visible) return;
      if (event.relatedTarget) return;
      if (event.clientY > 10) return;
      if (Date.now() - mountedAt.current < 8000) return;
      if (!hasMeaningfulDraft()) return;
      if (checkoutOrAiIsOpen()) return;

      sessionStorage.setItem(EXIT_INTENT_KEY, '1');
      setVisible(true);
    };

    document.addEventListener('mouseout', onMouseOut);
    return () => document.removeEventListener('mouseout', onMouseOut);
  }, [isPublicResume, visible]);

  if (!isPublicResume || !visible) return null;

  const price = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(reviewPriceCents / 100);

  const close = () => setVisible(false);

  const analyze = () => {
    setVisible(false);
    if (aiReady && clickAiReviewAction()) return;
    window.setTimeout(() => {
      document.getElementById('editor-publico')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  const saveToAccount = () => {
    const envelope = readDraftEnvelope();
    if (envelope?.profile) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        ...envelope,
        pendingAccountImport: true,
        updatedAt: new Date().toISOString(),
      }));
    }
    window.location.href = `/login?mode=register&returnTo=${encodeURIComponent('/user/curriculo')}`;
  };

  return (
    <div className="public-resume-no-print fixed inset-0 z-[220] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-resume-exit-title"
        className="w-full max-w-xl overflow-hidden rounded-[30px] border border-white/30 bg-[#fffaf5] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-[#2b211c] px-6 pb-6 pt-7 text-white sm:px-7">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#d86f50]/20 blur-2xl" />
          <button type="button" onClick={close} className="absolute right-4 top-4 rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
          <span className="relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-[#f0c2a8]">
            <Sparkles className="h-3.5 w-3.5" /> Antes de ir
          </span>
          <h2 id="public-resume-exit-title" className="relative mt-4 max-w-md font-serif text-3xl font-black leading-tight">
            Seu currículo está pronto para uma segunda opinião?
          </h2>
          <p className="relative mt-2 max-w-lg text-sm leading-6 text-white/60">
            Uma análise profissional pode mostrar pontos que passam despercebidos quando a gente lê o próprio currículo.
          </p>
        </div>

        <div className="p-5 sm:p-7">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-stone-950">Analisar meu currículo com IA</strong>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-violet-800 shadow-sm">{price}</span>
                </div>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-stone-600 sm:grid-cols-2">
                  <span className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Nota geral de 0 a 100</span>
                  <span className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Pontos fortes do documento</span>
                  <span className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Lacunas e seções fracas</span>
                  <span className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Recomendações práticas</span>
                </div>
                {!aiReady && <p className="mt-3 rounded-xl bg-white/75 px-3 py-2 text-[11px] leading-5 text-violet-900">Seu currículo ainda precisa de alguns campos essenciais antes da análise. Você pode continuar preenchendo e voltar quando quiser.</p>}
                <button type="button" onClick={analyze} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800">
                  {aiReady ? 'Quero analisar meu currículo' : 'Continuar preenchendo para analisar'} <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-2 text-center text-[10px] text-stone-400">Pagamento único. Sem assinatura.</p>
              </div>
            </div>
          </div>

          {!user && (
            <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><FileCheck2 className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <strong className="text-sm text-stone-950">Não quer perder o que já fez?</strong>
                  <p className="mt-1 text-xs leading-5 text-stone-500">Crie sua conta grátis para levar este currículo ao seu perfil, continuar editando depois e decidir se quer aparecer no Banco de Talentos.</p>
                  <button type="button" onClick={saveToAccount} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-black text-stone-700 transition hover:border-stone-300 hover:bg-stone-100">
                    <LogIn className="h-4 w-4" /> Salvar na minha conta grátis
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-stone-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Seu currículo continua salvo localmente neste navegador.
          </div>
        </div>
      </section>
    </div>
  );
}
