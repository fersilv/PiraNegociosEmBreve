import React, { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Car,
  Check,
  Loader2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import { CityStateSelector } from "./CityStateSelector";
import { JobPreferences, WorkLocationPreference, useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

const LICENSE_CATEGORIES = ["ACC", "A", "B", "C", "D", "E"];
const VEHICLE_TYPES = ["Carro", "Moto", "Caminhão", "Utilitário", "Outro"];

function parseLocation(value: string): WorkLocationPreference | null {
  const parts = value.split(",").map((item) => item.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { city: parts[0], state: parts[1].toUpperCase().slice(0, 2) };
}

function locationLabel(location: WorkLocationPreference) {
  return `${location.city}, ${location.state}`;
}

function sameLocation(a: WorkLocationPreference, b: WorkLocationPreference) {
  return (
    a.city.localeCompare(b.city, "pt-BR", { sensitivity: "base" }) === 0 &&
    a.state.toUpperCase() === b.state.toUpperCase()
  );
}

export function CandidateWorkPreferencesCard() {
  const { profile, refreshProfile } = useAuth();
  const [homeLocation, setHomeLocation] = useState("");
  const [pendingLocation, setPendingLocation] = useState("");
  const [preferredLocations, setPreferredLocations] = useState<WorkLocationPreference[]>([]);
  const [hasDriverLicense, setHasDriverLicense] = useState<boolean | null>(null);
  const [driverLicenseCategories, setDriverLicenseCategories] = useState<string[]>([]);
  const [hasOwnVehicle, setHasOwnVehicle] = useState<boolean | null>(null);
  const [ownVehicles, setOwnVehicles] = useState<string[]>([]);
  const [includeExclusivePcdJobs, setIncludeExclusivePcdJobs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const fallbackAddress = profile.address || "";
    const explicitHome =
      profile.city && profile.state ? `${profile.city}, ${profile.state}` : fallbackAddress;
    setHomeLocation(explicitHome);
    const preferences = profile.jobPreferences || {};
    setPreferredLocations(preferences.preferredLocations || []);
    setHasDriverLicense(preferences.hasDriverLicense ?? null);
    setDriverLicenseCategories(preferences.driverLicenseCategories || []);
    setHasOwnVehicle(preferences.hasOwnVehicle ?? null);
    setOwnVehicles(preferences.ownVehicles || []);
    setIncludeExclusivePcdJobs(Boolean(preferences.includeExclusivePcdJobs));
  }, [profile]);

  const home = useMemo(() => parseLocation(homeLocation), [homeLocation]);

  const addPreferredLocation = () => {
    const next = parseLocation(pendingLocation);
    if (!next) return;
    if (home && sameLocation(home, next)) {
      setPendingLocation("");
      return;
    }
    setPreferredLocations((current) =>
      current.some((item) => sameLocation(item, next)) ? current : [...current, next],
    );
    setPendingLocation("");
  };

  const toggleListValue = (
    value: string,
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const save = async () => {
    const parsedHome = parseLocation(homeLocation);
    if (!parsedHome) {
      alert("Informe a cidade onde você mora.");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const jobPreferences: JobPreferences = {
        preferredLocations,
        hasDriverLicense,
        driverLicenseCategories: hasDriverLicense ? driverLicenseCategories : [],
        hasOwnVehicle,
        ownVehicles: hasOwnVehicle ? ownVehicles : [],
        includeExclusivePcdJobs,
      };
      await api.patch("/users/me", {
        city: parsedHome.city,
        state: parsedHome.state,
        address: locationLabel(parsedHome),
        jobPreferences,
      });
      await refreshProfile();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error("Erro ao salvar preferências profissionais:", error);
      alert("Não foi possível salvar suas preferências agora.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile || profile.type === "ADMIN") return null;

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#ddcfc3] bg-[#fffdfa] shadow-[0_22px_60px_rgba(66,43,28,.07)]">
      <div className="border-b border-[#eadfd6] bg-gradient-to-r from-[#2b211c] to-[#3a2b24] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.19em] text-[#f0b99d]">Preferências profissionais</p>
            <h2 className="mt-1 font-serif text-2xl font-bold">Mobilidade e disponibilidade</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">
              Esses dados deixam os matches mais realistas e ajudam empresas a encontrar pessoas disponíveis na região certa.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/55">
            <MapPin className="h-4 w-4 text-[#f0b99d]" />
            {home ? `Mora em ${locationLabel(home)}` : "Informe onde você mora"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-stone-800">Cidade onde você mora *</label>
            <CityStateSelector initialValue={homeLocation} onLocationChange={setHomeLocation} />
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Esta é sua localização principal e pode ser usada por empresas para filtrar candidatos.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <label className="block text-sm font-bold text-stone-800">Outras cidades onde aceita trabalhar</label>
            <p className="mb-3 mt-1 text-xs text-stone-500">Você pode cadastrar quantas cidades fizerem sentido para sua rotina.</p>
            <div className="space-y-2">
              <CityStateSelector initialValue={pendingLocation} onLocationChange={setPendingLocation} />
              <button
                type="button"
                onClick={addPreferredLocation}
                disabled={!pendingLocation}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> Adicionar cidade
              </button>
            </div>
            {preferredLocations.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {preferredLocations.map((location) => (
                  <span key={locationLabel(location)} className="inline-flex items-center gap-1.5 rounded-full border border-terracotta-200 bg-terracotta-50 px-3 py-1.5 text-xs font-bold text-terracotta-800">
                    <MapPin className="h-3 w-3" /> {locationLabel(location)}
                    <button type="button" onClick={() => setPreferredLocations((current) => current.filter((item) => !sameLocation(item, location)))} className="ml-1 text-terracotta-500 hover:text-red-600" aria-label={`Remover ${locationLabel(location)}`}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <PreferenceQuestion
            icon={<Car className="h-5 w-5" />}
            title="Você possui CNH?"
            value={hasDriverLicense}
            onChange={(value) => {
              setHasDriverLicense(value);
              if (!value) setDriverLicenseCategories([]);
            }}
          >
            {hasDriverLicense && (
              <ChipSelector values={LICENSE_CATEGORIES} selected={driverLicenseCategories} onToggle={(value) => toggleListValue(value, driverLicenseCategories, setDriverLicenseCategories)} />
            )}
          </PreferenceQuestion>

          <PreferenceQuestion
            icon={<Car className="h-5 w-5" />}
            title="Possui veículo próprio?"
            value={hasOwnVehicle}
            onChange={(value) => {
              setHasOwnVehicle(value);
              if (!value) setOwnVehicles([]);
            }}
          >
            {hasOwnVehicle && (
              <ChipSelector values={VEHICLE_TYPES} selected={ownVehicles} onToggle={(value) => toggleListValue(value, ownVehicles, setOwnVehicles)} />
            )}
          </PreferenceQuestion>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <input type="checkbox" checked={includeExclusivePcdJobs} onChange={(event) => setIncludeExclusivePcdJobs(event.target.checked)} className="mt-1 h-4 w-4 rounded border-violet-300" />
            <div>
              <div className="flex items-center gap-2 font-bold text-violet-950"><Accessibility className="h-4 w-4" /> Incluir vagas exclusivas para PCD</div>
              <p className="mt-1 text-xs leading-relaxed text-violet-700">
                Opção voluntária. Não pedimos diagnóstico nem detalhes médicos; ela apenas controla quais oportunidades aparecem nas recomendações.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-[#eadfd6] bg-[#fbf7f2] px-5 py-4 sm:px-6">
        {saved && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><Check className="h-4 w-4" /> Salvo</span>}
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#2b211c] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#3a2b24] disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar preferências
        </button>
      </div>
    </section>
  );
}

function PreferenceQuestion({ icon, title, value, onChange, children }: { icon: React.ReactNode; title: string; value: boolean | null; onChange: (value: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 font-bold text-stone-900">{icon}{title}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange(true)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${value === true ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-stone-200 text-stone-500"}`}>Sim</button>
        <button type="button" onClick={() => onChange(false)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${value === false ? "border-stone-500 bg-stone-100 text-stone-800" : "border-stone-200 text-stone-500"}`}>Não</button>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function ChipSelector({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <button key={value} type="button" onClick={() => onToggle(value)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected.includes(value) ? "border-terracotta-300 bg-terracotta-50 text-terracotta-800" : "border-stone-200 bg-white text-stone-500"}`}>
          {value}
        </button>
      ))}
    </div>
  );
}
