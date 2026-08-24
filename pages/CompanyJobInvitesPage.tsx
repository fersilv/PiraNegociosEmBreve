import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileText,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Send,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { CandidateProfileModal } from "../components/CandidateProfileModal";
import { useAuth } from "../contexts/AuthContext";
import { api, asArray } from "../lib/api";
import type { Job } from "../types/job";

type Invite = {
  id: string;
  candidateId?: string | null;
  candidateEmail?: string | null;
  candidateName?: string | null;
  jobId: string;
  jobTitle: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | string;
  emailStatus: string;
  emailSentAt?: string | null;
  viewedAt?: string | null;
  registeredAt?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
};

type LookupState = "idle" | "loading" | "found" | "not-found" | "error";

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const candidateName = (candidate: any) => candidate?.name || candidate?.socialName || candidate?.fullName || candidate?.displayName || "Candidato";
const jobLocation = (job?: Job | null) => job?.location || [job?.city, job?.state].filter(Boolean).join(", ") || "Local não informado";

export function CompanyJobInvitesPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [email, setEmail] = useState("");
  const [matchedCandidate, setMatchedCandidate] = useState<any | null>(null);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [profileCandidate, setProfileCandidate] = useState<any | null>(null);
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyVerified, setCompanyVerified] = useState<boolean | null>(null);

  const loadInvites = async () => {
    if (!profile?.companyId) return;
    const response = await api.get(`/companies/${profile.companyId}/talent-invites`);
    setInvites(asArray<Invite>(response.data));
  };

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
      const [jobsResponse, invitesResponse] = await Promise.all([
        api.get(`/companies/${profile.companyId}/talent-jobs`),
        api.get(`/companies/${profile.companyId}/talent-invites`),
      ]);
      const availableJobs = asArray<Job>(jobsResponse.data);
      setJobs(availableJobs);
      setInvites(asArray<Invite>(invitesResponse.data));
      setSelectedJobId((current) => {
        if (current && availableJobs.some((job) => job.id === current)) return current;
        const requested = searchParams.get("jobId") || "";
        return availableJobs.some((job) => job.id === requested) ? requested : availableJobs[0]?.id || "";
      });
    } catch (error) {
      console.error("Erro ao carregar convites por vaga:", error);
      setJobs([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [profile?.companyId]);

  useEffect(() => {
    let active = true;
    const normalized = normalizeEmail(email);
    setMatchedCandidate(null);
    if (!isEmail(normalized)) {
      setLookupState("idle");
      return () => { active = false; };
    }
    setLookupState("loading");
    const timer = window.setTimeout(() => {
      void api.get("/candidates/by-email", { params: { email: normalized } })
        .then((response) => {
          if (!active) return;
          if (response.data) {
            setMatchedCandidate(response.data);
            setLookupState("found");
          } else {
            setLookupState("not-found");
          }
        })
        .catch((error) => {
          console.error("Erro ao localizar candidato pelo e-mail:", error);
          if (active) setLookupState("error");
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [email]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) || null, [jobs, selectedJobId]);
  const selectedInvites = useMemo(() => invites.filter((invite) => invite.jobId === selectedJobId), [invites, selectedJobId]);
  const inviteCountByJob = useMemo(() => {
    const counts = new Map<string, number>();
    invites.forEach((invite) => counts.set(invite.jobId, (counts.get(invite.jobId) || 0) + 1));
    return counts;
  }, [invites]);
  const filteredJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter((job) => `${job.title} ${jobLocation(job)}`.toLowerCase().includes(query));
  }, [jobs, jobSearch]);
  const existingInvite = useMemo(() => {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    return selectedInvites.find((invite) =>
      (matchedCandidate?.id && invite.candidateId === matchedCandidate.id) ||
      normalizeEmail(invite.candidateEmail) === normalized,
    ) || null;
  }, [email, matchedCandidate?.id, selectedInvites]);

  const selectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setSearchParams({ jobId }, { replace: true });
    setEmail("");
    setMatchedCandidate(null);
    setLookupState("idle");
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.companyId || !selectedJob) return;
    const normalized = normalizeEmail(email);
    if (!isEmail(normalized)) return alert("Informe um e-mail válido.");
    if (lookupState === "loading") return alert("Aguarde a busca pelo perfil terminar.");
    if (existingInvite?.status === "ACCEPTED") return alert("Essa pessoa já aceitou o convite para esta vaga.");
    setInviting(true);
    try {
      const response = matchedCandidate?.id
        ? await api.post(`/companies/${profile.companyId}/talent-invites`, { candidateId: matchedCandidate.id, jobId: selectedJob.id })
        : await api.post(`/companies/${profile.companyId}/talent-invites/email`, { email: normalized, jobId: selectedJob.id });
      await loadInvites();
      setEmail("");
      setMatchedCandidate(null);
      setLookupState("idle");
      const deliveryStatus = response.data?.delivery?.status;
      if (deliveryStatus === "SENT") alert(existingInvite ? "Convite reenviado por e-mail." : "Convite enviado por e-mail.");
      else if (deliveryStatus === "FAILED") alert(response.data?.delivery?.error || "O convite foi criado, mas o e-mail não pôde ser enviado.");
      else alert("Convite criado. Você pode copiar o link na lista de convidados.");
    } catch (error: any) {
      alert(error?.response?.data?.message || "Não foi possível enviar o convite.");
    } finally {
      setInviting(false);
    }
  };

  const resend = async (inviteId: string) => {
    if (!profile?.companyId) return;
    setResendingId(inviteId);
    try {
      const response = await api.post(`/companies/${profile.companyId}/talent-invites/${inviteId}/resend`);
      await loadInvites();
      if (response.data?.delivery?.status === "SENT") alert("Convite reenviado por e-mail.");
    } catch (error: any) {
      alert(error?.response?.data?.message || "Não foi possível reenviar o convite.");
    } finally {
      setResendingId(null);
    }
  };

  const copyInviteLink = async (inviteId: string) => {
    if (!profile?.companyId) return;
    setCopyingId(inviteId);
    try {
      const response = await api.post(`/companies/${profile.companyId}/talent-invites/${inviteId}/link`);
      const inviteUrl = String(response.data?.inviteUrl || "");
      if (!inviteUrl) throw new Error("Link indisponível");
      await navigator.clipboard.writeText(inviteUrl);
      alert("Link do convite copiado.");
    } catch (error: any) {
      alert(error?.response?.data?.message || "Não foi possível copiar o link do convite.");
    } finally {
      setCopyingId(null);
    }
  };

  const openInviteProfile = async (invite: Invite) => {
    if (!invite.candidateEmail) return;
    try {
      const response = await api.get("/candidates/by-email", { params: { email: invite.candidateEmail } });
      if (!response.data) return alert("Este perfil não está disponível no Banco de Talentos.");
      setProfileCandidate(response.data);
    } catch {
      alert("Não foi possível abrir este perfil agora.");
    }
  };

  if (loading || companyVerified === null) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-terracotta-600" /></div>;
  if (!profile?.companyId) return <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-stone-600">Cadastre ou vincule uma empresa para gerenciar convites.</div>;
  if (!companyVerified) return <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center"><h2 className="font-serif text-2xl font-bold text-stone-950">Convites protegidos</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">A busca de perfis e o envio de convites ficam disponíveis para empresas verificadas.</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-terracotta-600">Vagas · Recrutamento</p><h1 className="mt-1 flex items-center gap-3 font-serif text-4xl font-bold text-stone-950"><Mail className="h-8 w-8 text-terracotta-600" /> Convites por vaga</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Selecione uma vaga, convide uma pessoa pelo e-mail e acompanhe cadastro, visualização e resposta sem misturar esse fluxo com o Banco de Talentos.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-stone-700"><RefreshCw className="h-4 w-4" /> Atualizar</button><Link to="/company/vagas/nova" className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-black text-white"><Plus className="h-4 w-4" /> Nova vaga</Link></div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-center justify-between px-1"><div><h2 className="font-serif text-xl font-bold text-stone-950">Vagas ativas</h2><p className="mt-1 text-[11px] text-stone-400">Escolha onde deseja recrutar</p></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">{jobs.length}</span></div>
          <label className="relative mt-4 block"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="Buscar vaga" className="w-full rounded-2xl border border-stone-200 bg-stone-50/70 py-3 pl-10 pr-3 text-xs outline-none focus:border-terracotta-400" /></label>
          <div className="mt-3 max-h-[680px] space-y-2 overflow-y-auto pr-1">
            {filteredJobs.map((job) => {
              const selected = job.id === selectedJobId;
              return <button key={job.id} type="button" onClick={() => selectJob(job.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-terracotta-300 bg-terracotta-50 shadow-sm" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"}`}><div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-terracotta-600 text-white" : "bg-stone-100 text-stone-500"}`}><BriefcaseBusiness className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="line-clamp-2 text-sm text-stone-900">{job.title}</strong>{job.isInternal && <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-violet-600" />}</span><span className="mt-1 block truncate text-[10px] text-stone-400">{jobLocation(job)}</span><span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-500">{inviteCountByJob.get(job.id) || 0} convite(s)</span></span></div></button>;
            })}
            {filteredJobs.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 p-7 text-center text-xs text-stone-500">Nenhuma vaga ativa encontrada.</div>}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {!selectedJob ? <div className="rounded-[30px] border border-dashed border-stone-300 bg-white/60 p-12 text-center"><BriefcaseBusiness className="mx-auto h-8 w-8 text-stone-300" /><h2 className="mt-4 font-serif text-2xl font-bold text-stone-900">Selecione uma vaga</h2><p className="mt-2 text-sm text-stone-500">A área de convite e o histórico aparecem aqui.</p></div> : <>
            <section className="overflow-hidden rounded-[28px] bg-[#1d1d1a] p-6 text-white shadow-[0_20px_60px_rgba(20,20,17,.15)] sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">Ativa</span>{selectedJob.isInternal && <span className="inline-flex items-center gap-1 rounded-full bg-violet-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-violet-200"><LockKeyhole className="h-3 w-3" /> Interna</span>}</div><h2 className="mt-3 font-serif text-3xl font-bold">{selectedJob.title}</h2><p className="mt-2 inline-flex items-center gap-1 text-xs text-white/45"><MapPin className="h-3.5 w-3.5" /> {jobLocation(selectedJob)}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.06] px-5 py-4 text-center"><strong className="font-serif text-3xl">{selectedInvites.length}</strong><p className="text-[9px] font-black uppercase tracking-wider text-white/35">convidados</p></div></div></section>

            <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-terracotta-100 text-terracotta-700"><UserPlus className="h-5 w-5" /></span><div><h2 className="font-serif text-2xl font-bold text-stone-950">Convidar para esta vaga</h2><p className="mt-1 text-xs leading-5 text-stone-500">Digite o e-mail completo. Se houver um currículo disponível com o mesmo endereço, o perfil será identificado antes do envio.</p></div></div>
              <form onSubmit={invite} className="mt-5">
                <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-stone-400">Buscar ou informar e-mail</span><span className="relative block"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="candidato@email.com" autoComplete="off" className={`w-full rounded-2xl border bg-white py-3.5 pl-11 pr-12 text-sm outline-none transition ${lookupState === "found" ? "border-emerald-400 ring-2 ring-emerald-100" : "border-stone-200 focus:border-terracotta-400"}`} />{lookupState === "loading" && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />}{lookupState === "found" && <CheckCircle2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />}</span></label>

                {lookupState === "found" && matchedCandidate && <CandidateMatchCard candidate={matchedCandidate} onOpen={() => setProfileCandidate(matchedCandidate)} />}
                {(lookupState === "not-found" || lookupState === "error") && <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-stone-500"><Mail className="h-3.5 w-3.5" /> O convite será enviado por e-mail.</p>}
                <button type="submit" disabled={inviting || lookupState === "loading" || !isEmail(normalizeEmail(email)) || existingInvite?.status === "ACCEPTED"} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-terracotta-600 px-5 py-3.5 text-xs font-black text-white shadow-sm transition hover:bg-terracotta-700 disabled:cursor-not-allowed disabled:opacity-45">{inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{existingInvite ? "Reenviar convite" : matchedCandidate ? `Convidar ${candidateName(matchedCandidate)}` : "Enviar convite por e-mail"}</button>
              </form>
            </section>

            <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold text-stone-950">Pessoas convidadas</h2><p className="mt-1 text-xs text-stone-500">Histórico exclusivo da vaga selecionada.</p></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">{selectedInvites.length}</span></div><div className="mt-5 space-y-3">{selectedInvites.map((inviteItem) => <InviteRow key={inviteItem.id} invite={inviteItem} busyResend={resendingId === inviteItem.id} busyCopy={copyingId === inviteItem.id} onCopyLink={() => void copyInviteLink(inviteItem.id)} onResend={() => void resend(inviteItem.id)} onOpenProfile={inviteItem.candidateId ? () => void openInviteProfile(inviteItem) : undefined} />)}{selectedInvites.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center"><Mail className="mx-auto h-6 w-6 text-stone-300" /><p className="mt-3 text-sm font-bold text-stone-700">Nenhum convite enviado para esta vaga.</p><p className="mt-1 text-xs text-stone-400">Use o campo acima para iniciar o processo.</p></div>}</div></section>
          </>}
        </main>
      </div>

      <CandidateProfileModal candidate={profileCandidate} isOpen={Boolean(profileCandidate)} onClose={() => setProfileCandidate(null)} />
    </div>
  );
}

function CandidateMatchCard({ candidate, onOpen }: { candidate: any; onOpen: () => void }) {
  const experiences = Array.isArray(candidate.experiences) ? candidate.experiences : [];
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  return <div className="mt-3 rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4"><div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-emerald-600 shadow-sm">{candidate.photoURL ? <img src={candidate.photoURL} alt="" className="h-full w-full object-cover" /> : <User className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-stone-950">{candidateName(candidate)}</strong><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700"><UserCheck className="h-3 w-3" /> Perfil encontrado</span></div><p className="mt-1 truncate text-xs text-stone-500">{candidate.email}{candidate.phone ? ` · ${candidate.phone}` : ""}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-600">{candidate.bio || "Sem resumo profissional cadastrado."}</p></div></div>{skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{skills.slice(0, 6).map((skill: string) => <span key={skill} className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-emerald-800">{skill}</span>)}</div>}{experiences.length > 0 && <div className="mt-3 rounded-xl bg-white/80 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-stone-400">Experiência mais recente</p><p className="mt-1 text-xs font-bold text-stone-800">{experiences[0]?.role || "Cargo não informado"}</p><p className="text-[10px] text-stone-500">{experiences[0]?.company || "Empresa não informada"}</p></div>}<button type="button" onClick={onOpen} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-800"><FileText className="h-3.5 w-3.5" /> Abrir perfil completo</button></div>;
}

function InviteRow({ invite, busyResend, busyCopy, onCopyLink, onResend, onOpenProfile }: { invite: Invite; busyResend: boolean; busyCopy: boolean; onCopyLink: () => void; onResend: () => void; onOpenProfile?: () => void }) {
  return <article className="rounded-[22px] border border-stone-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-stone-900">{invite.candidateName || invite.candidateEmail || "Pessoa convidada"}</strong><InviteStatus status={invite.status} /></div><p className="mt-1 truncate text-xs text-stone-500">{invite.candidateEmail || "Convite interno"}</p></div><div className="flex shrink-0 flex-wrap gap-2">{onOpenProfile && <button type="button" onClick={onOpenProfile} className="rounded-xl border border-stone-200 px-3 py-2 text-[10px] font-bold text-stone-600">Ver perfil</button>}{invite.status === "PENDING" && <><button type="button" disabled={busyCopy || busyResend} onClick={onCopyLink} className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-[10px] font-bold text-stone-700 disabled:opacity-50">{busyCopy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />} Copiar link</button><button type="button" disabled={busyResend || busyCopy} onClick={onResend} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">{busyResend ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Reenviar</button></>}</div></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-stone-100 pt-3 text-[9px] font-bold uppercase tracking-wide text-stone-400"><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {emailStatus(invite.emailStatus)}</span>{invite.registeredAt && <span className="inline-flex items-center gap-1"><UserPlus className="h-3 w-3" /> Cadastro {dateLabel(invite.registeredAt)}</span>}{invite.viewedAt && <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> Visualizou {dateLabel(invite.viewedAt)}</span>}{invite.acceptedAt && <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Aceitou {dateLabel(invite.acceptedAt)}</span>}{!invite.viewedAt && invite.createdAt && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Enviado {dateLabel(invite.createdAt)}</span>}</div></article>;
}

function InviteStatus({ status }: { status: string }) {
  if (status === "ACCEPTED") return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Aceito</span>;
  if (status === "DECLINED") return <span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black uppercase text-stone-500">Recusado</span>;
  return <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700">Pendente</span>;
}

function emailStatus(status: string) {
  if (status === "SENT") return "E-mail enviado";
  if (status === "FAILED") return "Falha no e-mail";
  if (status === "NOT_CONFIGURED") return "Envio não configurado";
  if (status === "NOT_REQUESTED") return "Notificação interna";
  return "Envio pendente";
}

function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}
