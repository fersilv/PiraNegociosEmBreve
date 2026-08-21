import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
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
  if (status === "Aprovado") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "Em Contratação") return "bg-blue-50 text-blue-700 border-blue-100";
  if (status === "Aguardando Exame Médico") return "bg-violet-50 text-violet-700 border-violet-100";
  if (status === "Não Classificado" || status === "Desistiu") return "bg-stone-100 text-stone-500 border-stone-200";
  if (status === "Entrevista" || status === "Entrevista Agendada") return "bg-amber-50 text-amber-700 border-amber-100";
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 md:space-y-7">
      <section className="overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
        <div className="relative px-6 py-7 md:px-8 md:py-8">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-terracotta-100/60 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-terracotta-600">
                Seu espaço de carreira
              </p>
              <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
                Olá, {getGreetingName(profile)}.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500 md:text-base">
                Acompanhe seus processos, mantenha o currículo pronto e encontre a próxima oportunidade sem transformar isso em trabalho administrativo.
              </p>
            </div>
            <Link
              to="/vagas"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-stone-800 md:w-auto"
            >
              <Search className="h-4 w-4" />
              Encontrar vagas
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">Candidaturas</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{myApplications.length}</p>
          <p className="mt-1 text-xs text-stone-500">Total enviado</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">Em andamento</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{activeApplications}</p>
          <p className="mt-1 text-xs text-stone-500">Processos ativos</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">Convites</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{talentInvites.length}</p>
          <p className="mt-1 text-xs text-stone-500">De empresas</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm md:p-5 ${hasResume ? "border-emerald-100 bg-emerald-50/60" : "border-amber-200 bg-amber-50"}`}>
          <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${hasResume ? "text-emerald-700" : "text-amber-700"}`}>Currículo</p>
          <p className="mt-2 text-xl font-bold text-stone-950">{hasResume ? "Pronto" : "Pendente"}</p>
          <p className="mt-1 text-xs text-stone-500">{hasResume ? "Disponível para processos" : "Complete para se candidatar"}</p>
        </div>
      </section>

      {(documentApplications.length > 0 || talentInvites.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">Agora</p>
              <h2 className="mt-1 text-xl font-bold text-stone-950">Requer sua atenção</h2>
            </div>
          </div>

          {documentApplications.map((application) => (
            <div
              key={application.id}
              className="flex flex-col gap-4 rounded-[24px] border border-stone-800 bg-stone-950 p-5 text-white shadow-sm md:flex-row md:items-center md:justify-between md:p-6"
            >
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> Ação necessária
                </span>
                <h3 className="mt-3 truncate text-lg font-bold md:text-xl">{application.jobTitle || "Processo seletivo"}</h3>
                <p className="mt-1 text-sm text-white/55">
                  {application.companyName || "A empresa"} aguarda documentos do seu processo de admissão.
                </p>
              </div>
              <Link
                to={`/user/admissao/${application.id}`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-stone-950 transition hover:bg-amber-200"
              >
                Ver documentos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}

          {talentInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-4 rounded-[24px] border border-terracotta-200 bg-terracotta-50 p-5 md:flex-row md:items-center md:justify-between md:p-6"
            >
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta-700 shadow-sm">
                  <UserRoundSearch className="h-3 w-3" /> Convite recebido
                </span>
                <h3 className="mt-3 truncate text-lg font-bold text-stone-950">{invite.job?.title || "Vaga"}</h3>
                <p className="mt-1 text-sm text-stone-600">
                  {invite.job?.companyName || "Empresa"} quer conversar com você sobre esta oportunidade.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => respondToInvite(invite.id, "decline")}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50"
                >
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={() => respondToInvite(invite.id, "accept")}
                  className="rounded-xl bg-terracotta-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-terracotta-700"
                >
                  Tenho interesse
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.55fr_0.75fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">Seus processos</p>
              <h2 className="mt-1 text-xl font-bold text-stone-950">Candidaturas</h2>
            </div>
            <Link to="/vagas" className="hidden items-center gap-1 text-sm font-bold text-terracotta-700 sm:flex">
              Ver novas vagas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadingApps ? (
            <div className="flex min-h-52 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-terracotta-600" />
            </div>
          ) : recentApplications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center">
              <Briefcase className="mx-auto h-9 w-9 text-stone-300" />
              <p className="mt-3 font-bold text-stone-800">Nenhuma candidatura ainda</p>
              <p className="mt-1 text-sm text-stone-500">Quando você se candidatar, todo o andamento aparece aqui.</p>
              <Link
                to="/vagas"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white"
              >
                Encontrar vagas <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {recentApplications.map((application) => {
                const currentStatus = statusLabel(application.status);
                const canWithdraw = !["Não Classificado", "Desistiu", "Aprovado"].includes(currentStatus);
                const docStage = isDocumentStage(application);
                const docs = application.onboardingDocs || {};
                const uploadedDocCount = Object.values(docs).filter((document: any) => document.url).length;
                const hasRejectedDoc = Object.values(docs).some((document: any) => document.status === "rejected");
                const isSubmitted = application.submittedForReview === true;

                return (
                  <article key={application.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-bold text-stone-950">{application.jobTitle || "Vaga"}</h3>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle(currentStatus)}`}>
                            {currentStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-stone-500">{application.companyName || "Empresa"}</p>
                        <p className="mt-2 text-xs text-stone-400">
                          Candidatura enviada {application.appliedAt ? `em ${new Date(application.appliedAt).toLocaleDateString("pt-BR")}` : ""}
                        </p>

                        {docStage && (
                          <div className="mt-3">
                            {hasRejectedDoc ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">
                                <AlertTriangle className="h-3.5 w-3.5" /> Reenvio de documento solicitado
                              </span>
                            ) : isSubmitted ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700">
                                <Clock className="h-3.5 w-3.5" /> Documentos em análise · {uploadedDocCount} anexados
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-800">
                                <FileText className="h-3.5 w-3.5" /> Documentação em preenchimento · {uploadedDocCount} anexados
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 sm:max-w-[260px] sm:justify-end">
                        {docStage && (
                          <Link
                            to={`/user/admissao/${application.id}`}
                            className="rounded-xl bg-terracotta-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-terracotta-700"
                          >
                            {isSubmitted && !hasRejectedDoc ? "Ver documentos" : "Enviar documentos"}
                          </Link>
                        )}
                        <Link
                          to={`/user/vaga/${application.jobId}`}
                          className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-bold text-stone-700 transition hover:bg-stone-100"
                        >
                          Ver vaga
                        </Link>
                        {canWithdraw && (
                          <button
                            type="button"
                            onClick={() => handleWithdraw(application.id)}
                            className="rounded-xl px-3.5 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
                          >
                            Desistir
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <section className={`rounded-[26px] border p-5 shadow-sm ${hasResume ? "border-stone-200 bg-white" : "border-terracotta-200 bg-terracotta-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${hasResume ? "bg-stone-100 text-stone-600" : "bg-white text-terracotta-700 shadow-sm"}`}>
                <FileText className="h-5 w-5" />
              </span>
              {hasResume ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Pronto
                </span>
              ) : (
                <span className="rounded-full bg-terracotta-600 px-2.5 py-1 text-[10px] font-bold text-white">Comece aqui</span>
              )}
            </div>
            <h2 className="mt-4 text-lg font-bold text-stone-950">Meu currículo</h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              {hasResume
                ? "Mantenha sua trajetória atualizada para candidaturas e convites de empresas."
                : "Monte seu currículo profissional gratuitamente e deixe seu perfil pronto para oportunidades."}
            </p>

            <div className="mt-5 space-y-2">
              <Link
                to="/user/curriculo"
                className="flex w-full items-center justify-between rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-stone-800"
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50"
                >
                  <FileText className="h-4 w-4" /> Visualizar original
                </button>
              )}
            </div>
          </section>

          {aiEnabled && (
            <section className="rounded-[26px] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-stone-950">Vagas para o seu perfil</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                Cruze seu currículo com as vagas abertas e veja quais têm maior aderência ao seu histórico.
              </p>
              <button
                type="button"
                onClick={handleMatchAI}
                disabled={matching}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:opacity-60"
              >
                {matching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Encontrar combinações
                  </>
                )}
              </button>
              {matchError && (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{matchError}</p>
              )}
            </section>
          )}
        </aside>
      </section>

      {aiEnabled && matchResults && matchResults.length > 0 && (
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">Inteligência Artificial</p>
            <h2 className="mt-1 text-xl font-bold text-stone-950">Melhores combinações encontradas</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {matchResults.slice(0, 6).map((match, index) => {
              const job = jobsMap[match.jobId];
              if (!job) return null;

              return (
                <article key={`${match.jobId}-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{match.score}% de aderência</span>
                      <h3 className="mt-2 truncate font-bold text-stone-950">{job.title}</h3>
                      <p className="mt-0.5 text-xs font-medium text-terracotta-700">{job.companyName}</p>
                    </div>
                    <Briefcase className="h-5 w-5 shrink-0 text-stone-300" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{match.reason}</p>
                  <Link
                    to={`/vagas?applyTo=${job.id}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-terracotta-700"
                  >
                    Ver vaga <ArrowRight className="h-4 w-4" />
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
