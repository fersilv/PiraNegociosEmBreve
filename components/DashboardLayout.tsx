import React from "react";
import { useNavigate, Link, NavLink } from "react-router-dom";
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
} from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth, getGreetingName } from "../contexts/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { NotificationCenter } from "./NotificationCenter";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleLogout = () => {
    auth.signOut();
    navigate("/");
  };

  const handleResendEmail = async () => {
    if (auth.currentUser) {
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
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {auth.currentUser && !auth.currentUser.emailVerified && (
        <div className="bg-amber-100 text-amber-900 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium shrink-0">
          <MailWarning className="w-5 h-5 shrink-0" />
          <span>
            Por favor, verifique seu e-mail para confirmar seu cadastro.
          </span>
          <button
            onClick={handleResendEmail}
            className="underline font-bold hover:text-terracotta-700 ml-1"
          >
            Reenviar e-mail
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-stone-200 flex flex-col hidden md:flex">
          <div className="p-6 border-b border-stone-100">
            <Link
              to="/"
              className="font-serif font-bold text-xl text-terracotta-800"
            >
              PiraNegócios
            </Link>
            <div className="mt-2 text-xs font-bold tracking-widest text-stone-400 uppercase">
              {profile?.type === "ADMIN"
                ? "Painel Administrador"
                : profile?.type === "COMPANY"
                  ? "Painel Empresa"
                  : profile?.type === "CANDIDATE"
                    ? "Painel Candidato"
                    : "Onboarding"}
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {profile?.type === "ADMIN" && (
              <>
                <NavItem
                  end
                  to="/dashboard"
                  icon={<Home className="w-5 h-5" />}
                  label="Dashboard"
                />
                <NavItem
                  to="/dashboard/admin/empresas"
                  icon={<Building2 className="w-5 h-5" />}
                  label="Empresas"
                />
                <NavItem
                  to="/dashboard/admin/vagas"
                  icon={<Briefcase className="w-5 h-5" />}
                  label="Vagas"
                />
                <NavItem
                  to="/dashboard/admin/usuarios"
                  icon={<Users className="w-5 h-5" />}
                  label="Usuários"
                />
                <NavItem
                  to="/dashboard/admin/vinculos"
                  icon={<Link2 className="w-5 h-5" />}
                  label="Vínculos"
                />
                <NavItem
                  to="/dashboard/admin/publicidade"
                  icon={<Megaphone className="w-5 h-5" />}
                  label="Publicidade"
                />
                <NavItem
                  to="/dashboard/admin/api"
                  icon={<KeyRound className="w-5 h-5" />}
                  label="API v1"
                />
                <NavItem
                  to="/dashboard/perfil"
                  icon={<User className="w-5 h-5" />}
                  label="Meus Dados Pessoais"
                />
              </>
            )}
            {profile?.type === "COMPANY" && (
              <>
                <NavItem
                  to="/dashboard"
                  icon={<Home className="w-5 h-5" />}
                  label="Visão Geral"
                />
                <NavItem
                  to="/dashboard/vagas"
                  icon={<Briefcase className="w-5 h-5" />}
                  label="Minhas Vagas"
                />
                <NavItem
                  to="/dashboard/curriculos"
                  icon={<FileText className="w-5 h-5" />}
                  label="Banco de Currículos"
                />
                <NavItem
                  to="/dashboard/empresa"
                  icon={<Building2 className="w-5 h-5" />}
                  label="Perfil da Empresa"
                />
                <NavItem
                  to="/dashboard/configuracao-contratacao"
                  icon={<FileText className="w-5 h-5" />}
                  label="Contratação (Onboarding)"
                />
                <NavItem
                  to="/dashboard/perfil"
                  icon={<User className="w-5 h-5" />}
                  label="Meus Dados Pessoais"
                />
              </>
            )}
            {profile?.type === "CANDIDATE" && (
              <>
                <NavItem
                  to="/dashboard"
                  icon={<Home className="w-5 h-5" />}
                  label="Minhas Vagas"
                />
                <NavItem
                  to="/dashboard/perfil"
                  icon={<User className="w-5 h-5" />}
                  label="Meus Dados Pessoais"
                />
              </>
            )}
          </nav>

          <div className="p-4 border-t border-stone-100">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 text-stone-500 hover:text-stone-900 w-full px-4 py-3 rounded-xl transition-colors font-medium"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Unified Top Header Bar */}
          <header className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="font-serif font-bold text-terracotta-800 text-lg md:hidden"
              >
                PiraNegócios
              </Link>
              <div className="hidden md:block">
                <h2 className="text-sm font-medium text-stone-500">
                  Olá,{" "}
                  <span className="font-bold text-stone-900">
                    {getGreetingName(profile)}
                  </span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Real-time Notification Center */}
              <NotificationCenter />

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Content Viewport */}
          <div className="flex-1 overflow-y-auto p-6 pb-24 md:p-8">
            {children}
          </div>

          <nav
            className={`md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 px-3 py-2 flex items-center shadow-lg ${profile?.type === "ADMIN" ? "justify-start gap-2 overflow-x-auto" : "justify-around"}`}
          >
            {profile?.type === "ADMIN" ? (
              <>
                <MobileNavItem
                  end
                  to="/dashboard"
                  icon={<Home className="w-5 h-5" />}
                  label="Dashboard"
                />
                <MobileNavItem
                  to="/dashboard/admin/empresas"
                  icon={<Building2 className="w-5 h-5" />}
                  label="Empresas"
                />
                <MobileNavItem
                  to="/dashboard/admin/vagas"
                  icon={<Briefcase className="w-5 h-5" />}
                  label="Vagas"
                />
                <MobileNavItem
                  to="/dashboard/admin/usuarios"
                  icon={<Users className="w-5 h-5" />}
                  label="Usuários"
                />
                <MobileNavItem
                  to="/dashboard/admin/vinculos"
                  icon={<Link2 className="w-5 h-5" />}
                  label="Vínculos"
                />
                <MobileNavItem
                  to="/dashboard/admin/publicidade"
                  icon={<Megaphone className="w-5 h-5" />}
                  label="Publicidade"
                />
                <MobileNavItem
                  to="/dashboard/admin/api"
                  icon={<KeyRound className="w-5 h-5" />}
                  label="API"
                />
                <MobileNavItem
                  to="/dashboard/perfil"
                  icon={<User className="w-5 h-5" />}
                  label="Perfil"
                />
              </>
            ) : (
              <>
                <MobileNavItem
                  end
                  to="/dashboard"
                  icon={<Home className="w-5 h-5" />}
                  label="Início"
                />
                {profile?.type === "COMPANY" && (
                  <MobileNavItem
                    to="/dashboard/vagas"
                    icon={<Briefcase className="w-5 h-5" />}
                    label="Vagas"
                  />
                )}
                {profile?.type === "COMPANY" && (
                  <MobileNavItem
                    to="/dashboard/curriculos"
                    icon={<FileText className="w-5 h-5" />}
                    label="Currículos"
                  />
                )}
                {profile?.type === "COMPANY" && (
                  <MobileNavItem
                    to="/dashboard/empresa"
                    icon={<Building2 className="w-5 h-5" />}
                    label="Empresa"
                  />
                )}
                <MobileNavItem
                  to="/dashboard/perfil"
                  icon={<User className="w-5 h-5" />}
                  label="Perfil"
                />
              </>
            )}
          </nav>
        </main>
      </div>
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
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${isActive ? "bg-terracotta-50 text-terracotta-800" : "text-stone-600 hover:bg-stone-50 hover:text-terracotta-700"}`
      }
    >
      {icon}
      {label}
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
        `min-w-14 flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold ${isActive ? "text-terracotta-700" : "text-stone-600"}`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
