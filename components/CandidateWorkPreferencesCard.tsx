import React, { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Car,
  Check,
  FileCheck2,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { CityStateSelector } from "./CityStateSelector";
import { useAuth } from "../contexts/AuthContext";
import type {
  JobPreferences,
  PcdDeclaration,
  PcdDocumentationStatus,
  WorkLocationPreference,
} from "../contexts/AuthContext";
import { api } from "../lib/api";

const LICENSE_CATEGORIES = ["ACC", "A", "B", "C", "D", "E"];
const VEHICLE_TYPES = ["Carro", "Moto", "Caminhão", "Utilitário", "Outro"];

type LocationNotice = { tone: "success" | "info" | "error"; text: string } | null;

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
  const [locationNotice, setLocationNotice] = useState<LocationNotice>(null);
  const [hasDriverLicense, setHasDriverLicense] = useState<boolean | null>(null);
  const [driverLicenseCategories, setDriverLicenseCategories] = useState<string[]>([]);
  const [hasOwnVehicle, setHasOwnVehicle] = useState<boolean | null>(null);
  const [ownVehicles, setOwnVehicles] = useState<string[]>([]);
  const [includeExclusivePcdJobs, setIncludeExclusivePcdJobs] = useState(false);
  const [pcdDeclaration, setPcdDeclaration] = useState<PcdDeclaration>("NOT_INFORMED");
  const [pcdDocumentationStatus, setPcdDocumentationStatus] = useState<PcdDocumentationStatus>("NOT_INFORMED");
  const [pcdDataConsent, setPcdDataConsent] = useState(false);
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
    setPcdDeclaration(preferences.pcdDeclaration || "NOT_INFORMED");
    setPcdDocumentationStatus(preferences.pcdDocumentationStatus || "NOT_INFORMED");
    setPcdDataConsent(Boolean(preferences.pcdDataConsent));
  }, [profile]);

  const home = useMemo(() => parseLocation(homeLocation), [homeLocation]);

  const addPreferredLocation = () => {
    const next = parseLocation(pendingLocation);
    if (!next) {
      setLocationNotice({
        tone: "error",
        text: "Escolha o estado e a cidade antes de adicionar.",
      });
      return;
    }

    if (home && sameLocation(home, next)) {
      setLocationNotice({
        tone: "info",
        text: `${locationLabel(next)} já é sua cidade principal e já entra automaticamente nos seus matches.`,
      });
      setPendingLocation("");
      return;
    }

    if (preferredLocations.some((item) => sameLocation(item, next))) {
      setLocationNotice({
        tone: "info",
        text: `${locationLabel(next)} já está na sua lista de cidades aceitas.`,
      });
      setPendingLocation("");
      return;
    }

    setPreferredLocations((current) => [...current, next]);
    setPendingLocation("");
    setLocationNotice({
      tone: "success",
      text: `${locationLabel(next)} adicionada. Clique em “Salvar preferências” para confirmar as alterações.`,
    });
  };

  const toggleListValue = (
    value: string,
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const changePcdDeclaration = (value: PcdDeclaration) => {
    setPcdDeclaration(value);
    setPcdDataConsent(false);
    if (value !== "YES") {
      setPcdDocumentationStatus("NOT_INFORMED");
      setIncludeExclusivePcdJobs(false);
    }
    if (value === "NOT_INFORMED") {
      setPcdDataConsent(false);
    }
  };

  const save = async () => {
    const parsedHome = parseLocation(homeLocation);
    if (!parsedHome) {
      alert("Informe a cidade onde você mora.");
      return;
    }
    if (pcdDeclaration !== "NOT_INFORMED" && !pcdDataConsent) {
      alert("Para salvar a autodeclaração PCD, confirme o consentimento destacado sobre o tratamento desse dado sensível.");
      return;
    }

    const normalizedPreferredLocations = preferredLocations.filter(
      (item) => !sameLocation(item, parsedHome),
    );

    setSaving(true);
    setSaved(false);
    try {
      const jobPreferences: JobPreferences = {
        preferredLocations: normalizedPreferredLocations,
        hasDriverLicense,
        driverLicenseCategories: hasDriverLicense ? driverLicenseCategories : [],
        hasOwnVehicle,
        ownVehicles: hasOwnVehicle ? ownVehicles : [],
        includeExclusivePcdJobs:
          pcdDeclaration === "YES" ? includeExclusivePcdJobs : false,
        pcdDeclaration,
        pcdDocumentationStatus:
          pcdDeclaration === "YES" ? pcdDocumentationStatus : "NOT_INFORMED",
        pcdDataConsent: pcdDeclaration === "NOT_INFORMED" ? false : pcdDataConsent,
      };
      await api.patch("/users/me", {
        city: parsedHome.city,
        state: parsedHome.state,
        address: locationLabel(parsedHome),
        jobPreferences,
      });
      setPreferredLocations(normalizedPreferredLocations);
      await refreshProfile();
      setSaved(true);
      setLocationNotice({ tone: "success", text: "Preferências profissionais salvas." });
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
              Esses dados deixam os matches mais realistas e ajudam o sistema a respeitar onde e como você pode trabalhar.
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
            <CityStateSelector
              initialValue={homeLocation}
              onLocationChange={(value) => {
                setHomeLocation(value);
                setLocationNotice(null);
              }}
            />
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Sua cidade principal sempre é considerada como uma cidade onde você pode trabalhar e pode ser usada por empresas para filtrar candidatos.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <label className="block text-sm font-bold text-stone-800">Outras cidades onde aceita trabalhar</label>
            <p className="mb-3 mt-1 text-xs text-stone-500">Adicione quantas cidades fizerem sentido. Sua cidade principal não precisa ser adicionada novamente.</p>
            <div className="space-y-2">
              <CityStateSelector
                initialValue={pendingLocation}
                onLocationChange={(value) => {
                  setPendingLocation(value);
                  setLocationNotice(null);
                }}
              />
              <button
                type="button"
                onClick={addPreferredLocation}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800"
              >
                <Plus className="h-4 w-4" /> Adicionar cidade
              </button>
            </div>

            {locationNotice && (
              <p
                className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-semibold leading-5 ${
                  locationNotice.tone === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : locationNotice.tone === "error"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {locationNotice.text}
              </p>
            )}

            {preferredLocations.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {preferredLocations.map((location) => (
                  <span key={locationLabel(location)} className="inline-flex items-center gap-1.5 rounded-full border border-terracotta-200 bg-terracotta-50 px-3 py-1.5 text-xs font-bold text-terracotta-800">
                    <MapPin className="h-3 w-3" /> {locationLabel(location)}
                    <button
                      type="button"
                      onClick={() => {
                        setPreferredLocations((current) => current.filter((item) => !sameLocation(item, location)));
                        setLocationNotice({ tone: "info", text: `${locationLabel(location)} removida da lista. Salve para confirmar.` });
                      }}
                      className="ml-1 text-terracotta-500 hover:text-red-600"
                      aria-label={`Remover ${locationLabel(location)}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[11px] text-stone-400">Nenhuma cidade adicional cadastrada.</p>
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

          <div className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/45">
            <div className="border-b border-violet-100 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Accessibility className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-bold text-violet-950">Inclusão PCD</h3>
                  <p className="mt-1 text-xs leading-relaxed text-violet-700">
                    Informação opcional e sensível. Ela não aparece no seu currículo nem é enviada ao banco de talentos das empresas.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <p className="text-sm font-bold text-stone-900">Você se declara pessoa com deficiência (PcD)?</p>
                <p className="mt-1 text-xs text-stone-500">Você pode escolher não informar e alterar esta resposta quando quiser.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <PcdChoice active={pcdDeclaration === "YES"} onClick={() => changePcdDeclaration("YES")} label="Sim" />
                  <PcdChoice active={pcdDeclaration === "NO"} onClick={() => changePcdDeclaration("NO")} label="Não" />
                  <PcdChoice active={pcdDeclaration === "NOT_INFORMED"} onClick={() => changePcdDeclaration("NOT_INFORMED")} label="Prefiro não informar" />
                </div>
              </div>

              {pcdDeclaration === "YES" && (
                <div className="rounded-xl border border-violet-100 bg-white/80 p-4">
                  <div className="flex items-start gap-2">
                    <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-900">Você possui laudo ou documentação comprobatória?</p>
                      <p className="mt-1 text-xs leading-relaxed text-stone-500">
                        Não pedimos upload, diagnóstico ou CID. Este status não bloqueia candidatura e serve apenas para organizar sua própria disponibilidade para vagas PCD.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <DocumentChoice active={pcdDocumentationStatus === "HAS_REPORT"} onClick={() => setPcdDocumentationStatus("HAS_REPORT")} label="Sim, possuo" />
                    <DocumentChoice active={pcdDocumentationStatus === "NO_REPORT"} onClick={() => setPcdDocumentationStatus("NO_REPORT")} label="Ainda não possuo" />
                    <DocumentChoice active={pcdDocumentationStatus === "IN_PROGRESS"} onClick={() => setPcdDocumentationStatus("IN_PROGRESS")} label="Está em processo" />
                    <DocumentChoice active={pcdDocumentationStatus === "NOT_INFORMED"} onClick={() => setPcdDocumentationStatus("NOT_INFORMED")} label="Prefiro não informar" />
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3">
                    <input
                      type="checkbox"
                      checked={includeExclusivePcdJobs}
                      onChange={(event) => setIncludeExclusivePcdJobs(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-violet-700"
                    />
                    <div>
                      <p className="text-xs font-bold text-violet-950">Quero receber vagas exclusivas para PCD nas recomendações</p>
                      <p className="mt-1 text-[11px] leading-5 text-violet-700">A falta de laudo cadastrado não reduz seu match e não impede que a vaga apareça.</p>
                    </div>
                  </label>
                </div>
              )}

              {pcdDeclaration !== "NOT_INFORMED" && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-violet-200 bg-white p-3.5">
                  <input
                    type="checkbox"
                    checked={pcdDataConsent}
                    onChange={(event) => setPcdDataConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-violet-700"
                  />
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-black text-violet-950">
                      <ShieldCheck className="h-3.5 w-3.5" /> Consentimento para dado sensível
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-stone-600">
                      Autorizo o PiraNegócios a armazenar e tratar esta autodeclaração e o status da documentação para personalizar oportunidades PCD. Posso retirar essa autorização escolhendo “Prefiro não informar”.
                    </p>
                  </div>
                </label>
              )}

              <p className="text-[10px] leading-5 text-stone-500">
                Empresas podem solicitar comprovação em etapa adequada de um processo seletivo PCD. O PiraNegócios não armazena seu laudo neste campo e não usa a informação para reduzir sua visibilidade em vagas gerais.
              </p>
            </div>
          </div>
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

function PcdChoice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${active ? "border-violet-400 bg-violet-100 text-violet-900 ring-2 ring-violet-100" : "border-stone-200 bg-white text-stone-600 hover:border-violet-200"}`}
    >
      {label}
    </button>
  );
}

function DocumentChoice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${active ? "border-violet-300 bg-violet-50 text-violet-900" : "border-stone-200 bg-white text-stone-600"}`}
    >
      {label}
    </button>
  );
}
