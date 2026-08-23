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
  freeResumeAnalysisAvailable: true,
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
          setStatus({
            enabled: Boolean(response.data?.enabled),
            provider: response.data?.provider || null,
            model: response.data?.model || null,
            lifetimeFree: Boolean(response.data?.lifetimeFree),
            devMode: Boolean(response.data?.devMode),
            paymentAccessOverride: Boolean(response.data?.paymentAccessOverride),
            resumeScorePaymentRequired: Boolean(response.data?.resumeScorePaymentRequired),
            resumeReanalysisPaymentRequired: Boolean(response.data?.resumeReanalysisPaymentRequired),
            freeResumeAnalysisAvailable: response.data?.freeResumeAnalysisAvailable !== false,
            hasSavedResumeAnalysis: Boolean(response.data?.hasSavedResumeAnalysis),
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

    load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return status;
}
