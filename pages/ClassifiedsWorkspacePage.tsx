import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClassifiedsWorkspaceGate, ClassifiedsWorkspaceLayout } from '../components/classifieds/ClassifiedsWorkspaceLayout';
import { ClassifiedsWorkspaceProvider, useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import ClassifiedCommerceEditorPage from './ClassifiedCommerceEditorPage';
import ClassifiedPublishPage from './ClassifiedPublishPage';
import ClassifiedsAnalyticsPage from './ClassifiedsAnalyticsPage';
import ClassifiedsAuctionManagementPage from './ClassifiedsAuctionManagementPage';
import ClassifiedsAuctionsLivePageV2 from './ClassifiedsAuctionsLivePageV2';
import ClassifiedsCartPage from './ClassifiedsCartPage';
import ClassifiedsDeliveryOperationsPage from './ClassifiedsDeliveryOperationsPage';
import ClassifiedsExplorePage from './ClassifiedsExplorePage';
import ClassifiedsFavoritesPage from './ClassifiedsFavoritesPage';
import ClassifiedsListingsPage from './ClassifiedsListingsPage';
import ClassifiedsInventoryPage from './ClassifiedsInventoryPage';
import ClassifiedsLogisticsPage from './ClassifiedsLogisticsPage';
import ClassifiedsMessengerPage from './ClassifiedsMessengerPage';
import ClassifiedsOffersPage from './ClassifiedsOffersPage';
import ClassifiedsOrdersNowPage from './ClassifiedsOrdersNowPage';
import ClassifiedsPurchasesPage from './ClassifiedsPurchasesPage';
import ClassifiedsReceiptPreferencesPage from './ClassifiedsReceiptPreferencesPage';
import ClassifiedsReviewsPage from './ClassifiedsReviewsPage';
import ClassifiedsSalesPage from './ClassifiedsSalesPage';
import ClassifiedsServiceQuotesPage from './ClassifiedsServiceQuotesPage';
import ClassifiedsSettingsPage from './ClassifiedsSettingsPage';
import UserClassifiedsPage from './UserClassifiedsPage';
import { CompanyPlansPage } from './CompanyPlansPage';
import { CompanyProfilePage } from './CompanyProfilePage';
import { CompanyPageBuilderV3 } from './CompanyPageBuilderV3';
import { CompanyPageBuilderV4 } from './CompanyPageBuilderV4';

function VerifiedCompanyPageRoute({ companyId }: { companyId: string }) {
  const [hasPageVersion, setHasPageVersion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    api.get(`/companies/${companyId}/page`)
      .then((response) => {
        if (!active) return;
        setHasPageVersion(Boolean(response.data?.draft?.version ?? response.data?.page?.version));
      })
      .catch(() => {
        if (active) setHasPageVersion(true);
      });
    return () => { active = false; };
  }, [companyId]);

  if (hasPageVersion == null) return <div className="p-8 text-stone-500">Carregando...</div>;
  return hasPageVersion ? <CompanyPageBuilderV4 /> : <CompanyPageBuilderV3 />;
}

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
  const { data } = useClassifiedsWorkspace();
  const companyId = data?.company?.id;
  const business = data?.activeIdentity === 'COMPANY';
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

  const isIntegratedAuctionArena = location.pathname === '/classificados/gestao/leiloes/arena';
  const isIntegratedLiveAuction = location.pathname.startsWith('/classificados/gestao/leiloes/') && location.pathname.endsWith('/ao-vivo');
  let page: React.ReactNode = <UserClassifiedsPage />;

  if (location.pathname.startsWith('/classificados/empresa/pagina') && companyId) page = <VerifiedCompanyPageRoute companyId={companyId} />;
  else if (location.pathname.startsWith('/classificados/empresa/planos') && companyId) page = <CompanyPlansPage />;
  else if (location.pathname.startsWith('/classificados/empresa/comercial') && companyId) page = <CompanyProfilePage section="commercial" />;
  else if (isIntegratedAuctionArena || isIntegratedLiveAuction) page = <ClassifiedsAuctionsLivePageV2 embedded />;
  else if (location.pathname.startsWith('/classificados/gestao/leiloes')) page = <ClassifiedsAuctionManagementPage />;
  else if (location.pathname.startsWith('/classificados/carrinho')) page = <ClassifiedsCartPage />;
  else if (location.pathname.startsWith('/classificados/compras')) page = <ClassifiedsPurchasesPage />;
  else if (location.pathname.startsWith('/classificados/favoritos')) page = <ClassifiedsFavoritesPage />;
  else if (location.pathname.startsWith('/classificados/logistica')) page = <ClassifiedsLogisticsPage />;
  else if (location.pathname.startsWith('/classificados/entregas')) page = <ClassifiedsDeliveryOperationsPage />;
  else if (location.pathname.startsWith('/classificados/orcamentos')) page = <ClassifiedsServiceQuotesPage />;
  else if (location.pathname.startsWith('/classificados/explorar')) page = <ClassifiedsExplorePage />;
  else if (location.pathname.startsWith('/classificados/recebimentos')) page = <ClassifiedsReceiptPreferencesPage />;
  else if (location.pathname.startsWith('/classificados/avaliacoes')) page = <ClassifiedsReviewsPage />;
  else if (location.pathname.startsWith('/classificados/pedidos')) page = <ClassifiedsOrdersNowPage />;
  else if (location.pathname.startsWith('/classificados/vendas')) page = <ClassifiedsSalesPage />;
  else if (location.pathname.startsWith('/classificados/estoque')) page = <ClassifiedsInventoryPage />;
  else if (location.pathname.startsWith('/classificados/comercial/')) page = <ClassifiedCommerceEditorPage />;
  else if (location.pathname.startsWith('/classificados/publicar')) page = <ClassifiedPublishPage />;
  else if (location.pathname.startsWith('/classificados/ofertas')) page = <ClassifiedsOffersPage />;
  else if (location.pathname.startsWith('/classificados/anuncios')) page = <ClassifiedsListingsPage listingType="PRODUCT" />;
  else if (location.pathname.startsWith('/classificados/servicos')) page = <ClassifiedsListingsPage listingType="SERVICE" />;
  else if (location.pathname.startsWith('/classificados/analytics')) page = <ClassifiedsAnalyticsPage />;
  else if (location.pathname.startsWith('/classificados/conversas')) page = <ClassifiedsMessengerPage />;
  else if (location.pathname.startsWith('/classificados/configuracoes')) page = <ClassifiedsSettingsPage />;

  return <ClassifiedsWorkspaceLayout><CommerceQuickNav business={business} pathname={location.pathname} />{page}</ClassifiedsWorkspaceLayout>;
}

