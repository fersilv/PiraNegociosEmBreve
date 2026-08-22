import React from "react";
import { Briefcase, MapPin, SlidersHorizontal } from "lucide-react";
import { CandidateWorkPreferencesCard } from "../components/CandidateWorkPreferencesCard";

export function UserPreferencesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.19em] text-terracotta-600">
            Carreira · Preferências profissionais
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-950 sm:text-4xl">
            Onde e como você quer trabalhar
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Separe seus dados pessoais das condições que tornam uma oportunidade realmente viável para você.
            Cidade, mobilidade, CNH, veículo e preferências PCD entram aqui e alimentam seus matches.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-[#5b4030]/10 bg-white/65 p-2 shadow-sm">
          <MiniSignal icon={<MapPin className="h-4 w-4" />} label="Localização" />
          <MiniSignal icon={<Briefcase className="h-4 w-4" />} label="Mobilidade" />
          <MiniSignal icon={<SlidersHorizontal className="h-4 w-4" />} label="Preferências" />
        </div>
      </header>

      <CandidateWorkPreferencesCard />
    </div>
  );
}

function MiniSignal({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-w-24 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-center text-stone-500">
      <span className="text-terracotta-600">{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}
