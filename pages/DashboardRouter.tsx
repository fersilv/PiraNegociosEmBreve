import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Onboarding } from "./Onboarding";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { AdminWorkspaceLayout } from "../components/AdminWorkspaceLayout";
import { CompanyJobsManagementPage } from "./CompanyJobsManagementPage";
import { CompanyHomePage } from "./CompanyHomePage";
import { CompanyNewJobPage } from "./CompanyNewJobPage";
import { TalentSearchPage } from "./TalentSearchPage";
import { CandidateDashboard } from "./CandidateDashboard";
import { UserJobsPage } from "./UserJobsPage";
import { UserPreferencesPage } from "./UserPreferencesPage";
import { UserProfessionalProfilePage } from "./UserProfessionalProfilePage";
import { UserAccountSettingsPage } from "./UserAccountSettingsPage";
import { UserPaymentsPage } from "./UserPaymentsPage";
import { ResumeEvolutionPage } from "./ResumeEvolutionPage";
import { NotificationPreferencesPage } from "./NotificationPreferencesPage";
import { AdminDashboard, ApiV1Panel } from "./AdminDashboard";
import { AdminOverview } from "./AdminOverview";
import { AdminAccountPage } from "./AdminAccountPage";
import { AdminJobDetailsPage } from "./AdminJobDetailsPage";
import { AdminFlaggedJobsPage } from "./AdminFlaggedJobsPage";
import { AdminRegistrationPage } from "./AdminRegistrationPage";
import { AdminPaymentsPage } from "./AdminPaymentsPage";
import { AiIntegrationsPanel } from "../components/AiIntegrationsPanel";
import { CompanyProfilePage } from "./CompanyProfilePage";
import { CompanyJobPage } from "./CompanyJobPage";
import { CompanyHiringConfig } from "./CompanyHiringConfig";
import { CandidateOnboardingPage } from "./CandidateOnboardingPage";
import { CandidateJobViewPage } from "./CandidateJobViewPage";
import { ResumeWorkspace } from "./ResumeWorkspace";

