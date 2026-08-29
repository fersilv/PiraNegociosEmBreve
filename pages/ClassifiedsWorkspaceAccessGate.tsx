import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { RegionalLoader } from "../components/RegionalLoader";
import ClassifiedsWorkspacePage from "./ClassifiedsWorkspacePage";

export default function ClassifiedsWorkspaceAccessGate() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RegionalLoader context="auth" className="min-h-screen" />;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const linkedToCompany = Boolean(profile?.companyId);
  const marketplaceAllowed = Boolean(
    !linkedToCompany
    || profile?.type === "ADMIN"
    || profile?.isCompanyAdmin
    || profile?.companyAccess?.permissions?.marketplace,
  );

  if (!marketplaceAllowed) {
    return (
      <div className="min-h-screen bg-stone-50 px-5 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-stone-400">Acesso da empresa</p>
          <h1 className="mt-2 font-serif text-3xl font-black text-stone-950">Classificados desabilitados para este vínculo</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">Você aparece vinculado(a) à empresa, mas não recebeu autorização para administrar os Classificados. Peça a um administrador da empresa para liberar essa permissão.</p>
          <a href="/user" className="mt-6 inline-flex rounded-xl bg-stone-950 px-5 py-3 text-sm font-black text-white">Voltar para minha conta</a>
        </div>
      </div>
    );
  }

  return <ClassifiedsWorkspacePage />;
}
