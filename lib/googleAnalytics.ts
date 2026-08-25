import { getPrivacyConsent } from './privacyConsent';

export const GOOGLE_ANALYTICS_ID = 'G-ZNV3N2EDMG';

let bootstrapped = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function ensureGoogleAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (bootstrapped) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => {
    window.dataLayer?.push(args);
  });

  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_ANALYTICS_ID, { send_page_view: false });

  if (!document.querySelector(`script[data-ga4-id="${GOOGLE_ANALYTICS_ID}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ANALYTICS_ID)}`;
    script.dataset.ga4Id = GOOGLE_ANALYTICS_ID;
    document.head.appendChild(script);
  }

  bootstrapped = true;
}

function gtag(...args: unknown[]) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag(...args);
}

export function syncGoogleAnalyticsConsent() {
  const consent = getPrivacyConsent();
  if (consent?.analytics) ensureGoogleAnalytics();
  if (!bootstrapped) return;

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

  ensureGoogleAnalytics();
  syncGoogleAnalyticsConsent();
  gtag('event', 'page_view', {
    send_to: GOOGLE_ANALYTICS_ID,
    page_title: document.title,
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}`,
  });
}
