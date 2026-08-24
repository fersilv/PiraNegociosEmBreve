import React, { useEffect, useMemo, useState } from "react";
import {
  Car,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  FolderPlus,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Send,
  UserRoundSearch,
  UserPlus,
  Zap,
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
  const [companyInvites, setCompanyInvites] = useState<any[]>([]);
  const [jobRanking, setJobRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyVerified, setCompanyVerified] = useState<boolean | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [inviteJobId, setInviteJobId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [emailInviting, setEmailInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState("");
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
      const [candidateResponse, folderResponse, jobsResponse, invitesResponse] = await Promise.all([
        api.get("/candidates"),
        api.get(`/companies/${profile.companyId}/talent-folders`),
        api.get(`/companies/${profile.companyId}/talent-jobs`),
        api.get(`/companies/${profile.companyId}/talent-invites`),
      ]);
      setCandidates(asArray(candidateResponse.data));
      setFolders(asArray(folderResponse.data));
      setCompanyJobs(asArray(jobsResponse.data));
      setCompanyInvites(asArray(invitesResponse.data));
    } catch (error) {
      console.error("Erro ao carregar banco de talentos:", error);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [profile?.companyId]);

  useEffect(() => {
    let active = true;
    if (!inviteJobId) {
      setJobRanking([]);
      return () => { active = false; };
    }
    void api.get(`/job-match/jobs/${inviteJobId}/candidates`)
      .then((response) => {
        if (!active) return;
        setJobRanking(Array.isArray(response.data?.candidates) ? response.data.candidates : []);
      })
      .catch((error) => {
        console.error("Erro ao ordenar talentos por aderência:", error);
        if (active) setJobRanking([]);
      });
    return () => { active = false; };
  }, [inviteJobId]);

  const rankingMap = useMemo(() => new Map(jobRanking.map((item, index) => [item.candidateId, { ...item, rank: index + 1 }])), [jobRanking]);
  const selectedJobTitle = useMemo(() => companyJobs.find((job) => job.id === inviteJobId)?.title || "", [companyJobs, inviteJobId]);

  const availableHomeCities = useMemo(
    () => Array.from(new Set<string>(candidates.map((candidate) => candidate.city && candidate.state ? `${candidate.city}, ${candidate.state}` : "").filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [candidates],
  );
  const availableAcceptedCities = useMemo(
    () => Array.from(new Set<string>(candidates.flatMap((candidate) => (candidate.jobPreferences?.preferredLocations || []).map(locationLabel)).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [candidates],
  );

  const filtered = useMemo(() => {
    const result = candidates.filter((candidate) => {
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
    });

    if (inviteJobId && jobRanking.length > 0) {
      result.sort((a, b) => {
        const rankA = rankingMap.get(a.id)?.rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = rankingMap.get(b.id)?.rank ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });
    }
    return result;
  }, [candidates, query, homeCity, acceptedCity, license, licenseCategory, vehicle, vehicleType, inviteJobId, jobRanking.length, rankingMap]);

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
    const response = await api.get(`/companies/${profile.companyId}/talent-invites`);
    setCompanyInvites(asArray(response.data));
    alert("Convite enviado ao candidato.");
  };

  const inviteByEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.companyId || !inviteJobId) return alert("Selecione uma vaga para o convite.");
    if (!inviteEmail.trim()) return alert("Informe o e-mail da pessoa convidada.");
    setEmailInviting(true);
    try {
      const response = await api.post(`/companies/${profile.companyId}/talent-invites/email`, {
        email: inviteEmail.trim(),
        candidateName: inviteName.trim(),
        jobId: inviteJobId,
      });
      setLastInviteUrl(response.data?.delivery?.inviteUrl || "");
      setInviteEmail("");
      setInviteName("");
      const invitesResponse = await api.get(`/companies/${profile.companyId}/talent-invites`);
      setCompanyInvites(asArray(invitesResponse.data));
      if (response.data?.delivery?.status === "SENT") alert("Convite enviado por e-mail.");
    } catch (error: any) {
      alert(error?.response?.data?.message || "Não foi possível criar o convite.");
    } finally {
      setEmailInviting(false);
    }
  };

  const resendInvite = async (inviteId: string) => {
    if (!profile?.companyId) return;
    const response = await api.post(`/companies/${profile.companyId}/talent-invites/${inviteId}/resend`);
    setLastInviteUrl(response.data?.delivery?.inviteUrl || "");
    const invitesResponse = await api.get(`/companies/${profile.companyId}/talent-invites`);
    setCompanyInvites(asArray(invitesResponse.data));
    if (response.data?.delivery?.status === "SENT") alert("Convite reenviado por e-mail.");
  };

  if (loading || companyVerified === null) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-terracotta-600" /></div>;
  if (!profile?.companyId) return <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-stone-600">Cadastre ou vincule uma empresa para acessar o banco de talentos.</div>;
  if (!companyVerified) return <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center"><h2 className="font-serif text-2xl font-bold text-stone-950">Banco de talentos protegido</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">O acesso fica disponível para empresas verificadas. Isso protege dados profissionais e de contato dos candidatos.</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[.19em] text-terracotta-600">Recrutamento · Busca ativa</p><h1 className="mt-1 flex items-center gap-3 font-serif text-3xl font-bold text-stone-950"><UserRoundSearch className="h-8 w-8 text-terracotta-600" /> Banco de talentos</h1><p className="mt-2 max-w-3xl text-sm text-stone-500">Filtre pessoas pela trajetória e disponibilidade. Ao selecionar uma vaga, o sistema prioriza automaticamente os currículos mais aderentes.</p></div>
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
        <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Ordenar e convidar para vaga</span><select value={inviteJobId} onChange={(e) => setInviteJobId(e.target.value)} className="filter-field"><option value="">Selecione uma vaga...</option>{companyJobs.map((job) => <option key={job.id} value={job.id}>{job.isInternal ? "[Interna] " : ""}{job.title}</option>)}</select></label>
        <div className="flex gap-2"><input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Nova pasta" className="filter-field max-w-40" /><button onClick={() => void createFolder()} title="Criar pasta" className="rounded-xl bg-stone-900 px-3 text-white"><FolderPlus className="h-4 w-4" /></button></div>
      </section>

      <section className="grid gap-5 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm xl:grid-cols-[.9fr_1.1fr]">
        <div>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta-100 text-terracotta-700"><Mail className="h-5 w-5" /></span><div><h2 className="font-serif text-xl font-bold text-stone-950">Convidar por e-mail</h2><p className="text-xs text-stone-500">A conta poderá ser criada depois, sempre com este mesmo e-mail.</p></div></div>
          <form onSubmit={inviteByEmail} className="mt-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Nome (opcional)</span><input value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="filter-field" placeholder="Como chamar no e-mail" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">E-mail</span><input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="filter-field" placeholder="pessoa@email.com" /></label></div>
            <p className="text-[11px] leading-5 text-stone-500">Vaga selecionada: <strong className="text-stone-800">{selectedJobTitle || "selecione uma vaga acima"}</strong>. A pessoa fará o cadastro, lerá a vaga privada e só depois decidirá se aceita.</p>
            <button type="submit" disabled={emailInviting || !inviteJobId} className="inline-flex items-center gap-2 rounded-xl bg-terracotta-600 px-4 py-3 text-xs font-black text-white disabled:opacity-45">{emailInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar convite</button>
          </form>
          {lastInviteUrl && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3"><p className="text-[11px] leading-5 text-amber-900">Link seguro do último convite. Ele também serve como alternativa quando o envio de e-mail ainda não estiver configurado.</p><div className="mt-2 flex gap-2"><input readOnly value={lastInviteUrl} className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-[10px] text-stone-600" /><button type="button" onClick={() => void navigator.clipboard.writeText(lastInviteUrl)} className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 text-[10px] font-bold text-white"><Copy className="h-3.5 w-3.5" /> Copiar</button></div></div>}
        </div>

        <div className="min-w-0 xl:border-l xl:border-stone-200 xl:pl-5">
          <div className="flex items-center justify-between"><div><h2 className="font-serif text-xl font-bold text-stone-950">Convites enviados</h2><p className="text-xs text-stone-500">Cadastro, leitura e resposta sem depender de rastreamento de abertura.</p></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">{companyInvites.length}</span></div>
          <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {companyInvites.slice(0, 30).map((invite) => <div key={invite.id} className="rounded-2xl border border-stone-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-stone-900">{invite.candidateName || invite.candidateEmail || "Candidato convidado"}</p><p className="mt-0.5 truncate text-[10px] text-stone-500">{invite.candidateEmail} · {invite.jobTitle}</p></div><InviteStatus status={invite.status} /></div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-semibold uppercase tracking-wide text-stone-400"><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {invite.emailStatus === "SENT" ? "E-mail enviado" : invite.emailStatus === "FAILED" ? "Falha no e-mail" : invite.emailStatus === "NOT_CONFIGURED" ? "Envio não configurado" : "Envio pendente"}</span>{invite.registeredAt && <span className="inline-flex items-center gap-1"><UserPlus className="h-3 w-3" /> Cadastrou {new Date(invite.registeredAt).toLocaleDateString("pt-BR")}</span>}{invite.viewedAt && <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> Viu a vaga {new Date(invite.viewedAt).toLocaleDateString("pt-BR")}</span>}</div>{invite.status === "PENDING" && <button type="button" onClick={() => void resendInvite(invite.id)} className="mt-3 text-[10px] font-black text-terracotta-700">Reenviar convite</button>}</div>)}
            {companyInvites.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500">Nenhum convite enviado ainda.</div>}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between"><p className="text-sm text-stone-500"><strong className="text-stone-900">{filtered.length}</strong> candidatos encontrados</p></div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} match={rankingMap.get(candidate.id)} onOpen={() => setSelectedCandidate(candidate)} onSave={() => void saveCandidate(candidate.id)} onInvite={() => void inviteCandidate(candidate.id)} />)}
      </section>
      {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 p-12 text-center text-sm text-stone-500">Nenhum candidato corresponde aos filtros atuais.</div>}

      <CandidateProfileModal
        candidate={selectedCandidate}
        compatibility={selectedCandidate ? rankingMap.get(selectedCandidate.id) || null : null}
        compatibilityJobTitle={selectedJobTitle}
        isOpen={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
      />
      <style>{`.filter-field{width:100%;border:1px solid #e7e5e4;border-radius:12px;background:white;padding:11px 12px;font-size:13px;outline:none}.filter-field:focus{border-color:#c66a4b}`}</style>
    </div>
  );
}

function CandidateCard({ candidate, match, onOpen, onSave, onInvite }: { candidate: any; match?: any; onOpen: () => void; onSave: () => void; onInvite: () => void; key?: React.Key }) {
  const prefs = candidate.jobPreferences || {};
  const home = candidate.city && candidate.state ? `${candidate.city}, ${candidate.state}` : candidate.address || "Cidade não informada";
  const preferred = prefs.preferredLocations || [];
  return <article className={`flex flex-col rounded-[26px] border bg-white p-5 shadow-sm transition hover:shadow-md ${match?.boosted ? "border-violet-300 ring-1 ring-violet-100" : "border-stone-200"}`}><div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-stone-100">{candidate.photoURL ? <img src={candidate.photoURL} className="h-full w-full object-cover" alt="" /> : <UserRoundSearch className="h-5 w-5 text-stone-400" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold text-stone-950">{candidate.name || candidate.socialName || candidate.fullName}</h2>{match?.boosted && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-violet-700"><Zap className="h-3 w-3" /> Em destaque</span>}</div><p className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3.5 w-3.5" /> {home}</p></div></div><p className="mt-4 line-clamp-3 text-xs leading-5 text-stone-600">{candidate.bio || "Sem resumo profissional cadastrado."}</p>{candidate.skills?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{candidate.skills.slice(0, 5).map((skill: string) => <span key={skill} className="rounded-full bg-terracotta-50 px-2 py-1 text-[10px] font-bold text-terracotta-700">{skill}</span>)}</div>}<div className="mt-4 space-y-2 rounded-2xl bg-stone-50 p-3 text-[11px] text-stone-600"><div><strong>Aceita:</strong> {preferred.length ? preferred.slice(0, 3).map(locationLabel).join(" · ") : "somente localização principal / não informado"}</div><div className="flex flex-wrap gap-x-4 gap-y-1"><span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> CNH: {prefs.hasDriverLicense === true ? (prefs.driverLicenseCategories || []).join(", ") || "Sim" : prefs.hasDriverLicense === false ? "Não" : "Não informado"}</span><span className="inline-flex items-center gap-1"><Car className="h-3 w-3" /> Veículo: {prefs.hasOwnVehicle === true ? (prefs.ownVehicles || []).join(", ") || "Sim" : prefs.hasOwnVehicle === false ? "Não" : "Não informado"}</span></div></div><div className="mt-auto grid grid-cols-3 gap-2 pt-4"><button onClick={onOpen} className="rounded-xl border border-stone-200 px-2 py-2 text-[11px] font-bold text-stone-700">Perfil</button><button onClick={onSave} className="rounded-xl border border-stone-200 px-2 py-2 text-[11px] font-bold text-stone-700">Salvar</button><button onClick={onInvite} className="inline-flex items-center justify-center gap-1 rounded-xl bg-stone-900 px-2 py-2 text-[11px] font-bold text-white"><Send className="h-3 w-3" /> Convidar</button></div></article>;
}

function InviteStatus({ status }: { status: string }) {
  if (status === "ACCEPTED") return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Aceito</span>;
  if (status === "DECLINED") return <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black uppercase text-stone-500">Recusado</span>;
  return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700">Pendente</span>;
}
