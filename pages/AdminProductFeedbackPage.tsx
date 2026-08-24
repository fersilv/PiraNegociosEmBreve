import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  BookOpen,
  CheckCircle2,
  Clock3,
  Image,
  Inbox,
  Lightbulb,
  Loader2,
  MessageCircleMore,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { api, asArray } from "../lib/api";

type FeedbackStatus = "NEW" | "REVIEWING" | "PLANNED" | "DELIVERED" | "CLOSED";
type Feedback = {
  id: string;
  userName?: string | null;
  userEmail?: string | null;
  profileType: string;
  pagePath: string;
  process: string;
  message: string;
  screenshot?: { name: string; mimeType: string; size: number } | null;
  status: FeedbackStatus;
  adminNote?: string | null;
  expectation?: "YES" | "PARTLY" | "NO" | null;
  expectationComment?: string | null;
  createdAt: string;
  updatedAt: string;
};
type Insight = { id: string; title: string; summary: string; feedbackIds: string[]; requestCount: number; score: number; reason?: string | null; source: string; generatedAt: string };
type SupportMessage = { id: string; role: "USER" | "ASSISTANT" | "ADMIN"; text: string; createdAt: string };
type Conversation = { id: string; userName?: string | null; userEmail?: string | null; profileType: string; pagePath: string; process: string; status: string; messages: SupportMessage[]; screenshot?: { name: string; mimeType: string; size: number } | null; updatedAt: string };
type UsageLog = { id: string; userName?: string | null; userEmail?: string | null; profileType?: string | null; feature: string; operation: string; provider?: string | null; model?: string | null; inputTokens: number; outputTokens: number; totalTokens: number; estimated: boolean; success: boolean; error?: string | null; createdAt: string };
type UsageData = { summary: { requests: number; inputTokens: number; outputTokens: number; totalTokens: number; failures: number }; byFeature: Array<{ feature: string; requests: number; tokens: number; failures: number }>; daily: Array<{ day: string; requests: number; tokens: number }>; topUsers: Array<{ userId: string; userName?: string | null; userEmail?: string | null; profileType?: string | null; requests: number; tokens: number }>; logs: UsageLog[] };
type Faq = { id: string; slug: string; title: string; summary: string; body: string; sourceConversationIds: string[]; requestCount: number; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; aiGenerated: boolean; updatedAt: string };
type Tab = "ranking" | "requests" | "support" | "validation" | "usage" | "faq";

const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const statusLabel: Record<string, string> = { NEW: "Nova", REVIEWING: "Em análise", PLANNED: "Planejada", DELIVERED: "Entregue", CLOSED: "Encerrada", AI_ACTIVE: "Atendimento IA", AI_ERROR: "Falha na IA", ESCALATED: "Suporte humano", WAITING_USER: "Aguardando usuário" };

