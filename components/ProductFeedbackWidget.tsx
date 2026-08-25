import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Bot,
  Check,
  ImagePlus,
  Loader2,
  MessageCircleMore,
  Send,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api, asArray } from "../lib/api";

type Screenshot = { name: string; mimeType: string; size: number; data: string };
type SupportMessage = { id: string; role: "USER" | "ASSISTANT" | "ADMIN"; text: string; createdAt: string };
type Conversation = { id: string; status: string; messages: SupportMessage[]; screenshot?: Omit<Screenshot, "data"> | null };
type Expectation = { id: string; message: string; process: string; updatedAt: string };

function pageProcess(pathname: string) {
  const routes: Array<[RegExp, string]> = [
    [/^\/company\/vagas\/convites/, "Convites para vagas"],
    [/^\/company\/vagas\/nova/, "Publicação de vaga"],
    [/^\/company\/vagas/, "Gestão de vagas"],
    [/^\/company\/talentos/, "Banco de talentos"],
    [/^\/company\/pagina/, "Página da empresa"],
    [/^\/company\/contratacao/, "Processo de contratação"],
    [/^\/company/, "Área da empresa"],
    [/^\/user\/curriculo/, "Currículo"],
    [/^\/user\/vagas|^\/user\/vaga\//, "Busca e visualização de vagas"],
    [/^\/user\/perfil/, "Perfil profissional"],
    [/^\/user/, "Área do candidato"],
    [/^\/admin\/ai/, "Configuração de inteligência artificial"],
    [/^\/admin/, "Administração"],
    [/^\/convites\/vaga\//, "Acesso a convite"],
    [/^\/vagas/, "Portal de vagas"],
    [/^\/criador-de-curriculo/, "Criador público de currículo"],
  ];
  return routes.find(([pattern]) => pattern.test(pathname))?.[1] || "Navegação geral";
}

function fileToScreenshot(file: File): Promise<Screenshot> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
    return Promise.reject(new Error("Use uma imagem PNG, JPG ou WebP de até 2 MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a captura."));
    reader.onload = () => resolve({ name: file.name, mimeType: file.type, size: file.size, data: String(reader.result || "") });
    reader.readAsDataURL(file);
  });
}

