import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClassifiedsWorkspaceGate, ClassifiedsWorkspaceLayout } from '../components/classifieds/ClassifiedsWorkspaceLayout';
import { ClassifiedsWorkspaceProvider } from '../contexts/ClassifiedsWorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import ClassifiedPublishPage from './ClassifiedPublishPage';
import ClassifiedsInboxPage from './ClassifiedsInboxPage';
import ClassifiedsSettingsPage from './ClassifiedsSettingsPage';
import UserClassifiedsPage from './UserClassifiedsPage';

export default function ClassifiedsWorkspacePage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-stone-500">Carregando...</div>;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  return (
    <ClassifiedsWorkspaceProvider>
      <ClassifiedsWorkspaceGate>
        <WorkspaceReadyContent />
      </ClassifiedsWorkspaceGate>
    </ClassifiedsWorkspaceProvider>
  );
}

function WorkspaceReadyContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [resumeError, setResumeError] = useState('');
  const startConversation = searchParams.get('startConversation');
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  useEffect(() => {
    if (!startConversation) return;
    let active = true;
    api.post(`/classifieds/listings/${encodeURIComponent(startConversation)}/conversations`)
      .then((response) => {
        if (!active) return;
        if (response.data?.id) navigate(`/classificados/conversas/${response.data.id}`, { replace: true });
        else navigate(returnTo, { replace: true });
      })
      .catch((requestError: any) => {
        if (!active) return;
        const message = requestError?.response?.data?.message || 'Não foi possível abrir a conversa.';
        setResumeError(message);
        navigate(returnTo, { replace: true, state: { classifiedConversationError: message } });
      });
    return () => { active = false; };
  }, [startConversation, returnTo, navigate]);

  if (startConversation) {
    return <div className="flex min-h-[55vh] items-center justify-center px-4 text-center"><div><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-stone-200 border-t-stone-800" /><p className="mt-4 text-sm font-black text-stone-700">Abrindo sua negociação...</p>{resumeError && <p className="mt-2 text-xs text-red-600">{resumeError}</p>}</div></div>;
  }

  let page: React.ReactNode = <UserClassifiedsPage />;
  if (location.pathname.startsWith('/classificados/publicar')) page = <ClassifiedPublishPage />;
  else if (location.pathname.startsWith('/classificados/conversas')) page = <ClassifiedsInboxPage />;
  else if (location.pathname.startsWith('/classificados/configuracoes')) page = <ClassifiedsSettingsPage />;

  return <ClassifiedsWorkspaceLayout>{page}</ClassifiedsWorkspaceLayout>;
}

function safeReturnTo(value: string | null) {
  const candidate = String(value || '/classificados').trim();
  return candidate.startsWith('/classificados/') || candidate === '/classificados' ? candidate : '/classificados';
}
