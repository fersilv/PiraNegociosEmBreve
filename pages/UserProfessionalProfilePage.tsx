import React from "react";
import { BriefcaseBusiness, FileText, Sparkles, UserRoundSearch } from "lucide-react";
import { ProfilePage } from "./ProfilePage";

export function UserProfessionalProfilePage() {
  return (
    <div className="user-professional-profile mx-auto max-w-5xl space-y-6">
      <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.19em] text-terracotta-600">Carreira · Perfil profissional</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-950 sm:text-4xl">Seu perfil profissional</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Aqui fica o que apresenta sua trajetória para oportunidades e empresas: resumo, experiência, formação, competências e currículo.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-[#5b4030]/10 bg-white/65 p-2 shadow-sm">
          <Signal icon={<BriefcaseBusiness className="h-4 w-4" />} label="Experiência" />
          <Signal icon={<Sparkles className="h-4 w-4" />} label="Competências" />
          <Signal icon={<FileText className="h-4 w-4" />} label="Currículo" />
        </div>
      </header>

      <div className="professional-profile-legacy-shell">
        <style>{`
          .professional-profile-legacy-shell > .max-w-4xl > div:first-child { display:none !important; }
          .professional-profile-legacy-shell div.bg-gradient-to-br.from-stone-900.to-stone-950.text-white.rounded-3xl { display:none !important; }
          .professional-profile-legacy-shell form > div.space-y-6:first-child { display:none !important; }
          .professional-profile-legacy-shell > .max-w-4xl { max-width:none !important; margin:0 !important; }
          .professional-profile-legacy-shell > .max-w-4xl > .bg-white.rounded-3xl { border-radius:28px !important; border-color:#ddcfc3 !important; background:#fffdfa !important; box-shadow:0 18px 55px rgba(66,43,28,.055) !important; }
        `}</style>
        <ProfilePage />
      </div>
    </div>
  );
}

function Signal({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-w-24 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-center text-stone-500">
      <span className="text-terracotta-600">{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}
