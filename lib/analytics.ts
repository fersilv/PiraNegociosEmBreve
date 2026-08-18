import { API_URL } from './api';
import { getPrivacyConsent } from './privacyConsent';

const VISITOR_KEY = 'piranegocios_analytics_visitor_v1';
const SESSION_KEY = 'piranegocios_analytics_session_v1';

function identifier(key: string, storage: Storage) {
  let value = storage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    storage.setItem(key, value);
  }
  return value;
}

function clientMeta() {
  const userAgent = navigator.userAgent.toLowerCase();
  return {
    deviceType: /ipad|tablet/.test(userAgent) ? 'tablet' : /mobile|android|iphone/.test(userAgent) ? 'mobile' : 'desktop',
    browser: userAgent.includes('edg/') ? 'Edge' : userAgent.includes('firefox/') ? 'Firefox' : userAgent.includes('chrome/') ? 'Chrome' : userAgent.includes('safari/') ? 'Safari' : 'Other',
    operatingSystem: userAgent.includes('windows') ? 'Windows' : userAgent.includes('android') ? 'Android' : /iphone|ipad|mac os/.test(userAgent) ? 'Apple' : userAgent.includes('linux') ? 'Linux' : 'Other',
  };
}

function referrerOrigin() {
  try { return document.referrer ? new URL(document.referrer).origin : null; } catch { return null; }
}

export function trackAnalytics(eventType: 'PAGE_VIEW' | 'ENGAGEMENT', durationSeconds?: number) {
  if (!getPrivacyConsent()?.analytics) return;
  const query = new URLSearchParams(window.location.search);
  const payload = {
    visitorId: identifier(VISITOR_KEY, localStorage),
    sessionId: identifier(SESSION_KEY, sessionStorage),
    eventType,
    path: `${window.location.pathname}${window.location.search}`,
    referrerOrigin: referrerOrigin(),
    utmSource: query.get('utm_source'), utmMedium: query.get('utm_medium'), utmCampaign: query.get('utm_campaign'),
    durationSeconds, ...clientMeta(),
  };
  void fetch(`${API_URL}/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => undefined);
}
