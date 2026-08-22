import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface ImageAiStatus {
  enabled: boolean;
  provider: 'GEMINI' | 'OPENAI' | null;
  model: string | null;
  loading: boolean;
}

export function useImageAiStatus(): ImageAiStatus {
  const [status, setStatus] = useState<ImageAiStatus>({
    enabled: false,
    provider: null,
    model: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    api
      .get('/ai/photo-status')
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
