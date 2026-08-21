import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Onboarding } from "./Onboarding";
import { DashboardLayout } from "../components/DashboardLayout";
import { CompanyDashboard } from "./CompanyDashboard";
import { CompanyHomePage } from "./CompanyHomePage";
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

  const companyOnly = (element: React.ReactNode) =>
    profile?.companyId ? element : <Navigate to="/dashboard/empresa" replace />;

  const adminOnly = (element: React.ReactNode) =>
    profile?.type === "ADMIN" ? <AdminPage>{element}</AdminPage> : <Navigate to="/dashboard" />;

  return (
    <DashboardLayout>
      <Routes>
        <Route path="onboarding" element={<Onboarding />} />

        <Route
          index
          element={
            profile?.type === "ADMIN" ? (
              <AdminPage><AdminDashboard mode="dashboard" /></AdminPage>
            ) : profile?.companyId ? (
              <Navigate to="empresa/inicio" replace />
            ) : (
              <Navigate to="pessoal" replace />
            )
          }
        />

        <Route path="pessoal" element={<CandidateDashboard />} />
        <Route path="empresa/inicio" element={companyOnly(<CompanyHomePage />)} />
        <Route path="empresa/painel" element={<CompanyDashboard />} />
        <Route path="vaga/:jobId" element={companyOnly(<CompanyJobPage />)} />

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

        <Route path="admin/empresas" element={adminOnly(<AdminDashboard mode="moderation" section="companies" />)} />
        <Route path="admin/vagas" element={adminOnly(<AdminDashboard mode="moderation" section="jobs" />)} />
        <Route path="admin/usuarios" element={adminOnly(<AdminDashboard mode="moderation" section="users" />)} />
        <Route path="admin/vinculos" element={adminOnly(<AdminDashboard mode="moderation" section="access" />)} />
        <Route path="admin/publicidade" element={adminOnly(<AdminDashboard mode="moderation" section="advertising" />)} />

        <Route
          path="admin/api"
          element={adminOnly(
            <div className="mx-auto max-w-7xl space-y-6 admin-standalone-page">
              <header>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
                  Infraestrutura · Integrações
                </p>
                <h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">API v1</h1>
                <p className="mt-1 max-w-3xl text-stone-500">
                  Gerencie chaves, origens, auditoria e a documentação da API de vagas.
                </p>
              </header>
              <section className="rounded-2xl border border-stone-200 bg-white shadow-sm admin-primary-surface">
                <ApiV1Panel />
              </section>
            </div>,
          )}
        />

        <Route
          path="admin/ai"
          element={adminOnly(
            <div className="mx-auto max-w-7xl space-y-6 admin-standalone-page admin-ai-page">
              <AiIntegrationsPanel />
            </div>,
          )}
        />

        <Route path="curriculos" element={companyOnly(<ResumeDatabase />)} />
        <Route path="perfil" element={<ProfilePageWithoutLegacyResumeAi />} />
        <Route path="empresa" element={<CompanyProfilePage />} />
        <Route path="configuracao-contratacao" element={companyOnly(<CompanyHiringConfig />)} />
        <Route path="admissao/:appId" element={<CandidateOnboardingPage />} />
        <Route path="vaga-detalhes/:jobId" element={<CandidateJobViewPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
