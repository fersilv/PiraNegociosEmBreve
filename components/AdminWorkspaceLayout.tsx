import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  AlertTriangle,
  BellRing,
  Briefcase,
  Building2,
  Cpu,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  MoreHorizontal,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { NotificationCenter } from "./NotificationCenter";
import { AdminTheme } from "./AdminTheme";

type AdminNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const groups: AdminNavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { to: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/admin/empresas", label: "Empresas", icon: <Building2 className="h-4 w-4" /> },
      { to: "/admin/vagas", label: "Vagas", icon: <Briefcase className="h-4 w-4" />, end: true },
      { to: "/admin/vagas/sinalizadas", label: "Sinalizadas", icon: <AlertTriangle className="h-4 w-4" /> },
      { to: "/admin/usuarios", label: "Usuários", icon: <Users className="h-4 w-4" /> },
      { to: "/admin/vinculos", label: "Vínculos", icon: <Link2 className="h-4 w-4" /> },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { to: "/admin/cadastros", label: "Novos cadastros", icon: <UserPlus className="h-4 w-4" /> },
      { to: "/admin/notificacoes", label: "Notificações", icon: <BellRing className="h-4 w-4" /> },
      { to: "/admin/publicidade", label: "Publicidade", icon: <Megaphone className="h-4 w-4" /> },
      { to: "/admin/api", label: "API v1", icon: <KeyRound className="h-4 w-4" /> },
      { to: "/admin/ai", label: "Inteligência Artificial", icon: <Cpu className="h-4 w-4" /> },
    ],
  },
  {
    label: "Conta",
    items: [
      { to: "/admin/conta", label: "Meus dados", icon: <User className="h-4 w-4" /> },
    ],
  },
];

export function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);

  const logout = async () => {
    await auth.signOut();
    window.location.replace("/");
  };

  return (
    <div className="admin-workspace min-h-screen bg-[#f4f3ef] text-stone-900">
      <AdminTheme />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[286px] flex-col border-r border-white/[0.05] bg-[#171714] text-white md:flex">
        <div className="px-5 pb-5 pt-6">
          <Link to="/" className="inline-flex max-w-[205px] items-center">
            <img src="/brand/logo-horizontal-white.png" alt="PiraNegócios" className="h-8 w-auto max-w-full object-contain object-left" />
          </Link>
          <div className="mt-5 rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta-500/15 text-terracotta-300 ring-1 ring-terracotta-400/20">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Central de operação</p>
                <p className="mt-0.5 text-sm font-bold text-white">Administração</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-[11px] text-white/55">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Plataforma operacional
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 pt-5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/25 first:pt-1">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        isActive
                          ? "bg-white text-stone-950 shadow-[0_8px_30px_rgba(0,0,0,.18)]"
                          : "text-white/50 hover:bg-white/[0.055] hover:text-white"
                      }`
                    }
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.055]">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.05] p-4">
          <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium text-white/45 transition hover:bg-white/[0.06] hover:text-white">
            <LogOut className="h-5 w-5" /> Sair
          </button>
        </div>
      </aside>

      <div className="min-h-screen md:pl-[286px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-stone-200/80 bg-[#f4f3ef]/92 px-4 backdrop-blur-xl md:px-7">
          <div className="flex items-center gap-3">
            <span className="hidden h-9 w-9 items-center justify-center md:flex">
              <img src="/brand/symbol-terracotta.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400">Operação</p>
              <p className="text-sm font-bold text-stone-900">PiraNegócios Control Center</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-bold text-stone-600 shadow-sm lg:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online
            </div>
            <NotificationCenter />
            <Link to="/admin/conta" className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm" title="Meus dados">
              <User className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main className="admin-content p-4 pb-24 sm:p-6 md:p-8 md:pb-8">{children}</main>
      </div>

      <nav
        className="admin-mobile-nav fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-white/[0.08] px-2 pt-2 text-white shadow-[0_-12px_36px_rgba(0,0,0,.22)] md:hidden"
        style={{ backgroundColor: "#171714", color: "#ffffff", paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))" }}
      >
        <MobileLink to="/admin" end icon={<LayoutDashboard className="h-5 w-5" />} label="Início" />
        <MobileLink to="/admin/empresas" icon={<Building2 className="h-5 w-5" />} label="Empresas" />
        <MobileLink to="/admin/vagas" end icon={<Briefcase className="h-5 w-5" />} label="Vagas" />
        <MobileLink to="/admin/usuarios" icon={<Users className="h-5 w-5" />} label="Usuários" />
        <button type="button" onClick={() => setMoreOpen(true)} className="flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-semibold text-white/60">
          <MoreHorizontal className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-sm md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="w-full rounded-t-[30px] bg-[#1d1d19] p-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Administração</p>
                <h3 className="mt-1 text-lg font-bold">Mais ferramentas</h3>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MoreLink to="/admin/cadastros" icon={<UserPlus className="h-4 w-4" />} label="Novos cadastros" close={() => setMoreOpen(false)} />
              <MoreLink to="/admin/notificacoes" icon={<BellRing className="h-4 w-4" />} label="Notificações" close={() => setMoreOpen(false)} />
              <MoreLink to="/admin/vagas/sinalizadas" icon={<AlertTriangle className="h-4 w-4" />} label="Vagas sinalizadas" close={() => setMoreOpen(false)} />
              <MoreLink to="/admin/vinculos" icon={<Link2 className="h-4 w-4" />} label="Vínculos" close={() => setMoreOpen(false)} />
              <MoreLink to="/admin/publicidade" icon={<Megaphone className="h-4 w-4" />} label="Publicidade" close={() => setMoreOpen(false)} />
              <MoreLink to="/admin/api" icon={<KeyRound className="h-4 w-4" />} label="API v1" close={() => setMoreOpen(false)} />
              <MoreLink to="/admin/ai" icon={<Cpu className="h-4 w-4" />} label="Inteligência Artificial" close={() => setMoreOpen(false)} />
              <MoreLink to="/admin/conta" icon={<User className="h-4 w-4" />} label="Meus dados" close={() => setMoreOpen(false)} />
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/10 bg-red-400/[0.08] px-4 py-3.5 text-sm font-bold text-red-200"
            >
              <LogOut className="h-4 w-4" /> Sair da conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileLink({ to, label, icon, end = false }: { to: string; label: string; icon: React.ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-semibold ${isActive ? "bg-white/[0.08] text-[#f2c5ad]" : "text-white/55"}`}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function MoreLink({ to, label, icon, close }: { to: string; label: string; icon: React.ReactNode; close: () => void }) {
  return (
    <Link to={to} onClick={close} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.045] p-3 text-sm font-bold text-white/75">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06]">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}