import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MapPin,
  PauseCircle,
  PlayCircle,
  Users,
} from "lucide-react";
import { api } from "../lib/api";

type AdminJobDetails = {
  job: {
    id: string;
    slug?: string | null;
    title: string;
    description?: string | null;
    requirements?: string | null;
    companyName?: string | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    city?: string | null;
    state?: string | null;
    location?: string | null;
    type?: string | null;
    workModel?: string | null;
    salary?: string | null;
    deadlineDate?: string | null;
    active: boolean;
    moderationStatus?: string | null;
    acceptsPlatformApplications?: boolean;
    applicationEmail?: string | null;
    applicationWhatsApp?: string | null;
    externalApplicationInstructions?: string | null;
    views?: number;
    isExternalListing?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
  company: {
    id: string;
    name: string;
    slug?: string | null;
    city?: string | null;
    state?: string | null;
    verificationStatus?: string | null;
  } | null;
  applicationCount: number;
};

export function AdminJobDetailsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [data, setData] = useState<AdminJobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!jobId) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/admin/job-details/${jobId}`);
      setData(response.data);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Não foi possível carregar os detalhes da vaga.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [jobId]);

  const toggleActive = async () => {
    if (!data || saving) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/admin/jobs/${data.job.id}`, { active: !data.job.active });
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Não foi possível atualizar a vaga.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-terracotta-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link to="/admin/vagas" className="inline-flex items-center gap-2 text-sm font-bold text-stone-600">
          <ArrowLeft className="h-4 w-4" /> Voltar para vagas
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
          {error || "Vaga não encontrada."}
        </div>
      </div>
    );
  }

  const { job } = data;
  const location = job.city
    ? `${job.city}${job.state ? `, ${job.state}` : ""}`
    : job.location || "Local não informado";
  const source = data.company?.name || job.companyName || job.sourceName || "Origem não informada";

  return (
    <div className="mx-auto max-w-6xl space-y-5 admin-standalone-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/vagas" className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-bold text-stone-600 shadow-sm">
          <ArrowLeft className="h-4 w-4" /> Voltar para vagas
        </Link>
        <div className="flex flex-wrap gap-2">
          {job.slug && (
            <a href={`/vagas/${job.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-bold text-stone-700 shadow-sm">
              <ExternalLink className="h-4 w-4" /> Abrir vaga pública
            </a>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => void toggleActive()}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 ${job.active ? "bg-amber-600" : "bg-emerald-600"}`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : job.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            {job.active ? "Pausar vaga" : "Reativar vaga"}
          </button>
        </div>
      </div>

      <header className="relative overflow-hidden rounded-[28px] bg-[#171714] p-5 text-white shadow-[0_24px_70px_rgba(38,33,29,.16)] sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/[0.07] shadow-[0_0_0_42px_rgba(255,255,255,.018)]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-terracotta-300">
            <span>{job.active ? "Vaga ativa" : "Vaga pausada"}</span>
            {job.moderationStatus && <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-white/65">{job.moderationStatus}</span>}
          </div>
          <h1 className="mt-3 max-w-4xl font-serif text-3xl font-bold tracking-tight sm:text-4xl">{job.title}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-white/55">
            {data.company ? <Building2 className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
            {source}
          </p>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<MapPin className="h-4 w-4" />} label="Local" value={location} />
        <Metric icon={<Briefcase className="h-4 w-4" />} label="Modelo" value={[job.type, job.workModel].filter(Boolean).join(" · ") || "Não informado"} />
        <Metric icon={<Eye className="h-4 w-4" />} label="Visualizações" value={String(job.views || 0)} />
        <Metric icon={<Users className="h-4 w-4" />} label="Candidaturas" value={String(data.applicationCount || 0)} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
        <div className="space-y-5">
          <Section title="Sobre a vaga" icon={<FileText className="h-5 w-5" />}>
            <RichText value={job.description} empty="Descrição não informada." />
          </Section>
          <Section title="Requisitos" icon={<Briefcase className="h-5 w-5" />}>
            <RichText value={job.requirements} empty="Nenhum requisito separado foi informado." />
          </Section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[22px] border border-stone-200 bg-[#fffdfa] p-5 shadow-sm">
            <h2 className="font-bold text-stone-950">Dados operacionais</h2>
            <Info label="Salário" value={job.salary || "Não informado"} />
            <Info label="Prazo" value={job.deadlineDate ? new Date(`${job.deadlineDate}T12:00:00`).toLocaleDateString("pt-BR") : "Sem prazo informado"} icon={<CalendarDays className="h-3.5 w-3.5" />} />
            <Info label="Origem" value={job.isExternalListing ? "Vaga externa" : "Empresa da plataforma"} />
            <Info label="Candidatura" value={job.acceptsPlatformApplications === false ? "Canal externo" : "Pela plataforma"} />
          </section>

          {job.acceptsPlatformApplications === false && (
            <section className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
              <h2 className="font-bold">Canal de candidatura</h2>
              {job.applicationWhatsApp && <p className="mt-3">WhatsApp: <strong>{job.applicationWhatsApp}</strong></p>}
              {job.applicationEmail && <p className="mt-2">E-mail: <strong>{job.applicationEmail}</strong></p>}
              {job.externalApplicationInstructions && <p className="mt-3 whitespace-pre-wrap leading-6 text-amber-800">{job.externalApplicationInstructions}</p>}
            </section>
          )}

          {job.sourceUrl && (
            <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-[22px] border border-stone-200 bg-white p-4 text-sm font-bold text-stone-700 shadow-sm">
              Ver fonte original <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-stone-200 bg-[#fffdfa] p-4 shadow-sm">
      <div className="flex items-center gap-2 text-stone-400">{icon}<span className="text-[10px] font-black uppercase tracking-[.12em]">{label}</span></div>
      <p className="mt-2 break-words text-sm font-bold text-stone-900">{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-[#fffdfa] p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2 text-stone-900">{icon}<h2 className="text-lg font-bold">{title}</h2></div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RichText({ value, empty }: { value?: string | null; empty: string }) {
  const paragraphs = String(value || "").split(/\n+/).map((item) => item.trim()).filter(Boolean);
  if (!paragraphs.length) return <p className="text-sm text-stone-500">{empty}</p>;
  return <div className="space-y-3 text-sm leading-7 text-stone-600">{paragraphs.map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)}</div>;
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-stone-100 pt-3 first:border-t-0 first:pt-0">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] text-stone-400">{icon}{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-700">{value}</p>
    </div>
  );
}
