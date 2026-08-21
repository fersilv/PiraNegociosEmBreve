import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface AiStatus {
  enabled: boolean;
  provider: "GEMINI" | "OPENAI" | "ANTHROPIC" | null;
  model: string | null;
  resumeScorePaymentRequired: boolean;
  resumeReanalysisPaymentRequired: boolean;
  freeResumeAnalysisAvailable: boolean;
  hasSavedResumeAnalysis: boolean;
  resumeAnalysisCount: number;
  loading: boolean;
}

export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>({
    enabled: false,
    provider: null,
    model: null,
    resumeScorePaymentRequired: false,
    resumeReanalysisPaymentRequired: false,
    freeResumeAnalysisAvailable: true,
    hasSavedResumeAnalysis: false,
    resumeAnalysisCount: 0,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    api
      .get("/ai/status")
      .then((response) => {
        if (!active) return;
        setStatus({
          enabled: Boolean(response.data?.enabled),
          provider: response.data?.provider || null,
          model: response.data?.model || null,
          resumeScorePaymentRequired: Boolean(
            response.data?.resumeScorePaymentRequired,
          ),
          resumeReanalysisPaymentRequired: Boolean(
            response.data?.resumeReanalysisPaymentRequired,
          ),
          freeResumeAnalysisAvailable:
            response.data?.freeResumeAnalysisAvailable !== false,
          hasSavedResumeAnalysis: Boolean(
            response.data?.hasSavedResumeAnalysis,
          ),
          resumeAnalysisCount: Number(response.data?.resumeAnalysisCount || 0),
          loading: false,
        });
      })
      .catch(() => {
        if (!active) return;
        setStatus({
          enabled: false,
          provider: null,
          model: null,
          resumeScorePaymentRequired: false,
          resumeReanalysisPaymentRequired: false,
          freeResumeAnalysisAvailable: true,
          hasSavedResumeAnalysis: false,
          resumeAnalysisCount: 0,
          loading: false,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return status;
}
