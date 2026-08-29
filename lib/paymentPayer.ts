export type PaymentDocumentType = 'CPF' | 'CNPJ';

export type RememberedPayerDocument = {
  type: PaymentDocumentType;
  document: string;
};

const STORAGE_KEY = 'piranegocios:payer-document:v1';

export function cleanPaymentDocument(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizePaymentDocumentType(value: unknown): PaymentDocumentType {
  return String(value || '').toUpperCase() === 'CNPJ' ? 'CNPJ' : 'CPF';
}

export function isValidPaymentDocumentLength(type: PaymentDocumentType, value: unknown) {
  const digits = cleanPaymentDocument(value);
  return type === 'CNPJ' ? digits.length === 14 : digits.length === 11;
}

export function paymentDocumentPlaceholder(type: PaymentDocumentType) {
  return type === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00';
}

export function loadRememberedPayerDocument(): RememberedPayerDocument | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const type = normalizePaymentDocumentType(parsed.type);
    const document = cleanPaymentDocument(parsed.document);
    return isValidPaymentDocumentLength(type, document) ? { type, document } : null;
  } catch {
    return null;
  }
}

export function saveRememberedPayerDocument(type: PaymentDocumentType, value: unknown) {
  if (typeof window === 'undefined') return;
  const document = cleanPaymentDocument(value);
  if (!isValidPaymentDocumentLength(type, document)) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ type, document }));
}

export function forgetRememberedPayerDocument() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
