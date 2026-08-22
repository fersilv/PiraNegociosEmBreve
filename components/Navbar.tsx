import React from "react";
import { BriefcaseBusiness, Menu, User, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export function Navbar() {
  const { user, profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const workspacePath =
    profile?.type === "ADMIN"
      ? "/admin"
      : profile?.companyId
        ? "/company"
        : "/user";

  return (
    <header className="sticky top-0 z-50 border-b border-[#4b3328]/10 bg-[#fffaf5]/90 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-3">
          <img
            src="/brand/symbol-terracotta.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 shrink-0 object-contain transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.03]"
          />
          <span>
            <span className="block font-serif text-xl font-bold leading-none text-[#2d211c]">
              PiraNegócios
            </span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.2em] text-[#ad6e50]">
              Trabalho & talentos da região
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            to="/vagas"
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[#5e4a40] transition hover:bg-[#f2e8df] hover:text-[#2d211c]"
          >
            Encontrar vagas
          </Link>
          <a
            href="/#como-funciona"
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[#5e4a40] transition hover:bg-[#f2e8df] hover:text-[#2d211c]"
          >
            Como funciona
          </a>
          <a
            href="/#empresas"
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[#5e4a40] transition hover:bg-[#f2e8df] hover:text-[#2d211c]"
          >
            Para empresas
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link
              to={workspacePath}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2d211c] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1f1714]"
            >
              <User className="h-4 w-4" />
              Meu espaço
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#4f3b31] transition hover:bg-[#f2e8df]"
              >
                Entrar
              </Link>
              <Link
                to="/login?returnTo=%2Fuser%2Fcurriculo"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#c96847] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(201,104,71,.22)] transition hover:-translate-y-0.5 hover:bg-[#b75d3f]"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                Criar currículo
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4b3328]/10 bg-white text-[#4f3b31] md:hidden"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#4b3328]/10 bg-[#fffaf5] px-4 py-4 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            <Link onClick={() => setMobileOpen(false)} to="/vagas" className="rounded-xl px-3 py-3 text-sm font-bold text-[#4f3b31] hover:bg-[#f2e8df]">
              Encontrar vagas
            </Link>
            <a onClick={() => setMobileOpen(false)} href="/#como-funciona" className="rounded-xl px-3 py-3 text-sm font-bold text-[#4f3b31] hover:bg-[#f2e8df]">
              Como funciona
            </a>
            <a onClick={() => setMobileOpen(false)} href="/#empresas" className="rounded-xl px-3 py-3 text-sm font-bold text-[#4f3b31] hover:bg-[#f2e8df]">
              Para empresas
            </a>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#4b3328]/10 pt-3">
              {user ? (
                <Link onClick={() => setMobileOpen(false)} to={workspacePath} className="col-span-2 rounded-xl bg-[#2d211c] px-4 py-3 text-center text-sm font-bold text-white">
                  Meu espaço
                </Link>
              ) : (
                <>
                  <Link onClick={() => setMobileOpen(false)} to="/login" className="rounded-xl border border-[#4b3328]/10 bg-white px-4 py-3 text-center text-sm font-bold text-[#4f3b31]">
                    Entrar
                  </Link>
                  <Link onClick={() => setMobileOpen(false)} to="/login?returnTo=%2Fuser%2Fcurriculo" className="rounded-xl bg-[#c96847] px-4 py-3 text-center text-sm font-bold text-white">
                    Criar currículo
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
