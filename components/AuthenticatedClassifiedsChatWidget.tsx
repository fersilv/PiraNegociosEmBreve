import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Atalho global temporário para as conversas dos Classificados.
 *
 * Substitui a antiga bolha de suporte/IA enquanto o consumo de IA do portal
 * é reorganizado. Não chama modelo, não cria polling e não roda tarefa em
 * background: é somente navegação para o chat entre usuários já existente.
 */
export function AuthenticatedClassifiedsChatWidget() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || !user) return null;
  if (location.pathname.startsWith('/classificados/conversas')) return null;

  return (
    <Link
      to="/classificados/conversas"
      aria-label="Abrir conversas dos Classificados"
      title="Conversas dos Classificados"
      className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full border border-[#d9c2b8] bg-[#fff8f2] text-[#9f4e3d] shadow-[0_16px_40px_rgba(90,45,34,.22)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#ead7cf]"
    >
      <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
      <span className="sr-only">Conversas dos Classificados</span>
    </Link>
  );
}
