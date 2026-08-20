import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Onboarding } from "./Onboarding";
import { DashboardLayout } from "../components/DashboardLayout";
import { CompanyDashboard } from "./CompanyDashboard";
import { CandidateDashboard } from "./CandidateDashboard";
import { AdminDashboard, ApiV1Panel } from "./AdminDashboard";
import { AiIntegrationsPanel } from "../components/AiIntegrationsPanel";
import { ResumeDatabase } from "./ResumeDatabase";
import { ProfilePage } from "./ProfilePage";
import { CompanyProfilePage } from "./CompanyProfilePage";
import { CompanyJobPage } from "./CompanyJobPage";
import { CompanyHiringConfig } from "./CompanyHiringConfig";
import { CandidateOnboardingPage } from "./CandidateOnboardingPage";
import { CandidateJobViewPage } from "./CandidateJobViewPage";
import { ResumeBuilderPage } from "./ResumeBuilderPage";

export function Dashboard() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  // If user hasn't filled phone yet, force onboarding
  if (profile && !profile.phone && !location.pathname.includes("/onboarding")) {
    return <Navigate to="/dashboard/onboarding" replace />;
  }

  // Full-screen pages that should NOT have the dashboard layout
  if (location.pathname.includes("/curriculo/gerador")) {
    if (profile?.type !== "CANDIDATE") return <Navigate to="/dashboard" replace />;
    return <ResumeBuilderPage />;
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="onboarding" element={<Onboarding />} />

        <Route
          path="/"
          element={
            profile?.type === "ADMIN" ? (
              <AdminDashboard mode="dashboard" />
            ) : (
              <CandidateDashboard />
            )
          }
        />

        <Route
          path="empresa/painel"
          element={<CompanyDashboard />}
        />

        <Route
          path="vaga/:jobId"
          element={<CompanyJobPage />}
        />

        <Route
          path="admin"
          element={
            profile?.type === "ADMIN" ? (
              <Navigate to="/dashboard/admin/empresas" replace />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />

        <Route
          path="admin/empresas"
          element={
            profile?.type === "ADMIN" ? (
              <AdminDashboard mode="moderation" section="companies" />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route
          path="admin/vagas"
          element={
            profile?.type === "ADMIN" ? (
              <AdminDashboard mode="moderation" section="jobs" />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route
          path="admin/usuarios"
          element={
            profile?.type === "ADMIN" ? (
              <AdminDashboard mode="moderation" section="users" />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route
          path="admin/vinculos"
          element={
            profile?.type === "ADMIN" ? (
              <AdminDashboard mode="moderation" section="access" />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route
          path="admin/publicidade"
          element={
            profile?.type === "ADMIN" ? (
              <AdminDashboard mode="moderation" section="advertising" />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route
          path="admin/api"
          element={
            profile?.type === "ADMIN" ? (
              <div className="mx-auto max-w-7xl space-y-6">
                <header>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
                    Integrações da plataforma
                  </p>
                  <h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">
                    API v1
                  </h1>
                  <p className="mt-1 text-stone-500">
                    Gerencie chaves, origens, auditoria e a documentação da API
                    de vagas.
                  </p>
                </header>
                <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <ApiV1Panel />
                </section>
              </div>
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />

        <Route
          path="admin/ai"
          element={
            profile?.type === "ADMIN" ? (
              <div className="mx-auto max-w-7xl space-y-6">
                <AiIntegrationsPanel />
              </div>
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />

        <Route
          path="curriculos"
          element={<ResumeDatabase />}
        />

        <Route path="perfil" element={<ProfilePage />} />
        <Route
          path="empresa"
          element={<CompanyProfilePage />}
        />
        <Route
          path="configuracao-contratacao"
          element={<CompanyHiringConfig />}
        />
        <Route path="admissao/:appId" element={<CandidateOnboardingPage />} />
        <Route path="vaga-detalhes/:jobId" element={<CandidateJobViewPage />} />
      </Routes>
    </DashboardLayout>
  );
}
