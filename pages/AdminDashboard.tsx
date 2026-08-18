import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, asArray } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { CityStateSelector } from "../components/CityStateSelector";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Shield,
  Users,
  KeyRound,
  Copy,
  X,
} from "lucide-react";

type Tab =
  "overview" | "companies" | "jobs" | "users" | "access" | "advertising";
type AdminDashboardMode = "dashboard" | "moderation";
type AdminSection = Exclude<Tab, "overview">;
type Company = {
  id: string;
  name: string;
  cityState?: string;
  city?: string;
  state?: string;
  phone?: string;
  category?: string;
  verificationStatus: string;
  pendingSlug?: string | null;
  slugChangeStatus?: string;
};
type Job = {
  id: string;
  title: string;
  companyId: string | null;
  companyName: string;
  location?: string;
  active: boolean;
  isExternalListing?: boolean;
  sourceName?: string | null;
  ingestionSourceName?: string | null;
  moderationStatus?: string;
  reportCount?: number;
};
type PlatformUser = {
  id: string;
  email?: string;
  displayName?: string;
  fullName?: string;
  type?: string;
  createdAt: string;
};
type Summary = {
  companies: number;
  pendingCompanies: number;
  activeJobs: number;
  users: number;
  activeVisitors?: number;
  uniqueVisitors?: number;
  pageViews?: number;
  averageEngagementSeconds?: number;
  accountAccesses?: number;
  newDevices?: number;
  sources?: Array<{ source: string; count: number }>;
  devices?: Array<{ device: string; count: number }>;
  topPages?: Array<{ path: string; count: number }>;
};
type AccessRequest = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  companyName: string;
};

const statusStyle: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  DRAFT: "bg-stone-100 text-stone-600",
};

