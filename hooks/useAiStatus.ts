import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface AiStatus {
  enabled: boolean;
  provider: "GEMINI" | "OPENAI" | "ANTHROPIC" | null;
  model: string | null;
  loading: boolean;
}

export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>({
    enabled: false,
    provider: null,
    model: null,
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
          loading: false,
        });
      })
      .catch(() => {
        if (!active) return;
        setStatus({
          enabled: false,
          provider: null,
          model: null,
          loading: false,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return status;
}
