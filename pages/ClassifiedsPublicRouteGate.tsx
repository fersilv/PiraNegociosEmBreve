import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ClassifiedListingPage from './ClassifiedListingPage';
import ClassifiedsAuctionsLivePageV2 from './ClassifiedsAuctionsLivePageV2';
import ClassifiedsSearchPage from './ClassifiedsSearchPage';

type Mode = 'SEARCH' | 'LISTING' | 'AUCTIONS';

export default function ClassifiedsPublicRouteGate({ mode }: { mode: Mode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { slug, auctionId } = useParams();

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f6f4f1] text-sm font-bold text-stone-500">Carregando...</div>;

  if (user) {
    if (mode === 'LISTING' && slug) return <Navigate to={`/classificados/explorar/${encodeURIComponent(slug)}`} replace />;
    if (mode === 'AUCTIONS') {
      const target = auctionId
        ? `/classificados/gestao/leiloes/${encodeURIComponent(auctionId)}/ao-vivo`
        : '/classificados/gestao/leiloes';
      return <Navigate to={target} replace />;
    }
    return <Navigate to={`/classificados/explorar${location.search}`} replace />;
  }

  if (mode === 'LISTING') return <ClassifiedListingPage />;
  if (mode === 'AUCTIONS') return <ClassifiedsAuctionsLivePageV2 />;
  return <ClassifiedsSearchPage />;
}
