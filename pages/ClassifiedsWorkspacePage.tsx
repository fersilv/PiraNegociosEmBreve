import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ClassifiedsWorkspaceGate, ClassifiedsWorkspaceLayout } from '../components/classifieds/ClassifiedsWorkspaceLayout';
import { ClassifiedsWorkspaceProvider } from '../contexts/ClassifiedsWorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import ClassifiedPublishPage from './ClassifiedPublishPage';
import ClassifiedsInboxPage from './ClassifiedsInboxPage';
import ClassifiedsSettingsPage from './ClassifiedsSettingsPage';
import UserClassifiedsPage from './UserClassifiedsPage';

export default function ClassifiedsWorkspacePage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-stone-500">Carregando...</div>;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  let page: React.ReactNode = <UserClassifiedsPage />;
  if (location.pathname.startsWith('/classificados/publicar')) page = <ClassifiedPublishPage />;
  else if (location.pathname.startsWith('/classificados/conversas')) page = <ClassifiedsInboxPage />;
  else if (location.pathname.startsWith('/classificados/configuracoes')) page = <ClassifiedsSettingsPage />;

  return (
    <ClassifiedsWorkspaceProvider>
      <ClassifiedsWorkspaceGate>
        <ClassifiedsWorkspaceLayout>{page}</ClassifiedsWorkspaceLayout>
      </ClassifiedsWorkspaceGate>
    </ClassifiedsWorkspaceProvider>
  );
}
