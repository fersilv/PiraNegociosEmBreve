import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const SESSION_KEY = 'pira-public-resume-session-v1';
const LINKED_KEY = 'pira-public-resume-linked-v1';

export function PublicResumeAccountBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as { id?: string; token?: string };
      if (!stored.id || !stored.token) return;
      if (localStorage.getItem(LINKED_KEY) === stored.id) return;
      api.post('/public-resume-account/link', {
        sessionId: stored.id,
        token: stored.token,
      }).then(() => {
        localStorage.setItem(LINKED_KEY, stored.id!);
      }).catch(() => undefined);
    } catch {
      // Sessões locais antigas ou corrompidas não devem interferir no login.
    }
  }, [user]);

  return null;
}
