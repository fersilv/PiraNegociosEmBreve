import React, { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Building2,
  ChevronDown,
  FileText,
  Home,
  LogOut,
  Menu,
  Settings2,
  User,
  UserRoundSearch,
  X,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { getGreetingName, useAuth } from "../contexts/AuthContext";
import { NotificationCenter } from "./NotificationCenter";

type Workspace = "user" | "company";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
};

const userNavigation: NavItem[] = [
  { to: "/user", label: "Início", icon: <Home className="h-5 w-5" />, end: true },
  { to: "/vagas", label: "Encontrar vagas", icon: <Briefcase className="h-5 w-5" /> },
  { to: "/user/curriculo", label: "Meu currículo", icon: <FileText className="h-5 w-5" /> },
  { to: "/user/perfil", label: "Meu perfil", icon: <User className="h-5 w-5" /> },
];

const companyNavigation: NavItem[] = [
  { to: "/company", label: "Visão geral", icon: <Home className="h-5 w-5" />, end: true },
  { to: "/company/vagas", label: "Vagas", icon: <Briefcase className="h-5 w-5" /> },
  { to: "/company/talentos", label: "Banco de talentos", icon: <UserRoundSearch className="h-5 w-5" /> },
  { to: "/company/contratacao", label: "Contratação", icon: <Settings2 className="h-5 w-5" /> },
  { to: "/company/perfil", label: "Perfil da empresa", icon: <Building2 className="h-5 w-5" /> },
];

