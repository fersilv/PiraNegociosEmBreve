import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  Globe2,
  Home,
  LockKeyhole,
  LogOut,
  MailPlus,
  Menu,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Tags,
  User,
  UserRoundSearch,
  UsersRound,
  X,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { getGreetingName, useAuth, type CompanyPermissionKey } from "../contexts/AuthContext";
import { NotificationCenter } from "./NotificationCenter";
import { UserTheme } from "./UserTheme";

type Workspace = "user" | "company";
type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  permission?: CompanyPermissionKey;
};

const userNavigation: NavItem[] = [
  { to: "/user", label: "Início", icon: <Home className="h-5 w-5" />, end: true },
  { to: "/user/vagas", label: "Encontrar vagas", icon: <Briefcase className="h-5 w-5" /> },
  { to: "/user/curriculo", label: "Meu currículo", icon: <FileText className="h-5 w-5" /> },
  { to: "/user/perfil", label: "Perfil profissional", icon: <User className="h-5 w-5" /> },
  { to: "/user/pagamentos", label: "Transações financeiras", icon: <CreditCard className="h-5 w-5" /> },
  { to: "/user/preferencias", label: "Preferências", icon: <SlidersHorizontal className="h-5 w-5" /> },
  { to: "/user/configuracoes", label: "Configurações", icon: <Settings2 className="h-5 w-5" /> },
];

const userMobileNavigation = userNavigation.filter((item) => ["/user", "/user/vagas", "/user/curriculo", "/user/perfil"].includes(item.to));

const companyNavigation: NavItem[] = [
  { to: "/company", label: "Visão geral", icon: <Home className="h-5 w-5" />, end: true },
  { to: "/company/vagas", label: "Talentos", icon: <UsersRound className="h-5 w-5" />, permission: "recruitment" },
  { to: "/company/pagina", label: "Minha Página", icon: <Globe2 className="h-5 w-5" />, permission: "companyProfile" },
  { to: "/company/contratacao", label: "Contratação", icon: <Settings2 className="h-5 w-5" />, permission: "recruitment" },
  { to: "/company/planos", label: "Planos", icon: <CreditCard className="h-5 w-5" />, permission: "finance" },
  { to: "/company/perfil", label: "Perfil da empresa", icon: <Building2 className="h-5 w-5" />, permission: "companyProfile" },
];

