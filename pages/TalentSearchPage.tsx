import React, { useEffect, useMemo, useState } from "react";
import {
  Car,
  FileText,
  FolderPlus,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Send,
  UserRoundSearch,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api, asArray } from "../lib/api";
import { CandidateProfileModal } from "../components/CandidateProfileModal";

const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const locationLabel = (item: any) => item?.city && item?.state ? `${item.city}, ${item.state}` : "";

export function TalentSearchPage() {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [companyJobs, setCompanyJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyVerified, setCompanyVerified] = useState<boolean | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [inviteJobId, setInviteJobId] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [query, setQuery] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [acceptedCity, setAcceptedCity] = useState("");
  const [license, setLicense] = useState("TODOS");
  const [licenseCategory, setLicenseCategory] = useState("TODAS");
  const [vehicle, setVehicle] = useState("TODOS");
  const [vehicleType, setVehicleType] = useState("TODOS");

  const load = async () => {
    if (!profile?.companyId) {
      setCompanyVerified(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const companyResponse = await api.get(`/companies/${profile.companyId}`);
      const verified = Boolean(companyResponse.data?.isVerified || companyResponse.data?.verificationStatus === "VERIFIED");
      setCompanyVerified(verified);
      if (!verified) return;
      const [candidateResponse, folderResponse, jobsResponse] = await Promise.all([
        api.get("/candidates"),
        api.get(`/companies/${profile.companyId}/talent-folders`),
        api.get(`/companies/${profile.companyId}/talent-jobs`),
      ]);
      setCandidates(asArray(candidateResponse.data));
      setFolders(asArray(folderResponse.data));
      setCompanyJobs(asArray(jobsResponse.data));
    } catch (error) {
      console.error("Erro ao carregar banco de talentos:", error);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [profile?.companyId]);

  const availableHomeCities = useMemo(
    () => Array.from(new Set<string>(
      candidates
        .map((candidate) => candidate.city && candidate.state ? `${candidate.city}, ${candidate.state}` : "")
        .filter((value): value is string => Boolean(value)),
    )).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [candidates],
  );
  const availableAcceptedCities = useMemo(
    () => Array.from(new Set<string>(
      candidates
        .flatMap((candidate) => (candidate.jobPreferences?.preferredLocations || []).map(locationLabel))
        .filter((value): value is string => Boolean(value)),
    )).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [candidates],
  );

  const filtered = useMemo(() => candidates.filter((candidate) => {
    const searchable = normalize([
      candidate.name,
      candidate.fullName,
      candidate.socialName,
      candidate.bio,
      ...(candidate.skills || []),
      ...(candidate.experiences || []).flatMap((experience: any) => [experience.role, experience.company, experience.description]),
      ...(candidate.courses || []).map((course: any) => course.name),
    ].filter(Boolean).join(" "));
    if (query && !searchable.includes(normalize(query))) return false;
    const candidateHome = candidate.city && candidate.state ? `${candidate.city}, ${candidate.state}` : candidate.address || "";
    if (homeCity && normalize(candidateHome) !== normalize(homeCity)) return false;
    const preferred = candidate.jobPreferences?.preferredLocations || [];
    if (acceptedCity && !preferred.some((item: any) => normalize(locationLabel(item)) === normalize(acceptedCity))) return false;
    const prefs = candidate.jobPreferences || {};
    if (license === "SIM" && prefs.hasDriverLicense !== true) return false;
    if (license === "NAO" && prefs.hasDriverLicense !== false) return false;
    if (licenseCategory !== "TODAS" && !(prefs.driverLicenseCategories || []).includes(licenseCategory)) return false;
    if (vehicle === "SIM" && prefs.hasOwnVehicle !== true) return false;
    if (vehicle === "NAO" && prefs.hasOwnVehicle !== false) return false;
    if (vehicleType !== "TODOS" && !(prefs.ownVehicles || []).includes(vehicleType)) return false;
    return true;
  }), [candidates, query, homeCity, acceptedCity, license, licenseCategory, vehicle, vehicleType]);

  const createFolder = async () => {
    if (!profile?.companyId || !newFolder.trim()) return;
    const response = await api.post(`/companies/${profile.companyId}/talent-folders`, { name: newFolder.trim() });
    setFolders((current) => [...current, response.data]);
    setNewFolder("");
  };

  const saveCandidate = async (candidateId: string) => {
    if (!profile?.companyId) return;
    await api.post(`/companies/${profile.companyId}/talent-records`, { candidateId, folderIds: selectedFolderId ? [selectedFolderId] : [] });
    alert("Candidato salvo no banco de talentos.");
  };

  const inviteCandidate = async (candidateId: string) => {
    if (!profile?.companyId || !inviteJobId) return alert("Selecione uma vaga para o convite.");
    await api.post(`/companies/${profile.companyId}/talent-invites`, { candidateId, jobId: inviteJobId });
    alert("Convite enviado ao candidato.");
  };

  if (loading || companyVerified === null) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-terracotta-600" /></div>;
  if (!profile?.companyId) return <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-stone-600">Cadastre ou vincule uma empresa para acessar o banco de talentos.</div>;
  if (!companyVerified) return <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center"><h2 className="font-serif text-2xl font-bold text-stone-950">Banco de talentos protegido</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">O acesso fica disponível para empresas verificadas. Isso protege dados profissionais e de contato dos candidatos.</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[.19em] text-terracotta-600">Recrutamento · Busca ativa</p><h1 className="mt-1 flex items-center gap-3 font-serif text-3xl font-bold text-stone-950"><UserRoundSearch className="h-8 w-8 text-terracotta-600" /> Banco de talentos</h1><p className="mt-2 max-w-3xl text-sm text-stone-500">Filtre pessoas pela trajetória e pela disponibilidade real de mobilidade, CNH e veículo.</p></div>
        <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </header>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cargo, habilidade, nome ou palavra-chave" className="w-full rounded-xl border border-stone-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-terracotta-400" /></div>
          <select value={homeCity} onChange={(e) => setHomeCity(e.target.value)} className="filter-field"><option value="">Cidade onde mora</option>{availableHomeCities.map((city) => <option key={city}>{city}</option>)}</select>
          <select value={acceptedCity} onChange={(e) => setAcceptedCity(e.target.value)} className="filter-field"><option value="">Cidade onde aceita trabalhar</option>{availableAcceptedCities.map((city) => <option key={city}>{city}</option>)}</select>
          <select value={license} onChange={(e) => setLicense(e.target.value)} className="filter-field"><option value="TODOS">CNH: todos</option><option value="SIM">Possui CNH</option><option value="NAO">Não possui CNH</option></select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select value={licenseCategory} onChange={(e) => setLicenseCategory(e.target.value)} className="filter-field"><option value="TODAS">Qualquer categoria CNH</option>{["ACC","A","B","C","D","E"].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="filter-field"><option value="TODOS">Veículo: todos</option><option value="SIM">Possui veículo</option><option value="NAO">Não possui veículo</option></select>
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="filter-field"><option value="TODOS">Qualquer veículo</option>{["Carro","Moto","Caminhão","Utilitário","Outro"].map((item) => <option key={item}>{item}</option>)}</select>
        </div>
      </section>

      <section className="grid gap-3 rounded-[24px] border border-stone-200 bg-white p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Salvar em pasta</span><select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} className="filter-field"><option value="">Banco geral</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
        <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Convidar para vaga</span><select value={inviteJobId} onChange={(e) => setInviteJobId(e.target.value)} className="filter-field"><option value="">Selecione uma vaga...</option>{companyJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
        <div className="flex gap-2"><input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Nova pasta" className="filter-field max-w-40" /><button onClick={() => void createFolder()} title="Criar pasta" className="rounded-xl bg-stone-900 px-3 text-white"><FolderPlus className="h-4 w-4" /></button></div>
      </section>

      <div className="flex items-center justify-between"><p className="text-sm text-stone-500"><strong className="text-stone-900">{filtered.length}</strong> candidatos encontrados</p></div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} onOpen={() => setSelectedCandidate(candidate)} onSave={() => void saveCandidate(candidate.id)} onInvite={() => void inviteCandidate(candidate.id)} />)}
      </section>
      {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 p-12 text-center text-sm text-stone-500">Nenhum candidato corresponde aos filtros atuais.</div>}

      <CandidateProfileModal candidate={selectedCandidate} isOpen={Boolean(selectedCandidate)} onClose={() => setSelectedCandidate(null)} />
      <style>{`.filter-field{width:100%;border:1px solid #e7e5e4;border-radius:12px;background:white;padding:11px 12px;font-size:13px;outline:none}.filter-field:focus{border-color:#c66a4b}`}</style>
    </div>
  );
}

function CandidateCard({ candidate, onOpen, onSave, onInvite }: { candidate: any; onOpen: () => void; onSave: () => void; onInvite: () => void; key?: React.Key }) {
  const prefs = candidate.jobPreferences || {};
  const home = candidate.city && candidate.state ? `${candidate.city}, ${candidate.state}` : candidate.address || "Cidade não informada";
  const preferred = prefs.preferredLocations || [];
  return <article className="flex flex-col rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md"><div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-stone-100">{candidate.photoURL ? <img src={candidate.photoURL} className="h-full w-full object-cover" alt="" /> : <UserRoundSearch className="h-5 w-5 text-stone-400" />}</div><div className="min-w-0"><h2 className="truncate font-bold text-stone-950">{candidate.name || candidate.socialName || candidate.fullName}</h2><p className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3.5 w-3.5" /> {home}</p></div></div><p className="mt-4 line-clamp-3 text-xs leading-5 text-stone-600">{candidate.bio || "Sem resumo profissional cadastrado."}</p>{candidate.skills?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{candidate.skills.slice(0, 5).map((skill: string) => <span key={skill} className="rounded-full bg-terracotta-50 px-2 py-1 text-[10px] font-bold text-terracotta-700">{skill}</span>)}</div>}<div className="mt-4 space-y-2 rounded-2xl bg-stone-50 p-3 text-[11px] text-stone-600"><div><strong>Aceita:</strong> {preferred.length ? preferred.slice(0, 3).map(locationLabel).join(" · ") : "somente localização principal / não informado"}</div><div className="flex flex-wrap gap-x-4 gap-y-1"><span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> CNH: {prefs.hasDriverLicense === true ? (prefs.driverLicenseCategories || []).join(", ") || "Sim" : prefs.hasDriverLicense === false ? "Não" : "Não informado"}</span><span className="inline-flex items-center gap-1"><Car className="h-3 w-3" /> Veículo: {prefs.hasOwnVehicle === true ? (prefs.ownVehicles || []).join(", ") || "Sim" : prefs.hasOwnVehicle === false ? "Não" : "Não informado"}</span></div></div><div className="mt-auto grid grid-cols-3 gap-2 pt-4"><button onClick={onOpen} className="rounded-xl border border-stone-200 px-2 py-2 text-[11px] font-bold text-stone-700">Perfil</button><button onClick={onSave} className="rounded-xl border border-stone-200 px-2 py-2 text-[11px] font-bold text-stone-700">Salvar</button><button onClick={onInvite} className="inline-flex items-center justify-center gap-1 rounded-xl bg-stone-900 px-2 py-2 text-[11px] font-bold text-white"><Send className="h-3 w-3" /> Convidar</button></div></article>;
}