export function ProductFeedbackWidget() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"feedback" | "support">("feedback");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [assistantName, setAssistantName] = useState("Assistente PiraNegócios");
  const [feedbackText, setFeedbackText] = useState("");
  const [chatText, setChatText] = useState("");
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [pendingMessage, setPendingMessage] = useState<SupportMessage | null>(null);
  const [expectations, setExpectations] = useState<Expectation[]>([]);
  const [expectationComment, setExpectationComment] = useState("");
  const [notice, setNotice] = useState("");
  const process = useMemo(() => pageProcess(location.pathname), [location.pathname]);

  const load = async () => {
    if (!user) return;
    const [status, pending, support] = await Promise.all([
      api.get("/product-feedback/status").catch(() => null),
      api.get("/product-feedback/expectations").catch(() => null),
      api.get("/product-feedback/support/mine").catch(() => null),
    ]);
    setAiEnabled(Boolean(status?.data?.aiEnabled));
    setAssistantName(status?.data?.assistantName || "Assistente PiraNegócios");
    setExpectations(asArray<Expectation>(pending?.data));
    setConversation(support?.data || null);
  };

  useEffect(() => { if (user) void load(); }, [user?.uid]);
  useEffect(() => { setNotice(""); }, [location.pathname]);
  useEffect(() => {
    if (open && tab === "support") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [open, tab, conversation?.messages?.length, pendingMessage, sending]);

  if (!user) return null;

  const chooseScreenshot = async (file?: File) => {
    if (!file) return;
    try {
      setScreenshot(await fileToScreenshot(file));
      setNotice("");
    } catch (error: any) {
      setNotice(error?.message || "Captura inválida.");
    }
  };

  const submitFeedback = async () => {
    if (feedbackText.trim().length < 3) return setNotice("Conte um pouco mais sobre o que está faltando.");
    setSending(true);
    setNotice("");
    try {
      await api.post("/product-feedback", {
        message: feedbackText,
        pagePath: location.pathname + location.search,
        process,
        screenshot,
      });
      setFeedbackText("");
      setScreenshot(null);
      setNotice("Pronto. Sua sugestão foi enviada e já entrou na fila de análise.");
    } catch (error: any) {
      setNotice(error?.response?.data?.message || "Não foi possível enviar agora.");
    } finally {
      setSending(false);
    }
  };

  const sendChat = async () => {
    if (!chatText.trim()) return;
    const message = chatText;
    const optimisticMessage: SupportMessage = {
      id: `pending-${Date.now()}`,
      role: "USER",
      text: message,
      createdAt: new Date().toISOString(),
    };
    setChatText("");
    setPendingMessage(optimisticMessage);
    setSending(true);
    setNotice("");
    try {
      const response = await api.post("/product-feedback/support/chat", {
        conversationId: conversation?.id,
        message,
        pagePath: location.pathname + location.search,
        process,
        screenshot,
      }, { timeout: 90000 });
      if (!response.data || !Array.isArray(response.data.messages)) {
        throw new Error("A conversa retornou em um formato inesperado.");
      }
      setConversation(response.data as Conversation);
      setPendingMessage(null);
      setScreenshot(null);
    } catch (error: any) {
      const recovered = await api.get("/product-feedback/support/mine", { timeout: 10000 }).catch(() => null);
      if (recovered?.data && Array.isArray(recovered.data.messages) && recovered.data.messages.some((item: SupportMessage) => item.role === "USER" && item.text === message)) {
        setConversation(recovered.data as Conversation);
        setPendingMessage(null);
        setScreenshot(null);
      } else {
        setNotice(error?.response?.data?.message || "Não foi possível confirmar o envio. Sua mensagem continua aqui para você não perdê-la.");
      }
    } finally {
      setSending(false);
    }
  };

  const answerExpectation = async (expectation: "YES" | "PARTLY" | "NO") => {
    const item = expectations[0];
    if (!item) return;
    setSending(true);
    try {
      await api.post(`/product-feedback/${item.id}/expectation`, { expectation, comment: expectationComment });
      setExpectations((current) => current.slice(1));
      setExpectationComment("");
      setNotice("Obrigada pelo retorno. Isso ajuda a gente a validar a melhoria de verdade.");
    } catch (error: any) {
      setNotice(error?.response?.data?.message || "Não foi possível salvar seu retorno.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-3 z-[70] md:bottom-6 md:right-6">
      {open ? (
        <section className="flex h-[min(720px,78vh)] w-[calc(100vw-24px)] max-w-[410px] flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-[#fffdfa] shadow-[0_28px_90px_rgba(31,22,17,.24)]">
          <header className="flex shrink-0 items-center gap-3 bg-[#2b211c] px-4 py-3 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7a283] text-[#2b211c]"><MessageCircleMore className="h-4.5 w-4.5" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-black">Sugestões e suporte</p><p className="truncate text-[9px] text-white/45">{process} · {profile?.type || "Usuário"}</p></div>
            <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.08] text-white/60" aria-label="Fechar"><X className="h-4 w-4" /></button>
          </header>

          <div className="grid shrink-0 grid-cols-2 border-b border-stone-200 bg-white p-1.5">
            <button type="button" onClick={() => setTab("feedback")} className={`rounded-xl px-3 py-2 text-xs font-black ${tab === "feedback" ? "bg-stone-900 text-white" : "text-stone-500"}`}>Está faltando algo?</button>
            <button type="button" onClick={() => setTab("support")} className={`rounded-xl px-3 py-2 text-xs font-black ${tab === "support" ? "bg-stone-900 text-white" : "text-stone-500"}`}>{aiEnabled ? "Ajuda com IA" : "Suporte"}</button>
          </div>

          {tab === "feedback" ? (
            <div className="flex-1 overflow-y-auto p-4">
              {expectations[0] && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-700" /><div><p className="text-xs font-black text-emerald-950">Uma melhoria que você pediu foi entregue</p><p className="mt-1 line-clamp-3 text-[11px] leading-5 text-emerald-900/70">{expectations[0].message}</p></div></div><textarea value={expectationComment} onChange={(event) => setExpectationComment(event.target.value)} rows={2} placeholder="Quer contar mais alguma coisa? (opcional)" className="mt-3 w-full resize-none rounded-xl border border-emerald-200 bg-white p-3 text-xs outline-none" /><div className="mt-2 grid grid-cols-3 gap-1.5"><button onClick={() => void answerExpectation("YES")} className="rounded-lg bg-emerald-700 px-2 py-2 text-[10px] font-bold text-white">Sim</button><button onClick={() => void answerExpectation("PARTLY")} className="rounded-lg bg-amber-100 px-2 py-2 text-[10px] font-bold text-amber-800">Em parte</button><button onClick={() => void answerExpectation("NO")} className="rounded-lg bg-red-100 px-2 py-2 text-[10px] font-bold text-red-700">Não</button></div></div>}
              <p className="text-sm font-bold text-stone-900">O que você sentiu falta nesta página?</p>
              <p className="mt-1 text-[11px] leading-5 text-stone-500">A página e o processo já serão identificados automaticamente.</p>
              <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} rows={5} placeholder="Ex.: eu queria conseguir filtrar por..., não encontrei onde..., seria melhor se..." className="mt-3 w-full resize-none rounded-2xl border border-stone-200 bg-white p-3.5 text-sm leading-6 outline-none focus:border-terracotta-400" />
              <Attachment screenshot={screenshot} onChoose={() => fileRef.current?.click()} onClear={() => setScreenshot(null)} />
              <button type="button" disabled={sending} onClick={() => void submitFeedback()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar sugestão</button>
              {notice && <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-[11px] leading-5 text-stone-600">{notice}</p>}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col bg-white">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${aiEnabled ? "bg-violet-100 text-violet-700" : "bg-stone-100 text-stone-500"}`}><Bot className="h-4 w-4" /></span>
                  <div><p className="text-xs font-black text-stone-900">{assistantName}</p><p className="text-[10px] text-stone-500">Atendimento e suporte inteligente.</p></div>
                </div>
                {!aiEnabled && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-700">O atendimento inteligente está temporariamente indisponível.</p>}
                {(conversation?.messages || []).map((message) => (
                  <div key={message.id} className={message.role === "USER" ? "ml-auto max-w-[86%]" : "max-w-[86%]"}>
                    {message.role !== "USER" && <p className="mb-1 ml-1 text-[9px] font-bold text-violet-600">{message.role === "ADMIN" ? "Equipe PiraNegócios" : assistantName}</p>}
                    <div className={`whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-xs leading-5 ${message.role === "USER" ? "rounded-br-md bg-[#2b211c] text-white" : message.role === "ADMIN" ? "rounded-bl-md bg-emerald-100 text-emerald-950" : "rounded-bl-md bg-stone-100 text-stone-700"}`}>{message.text}</div>
                  </div>
                ))}
                {pendingMessage && <div className="ml-auto max-w-[86%]"><div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#2b211c] px-3 py-2.5 text-xs leading-5 text-white">{pendingMessage.text}</div></div>}
                {sending && pendingMessage && (
                  <div className="max-w-[86%]">
                    <p className="mb-1 ml-1 text-[9px] font-bold text-violet-600">{assistantName}</p>
                    <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-stone-100 px-3 py-3" aria-label={`${assistantName} está digitando`}>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" />
                    </div>
                  </div>
                )}
                {!conversation?.messages?.length && !pendingMessage && <p className="py-5 text-center text-xs text-stone-400">Pode me contar o que aconteceu nesta tela.</p>}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 border-t border-stone-200 bg-[#fffdfa] p-3">
                {screenshot && <div className="mb-2 flex items-center gap-2 rounded-xl bg-stone-100 px-2.5 py-2"><img src={screenshot.data} alt="Captura anexada" className="h-8 w-11 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-[9px] text-stone-500">{screenshot.name}</span><button type="button" onClick={() => setScreenshot(null)} className="text-stone-400" aria-label="Remover captura"><X className="h-3.5 w-3.5" /></button></div>}
                <div className="flex items-end gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:border-violet-300 hover:text-violet-700" aria-label={screenshot ? "Trocar captura" : "Anexar captura"} title={screenshot ? "Trocar captura" : "Anexar captura"}><ImagePlus className="h-4.5 w-4.5" /></button>
                  <textarea value={chatText} onChange={(event) => setChatText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!sending && chatText.trim()) void sendChat(); } }} rows={1} placeholder="Digite uma mensagem..." className="min-h-11 max-h-28 flex-1 resize-none rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm leading-5 outline-none focus:border-violet-400" />
                  <button type="button" disabled={sending || !chatText.trim()} onClick={() => void sendChat()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-white disabled:opacity-40" aria-label="Enviar mensagem"><Send className="h-4.5 w-4.5" /></button>
                </div>
                {notice && <p className="mt-2 rounded-lg bg-stone-100 px-2.5 py-1.5 text-[10px] leading-4 text-stone-600">{notice}</p>}
              </div>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { void chooseScreenshot(event.target.files?.[0]); event.target.value = ""; }} />
        </section>
      ) : (
        <button type="button" onClick={() => { setOpen(true); void load(); }} className="relative ml-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#d9c7ba] bg-[#fffdfa] text-[#3a2921] shadow-[0_12px_40px_rgba(45,29,20,.18)] transition hover:-translate-y-0.5 hover:border-terracotta-300" aria-label="Abrir sugestões e suporte" title="Sugestões e suporte"><MessageCircleMore className="h-5 w-5 text-terracotta-600" />{expectations.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-black text-white">{expectations.length}</span>}</button>
      )}
    </div>
  );
}

function Attachment({ screenshot, onChoose, onClear }: { screenshot: Screenshot | null; onChoose: () => void; onClear: () => void }) {
  return <div className="mt-2 flex items-center gap-2"><button type="button" onClick={onChoose} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold text-stone-600"><ImagePlus className="h-3.5 w-3.5" /> {screenshot ? "Trocar captura" : "Anexar captura"}</button>{screenshot && <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-stone-100 px-2.5 py-2"><img src={screenshot.data} alt="Captura anexada" className="h-7 w-9 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-[9px] text-stone-500">{screenshot.name}</span><button type="button" onClick={onClear} className="text-stone-400" aria-label="Remover captura"><X className="h-3.5 w-3.5" /></button></div>}</div>;
}
