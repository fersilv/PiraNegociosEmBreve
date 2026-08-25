import React, { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { Onboarding } from "./Onboarding";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { AdminWorkspaceLayout } from "../components/AdminWorkspaceLayout";
import { BoostVisibilityBanner } from "../components/BoostVisibilityBanner";
import { ResumeImportEntitlementOrchestrator } from "../components/ResumeImportEntitlementOrchestrator";
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
import { AdminDashboard } from "./AdminDashboard";
import { AdminOverview } from "./AdminOverview";
import { AdminAccountPage } from "./AdminAccountPage";
import { AdminJobDetailsPage } from "./AdminJobDetailsPage";
import { AdminFlaggedJobsPage } from "./AdminFlaggedJobsPage";
import { AdminRegistrationPage } from "./AdminRegistrationPage";
import { AdminPaymentsPage } from "./AdminPaymentsPage";
import { AdminBillingSupportPage } from "./AdminBillingSupportPage";
import { AdminPublicResumeBuilderPage } from "./AdminPublicResumeBuilderPage";
import { AdminJobIntegrationsPage } from "./AdminJobIntegrationsPage";
import { PaymentMethodsPage } from "./PaymentMethodsPage";
import { AiIntegrationsPanel } from "../components/AiIntegrationsPanel";
import { CompanyProfilePage } from "./CompanyProfilePage";
import { CompanyPageBuilder } from "./CompanyPageBuilder";
import { CompanyJobPage } from "./CompanyJobPage";
import { CompanyJobInvitesPage } from "./CompanyJobInvitesPage";
import { CompanyHiringConfig } from "./CompanyHiringConfig";
import { CandidateOnboardingPage } from "./CandidateOnboardingPage";
import { CandidateJobViewPage } from "./CandidateJobViewPage";
import { ResumeWorkspace } from "./ResumeWorkspace";
import { AdminProductFeedbackPage } from "./AdminProductFeedbackPage";
import { AdminWhatsAppPage } from "./AdminWhatsAppPage";

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
      <Route path="criador-publico" element={<AdminPage><AdminPublicResumeBuilderPage /></AdminPage>} />
      <Route path="pagamentos" element={<AdminPage><AdminPaymentsPage /></AdminPage>} />
      <Route path="pagamentos/formas" element={<AdminPage><PaymentMethodsPage /></AdminPage>} />
      <Route path="pagamentos/suporte" element={<AdminPage><AdminBillingSupportPage /></AdminPage>} />
      <Route path="whatsapp" element={<AdminPage><AdminWhatsAppPage /></AdminPage>} />
      <Route path="api" element={<AdminPage><AdminJobIntegrationsPage /></AdminPage>} />
      <Route path="ai" element={<AdminPage><div className="mx-auto max-w-7xl space-y-6 admin-standalone-page admin-ai-page"><AiIntegrationsPanel /></div></AdminPage>} />
      <Route path="notificacoes" element={<AdminPage><NotificationPreferencesPage /></AdminPage>} />
      <Route path="solicitacoes" element={<AdminPage><AdminProductFeedbackPage /></AdminPage>} />
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
      <Route path="classificados" element={<Navigate to="/classificados/painel" replace />} />
      <Route path="classificados/novo" element={<Navigate to="/classificados/publicar" replace />} />
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

function VerifiedCompanyPageRoute({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.get(`/companies/${companyId}`)
      .then((response) => {
        if (!active) return;
        setVerified(response.data?.verificationStatus === "VERIFIED");
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setVerified(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [companyId]);

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center text-stone-500">Verificando acesso à Minha Página...</div>;
  if (!verified) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-7 text-amber-950 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Minha Página</p>
        <h1 className="mt-2 font-serif text-3xl font-black">Disponível após a verificação da empresa</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-900/80">Apenas empresas verificadas podem criar e publicar uma página própria no PiraNegócios. Conclua ou acompanhe a verificação no Perfil da empresa.</p>
        {failed && <p className="mt-3 text-xs font-semibold text-amber-800">Não foi possível confirmar o status da empresa agora.</p>}
        <Link to="/company/perfil" className="mt-5 inline-flex rounded-2xl bg-stone-900 px-4 py-3 text-xs font-black text-white">Ir para o Perfil da empresa</Link>
      </div>
    );
  }
  return <CompanyPageBuilder />;
}

function CompanyRoutes({ companyId }: { companyId?: string }) {
  const hasCompany = Boolean(companyId);
  const companyOnly = (element: React.ReactNode) => hasCompany ? element : <Navigate to="/company/perfil" replace />;
  return (
    <Routes>
      <Route index element={companyOnly(<CompanyHomePage />)} />
      <Route path="vagas" element={companyOnly(<CompanyJobsManagementPage />)} />
      <Route path="vagas/nova" element={companyOnly(<CompanyNewJobPage />)} />
      <Route path="vagas/convites" element={companyOnly(<CompanyJobInvitesPage />)} />
      <Route path="vagas/:jobId" element={companyOnly(<CompanyJobPage />)} />
      <Route path="talentos" element={companyOnly(<TalentSearchPage />)} />
      <Route path="contratacao" element={companyOnly(<CompanyHiringConfig />)} />
      <Route path="pagina" element={companyOnly(companyId ? <VerifiedCompanyPageRoute companyId={companyId} /> : null)} />
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
    ["/dashboard/admin/whatsapp", "/admin/whatsapp"],
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
    const target = profile?.type === "ADMIN" ? path.replace("/dashboard/vaga/", "/admin/vagas/") : path.replace("/dashboard/vaga/", "/company/vagas/");
    return <Navigate to={target} replace />;
  }
  if (path === "/dashboard/curriculos") return <Navigate to="/company/talentos" replace />;
  if (path === "/dashboard/configuracao-contratacao") return <Navigate to="/company/contratacao" replace />;
  if (path === "/dashboard/empresa/pagina") return <Navigate to="/company/pagina" replace />;
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
  if (isCompanyRoute) return <WorkspaceLayout workspace="company"><CompanyRoutes companyId={profile?.companyId} /></WorkspaceLayout>;
  if (isResumeStudioRoute) return <><ResumeImportEntitlementOrchestrator /><ResumeWorkspace /></>;
  if (isUserRoute) return <WorkspaceLayout workspace="user"><ResumeImportEntitlementOrchestrator /><BoostVisibilityBanner /><UserRoutes /></WorkspaceLayout>;
  return <Navigate to={profile?.companyId ? "/company" : "/user"} replace />;
}