function AdminPage({ children }: { children: React.ReactNode }) {
  return <div className="admin-page-shell">{children}</div>;
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="onboarding" element={<Onboarding />} />
      <Route index element={<AdminPage><AdminOverview /></AdminPage>} />
      <Route path="empresas" element={<AdminPage><AdminDashboard mode="moderation" section="companies" /></AdminPage>} />
      <Route path="vagas" element={<AdminPage><AdminDashboard mode="moderation" section="jobs" /></AdminPage>} />
      <Route path="vagas/sinalizadas" element={<AdminPage><AdminFlaggedJobsPage /></AdminPage>} />
      <Route path="vagas/:jobId" element={<AdminPage><AdminJobDetailsPage /></AdminPage>} />
      <Route path="usuarios" element={<AdminPage><AdminDashboard mode="moderation" section="users" /></AdminPage>} />
      <Route path="vinculos" element={<AdminPage><AdminDashboard mode="moderation" section="access" /></AdminPage>} />
      <Route path="cadastros" element={<AdminPage><AdminRegistrationPage /></AdminPage>} />
      <Route path="publicidade" element={<AdminPage><AdminDashboard mode="moderation" section="advertising" /></AdminPage>} />
      <Route path="pagamentos" element={<AdminPage><AdminPaymentsPage /></AdminPage>} />
      <Route path="api" element={<AdminPage><div className="mx-auto max-w-7xl space-y-6 admin-standalone-page"><header><p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Infraestrutura · Integrações</p><h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">API v1</h1><p className="mt-1 max-w-3xl text-stone-500">Gerencie chaves, origens, auditoria e a documentação da API de vagas.</p></header><section className="rounded-2xl border border-stone-200 bg-white shadow-sm admin-primary-surface"><ApiV1Panel /></section></div></AdminPage>} />
      <Route path="ai" element={<AdminPage><div className="mx-auto max-w-7xl space-y-6 admin-standalone-page admin-ai-page"><AiIntegrationsPanel /></div></AdminPage>} />
      <Route path="notificacoes" element={<AdminPage><NotificationPreferencesPage /></AdminPage>} />
      <Route path="conta" element={<AdminPage><AdminAccountPage /></AdminPage>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

function UserRoutes() {
  return (
    <Routes>
      <Route path="onboarding" element={<Onboarding />} />
      <Route index element={<CandidateDashboard />} />
      <Route path="vagas" element={<UserJobsPage />} />
      <Route path="curriculo" element={<ResumeWorkspace />} />
      <Route path="curriculo/evolucao" element={<ResumeEvolutionPage />} />
      <Route path="pagamentos" element={<UserPaymentsPage />} />
      <Route path="preferencias" element={<UserPreferencesPage />} />
      <Route path="notificacoes" element={<NotificationPreferencesPage />} />
      <Route path="perfil" element={<UserProfessionalProfilePage />} />
      <Route path="configuracoes" element={<UserAccountSettingsPage />} />
      <Route path="admissao/:appId" element={<CandidateOnboardingPage />} />
      <Route path="vaga/:jobId" element={<CandidateJobViewPage />} />
      <Route path="*" element={<Navigate to="/user" replace />} />
    </Routes>
  );
}

function CompanyRoutes({ hasCompany }: { hasCompany: boolean }) {
  const companyOnly = (element: React.ReactNode) => hasCompany ? element : <Navigate to="/company/perfil" replace />;
  return (
    <Routes>
      <Route index element={companyOnly(<CompanyHomePage />)} />
      <Route path="vagas" element={companyOnly(<CompanyJobsManagementPage />)} />
      <Route path="vagas/nova" element={companyOnly(<CompanyNewJobPage />)} />
      <Route path="vagas/:jobId" element={companyOnly(<CompanyJobPage />)} />
      <Route path="talentos" element={companyOnly(<TalentSearchPage />)} />
      <Route path="contratacao" element={companyOnly(<CompanyHiringConfig />)} />
      <Route path="notificacoes" element={companyOnly(<NotificationPreferencesPage />)} />
      <Route path="perfil" element={<CompanyProfilePage />} />
      <Route path="*" element={<Navigate to={hasCompany ? "/company" : "/company/perfil"} replace />} />
    </Routes>
  );
}

function LegacyDashboardRedirect() {
  const { profile } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const adminMap: Array<[string, string]> = [
    ["/dashboard/admin/empresas", "/admin/empresas"],
    ["/dashboard/admin/vagas", "/admin/vagas"],
    ["/dashboard/admin/usuarios", "/admin/usuarios"],
    ["/dashboard/admin/vinculos", "/admin/vinculos"],
    ["/dashboard/admin/cadastros", "/admin/cadastros"],
    ["/dashboard/admin/publicidade", "/admin/publicidade"],
    ["/dashboard/admin/pagamentos", "/admin/pagamentos"],
    ["/dashboard/admin/api", "/admin/api"],
    ["/dashboard/admin/ai", "/admin/ai"],
  ];
  for (const [legacy, canonical] of adminMap) {
    if (path === legacy || path.startsWith(`${legacy}/`)) return <Navigate to={`${canonical}${path.slice(legacy.length)}${location.search}`} replace />;
  }
  if (path === "/dashboard/perfil") return <Navigate to={profile?.type === "ADMIN" ? "/admin/conta" : "/user/perfil"} replace />;
  if (path === "/dashboard/configuracoes") return <Navigate to="/user/configuracoes" replace />;
  if (path === "/dashboard/preferencias") return <Navigate to="/user/preferencias" replace />;
  if (path === "/dashboard/pessoal") return <Navigate to="/user" replace />;
  if (path === "/dashboard/curriculo/gerador") return <Navigate to="/user/curriculo" replace />;
  if (path.startsWith("/dashboard/admissao/")) return <Navigate to={path.replace("/dashboard/admissao/", "/user/admissao/")} replace />;
  if (path.startsWith("/dashboard/vaga-detalhes/")) return <Navigate to={path.replace("/dashboard/vaga-detalhes/", "/user/vaga/")} replace />;
  if (path === "/dashboard/empresa/inicio") return <Navigate to="/company" replace />;
  if (path === "/dashboard/empresa/painel") return <Navigate to="/company/vagas" replace />;
  if (path.startsWith("/dashboard/vaga/")) {
    const target = profile?.type === "ADMIN"
      ? path.replace("/dashboard/vaga/", "/admin/vagas/")
      : path.replace("/dashboard/vaga/", "/company/vagas/");
    return <Navigate to={target} replace />;
  }
  if (path === "/dashboard/curriculos") return <Navigate to="/company/talentos" replace />;
  if (path === "/dashboard/configuracao-contratacao") return <Navigate to="/company/contratacao" replace />;
  if (path === "/dashboard/empresa") return <Navigate to="/company/perfil" replace />;
  if (path === "/dashboard/onboarding") return <Navigate to={profile?.type === "ADMIN" ? "/admin/onboarding" : "/user/onboarding"} replace />;
  if (profile?.type === "ADMIN") return <Navigate to="/admin" replace />;
  if (profile?.companyId) return <Navigate to="/company" replace />;
  return <Navigate to="/user" replace />;
}

export function Dashboard() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (location.pathname.startsWith("/dashboard")) return <LegacyDashboardRedirect />;

  const isAdminRoute = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const isCompanyRoute = location.pathname === "/company" || location.pathname.startsWith("/company/");
  const isUserRoute = location.pathname === "/user" || location.pathname.startsWith("/user/");
  const isResumeStudioRoute = location.pathname === "/user/curriculo";

  if (profile && !profile.phone && !location.pathname.includes("/onboarding")) return <Navigate to={profile.type === "ADMIN" ? "/admin/onboarding" : "/user/onboarding"} replace />;
  if (profile?.type === "ADMIN") {
    if (!isAdminRoute) return <Navigate to="/admin" replace />;
    return <AdminWorkspaceLayout><AdminRoutes /></AdminWorkspaceLayout>;
  }
  if (isAdminRoute) return <Navigate to={profile?.companyId ? "/company" : "/user"} replace />;
  if (isCompanyRoute) return <WorkspaceLayout workspace="company"><CompanyRoutes hasCompany={Boolean(profile?.companyId)} /></WorkspaceLayout>;
  if (isResumeStudioRoute) return <ResumeWorkspace />;
  if (isUserRoute) return <WorkspaceLayout workspace="user"><UserRoutes /></WorkspaceLayout>;
  return <Navigate to={profile?.companyId ? "/company" : "/user"} replace />;
}