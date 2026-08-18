export type PrivacyConsent = {
  version: 1;
  essential: true;
  analytics: boolean;
  advertising: boolean;
  updatedAt: string;
};

const STORAGE_KEY = 'piranegocios_privacy_consent_v1';
export const PRIVACY_CONSENT_EVENT = 'piranegocios:privacy-consent';

export function getPrivacyConsent(): PrivacyConsent | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as PrivacyConsent;
    return parsed?.version === 1 && parsed.essential === true ? parsed : null;
  } catch {
    return null;
  }
}

export function savePrivacyConsent(input: Pick<PrivacyConsent, 'analytics' | 'advertising'>): PrivacyConsent {
  const consent: PrivacyConsent = { version: 1, essential: true, ...input, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent<PrivacyConsent>(PRIVACY_CONSENT_EVENT, { detail: consent }));
  return consent;
}
