import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Briefcase,
  Building2,
  Clock3,
  Cpu,
  Eye,
  Globe2,
  KeyRound,
  Link2,
  Loader2,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { api, asArray } from "../lib/api";

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

type AiConfig = {
  enabled: boolean;
  provider: string | null;
  model: string | null;
};

type ApiClient = {
  id: string;
  active?: boolean;
};

type QueueState = {
  pendingJobs: number;
  accessRequests: number;
};

export function AdminOverview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    enabled: false,
    provider: null,
    model: null,
  });
  const [apiClients, setApiClients] = useState<ApiClient[]>([]);
  const [queues, setQueues] = useState<QueueState>({
    pendingJobs: 0,
    accessRequests: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [summaryResult, aiResult, apiResult, accessResult, jobsResult] =
        await Promise.allSettled([
          api.get("/admin/summary"),
          api.get("/admin/ai/config"),
          api.get("/admin/api-v1/clients"),
          api.get("/admin/company-access-requests"),
          api.get("/admin/jobs", {
            params: { page: 1, pageSize: 10, status: "PENDING" },
          }),
        ]);

      if (summaryResult.status !== "fulfilled") {
        throw summaryResult.reason;
      }

      setSummary(summaryResult.value.data || null);

      if (aiResult.status === "fulfilled") {
        setAiConfig({
          enabled: Boolean(aiResult.value.data?.enabled),
          provider: aiResult.value.data?.provider || null,
          model: aiResult.value.data?.model || null,
        });
      }

      if (apiResult.status === "fulfilled") {
        setApiClients(asArray<ApiClient>(apiResult.value.data));
      }

      setQueues({
        accessRequests:
          accessResult.status === "fulfilled"
            ? asArray(accessResult.value.data).length
            : 0,
        pendingJobs:
          jobsResult.status === "fulfilled"
            ? Number(jobsResult.value.data?.pagination?.total || 0)
            : 0,
      });

      setLastUpdated(new Date());
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          "Não foi possível carregar a visão geral administrativa.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  const activeApiClients = useMemo(
    () => apiClients.filter((client) => client.active !== false).length,
    [apiClients],
  );

  const attentionTotal =
    Number(summary?.pendingCompanies || 0) +
    queues.pendingJobs +
    queues.accessRequests;

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm font-semibold text-stone-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-terracotta-600" />
          Montando a central de operação...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 admin-overview-page">
      <section className="admin-overview-hero relative overflow-hidden rounded-[28px] bg-[#171714] p-5 text-white shadow-[0_24px_70px_rgba(38,33,29,.16)] sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border border-white/[0.07] shadow-[0_0_0_42px_rgba(255,255,255,.018),0_0_0_84px_rgba(255,255,255,.01)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[45%] bg-[radial-gradient(circle_at_75%_35%,rgba(204,88,67,.27),transparent_52%)]" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-terracotta-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.7)]" />
              Central de operação
            </div>
            <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.8rem] lg:leading-[1.05]">
              O que está acontecendo no PiraNegócios agora.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
              Audiência, operação, moderação e infraestrutura reunidas em um só lugar, com prioridade para o que precisa de atenção.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {attentionTotal > 0 && (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] font-bold text-amber-200">
                {attentionTotal} item{attentionTotal === 1 ? "" : "s"} na fila
              </span>
            )}
            {lastUpdated && (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-white/50">
                Atualizado às{" "}
                {lastUpdated.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-stone-100 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Activity className="h-5 w-5" />}
          value={summary?.activeVisitors || 0}
          label="Visitantes agora"
          detail="atividade nos últimos 5 minutos"
          tone="live"
        />
        <MetricCard
          icon={<Building2 className="h-5 w-5" />}
          value={summary?.companies || 0}
          label="Empresas"
          detail={`${summary?.pendingCompanies || 0} aguardando revisão`}
          attention={Boolean(summary?.pendingCompanies)}
        />
        <MetricCard
          icon={<Briefcase className="h-5 w-5" />}
          value={summary?.activeJobs || 0}
          label="Vagas ativas"
          detail={`${queues.pendingJobs} aguardando moderação`}
          attention={queues.pendingJobs > 0}
        />
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          value={summary?.users || 0}
          label="Usuários"
          detail={`${summary?.accountAccesses || 0} acessos autenticados em 30 dias`}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
        <section className="rounded-[24px] border border-stone-200 bg-[#fffdfa] p-5 shadow-[0_12px_34px_rgba(38,33,29,.05)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                Audiência · 30 dias
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-stone-950">
                Pulso da plataforma
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Leitura rápida de alcance e comportamento.
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-950 text-white">
              <Globe2 className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <CompactMetric
              icon={<Eye className="h-4 w-4" />}
              value={summary?.pageViews || 0}
              label="Páginas vistas"
            />
            <CompactMetric
              icon={<Users className="h-4 w-4" />}
              value={summary?.uniqueVisitors || 0}
              label="Visitantes únicos"
            />
            <CompactMetric
              icon={<Clock3 className="h-4 w-4" />}
              value={`${summary?.averageEngagementSeconds || 0}s`}
              label="Tempo médio"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Ranking
              title="Principais origens"
              items={(summary?.sources || []).map((item) => ({
                label: item.source || "Direto",
                count: item.count,
              }))}
            />
            <Ranking
              title="Dispositivos"
              icon={<Smartphone className="h-4 w-4" />}
              items={(summary?.devices || []).map((item) => ({
                label: item.device || "Outro",
                count: item.count,
              }))}
            />
            <Ranking
              title="Páginas mais vistas"
              items={(summary?.topPages || []).map((item) => ({
                label: item.path || "/",
                count: item.count,
              }))}
            />
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-[24px] border border-stone-200 bg-[#fffdfa] p-5 shadow-[0_12px_34px_rgba(38,33,29,.05)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                  Atenção
                </p>
                <h2 className="mt-1 text-lg font-bold text-stone-950">
                  Fila operacional
                </h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-terracotta-600" />
            </div>

            <div className="mt-4 space-y-2">
              <AttentionLink
                to="/dashboard/admin/empresas"
                label="Empresas aguardando revisão"
                value={summary?.pendingCompanies || 0}
                urgent={Boolean(summary?.pendingCompanies)}
              />
              <AttentionLink
                to="/dashboard/admin/vagas"
                label="Vagas aguardando moderação"
                value={queues.pendingJobs}
                urgent={queues.pendingJobs > 0}
              />
              <AttentionLink
                to="/dashboard/admin/vinculos"
                label="Solicitações de vínculo"
                value={queues.accessRequests}
                urgent={queues.accessRequests > 0}
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-stone-200 bg-[#fffdfa] p-5 shadow-[0_12px_34px_rgba(38,33,29,.05)] sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
              Infraestrutura
            </p>
            <h2 className="mt-1 text-lg font-bold text-stone-950">
              Serviços do sistema
            </h2>
            <div className="mt-4 space-y-2.5">
              <SystemRow
                icon={<Cpu className="h-4 w-4" />}
                label="Inteligência Artificial"
                status={aiConfig.enabled ? "Ativa" : "Desligada"}
                detail={
                  aiConfig.enabled
                    ? [aiConfig.provider, aiConfig.model]
                        .filter(Boolean)
                        .join(" · ")
                    : "Recursos de IA indisponíveis aos usuários"
                }
                active={aiConfig.enabled}
                to="/dashboard/admin/ai"
              />
              <SystemRow
                icon={<KeyRound className="h-4 w-4" />}
                label="Clientes da API"
                status={`${activeApiClients} ativo${activeApiClients === 1 ? "" : "s"}`}
                detail={`${apiClients.length} integração${apiClients.length === 1 ? "" : "ões"} cadastrada${apiClients.length === 1 ? "" : "s"}`}
                active={activeApiClients > 0}
                to="/dashboard/admin/api"
              />
              <SystemRow
                icon={<Megaphone className="h-4 w-4" />}
                label="Publicidade"
                status="Gerenciar"
                detail="Campanhas, espaços e monetização"
                active
                to="/dashboard/admin/publicidade"
              />
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-[24px] border border-stone-200 bg-[#fffdfa] p-5 shadow-[0_12px_34px_rgba(38,33,29,.05)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
              Atalhos
            </p>
            <h2 className="mt-1 text-xl font-bold text-stone-950">
              Ir direto ao trabalho
            </h2>
          </div>
          <p className="text-xs text-stone-400">
            Ações administrativas mais frequentes.
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            to="/dashboard/admin/empresas"
            icon={<Building2 className="h-5 w-5" />}
            title="Empresas"
            subtitle="Cadastro e verificação"
          />
          <QuickLink
            to="/dashboard/admin/vagas"
            icon={<Briefcase className="h-5 w-5" />}
            title="Vagas"
            subtitle="Publicação e moderação"
          />
          <QuickLink
            to="/dashboard/admin/usuarios"
            icon={<Users className="h-5 w-5" />}
            title="Usuários"
            subtitle="Contas e sanções"
          />
          <QuickLink
            to="/dashboard/admin/vinculos"
            icon={<Link2 className="h-5 w-5" />}
            title="Vínculos"
            subtitle="Acessos empresariais"
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  value,
  label,
  detail,
  tone,
  attention = false,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  detail: string;
  tone?: "live";
  attention?: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-stone-200 bg-[#fffdfa] p-5 shadow-[0_12px_34px_rgba(38,33,29,.05)]">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            tone === "live"
              ? "bg-emerald-50 text-emerald-700"
              : attention
                ? "bg-amber-50 text-amber-700"
                : "bg-stone-100 text-stone-700"
          }`}
        >
          {icon}
        </span>
        {attention && (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-800">
            atenção
          </span>
        )}
      </div>
      <p className="mt-5 text-3xl font-bold tracking-[-0.055em] text-stone-950">
        {value}
      </p>
      <p className="mt-1 text-sm font-bold text-stone-800">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-400">{detail}</p>
    </section>
  );
}

function CompactMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f5f2ec] p-4">
      <div className="flex items-center gap-2 text-stone-400">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-stone-950">
        {value}
      </p>
    </div>
  );
}

function Ranking({
  title,
  items,
  icon,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  icon?: React.ReactNode;
}) {
  const visible = items.slice(0, 5);
  const max = Math.max(1, ...visible.map((item) => Number(item.count || 0)));

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
        {icon}
        {title}
      </div>
      <div className="mt-3 space-y-2.5">
        {visible.length ? (
          visible.map((item) => (
            <div key={`${title}-${item.label}`}>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="min-w-0 truncate font-medium text-stone-600">
                  {item.label}
                </span>
                <strong className="text-stone-900">{item.count}</strong>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-stone-800"
                  style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-stone-400">Aguardando dados.</p>
        )}
      </div>
    </div>
  );
}

function AttentionLink({
  to,
  label,
  value,
  urgent = false,
}: {
  to: string;
  label: string;
  value: string | number;
  urgent?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-3.5 py-3 transition hover:border-stone-300 hover:shadow-sm"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-stone-700">{label}</p>
        <p
          className={`mt-0.5 text-lg font-bold ${urgent ? "text-amber-700" : "text-stone-950"}`}
        >
          {value}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-stone-300 transition group-hover:text-stone-700" />
    </Link>
  );
}

function SystemRow({
  icon,
  label,
  status,
  detail,
  active,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  detail: string;
  active: boolean;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 transition hover:border-stone-300 hover:shadow-sm"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-bold text-stone-800">{label}</p>
          <span
            className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-stone-300"}`}
          />
        </div>
        <p className="mt-0.5 truncate text-[10px] text-stone-400">{detail}</p>
      </div>
      <span className="shrink-0 text-[10px] font-bold text-stone-500">
        {status}
      </span>
    </Link>
  );
}

function QuickLink({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-950 text-white">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-stone-900">{title}</span>
        <span className="block truncate text-[11px] text-stone-400">
          {subtitle}
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 text-stone-300 transition group-hover:text-terracotta-600" />
    </Link>
  );
}
