import React, { useEffect, useState } from "react";
import { Ban, CheckCircle2, Loader2, RefreshCw, UserPlus, Users } from "lucide-react";
import { api, asArray } from "../lib/api";
import { useFeedback } from "../contexts/FeedbackContext";

type Interest = {
  id: string;
  name: string;
  email: string;
  source: "EMAIL" | "GOOGLE";
  status: "WAITING" | "INVITED" | "CONVERTED";
  createdAt: string;
};

export function AdminRegistrationPage() {
  const { toast, confirm } = useFeedback();
  const [open, setOpen] = useState(true);
  const [waiting, setWaiting] = useState(0);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/registration");
      setOpen(response.data?.open !== false);
      setWaiting(Number(response.data?.waiting || 0));
      setInterests(asArray<Interest>(response.data?.interests));
    } catch (error) {
      console.error(error);
      toast("Não foi possível carregar o controle de cadastros.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggle = async () => {
    const next = !open;
    const approved = await confirm({
      title: next ? "Reabrir novos cadastros?" : "Pausar novos cadastros?",
      message: next
        ? "Novos usuários poderão voltar a criar contas completas imediatamente."
        : "Novos visitantes passarão para o pré-cadastro e serão adicionados à lista de espera. Membros existentes continuarão entrando normalmente.",
      confirmText: next ? "Reabrir cadastros" : "Pausar cadastros",
      cancelText: "Cancelar",
      destructive: !next,
    });
    if (!approved) return;

    setSaving(true);
    try {
      const response = await api.patch("/admin/registration", { open: next });
      setOpen(response.data?.open === true);
      toast(next ? "Novos cadastros reabertos." : "Novos cadastros pausados. Lista de espera ativada.", "success");
      await load();
    } catch (error) {
      console.error(error);
      toast("Não foi possível alterar a política de cadastro.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-terracotta-600" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Plataforma · Admissão</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-950">Novos cadastros</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Controle a entrada de novos membros enquanto produtos, cobrança, validações e regras de acesso estão sendo preparados.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-600 shadow-sm"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </header>

      <section className={`overflow-hidden rounded-[28px] border shadow-[0_18px_55px_rgba(42,31,25,.08)] ${open ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/65"}`}>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${open ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>{open ? <CheckCircle2 className="h-6 w-6" /> : <Ban className="h-6 w-6" />}</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-500">Estado atual</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-stone-950">{open ? "Novos cadastros estão abertos" : "Novos cadastros estão pausados"}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{open ? "Visitantes podem concluir o cadastro normalmente por e-mail ou Google." : "Novos visitantes deixam apenas nome e e-mail. Contas existentes continuam acessando normalmente."}</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={() => void toggle()} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50 ${open ? "bg-stone-900 hover:bg-stone-800" : "bg-terracotta-600 hover:bg-terracotta-700"}`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : open ? <Ban className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{open ? "Pausar novos cadastros" : "Reabrir novos cadastros"}</button>
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-[#fffdfa] shadow-[0_18px_50px_rgba(66,43,28,.05)]">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><Users className="h-5 w-5" /></span><div><h2 className="text-lg font-bold text-stone-950">Lista de espera</h2><p className="text-xs text-stone-500">{waiting} pessoa{waiting === 1 ? "" : "s"} aguardando abertura</p></div></div>
          <span className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-black text-white">{interests.length}</span>
        </div>

        {interests.length === 0 ? (
          <div className="px-6 py-14 text-center"><UserPlus className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-bold text-stone-600">Nenhum pré-cadastro ainda.</p><p className="mt-1 text-xs text-stone-400">Quando a entrada estiver pausada, os interessados aparecerão aqui.</p></div>
        ) : (
          <div className="divide-y divide-stone-100">
            {interests.map((interest) => (
              <div key={interest.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:px-6">
                <div><p className="text-sm font-bold text-stone-900">{interest.name}</p><p className="mt-1 text-xs text-stone-500">{interest.email}</p></div>
                <div className="flex items-center gap-2"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.1em] text-stone-600">{interest.source === "GOOGLE" ? "Google" : "E-mail"}</span><span className="text-[11px] text-stone-400">{new Date(interest.createdAt).toLocaleString("pt-BR")}</span></div>
                <span className="justify-self-start rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-amber-800 sm:justify-self-end">Aguardando</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
