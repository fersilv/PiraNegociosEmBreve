import axios from 'axios';
import { getAuth } from 'firebase/auth';

// Never ship a localhost fallback: in production it would target the visitor's own machine.
// Leave VITE_API_URL empty only when the reverse proxy serves the API on the same origin.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
export const API_URL = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3888' : '');
const apiPath = configuredApiUrl
  ? new URL(configuredApiUrl, window.location.origin).pathname.replace(/\/$/, '')
  : '';
export const SOCKET_PATH = `${apiPath}/socket.io`;

/** Safely consumes endpoints that are expected to return a collection. */
export const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Interceptor para adicionar o Token do Firebase em todas as requisições
api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});
