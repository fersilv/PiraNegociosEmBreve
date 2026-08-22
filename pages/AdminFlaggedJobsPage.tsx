import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Eye,
  ExternalLink,
  Flag,
  Loader2,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { api, asArray } from "../lib/api";

type FlagReport = {
  id: string;
  reason: string;
  details?: string | null;
  createdAt: string;
};

type FlaggedJob = {
  id: string;
  slug?: string | null;
  title: string;
  companyName?: string | null;
  sourceName?: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  active: boolean;
  views?: number;
  isFlagged?: boolean;
  flagReason?: string | null;
  flagObservation?: string | null;
  flaggedAt?: string | null;
  reportCount?: number;
  updatedAt?: string;
};

type FlaggedItem = {
  job: FlaggedJob;
  sources: {
    ai: boolean;
    people: number;
  };
  reports: FlagReport[];
};

const reportLabels: Record<string, string> = {
  VAGA_INEXISTENTE: "Vaga inexistente",
  PROCESSO_ENCERRADO: "Processo encerrado",
  INFORMACAO_INCORRETA: "Informação incorreta",
  GOLPE_OU_FRAUDE: "Possível golpe ou fraude",
  OUTRO: "Outro motivo",
};

export function AdminFlaggedJobsPage() {
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/job-flags");
      setItems(asArray<FlaggedItem>(response.data));
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          "Não foi possível carregar as vagas sinalizadas.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return items;
    return items.filter(({ job, reports }) =>
      [
        job.title,
        job.companyName,
        job.sourceName,
        job.city,
        job.state,
        job.location,
        job.flagReason,
        job.flagObservation,
        ...reports.flatMap((report) => [report.reason, report.details]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [items, search]);

  const clearFlag = async (item: FlaggedItem) => {
    if (
      !window.confirm(
        `Remover a sinalização de “${item.job.title}”? A vaga continuará cadastrada e sairá desta fila.`,
      )
    )
      return;

    setClearingId(item.job.id);
    setError("");
    try {
      await api.put(`/admin/job-flags/${item.job.id}/clear`);
      setItems((current) => current.filter((entry) => entry.job.id !== item.job.id));
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          "Não foi possível remover a sinalização.",
      );
    } finally {
      setClearingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 admin-standalone-page">
      <header className="flex flex-col gap-4 rounded-[28px] bg-[#171714] p-5 text-white shadow-[0_24px_70px_rgba(38,33,29,.16)] sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-amber-300">
            <Flag className="h-4 w-4" /> Moderação · atenção necessária
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">Vagas sinalizadas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Aqui entram tanto alertas da auditoria/IA quanto denúncias enviadas por pessoas. Revise a origem, abra a vaga e resolva a sinalização quando estiver tudo certo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-black text-amber-200 ring-1 ring-amber-300/15">
            {items.length} {items.length === 1 ? "sinalizada" : "sinalizadas"}
          </span>
          <Link
            to="/admin/vagas"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-white/75 hover:bg-white/[0.1]"
          >
            Todas as vagas
          </Link>
        </div>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por vaga, cidade, empresa ou motivo da sinalização"
          className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-10 pr-4 text-sm outline-none shadow-sm focus:border-terracotta-300"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[35vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-terracotta-600" />
        </div>
      ) : filtered.length === 0 ? (
        <section className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-7 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
          <h2 className="mt-3 font-serif text-2xl font-bold text-emerald-950">
            {items.length === 0 ? "Fila limpa" : "Nenhuma sinalização encontrada"}
          </h2>
          <p className="mt-2 text-sm text-emerald-800/70">
            {items.length === 0
              ? "Não há vagas aguardando revisão agora."
              : "Tente outro termo de busca."}
          </p>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item) => {
            const { job } = item;
            const place = job.city
              ? `${job.city}${job.state ? `, ${job.state}` : ""}`
              : job.location || "Local não informado";
            const source = job.companyName || job.sourceName || "Origem não informada";
            const busy = clearingId === job.id;

            return (
              <article key={job.id} className="overflow-hidden rounded-[24px] border border-stone-200 bg-[#fffdfa] shadow-sm">
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.sources.ai && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-violet-700">
                        <Bot className="h-3.5 w-3.5" /> IA / auditoria
                      </span>
                    )}
                    {item.sources.people > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-amber-800">
                        <Users className="h-3.5 w-3.5" /> {item.sources.people} {item.sources.people === 1 ? "denúncia" : "denúncias"}
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${job.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                      {job.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>

                  <h2 className="mt-3 font-serif text-2xl font-bold text-stone-950">{job.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-stone-500">{source}</p>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-stone-500">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {place}</span>
                    <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> {Number(job.views || 0)} visualizações</span>
                  </div>

                  {item.sources.ai && (job.flagReason || job.flagObservation) && (
                    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-violet-700"><Bot className="h-3.5 w-3.5" /> Motivo da auditoria</p>
                      {job.flagReason && <p className="mt-2 text-sm font-bold text-violet-950">{job.flagReason}</p>}
                      {job.flagObservation && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-violet-800">{job.flagObservation}</p>}
                    </div>
                  )}

                  {item.reports.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Denúncias recebidas</p>
                      {item.reports.slice(0, 5).map((report) => (
                        <div key={report.id} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-xs text-amber-950">{reportLabels[report.reason] || report.reason}</strong>
                            <span className="text-[10px] text-amber-700/60">{new Date(report.createdAt).toLocaleString("pt-BR")}</span>
                          </div>
                          {report.details && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-amber-900/75">{report.details}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t border-stone-100 bg-stone-50/70 p-4 sm:flex-row sm:items-center sm:justify-end">
                  {job.slug && (
                    <a
                      href={`/vagas/${job.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-600"
                    >
                      Vaga pública <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Link
                    to={`/admin/vagas/${job.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white"
                  >
                    Gerenciar vaga
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void clearFlag(item)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Remover sinalização
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