export function AdminDashboard({
  mode = "dashboard",
  section = "companies",
}: {
  mode?: AdminDashboardMode;
  section?: AdminSection;
}) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>(
    mode === "dashboard" ? "overview" : section,
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [companyDetail, setCompanyDetail] = useState<any | null>(null);
  const [userDetail, setUserDetail] = useState<any | null>(null);
  const [sanctionForm, setSanctionForm] = useState({
    type: "ADVERTÊNCIA",
    reason: "",
    expiresAt: "",
  });
  const [companyForm, setCompanyForm] = useState({
    name: "",
    cityState: "Pirassununga, SP",
    phone: "",
    cnpj: "",
    category: "EMPLOYER",
    verificationStatus: "DRAFT",
  });
  const [jobForm, setJobForm] = useState({
    companyId: "",
    isExternalListing: false,
    sourceName: "",
    sourceUrl: "",
    title: "",
    location: "Pirassununga, SP",
    type: "CLT",
    workModel: "Presencial",
    salary: "",
    deadlineDate: "",
    description: "",
    requirements: "",
    acceptsPlatformApplications: true,
    externalApplicationInstructions: "",
    applicationEmail: "",
    applicationWhatsApp: "",
  });

  const load = useCallback(
    async (currentTab = tab) => {
      setLoading(true);
      setError("");
      try {
        const requests: Promise<any>[] = [api.get("/admin/summary")];
        if (currentTab === "companies")
          requests.push(api.get("/admin/companies"));
        if (currentTab === "jobs") requests.push(api.get("/admin/jobs"));
        if (currentTab === "users") requests.push(api.get("/admin/users"));
        if (currentTab === "access")
          requests.push(api.get("/admin/company-access-requests"));
        const responses = await Promise.all(requests);
        setSummary(responses[0].data);
        let index = 1;
        if (currentTab === "companies")
          setCompanies(asArray(responses[index++].data));
        if (currentTab === "jobs") setJobs(asArray(responses[index++].data));
        if (currentTab === "users") setUsers(asArray(responses[index++].data));
        if (currentTab === "access")
          setAccessRequests(asArray(responses[index++].data));
      } catch (requestError: any) {
        setError(
          requestError.response?.data?.message ||
            "Não foi possível carregar os dados administrativos.",
        );
      } finally {
        setLoading(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    load(tab);
    const interval =
      mode === "dashboard"
        ? window.setInterval(() => load("overview"), 30000)
        : undefined;
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [load, mode, tab]);
  useEffect(() => {
    setSearch("");
    setTab(mode === "dashboard" ? "overview" : section);
  }, [mode, section]);

  const submitCompany = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/admin/companies", companyForm);
      setCompanyFormOpen(false);
      setCompanyForm({
        name: "",
        cityState: "Pirassununga, SP",
        phone: "",
        cnpj: "",
        category: "EMPLOYER",
        verificationStatus: "DRAFT",
      });
      await load("companies");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível criar a empresa.",
      );
    } finally {
      setSaving(false);
    }
  };
  const submitJob = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/admin/jobs", jobForm);
      setJobFormOpen(false);
      setJobForm({
        companyId: "",
        isExternalListing: false,
        sourceName: "",
        sourceUrl: "",
        title: "",
        location: "Pirassununga, SP",
        type: "CLT",
        workModel: "Presencial",
        salary: "",
        deadlineDate: "",
        description: "",
        requirements: "",
        acceptsPlatformApplications: true,
        externalApplicationInstructions: "",
        applicationEmail: "",
        applicationWhatsApp: "",
      });
      await load("jobs");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível publicar a vaga.",
      );
    } finally {
      setSaving(false);
    }
  };
  const updateCompanyStatus = async (
    company: Company,
    verificationStatus: string,
  ) => {
    try {
      await api.put(`/admin/companies/${company.id}`, { verificationStatus });
      await load("companies");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível atualizar a empresa.",
      );
    }
  };
  const toggleJob = async (job: Job) => {
    try {
      await api.put(`/admin/jobs/${job.id}`, { active: !job.active });
      await load("jobs");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível atualizar a vaga.",
      );
    }
  };
  const deleteJob = async (job: Job) => {
    if (!window.confirm(`Excluir permanentemente a vaga “${job.title}”?`))
      return;
    try {
      await api.delete(`/admin/jobs/${job.id}`);
      await load("jobs");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível excluir a vaga.",
      );
    }
  };
  const reviewAccessRequest = async (
    request: AccessRequest,
    action: "approve" | "reject",
    role: "admin" | "colaborador" = "colaborador",
  ) => {
    try {
      await api.put(`/admin/company-access-requests/${request.id}`, {
        action,
        role,
      });
      await load("access");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível processar a solicitação.",
      );
    }
  };
  const inspectCompany = async (id: string) => {
    try {
      setCompanyDetail((await api.get(`/admin/companies/${id}`)).data);
    } catch {
      setError("Não foi possível abrir os dados da empresa.");
    }
  };
  const inspectUser = async (id: string) => {
    try {
      setUserDetail((await api.get(`/admin/users/${id}`)).data);
    } catch {
      setError("Não foi possível abrir os dados do usuário.");
    }
  };
  const issueSanction = async (event: FormEvent) => {
    event.preventDefault();
    if (!userDetail) return;
    setSaving(true);
    try {
      await api.post(`/admin/users/${userDetail.user.id}/sanctions`, {
        ...sanctionForm,
        expiresAt: sanctionForm.expiresAt || null,
      });
      await inspectUser(userDetail.user.id);
      setSanctionForm({ type: "ADVERTÊNCIA", reason: "", expiresAt: "" });
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível registrar a sanção.",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveCompanyDetail = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyDetail) return;
    setSaving(true);
    try {
      const response = await api.put(
        `/admin/companies/${companyDetail.company.id}`,
        companyDetail.company,
      );
      setCompanyDetail({ ...companyDetail, company: response.data });
      await load("companies");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível salvar a empresa.",
      );
    } finally {
      setSaving(false);
    }
  };
  const reviewCompanySlug = async (action: "approve" | "reject") => {
    if (!companyDetail) return;
    try {
      await api.put(
        `/admin/companies/${companyDetail.company.id}/slug-request`,
        { action },
      );
      await inspectCompany(companyDetail.company.id);
      await load("companies");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível revisar a alteração da URL.",
      );
    }
  };
  const saveUserDetail = async (event: FormEvent) => {
    event.preventDefault();
    if (!userDetail) return;
    setSaving(true);
    try {
      const response = await api.put(
        `/admin/users/${userDetail.user.id}`,
        userDetail.user,
      );
      setUserDetail({ ...userDetail, user: response.data });
      await load("users");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível salvar o usuário.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (profile?.type !== "ADMIN")
    return (
      <div className="p-8 text-center font-bold text-red-700">
        Acesso restrito à administração.
      </div>
    );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCompanies = companies.filter((company) =>
    `${company.name} ${company.cityState || ""}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
  const filteredJobs = jobs.filter((job) =>
    `${job.title} ${job.companyName} ${job.location || ""}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
  const filteredUsers = users.filter((user) =>
    `${user.fullName || ""} ${user.displayName || ""} ${user.email || ""}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
  const sectionMeta: Record<
    AdminSection,
    { title: string; description: string }
  > = {
    companies: {
      title: "Empresas",
      description: "Cadastre, edite e verifique empresas da plataforma.",
    },
    jobs: {
      title: "Vagas",
      description: "Publique, revise e acompanhe todas as vagas cadastradas.",
    },
    users: {
      title: "Usuários",
      description: "Consulte contas, dados, acessos e histórico de sanções.",
    },
    access: {
      title: "Vínculos",
      description: "Aprove ou recuse solicitações de acesso às empresas.",
    },
    advertising: {
      title: "Publicidade",
      description: "Gerencie anunciantes, campanhas, espaços e AdSense.",
    },
  };
  const currentSection =
    mode === "moderation" ? sectionMeta[tab as AdminSection] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
            {mode === "dashboard"
              ? "Inteligência da plataforma"
              : "Administração da plataforma"}
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-serif font-bold text-stone-900">
            <Shield className="text-terracotta-600" />{" "}
            {mode === "dashboard" ? "Dashboard" : currentSection?.title}
          </h1>
          <p className="mt-1 text-stone-500">
            {mode === "dashboard"
              ? "Acompanhe audiência, navegação e sinais de segurança em tempo real."
              : currentSection?.description}
          </p>
        </div>
        {mode === "dashboard" ? (
          <Link
            to="/dashboard/admin/vagas"
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-stone-800"
          >
            Gerenciar vagas <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <div className="flex gap-2">
            {tab === "companies" && (
              <button
                onClick={() => setCompanyFormOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50"
              >
                <Building2 className="h-4 w-4" /> Nova empresa
              </button>
            )}
            {tab === "jobs" && (
              <button
                onClick={() => {
                  setJobForm((prev) => ({
                    ...prev,
                    companyId: prev.companyId || companies[0]?.id || "",
                  }));
                  setJobFormOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-terracotta-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-terracotta-700"
              >
                <Plus className="h-4 w-4" /> Publicar vaga
              </button>
            )}
          </div>
        )}
      </header>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Fechar aviso">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-terracotta-600" />
        </div>
      ) : (
        <>
          {mode === "dashboard" && (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                value={summary?.activeVisitors || 0}
                label="Visitantes ativos agora"
              />
              <MetricCard
                value={summary?.uniqueVisitors || 0}
                label="Visitantes únicos — 30 dias"
              />
              <MetricCard
                value={summary?.pageViews || 0}
                label="Páginas vistas — 30 dias"
              />
              <MetricCard
                value={`${summary?.averageEngagementSeconds || 0}s`}
                label="Tempo médio no site"
              />
            </section>
          )}
          {mode === "dashboard" && (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <MetricList
                  title="Origens de acesso"
                  items={summary?.sources || []}
                />
                <MetricList
                  title="Dispositivos mais usados"
                  items={summary?.devices || []}
                />
                <MetricList
                  title="Páginas mais vistas"
                  items={(summary?.topPages || []).map((item) => ({
                    source: item.path,
                    count: item.count,
                  }))}
                />
              </div>
              <section className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    Acessos autenticados — 30 dias
                  </p>
                  <p className="mt-2 text-3xl font-bold text-amber-950">
                    {summary?.accountAccesses || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    Primeiro acesso em dispositivo
                  </p>
                  <p className="mt-2 text-3xl font-bold text-amber-950">
                    {summary?.newDevices || 0}
                  </p>
                  <p className="text-xs text-amber-800">
                    Dados com hash para segurança; sem exibir IP bruto.
                  </p>
                </div>
              </section>
            </div>
          )}
          {mode === "moderation" && (
            <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-stone-900">
                    {tab === "companies"
                      ? "Empresas"
                      : tab === "jobs"
                        ? "Vagas"
                        : tab === "users"
                          ? "Usuários"
                          : tab === "access"
                            ? "Solicitações de vínculo"
                            : "Publicidade e AdSense"}
                  </h2>
                  <p className="text-sm text-stone-500">
                    {tab === "companies"
                      ? "Verifique empresas e publique oportunidades vinculadas."
                      : tab === "jobs"
                        ? "Modere e acompanhe as vagas publicadas."
                        : tab === "users"
                          ? "Consulta de contas registradas na plataforma."
                          : tab === "access"
                            ? "Aprove ou recuse pedidos de acesso a empresas existentes."
                            : "Gerencie contratos, posições comerciais e configuração do AdSense."}
                  </p>
                </div>
                {tab !== "advertising" && (
                  <label className="relative block">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar..."
                      className="rounded-xl border border-stone-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-terracotta-500"
                    />
                  </label>
                )}
              </div>
              <div className="overflow-x-auto">
                {tab === "companies" && (
                  <CompaniesTable
                    companies={filteredCompanies}
                    onVerify={updateCompanyStatus}
                    onInspect={inspectCompany}
                    onCreateJob={(company) => {
                      setJobForm((prev) => ({
                        ...prev,
                        companyId: company.id,
                      }));
                      setJobFormOpen(true);
                    }}
                  />
                )}
                {tab === "jobs" && (
                  <JobsTable
                    jobs={filteredJobs}
                    onToggle={toggleJob}
                    onDelete={deleteJob}
                  />
                )}
                {tab === "users" && (
                  <UsersTable users={filteredUsers} onInspect={inspectUser} />
                )}
                {tab === "access" && (
                  <div className="divide-y divide-stone-100 p-5">
                    {accessRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-bold text-stone-900">
                            {request.requesterName}{" "}
                            <span className="font-normal text-stone-500">
                              quer acessar {request.companyName}
                            </span>
                          </p>
                          <p className="text-xs text-stone-600">
                            {request.requesterEmail}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              reviewAccessRequest(
                                request,
                                "approve",
                                "colaborador",
                              )
                            }
                            className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700"
                          >
                            Colaborador
                          </button>
                          <button
                            onClick={() =>
                              reviewAccessRequest(request, "approve", "admin")
                            }
                            className="rounded-lg bg-terracotta-600 px-3 py-2 text-xs font-bold text-white"
                          >
                            Aprovar como admin
                          </button>
                          <button
                            onClick={() =>
                              reviewAccessRequest(request, "reject")
                            }
                            className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                          >
                            Recusar
                          </button>
                        </div>
                      </div>
                    ))}
                    {!accessRequests.length && (
                      <p className="text-sm text-stone-500">
                        Não há solicitações pendentes.
                      </p>
                    )}
                  </div>
                )}
                {tab === "advertising" && <AdvertisingPanel />}
              </div>
            </div>
          )}
        </>
      )}
      {companyFormOpen && (
        <Modal
          title="Cadastrar empresa"
          onClose={() => setCompanyFormOpen(false)}
        >
          <form onSubmit={submitCompany} className="space-y-4">
            <Field label="Nome da empresa *">
              <input
                required
                value={companyForm.name}
                onChange={(event) =>
                  setCompanyForm({ ...companyForm, name: event.target.value })
                }
                className="input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado e cidade">
                <CityStateSelector
                  initialValue={companyForm.cityState}
                  onLocationChange={(cityState) =>
                    setCompanyForm({ ...companyForm, cityState })
                  }
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={companyForm.phone}
                  onChange={(event) =>
                    setCompanyForm({
                      ...companyForm,
                      phone: event.target.value,
                    })
                  }
                  className="input"
                />
              </Field>
              <Field label="CNPJ">
                <input
                  value={companyForm.cnpj}
                  onChange={(event) =>
                    setCompanyForm({ ...companyForm, cnpj: event.target.value })
                  }
                  className="input"
                />
              </Field>
              <Field label="Categoria">
                <select
                  value={companyForm.category}
                  onChange={(event) =>
                    setCompanyForm({
                      ...companyForm,
                      category: event.target.value,
                    })
                  }
                  className="input"
                >
                  <option value="EMPLOYER">Empresa empregadora</option>
                  <option value="SERVICE_PROVIDER">Prestador de serviço</option>
                  <option value="RETAILER">Lojista</option>
                  <option value="OTHER">Outro negócio</option>
                </select>
              </Field>
              <Field label="Situação inicial">
                <select
                  value={companyForm.verificationStatus}
                  onChange={(event) =>
                    setCompanyForm({
                      ...companyForm,
                      verificationStatus: event.target.value,
                    })
                  }
                  className="input"
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="VERIFIED">Verificada</option>
                </select>
              </Field>
            </div>
            <Actions saving={saving} text="Cadastrar empresa" />
          </form>
        </Modal>
      )}
      {jobFormOpen && (
        <Modal title="Publicar vaga" onClose={() => setJobFormOpen(false)}>
          <form onSubmit={submitJob} className="space-y-4">
            <label className="flex gap-3 rounded-xl border border-stone-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={jobForm.isExternalListing}
                onChange={(event) =>
                  setJobForm({
                    ...jobForm,
                    isExternalListing: event.target.checked,
                    companyId: event.target.checked ? "" : jobForm.companyId,
                  })
                }
              />
              <span>
                <strong>Vaga externa / sem empresa vinculada</strong>
                <small className="mt-1 block text-stone-500">
                  Somente a administração pode publicar vagas captadas em
                  grupos, redes ou outros sites.
                </small>
              </span>
            </label>
            {!jobForm.isExternalListing ? (
              <Field label="Empresa *">
                <select
                  required
                  value={jobForm.companyId}
                  onChange={(event) =>
                    setJobForm({ ...jobForm, companyId: event.target.value })
                  }
                  className="input"
                >
                  <option value="">Selecione uma empresa</option>
                  {companies.map((company) => (
                    <option value={company.id} key={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome da fonte ou anunciante">
                  <input
                    value={jobForm.sourceName}
                    onChange={(event) =>
                      setJobForm({ ...jobForm, sourceName: event.target.value })
                    }
                    placeholder="Ex.: Grupo Vagas Pirassununga"
                    className="input"
                  />
                </Field>
                <Field label="Link original da vaga">
                  <input
                    type="url"
                    value={jobForm.sourceUrl}
                    onChange={(event) =>
                      setJobForm({ ...jobForm, sourceUrl: event.target.value })
                    }
                    placeholder="https://..."
                    className="input"
                  />
                </Field>
              </div>
            )}
            <Field label="Título da vaga *">
              <input
                required
                value={jobForm.title}
                onChange={(event) =>
                  setJobForm({ ...jobForm, title: event.target.value })
                }
                className="input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado e cidade *">
                <CityStateSelector
                  initialValue={jobForm.location}
                  onLocationChange={(location) =>
                    setJobForm({ ...jobForm, location })
                  }
                />
              </Field>
              <Field label="Contrato">
                <select
                  value={jobForm.type}
                  onChange={(event) =>
                    setJobForm({ ...jobForm, type: event.target.value })
                  }
                  className="input"
                >
                  <option>CLT</option>
                  <option>PJ</option>
                  <option>Estágio</option>
                  <option>Freelancer</option>
                </select>
              </Field>
              <Field label="Regime de trabalho">
                <select
                  value={jobForm.workModel}
                  onChange={(event) =>
                    setJobForm({ ...jobForm, workModel: event.target.value })
                  }
                  className="input"
                >
                  <option value="Presencial">Presencial</option>
                  <option value="Híbrido">Híbrido</option>
                  <option value="Remoto">Remoto</option>
                </select>
              </Field>
              <Field label="Salário (opcional)">
                <input
                  value={jobForm.salary}
                  onChange={(event) =>
                    setJobForm({ ...jobForm, salary: event.target.value })
                  }
                  placeholder="Ex.: R$ 2.100,00 ou A combinar"
                  className="input"
                />
              </Field>
              <Field label="Prazo da vaga (opcional)">
                <input
                  type="date"
                  value={jobForm.deadlineDate}
                  onChange={(event) =>
                    setJobForm({ ...jobForm, deadlineDate: event.target.value })
                  }
                  className="input"
                />
              </Field>
            </div>
            <Field label="Sobre a vaga / atividades *">
              <textarea
                required
                rows={5}
                value={jobForm.description}
                onChange={(event) =>
                  setJobForm({ ...jobForm, description: event.target.value })
                }
                placeholder="Responsabilidades, atividades e benefícios."
                className="input"
              />
            </Field>
            <Field label="Requisitos">
              <textarea
                rows={4}
                value={jobForm.requirements || ""}
                onChange={(event) =>
                  setJobForm({ ...jobForm, requirements: event.target.value })
                }
                placeholder="Experiência, formação, habilidades e disponibilidade."
                className="input"
              />
            </Field>
            <label className="flex gap-3 rounded-xl border border-stone-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={jobForm.acceptsPlatformApplications}
                onChange={(event) =>
                  setJobForm({
                    ...jobForm,
                    acceptsPlatformApplications: event.target.checked,
                  })
                }
              />{" "}
              <span>
                <strong>Receber candidaturas pela plataforma</strong>
                <small className="mt-1 block text-stone-500">
                  Desmarque para informar um canal externo.
                </small>
              </span>
            </label>
            {!jobForm.acceptsPlatformApplications && (
              <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="WhatsApp para candidatura">
                    <input
                      value={jobForm.applicationWhatsApp}
                      onChange={(event) =>
                        setJobForm({
                          ...jobForm,
                          applicationWhatsApp: event.target.value,
                        })
                      }
                      placeholder="(19) 99999-9999"
                      className="input"
                    />
                  </Field>
                  <Field label="E-mail para candidatura">
                    <input
                      type="email"
                      value={jobForm.applicationEmail}
                      onChange={(event) =>
                        setJobForm({
                          ...jobForm,
                          applicationEmail: event.target.value,
                        })
                      }
                      placeholder="rh@empresa.com.br"
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="Outras instruções (opcional)">
                  <textarea
                    rows={3}
                    value={jobForm.externalApplicationInstructions}
                    onChange={(event) =>
                      setJobForm({
                        ...jobForm,
                        externalApplicationInstructions: event.target.value,
                      })
                    }
                    className="input"
                  />
                </Field>
                <p className="text-xs text-amber-800">
                  Informe ao menos WhatsApp, e-mail ou uma instrução de
                  candidatura.
                </p>
              </div>
            )}
            <Actions saving={saving} text="Publicar vaga" />
          </form>
        </Modal>
      )}
      {companyDetail && (
        <Modal
          title={companyDetail.company.name}
          onClose={() => setCompanyDetail(null)}
        >
          <div className="space-y-5 text-sm">
            <form
              onSubmit={saveCompanyDetail}
              className="space-y-3 rounded-xl border border-stone-200 p-4"
            >
              <h3 className="font-bold text-stone-900">Editar empresa</h3>
              <Field label="Nome">
                <input
                  value={companyDetail.company.name || ""}
                  onChange={(event) =>
                    setCompanyDetail({
                      ...companyDetail,
                      company: {
                        ...companyDetail.company,
                        name: event.target.value,
                      },
                    })
                  }
                  className="input"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Categoria">
                  <select
                    value={companyDetail.company.category || "EMPLOYER"}
                    onChange={(event) =>
                      setCompanyDetail({
                        ...companyDetail,
                        company: {
                          ...companyDetail.company,
                          category: event.target.value,
                        },
                      })
                    }
                    className="input"
                  >
                    <option value="EMPLOYER">Empresa empregadora</option>
                    <option value="SERVICE_PROVIDER">
                      Prestador de serviço
                    </option>
                    <option value="RETAILER">Lojista</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </Field>
                <Field label="Situação">
                  <select
                    value={companyDetail.company.verificationStatus || "DRAFT"}
                    onChange={(event) =>
                      setCompanyDetail({
                        ...companyDetail,
                        company: {
                          ...companyDetail.company,
                          verificationStatus: event.target.value,
                        },
                      })
                    }
                    className="input"
                  >
                    <option value="DRAFT">Rascunho</option>
                    <option value="PENDING">Em análise</option>
                    <option value="VERIFIED">Verificada</option>
                    <option value="REJECTED">Recusada</option>
                  </select>
                </Field>
              </div>
              <Field label="Endereço público">
                <input
                  value={companyDetail.company.slug || ""}
                  onChange={(event) =>
                    setCompanyDetail({
                      ...companyDetail,
                      company: {
                        ...companyDetail.company,
                        slug: event.target.value,
                      },
                    })
                  }
                  className="input"
                />
              </Field>
              {companyDetail.company.slugChangeStatus === "PENDING" &&
                companyDetail.company.pendingSlug && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p>
                      URL solicitada:{" "}
                      <strong>
                        piranegocios.com.br/{companyDetail.company.pendingSlug}
                      </strong>
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      A URL atual continua ativa. Ao aprovar, ela redirecionará
                      para a nova durante 90 dias.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => reviewCompanySlug("approve")}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Aprovar URL
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewCompanySlug("reject")}
                        className="rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                )}
              <Field label="Descrição">
                <textarea
                  value={companyDetail.company.description || ""}
                  onChange={(event) =>
                    setCompanyDetail({
                      ...companyDetail,
                      company: {
                        ...companyDetail.company,
                        description: event.target.value,
                      },
                    })
                  }
                  className="input"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Telefone">
                  <input
                    value={companyDetail.company.phone || ""}
                    onChange={(event) =>
                      setCompanyDetail({
                        ...companyDetail,
                        company: {
                          ...companyDetail.company,
                          phone: event.target.value,
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Estado e cidade">
                  <CityStateSelector
                    initialValue={companyDetail.company.cityState || ""}
                    onLocationChange={(cityState) =>
                      setCompanyDetail({
                        ...companyDetail,
                        company: {
                          ...companyDetail.company,
                          cityState,
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Website">
                  <input
                    value={companyDetail.company.website || ""}
                    onChange={(event) =>
                      setCompanyDetail({
                        ...companyDetail,
                        company: {
                          ...companyDetail.company,
                          website: event.target.value,
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Endereço">
                  <input
                    value={companyDetail.company.address || ""}
                    onChange={(event) =>
                      setCompanyDetail({
                        ...companyDetail,
                        company: {
                          ...companyDetail.company,
                          address: event.target.value,
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
              </div>
              <Actions saving={saving} text="Salvar empresa" />
            </form>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                value={companyDetail.employees.length}
                label="Colaboradores"
              />
              <MetricCard value={companyDetail.jobs.length} label="Vagas" />
              <MetricCard
                value={companyDetail.applications.length}
                label="Candidaturas"
              />
            </div>
            <section>
              <h3 className="font-bold text-stone-900">
                Colaboradores vinculados
              </h3>
              <div className="mt-2 divide-y">
                {companyDetail.employees.map((employee: any) => (
                  <div className="py-2" key={employee.id}>
                    {employee.fullName ||
                      employee.displayName ||
                      employee.socialName ||
                      "Sem nome"}{" "}
                    <span className="text-stone-500">
                      — {employee.email || "sem e-mail"}
                    </span>
                  </div>
                )) || <p>Sem colaboradores.</p>}
              </div>
            </section>
            <section>
              <h3 className="font-bold text-stone-900">Vagas</h3>
              <div className="mt-2 divide-y">
                {companyDetail.jobs.map((job: any) => (
                  <div className="py-2" key={job.id}>
                    {job.title}{" "}
                    <span className="text-stone-500">
                      — {job.active ? "ativa" : "inativa"}
                    </span>
                  </div>
                )) || <p>Sem vagas.</p>}
              </div>
            </section>
          </div>
        </Modal>
      )}
      {userDetail && (
        <Modal
          title={
            userDetail.user.fullName ||
            userDetail.user.displayName ||
            userDetail.user.socialName ||
            "Usuário"
          }
          onClose={() => setUserDetail(null)}
        >
          <div className="space-y-5 text-sm">
            <p className="text-stone-600">
              {userDetail.user.email || "E-mail não informado"} · O e-mail é
              controlado pelo provedor de autenticação e não é alterado aqui.
            </p>
            <form
              onSubmit={saveUserDetail}
              className="space-y-3 rounded-xl border border-stone-200 p-4"
            >
              <h3 className="font-bold text-stone-900">Editar usuário</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome completo">
                  <input
                    value={userDetail.user.fullName || ""}
                    onChange={(event) =>
                      setUserDetail({
                        ...userDetail,
                        user: {
                          ...userDetail.user,
                          fullName: event.target.value,
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Nome social">
                  <input
                    value={userDetail.user.socialName || ""}
                    onChange={(event) =>
                      setUserDetail({
                        ...userDetail,
                        user: {
                          ...userDetail.user,
                          socialName: event.target.value,
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    value={userDetail.user.phone || ""}
                    onChange={(event) =>
                      setUserDetail({
                        ...userDetail,
                        user: { ...userDetail.user, phone: event.target.value },
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Perfil">
                  <select
                    value={userDetail.user.type || ""}
                    onChange={(event) =>
                      setUserDetail({
                        ...userDetail,
                        user: { ...userDetail.user, type: event.target.value },
                      })
                    }
                    className="input"
                  >
                    <option value="CANDIDATE">Candidato</option>
                    <option value="COMPANY">Empresa</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={userDetail.user.status || "ACTIVE"}
                    onChange={(event) =>
                      setUserDetail({
                        ...userDetail,
                        user: {
                          ...userDetail.user,
                          status: event.target.value,
                        },
                      })
                    }
                    className="input"
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="SUSPENDED">Suspenso</option>
                    <option value="BLOCKED">Bloqueado</option>
                  </select>
                </Field>
              </div>
              <Field label="Biografia">
                <textarea
                  value={userDetail.user.bio || ""}
                  onChange={(event) =>
                    setUserDetail({
                      ...userDetail,
                      user: { ...userDetail.user, bio: event.target.value },
                    })
                  }
                  className="input"
                />
              </Field>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(userDetail.user.isVerified)}
                  onChange={(event) =>
                    setUserDetail({
                      ...userDetail,
                      user: {
                        ...userDetail.user,
                        isVerified: event.target.checked,
                      },
                    })
                  }
                />{" "}
                Conta verificada
              </label>
              <Actions saving={saving} text="Salvar usuário" />
            </form>
            <section>
              <h3 className="font-bold text-stone-900">Histórico de sanções</h3>
              <div className="mt-2 space-y-2">
                {userDetail.sanctions.length ? (
                  userDetail.sanctions.map((sanction: any) => (
                    <div
                      className="rounded-lg bg-stone-50 p-3"
                      key={sanction.id}
                    >
                      <strong>{sanction.type}</strong>
                      <p>{sanction.reason}</p>
                      <small className="text-stone-500">
                        {new Date(sanction.createdAt).toLocaleString("pt-BR")}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-500">Nenhuma sanção registrada.</p>
                )}
              </div>
            </section>
            <form
              onSubmit={issueSanction}
              className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <h3 className="font-bold text-amber-950">Registrar sanção</h3>
              <select
                value={sanctionForm.type}
                onChange={(event) =>
                  setSanctionForm({ ...sanctionForm, type: event.target.value })
                }
                className="input"
              >
                <option>ADVERTÊNCIA</option>
                <option>SUSPENSÃO</option>
                <option>BLOQUEIO</option>
              </select>
              <textarea
                required
                value={sanctionForm.reason}
                onChange={(event) =>
                  setSanctionForm({
                    ...sanctionForm,
                    reason: event.target.value,
                  })
                }
                placeholder="Motivo objetivo e verificável"
                className="input"
              />
              <input
                type="date"
                value={sanctionForm.expiresAt}
                onChange={(event) =>
                  setSanctionForm({
                    ...sanctionForm,
                    expiresAt: event.target.value,
                  })
                }
                className="input"
              />
              <Actions saving={saving} text="Registrar" />
            </form>
            <section>
              <h3 className="font-bold text-stone-900">Acessos recentes</h3>
              <div className="mt-2 space-y-2">
                {userDetail.accesses.map((access: any) => (
                  <div className="rounded-lg bg-stone-50 p-3" key={access.id}>
                    {access.deviceType || "Dispositivo desconhecido"} ·{" "}
                    {access.browser || "navegador"} ·{" "}
                    {access.operatingSystem || "sistema"}{" "}
                    {access.isNewDevice && (
                      <strong className="text-amber-700">
                        {" "}
                        — novo dispositivo
                      </strong>
                    )}
                    <small className="block text-stone-500">
                      {new Date(access.createdAt).toLocaleString("pt-BR")}
                    </small>
                  </div>
                )) || (
                  <p className="text-stone-500">Sem acessos registrados.</p>
                )}
              </div>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Preview({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-stone-900">{title}</h2>
        <button
          onClick={onClick}
          className="text-sm font-bold text-terracotta-700"
        >
          Ver todas
        </button>
      </div>
      {children}
    </section>
  );
}
function MetricCard({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-stone-900">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{label}</p>
    </section>
  );
}
function MetricList({
  title,
  items,
}: {
  title: string;
  items: Array<{ source?: string; device?: string; count: number }>;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-bold text-stone-900">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${item.source || item.device}-${index}`}
              className="flex justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm"
            >
              <span className="text-stone-600">
                {item.source || item.device}
              </span>
              <strong className="text-stone-900">{item.count}</strong>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">
            Aguardando dados consentidos.
          </p>
        )}
      </div>
    </section>
  );
}
export function ApiV1Panel() {
  const [clients, setClients] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", sourceLabel: "" });
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    const [clientsResponse, requestsResponse] = await Promise.all([
      api.get("/admin/api-v1/clients"),
      api.get("/admin/api-v1/requests"),
    ]);
    setClients(asArray(clientsResponse.data));
    setRequests(asArray(requestsResponse.data));
  };
  useEffect(() => {
    load().catch(() =>
      setError("Não foi possível carregar as integrações da API."),
    );
  }, []);
  const createClient = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await api.post("/admin/api-v1/clients", form);
      setNewKey(response.data.apiKey);
      setForm({ name: "", sourceLabel: "" });
      await load();
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível gerar a chave.",
      );
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (client: any) => {
    await api.put(`/admin/api-v1/clients/${client.id}`, {
      active: !client.active,
    });
    await load();
  };
  const rotate = async (client: any) => {
    if (
      !window.confirm(
        `Trocar a chave de ${client.name}? A anterior deixará de funcionar imediatamente.`,
      )
    )
      return;
    const response = await api.post(
      `/admin/api-v1/clients/${client.id}/rotate`,
    );
    setNewKey(response.data.apiKey);
    await load();
  };
  const endpoint = `${window.location.origin}/api/v1/jobs`;
  const exampleBody = JSON.stringify(
    {
      title: "Repositor de mercadorias",
      sourceName: "Avenida Hortifruti",
      sourceUrl: "https://origem.example/vaga/123",
      city: "Pirassununga",
      state: "SP",
      description: "Descrição e atividades da vaga",
      requirements: "Experiência será um diferencial",
      type: "CLT",
      workModel: "Presencial",
      salary: "R$ 2.100,00",
      deadlineDate: "2026-09-30",
      applicationWhatsApp: "5519999999999",
      applicationEmail: "rh@example.com",
      externalApplicationInstructions:
        "Envie o currículo informando o título da vaga.",
      allowSimilarDuplicate: false,
    },
    null,
    2,
  );
  return (
    <div className="space-y-6 p-5">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <section className="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={createClient}
          className="space-y-3 rounded-2xl border border-stone-200 p-5"
        >
          <h3 className="flex items-center gap-2 font-bold text-stone-900">
            <KeyRound className="h-5 w-5 text-terracotta-600" /> Nova chave de
            integração
          </h3>
          <Field label="Nome interno">
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Agente IA — origem X"
              className="input"
            />
          </Field>
          <Field label="Origem padrão das vagas">
            <input
              required
              value={form.sourceLabel}
              onChange={(event) =>
                setForm({ ...form, sourceLabel: event.target.value })
              }
              placeholder="Nome do site, grupo ou agente"
              className="input"
            />
          </Field>
          <Actions saving={saving} text="Gerar chave" />
        </form>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-bold text-amber-950">Chave gerada</h3>
          {newKey ? (
            <>
              <p className="mt-1 text-sm text-amber-800">
                Copie agora. Por segurança, ela não será exibida novamente.
              </p>
              <code className="mt-3 block break-all rounded-xl bg-stone-950 p-3 text-xs text-emerald-300">
                {newKey}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(newKey)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-stone-700"
              >
                <Copy className="h-4 w-4" /> Copiar chave
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-amber-800">
              A chave completa só aparece imediatamente após criar ou
              rotacionar.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-stone-200 p-5">
        <h3 className="font-bold text-stone-900">Integrações cadastradas</h3>
        <div className="mt-3 space-y-2">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-3"
            >
              <div>
                <strong>{client.name}</strong>
                <p className="text-xs text-stone-500">
                  Origem: {client.sourceLabel} · Prefixo: {client.keyPrefix}… ·{" "}
                  {client.lastUsedAt
                    ? `último uso ${new Date(client.lastUsedAt).toLocaleString("pt-BR")}`
                    : "nunca utilizada"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => rotate(client)}
                  className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-stone-700"
                >
                  Trocar chave
                </button>
                <button
                  onClick={() => toggle(client)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${client.active ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                >
                  {client.active ? "Revogar" : "Reativar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-stone-200 p-5">
        <h3 className="font-bold text-stone-900">Atividade recente</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-2">Integração</th>
                <th className="py-2">Ação</th>
                <th className="py-2">Resultado</th>
                <th className="py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 20).map((request) => {
                const client = clients.find(
                  (item) => item.id === request.clientId,
                );
                return (
                  <tr key={request.id} className="border-t border-stone-100">
                    <td className="py-2 font-semibold text-stone-800">
                      {client?.name || request.clientId}
                    </td>
                    <td className="py-2 text-stone-600">{request.action}</td>
                    <td className="py-2 text-stone-600">{request.result}</td>
                    <td className="py-2 text-stone-500">
                      {new Date(request.createdAt).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!requests.length && (
            <p className="py-3 text-sm text-stone-500">
              Nenhuma requisição registrada ainda.
            </p>
          )}
        </div>
      </section>
      <section className="space-y-4 rounded-2xl border border-stone-200 p-5">
        <h3 className="font-bold text-stone-900">Documentação rápida</h3>
        <p className="text-sm text-stone-600">
          Base: <code>{endpoint}</code>. Autentique com{" "}
          <code>X-API-Key: SUA_CHAVE</code> ou{" "}
          <code>Authorization: Bearer SUA_CHAVE</code>. Limite: 60
          requisições/minuto por chave.
        </p>
        <p className="text-xs text-stone-500">
          Obrigatórios: <code>title</code> e <code>description</code>. Cidade e
          estado assumem Pirassununga/SP quando omitidos. A chave define a
          origem padrão; nenhum endpoint da API publica uma vaga diretamente. A
          consulta retorna todas as vagas cadastradas, inclusive vagas de
          empresas, externas, inativas e pendentes.
        </p>
        <div>
          <strong className="text-sm">1. Verificar duplicidade</strong>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-950 p-4 text-xs text-stone-200">
            POST {endpoint}/check{"\n"}X-API-Key: SUA_CHAVE{"\n"}Content-Type:
            application/json{"\n\n"}
            {exampleBody}
          </pre>
        </div>
        <div>
          <strong className="text-sm">2. Cadastrar para moderação</strong>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-950 p-4 text-xs text-stone-200">
            POST {endpoint}
            {"\n"}X-API-Key: SUA_CHAVE{"\n"}Content-Type: application/json
            {"\n\n"}
            {exampleBody}
          </pre>
          <p className="mt-2 text-xs text-stone-500">
            A API repete a verificação automaticamente. Vagas novas entram
            inativas com status PENDING; somente o admin publica. Se a IA
            confirmar que uma correspondência apenas aproximada não é duplicata,
            envie <code>allowSimilarDuplicate: true</code>. Uma duplicidade
            exata nunca é ignorada.
          </p>
        </div>
        <div>
          <strong className="text-sm">
            3. Pesquisar o catálogo completo de vagas
          </strong>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-950 p-4 text-xs text-stone-200">
            GET {endpoint}
            ?q=auxiliar+producao&amp;city=Pirassununga&amp;limit=50{"\n"}
            X-API-Key: SUA_CHAVE
          </pre>
          <p className="mt-2 text-xs text-stone-500">
            A pesquisa ignora acentos e a ordem das palavras e consulta título,
            empresa, fonte, descrição, requisitos, localização, contrato, regime
            e salário. Filtros: <code>active</code>, <code>external</code>,{" "}
            <code>city</code>, <code>state</code>, <code>type</code>,{" "}
            <code>workModel</code> e <code>companyId</code>. A resposta contém{" "}
            <code>data</code> e <code>pagination.nextCursor</code>.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-950 p-4 text-xs text-stone-200">
            GET {endpoint}
            ?q=auxiliar+producao&amp;city=Pirassununga&amp;limit=50&amp;cursor=NEXT_CURSOR
            {"\n"}X-API-Key: SUA_CHAVE
          </pre>
          <p className="mt-2 text-xs text-stone-500">
            Para a próxima página, repita exatamente os mesmos filtros e envie o
            cursor retornado. O cursor é assinado e não pode ser alterado.
          </p>
        </div>
      </section>
    </div>
  );
}
function AdvertisingPanel() {
  const [ads, setAds] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [config, setConfig] = useState<any>({
    googleAdsEnabled: false,
    googleAdsClient: "",
    googleAdsSlotLeaderboard: "",
    googleAdsSlotRectangle: "",
  });
  const [form, setForm] = useState({
    title: "",
    type: "leaderboard",
    imageURL: "",
    link: "",
    price: "",
    billingPeriod: "MONTHLY",
    startsAt: "",
    endsAt: "",
    ownerType: "company" as "company" | "user",
    ownerId: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    const [adsResponse, configResponse, companiesResponse, usersResponse] =
      await Promise.all([
        api.get("/admin/ads"),
        api.get("/configs/advertising"),
        api.get("/admin/companies"),
        api.get("/admin/users"),
      ]);
    setAds(asArray(adsResponse.data));
    setConfig(configResponse.data || config);
    setCompanies(asArray(companiesResponse.data));
    setUsers(asArray(usersResponse.data));
  };
  useEffect(() => {
    load().catch(() => undefined);
  }, []);
  const saveConfig = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put("/admin/advertising-config", config);
      await load();
    } finally {
      setSaving(false);
    }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/admin/ads", {
        ...form,
        companyId: form.ownerType === "company" ? form.ownerId : null,
        contractedByUserId: form.ownerType === "user" ? form.ownerId : null,
        price: form.price || null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      });
      setForm({
        title: "",
        type: "leaderboard",
        imageURL: "",
        link: "",
        price: "",
        billingPeriod: "MONTHLY",
        startsAt: "",
        endsAt: "",
        ownerType: "company",
        ownerId: "",
      });
      await load();
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "Não foi possível criar o anúncio.",
      );
    } finally {
      setSaving(false);
    }
  };
  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Envie uma imagem válida (PNG, JPG, WebP ou GIF).");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const payload = new FormData();
      payload.append("file", file);
      const response = await api.post("/uploads", payload);
      setForm((current) => ({ ...current, imageURL: response.data.url }));
    } catch {
      setError("Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };
  const toggle = async (ad: any) => {
    await api.put(`/admin/ads/${ad.id}`, { active: !ad.active });
    await load();
  };
  return (
    <div className="grid gap-6 p-5 lg:grid-cols-2">
      <form
        onSubmit={saveConfig}
        className="space-y-3 rounded-2xl border border-stone-200 p-5"
      >
        <h3 className="font-bold text-stone-900">Espaços Google AdSense</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(config.googleAdsEnabled)}
            onChange={(event) =>
              setConfig({ ...config, googleAdsEnabled: event.target.checked })
            }
          />{" "}
          Ativar AdSense
        </label>
        <Field label="Client ID">
          <input
            value={config.googleAdsClient || ""}
            onChange={(event) =>
              setConfig({ ...config, googleAdsClient: event.target.value })
            }
            placeholder="ca-pub-..."
            className="input"
          />
        </Field>
        <Field label="Slot leaderboard">
          <input
            value={config.googleAdsSlotLeaderboard || ""}
            onChange={(event) =>
              setConfig({
                ...config,
                googleAdsSlotLeaderboard: event.target.value,
              })
            }
            className="input"
          />
        </Field>
        <Field label="Slot rectangle">
          <input
            value={config.googleAdsSlotRectangle || ""}
            onChange={(event) =>
              setConfig({
                ...config,
                googleAdsSlotRectangle: event.target.value,
              })
            }
            className="input"
          />
        </Field>
        <Actions saving={saving} text="Salvar AdSense" />
      </form>
      <form
        onSubmit={create}
        className="space-y-3 rounded-2xl border border-stone-200 p-5"
      >
        <h3 className="font-bold text-stone-900">Novo anúncio contratado</h3>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Field label="Título">
          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            className="input"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pertence a">
            <select
              value={form.ownerType}
              onChange={(event) =>
                setForm({
                  ...form,
                  ownerType: event.target.value as "company" | "user",
                  ownerId: "",
                })
              }
              className="input"
            >
              <option value="company">Empresa</option>
              <option value="user">Usuário</option>
            </select>
          </Field>
          <Field
            label={
              form.ownerType === "company"
                ? "Empresa responsável *"
                : "Usuário responsável *"
            }
          >
            <select
              required
              value={form.ownerId}
              onChange={(event) =>
                setForm({ ...form, ownerId: event.target.value })
              }
              className="input"
            >
              <option value="">Selecione...</option>
              {form.ownerType === "company"
                ? companies.map((company) => (
                    <option value={company.id} key={company.id}>
                      {company.name}
                    </option>
                  ))
                : users.map((user) => (
                    <option value={user.id} key={user.id}>
                      {user.fullName ||
                        user.displayName ||
                        user.email ||
                        user.id}
                    </option>
                  ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Espaço">
            <select
              value={form.type}
              onChange={(event) =>
                setForm({ ...form, type: event.target.value })
              }
              className="input"
            >
              <option value="leaderboard">Topo / leaderboard</option>
              <option value="rectangle">Retângulo</option>
              <option value="sidebar">Lateral</option>
              <option value="carousel">Carrossel</option>
            </select>
          </Field>
          <Field label="Periodicidade">
            <select
              value={form.billingPeriod}
              onChange={(event) =>
                setForm({ ...form, billingPeriod: event.target.value })
              }
              className="input"
            >
              <option value="DAILY">Diário</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
              <option value="CAMPAIGN">Campanha</option>
            </select>
          </Field>
          <Field label="Valor">
            <input
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
              className="input"
              placeholder="0,00"
            />
          </Field>
          <Field label="Início">
            <input
              type="date"
              value={form.startsAt}
              onChange={(event) =>
                setForm({ ...form, startsAt: event.target.value })
              }
              className="input"
            />
          </Field>
          <Field label="Fim">
            <input
              type="date"
              value={form.endsAt}
              onChange={(event) =>
                setForm({ ...form, endsAt: event.target.value })
              }
              className="input"
            />
          </Field>
        </div>
        <Field label="URL da imagem">
          <input
            value={form.imageURL}
            onChange={(event) =>
              setForm({ ...form, imageURL: event.target.value })
            }
            placeholder="https://.../arte.png"
            className="input"
          />
        </Field>
        <Field label="Ou envie a arte">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => uploadImage(event.target.files?.[0])}
            className="input file:mr-3 file:rounded-lg file:border-0 file:bg-terracotta-50 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-terracotta-700"
          />
          <p className="mt-1 text-xs text-stone-500">
            {uploading
              ? "Enviando imagem..."
              : "Use uma URL ou faça upload. A URL enviada acima será preenchida automaticamente."}
          </p>
        </Field>
        <Field label="Destino">
          <input
            required
            value={form.link}
            onChange={(event) => setForm({ ...form, link: event.target.value })}
            placeholder="https://..."
            className="input"
          />
        </Field>
        <Actions saving={saving || uploading} text="Criar anúncio" />
      </form>
      <section className="lg:col-span-2">
        <h3 className="font-bold text-stone-900">Anúncios cadastrados</h3>
        <div className="mt-3 space-y-2">
          {ads.map((ad) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-3"
              key={ad.id}
            >
              <div>
                <strong>{ad.title}</strong>
                <p className="text-xs text-stone-500">
                  {ad.type} · {ad.billingPeriod || "sem periodicidade"} ·{" "}
                  {ad.endsAt
                    ? `até ${new Date(ad.endsAt).toLocaleDateString("pt-BR")}`
                    : "sem expiração"}
                </p>
                <p className="text-xs text-stone-500">
                  Responsável:{" "}
                  {ad.companyId
                    ? companies.find((company) => company.id === ad.companyId)
                        ?.name || "Empresa removida"
                    : users.find((user) => user.id === ad.contractedByUserId)
                        ?.fullName ||
                      users.find((user) => user.id === ad.contractedByUserId)
                        ?.displayName ||
                      users.find((user) => user.id === ad.contractedByUserId)
                        ?.email ||
                      "Usuário removido"}
                </p>
              </div>
              <button
                onClick={() => toggle(ad)}
                className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-stone-700"
              >
                {ad.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          ))}
          {!ads.length && (
            <p className="text-sm text-stone-500">Nenhum anúncio cadastrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[status] || statusStyle.DRAFT}`}
    >
      {status === "VERIFIED"
        ? "Verificada"
        : status === "PENDING"
          ? "Pendente"
          : status === "REJECTED"
            ? "Recusada"
            : "Rascunho"}
    </span>
  );
}
function Empty({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center text-stone-500">
        {text}
      </td>
    </tr>
  );
}
function CompaniesTable({
  companies,
  onVerify,
  onInspect,
  onCreateJob,
}: {
  companies: Company[];
  onVerify: (company: Company, status: string) => void;
  onInspect: (id: string) => void;
  onCreateJob: (company: Company) => void;
}) {
  return (
    <table className="w-full min-w-[700px] text-left text-sm">
      <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
        <tr>
          <th className="px-5 py-3">Empresa</th>
          <th className="px-5 py-3">Localização</th>
          <th className="px-5 py-3">Situação</th>
          <th className="px-5 py-3 text-right">Ações</th>
        </tr>
      </thead>
      <tbody>
        {companies.map((company) => (
          <tr key={company.id} className="border-t border-stone-100">
            <td className="px-5 py-4 font-bold text-stone-800">
              {company.name}
              <span className="mt-1 block font-normal text-stone-500">
                {company.phone || "Sem telefone"}
              </span>
            </td>
            <td className="px-5 py-4 text-stone-600">
              {company.cityState || "—"}
            </td>
            <td className="px-5 py-4">
              <Status status={company.verificationStatus} />
              {company.slugChangeStatus === "PENDING" && (
                <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                  URL pendente
                </span>
              )}
            </td>
            <td className="px-5 py-4 text-right">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => onInspect(company.id)}
                  className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
                >
                  Abrir
                </button>
                <button
                  onClick={() =>
                    onVerify(
                      company,
                      company.verificationStatus === "VERIFIED"
                        ? "DRAFT"
                        : "VERIFIED",
                    )
                  }
                  className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
                >
                  {company.verificationStatus === "VERIFIED"
                    ? "Remover selo"
                    : "Verificar"}
                </button>
                <button
                  onClick={() => onCreateJob(company)}
                  className="rounded-lg bg-terracotta-50 px-3 py-1.5 text-xs font-bold text-terracotta-700 hover:bg-terracotta-100"
                >
                  Criar vaga
                </button>
              </div>
            </td>
          </tr>
        ))}
        {companies.length === 0 && (
          <Empty colSpan={4} text="Nenhuma empresa encontrada." />
        )}
      </tbody>
    </table>
  );
}
function JobsTable({
  jobs,
  onToggle,
  onDelete,
}: {
  jobs: Job[];
  onToggle: (job: Job) => void;
  onDelete: (job: Job) => void;
}) {
  return (
    <table className="w-full min-w-[760px] text-left text-sm">
      <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
        <tr>
          <th className="px-5 py-3">Vaga</th>
          <th className="px-5 py-3">Empresa</th>
          <th className="px-5 py-3">Status</th>
          <th className="px-5 py-3 text-right">Ações</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id} className="border-t border-stone-100">
            <td className="px-5 py-4 font-bold text-stone-800">
              {job.title}
              <span className="mt-1 block font-normal text-stone-500">
                {job.location || "Localização não informada"}
              </span>
            </td>
            <td className="px-5 py-4 text-stone-600">
              {job.isExternalListing ? (
                <>
                  <span className="font-semibold text-amber-800">
                    Fonte externa
                  </span>
                  <span className="block text-xs text-stone-500">
                    {job.sourceName || job.companyName}
                  </span>
                  {job.ingestionSourceName && (
                    <span className="block text-xs font-semibold text-blue-700">
                      API: {job.ingestionSourceName}
                    </span>
                  )}
                </>
              ) : (
                job.companyName
              )}
            </td>
            <td className="px-5 py-4">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${job.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}
              >
                {job.active ? "Ativa" : "Inativa"}
              </span>
              {(job.reportCount || 0) > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                  {job.reportCount} alerta{job.reportCount === 1 ? "" : "s"}
                </span>
              )}
              {job.moderationStatus === "PENDING" && (
                <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                  Aguardando revisão
                </span>
              )}
            </td>
            <td className="px-5 py-4 text-right">
              <div className="flex justify-end gap-2">
                <Link
                  to={`/dashboard/vaga/${job.id}`}
                  className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
                >
                  Gerenciar
                </Link>
                <button
                  onClick={() => onToggle(job)}
                  className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                >
                  {job.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  onClick={() => onDelete(job)}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  Excluir
                </button>
              </div>
            </td>
          </tr>
        ))}
        {jobs.length === 0 && (
          <Empty colSpan={4} text="Nenhuma vaga encontrada." />
        )}
      </tbody>
    </table>
  );
}
function UsersTable({
  users,
  onInspect,
}: {
  users: PlatformUser[];
  onInspect: (id: string) => void;
}) {
  return (
    <table className="w-full min-w-[620px] text-left text-sm">
      <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
        <tr>
          <th className="px-5 py-3">Usuário</th>
          <th className="px-5 py-3">E-mail</th>
          <th className="px-5 py-3">Perfil</th>
          <th className="px-5 py-3">Cadastro</th>
          <th className="px-5 py-3"></th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} className="border-t border-stone-100">
            <td className="px-5 py-4 font-bold text-stone-800">
              {user.fullName || user.displayName || "Sem nome"}
            </td>
            <td className="px-5 py-4 text-stone-600">{user.email || "—"}</td>
            <td className="px-5 py-4">
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-700">
                {user.type || "Pendente"}
              </span>
            </td>
            <td className="px-5 py-4 text-stone-600">
              {new Date(user.createdAt).toLocaleDateString("pt-BR")}
            </td>
            <td className="px-5 py-4 text-right">
              <button
                onClick={() => onInspect(user.id)}
                className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
              >
                Abrir
              </button>
            </td>
          </tr>
        ))}
        {users.length === 0 && (
          <Empty colSpan={5} text="Nenhum usuário encontrado." />
        )}
      </tbody>
    </table>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
          <h2 className="font-serif text-xl font-bold text-stone-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
function Actions({ saving, text }: { saving: boolean; text: string }) {
  return (
    <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-terracotta-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-terracotta-700 disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {text}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
