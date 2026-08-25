import { getPrivacyConsent } from './privacyConsent';

export const GOOGLE_ANALYTICS_ID = 'G-ZNV3N2EDMG';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function gtag(...args: unknown[]) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag(...args);
}

export function syncGoogleAnalyticsConsent() {
  const consent = getPrivacyConsent();
  gtag('consent', 'update', {
    analytics_storage: consent?.analytics ? 'granted' : 'denied',
    ad_storage: consent?.advertising ? 'granted' : 'denied',
    ad_user_data: consent?.advertising ? 'granted' : 'denied',
    ad_personalization: consent?.advertising ? 'granted' : 'denied',
  });
}

export function trackGooglePageView() {
  const consent = getPrivacyConsent();
  if (!consent?.analytics) return;

  gtag('event', 'page_view', {
    send_to: GOOGLE_ANALYTICS_ID,
    page_title: document.title,
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}`,
  });
}
