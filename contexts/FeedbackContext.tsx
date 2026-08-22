import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";
type Toast = { id: number; message: string; type: ToastType };
type ConfirmOptions = { title?: string; message: string; confirmText?: string; cancelText?: string; destructive?: boolean };
type FeedbackApi = {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const idRef = useRef(0);
  const legacyConfirmBypassRef = useRef(false);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    if (!message) return;
    const id = ++idRef.current;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const normalized: ConfirmOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => setDialog({ ...normalized, resolve }));
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = (message?: unknown) => toast(String(message ?? ""), "info");
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

      <div className="pointer-events-none fixed inset-x-0 top-3 z-[13000] flex flex-col items-center gap-2 px-3 sm:items-end sm:pl-6 sm:pr-4" aria-live="polite">
        {toasts.map((item) => {
          const Icon = item.type === "success" ? CheckCircle2 : item.type === "error" ? XCircle : item.type === "warning" ? AlertTriangle : Info;
          const tone = item.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : item.type === "error" ? "border-red-200 bg-red-50 text-red-900" : item.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-stone-200 bg-white text-stone-800";
          return (
            <div key={item.id} className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_16px_45px_rgba(45,35,28,.16)] ${tone}`}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-semibold leading-5">{item.message}</p>
              <button onClick={() => setToasts((current) => current.filter((toast) => toast.id !== item.id))} className="rounded-lg p-1 opacity-60 hover:bg-black/5 hover:opacity-100" aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(false); }}>
          <div className="w-full max-w-md rounded-[26px] border border-stone-200 bg-[#fffdfa] p-5 shadow-[0_28px_90px_rgba(0,0,0,.28)]" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${dialog.destructive ? "bg-red-100 text-red-700" : "bg-stone-900 text-white"}`}><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 id="feedback-dialog-title" className="font-serif text-xl font-bold text-stone-950">{dialog.title || "Confirmar ação"}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">{dialog.message}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => closeDialog(false)} className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50">{dialog.cancelText || "Cancelar"}</button>
              <button onClick={() => closeDialog(true)} autoFocus className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white ${dialog.destructive ? "bg-red-600 hover:bg-red-700" : "bg-stone-900 hover:bg-stone-800"}`}>{dialog.confirmText || "Confirmar"}</button>
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
