import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Image, Loader2, MessageSquareText, RefreshCw, ShieldCheck, Star, XCircle } from "lucide-react";
import { api } from "../lib/api";

type Review = {
  id: string;
  orderId: string;
  listingId: string;
  companyId: string;
  title: string;
  companyName: string;
  productRating?: number | null;
  serviceRating?: number | null;
  companyRating?: number | null;
  comment?: string | null;
  photoUrls?: string[];
  status: string;
  moderationReason?: string | null;
  submittedAt?: string | null;
};

export default function AdminClassifiedReviewsPage() {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Review | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true); setMessage("");
    try {
      const response = await api.get("/admin/classifieds-reviews/pending");
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível carregar as avaliações pendentes.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const moderate = async (decision: "APPROVE" | "REJECT") => {
    if (!selected) return;
    if (decision === "REJECT" && !reason.trim()) {
      setMessage("Informe o motivo da reprovação.");
      return;
    }
    setWorking(decision); setMessage("");
    try {
      await api.patch(`/admin/classifieds-reviews/${selected.id}`, { decision, reason });
      setRows(current => current.filter(item => item.id !== selected.id));
      setSelected(null); setReason("");
      setMessage(decision === "APPROVE" ? "Avaliação aprovada. Ela respeitará a data programada de publicação." : "Avaliação reprovada.");
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Não foi possível registrar a decisão.");
    } finally { setWorking(""); }
  };

  const countWithPhotos = useMemo(() => rows.filter(row => Array.isArray(row.photoUrls) && row.photoUrls.length).length, [rows]);

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-700">Marketplace · confiança</p><h1 className="mt-1 font-serif text-3xl font-black">Moderação de avaliações</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Crítica negativa legítima não é motivo de reprovação. A moderação existe para abuso, ameaça, humilhação, exposição de dados e conteúdo impróprio. Fotos sempre podem receber conferência humana antes da publicação.</p></div><button onClick={() => void load()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" />Atualizar</button></header>
    {message && <div className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">{message}</div>}
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Na fila" value={rows.length}/><Metric label="Com fotos" value={countWithPhotos}/><Metric label="Identidade pública" value="Compra verificada"/></div>
    <section className="overflow-hidden rounded-[28px] bg-white ring-1 ring-stone-200">{loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div> : rows.length ? <div className="divide-y divide-stone-100">{rows.map(row => <button key={row.id} onClick={() => { setSelected(row); setReason(row.moderationReason || ""); }} className="grid w-full gap-3 p-5 text-left transition hover:bg-stone-50 md:grid-cols-[1.4fr_1fr_auto] md:items-center"><div><p className="text-sm font-black text-stone-950">{row.title}</p><p className="mt-1 text-xs text-stone-400">{row.companyName} · pedido {String(row.orderId).slice(0,8)}</p>{row.comment && <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-600">{row.comment}</p>}</div><div className="flex flex-wrap gap-2"><Rating label="Produto" value={row.productRating}/><Rating label="Atendimento" value={row.serviceRating}/><Rating label="Empresa" value={row.companyRating}/></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${row.status === "PENDING_MANUAL" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"}`}>{row.status === "PENDING_MANUAL" ? "Revisão humana" : "Aguardando IA"}</span>{Boolean(row.photoUrls?.length) && <Image className="h-4 w-4 text-stone-400" />}</div></button>)}</div> : <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><ShieldCheck className="h-8 w-8 text-emerald-500"/><p className="mt-3 text-sm font-black">Fila limpa</p><p className="mt-1 text-xs text-stone-400">Nenhuma avaliação aguardando moderação.</p></div>}</section>

    {selected && <div className="fixed inset-0 z-[190] overflow-y-auto bg-black/60 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="mx-auto my-4 max-w-4xl overflow-hidden rounded-[30px] bg-[#f7f5f2] shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-stone-200 bg-white p-5 sm:p-6"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-700">Compra verificada · avaliação privada</p><h2 className="mt-1 font-serif text-2xl font-black">{selected.title}</h2><p className="mt-1 text-xs text-stone-400">{selected.companyName}</p></div><button onClick={() => setSelected(null)} className="rounded-full bg-stone-100 p-2"><XCircle className="h-5 w-5" /></button></header><div className="space-y-5 p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-3"><RatingCard label="Produto" value={selected.productRating}/><RatingCard label="Atendimento" value={selected.serviceRating}/><RatingCard label="Empresa" value={selected.companyRating}/></div>{selected.comment && <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"><div className="flex items-center gap-2 text-xs font-black"><MessageSquareText className="h-4 w-4"/>Comentário</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{selected.comment}</p></section>}{Boolean(selected.photoUrls?.length) && <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-xs font-black">Fotos enviadas</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{selected.photoUrls!.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-stone-100"><img src={url} alt="Foto da avaliação" className="aspect-square h-full w-full object-cover" /></a>)}</div></section>}<section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-xs font-black">Motivo / observação da moderação</p><textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm outline-none" placeholder="Obrigatório para reprovar"/><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={() => void moderate("APPROVE")} disabled={Boolean(working)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-xs font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/>Aprovar</button><button onClick={() => void moderate("REJECT")} disabled={Boolean(working)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 text-xs font-black text-white disabled:opacity-50"><XCircle className="h-4 w-4"/>Reprovar</button></div></section></div></section></div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>; }
function Rating({ label, value }: { label: string; value?: number | null }) { return value == null ? null : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700"><Star className="h-3 w-3 fill-current" />{label} {value}</span>; }
function RatingCard({ label, value }: { label: string; value?: number | null }) { return <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><p className="mt-2 flex items-center gap-1 text-xl font-black">{value == null ? "—" : <><Star className="h-5 w-5 fill-amber-400 text-amber-400" />{value}/5</>}</p></div>; }
