import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { FeedbackProvider } from "./contexts/FeedbackContext";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { CookieConsent } from "./components/CookieConsent";
import { AnalyticsTracker } from "./components/AnalyticsTracker";
import { ResumeQualificationOrchestrator } from "./components/ResumeQualificationOrchestrator";
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

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-stone-500">
      Carregando...
    </div>
  );
}

function ContextualUtilityLink() {
  const location = useLocation();
  if (location.pathname === "/user/curriculo") {
    return (
      <Link
        to="/user/curriculo/evolucao"
        className="fixed bottom-20 right-4 z-[75] rounded-full border border-violet-200 bg-white/95 px-4 py-2.5 text-xs font-black text-violet-700 shadow-xl backdrop-blur md:bottom-5 md:right-5"
      >
        ✨ Evolução do currículo
      </Link>
    );
  }
  return null;
}

export default function App() {
  const isEmbed = window.location.pathname.startsWith("/embed");

  return (
    <FeedbackProvider>
      <AuthProvider>
        {!isEmbed && <PwaInstallPrompt />}
        {!isEmbed && <CookieConsent />}
        <BrowserRouter>
          <AnalyticsTracker />
          {!isEmbed && <ContextualUtilityLink />}
          {!isEmbed && <ResumeQualificationOrchestrator />}
          {!isEmbed && <PublishedResumeCompanyBridge />}
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/vagas" element={<JobsEntryPage />} />
              <Route path="/vagas-em/:citySlug" element={<CityJobsPage />} />
              <Route path="/vagas/:slug" element={<PublicJobPage />} />
              <Route path="/embed/vagas" element={<EmbedJobsWidget />} />
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
