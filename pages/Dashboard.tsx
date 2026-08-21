import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Onboarding } from "./Onboarding";
import { DashboardLayout } from "../components/DashboardLayout";
import { AdminLayout } from "../components/AdminLayout";
import { CompanyDashboard } from "./CompanyDashboard";
import { CompanyHomePage } from "./CompanyHomePage";
import { CandidateDashboard } from "./CandidateDashboard";
import { AdminDashboard, ApiV1Panel } from "./AdminDashboard";
import { AdminOverview } from "./AdminOverview";
import { AdminAccountPage } from "./AdminAccountPage";
import { AiIntegrationsPanel } from "../components/AiIntegrationsPanel";
import { ResumeDatabase } from "./ResumeDatabase";
import { ProfilePage } from "./ProfilePage";
import { CompanyProfilePage } from "./CompanyProfilePage";
import { CompanyJobPage } from "./CompanyJobPage";
import { CompanyHiringConfig } from "./CompanyHiringConfig";
import { CandidateOnboardingPage } from "./CandidateOnboardingPage";
import { CandidateJobViewPage } from "./CandidateJobViewPage";
import { ResumeBuilderPage } from "./ResumeBuilderPage";

function ProfilePageWithoutLegacyResumeAi() {
  return (
    <div className="profile-legacy-ai-hidden">
      <style>{`
        .profile-legacy-ai-hidden div.bg-gradient-to-br.from-stone-900.to-stone-950.text-white.rounded-3xl {
          display: none !important;
        }
      `}</style>
      <ProfilePage />
    </div>
  );
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return <div className="admin-page-shell">{children}</div>;
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="onboarding" element={<Onboarding />} />
      <Route
        index
        element={
          <AdminPage>
            <AdminOverview />
          </AdminPage>
        }
      />
      <Route
        path="admin"
        element={<Navigate to="/dashboard/admin/empresas" replace />}
      />
      <Route
        path="admin/empresas"
        element={
          <AdminPage>
            <AdminDashboard mode="moderation" section="companies" />
          </AdminPage>
        }
      />
      <Route
        path="admin/vagas"
        element={
          <AdminPage>
            <AdminDashboard mode="moderation" section="jobs" />
          </AdminPage>
        }
      />
      <Route
        path="admin/usuarios"
        element={
          <AdminPage>
            <AdminDashboard mode="moderation" section="users" />
          </AdminPage>
        }
      />
      <Route
        path="admin/vinculos"
        element={
          <AdminPage>
            <AdminDashboard mode="moderation" section="access" />
          </AdminPage>
        }
      />
      <Route
        path="admin/publicidade"
        element={
          <AdminPage>
            <AdminDashboard mode="moderation" section="advertising" />
          </AdminPage>
        }
      />
      <Route
        path="admin/api"
        element={
          <AdminPage>
            <div className="mx-auto max-w-7xl space-y-6 admin-standalone-page">
              <header>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
                  Infraestrutura · Integrações
                </p>
                <h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">
                  API v1
                </h1>
                <p className="mt-1 max-w-3xl text-stone-500">
                  Gerencie chaves, origens, auditoria e a documentação da API
                  de vagas.
                </p>
              </header>
              <section className="rounded-2xl border border-stone-200 bg-white shadow-sm admin-primary-surface">
                <ApiV1Panel />
              </section>
            </div>
          </AdminPage>
        }
      />
      <Route
        path="admin/ai"
        element={
          <AdminPage>
            <div className="mx-auto max-w-7xl space-y-6 admin-standalone-page admin-ai-page">
              <AiIntegrationsPanel />
            </div>
          </AdminPage>
        }
      />
      <Route
        path="perfil"
        element={
          <AdminPage>
            <AdminAccountPage />
          </AdminPage>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

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

  if (profile && !profile.phone && !location.pathname.includes("/onboarding")) {
    return <Navigate to="/dashboard/onboarding" replace />;
  }

  if (location.pathname.includes("/curriculo/gerador")) {
    if (profile?.type === "ADMIN") return <Navigate to="/dashboard" replace />;
    return <ResumeBuilderPage />;
  }

  if (profile?.type === "ADMIN") {
    return (
      <AdminLayout>
        <AdminRoutes />
      </AdminLayout>
    );
  }

  const companyOnly = (element: React.ReactNode) =>
    profile?.companyId ? element : <Navigate to="/dashboard/empresa" replace />;

  return (
    <DashboardLayout>
      <Routes>
        <Route path="onboarding" element={<Onboarding />} />
        <Route
          index
          element={
            profile?.companyId ? (
              <Navigate to="empresa/inicio" replace />
            ) : (
              <Navigate to="pessoal" replace />
            )
          }
        />

        <Route path="pessoal" element={<CandidateDashboard />} />
        <Route
          path="empresa/inicio"
          element={companyOnly(<CompanyHomePage />)}
        />
        <Route path="empresa/painel" element={<CompanyDashboard />} />
        <Route path="vaga/:jobId" element={companyOnly(<CompanyJobPage />)} />

        <Route path="admin/*" element={<Navigate to="/dashboard" replace />} />
        <Route path="curriculos" element={companyOnly(<ResumeDatabase />)} />
        <Route path="perfil" element={<ProfilePageWithoutLegacyResumeAi />} />
        <Route path="empresa" element={<CompanyProfilePage />} />
        <Route
          path="configuracao-contratacao"
          element={companyOnly(<CompanyHiringConfig />)}
        />
        <Route path="admissao/:appId" element={<CandidateOnboardingPage />} />
        <Route path="vaga-detalhes/:jobId" element={<CandidateJobViewPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}