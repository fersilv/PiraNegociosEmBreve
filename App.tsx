import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { CookieConsent } from "./components/CookieConsent";
import { AnalyticsTracker } from "./components/AnalyticsTracker";

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
const EmbedJobsWidget = lazy(() => import("./pages/EmbedJobsWidget"));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-stone-500">
      Carregando...
    </div>
  );
}

export default function App() {
  const isEmbed = window.location.pathname.startsWith("/embed");

  return (
    <AuthProvider>
      {!isEmbed && <PwaInstallPrompt />}
      {!isEmbed && <CookieConsent />}
      <BrowserRouter>
        <AnalyticsTracker />
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/termos" element={<Terms />} />
            <Route path="/vagas" element={<JobsEntryPage />} />
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
  );
}
