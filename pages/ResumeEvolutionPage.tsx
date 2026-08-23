import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  History,
  Sparkles,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function scoreClass(score: number) {
  if (score >= 75) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 55) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function sourceLabel(source?: string) {
  if (source === "IMPROVEMENT") return "Depois de uma otimização com IA";
  if (source === "REANALYSIS") return "Reavaliação do currículo";
  return "Primeira análise";
}

export function ResumeEvolutionPage() {
  const { profile } = useAuth();
  const [history, setHistory] = useState<any>({ analyses: [], improvements: [], publications: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get("/payments/me/resume-history")
      .then((response) => {
        if (active) setHistory(response.data || { analyses: [], improvements: [], publications: [] });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const analyses = Array.isArray(history.analyses) ? history.analyses : [];
  const improvements = Array.isArray(history.improvements) ? history.improvements : [];
  const publications = Array.isArray(history.publications) ? history.publications : [];
  const currentScore = profile?.aiAnalysis?.score !== undefined
    ? Math.max(0, Math.min(100, Math.round(Number(profile.aiAnalysis.score))))
    : analyses[0]?.score !== undefined
      ? Number(analyses[0].score)
      : null;

  const bestScore = useMemo(
    () => analyses.reduce((best: number, item: any) => Math.max(best, Number(item.score || 0)), currentScore || 0),
    [analyses, currentScore],
  );
  const oldestScore = analyses.length ? Number(analyses[analyses.length - 1]?.score || 0) : currentScore;
  const totalGain = currentScore !== null && oldestScore !== null ? currentScore - Number(oldestScore || 0) : null;
  const latestPrevious = analyses.length > 1 ? Number(analyses[1]?.score || 0) : null;
  const latestDelta = currentScore !== null && latestPrevious !== null ? currentScore - latestPrevious : null;
  const appliedImprovements = improvements.filter((item: any) => ["APPLIED", "PARTIAL"].includes(String(item.status || ""))).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/user/curriculo" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-terracotta-600">
            <ArrowLeft className="h-4 w-4" /> Voltar ao currículo
          </Link>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Currículo · Evolução</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900">Sua evolução, sem labirinto</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Aqui você só acompanha o que mudou. Reavaliar, melhorar com IA e escolher sugestões acontece diretamente no preview do currículo.
          </p>
        </div>
        <Link to="/user/curriculo" className="inline-flex items-center gap-2 rounded-xl bg-[#2b211c] px-4 py-2.5 text-xs font-black text-white shadow-sm">
          Abrir preview <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="overflow-hidden rounded-[30px] border border-stone-200 bg-[#2b211c] text-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_.95fr]">
          <div className="p-6 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#f0b99d]">Pontuação atual</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="text-6xl font-black tracking-tight sm:text-7xl">{currentScore === null ? "--" : currentScore}<span className="text-xl text-white/30">/100</span></div>
              {latestDelta !== null && (
                <span className={`mb-2 rounded-full px-3 py-1.5 text-xs font-black ${latestDelta > 0 ? "bg-emerald-400/15 text-emerald-300" : latestDelta < 0 ? "bg-rose-400/15 text-rose-300" : "bg-white/10 text-white/60"}`}>
                  {latestDelta > 0 ? "+" : ""}{latestDelta} pts na última análise
                </span>
              )}
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">
              A nota mede a qualidade do documento. Uma otimização pode melhorar a redação sem necessariamente alterar a faixa da pontuação. Quando muda, o ganho aparece claramente aqui e na linha do tempo.
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-white/10 lg:border-l lg:border-t-0">
            <DarkMetric label="Melhor nota" value={currentScore === null && analyses.length === 0 ? "--" : `${bestScore}`} suffix="/100" />
            <DarkMetric label="Evolução total" value={totalGain === null ? "--" : `${totalGain > 0 ? "+" : ""}${totalGain}`} suffix="pts" />
            <DarkMetric label="Otimizações aplicadas" value={`${appliedImprovements}`} suffix="" />
            <DarkMetric label="Versões publicadas" value={`${publications.length}`} suffix="" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-700"><TrendingUp className="h-5 w-5" /><span className="text-[10px] font-black uppercase tracking-[.15em]">Pontuação</span></div>
              <h2 className="mt-2 text-xl font-bold text-stone-900">Linha do tempo</h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">Cada análise é um marco. Nenhuma nota antiga é apagada.</p>
            </div>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-stone-400">Carregando histórico...</p>
          ) : analyses.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-stone-300" />
              <p className="mt-2 text-sm font-bold text-stone-700">Sua primeira análise ainda não foi registrada.</p>
              <Link to="/user/curriculo" className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-terracotta-600">Analisar no preview <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          ) : (
            <div className="relative mt-6 space-y-0 pl-4 before:absolute before:bottom-4 before:left-[37px] before:top-4 before:w-px before:bg-stone-200">
              {analyses.map((item: any, index: number) => {
                const older = analyses[index + 1];
                const delta = older ? Number(item.score) - Number(older.score) : null;
                return (
                  <div key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
                    <span className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg font-black ${scoreClass(Number(item.score || 0))}`}>{item.score}</span>
                    <div className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-[#fffdfa] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><p className="text-sm font-bold text-stone-900">{sourceLabel(item.source)}</p><p className="mt-1 text-xs text-stone-400">{dateLabel(item.createdAt)}</p></div>
                        {delta !== null && <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${delta > 0 ? "bg-emerald-100 text-emerald-700" : delta < 0 ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-600"}`}>{delta > 0 ? "+" : ""}{delta} pts</span>}
                      </div>
                      {item.analysis?.feedbackText && <p className="mt-3 line-clamp-3 text-xs leading-5 text-stone-500">{item.analysis.feedbackText}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <section className="rounded-[28px] border border-violet-200 bg-violet-50/40 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-violet-700"><WandSparkles className="h-5 w-5" /><span className="text-[10px] font-black uppercase tracking-[.15em]">Otimizações com IA</span></div>
            <h2 className="mt-2 text-lg font-bold text-stone-900">{appliedImprovements} aplicada(s)</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">As sugestões são escolhidas no preview. Aqui fica apenas o registro do que aconteceu.</p>
            <div className="mt-4 space-y-2">
              {improvements.length === 0 ? <p className="rounded-xl bg-white/70 p-3 text-xs text-stone-400">Nenhuma otimização registrada ainda.</p> : improvements.slice(0, 5).map((item: any) => (
                <div key={item.id} className="rounded-xl border border-violet-100 bg-white p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${["APPLIED", "PARTIAL"].includes(String(item.status || "")) ? "text-emerald-600" : "text-stone-300"}`} />
                    <div><p className="text-xs font-bold text-stone-800">{item.proposal?.summary || "Proposta de melhoria"}</p><p className="mt-1 text-[10px] text-stone-400">{dateLabel(item.appliedAt || item.createdAt)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-stone-600"><FileText className="h-5 w-5" /><span className="text-[10px] font-black uppercase tracking-[.15em]">Publicações</span></div>
            <h2 className="mt-2 text-lg font-bold text-stone-900">Versões do currículo</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">Publicar e despublicar continua na área de versões do currículo.</p>
            <div className="mt-4 space-y-2">
              {publications.length === 0 ? <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-400">Nenhuma versão publicada ainda.</p> : publications.slice(0, 5).map((version: any) => (
                <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
                  <div><p className="text-xs font-bold text-stone-800">Versão {version.version}</p><p className="mt-1 text-[10px] text-stone-400">{dateLabel(version.publishedAt)}</p></div>
                  {version.score !== null && version.score !== undefined && <span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${scoreClass(Number(version.score))}`}>{version.score}/100</span>}
                </div>
              ))}
            </div>
            <Link to="/user/curriculo?stage=publish" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50">
              Gerenciar versões <History className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>
      </section>
    </div>
  );
}

function DarkMetric({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="flex min-h-32 flex-col justify-center border-b border-r border-white/10 p-5 last:border-r-0">
      <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}{suffix && <span className="ml-1 text-xs text-white/30">{suffix}</span>}</p>
    </div>
  );
}
