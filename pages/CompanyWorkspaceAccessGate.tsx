import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type CompanyPermissionKey } from "../contexts/AuthContext";
import { RegionalLoader } from "../components/RegionalLoader";
import { CompanyEmployeeRemovalPanel } from "../components/CompanyEmployeeRemovalPanel";
import { Dashboard } from "./Dashboard";

function requiredPermission(pathname: string): CompanyPermissionKey | null {
  if (pathname.startsWith("/company/talentos") || pathname.startsWith("/company/contratacao")) return "recruitment";
  if (pathname.startsWith("/company/financeiro") || pathname.startsWith("/company/planos")) return "finance";
  if (pathname.startsWith("/company/equipe")) return "team";
  if (
    pathname.startsWith("/company/pagina")
    || pathname.startsWith("/company/comercial")
    || pathname.startsWith("/company/perfil")
    || pathname.startsWith("/company/configuracoes")
    || pathname.startsWith("/company/verificacao")
  ) return "companyProfile";
  return null;
}

export default function CompanyWorkspaceAccessGate() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RegionalLoader context="auth" className="min-h-screen" />;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const elevated = profile?.type === "ADMIN" || profile?.isCompanyAdmin === true;
  const companyAccess = profile?.companyAccess;
  const canEnterBusiness = Boolean(profile?.companyId && (elevated || companyAccess?.hasAnyPermission));
  if (!canEnterBusiness) return <Navigate to="/user" replace />;

  const permission = requiredPermission(location.pathname);
  if (permission && !elevated && companyAccess?.permissions?.[permission] !== true) {
    return <Navigate to="/company" replace />;
  }

  const showTeamRemoval = location.pathname === "/company/equipe";
  return (
    <>
      <Dashboard />
      {showTeamRemoval && (
        <div className="bg-[#f3f2ee] px-4 pb-10 md:pl-[320px] md:pr-8">
          <CompanyEmployeeRemovalPanel />
        </div>
      )}
    </>
  );
}
