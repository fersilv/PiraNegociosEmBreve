import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { requestInlinePayment } from './paymentRequiredCoordinator';

// Never ship a localhost fallback: in production it would target the visitor's own machine.
// The production default is the same-origin reverse-proxy path, so a build cannot
// accidentally call the frontend root when VITE_API_URL is omitted.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
export const API_URL = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3888' : '/api');
const apiPath = new URL(API_URL, window.location.origin).pathname.replace(/\/$/, '');
export const SOCKET_PATH = `${apiPath}/socket.io`;

/** Safely consumes endpoints that are expected to return a collection. */
export const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Interceptor para adicionar o Token do Firebase em todas as requisições.
// /users/me já possui POST como contrato estável de atualização e alguns
// ambientes antigos ainda não expõem PATCH. Normalizamos aqui para evitar que
// telas novas dependam do método HTTP adicionado posteriormente.
api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;

  const normalizedUrl = String(config.url || '').split('?')[0].replace(/\/$/, '');
  if (normalizedUrl === '/users/me' && config.method?.toLowerCase() === 'patch') {
    config.method = 'post';
  }

  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Recursos pagos não devem expulsar o usuário para uma tela financeira genérica.
// Quando o backend responde PAYMENT_REQUIRED, a requisição fica pausada enquanto
// o workspace abre o checkout contextual. Após a confirmação, repetimos a mesma
// operação uma única vez, já com o crédito/benefício liberado.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const payload = error?.response?.data;
    const config = error?.config as any;
    if (
      payload?.code === 'PAYMENT_REQUIRED'
      && config
      && config.__piraInlinePaymentRetried !== true
      && !String(config.url || '').includes('/payments/pix')
    ) {
      try {
        await requestInlinePayment({
          productCode: String(payload.productCode || payload.product?.code || ''),
          product: payload.product || null,
          message: payload.message || undefined,
        });
        config.__piraInlinePaymentRetried = true;
        return api.request(config);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