export function WorkspaceLayout({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: React.ReactNode;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const hasCompany = Boolean(profile?.companyId);
  const companyLabel = profile?.companyName?.trim() || "Minha empresa";
  const isCompany = workspace === "company";
  const navigation = isCompany ? companyNavigation : userNavigation;

  const logout = async () => {
    await auth.signOut();
    navigate("/");
  };

  const switchWorkspace = (target: Workspace) => {
    setWorkspaceOpen(false);
    setMobileOpen(false);
    navigate(target === "company" ? "/company" : "/user");
  };

  return (
    <div className={`min-h-screen ${isCompany ? "bg-[#f3f2ee]" : "bg-stone-50"}`}>
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden w-[288px] flex-col border-r md:flex ${
          isCompany
            ? "border-white/5 bg-[#1b1b18] text-white"
            : "border-stone-200 bg-white text-stone-900"
        }`}
      >
        <div className="px-5 pb-4 pt-6">
          <Link
            to="/"
            className={`font-serif text-xl font-bold ${isCompany ? "text-white" : "text-terracotta-800"}`}
          >
            PiraNegócios
          </Link>

          <div className="relative mt-5">
            <button
              type="button"
              onClick={() => setWorkspaceOpen((value) => !value)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                isCompany
                  ? "border-white/10 bg-white/[0.055] hover:bg-white/[0.08]"
                  : "border-stone-200 bg-stone-50 hover:bg-stone-100"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isCompany ? "bg-white/10 text-white" : "bg-white text-terracotta-700 shadow-sm"
                }`}
              >
                {isCompany ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[10px] font-bold uppercase tracking-[0.16em] ${isCompany ? "text-white/35" : "text-stone-400"}`}>
                  {isCompany ? "Empresa" : "Meu espaço"}
                </span>
                <span className={`block truncate text-sm font-bold ${isCompany ? "text-white" : "text-stone-900"}`}>
                  {isCompany ? companyLabel : getGreetingName(profile)}
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 ${isCompany ? "text-white/40" : "text-stone-400"}`} />
            </button>

            {workspaceOpen && (
              <div className="absolute left-0 right-0 top-[68px] z-50 rounded-2xl border border-stone-200 bg-white p-2 text-stone-900 shadow-2xl">
                <WorkspaceChoice
                  active={!isCompany}
                  icon={<User className="h-4 w-4" />}
                  title="Meu espaço"
                  subtitle="Carreira, currículo e candidaturas"
                  onClick={() => switchWorkspace("user")}
                />
                {hasCompany ? (
                  <WorkspaceChoice
                    active={isCompany}
                    icon={<Building2 className="h-4 w-4" />}
                    title={companyLabel}
                    subtitle="Recrutamento e gestão de talentos"
                    onClick={() => switchWorkspace("company")}
                  />
                ) : (
                  <Link
                    to="/company/perfil"
                    onClick={() => setWorkspaceOpen(false)}
                    className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-stone-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">Cadastrar empresa</span>
                      <span className="block text-[11px] text-stone-400">Crie um workspace empresarial</span>
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-2 pt-3">
          <p className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isCompany ? "text-white/25" : "text-stone-400"}`}>
            {isCompany ? "Gestão" : "Carreira"}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {navigation.map((item) => (
            <WorkspaceNavLink key={item.to} {...item} company={isCompany} />
          ))}
        </nav>

        {!isCompany && !hasCompany && (
          <div className="mx-4 mb-4 rounded-2xl border border-terracotta-200 bg-terracotta-50 p-4">
            <p className="text-sm font-bold text-terracotta-950">Também recruta?</p>
            <p className="mt-1 text-xs leading-5 text-terracotta-800/75">
              Crie o espaço da sua empresa sem misturar seus dados pessoais com a operação de recrutamento.
            </p>
            <Link
              to="/company/perfil"
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-terracotta-800"
            >
              Criar workspace <Building2 className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className={`border-t p-4 ${isCompany ? "border-white/5" : "border-stone-100"}`}>
          <button
            type="button"
            onClick={logout}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              isCompany ? "text-white/45 hover:bg-white/[0.06] hover:text-white" : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
            }`}
          >
            <LogOut className="h-5 w-5" /> Sair
          </button>
        </div>
      </aside>

      <div className="min-h-screen md:pl-[288px]">
        <header className={`sticky top-0 z-30 flex h-[68px] items-center justify-between border-b px-4 backdrop-blur-xl md:px-7 ${
          isCompany
            ? "border-stone-200/80 bg-[#f3f2ee]/92"
            : "border-stone-200 bg-white/92"
        }`}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-stone-400">
                {isCompany ? "Workspace da empresa" : "Meu espaço"}
              </p>
              <p className="truncate text-sm font-bold text-stone-900">
                {isCompany ? companyLabel : `Olá, ${getGreetingName(profile)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasCompany && (
              <button
                type="button"
                onClick={() => switchWorkspace(isCompany ? "user" : "company")}
                className="hidden items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-stone-50 sm:flex"
              >
                {isCompany ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                {isCompany ? "Meu espaço" : companyLabel}
              </button>
            )}
            <NotificationCenter />
            <Link
              to={isCompany ? "/company/perfil" : "/user/perfil"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:bg-stone-50"
              title={isCompany ? "Perfil da empresa" : "Meu perfil"}
            >
              {isCompany ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </Link>
          </div>
        </header>

        <main className="p-4 pb-24 sm:p-6 md:p-8 md:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-stone-200 bg-white/96 px-2 py-2 shadow-[0_-8px_30px_rgba(0,0,0,.04)] backdrop-blur md:hidden">
        {(isCompany ? companyNavigation.slice(0, 4) : userNavigation).map((item) => (
          <MobileNavLink key={item.to} {...item} />
        ))}
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className={`h-full w-[86%] max-w-[330px] p-4 shadow-2xl ${isCompany ? "bg-[#1b1b18] text-white" : "bg-white text-stone-900"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 py-2">
              <Link to="/" className={`font-serif text-xl font-bold ${isCompany ? "text-white" : "text-terracotta-800"}`}>
                PiraNegócios
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className={`flex h-9 w-9 items-center justify-center rounded-full ${isCompany ? "bg-white/8 text-white/60" : "bg-stone-100 text-stone-500"}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`my-4 rounded-2xl border p-3 ${isCompany ? "border-white/10 bg-white/[0.05]" : "border-stone-200 bg-stone-50"}`}>
              <p className={`text-[9px] font-bold uppercase tracking-[0.18em] ${isCompany ? "text-white/35" : "text-stone-400"}`}>
                Espaço atual
              </p>
              <p className="mt-1 truncate text-sm font-bold">{isCompany ? companyLabel : "Meu espaço"}</p>
              {hasCompany && (
                <button
                  type="button"
                  onClick={() => switchWorkspace(isCompany ? "user" : "company")}
                  className={`mt-3 text-xs font-bold ${isCompany ? "text-terracotta-300" : "text-terracotta-700"}`}
                >
                  Trocar para {isCompany ? "meu espaço" : companyLabel}
                </button>
              )}
            </div>

            <nav className="space-y-1">
              {navigation.map((item) => (
                <WorkspaceNavLink
                  key={item.to}
                  {...item}
                  company={isCompany}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceChoice({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-stone-950 text-white" : "hover:bg-stone-50"}`}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-white/10" : "bg-stone-100 text-stone-500"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{title}</span>
        <span className={`block text-[11px] ${active ? "text-white/45" : "text-stone-400"}`}>{subtitle}</span>
      </span>
    </button>
  );
}

function WorkspaceNavLink({
  to,
  label,
  icon,
  end = false,
  company,
  onClick,
}: NavItem & { company: boolean; onClick?: () => void; key?: React.Key }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
          company
            ? isActive
              ? "bg-white text-stone-950 shadow-lg"
              : "text-white/50 hover:bg-white/[0.06] hover:text-white"
            : isActive
              ? "bg-terracotta-50 text-terracotta-800"
              : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
        }`
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function MobileNavLink({ to, label, icon, end = false }: NavItem & { key?: React.Key }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-14 flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold ${isActive ? "text-terracotta-700" : "text-stone-400"}`
      }
    >
      {icon}
      <span>{label.replace("Banco de talentos", "Talentos").replace("Encontrar vagas", "Vagas").replace("Meu currículo", "Currículo").replace("Meu perfil", "Perfil")}</span>
    </NavLink>
  );
}
