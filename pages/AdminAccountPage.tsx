import React from "react";
import { ShieldCheck, UserCog } from "lucide-react";
import { ProfilePage } from "./ProfilePage";

export function AdminAccountPage() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6 admin-standalone-page admin-account-page">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
          Conta · Administração
        </p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-serif font-bold text-stone-900">
          <UserCog className="h-7 w-7" /> Meus dados
        </h1>
        <p className="mt-1 max-w-3xl text-stone-500">
          Dados da sua conta administrativa, identificação e canais de contato.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="admin-account-profile">
          <style>{`
            .admin-account-profile .max-w-4xl {
              max-width: none !important;
              margin: 0 !important;
              padding-bottom: 0 !important;
            }
            .admin-account-profile .max-w-4xl > div:first-child {
              display: none !important;
            }
          `}</style>
          <ProfilePage />
        </div>

        <aside className="h-fit rounded-[22px] border border-stone-200 bg-[#fffdfa] p-5 shadow-[0_12px_34px_rgba(38,33,29,.05)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-950 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-sm font-bold text-stone-900">
            Conta administrativa
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            Alterações de dados pessoais não modificam suas permissões administrativas. Papéis e vínculos continuam controlados pelo servidor.
          </p>
          <div className="mt-4 rounded-2xl bg-stone-100 px-3 py-3 text-[11px] leading-relaxed text-stone-600">
            Para segurança, o e-mail de autenticação permanece controlado pelo provedor de login.
          </div>
        </aside>
      </section>
    </div>
  );
}