import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackAnalytics } from '../lib/analytics';
import { PRIVACY_CONSENT_EVENT } from '../lib/privacyConsent';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export function AnalyticsTracker() {
  const location = useLocation();
  const { profile, loading } = useAuth();
  const isAdmin = profile?.type === 'ADMIN';

  useEffect(() => {
    // Só começa a medir depois que o perfil autenticado foi resolvido. Assim um
    // administrador nunca gera um PAGE_VIEW acidental durante o bootstrap.
    if (loading || isAdmin) return;

    const startedAt = Date.now();
    trackAnalytics('PAGE_VIEW');

    const jobMatch = location.pathname.match(/^\/vagas\/([^/]+)$/);
    if (jobMatch?.[1]) {
      void api
        .post(`/public/jobs-by-slug/${encodeURIComponent(jobMatch[1])}/view`)
        .catch((error) => {
          console.warn('Não foi possível registrar a visualização da vaga.', error);
        });
    }

    const onConsentChanged = () => trackAnalytics('PAGE_VIEW');
    window.addEventListener(PRIVACY_CONSENT_EVENT, onConsentChanged);

    return () => {
      window.removeEventListener(PRIVACY_CONSENT_EVENT, onConsentChanged);
      trackAnalytics(
        'ENGAGEMENT',
        Math.round((Date.now() - startedAt) / 1000),
      );
    };
  }, [location.pathname, location.search, loading, isAdmin]);

  return null;
}
