import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackAnalytics } from '../lib/analytics';
import { PRIVACY_CONSENT_EVENT } from '../lib/privacyConsent';

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    const startedAt = Date.now();
    trackAnalytics('PAGE_VIEW');
    const onConsentChanged = () => trackAnalytics('PAGE_VIEW');
    window.addEventListener(PRIVACY_CONSENT_EVENT, onConsentChanged);
    return () => {
      window.removeEventListener(PRIVACY_CONSENT_EVENT, onConsentChanged);
      trackAnalytics('ENGAGEMENT', Math.round((Date.now() - startedAt) / 1000));
    };
  }, [location.pathname, location.search]);

  return null;
}
