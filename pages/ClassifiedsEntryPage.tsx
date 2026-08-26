import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ClassifiedsHomePage from './ClassifiedsHomePage';

export default function ClassifiedsEntryPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f4f1] text-sm font-bold text-stone-500">Carregando Classificados...</div>;
  }

  if (user) return <Navigate to="/classificados/explorar" replace />;
  return <ClassifiedsHomePage />;
}
