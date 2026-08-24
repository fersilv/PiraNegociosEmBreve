import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Search,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import { useAuth, getGreetingName } from "../contexts/AuthContext";
import { api, asArray } from "../lib/api";
import { openBase64InNewTab } from "../lib/fileViewer";
import { useAiStatus } from "../hooks/useAiStatus";

const isDocumentStage = (application: any) =>
  application.documentsRequested ||
  application.status === "Em Contratação" ||
  application.status === "Aguardando Exame Médico" ||
  Boolean(
    application.status &&
      (application.status.toLowerCase().includes("contrat") ||
        application.status.toLowerCase().includes("documento") ||
        application.status.toLowerCase().includes("exame") ||
        application.status.toLowerCase().includes("admiss")),
  );

const statusLabel = (status?: string) => {
  if (status === "Recusado") return "Não Classificado";
  return status || "Enviado";
};

const statusStyle = (status: string) => {
  if (status === "Aprovado")
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "Em Contratação")
    return "bg-blue-50 text-blue-700 border-blue-100";
  if (status === "Aguardando Exame Médico")
    return "bg-violet-50 text-violet-700 border-violet-100";
  if (status === "Não Classificado" || status === "Desistiu")
    return "bg-stone-100 text-stone-500 border-stone-200";
  if (status === "Entrevista" || status === "Entrevista Agendada")
    return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-stone-50 text-stone-700 border-stone-200";
};

