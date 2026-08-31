import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, Check, CheckCircle2, Info, LayoutGrid, ShieldCheck, Store, X, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";
type ToastWorkspace = "CLASSIFIEDS" | "CAREERS" | "COMPANY" | "ADMIN" | "GENERAL";
type ToastOptions = {
  message: string;
  type?: ToastType;
  title?: string;
  duration?: number;
  sticky?: boolean;
  workspace?: ToastWorkspace;
  actionLabel?: string;
  onAction?: () => void;
};
type Toast = ToastOptions & { id: number; type: ToastType; workspace: ToastWorkspace; createdAt: number; duration: number };
type ConfirmOptions = { title?: string; message: string; confirmText?: string; cancelText?: string; destructive?: boolean };
type FeedbackApi = {
  toast: (message: string | ToastOptions, type?: ToastType) => void;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

const workspaceMeta: Record<ToastWorkspace, { label: string; eyebrow: string; rail: string; glow: string; icon: React.ComponentType<{ className?: string }> }> = {
  CLASSIFIEDS: { label: "Classificados", eyebrow: "Marketplace em movimento", rail: "from-[#b85e42] via-[#6f3541] to-[#31202a]", glow: "bg-[#b85e42]/20", icon: Store },
  CAREERS: { label: "Carreiras", eyebrow: "Oportunidades em movimento", rail: "from-[#0f766e] via-[#155e75] to-[#16324f]", glow: "bg-cyan-500/20", icon: BriefcaseBusiness },
  COMPANY: { label: "Empresa", eyebrow: "Operação da empresa", rail: "from-[#315a73] via-[#403f78] to-[#292841]", glow: "bg-indigo-500/20", icon: LayoutGrid },
  ADMIN: { label: "Admin", eyebrow: "Central de controle", rail: "from-amber-500 via-orange-600 to-stone-900", glow: "bg-amber-500/20", icon: ShieldCheck },
  GENERAL: { label: "PiraNegócios", eyebrow: "Tudo certo por aqui", rail: "from-[#b06448] via-[#51313c] to-[#231b1f]", glow: "bg-[#b06448]/20", icon: Check },
};

function workspaceFromPath(pathname = window.location.pathname): ToastWorkspace {
  if (pathname.startsWith("/classificados")) return "CLASSIFIEDS";
  if (pathname.startsWith("/vagas") || pathname.includes("/vagas") || pathname.startsWith("/carreiras")) return "CAREERS";
  if (pathname.startsWith("/admin")) return "ADMIN";
  if (pathname.startsWith("/company") || pathname.startsWith("/empresa")) return "COMPANY";
  return "GENERAL";
}

function typeCopy(type: ToastType) {
  if (type === "success") return { label: "Feito", icon: CheckCircle2, accent: "text-emerald-600", dot: "bg-emerald-500", aria: "polite" as const };
  if (type === "error") return { label: "Precisa de atenção", icon: XCircle, accent: "text-red-600", dot: "bg-red-500", aria: "assertive" as const };
  if (type === "warning") return { label: "Atenção", icon: AlertTriangle, accent: "text-amber-600", dot: "bg-amber-500", aria: "polite" as const };
  return { label: "Atualização", icon: Info, accent: "text-sky-600", dot: "bg-sky-500", aria: "polite" as const };
}

function defaultDuration(type: ToastType) {
  if (type === "error") return 7600;
  if (type === "warning") return 6400;
  if (type === "success") return 4600;
  return 5200;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const idRef = useRef(0);
  const legacyConfirmBypassRef = useRef(false);
  const recentToastRef = useRef<{ signature: string; at: number } | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: string | ToastOptions, legacyType: ToastType = "info") => {
    const options: ToastOptions = typeof input === "string" ? { message: input, type: legacyType } : input;
    const message = String(options.message || "").trim();
    if (!message) return;
    const type = options.type || legacyType || "info";
    const workspace = options.workspace || workspaceFromPath();
    const now = Date.now();
    const signature = `${workspace}:${type}:${message}`;
    if (recentToastRef.current?.signature === signature && now - recentToastRef.current.at < 900) return;
    recentToastRef.current = { signature, at: now };

    const id = ++idRef.current;
    const duration = options.sticky ? 0 : Math.max(1800, options.duration ?? defaultDuration(type));
    const item: Toast = { ...options, id, message, type, workspace, createdAt: now, duration };
    setToasts((current) => [...current.slice(-3), item]);
    if (duration > 0) window.setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const normalized: ConfirmOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => setDialog({ ...normalized, resolve }));
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<ToastOptions>).detail;
      if (detail?.message) toast(detail);
    };
    window.addEventListener("pira:toast", listener);
    return () => window.removeEventListener("pira:toast", listener);
  }, [toast]);

  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = (message?: unknown) => toast({ message: String(message ?? ""), type: "info" });
    window.confirm = (message?: string) => {
      if (legacyConfirmBypassRef.current) {
        legacyConfirmBypassRef.current = false;
        return true;
      }

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      void confirm({
        title: "Confirmar ação",
        message: String(message ?? "Deseja continuar?"),
        confirmText: "Confirmar",
        cancelText: "Cancelar",
        destructive: /excluir|remover|apagar|deletar|permanent/i.test(String(message ?? "")),
      }).then((approved) => {
        if (!approved || !activeElement?.isConnected) return;
        legacyConfirmBypassRef.current = true;
        activeElement.click();
      });
      return false;
    };

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [confirm, toast]);

  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const resolve = dialog.resolve;
      setDialog(null);
      resolve(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dialog]);

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const closeDialog = (value: boolean) => {
    if (!dialog) return;
    const resolve = dialog.resolve;
    setDialog(null);
    resolve(value);
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <style>{`
        @keyframes piraSignalIn { 0% { opacity: 0; transform: translate3d(24px,-8px,0) scale(.96); filter: blur(5px); } 65% { opacity: 1; transform: translate3d(-3px,0,0) scale(1.01); filter: blur(0); } 100% { opacity: 1; transform: translate3d(0,0,0) scale(1); } }
        @keyframes piraSignalPulse { 0%,100% { transform: scale(.85); opacity:.5; } 50% { transform: scale(1.15); opacity:1; } }
        @keyframes piraSignalProgress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        @media (prefers-reduced-motion: reduce) { .pira-signal-enter, .pira-signal-progress, .pira-signal-pulse { animation: none !important; } }
      `}</style>

      <div className="pointer-events-none fixed inset-x-0 top-3 z-[13000] flex flex-col items-center gap-3 px-3 sm:items-end sm:pl-6 sm:pr-5" aria-label="Notificações do PiraNegócios">
        {toasts.map((item) => {
          const meta = workspaceMeta[item.workspace];
          const typeMeta = typeCopy(item.type);
          const TypeIcon = typeMeta.icon;
          const WorkspaceIcon = meta.icon;
          return (
            <div key={item.id} className="pira-signal-enter pointer-events-auto relative w-full max-w-[430px] overflow-hidden rounded-[26px] bg-[#fffdf9]/96 shadow-[0_24px_70px_rgba(32,23,25,.24)] ring-1 ring-black/[.08] backdrop-blur-xl" style={{ animation: "piraSignalIn 420ms cubic-bezier(.2,.85,.25,1) both" }} role={item.type === "error" ? "alert" : "status"} aria-live={typeMeta.aria}>
              <div className={`absolute inset-y-0 left-0 w-[7px] bg-gradient-to-b ${meta.rail}`} />
              <div className={`absolute -right-12 -top-16 h-36 w-36 rounded-full blur-3xl ${meta.glow}`} />
              <div className="relative flex gap-3.5 px-4 pb-4 pl-5 pt-3.5">
                <div className="relative mt-0.5 shrink-0">
                  <div className={`absolute inset-0 rounded-2xl ${meta.glow} blur-md`} />
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-950 text-white shadow-lg"><WorkspaceIcon className="h-5 w-5" /></div>
                  <span className={`pira-signal-pulse absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#fffdf9] ${typeMeta.dot}`} style={{ animation: "piraSignalPulse 1.8s ease-in-out infinite" }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[9px] font-black uppercase tracking-[.17em] text-stone-400">{meta.eyebrow}</p>
                      <div className="mt-0.5 flex items-center gap-1.5"><TypeIcon className={`h-4 w-4 ${typeMeta.accent}`} /><p className="text-[11px] font-black uppercase tracking-[.08em] text-stone-700">{item.title || typeMeta.label}</p><span className="text-[10px] font-bold text-stone-300">·</span><span className="text-[10px] font-bold text-stone-400">{meta.label}</span></div>
                    </div>
                    <button onClick={() => dismissToast(item.id)} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-900" aria-label="Fechar notificação"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-5.5 text-stone-800">{item.message}</p>
                  {item.actionLabel && item.onAction && <button type="button" onClick={() => { item.onAction?.(); dismissToast(item.id); }} className="mt-3 inline-flex h-9 items-center rounded-xl bg-stone-950 px-3.5 text-[11px] font-black text-white shadow-sm transition hover:-translate-y-0.5">{item.actionLabel}</button>}
                </div>
              </div>
              {item.duration > 0 && <div className="h-1 bg-stone-100"><div className={`pira-signal-progress h-full origin-left bg-gradient-to-r ${meta.rail}`} style={{ animation: `piraSignalProgress ${item.duration}ms linear both` }} /></div>}
            </div>
          );
        })}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(false); }}>
          <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-[#fffdfa] p-5 shadow-[0_28px_90px_rgba(0,0,0,.28)]" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${dialog.destructive ? "bg-red-100 text-red-700" : "bg-stone-950 text-white"}`}><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-stone-400">PiraNegócios · confirmação</p>
                <h2 id="feedback-dialog-title" className="mt-1 font-serif text-xl font-bold text-stone-950">{dialog.title || "Confirmar ação"}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">{dialog.message}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => closeDialog(false)} className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50">{dialog.cancelText || "Cancelar"}</button>
              <button onClick={() => closeDialog(true)} autoFocus className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white ${dialog.destructive ? "bg-red-600 hover:bg-red-700" : "bg-stone-950 hover:bg-stone-800"}`}>{dialog.confirmText || "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used inside FeedbackProvider");
  return context;
}

export function emitFeedbackToast(options: ToastOptions | string, type: ToastType = "info") {
  if (typeof window === "undefined") return;
  const detail: ToastOptions = typeof options === "string" ? { message: options, type } : options;
  window.dispatchEvent(new CustomEvent<ToastOptions>("pira:toast", { detail }));
}