export function AdminProductFeedbackPage() {
  const [tab, setTab] = useState<Tab>("ranking");
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [usage, setUsage] = useState<UsageData>({ summary: { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, failures: 0 }, byFeature: [], daily: [], topUsers: [], logs: [] });
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/product-feedback/overview");
      setFeedback(asArray<Feedback>(response.data?.feedback));
      setInsights(asArray<Insight>(response.data?.insights));
      const nextConversations = asArray<Conversation>(response.data?.conversations);
      setConversations(nextConversations);
      if (response.data?.aiUsage) setUsage(response.data.aiUsage);
      setFaqs(asArray<Faq>(response.data?.faqs));
      setLastAnalyzedAt(response.data?.lastAnalyzedAt || null);
      setSelectedConversationId((current) => current && nextConversations.some((item) => item.id === current) ? current : nextConversations[0]?.id || null);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível carregar as solicitações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  const selectedConversation = useMemo(() => conversations.find((item) => item.id === selectedConversationId) || null, [conversations, selectedConversationId]);
  const validation = feedback.filter((item) => item.status === "DELIVERED");

  const analyze = async () => {
    setAnalyzing(true);
    setMessage("");
    try {
      const response = await api.post("/admin/product-feedback/analyze", { force: true }, { timeout: 90000 });
      setMessage(response.data?.analyzed ? "Solicitações reagrupadas e priorizadas." : "Ainda não há solicitações abertas para analisar.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "A análise não pôde ser executada.");
    } finally {
      setAnalyzing(false);
    }
  };

  const update = async (item: Feedback, status: FeedbackStatus) => {
    setSavingId(item.id);
    try {
      await api.patch(`/admin/product-feedback/${item.id}`, { status, adminNote: item.adminNote || "" });
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível atualizar a solicitação.");
    } finally {
      setSavingId(null);
    }
  };

  const viewScreenshot = async (source: "feedback" | "support", id: string) => {
    try {
      const response = await api.get(`/admin/product-feedback/${source}/${id}/screenshot`);
      setScreenshot(response.data?.data || null);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível abrir a captura.");
    }
  };

  const sendReply = async () => {
    if (!selectedConversation || !reply.trim()) return;
    setSavingId(selectedConversation.id);
    try {
      await api.post(`/admin/product-feedback/support/${selectedConversation.id}/reply`, { message: reply });
      setReply("");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível responder.");
    } finally {
      setSavingId(null);
    }
  };

  const generateFaqs = async () => {
    setAnalyzing(true);
    setMessage("");
    try {
      const response = await api.post("/admin/product-feedback/faqs/generate", {}, { timeout: 90000 });
      setMessage(response.data?.generated ? `${response.data.articles || 0} FAQ(s) gerada(s) para revisão.` : "Ainda não há perguntas recorrentes suficientes.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível gerar as FAQs.");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveFaq = async (faq: Faq, status = faq.status) => {
    setSavingId(faq.id);
    try {
      await api.patch(`/admin/product-feedback/faqs/${faq.id}`, { title: faq.title, summary: faq.summary, body: faq.body, status });
      setMessage(status === "PUBLISHED" ? "FAQ publicada na Central de Ajuda." : "FAQ atualizada.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível atualizar a FAQ.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-terracotta-600">Produto · Voz do usuário</p><h1 className="mt-1 font-serif text-4xl font-bold text-stone-950">Solicitações e suporte</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Acompanhe o que as pessoas sentem falta, priorize temas recorrentes e valide se as melhorias entregues realmente resolveram o problema.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-stone-700"><RefreshCw className="h-4 w-4" /> Atualizar</button><button type="button" disabled={analyzing} onClick={() => void analyze()} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analisar agora</button></div></header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Inbox className="h-5 w-5" />} value={feedback.filter((item) => item.status === "NEW").length} label="Novas solicitações" /><Metric icon={<Lightbulb className="h-5 w-5" />} value={insights.length} label="Temas priorizados" /><Metric icon={<MessageCircleMore className="h-5 w-5" />} value={conversations.filter((item) => item.status === "ESCALATED").length} label="Aguardando suporte" /><Metric icon={<CheckCircle2 className="h-5 w-5" />} value={validation.length} label="Em validação" /></section>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5"><TabButton active={tab === "ranking"} onClick={() => setTab("ranking")}>Prioridades</TabButton><TabButton active={tab === "requests"} onClick={() => setTab("requests")}>Solicitações</TabButton><TabButton active={tab === "support"} onClick={() => setTab("support")}>Suporte</TabButton><TabButton active={tab === "usage"} onClick={() => setTab("usage")}>Consumo IA</TabButton><TabButton active={tab === "faq"} onClick={() => setTab("faq")}>FAQs</TabButton><TabButton active={tab === "validation"} onClick={() => setTab("validation")}>Validação</TabButton></div>
      {message && <div className="rounded-2xl bg-stone-900 px-4 py-3 text-xs text-white">{message}</div>}

      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div> : tab === "ranking" ? (
        <section className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-serif text-2xl font-bold text-stone-950">Ranking de melhorias</h2><p className="text-xs text-stone-500">Atualização automática diária · última análise {dateTime(lastAnalyzedAt)}</p></div></div>{insights.map((item, index) => <article key={item.id} className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 font-serif text-lg font-black text-violet-800">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-stone-950">{item.title}</h3><span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black uppercase text-stone-500">{item.requestCount} pedido(s)</span><span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black uppercase text-violet-700">Prioridade {item.score}</span></div><p className="mt-2 text-sm leading-6 text-stone-600">{item.summary}</p>{item.reason && <p className="mt-2 text-[11px] text-stone-400">{item.reason}</p>}</div></div></article>)}{insights.length === 0 && <Empty text="O ranking aparece depois da primeira solicitação." />}</section>
      ) : tab === "requests" ? (
        <section className="space-y-3"><h2 className="font-serif text-2xl font-bold text-stone-950">Solicitações individuais</h2>{feedback.map((item) => <FeedbackCard key={item.id} item={item} busy={savingId === item.id} onUpdate={(status) => void update(item, status)} onScreenshot={item.screenshot ? () => void viewScreenshot("feedback", item.id) : undefined} />)}{feedback.length === 0 && <Empty text="Nenhuma solicitação recebida ainda." />}</section>
      ) : tab === "validation" ? (
        <section className="space-y-3"><h2 className="font-serif text-2xl font-bold text-stone-950">A melhoria atendeu?</h2><p className="text-sm text-stone-500">Quando você marca uma solicitação como entregue, ela aparece ao usuário para uma segunda validação.</p>{validation.map((item) => <article key={item.id} className="rounded-[24px] border border-stone-200 bg-white p-5"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-stone-900">{item.process}</strong><ExpectationBadge value={item.expectation} /></div><p className="mt-2 text-sm leading-6 text-stone-600">{item.message}</p>{item.expectationComment && <blockquote className="mt-3 rounded-2xl bg-stone-50 p-4 text-xs italic leading-5 text-stone-600">“{item.expectationComment}”</blockquote>}<p className="mt-3 text-[10px] text-stone-400">{item.userName || item.userEmail} · {dateTime(item.updatedAt)}</p></article>)}{validation.length === 0 && <Empty text="Nenhuma melhoria aguardando validação." />}</section>
      ) : tab === "usage" ? (
        <section className="space-y-5"><div><h2 className="font-serif text-2xl font-bold text-stone-950">Analytics de consumo da IA</h2><p className="mt-1 text-sm text-stone-500">Últimos 30 dias, separado por recurso e por usuário.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<BarChart3 className="h-5 w-5" />} value={usage.summary.requests} label="Chamadas" /><Metric icon={<Sparkles className="h-5 w-5" />} value={usage.summary.totalTokens} label="Tokens" /><Metric icon={<Bot className="h-5 w-5" />} value={usage.summary.inputTokens} label="Tokens de entrada" /><Metric icon={<X className="h-5 w-5" />} value={usage.summary.failures} label="Falhas" /></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-[24px] border border-stone-200 bg-white p-5"><h3 className="font-bold text-stone-950">Por recurso</h3><div className="mt-3 space-y-2">{usage.byFeature.map((item) => <div key={item.feature} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs"><span className="font-bold text-stone-700">{item.feature}</span><span className="text-stone-500">{item.requests} chamadas · {item.tokens.toLocaleString("pt-BR")} tokens · {item.failures} falhas</span></div>)}{usage.byFeature.length === 0 && <Empty text="Ainda não há consumo registrado." />}</div></div><div className="rounded-[24px] border border-stone-200 bg-white p-5"><h3 className="font-bold text-stone-950">Maiores consumos por usuário</h3><div className="mt-3 space-y-2">{usage.topUsers.map((item) => <div key={item.userId} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs"><div><p className="font-bold text-stone-700">{item.userName || item.userEmail || item.userId}</p><p className="text-[9px] text-stone-400">{item.profileType}</p></div><span className="text-stone-500">{item.tokens.toLocaleString("pt-BR")} tokens</span></div>)}{usage.topUsers.length === 0 && <Empty text="Ainda não há consumo por usuário." />}</div></div></div><div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white"><div className="border-b border-stone-100 p-5"><h3 className="font-bold text-stone-950">Registro de chamadas</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-stone-50 text-[9px] uppercase text-stone-400"><tr><th className="p-3">Data</th><th className="p-3">Usuário</th><th className="p-3">Recurso</th><th className="p-3">Modelo</th><th className="p-3">Entrada</th><th className="p-3">Saída</th><th className="p-3">Resultado</th></tr></thead><tbody>{usage.logs.map((item) => <tr key={item.id} className="border-t border-stone-100"><td className="p-3 text-stone-500">{dateTime(item.createdAt)}</td><td className="p-3"><p className="font-bold text-stone-700">{item.userName || item.userEmail || "Automação"}</p><p className="text-[9px] text-stone-400">{item.profileType || "SISTEMA"}</p></td><td className="p-3 text-stone-600">{item.feature}</td><td className="p-3 text-stone-500">{item.provider || "—"} · {item.model || "—"}</td><td className="p-3">{item.inputTokens}{item.estimated ? "*" : ""}</td><td className="p-3">{item.outputTokens}{item.estimated ? "*" : ""}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{item.success ? "OK" : "ERRO"}</span>{item.error && <p className="mt-1 max-w-xs truncate text-[9px] text-red-500" title={item.error}>{item.error}</p>}</td></tr>)}</tbody></table></div><p className="p-3 text-[9px] text-stone-400">* contagem estimada quando o provedor não informa tokens.</p></div></section>
      ) : tab === "faq" ? (
        <section className="space-y-4"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-serif text-2xl font-bold text-stone-950">FAQs e Central de Ajuda</h2><p className="mt-1 text-sm text-stone-500">A IA cria rascunhos somente a partir de dúvidas recorrentes. Revise antes de publicar.</p></div><button type="button" disabled={analyzing} onClick={() => void generateFaqs()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />} Gerar FAQs agora</button></header>{faqs.map((faq) => <article key={faq.id} className="rounded-[24px] border border-stone-200 bg-white p-5"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${faq.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : faq.status === "ARCHIVED" ? "bg-stone-100 text-stone-500" : "bg-amber-100 text-amber-700"}`}>{faq.status === "PUBLISHED" ? "Publicada" : faq.status === "ARCHIVED" ? "Arquivada" : "Rascunho"}</span><span className="text-[10px] text-stone-400">{faq.requestCount} conversa(s) de origem · {dateTime(faq.updatedAt)}</span></div><input value={faq.title} onChange={(event) => setFaqs((current) => current.map((item) => item.id === faq.id ? { ...item, title: event.target.value } : item))} className="mt-3 w-full rounded-xl border border-stone-200 p-3 font-bold outline-none focus:border-violet-400" /><textarea value={faq.summary} onChange={(event) => setFaqs((current) => current.map((item) => item.id === faq.id ? { ...item, summary: event.target.value } : item))} rows={2} className="mt-2 w-full resize-y rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-violet-400" /><textarea value={faq.body} onChange={(event) => setFaqs((current) => current.map((item) => item.id === faq.id ? { ...item, body: event.target.value } : item))} rows={7} className="mt-2 w-full resize-y rounded-xl border border-stone-200 p-3 text-sm leading-6 outline-none focus:border-violet-400" /><div className="mt-3 flex flex-wrap gap-2"><button disabled={savingId === faq.id} onClick={() => void saveFaq(faq)} className="rounded-xl border border-stone-200 px-3 py-2 text-[10px] font-bold text-stone-600">Salvar</button>{faq.status !== "PUBLISHED" && <button disabled={savingId === faq.id} onClick={() => void saveFaq(faq, "PUBLISHED")} className="rounded-xl bg-emerald-700 px-3 py-2 text-[10px] font-black text-white">Publicar</button>}{faq.status !== "ARCHIVED" && <button disabled={savingId === faq.id} onClick={() => void saveFaq(faq, "ARCHIVED")} className="rounded-xl bg-stone-100 px-3 py-2 text-[10px] font-bold text-stone-500">Arquivar</button>}</div></article>)}{faqs.length === 0 && <Empty text="Ainda não há perguntas recorrentes suficientes para gerar FAQs." />}</section>
      ) : (
        <section className="grid min-h-[560px] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]"><aside className="rounded-[24px] border border-stone-200 bg-white p-3"><h2 className="px-2 py-2 font-serif text-xl font-bold">Conversas</h2><div className="mt-1 space-y-2">{conversations.map((item) => <button key={item.id} type="button" onClick={() => setSelectedConversationId(item.id)} className={`w-full rounded-2xl border p-3 text-left ${item.id === selectedConversationId ? "border-violet-300 bg-violet-50" : "border-stone-100 hover:bg-stone-50"}`}><div className="flex items-start justify-between gap-2"><strong className="truncate text-xs text-stone-900">{item.userName || item.userEmail || "Usuário"}</strong><span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${item.status === "ESCALATED" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-500"}`}>{statusLabel[item.status] || item.status}</span></div><p className="mt-1 truncate text-[10px] text-stone-400">{item.process}</p></button>)}{conversations.length === 0 && <Empty text="Nenhuma conversa de suporte." />}</div></aside><main className="flex min-w-0 flex-col rounded-[24px] border border-stone-200 bg-white p-4">{selectedConversation ? <><header className="flex items-start justify-between border-b border-stone-100 pb-4"><div><h2 className="font-bold text-stone-950">{selectedConversation.userName || selectedConversation.userEmail}</h2><p className="mt-1 text-xs text-stone-500">{selectedConversation.process} · {selectedConversation.pagePath}</p></div>{selectedConversation.screenshot && <button type="button" onClick={() => void viewScreenshot("support", selectedConversation.id)} className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-[10px] font-bold text-stone-600"><Image className="h-3.5 w-3.5" /> Captura</button>}</header><div className="flex-1 space-y-2 overflow-y-auto py-4">{(selectedConversation.messages || []).map((item) => <div key={item.id} className={`max-w-[86%] rounded-2xl px-3.5 py-3 text-xs leading-5 ${item.role === "USER" ? "ml-auto bg-stone-900 text-white" : item.role === "ADMIN" ? "bg-emerald-100 text-emerald-950" : "bg-violet-50 text-violet-950"}`}><p className="mb-1 text-[8px] font-black uppercase opacity-50">{item.role === "USER" ? "Usuário" : item.role === "ADMIN" ? "Suporte" : "IA"}</p>{item.text}</div>)}</div><div className="flex gap-2 border-t border-stone-100 pt-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Responder como suporte humano..." className="min-w-0 flex-1 resize-none rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-emerald-400" /><button type="button" disabled={!reply.trim() || savingId === selectedConversation.id} onClick={() => void sendReply()} className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-50">{savingId === selectedConversation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar</button></div></> : <Empty text="Selecione uma conversa." />}</main></section>
      )}

      {screenshot && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setScreenshot(null)}><div className="relative max-h-[92vh] max-w-5xl overflow-auto rounded-2xl bg-white p-2" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setScreenshot(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-4 w-4" /></button><img src={screenshot} alt="Captura enviada pelo usuário" className="max-h-[88vh] w-auto rounded-xl object-contain" /></div></div>}
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) { return <div className="rounded-[22px] border border-stone-200 bg-white p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">{icon}</span><div><strong className="font-serif text-2xl text-stone-950">{value}</strong><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</p></div></div></div>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black ${active ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50"}`}>{children}</button>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-400">{text}</div>; }
function ExpectationBadge({ value }: { value?: string | null }) { if (value === "YES") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700"><ThumbsUp className="h-3 w-3" /> Atendeu</span>; if (value === "PARTLY") return <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700">Atendeu em parte</span>; if (value === "NO") return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[9px] font-black uppercase text-red-700"><ThumbsDown className="h-3 w-3" /> Não atendeu</span>; return <span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black uppercase text-stone-500">Aguardando usuário</span>; }
function FeedbackCard({ item, busy, onUpdate, onScreenshot }: { item: Feedback; busy: boolean; onUpdate: (status: FeedbackStatus) => void; onScreenshot?: () => void }) { return <article className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-stone-950">{item.process}</strong><span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black uppercase text-stone-500">{statusLabel[item.status] || item.status}</span></div><p className="mt-1 text-[10px] text-stone-400">{item.pagePath} · {item.profileType} · {dateTime(item.createdAt)}</p></div>{onScreenshot && <button type="button" onClick={onScreenshot} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-[10px] font-bold text-stone-600"><Image className="h-3.5 w-3.5" /> Captura</button>}</div><p className="mt-3 text-sm leading-6 text-stone-600">{item.message}</p><p className="mt-2 text-[10px] text-stone-400">{item.userName || "Usuário"}{item.userEmail ? ` · ${item.userEmail}` : ""}</p><div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3"><StatusButton disabled={busy} active={item.status === "REVIEWING"} onClick={() => onUpdate("REVIEWING")} icon={<Clock3 className="h-3 w-3" />}>Analisar</StatusButton><StatusButton disabled={busy} active={item.status === "PLANNED"} onClick={() => onUpdate("PLANNED")} icon={<Lightbulb className="h-3 w-3" />}>Planejar</StatusButton><StatusButton disabled={busy} active={item.status === "DELIVERED"} onClick={() => onUpdate("DELIVERED")} icon={<CheckCircle2 className="h-3 w-3" />}>Marcar entregue</StatusButton>{busy && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}</div></article>; }
function StatusButton({ active, disabled, onClick, icon, children }: { active: boolean; disabled: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold disabled:opacity-50 ${active ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"}`}>{icon}{children}</button>; }
