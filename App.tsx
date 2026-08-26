import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { FeedbackProvider } from "./contexts/FeedbackContext";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { CookieConsent } from "./components/CookieConsent";
import { AnalyticsTracker } from "./components/AnalyticsTracker";
import { PublishedResumeCompanyBridge } from "./components/PublishedResumeCompanyBridge";
import { PublicResumeAccountBridge } from "./components/PublicResumeAccountBridge";
import { PublicResumeExitIntent } from "./components/PublicResumeExitIntent";
import { PublicResumeResponsiveStyles } from "./components/PublicResumeResponsiveStyles";
import { AuthenticatedProductFeedbackWidget } from "./components/AuthenticatedProductFeedbackWidget";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Terms = lazy(() => import("./pages/Terms"));
const JobsEntryPage = lazy(() => import("./pages/JobsEntryPage"));
const PublicJobPage = lazy(() => import("./pages/PublicJobPage"));
const PublicCompanyPage = lazy(() => import("./pages/PublicCompanyPage"));
const CompanyPagePreviewPage = lazy(() => import("./pages/CompanyPagePreviewPage"));
const CityJobsPage = lazy(() => import("./pages/CityJobsPage"));
const EmbedJobsWidget = lazy(() => import("./pages/EmbedJobsWidget"));
const MobileUploadPage = lazy(() => import("./pages/MobileUploadPage"));
const PublicResumeBuilderPage = lazy(() => import("./pages/PublicResumeBuilderPage"));
const TalentInvitePage = lazy(() => import("./pages/TalentInvitePage"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const ClassifiedsEntryPage = lazy(() => import("./pages/ClassifiedsEntryPage"));
const ClassifiedsTermsPage = lazy(() => import("./pages/ClassifiedsTermsPage"));
const ClassifiedsWorkspacePage = lazy(() => import("./pages/ClassifiedsWorkspacePage"));
const ClassifiedsPublicRouteGate = lazy(() => import("./pages/ClassifiedsPublicRouteGate"));
const CompanyLegalPage = lazy(() => import("./pages/CompanyLegalPage").then((module) => ({ default: module.CompanyLegalPage })));
const ResumeQualificationWidget = lazy(() => import("./components/ResumeQualificationWidget").then((module) => ({ default: module.ResumeQualificationWidget })));

function RouteLoader() {
  return <div className="min-h-screen flex items-center justify-center text-stone-500">Carregando...</div>;
}

export default function App() {
  const pathname = window.location.pathname;
  const isEmbed = pathname.startsWith("/embed");
  const isMobileTransfer = pathname.startsWith("/transferir/");
  const isCompanyPreview = pathname.startsWith("/preview/empresa/");
  const isTalentInvite = pathname.startsWith("/convites/vaga/");
  const isResumeWorkspace = pathname === "/user/curriculo";
  const isMinimalShell = isEmbed || isMobileTransfer || isCompanyPreview || isTalentInvite;

  return (
    <FeedbackProvider>
      <AuthProvider>
        {!isMinimalShell && <PwaInstallPrompt />}
        {!isMinimalShell && <CookieConsent />}
        <PublicResumeAccountBridge />
        <BrowserRouter>
          {!isMobileTransfer && !isCompanyPreview && !isTalentInvite && <AnalyticsTracker />}
          <PublicResumeResponsiveStyles />
          <PublicResumeExitIntent />
          {!isMinimalShell && isResumeWorkspace && <Suspense fallback={null}><ResumeQualificationWidget /></Suspense>}
          {!isMinimalShell && <PublishedResumeCompanyBridge />}
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/ajuda" element={<HelpCenterPage />} />
              <Route path="/ajuda/:slug" element={<HelpCenterPage />} />
              <Route path="/vagas" element={<JobsEntryPage />} />
              <Route path="/vagas-em/:citySlug" element={<CityJobsPage />} />
              <Route path="/vagas/:slug" element={<PublicJobPage />} />

              <Route path="/classificados" element={<ClassifiedsEntryPage />} />
              <Route path="/classificados/termos" element={<ClassifiedsTermsPage />} />
              <Route path="/classificados/busca" element={<ClassifiedsPublicRouteGate mode="SEARCH" />} />
              <Route path="/classificados/categoria/:categorySlug" element={<ClassifiedsPublicRouteGate mode="SEARCH" />} />
              <Route path="/classificados/anuncio/:slug" element={<ClassifiedsPublicRouteGate mode="LISTING" />} />
              <Route path="/classificados/leiloes" element={<ClassifiedsPublicRouteGate mode="AUCTIONS" />} />
              <Route path="/classificados/leiloes/:auctionId" element={<ClassifiedsPublicRouteGate mode="AUCTIONS" />} />
              <Route path="/classificados/painel" element={<Navigate to="/classificados/explorar" replace />} />
              <Route path="/classificados/explorar" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/explorar/:listingSlug" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/gestao/leiloes" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/gestao/leiloes/:auctionId" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/gestao/leiloes/:auctionId/ao-vivo" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/anuncios" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/servicos" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/ofertas" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/vendas" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/vendas/mercado-pago" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/comercial/:listingId" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/analytics" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/publicar" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/conversas" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/conversas/:conversationId" element={<ClassifiedsWorkspacePage />} />
              <Route path="/classificados/configuracoes" element={<ClassifiedsWorkspacePage />} />

              <Route path="/criador-de-curriculo" element={<PublicResumeBuilderPage />} />
              <Route path="/criar-curriculo" element={<Navigate to="/criador-de-curriculo" replace />} />
              <Route path="/curriculo-online" element={<Navigate to="/criador-de-curriculo" replace />} />
              <Route path="/embed/vagas" element={<EmbedJobsWidget />} />
              <Route path="/transferir/:sessionId" element={<MobileUploadPage />} />
              <Route path="/preview/empresa/:token" element={<CompanyPagePreviewPage />} />
              <Route path="/convites/vaga/:token" element={<TalentInvitePage />} />
              <Route path="/login" element={<Login />} />

              <Route path="/user/*" element={<Dashboard />} />
              <Route path="/company/*" element={<Dashboard />} />
              <Route path="/admin/*" element={<Dashboard />} />
              <Route path="/dashboard/*" element={<Dashboard />} />

              <Route path="/:companySlug/termos" element={<CompanyLegalPage type="terms" />} />
              <Route path="/:companySlug/privacidade" element={<CompanyLegalPage type="privacy" />} />
              <Route path="/:companySlug" element={<PublicCompanyPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
          {!isMinimalShell && <AuthenticatedProductFeedbackWidget />}
        </BrowserRouter>
      </AuthProvider>
    </FeedbackProvider>
  );
}
