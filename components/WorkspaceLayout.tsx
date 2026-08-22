import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Building2,
  ChevronDown,
  FileText,
  Home,
  LogOut,
  Menu,
  Settings2,
  Sparkles,
  User,
  UserRoundSearch,
  X,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { getGreetingName, useAuth } from "../contexts/AuthContext";
import { NotificationCenter } from "./NotificationCenter";
import { UserTheme } from "./UserTheme";

type Workspace = "user" | "company";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
};

const userNavigation: NavItem[] = [
  { to: "/user", label: "Início", icon: <Home className="h-5 w-5" />, end: true },
  { to: "/user/vagas", label: "Encontrar vagas", icon: <Briefcase className="h-5 w-5" /> },
  { to: "/user/curriculo", label: "Meu currículo", icon: <FileText className="h-5 w-5" /> },
  { to: "/user/preferencias", label: "Preferências", icon: <Settings2 className="h-5 w-5" /> },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const hasCompany = Boolean(profile?.companyId);
  const companyLabel = profile?.companyName?.trim() || "Minha empresa";
  const isCompany = workspace === "company";
  const navigation = isCompany ? companyNavigation : userNavigation;
  const greetingName = getGreetingName(profile);

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
    <div
      className={`min-h-screen ${
        isCompany
          ? "bg-[#f3f2ee]"
          : "user-workspace bg-[#f5efe8] text-[#201813]"
      }`}
    >
      {!isCompany && <UserTheme />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden w-[288px] flex-col border-r md:flex ${
          isCompany
            ? "border-white/5 bg-[#1b1b18] text-white"
            : "border-white/5 bg-[#2b211c] text-white shadow-[18px_0_70px_rgba(48,31,22,0.10)]"
        }`}
      >
        <div className="px-5 pb-4 pt-6">
          <Link to="/" className="group inline-flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-2xl font-serif text-lg font-black ${
                isCompany
                  ? "bg-white text-stone-950"
                  : "bg-[#f2d2c1] text-[#36241c] shadow-[0_10px_30px_rgba(0,0,0,.14)]"
              }`}
            >
              P
            </span>
            <span>
              <span className="block font-serif text-xl font-bold leading-none text-white">
                PiraNegócios
              </span>
              <span
                className={`mt-1 block text-[9px] font-bold uppercase tracking-[0.22em] ${
                  isCompany ? "text-white/28" : "text-[#e2ad91]/60"
                }`}
              >
                {isCompany ? "Business" : "Career"}
              </span>
            </span>
          </Link>

          <div className="relative mt-6">
            <button
              type="button"
              onClick={() => setWorkspaceOpen((value) => !value)}
              className={`flex w-full items-center gap-3 rounded-[20px] border p-3.5 text-left transition duration-200 ${
                isCompany
                  ? "border-white/10 bg-white/[0.055] hover:bg-white/[0.08]"
                  : "border-white/10 bg-white/[0.065] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:bg-white/[0.09]"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  isCompany
                    ? "bg-white/10 text-white"
                    : "bg-gradient-to-br from-[#f2d2c1] to-[#d98b68] text-[#342119] shadow-lg"
                }`}
              >
                {isCompany ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
                  {isCompany ? "Workspace da empresa" : "Seu espaço"}
                </span>
                <span className="mt-0.5 block truncate text-sm font-bold text-white">
                  {isCompany ? companyLabel : greetingName}
                </span>
                {!isCompany && (
                  <span className="mt-0.5 block truncate text-[10px] text-white/38">
                    Carreira e oportunidades
                  </span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-white/35" />
            </button>

            {workspaceOpen && (
              <div className="absolute left-0 right-0 top-[76px] z-50 rounded-[20px] border border-stone-200 bg-[#fffdfa] p-2 text-stone-900 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
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
                      <span className="block text-[11px] text-stone-400">
                        Crie um workspace empresarial
                      </span>
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-2 pt-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/24">
            {isCompany ? "Gestão" : "Sua jornada"}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {navigation.map((item) => (
            <WorkspaceNavLink key={item.to} {...item} company={isCompany} />
          ))}
        </nav>

        {!isCompany && (
          <div className="mx-4 mb-4 space-y-3">
            <Link
              to="/user/curriculo"
              className="group block rounded-[22px] border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.035] p-4 transition hover:border-[#e5a787]/30 hover:bg-white/[0.11]"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8aa89]/15 text-[#f0c2a9]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <ArrowMark />
              </div>
              <p className="mt-3 text-sm font-bold text-white">Fortaleça seu currículo</p>
              <p className="mt-1 text-[11px] leading-5 text-white/38">
                Mantenha seu perfil pronto para as próximas oportunidades.
              </p>
            </Link>

            {!hasCompany && (
              <Link
                to="/company/perfil"
                className="flex items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3 text-xs font-bold text-white/48 transition hover:bg-white/[0.05] hover:text-white"
              >
                <Building2 className="h-4 w-4" />
                Também recruta? Criar empresa
              </Link>
            )}
          </div>
        )}

        <div className="border-t border-white/[0.06] p-4">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/38 transition hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut className="h-5 w-5" /> Sair
          </button>
        </div>
      </aside>

      <div className="min-h-screen md:pl-[288px]">
        <header
          className={`sticky top-0 z-30 flex h-[72px] items-center justify-between border-b px-4 backdrop-blur-2xl md:px-7 ${
            isCompany
              ? "border-stone-200/80 bg-[#f3f2ee]/92"
              : "border-[#5b4030]/10 bg-[#f8f3ed]/82 shadow-[0_1px_0_rgba(255,255,255,.7)]"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#5b4030]/10 bg-white/70 text-stone-700 shadow-sm md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400">
                {isCompany ? "Workspace da empresa" : "PiraNegócios Career"}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-stone-900">
                {isCompany ? companyLabel : `Sua carreira, ${greetingName}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasCompany && (
              <button
                type="button"
                onClick={() => switchWorkspace(isCompany ? "user" : "company")}
                className="hidden items-center gap-2 rounded-2xl border border-stone-200/80 bg-white/80 px-3.5 py-2.5 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-white sm:flex"
              >
                {isCompany ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                {isCompany ? "Meu espaço" : companyLabel}
              </button>
            )}
            <div className={!isCompany ? "rounded-2xl border border-[#5b4030]/10 bg-white/65 shadow-sm" : ""}>
              <NotificationCenter />
            </div>
            <Link
              to={isCompany ? "/company/perfil" : "/user/perfil"}
              className={`flex h-10 items-center gap-2 rounded-2xl border px-2.5 shadow-sm transition hover:-translate-y-0.5 ${
                isCompany
                  ? "border-stone-200 bg-white text-stone-600"
                  : "border-[#5b4030]/10 bg-[#2b211c] text-white"
              }`}
              title={isCompany ? "Perfil da empresa" : "Meu perfil"}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                  isCompany ? "bg-stone-100" : "bg-white/10"
                }`}
              >
                {isCompany ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </span>
              {!isCompany && (
                <span className="hidden max-w-24 truncate pr-1 text-[11px] font-bold sm:block">
                  {greetingName}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main
          className={`p-4 pb-24 sm:p-6 md:p-8 md:pb-10 ${
            isCompany ? "" : "user-content"
          }`}
        >
          {children}
        </main>
      </div>

      <nav
        className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t px-2 py-2.5 shadow-[0_-12px_40px_rgba(0,0,0,.09)] backdrop-blur-xl md:hidden ${
          isCompany
            ? "border-stone-200 bg-white/96"
            : "border-white/[0.08] bg-[#2b211c]/96 text-white"
        }`}
      >
        {(isCompany ? companyNavigation.slice(0, 4) : userNavigation).map((item) => (
          <MobileNavLink key={item.to} {...item} company={isCompany} />
        ))}
      </nav>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className={`h-full w-[86%] max-w-[330px] p-4 shadow-2xl ${
              isCompany ? "bg-[#1b1b18] text-white" : "bg-[#2b211c] text-white"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 py-2">
              <Link to="/" className="font-serif text-xl font-bold text-white">
                PiraNegócios
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 rounded-[20px] border border-white/10 bg-white/[0.055] p-3.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
                Espaço atual
              </p>
              <p className="mt-1 truncate text-sm font-bold">
                {isCompany ? companyLabel : greetingName}
              </p>
              <p className="mt-1 text-[11px] text-white/38">
                {isCompany ? "Recrutamento e talentos" : "Carreira e oportunidades"}
              </p>
              {hasCompany && (
                <button
                  type="button"
                  onClick={() => switchWorkspace(isCompany ? "user" : "company")}
                  className="mt-3 text-xs font-bold text-[#efb89c]"
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

function ArrowMark() {
  return (
    <span className="text-sm text-white/28 transition group-hover:translate-x-1 group-hover:text-[#f0c2a9]">
      →
    </span>
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
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
        active ? "bg-stone-950 text-white" : "hover:bg-stone-50"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          active ? "bg-white/10" : "bg-stone-100 text-stone-500"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{title}</span>
        <span className={`block text-[11px] ${active ? "text-white/45" : "text-stone-400"}`}>
          {subtitle}
        </span>
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
        `group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition duration-200 ${
          company
            ? isActive
              ? "bg-white text-stone-950 shadow-lg"
              : "text-white/50 hover:bg-white/[0.06] hover:text-white"
            : isActive
              ? "bg-[#f2d2c1] text-[#342119] shadow-[0_10px_30px_rgba(0,0,0,.12)]"
              : "text-white/48 hover:bg-white/[0.06] hover:text-white"
        }`
      }
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.055] transition group-hover:bg-white/[0.08]">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function MobileNavLink({
  to,
  label,
  icon,
  end = false,
  company,
}: NavItem & { company: boolean; key?: React.Key }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-semibold transition ${
          company
            ? isActive
              ? "text-terracotta-700"
              : "text-stone-400"
            : isActive
              ? "bg-white/[0.08] text-[#f2c5ad]"
              : "text-white/38"
        }`
      }
    >
      {icon}
      <span>
        {label
          .replace("Banco de talentos", "Talentos")
          .replace("Encontrar vagas", "Vagas")
          .replace("Meu currículo", "Currículo")
          .replace("Meu perfil", "Perfil")}
      </span>
    </NavLink>
  );
}
