import axios from 'axios';
import { getAuth } from 'firebase/auth';

// URL base do seu NestJS local (mude se for usar outra porta ou domínio na VPS)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3888';

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
