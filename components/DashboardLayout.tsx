import React, { useState } from "react";
import {
  useLocation,
  useNavigate,
  Link,
  NavLink,
} from "react-router-dom";
import {
  LogOut,
  Home,
  User,
  Briefcase,
  FileText,
  MailWarning,
  Building2,
  Users,
  Link2,
  Megaphone,
  KeyRound,
  Cpu,
  ChevronDown,
  LayoutDashboard,
  UserRoundSearch,
  MoreHorizontal,
  X,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth, getGreetingName } from "../contexts/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { NotificationCenter } from "./NotificationCenter";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const isAdmin = profile?.type === "ADMIN";
  const hasCompany = Boolean(profile?.companyId);
  const isCompanyWorkspace =
    !isAdmin &&
    hasCompany &&
    (location.pathname.startsWith("/dashboard/empresa") ||
      location.pathname.startsWith("/dashboard/curriculos") ||
      location.pathname.startsWith("/dashboard/configuracao-contratacao") ||
      location.pathname.startsWith("/dashboard/vaga/"));

  const companyLabel = profile?.companyName?.trim() || "Minha empresa";
  const workspaceLabel = isCompanyWorkspace ? companyLabel : "Meu espaço";

  const handleLogout = () => {
    auth.signOut();
    navigate("/");
  };

  const switchWorkspace = (workspace: "personal" | "company") => {
    setWorkspaceOpen(false);
    navigate(
      workspace === "company"
        ? "/dashboard/empresa/inicio"
        : "/dashboard/pessoal",
    );
  };

  const handleResendEmail = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      alert(
        "E-mail de verificação reenviado! Verifique sua caixa de entrada e spam.",
      );
    } catch (e) {
      console.error(e);
      alert(
        "Erro ao reenviar e-mail. Aguarde alguns minutos e tente novamente.",
      );
    }
  };

  const adminMoreActive =
    location.pathname.startsWith("/dashboard/admin/vinculos") ||
    location.pathname.startsWith("/dashboard/admin/publicidade") ||
    location.pathname.startsWith("/dashboard/admin/api") ||
    location.pathname.startsWith("/dashboard/admin/ai") ||
    location.pathname === "/dashboard/perfil";

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isAdmin ? "admin-workspace bg-[#f4f3ef]" : "bg-stone-50"
      }`}
    >
      {auth.currentUser && !auth.currentUser.emailVerified && (
        <div className="bg-amber-100 text-amber-900 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium shrink-0">
          <MailWarning className="w-5 h-5 shrink-0" />
          <span>Por favor, verifique seu e-mail para confirmar seu cadastro.</span>
          <button
            onClick={handleResendEmail}
            className="underline font-bold hover:text-terracotta-700 ml-1"
          >
            Reenviar e-mail
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`w-[284px] flex-col hidden md:flex ${
            isAdmin
              ? "bg-[#171714] text-white border-r border-white/5"
              : "bg-white border-r border-stone-200"
          }`}
        >
          <div className="px-5 pt-6 pb-5">
            <Link
              to="/"
              className={`font-serif font-bold text-xl ${
                isAdmin ? "text-white" : "text-terracotta-800"
              }`}
            >
              PiraNegócios
            </Link>

            {!isAdmin && (
              <div className="mt-5">
                {hasCompany ? (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-1.5">
                    <button
                      type="button"
                      onClick={() => switchWorkspace("personal")}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        !isCompanyWorkspace
                          ? "bg-white text-stone-950 shadow-sm"
                          : "text-stone-500 hover:text-stone-900"
                      }`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100">
                        <User className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold">Meu espaço</span>
                        <span className="block truncate text-[10px] text-stone-400">
                          Perfil e carreira
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchWorkspace("company")}
                      className={`mt-1 w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        isCompanyWorkspace
                          ? "bg-stone-950 text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-900"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                          isCompanyWorkspace ? "bg-white/10" : "bg-stone-100"
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">
                          {companyLabel}
                        </span>
                        <span className="block text-[10px] text-stone-400">
                          Workspace da empresa
                        </span>
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm text-stone-600">
                        <User className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-stone-900">Meu espaço</p>
                        <p className="text-[11px] text-stone-400">Perfil e carreira</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isAdmin && (
              <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.04] p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta-500/15 text-terracotta-300 ring-1 ring-terracotta-400/20">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Central de operação
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-white">
                      Administrador
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-[11px] text-white/55">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" />
                  Sistema operacional
                </div>
              </div>
            )}
          </div>

          <nav
            className={`flex-1 px-4 pb-4 space-y-1 overflow-y-auto ${
              isAdmin ? "admin-sidebar-nav" : ""
            }`}
          >
            {isAdmin ? (
              <AdminNavigation />
            ) : isCompanyWorkspace ? (
              <CompanyNavigation />
            ) : (
              <PersonalNavigation hasCompany={hasCompany} />
            )}
          </nav>

          <div className={`p-4 ${isAdmin ? "border-t border-white/5" : "border-t border-stone-100"}`}>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors font-medium ${
                isAdmin
                  ? "text-white/45 hover:bg-white/[0.06] hover:text-white"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header
            className={`relative px-4 md:px-6 py-3.5 flex justify-between items-center shrink-0 z-20 ${
              isAdmin
                ? "bg-[#f4f3ef]/95 backdrop-blur border-b border-stone-200/80"
                : "bg-white/95 backdrop-blur border-b border-stone-200"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <Link
                to="/"
                className="font-serif font-bold text-terracotta-800 text-lg md:hidden shrink-0"
              >
                PiraNegócios
              </Link>

              {!isAdmin && hasCompany && (
                <div className="relative md:hidden">
                  <button
                    type="button"
                    onClick={() => setWorkspaceOpen((current) => !current)}
                    className={`flex max-w-[170px] items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                      isCompanyWorkspace
                        ? "bg-stone-950 text-white"
                        : "bg-stone-100 text-stone-800"
                    }`}
                  >
                    {isCompanyWorkspace ? (
                      <Building2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <User className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{workspaceLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </button>

                  {workspaceOpen && (
                    <div className="absolute left-0 top-12 w-64 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() => switchWorkspace("personal")}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-stone-50"
                      >
                        <User className="h-4 w-4 text-stone-500" />
                        <div>
                          <p className="text-sm font-bold text-stone-900">Meu espaço</p>
                          <p className="text-[11px] text-stone-400">Perfil e carreira</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => switchWorkspace("company")}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-stone-50"
                      >
                        <Building2 className="h-4 w-4 text-stone-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-stone-900">
                            {companyLabel}
                          </p>
                          <p className="text-[11px] text-stone-400">Workspace da empresa</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isAdmin ? (
                <div className="flex items-center gap-3">
                  <span className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                      Operação
                    </p>
                    <p className="text-sm font-bold text-stone-900">
                      PiraNegócios Control Center
                    </p>
                  </div>
                </div>
              ) : (
                <div className="hidden md:block">
                  <h2 className="text-sm font-medium text-stone-500">
                    {isCompanyWorkspace ? (
                      <>
                        Trabalhando em{" "}
                        <span className="font-bold text-stone-900">{companyLabel}</span>
                      </>
                    ) : (
                      <>
                        Olá,{" "}
                        <span className="font-bold text-stone-900">
                          {getGreetingName(profile)}
                        </span>
                      </>
                    )}
                  </h2>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {isAdmin && (
                <div className="hidden lg:flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-bold text-stone-600 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Online
                </div>
              )}
              <NotificationCenter />
              <Link
                to="/dashboard/perfil"
                className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 shadow-sm"
                title="Meu perfil"
              >
                <User className="h-4 w-4" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-stone-500 hover:bg-white hover:text-stone-900 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div
            className={`flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:p-8 md:pb-8 ${
              isAdmin ? "admin-content" : ""
            }`}
          >
            {children}
          </div>

          {isAdmin ? (
            <>
              <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#171714]/98 backdrop-blur border-t border-white/5 px-2 py-2 flex items-center justify-around shadow-[0_-12px_36px_rgba(0,0,0,0.14)]">
                <AdminMobileNavItem end to="/dashboard" icon={<Home className="w-5 h-5" />} label="Início" />
                <AdminMobileNavItem to="/dashboard/admin/empresas" icon={<Building2 className="w-5 h-5" />} label="Empresas" />
                <AdminMobileNavItem to="/dashboard/admin/vagas" icon={<Briefcase className="w-5 h-5" />} label="Vagas" />
                <AdminMobileNavItem to="/dashboard/admin/usuarios" icon={<Users className="w-5 h-5" />} label="Usuários" />
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen(true)}
                  className={`min-w-14 flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold ${
                    adminMoreActive ? "text-terracotta-300" : "text-white/45"
                  }`}
                >
                  <MoreHorizontal className="h-5 w-5" />
                  <span>Mais</span>
                </button>
              </nav>

              {adminMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-sm" onClick={() => setAdminMenuOpen(false)}>
                  <div
                    className="w-full rounded-t-[28px] bg-[#1d1d19] p-4 pb-7 text-white shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-4 flex items-center justify-between px-1">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Administração</p>
                        <h3 className="mt-1 text-lg font-bold">Mais ferramentas</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/60"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <AdminMobileMoreLink to="/dashboard/admin/vinculos" icon={<Link2 className="h-4 w-4" />} label="Vínculos" onClick={() => setAdminMenuOpen(false)} />
                      <AdminMobileMoreLink to="/dashboard/admin/publicidade" icon={<Megaphone className="h-4 w-4" />} label="Publicidade" onClick={() => setAdminMenuOpen(false)} />
                      <AdminMobileMoreLink to="/dashboard/admin/api" icon={<KeyRound className="h-4 w-4" />} label="API v1" onClick={() => setAdminMenuOpen(false)} />
                      <AdminMobileMoreLink to="/dashboard/admin/ai" icon={<Cpu className="h-4 w-4" />} label="Inteligência Artificial" onClick={() => setAdminMenuOpen(false)} />
                      <AdminMobileMoreLink to="/dashboard/perfil" icon={<User className="h-4 w-4" />} label="Meus dados" onClick={() => setAdminMenuOpen(false)} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-stone-200 px-2 py-2 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
              {isCompanyWorkspace ? (
                <>
                  <MobileNavItem to="/dashboard/empresa/inicio" icon={<Home className="w-5 h-5" />} label="Início" />
                  <MobileNavItem to="/dashboard/empresa/painel" icon={<Briefcase className="w-5 h-5" />} label="Vagas" />
                  <MobileNavItem to="/dashboard/curriculos" icon={<UserRoundSearch className="w-5 h-5" />} label="Talentos" />
                  <MobileNavItem end to="/dashboard/empresa" icon={<Building2 className="w-5 h-5" />} label="Empresa" />
                </>
              ) : (
                <>
                  <MobileNavItem to="/dashboard/pessoal" icon={<Home className="w-5 h-5" />} label="Início" />
                  <MobileNavItem to="/vagas" icon={<Briefcase className="w-5 h-5" />} label="Vagas" />
                  <MobileNavItem to="/dashboard/curriculo/gerador" icon={<FileText className="w-5 h-5" />} label="Currículo" />
                  <MobileNavItem to="/dashboard/perfil" icon={<User className="w-5 h-5" />} label="Perfil" />
                </>
              )}
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}

function PersonalNavigation({ hasCompany }: { hasCompany: boolean }) {
  return (
    <>
      <SectionLabel>Meu espaço</SectionLabel>
      <NavItem to="/dashboard/pessoal" icon={<LayoutDashboard className="w-5 h-5" />} label="Visão geral" />
      <NavItem to="/vagas" icon={<Briefcase className="w-5 h-5" />} label="Encontrar vagas" />
      <NavItem to="/dashboard/curriculo/gerador" icon={<FileText className="w-5 h-5" />} label="Meu currículo" />
      <NavItem to="/dashboard/perfil" icon={<User className="w-5 h-5" />} label="Meu perfil" />

      {!hasCompany && (
        <div className="mt-5 border-t border-stone-100 pt-5">
          <Link
            to="/dashboard/empresa"
            className="flex items-center gap-3 rounded-2xl border border-terracotta-200 bg-terracotta-50/60 px-4 py-3 text-sm font-bold text-terracotta-800 transition hover:bg-terracotta-100"
          >
            <Building2 className="w-5 h-5" />
            Cadastrar empresa
          </Link>
        </div>
      )}
    </>
  );
}

function CompanyNavigation() {
  return (
    <>
      <SectionLabel>Empresa</SectionLabel>
      <NavItem to="/dashboard/empresa/inicio" icon={<LayoutDashboard className="w-5 h-5" />} label="Visão geral" />
      <NavItem to="/dashboard/empresa/painel" icon={<Briefcase className="w-5 h-5" />} label="Vagas" />
      <NavItem to="/dashboard/curriculos" icon={<UserRoundSearch className="w-5 h-5" />} label="Banco de talentos" />
      <NavItem to="/dashboard/configuracao-contratacao" icon={<FileText className="w-5 h-5" />} label="Contratação" />
      <NavItem end to="/dashboard/empresa" icon={<Building2 className="w-5 h-5" />} label="Perfil da empresa" />
    </>
  );
}

function AdminNavigation() {
  return (
    <>
      <AdminSectionLabel>Visão geral</AdminSectionLabel>
      <AdminNavItem end to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />

      <AdminSectionLabel>Operação</AdminSectionLabel>
      <AdminNavItem to="/dashboard/admin/empresas" icon={<Building2 className="w-4 h-4" />} label="Empresas" />
      <AdminNavItem to="/dashboard/admin/vagas" icon={<Briefcase className="w-4 h-4" />} label="Vagas" />
      <AdminNavItem to="/dashboard/admin/usuarios" icon={<Users className="w-4 h-4" />} label="Usuários" />
      <AdminNavItem to="/dashboard/admin/vinculos" icon={<Link2 className="w-4 h-4" />} label="Vínculos" />

      <AdminSectionLabel>Plataforma</AdminSectionLabel>
      <AdminNavItem to="/dashboard/admin/publicidade" icon={<Megaphone className="w-4 h-4" />} label="Publicidade" />
      <AdminNavItem to="/dashboard/admin/api" icon={<KeyRound className="w-4 h-4" />} label="API v1" />
      <AdminNavItem to="/dashboard/admin/ai" icon={<Cpu className="w-4 h-4" />} label="Inteligência Artificial" />

      <AdminSectionLabel>Conta</AdminSectionLabel>
      <AdminNavItem to="/dashboard/perfil" icon={<User className="w-4 h-4" />} label="Meus dados" />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
      {children}
    </div>
  );
}

function AdminSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2 pt-5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/25 first:pt-1">
      {children}
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  end = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${
          isActive
            ? "bg-terracotta-50 text-terracotta-800"
            : "text-stone-600 hover:bg-stone-50 hover:text-terracotta-700"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function AdminNavItem({
  to,
  icon,
  label,
  end = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
          isActive
            ? "bg-white text-stone-950 shadow-[0_8px_30px_rgba(0,0,0,.18)]"
            : "text-white/50 hover:bg-white/[0.055] hover:text-white"
        }`
      }
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.055] group-hover:bg-white/[0.08]">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function MobileNavItem({
  to,
  icon,
  label,
  end = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `min-w-14 flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold ${
          isActive ? "text-terracotta-700" : "text-stone-500"
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function AdminMobileNavItem({
  to,
  icon,
  label,
  end = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `min-w-14 flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold transition ${
          isActive ? "text-terracotta-300" : "text-white/45"
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function AdminMobileMoreLink({
  to,
  icon,
  label,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.045] px-3 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.08] hover:text-white"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-terracotta-300">
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
