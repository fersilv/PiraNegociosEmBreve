import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClassifiedsWorkspaceGate, ClassifiedsWorkspaceLayout } from '../components/classifieds/ClassifiedsWorkspaceLayout';
import { ClassifiedsWorkspaceProvider } from '../contexts/ClassifiedsWorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import ClassifiedCommerceEditorPage from './ClassifiedCommerceEditorPage';
import ClassifiedPublishPage from './ClassifiedPublishPage';
import ClassifiedsAnalyticsPage from './ClassifiedsAnalyticsPage';
import ClassifiedsAuctionManagementPage from './ClassifiedsAuctionManagementPage';
import ClassifiedsAuctionsLivePageV2 from './ClassifiedsAuctionsLivePageV2';
import ClassifiedsExplorePage from './ClassifiedsExplorePage';
import ClassifiedsListingsPage from './ClassifiedsListingsPage';
import ClassifiedsMessengerPage from './ClassifiedsMessengerPage';
import ClassifiedsOffersPage from './ClassifiedsOffersPage';
import ClassifiedsReceiptPreferencesPage from './ClassifiedsReceiptPreferencesPage';
import ClassifiedsReviewsPage from './ClassifiedsReviewsPage';
import ClassifiedsSalesPage from './ClassifiedsSalesPage';
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

  const isIntegratedLiveAuction = location.pathname.startsWith('/classificados/gestao/leiloes/') && location.pathname.endsWith('/ao-vivo');
  let page: React.ReactNode = <UserClassifiedsPage />;
  if (isIntegratedLiveAuction) page = <ClassifiedsAuctionsLivePageV2 embedded />;
  else if (location.pathname.startsWith('/classificados/gestao/leiloes')) page = <ClassifiedsAuctionManagementPage />;
  else if (location.pathname.startsWith('/classificados/explorar')) page = <ClassifiedsExplorePage />;
  else if (location.pathname.startsWith('/classificados/recebimentos')) page = <ClassifiedsReceiptPreferencesPage />;
  else if (location.pathname.startsWith('/classificados/avaliacoes')) page = <ClassifiedsReviewsPage />;
  else if (location.pathname.startsWith('/classificados/vendas')) page = <ClassifiedsSalesPage />;
  else if (location.pathname.startsWith('/classificados/comercial/')) page = <ClassifiedCommerceEditorPage />;
  else if (location.pathname.startsWith('/classificados/publicar')) page = <ClassifiedPublishPage />;
  else if (location.pathname.startsWith('/classificados/ofertas')) page = <ClassifiedsOffersPage />;
  else if (location.pathname.startsWith('/classificados/anuncios')) page = <ClassifiedsListingsPage listingType="PRODUCT" />;
  else if (location.pathname.startsWith('/classificados/servicos')) page = <ClassifiedsListingsPage listingType="SERVICE" />;
  else if (location.pathname.startsWith('/classificados/analytics')) page = <ClassifiedsAnalyticsPage />;
  else if (location.pathname.startsWith('/classificados/conversas')) page = <ClassifiedsMessengerPage />;
  else if (location.pathname.startsWith('/classificados/configuracoes')) page = <ClassifiedsSettingsPage />;

  return <ClassifiedsWorkspaceLayout>{page}</ClassifiedsWorkspaceLayout>;
}

function safeReturnTo(value: string | null) {
  const candidate = String(value || '/classificados/explorar').trim();
  return candidate.startsWith('/classificados/') || candidate === '/classificados' ? candidate : '/classificados/explorar';
}