function CommerceQuickNav({ business, pathname }: { business: boolean; pathname: string }) {
  const items = [
    { to: '/classificados/favoritos', label: 'Favoritos' },
    { to: '/classificados/carrinho', label: 'Carrinho' },
    { to: '/classificados/compras', label: 'Compras' },
    { to: '/classificados/orcamentos', label: 'Orçamentos' },
    ...(business ? [{ to: '/classificados/pedidos', label: 'Pedidos agora' }] : []),
    { to: '/classificados/logistica', label: 'Logística' },
    ...(business ? [{ to: '/classificados/entregas', label: 'Entregas' }] : []),
    { to: business ? '/company/pagamentos' : '/user/pagamentos', label: 'Transações financeiras' },
  ];
  return <nav className="mx-auto mb-5 flex max-w-7xl gap-2 overflow-x-auto rounded-2xl bg-white/80 p-2 shadow-sm ring-1 ring-black/[.05]">{items.map((item) => {
    const active = item.to.startsWith('/classificados/') && pathname.startsWith(item.to);
    return <Link key={item.to} to={item.to} className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-black transition ${active ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'}`}>{item.label}</Link>;
  })}</nav>;
}

function safeReturnTo(value: string | null) {
  const candidate = String(value || '/classificados/explorar').trim();
  return candidate.startsWith('/classificados/') || candidate === '/classificados' ? candidate : '/classificados/explorar';
}
