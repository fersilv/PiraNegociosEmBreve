import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, EyeOff, HelpCircle, Loader2, MessageCircleQuestion, RefreshCw, Search, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ClassifiedMediaFrame } from '../components/classifieds/ClassifiedMediaFrame';
import { api } from '../lib/api';

type QuestionRow = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingSlug: string;
  image?: string | null;
  askerFirstName: string;
  question: string;
  answer?: string | null;
  status: 'PENDING' | 'ANSWERED' | 'HIDDEN';
  helpfulCount: number;
  createdAt: string;
  answeredAt?: string | null;
};

type Filter = 'ALL' | 'PENDING' | 'ANSWERED' | 'HIDDEN';

export default function ClassifiedsQuestionsManagementPage() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [summary, setSummary] = useState({ pending: 0, answered: 0, hidden: 0 });
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [listResponse, summaryResponse] = await Promise.all([
        api.get(`/classifieds/me/questions?status=${filter}`),
        api.get('/classifieds/me/questions/summary'),
      ]);
      setRows(Array.isArray(listResponse.data) ? listResponse.data : []);
      setSummary({
        pending: Number(summaryResponse.data?.pending || 0),
        answered: Number(summaryResponse.data?.answered || 0),
        hidden: Number(summaryResponse.data?.hidden || 0),
      });
      if (!silent) setError('');
    } catch (requestError: any) {
      if (!silent) setError(requestError?.response?.data?.message || 'Não foi possível carregar as perguntas.');
    } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { void load(); }, [filter]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return rows;
    return rows.filter((row) => [row.listingTitle, row.askerFirstName, row.question, row.answer]
      .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(needle)));
  }, [rows, query]);

  const answer = async (row: QuestionRow) => {
    const text = String(answers[row.id] ?? row.answer ?? '').trim();
    if (text.length < 2) {
      setError('Escreva a resposta antes de publicar.');
      return;
    }
    setWorking(row.id); setError(''); setNotice('');
    try {
      await api.patch(`/classifieds/me/questions/${row.id}/answer`, { answer: text });
      setNotice('Resposta publicada. A pergunta agora pode aparecer na página do anúncio.');
      setAnswers((current) => ({ ...current, [row.id]: '' }));
      await load(true);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível publicar a resposta.');
    } finally { setWorking(''); }
  };

  const hide = async (row: QuestionRow) => {
    if (working) return;
    setWorking(row.id); setError(''); setNotice('');
    try {
      await api.patch(`/classifieds/me/questions/${row.id}/hide`);
      setNotice('Pergunta ocultada da página pública.');
      await load(true);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível ocultar a pergunta.');
    } finally { setWorking(''); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">Relacionamento no anúncio</p><h1 className="mt-1 font-serif text-3xl font-black">Perguntas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Responda dúvidas sobre seus produtos e serviços. Perguntas ficam privadas até você responder e nunca expõem o nome completo do cliente.</p></div><button type="button" onClick={() => void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button></header>

      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Aguardando resposta" value={summary.pending} attention /><Metric label="Respondidas" value={summary.answered} /><Metric label="Ocultas" value={summary.hidden} /></div>

      {notice && <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> {notice}</div>}
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <section className="rounded-[24px] bg-white p-3 ring-1 ring-black/[.06]"><div className="flex flex-col gap-3 lg:flex-row"><label className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produto, primeiro nome ou pergunta..." className="h-11 w-full rounded-xl bg-stone-50 pl-10 pr-3 text-sm font-semibold outline-none ring-1 ring-stone-200" /></label><div className="flex gap-2 overflow-x-auto">{([['PENDING','Pendentes',summary.pending],['ANSWERED','Respondidas',summary.answered],['HIDDEN','Ocultas',summary.hidden],['ALL','Todas',summary.pending + summary.answered + summary.hidden]] as const).map(([value,label,count]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-black ${filter === value ? 'bg-[#0d4542] text-white' : 'bg-stone-100 text-stone-600'}`}>{label} <span className="ml-1 opacity-65">{count}</span></button>)}</div></div></section>

      {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div> : visible.length ? <div className="space-y-3">{visible.map((row) => <article key={row.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:p-5"><div className="flex gap-3"><ClassifiedMediaFrame src={row.image} alt="" className="h-16 w-16 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Status status={row.status} /><span className="text-[9px] font-bold text-stone-400">{formatDate(row.createdAt)}</span></div><Link to={`/classificados/explorar/${encodeURIComponent(row.listingSlug)}`} className="mt-1 block truncate text-sm font-black text-stone-800 hover:underline">{row.listingTitle}</Link><p className="mt-1 text-[10px] font-bold text-stone-400">Pergunta de {row.askerFirstName}</p></div></div><div className="mt-4 rounded-2xl bg-stone-50 p-4"><p className="text-sm font-bold leading-6 text-stone-800">{row.question}</p></div>{row.status === 'ANSWERED' && row.answer && <div className="mt-3 rounded-2xl bg-emerald-50 p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-emerald-700">Sua resposta pública</p><p className="mt-2 text-sm leading-6 text-stone-700">{row.answer}</p>{row.helpfulCount > 0 && <p className="mt-2 text-[9px] font-bold text-emerald-700">{row.helpfulCount} marcação(ões) “Me ajudou”</p>}</div>}{row.status !== 'HIDDEN' && <div className="mt-4"><textarea value={answers[row.id] ?? (row.status === 'ANSWERED' ? row.answer || '' : '')} onChange={(event) => setAnswers((current) => ({ ...current, [row.id]: event.target.value.slice(0, 1800) }))} rows={3} placeholder="Responda com clareza, sem telefone, redes sociais ou links externos..." className="w-full rounded-2xl bg-stone-50 px-4 py-3 text-sm font-semibold outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-[#4b8f87]/30" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={working === row.id} onClick={() => void answer(row)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:opacity-50"><Send className="h-4 w-4" /> {row.status === 'ANSWERED' ? 'Atualizar resposta' : 'Responder e publicar'}</button><button type="button" disabled={working === row.id} onClick={() => void hide(row)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-stone-100 px-4 text-xs font-black text-stone-600 disabled:opacity-50"><EyeOff className="h-4 w-4" /> Ocultar</button></div></div>}{row.status === 'HIDDEN' && <div className="mt-3 flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-500"><EyeOff className="h-4 w-4" /> Esta pergunta não aparece publicamente.</div>}</article>)}</div> : <div className="rounded-[26px] border border-dashed border-stone-300 bg-white px-6 py-16 text-center"><MessageCircleQuestion className="mx-auto h-10 w-10 text-stone-300" /><h2 className="mt-4 font-serif text-2xl font-black">Nenhuma pergunta neste filtro</h2><p className="mt-2 text-sm text-stone-500">Quando alguém perguntar em um anúncio, ela aparece aqui primeiro de forma privada.</p></div>}
    </div>
  );
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) { return <div className={`rounded-[20px] p-4 ring-1 ${attention && value > 0 ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-stone-200'}`}><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><p className={`mt-1 text-2xl font-black ${attention && value > 0 ? 'text-amber-800' : 'text-stone-800'}`}>{value}</p></div>; }
function Status({ status }: { status: QuestionRow['status'] }) { const config = status === 'PENDING' ? ['Aguardando resposta','bg-amber-50 text-amber-700'] : status === 'ANSWERED' ? ['Respondida','bg-emerald-50 text-emerald-700'] : ['Oculta','bg-stone-100 text-stone-500']; return <span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] ${config[1]}`}>{config[0]}</span>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