export function WorkspaceLayout({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const hasCompany = Boolean(profile?.companyId);
  const companyAccess = profile?.companyAccess;
  const elevatedCompanyAccess = profile?.type === "ADMIN" || profile?.isCompanyAdmin === true;
  const canEnterBusiness = Boolean(hasCompany && (elevatedCompanyAccess || companyAccess?.hasAnyPermission));
  const canUseClassifieds = Boolean(!hasCompany || elevatedCompanyAccess || companyAccess?.permissions?.marketplace);
  const companyLabel = companyAccess?.companyName?.trim() || profile?.companyName?.trim() || "Minha empresa";
  const isCompany = workspace === "company";
  const navigation = isCompany
    ? companyNavigation.filter((item) => !item.permission || elevatedCompanyAccess || companyAccess?.permissions?.[item.permission] === true)
    : userNavigation;
  const greetingName = getGreetingName(profile);
  const jobsRouteActive = isCompany && (location.pathname.startsWith("/company/vagas") || location.pathname.startsWith("/company/talentos"));
  const [jobsMenuOpen, setJobsMenuOpen] = useState(jobsRouteActive);

  useEffect(() => {
    if (jobsRouteActive) setJobsMenuOpen(true);
  }, [jobsRouteActive]);

  const logout = async () => {
    await auth.signOut();
    window.location.replace("/");
  };

  const switchWorkspace = (target: Workspace) => {
    if (target === "company" && !canEnterBusiness) return;
    setWorkspaceOpen(false);
    setMobileOpen(false);
    navigate(target === "company" ? "/company" : "/user");
  };

  const openClassifieds = () => {
    if (!canUseClassifieds) return;
    setWorkspaceOpen(false);
    setMobileOpen(false);
    navigate("/classificados/painel");
  };

  return (
    <div className={`min-h-screen ${isCompany ? "bg-[#f3f2ee]" : "user-workspace bg-[#f5efe8] text-[#201813]"}`}>
      {!isCompany && <UserTheme />}

      <aside className={`fixed inset-y-0 left-0 z-40 hidden w-[288px] flex-col border-r md:flex ${isCompany ? "border-white/5 bg-[#1b1b18] text-white" : "border-white/5 bg-[#2b211c] text-white shadow-[18px_0_70px_rgba(48,31,22,0.10)]"}`}>
        <div className="px-5 pb-4 pt-6">
          <Link to="/" className="group inline-flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl font-serif text-lg font-black ${isCompany ? "bg-white text-stone-950" : "bg-[#f2d2c1] text-[#36241c] shadow-[0_10px_30px_rgba(0,0,0,.14)]"}`}>P</span>
            <span>
              <span className="block font-serif text-xl font-bold leading-none text-white">PiraNegócios</span>
              <span className={`mt-1 block text-[9px] font-bold uppercase tracking-[0.22em] ${isCompany ? "text-white/28" : "text-[#e2ad91]/60"}`}>{isCompany ? "Business" : "Career"}</span>
            </span>
          </Link>

          <div className="relative mt-6">
            <button type="button" onClick={() => setWorkspaceOpen((value) => !value)} className={`flex w-full items-center gap-3 rounded-[20px] border p-3.5 text-left transition duration-200 ${isCompany ? "border-white/10 bg-white/[0.055] hover:bg-white/[0.08]" : "border-white/10 bg-white/[0.065] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:bg-white/[0.09]"}`}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isCompany ? "bg-white/10 text-white" : "bg-gradient-to-br from-[#f2d2c1] to-[#d98b68] text-[#342119] shadow-lg"}`}>{isCompany ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">{isCompany ? "Workspace da empresa" : "Seu espaço"}</span>
                <span className="mt-0.5 block truncate text-sm font-bold text-white">{isCompany ? companyLabel : greetingName}</span>
                <span className="mt-0.5 block truncate text-[10px] text-white/38">{isCompany ? "Gestão empresarial" : "Carreira e oportunidades"}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-white/35" />
            </button>

            {workspaceOpen && (
              <div className="absolute left-0 right-0 top-[76px] z-50 rounded-[20px] border border-stone-200 bg-[#fffdfa] p-2 text-stone-900 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
                <WorkspaceChoice active={!isCompany} icon={<User className="h-4 w-4" />} title="PiraNegócios Career" subtitle="Carreira, currículo e candidaturas" onClick={() => switchWorkspace("user")} />
                {hasCompany ? (
                  <WorkspaceChoice
                    active={isCompany}
                    disabled={!canEnterBusiness}
                    icon={canEnterBusiness ? <Building2 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    title="PiraNegócios Business"
                    subtitle={canEnterBusiness ? `${companyLabel} · acesso liberado` : `${companyLabel} · sem permissões liberadas`}
                    onClick={() => switchWorkspace("company")}
                  />
                ) : (
                  <Link to="/company/perfil" onClick={() => setWorkspaceOpen(false)} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-stone-50">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500"><Building2 className="h-4 w-4" /></span>
                    <span><span className="block text-sm font-bold">Cadastrar empresa</span><span className="block text-[11px] text-stone-400">Crie um workspace empresarial</span></span>
                  </Link>
                )}
                <div className="my-1 border-t border-stone-100" />
                <WorkspaceChoice
                  active={false}
                  disabled={!canUseClassifieds}
                  icon={canUseClassifieds ? <Tags className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                  title="Classificados"
                  subtitle={canUseClassifieds ? "Comprar, vender e administrar serviços" : "Sem autorização da empresa para Classificados"}
                  onClick={openClassifieds}
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-2 pt-4"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/24">{isCompany ? "Gestão" : "Sua jornada"}</p></div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {navigation.map((item) => isCompany && item.to === "/company/vagas"
            ? <CompanyJobsNav key={item.to} open={jobsMenuOpen} onToggle={() => setJobsMenuOpen((value) => !value)} />
            : <WorkspaceNavLink key={item.to} {...item} company={isCompany} />)}
        </nav>

        <div className="mx-4 mb-4 space-y-3">
          {!isCompany && <Link to="/user/curriculo" className="group block rounded-[22px] border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.035] p-4 transition hover:border-[#e5a787]/30 hover:bg-white/[0.11]"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8aa89]/15 text-[#f0c2a9]"><Sparkles className="h-4 w-4" /></span><ArrowMark /></div><p className="mt-3 text-sm font-bold text-white">Fortaleça seu currículo</p><p className="mt-1 text-[11px] leading-5 text-white/38">Mantenha seu perfil pronto para as próximas oportunidades.</p></Link>}
          <button type="button" onClick={openClassifieds} disabled={!canUseClassifieds} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-xs font-black shadow-[0_8px_24px_rgba(0,0,0,.12)] transition ${canUseClassifieds ? "border-[#e8aa89]/30 bg-[#c96847]/18 text-[#ffd8c5] hover:-translate-y-0.5 hover:bg-[#c96847]/28 hover:text-white" : "cursor-not-allowed border-white/10 bg-white/[0.035] text-white/25"}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${canUseClassifieds ? "bg-[#c96847] text-white" : "bg-white/[0.06]"}`}>{canUseClassifieds ? <Tags className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}</span>
            <span className="flex-1">{canUseClassifieds ? "Ir para os Classificados" : "Classificados sem autorização"}</span>
          </button>
          {!isCompany && !hasCompany && <Link to="/company/perfil" className="flex items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3 text-xs font-bold text-white/48 transition hover:bg-white/[0.05] hover:text-white"><Building2 className="h-4 w-4" />Também recruta? Criar empresa</Link>}
        </div>
        <div className="border-t border-white/[0.06] p-4"><button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/38 transition hover:bg-white/[0.06] hover:text-white"><LogOut className="h-5 w-5" /> Sair</button></div>
      </aside>

      <div className="min-h-screen md:pl-[288px]">
        <header className={`sticky top-0 z-30 flex h-[72px] items-center justify-between border-b px-4 backdrop-blur-2xl md:px-7 ${isCompany ? "border-stone-200/80 bg-[#f3f2ee]/92" : "border-[#5b4030]/10 bg-[#f8f3ed]/82 shadow-[0_1px_0_rgba(255,255,255,.7)]"}`}>
          <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMobileOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#5b4030]/10 bg-white/70 text-stone-700 shadow-sm md:hidden" aria-label="Abrir menu"><Menu className="h-4 w-4" /></button><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400">{isCompany ? "PiraNegócios Business" : "PiraNegócios Career"}</p><p className="mt-0.5 truncate text-sm font-bold text-stone-900">{isCompany ? companyLabel : `Sua carreira, ${greetingName}`}</p></div></div>
          <div className="flex items-center gap-2">
            {hasCompany && (isCompany || canEnterBusiness) && <button type="button" onClick={() => switchWorkspace(isCompany ? "user" : "company")} disabled={!isCompany && !canEnterBusiness} className="hidden items-center gap-2 rounded-2xl border border-stone-200/80 bg-white/80 px-3.5 py-2.5 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 sm:flex">{isCompany ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}{isCompany ? "Career" : companyLabel}</button>}
            <div className={!isCompany ? "rounded-2xl border border-[#5b4030]/10 bg-white/65 shadow-sm" : ""}><NotificationCenter /></div>
            <Link to={isCompany ? "/company/perfil" : "/user/configuracoes"} className={`flex h-10 items-center gap-2 rounded-2xl border px-2.5 shadow-sm transition hover:-translate-y-0.5 ${isCompany ? "border-stone-200 bg-white text-stone-600" : "border-[#5b4030]/10 bg-[#2b211c] text-white"}`} title={isCompany ? "Perfil da empresa" : "Configurações da conta"}><span className={`flex h-6 w-6 items-center justify-center rounded-lg ${isCompany ? "bg-stone-100" : "bg-white/10"}`}>{isCompany ? <Building2 className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}</span>{!isCompany && <span className="hidden max-w-24 truncate pr-1 text-[11px] font-bold sm:block">Configurações</span>}</Link>
          </div>
        </header>
        <main className={`p-4 pb-24 sm:p-6 md:p-8 md:pb-10 ${isCompany ? "" : "user-content"}`}>{children}</main>
      </div>

      <nav className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t px-2 py-2.5 shadow-[0_-12px_40px_rgba(0,0,0,.09)] backdrop-blur-xl md:hidden ${isCompany ? "border-stone-200 bg-white/96" : "border-white/[0.08] bg-[#2b211c]/96 text-white"}`}>
        {(isCompany ? navigation.slice(0, 4) : userMobileNavigation).map((item) => <MobileNavLink key={item.to} {...item} company={isCompany} />)}
        {canUseClassifieds ? <Link to="/classificados/painel" className={`flex min-w-14 flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[9px] font-black ${isCompany ? "border-[#c96847]/20 bg-[#fff0e8] text-[#a84f34]" : "border-[#e8aa89]/25 bg-[#c96847]/20 text-[#ffd8c5]"}`}><Tags className="h-5 w-5" /><span>Classificados</span></Link> : <button type="button" disabled className="flex min-w-14 flex-col items-center gap-0.5 rounded-xl border border-white/10 px-2 py-1.5 text-[9px] font-black text-white/20"><LockKeyhole className="h-5 w-5" /><span>Bloqueado</span></button>}
      </nav>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}><div className={`flex h-full w-[86%] max-w-[330px] flex-col overflow-y-auto p-4 shadow-2xl ${isCompany ? "bg-[#1b1b18] text-white" : "bg-[#2b211c] text-white"}`} onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between px-1 py-2"><Link to="/" className="font-serif text-xl font-bold text-white">PiraNegócios</Link><button type="button" onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/60"><X className="h-4 w-4" /></button></div><div className="my-4 rounded-[20px] border border-white/10 bg-white/[0.055] p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">Espaço atual</p><p className="mt-1 truncate text-sm font-bold">{isCompany ? companyLabel : greetingName}</p><p className="mt-1 text-[11px] text-white/38">{isCompany ? "PiraNegócios Business" : "PiraNegócios Career"}</p>{hasCompany && <button type="button" disabled={!isCompany && !canEnterBusiness} onClick={() => switchWorkspace(isCompany ? "user" : "company")} className="mt-3 text-xs font-bold text-[#efb89c] disabled:cursor-not-allowed disabled:text-white/25">{isCompany ? "Trocar para Career" : canEnterBusiness ? `Trocar para ${companyLabel}` : `${companyLabel} · sem permissões`}</button>}<button type="button" disabled={!canUseClassifieds} onClick={openClassifieds} className="mt-2 block text-xs font-bold text-[#efb89c] disabled:cursor-not-allowed disabled:text-white/25">{canUseClassifieds ? "Abrir Classificados" : "Classificados sem autorização"}</button></div><nav className="space-y-1">{navigation.map((item) => isCompany && item.to === "/company/vagas" ? <CompanyJobsNav key={item.to} open={jobsMenuOpen} onToggle={() => setJobsMenuOpen((value) => !value)} onNavigate={() => setMobileOpen(false)} /> : <WorkspaceNavLink key={item.to} {...item} company={isCompany} onClick={() => setMobileOpen(false)} />)}</nav><div className="mt-auto border-t border-white/[0.08] pt-4"><button type="button" onClick={() => void logout()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/10 bg-red-400/[0.08] px-4 py-3.5 text-sm font-bold text-red-200"><LogOut className="h-4 w-4" /> Sair da conta</button></div></div></div>}
    </div>
  );
}

function ArrowMark() {
  return <span className="text-sm text-white/28 transition group-hover:translate-x-1 group-hover:text-[#f0c2a9]">→</span>;
}

function WorkspaceChoice({ active, disabled = false, icon, title, subtitle, onClick }: { active: boolean; disabled?: boolean; icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${disabled ? "cursor-not-allowed bg-stone-50 text-stone-400 opacity-65" : active ? "bg-stone-950 text-white" : "hover:bg-stone-50"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active && !disabled ? "bg-white/10" : "bg-stone-100 text-stone-500"}`}>{icon}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{title}</span><span className={`block text-[11px] ${active && !disabled ? "text-white/45" : "text-stone-400"}`}>{subtitle}</span></span></button>;
}

