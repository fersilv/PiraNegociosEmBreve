import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { FeedbackProvider } from "./contexts/FeedbackContext";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { CookieConsent } from "./components/CookieConsent";
import { AnalyticsTracker } from "./components/AnalyticsTracker";
import { ResumeQualificationWidget } from "./components/ResumeQualificationWidget";
import { PublishedResumeCompanyBridge } from "./components/PublishedResumeCompanyBridge";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() =>
  import("./pages/Login").then((module) => ({ default: module.Login })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const Terms = lazy(() => import("./pages/Terms"));
const JobsEntryPage = lazy(() => import("./pages/JobsEntryPage"));
const PublicJobPage = lazy(() => import("./pages/PublicJobPage"));
const PublicCompanyPage = lazy(() => import("./pages/PublicCompanyPage"));
const CityJobsPage = lazy(() => import("./pages/CityJobsPage"));
const EmbedJobsWidget = lazy(() => import("./pages/EmbedJobsWidget"));
const MobileUploadPage = lazy(() => import("./pages/MobileUploadPage"));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-stone-500">
      Carregando...
    </div>
  );
}

export default function App() {
  const isEmbed = window.location.pathname.startsWith("/embed");
  const isMobileTransfer = window.location.pathname.startsWith("/transferir/");
  const isMinimalShell = isEmbed || isMobileTransfer;

  return (
    <FeedbackProvider>
      <AuthProvider>
        {!isMinimalShell && <PwaInstallPrompt />}
        {!isMinimalShell && <CookieConsent />}
        <BrowserRouter>
          {!isMobileTransfer && <AnalyticsTracker />}
          {!isMinimalShell && <ResumeQualificationWidget />}
          {!isMinimalShell && <PublishedResumeCompanyBridge />}
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/vagas" element={<JobsEntryPage />} />
              <Route path="/vagas-em/:citySlug" element={<CityJobsPage />} />
              <Route path="/vagas/:slug" element={<PublicJobPage />} />
              <Route path="/embed/vagas" element={<EmbedJobsWidget />} />
              <Route path="/transferir/:sessionId" element={<MobileUploadPage />} />
              <Route path="/login" element={<Login />} />

              <Route path="/user/*" element={<Dashboard />} />
              <Route path="/company/*" element={<Dashboard />} />
              <Route path="/admin/*" element={<Dashboard />} />

              {/* Compatibilidade: links antigos continuam funcionando e são
                  redirecionados internamente para os workspaces canônicos. */}
              <Route path="/dashboard/*" element={<Dashboard />} />

              <Route path="/:companySlug" element={<PublicCompanyPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </FeedbackProvider>
  );
}
