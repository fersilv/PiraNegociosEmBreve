import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { AdminWorkspaceLayout } from "../components/AdminWorkspaceLayout";
import { ResumeImportEntitlementOrchestrator } from "../components/ResumeImportEntitlementOrchestrator";
import { BoostVisibilityBanner } from "../components/BoostVisibilityBanner";
import { RegionalLoader } from "../components/RegionalLoader";
import { UserJobsPage } from "./UserJobsPage";
import { CompanyJobsManagementPage } from "./CompanyJobsManagementPage";
import { AdminDashboard } from "./AdminDashboard";

type WorkspaceJobsRouteProps = {
  workspace: "user" | "company" | "admin";
};

export default function WorkspaceJobsRoute({ workspace }: WorkspaceJobsRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RegionalLoader context="auth" className="min-h-screen" />;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const isAdmin = profile?.type === "ADMIN";
  if (profile && !profile.phone && !location.pathname.includes("/onboarding")) {
    return <Navigate to={isAdmin ? "/admin/onboarding" : "/user/onboarding"} replace />;
  }

  if (workspace === "admin") {
    if (!isAdmin) return <Navigate to={profile?.companyId ? "/company" : "/user"} replace />;
    return (
      <AdminWorkspaceLayout>
        <div className="admin-page-shell">
          <AdminDashboard mode="moderation" section="jobs" />
        </div>
      </AdminWorkspaceLayout>
    );
  }

  if (workspace === "company") {
    const canRecruit = Boolean(
      isAdmin
      || profile?.isCompanyAdmin
      || profile?.companyAccess?.permissions?.recruitment,
    );
    if (!profile?.companyId || !canRecruit) return <Navigate to="/user" replace />;
    return (
      <WorkspaceLayout workspace="company">
        <CompanyJobsManagementPage />
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout workspace="user">
      <ResumeImportEntitlementOrchestrator />
      <BoostVisibilityBanner />
      <UserJobsPage />
    </WorkspaceLayout>
  );
}