function WorkspaceNavLink({ to, label, icon, end = false, company, onClick }: NavItem & { company: boolean; onClick?: () => void; key?: React.Key }) {
  return <NavLink to={to} end={end} onClick={onClick} className={({ isActive }) => `group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition duration-200 ${company ? isActive ? "bg-white text-stone-950 shadow-lg" : "text-white/50 hover:bg-white/[0.06] hover:text-white" : isActive ? "bg-[#f2d2c1] text-[#342119] shadow-[0_10px_30px_rgba(0,0,0,.12)]" : "text-white/48 hover:bg-white/[0.06] hover:text-white"}`}><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.055] transition group-hover:bg-white/[0.08]">{icon}</span><span className="truncate">{label}</span></NavLink>;
}

function CompanyJobsNav({ open, onToggle, onNavigate }: { open: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const location = useLocation();
  const active = location.pathname.startsWith("/company/vagas") || location.pathname.startsWith("/company/talentos");
  const children = [
    { to: "/company/vagas", label: "Minhas vagas", description: "Gerenciar oportunidades", icon: <Briefcase className="h-4 w-4" />, end: true },
    { to: "/company/vagas/nova", label: "Publicar vaga", description: "Criar uma oportunidade", icon: <Plus className="h-4 w-4" /> },
    { to: "/company/vagas/convites", label: "Convites", description: "Recrutamento reservado", icon: <MailPlus className="h-4 w-4" /> },
    { to: "/company/talentos", label: "Banco de talentos", description: "Encontrar profissionais", icon: <UserRoundSearch className="h-4 w-4" /> },
  ];
  return <div>
    <div className={`flex items-center rounded-2xl transition ${active ? "bg-white text-stone-950 shadow-lg" : "text-white/50 hover:bg-white/[0.06] hover:text-white"}`}>
      <NavLink to="/company/vagas" onClick={onNavigate} className="group flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-semibold"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? "bg-stone-100 text-terracotta-700" : "bg-white/[0.055]"}`}><UsersRound className="h-5 w-5" /></span><span className="truncate">Talentos</span></NavLink>
      <button type="button" onClick={onToggle} className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" aria-label={open ? "Fechar submenu de vagas" : "Abrir submenu de vagas"}><ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></button>
    </div>
    {open && <div className="ml-4 mt-2 space-y-1.5 border-l border-white/10 pl-3">{children.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `group/sub flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${isActive ? "border-white/10 bg-white/[0.11] text-white shadow-sm" : "border-transparent text-white/42 hover:border-white/[0.06] hover:bg-white/[0.055] hover:text-white/85"}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[#efb89c] transition group-hover/sub:bg-white/[0.09]">{item.icon}</span><span className="min-w-0"><span className="block truncate text-xs font-bold">{item.label}</span><span className="mt-0.5 block truncate text-[9px] font-medium text-white/28">{item.description}</span></span></NavLink>)}</div>}
  </div>;
}

function MobileNavLink({ to, label, icon, end = false, company }: NavItem & { company: boolean; key?: React.Key }) {
  return <NavLink to={to} end={end} className={({ isActive }) => `flex min-w-12 flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 text-[9px] font-semibold transition ${company ? isActive ? "text-terracotta-700" : "text-stone-400" : isActive ? "bg-white/[0.08] text-[#f2c5ad]" : "text-white/38"}`}>{icon}<span>{label.replace("Banco de talentos", "Talentos").replace("Encontrar vagas", "Vagas").replace("Meu currículo", "Currículo").replace("Perfil profissional", "Perfil")}</span></NavLink>;
}
