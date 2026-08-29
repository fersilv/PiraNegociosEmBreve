import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface AiStatus {
  enabled: boolean;
  provider: "GEMINI" | "OPENAI" | "ANTHROPIC" | null;
  model: string | null;
  lifetimeFree: boolean;
  devMode: boolean;
  paymentAccessOverride: boolean;
  resumeScorePaymentRequired: boolean;
  resumeReanalysisPaymentRequired: boolean;
  resumeImprovementPaymentRequired: boolean;
  resumeImportPaymentRequired: boolean;
  freeResumeImportAvailable: boolean;
  resumeImportCount: number;
  resumeImportPriceCents: number | null;
  resumeImportProductEnabled: boolean;
  resumeImportCredits: number;
  resumeReanalysisPriceCents: number | null;
  resumeImprovementPriceCents: number | null;
  freeResumeAnalysisAvailable: boolean;
  hasSavedResumeAnalysis: boolean;
  resumeAnalysisCount: number;
  loading: boolean;
}

const EMPTY_STATUS: AiStatus = {
  enabled: false,
  provider: null,
  model: null,
  lifetimeFree: false,
  devMode: false,
  paymentAccessOverride: false,
  resumeScorePaymentRequired: false,
  resumeReanalysisPaymentRequired: false,
  resumeImprovementPaymentRequired: false,
  resumeImportPaymentRequired: false,
  freeResumeImportAvailable: false,
  resumeImportCount: 0,
  resumeImportPriceCents: null,
  resumeImportProductEnabled: false,
  resumeImportCredits: 0,
  resumeReanalysisPriceCents: null,
  resumeImprovementPriceCents: null,
  freeResumeAnalysisAvailable: false,
  hasSavedResumeAnalysis: false,
  resumeAnalysisCount: 0,
  loading: true,
};

export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>(EMPTY_STATUS);

  useEffect(() => {
    let active = true;

    const load = () => {
      api
        .get("/ai/status")
        .then((response) => {
          if (!active) return;
          const enabled = Boolean(response.data?.enabled);
          setStatus({
            enabled,
            provider: enabled ? response.data?.provider || null : null,
            model: enabled ? response.data?.model || null : null,
            lifetimeFree: Boolean(response.data?.lifetimeFree),
            devMode: Boolean(response.data?.devMode),
            paymentAccessOverride: enabled && Boolean(response.data?.paymentAccessOverride),
            resumeScorePaymentRequired: enabled && Boolean(response.data?.resumeScorePaymentRequired),
            resumeReanalysisPaymentRequired: enabled && Boolean(response.data?.resumeReanalysisPaymentRequired),
            resumeImprovementPaymentRequired: enabled && Boolean(response.data?.resumeImprovementPaymentRequired),
            resumeImportPaymentRequired: enabled && Boolean(response.data?.resumeImportPaymentRequired),
            freeResumeImportAvailable: enabled && response.data?.freeResumeImportAvailable !== false,
            resumeImportCount: Number(response.data?.resumeImportCount || 0),
            resumeImportPriceCents: enabled && Number.isFinite(Number(response.data?.products?.import?.effectivePriceCents))
              ? Number(response.data.products.import.effectivePriceCents)
              : null,
            resumeImportProductEnabled: enabled && Boolean(response.data?.products?.import?.enabled),
            resumeImportCredits: enabled ? Number(response.data?.credits?.RESUME_AI_IMPORT || 0) : 0,
            resumeReanalysisPriceCents: enabled && Number.isFinite(Number(response.data?.products?.reanalysis?.effectivePriceCents))
              ? Number(response.data.products.reanalysis.effectivePriceCents)
              : null,
            resumeImprovementPriceCents: enabled && Number.isFinite(Number(response.data?.products?.improvement?.effectivePriceCents))
              ? Number(response.data.products.improvement.effectivePriceCents)
              : null,
            freeResumeAnalysisAvailable: enabled && response.data?.freeResumeAnalysisAvailable !== false,
            hasSavedResumeAnalysis: enabled && Boolean(response.data?.hasSavedResumeAnalysis),
            resumeAnalysisCount: Number(response.data?.resumeAnalysisCount || 0),
            loading: false,
          });
        })
        .catch(() => {
          if (!active) return;
          setStatus({ ...EMPTY_STATUS, loading: false });
        });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    const handlePaymentCompleted = () => load();

    load();
    window.addEventListener("focus", load);
    window.addEventListener("piranegocios:payment-completed", handlePaymentCompleted);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.removeEventListener("focus", load);
      window.removeEventListener("piranegocios:payment-completed", handlePaymentCompleted);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return status;
}