export function CandidateDashboard() {
  const { user, profile } = useAuth();
  const { enabled: aiEnabled } = useAiStatus();
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [jobsMap, setJobsMap] = useState<Record<string, any>>({});
  const [talentInvites, setTalentInvites] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<any[] | null>(null);
  const [matchError, setMatchError] = useState("");

  useEffect(() => {
    if (!user) return;
    void fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoadingApps(true);
    try {
      await fetchJobsMap();
      const [applicationsResponse, invitesResponse] = await Promise.all([
        api.get("/applications/me"),
        api.get("/talent-invites/me"),
      ]);
      setMyApplications(asArray(applicationsResponse.data));
      setTalentInvites(asArray(invitesResponse.data));
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoadingApps(false);
    }
  };

  const fetchJobsMap = async () => {
    try {
      const response = await api.get("/jobs");
      const map: Record<string, any> = {};
      asArray<any>(response.data).forEach((job) => {
        map[job.id] = job;
      });
      setJobsMap(map);
    } catch (error) {
      console.error(error);
    }
  };

  const respondToInvite = async (
    id: string,
    decision: "accept" | "decline",
  ) => {
    await api.post(`/talent-invites/${id}/${decision}`);
    void fetchDashboardData();
  };

  const handleWithdraw = async (appId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja desistir desta candidatura? Isso não pode ser desfeito.",
      )
    ) {
      return;
    }

    try {
      await api.delete(`/applications/${appId}`);
      alert("Candidatura cancelada com sucesso.");
      void fetchDashboardData();
    } catch (error) {
      console.error(error);
      alert("Erro ao cancelar candidatura.");
    }
  };

  const handleMatchAI = async () => {
    if (!user || !aiEnabled) return;
    setMatching(true);
    setMatchError("");

    try {
      const activeJobs = Object.values(jobsMap);
      if (activeJobs.length === 0) {
        setMatchError("Nenhuma vaga disponível no momento para analisar.");
        return;
      }

      const response = await fetch("/api/ai/job-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          profile,
          jobs: activeJobs,
          applications: myApplications,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Não foi possível gerar recomendações.",
        );
      }
      setMatchResults(data.matches);
    } catch (error: any) {
      console.error(error);
      setMatchError(
        error.response?.data?.error ||
          error.message ||
          "Erro ao processar as recomendações.",
      );
    } finally {
      setMatching(false);
    }
  };

  const hasResumeData = Boolean(
    profile?.bio ||
      (profile?.experiences && profile.experiences.length > 0) ||
      (profile?.skills && profile.skills.length > 0),
  );
  const hasUploadedResume = Boolean(profile?.resumeURL);
  const hasResume = hasResumeData || hasUploadedResume;

  const profileReadiness = useMemo(() => {
    let score = 15;
    if (profile?.bio?.trim()) score += 20;
    if (profile?.experiences?.length) score += 25;
    if (profile?.skills?.length) score += 15;
    if (profile?.education?.length) score += 10;
    if (hasUploadedResume || hasResumeData) score += 15;
    return Math.min(score, 100);
  }, [profile, hasUploadedResume, hasResumeData]);

  const documentApplications = useMemo(
    () => myApplications.filter(isDocumentStage),
    [myApplications],
  );

  const activeApplications = useMemo(
    () =>
      myApplications.filter((application) => {
        const status = statusLabel(application.status);
        return !["Não Classificado", "Desistiu", "Aprovado"].includes(status);
      }).length,
    [myApplications],
  );

  const recentApplications = useMemo(
    () =>
      [...myApplications].sort((a, b) => {
        const aDate = new Date(a.appliedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.appliedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      }),
    [myApplications],
  );

  const greetingName = getGreetingName(profile);
  const attentionCount = documentApplications.length + talentInvites.length;

  return (
    <div className="mx-auto max-w-[1380px] space-y-5 md:space-y-6">
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#2b211c] text-white shadow-[0_30px_90px_rgba(55,35,25,.18)]">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#c97551]/30 blur-[90px]" />
        <div className="absolute -bottom-24 left-[30%] h-56 w-56 rounded-full bg-[#e6b59b]/10 blur-[80px]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.045),transparent_38%,rgba(255,255,255,.02))]" />

        <div className="relative grid gap-8 px-6 py-7 md:px-9 md:py-9 lg:grid-cols-[1fr_310px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#efbea5]">
                <Sparkles className="h-3.5 w-3.5" /> PiraNegócios Career
              </span>
              {attentionCount > 0 && (
                <span className="inline-flex rounded-full bg-amber-300 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-stone-950">
                  {attentionCount} {attentionCount === 1 ? "ação pendente" : "ações pendentes"}
                </span>
              )}
            </div>

            <h1 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-[1.02] tracking-[-0.035em] md:text-5xl lg:text-[56px]">
              Sua próxima oportunidade começa com um perfil que trabalha por você.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/52 md:text-base">
              {greetingName}, acompanhe seus processos, fortaleça seu currículo e descubra oportunidades sem perder tempo caçando informação em telas diferentes.
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link
                to="/vagas"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f1c8b2] px-5 py-3.5 text-sm font-black text-[#302019] shadow-[0_12px_35px_rgba(0,0,0,.16)] transition hover:-translate-y-0.5 hover:bg-[#f5d3c1]"
              >
                <Search className="h-4 w-4" /> Encontrar oportunidades
              </Link>
              <Link
                to="/user/curriculo"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.055] px-5 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.09]"
              >
                <FileText className="h-4 w-4" /> Meu currículo
              </Link>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.065] p-5 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div
                className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#e8ad8d ${profileReadiness * 3.6}deg, rgba(255,255,255,.10) 0deg)`,
                }}
              >
                <div className="flex h-[66px] w-[66px] items-center justify-center rounded-full bg-[#30241f]">
                  <span className="text-xl font-black text-white">{profileReadiness}%</span>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">
                  Prontidão do perfil
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  {profileReadiness >= 85
                    ? "Perfil muito completo"
                    : profileReadiness >= 60
                      ? "Boa base profissional"
                      : "Ainda dá para fortalecer"}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/38">
                  Indicador de completude, separado da análise de currículo por IA.
                </p>
              </div>
            </div>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#d47a55] to-[#f3c4aa] transition-all"
                style={{ width: `${profileReadiness}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="user-glass user-elevated rounded-[24px] p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2b211c] text-white">
              <Briefcase className="h-4.5 w-4.5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">Total</span>
          </div>
          <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#201813]">{myApplications.length}</p>
          <p className="mt-1 text-xs font-semibold text-stone-500">Candidaturas enviadas</p>
        </div>

        <div className="user-glass user-elevated rounded-[24px] p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Clock className="h-4.5 w-4.5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">Agora</span>
          </div>
          <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#201813]">{activeApplications}</p>
          <p className="mt-1 text-xs font-semibold text-stone-500">Processos em andamento</p>
        </div>

        <div className="user-glass user-elevated rounded-[24px] p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f1d6c7] text-[#8f432a]">
              <UserRoundSearch className="h-4.5 w-4.5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">Empresas</span>
          </div>
          <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#201813]">{talentInvites.length}</p>
          <p className="mt-1 text-xs font-semibold text-stone-500">Convites recebidos</p>
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-[#5b4030]/10 bg-[#ead6c9] p-4 shadow-[0_20px_60px_rgba(65,39,26,.10)] md:p-5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/45 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2b211c] text-[#f2c9b3]">
              <FileText className="h-4.5 w-4.5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#735447]">Currículo</span>
          </div>
          <p className="relative mt-4 text-xl font-black tracking-tight text-[#2b211c]">{hasResume ? "Pronto para usar" : "Precisa de atenção"}</p>
          <Link to="/user/curriculo" className="relative mt-2 inline-flex items-center gap-1 text-xs font-black text-[#7f3f2a]">
            {hasResume ? "Revisar currículo" : "Criar agora"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {(documentApplications.length > 0 || talentInvites.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a15a3f]">Prioridades</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#201813]">Precisa de você agora</h2>
            </div>
            <span className="hidden text-xs font-medium text-stone-400 sm:block">Ações que podem avançar seus processos</span>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {documentApplications.map((application) => (
              <article
                key={application.id}
                className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-[#30241f] p-5 text-white shadow-[0_18px_50px_rgba(55,35,25,.15)] md:p-6"
              >
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-300/10 blur-3xl" />
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-stone-950">
                      <AlertTriangle className="h-3 w-3" /> Documentos pendentes
                    </span>
                    <h3 className="mt-3 truncate text-lg font-bold">{application.jobTitle || "Processo seletivo"}</h3>
                    <p className="mt-1 text-sm text-white/46">{application.companyName || "A empresa"} está aguardando sua documentação.</p>
                  </div>
                  <Link
                    to={`/user/admissao/${application.id}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-[#30241f] transition group-hover:-translate-y-0.5"
                  >
                    Resolver agora <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}

            {talentInvites.map((invite) => (
              <article
                key={invite.id}
                className="user-glass user-elevated rounded-[26px] p-5 md:p-6"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1d6c7] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#7f3f2a]">
                      <UserRoundSearch className="h-3 w-3" /> Empresa interessada
                    </span>
                    <h3 className="mt-3 truncate text-lg font-bold text-[#201813]">{invite.job?.title || "Vaga"}</h3>
                    <p className="mt-1 text-sm text-stone-500">{invite.job?.companyName || "Empresa"} convidou você para participar do processo.</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {invite.job?.id && (
                      <Link
                        to={`/user/vaga/${invite.job.id}`}
                        className="rounded-2xl border border-[#5b4030]/10 bg-white/70 px-4 py-3 text-xs font-bold text-stone-700 transition hover:bg-white"
                      >
                        Ver vaga
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => respondToInvite(invite.id, "decline")}
                      className="rounded-2xl border border-[#5b4030]/10 bg-white/70 px-4 py-3 text-xs font-bold text-stone-600 transition hover:bg-white"
                    >
                      Recusar
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToInvite(invite.id, "accept")}
                      className="rounded-2xl bg-[#2b211c] px-4 py-3 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-[#3a2b24]"
                    >
                      Tenho interesse
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.65fr)]">
        <div className="user-glass user-elevated overflow-hidden rounded-[30px]">
          <div className="flex items-center justify-between gap-4 border-b border-[#5b4030]/8 px-5 py-5 md:px-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Linha do tempo</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#201813]">Seus processos</h2>
            </div>
            <Link
              to="/vagas"
              className="hidden items-center gap-2 rounded-2xl bg-[#2b211c] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 sm:inline-flex"
            >
              Nova candidatura <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loadingApps ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#b85e3f]" />
            </div>
          ) : recentApplications.length === 0 ? (
            <div className="m-5 rounded-[24px] border border-dashed border-[#5b4030]/15 bg-white/45 p-10 text-center md:m-6">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ead6c9] text-[#8b4a34]">
                <Briefcase className="h-6 w-6" />
              </span>
              <p className="mt-4 text-lg font-black text-[#201813]">Sua jornada começa aqui</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-stone-500">Quando você se candidatar, etapas, convites e documentos aparecem organizados neste espaço.</p>
              <Link
                to="/vagas"
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#2b211c] px-5 py-3 text-sm font-bold text-white"
              >
                Explorar vagas <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="px-5 py-2 md:px-6">
              {recentApplications.map((application, index) => {
                const currentStatus = statusLabel(application.status);
                const canWithdraw = !["Não Classificado", "Desistiu", "Aprovado"].includes(currentStatus);
                const docStage = isDocumentStage(application);
                const docs = application.onboardingDocs || {};
                const uploadedDocCount = Object.values(docs).filter((document: any) => document.url).length;
                const hasRejectedDoc = Object.values(docs).some((document: any) => document.status === "rejected");
                const isSubmitted = application.submittedForReview === true;

                return (
                  <article key={application.id} className="relative grid grid-cols-[34px_1fr] gap-3 py-5 md:grid-cols-[40px_1fr] md:gap-4">
                    {index < recentApplications.length - 1 && (
                      <span className="absolute bottom-0 left-[16px] top-[54px] w-px bg-[#6a4d3c]/10 md:left-[19px]" />
                    )}
                    <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#f7f1ea] bg-[#2b211c] text-white md:h-10 md:w-10">
                      <Briefcase className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </div>

                    <div className="min-w-0 rounded-[22px] border border-[#5b4030]/8 bg-white/52 p-4 transition hover:border-[#b76a4d]/20 hover:bg-white/72 md:p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-black text-[#201813]">{application.jobTitle || "Vaga"}</h3>
                            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${statusStyle(currentStatus)}`}>
                              {currentStatus}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-stone-500">{application.companyName || "Empresa"}</p>
                          <p className="mt-2 text-[11px] text-stone-400">
                            {application.appliedAt
                              ? `Candidatura enviada em ${new Date(application.appliedAt).toLocaleDateString("pt-BR")}`
                              : "Candidatura registrada"}
                          </p>

                          {docStage && (
                            <div className="mt-3">
                              {hasRejectedDoc ? (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-700">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Reenvio solicitado
                                </span>
                              ) : isSubmitted ? (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700">
                                  <Clock className="h-3.5 w-3.5" /> Documentos em análise · {uploadedDocCount}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-800">
                                  <FileText className="h-3.5 w-3.5" /> Documentação em preenchimento · {uploadedDocCount}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 md:max-w-[275px] md:justify-end">
                          {docStage && (
                            <Link
                              to={`/user/admissao/${application.id}`}
                              className="rounded-xl bg-[#2b211c] px-3.5 py-2.5 text-[11px] font-black text-white transition hover:bg-[#3a2b24]"
                            >
                              {isSubmitted && !hasRejectedDoc ? "Ver documentos" : "Enviar documentos"}
                            </Link>
                          )}
                          <Link
                            to={`/user/vaga/${application.jobId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#5b4030]/10 bg-white/80 px-3.5 py-2.5 text-[11px] font-bold text-stone-700 transition hover:bg-white"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver vaga
                          </Link>
                          {canWithdraw && (
                            <button
                              type="button"
                              onClick={() => handleWithdraw(application.id)}
                              className="rounded-xl px-3 py-2.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50"
                            >
                              Desistir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className="relative overflow-hidden rounded-[30px] border border-[#5b4030]/10 bg-[#ead6c9] p-5 shadow-[0_22px_65px_rgba(65,39,26,.10)] md:p-6">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/55 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2b211c] text-[#f1c6af]">
                  <FileText className="h-5 w-5" />
                </span>
                {hasResume ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Pronto
                  </span>
                ) : (
                  <span className="rounded-full bg-[#a64f34] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">Pendente</span>
                )}
              </div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7e594a]">Seu principal ativo</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#2b211c]">Currículo profissional</h2>
              <p className="mt-2 text-sm leading-6 text-[#6f5144]">
                {hasResume
                  ? "Sua história profissional já está estruturada. Atualize sempre que sua carreira avançar."
                  : "Construa um currículo forte para liberar candidaturas e ser encontrado por empresas."}
              </p>

              <Link
                to="/user/curriculo"
                className="mt-5 flex w-full items-center justify-between rounded-2xl bg-[#2b211c] px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
              >
                {hasResume ? "Editar currículo" : "Criar meu currículo"}
                <ArrowRight className="h-4 w-4" />
              </Link>

              {hasUploadedResume && (
                <button
                  type="button"
                  onClick={() => {
                    if (!profile?.resumeURL) return;
                    openBase64InNewTab(
                      profile.resumeURL,
                      `Meu_Currículo_${profile.socialName || profile.name || ""}`,
                    );
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#684938]/12 bg-white/45 px-4 py-3 text-xs font-bold text-[#654738] transition hover:bg-white/70"
                >
                  <Eye className="h-4 w-4" /> Visualizar original
                </button>
              )}
            </div>
          </section>

          {aiEnabled && (
            <section className="relative overflow-hidden rounded-[30px] border border-violet-200/60 bg-gradient-to-br from-[#f4efff] via-[#faf7ff] to-[#fffaf7] p-5 shadow-[0_22px_60px_rgba(74,45,110,.09)] md:p-6">
              <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-violet-300/25 blur-3xl" />
              <div className="relative">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-700 text-white shadow-lg shadow-violet-700/15">
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-500">Assistente de carreira</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-stone-950">Oportunidades com aderência</h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">Cruze seu histórico profissional com as vagas abertas e descubra onde seu perfil faz mais sentido.</p>

                <button
                  type="button"
                  onClick={handleMatchAI}
                  disabled={matching}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-800 disabled:opacity-60"
                >
                  {matching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Descobrir combinações
                    </>
                  )}
                </button>
                {matchError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{matchError}</p>}
              </div>
            </section>
          )}
        </aside>
      </section>

      {aiEnabled && matchResults && matchResults.length > 0 && (
        <section className="user-glass user-elevated rounded-[30px] p-5 md:p-6">
          <div className="flex flex-col gap-2 border-b border-[#5b4030]/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">Curadoria inteligente</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#201813]">Vagas que conversam com sua trajetória</h2>
            </div>
            <span className="text-xs font-medium text-stone-400">Baseado no seu currículo atual</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matchResults.slice(0, 6).map((match, index) => {
              const job = jobsMap[match.jobId];
              if (!job) return null;

              return (
                <article
                  key={`${match.jobId}-${index}`}
                  className="group rounded-[22px] border border-[#5b4030]/8 bg-white/55 p-4 transition hover:-translate-y-1 hover:border-violet-200 hover:bg-white/80 hover:shadow-[0_16px_45px_rgba(68,44,31,.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700">{match.score}% de aderência</span>
                      <h3 className="mt-3 truncate text-base font-black text-[#201813]">{job.title}</h3>
                      <p className="mt-0.5 truncate text-xs font-bold text-[#a55338]">{job.companyName}</p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-500">{match.reason}</p>
                  <Link
                    to={`/vagas?applyTo=${job.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-violet-700"
                  >
                    Explorar vaga <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
