import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AdminWorkspaceReturn() {
  const { profile } = useAuth();
  const location = useLocation();
  if (profile?.type !== 'ADMIN') return null;
  if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) return null;

  const insideWorkspace =
    location.pathname === '/user' || location.pathname.startsWith('/user/') ||
    location.pathname === '/company' || location.pathname.startsWith('/company/') ||
    location.pathname === '/classificados' || location.pathname.startsWith('/classificados/');
  if (!insideWorkspace) return null;

  return (
    <Link
      to="/admin"
      className="fixed bottom-24 right-4 z-[70] inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-[#171714] px-4 py-3 text-xs font-black text-white shadow-[0_18px_50px_rgba(0,0,0,.3)] transition hover:-translate-y-0.5 hover:bg-[#24241f] md:bottom-5 md:right-5"
      title="Voltar ao PiraNegócios Control Center"
    >
      <ShieldCheck className="h-4 w-4 text-[#f2c5ad]" />
      Voltar ao Admin
    </Link>
  );
}
