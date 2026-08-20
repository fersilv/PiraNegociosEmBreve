import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Plus,
  TrendingUp,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { api, asArray } from "../lib/api";
import { useAuth, getGreetingName } from "../contexts/AuthContext";

type CompanySummary = {
  id: string;
  name?: string;
  isVerified?: boolean;
  verificationStatus?: string;
};

type JobSummary = {
  id: string;
  title: string;
  active?: boolean;
  views?: number;
  createdAt?: string;
  companyId?: string | null;
};

type ApplicationSummary = {
  id: string;
  jobId: string;
  status?: string;
  createdAt?: string;
};

type JobWithApplications = JobSummary & {
  applications: ApplicationSummary[];
};

export function CompanyHomePage() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [jobs, setJobs] = useState<JobWithApplications[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [companyResponse, ownedJobsResponse] = await Promise.all([
          api.get("/companies/mine"),
          api.get("/jobs/me").catch(() => ({ data: [] })),
        ]);

        const companyData = Array.isArray(companyResponse.data)
          ? companyResponse.data[0]
          : companyResponse.data;
        if (!mounted) return;
        setCompany(companyData || null);

        let companyJobs = asArray(ownedJobsResponse.data) as JobSummary[];
        if (profile?.companyId) {
          companyJobs = companyJobs.filter(
            (job) => !job.companyId || job.companyId === profile.companyId,
          );
        }

        if (companyJobs.length === 0 && profile?.companyId) {
          const activeJobsResponse = await api
            .get(`/companies/${profile.companyId}/talent-jobs`)
            .catch(() => ({ data: [] }));
          companyJobs = asArray(activeJobsResponse.data) as JobSummary[];
        }

        const hydratedJobs = await Promise.all(
          companyJobs.slice(0, 30).map(async (job) => {
            const response = await api
              .get(`/applications/job/${job.id}`)
              .catch(() => ({ data: [] }));
            return {
              ...job,
              applications: asArray(response.data) as ApplicationSummary[],
            };
          }),
        );

        if (mounted) setJobs(hydratedJobs);
      } catch (error) {
        console.error("Erro ao carregar o painel da empresa:", error);
        if (mounted) {
          setCompany(null);
          setJobs([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [profile?.companyId]);

  const stats = useMemo(() => {
    const allApplications = jobs.flatMap((job) => job.applications);
    const activeJobs = jobs.filter((job) => job.active !== false).length;
    const newApplications = allApplications.filter(
      (application) => application.status === "PENDING",
    ).length;
    const inProgress = allApplications.filter((application) =>
      [
        "REVIEWING",
        "DOCUMENTS_REQUESTED",
        "DOCUMENTS_SUBMITTED",
      ].includes(application.status || ""),
    ).length;
    const totalViews = jobs.reduce(
      (total, job) => total + Number(job.views || 0),
      0,
    );

    return {
      activeJobs,
      newApplications,
      inProgress,
      totalViews,
      allApplications,
    };
  }, [jobs]);

  const topJobs = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => b.applications.length - a.applications.length)
        .slice(0, 4),
    [jobs],
  );

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center text-stone-500">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-terracotta-600" />
          <p className="text-sm font-medium">Organizando o painel da empresa...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="rounded-[28px] border border-stone-200 bg-white p-8 text-center shadow-sm md:p-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-terracotta-50 text-terracotta-700">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-950">
            Crie seu espaço empresarial
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-stone-500">
            Cadastre a empresa para publicar vagas, organizar candidaturas e
            acessar o banco de talentos em um ambiente separado do seu perfil
            pessoal.
          </p>
          <Link
            to="/dashboard/empresa"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-6 py-3 font-bold text-white transition hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Cadastrar empresa
          </Link>
        </div>
      </div>
    );
  }

  const verified =
    company.isVerified === true || company.verificationStatus === "VERIFIED";

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-7 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
                Workspace da empresa
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  verified
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {verified ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Clock3 className="h-3.5 w-3.5" />
                )}
                {verified ? "Empresa verificada" : "Verificação pendente"}
              </span>
            </div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
              {company.name || profile?.companyName || "Sua empresa"}
            </h1>
            <p className="mt-2 text-sm text-stone-500 md:text-base">
              Bom ter você por aqui, {getGreetingName(profile)}. Veja o que
              merece atenção hoje.
            </p>
          </div>

          <Link
            to="/dashboard/empresa/painel"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-terracotta-700 md:w-auto"
          >
            <Plus className="h-4 w-4" />
            Publicar vaga
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <MetricCard
          icon={<Briefcase className="h-5 w-5" />}
          value={stats.activeJobs}
          label="Vagas ativas"
          helper={`${jobs.length} no total`}
        />
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          value={stats.newApplications}
          label="Novas candidaturas"
          helper="Aguardando análise"
          accent
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5" />}
          value={stats.inProgress}
          label="Em andamento"
          helper="Processos ativos"
        />
        <MetricCard
          icon={<Eye className="h-5 w-5" />}
          value={stats.totalViews}
          label="Visualizações"
          helper="Nas suas vagas"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">
                Requer sua atenção
              </p>
              <h2 className="mt-1 text-xl font-bold text-stone-950">
                Candidaturas e vagas
              </h2>
            </div>
            <Link
              to="/dashboard/empresa/painel"
              className="hidden items-center gap-1 text-sm font-bold text-terracotta-700 hover:text-terracotta-900 sm:flex"
            >
              Ver vagas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {topJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center">
              <Briefcase className="mx-auto mb-3 h-8 w-8 text-stone-300" />
              <p className="font-bold text-stone-800">Nenhuma vaga publicada ainda</p>
              <p className="mt-1 text-sm text-stone-500">
                Sua primeira vaga já transforma este espaço em um painel vivo.
              </p>
              <Link
                to="/dashboard/empresa/painel"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Publicar primeira vaga
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {topJobs.map((job) => {
                const pending = job.applications.filter(
                  (application) => application.status === "PENDING",
                ).length;
                return (
                  <Link
                    key={job.id}
                    to={`/dashboard/vaga/${job.id}`}
                    className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600 group-hover:bg-terracotta-50 group-hover:text-terracotta-700">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold text-stone-900">
                          {job.title}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            job.active === false
                              ? "bg-stone-100 text-stone-500"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {job.active === false ? "Pausada" : "Ativa"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {job.applications.length} candidatura
                        {job.applications.length === 1 ? "" : "s"}
                        {pending > 0 ? ` · ${pending} nova${pending === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-stone-300 transition group-hover:translate-x-1 group-hover:text-terracotta-700" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-stone-200 bg-stone-950 p-6 text-white shadow-sm">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <UserRoundSearch className="h-5 w-5 text-orange-200" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">
              Banco de talentos
            </p>
            <h3 className="mt-2 text-xl font-bold">
              Encontre pessoas antes mesmo de publicar uma vaga.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-400">
              Consulte perfis disponíveis, salve talentos e organize sua base de
              recrutamento.
            </p>
            <Link
              to="/dashboard/curriculos"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-orange-200 hover:text-white"
            >
              Explorar talentos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">
              Atalhos
            </p>
            <div className="mt-4 space-y-2">
              <QuickLink
                to="/dashboard/empresa"
                icon={<Building2 className="h-4 w-4" />}
                label="Perfil da empresa"
              />
              <QuickLink
                to="/dashboard/configuracao-contratacao"
                icon={<FileText className="h-4 w-4" />}
                label="Configurações de contratação"
              />
              <QuickLink
                to="/dashboard/empresa/painel"
                icon={<Briefcase className="h-4 w-4" />}
                label="Gerenciar vagas"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  value,
  label,
  helper,
  accent = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  helper: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border p-4 shadow-sm md:p-5 ${
        accent
          ? "border-terracotta-100 bg-terracotta-50/70"
          : "border-stone-200 bg-white"
      }`}
    >
      <div
        className={`mb-5 flex h-10 w-10 items-center justify-center rounded-2xl ${
          accent
            ? "bg-white text-terracotta-700"
            : "bg-stone-100 text-stone-600"
        }`}
      >
        {icon}
      </div>
      <div className="text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-sm font-bold text-stone-800">{label}</div>
      <div className="mt-1 text-[11px] text-stone-500 md:text-xs">{helper}</div>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-terracotta-800"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-500 group-hover:bg-terracotta-50 group-hover:text-terracotta-700">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-4 w-4 text-stone-300 transition group-hover:translate-x-1" />
    </Link>
  );
}
