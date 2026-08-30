import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, HelpCircle, Loader2, MessageCircleQuestion, Send, ShieldCheck, ThumbsUp } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

type Question = {
  id: string;
  question: string;
  answer?: string | null;
  status?: 'PENDING' | 'ANSWERED' | 'HIDDEN';
  helpfulCount?: number;
  own?: boolean;
  createdAt?: string;
  answeredAt?: string | null;
};

type Match = Question & { similarity?: number };

export function ClassifiedListingQuestions({ listingId, companyListing = true }: { listingId: string; companyListing?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [publicQuestions, setPublicQuestions] = useState<Question[]>([]);
  const [mine, setMine] = useState<Question[]>([]);
  const [question, setQuestion] = useState('');
  const [match, setMatch] = useState<Match | null>(null);
  const [matching, setMatching] = useState(false);
  const [sending, setSending] = useState(false);
  const [helping, setHelping] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const load = async () => {
    if (!companyListing) return;
    const [publicResult, mineResult] = await Promise.allSettled([
      api.get(`/classifieds/listings/${listingId}/questions`),
      user ? api.get(`/classifieds/listings/${listingId}/questions/mine`) : Promise.resolve({ data: [] }),
    ]);
    if (publicResult.status === 'fulfilled') setPublicQuestions(Array.isArray(publicResult.value.data) ? publicResult.value.data : []);
    if (mineResult.status === 'fulfilled') setMine(Array.isArray((mineResult.value as any).data) ? (mineResult.value as any).data : []);
  };

  useEffect(() => { void load(); }, [listingId, user?.uid, companyListing]);

  useEffect(() => {
    const text = question.trim();
    setMatch(null);
    if (!companyListing || text.length < 12) {
      setMatching(false);
      return;
    }
    const requestId = ++requestRef.current;
    setMatching(true);
    const timer = window.setTimeout(() => {
      api.post(`/classifieds/listings/${listingId}/questions/suggest`, { question: text })
        .then((response) => {
          if (requestRef.current !== requestId) return;
          setMatch(response.data?.match || null);
        })
        .catch(() => { if (requestRef.current === requestId) setMatch(null); })
        .finally(() => { if (requestRef.current === requestId) setMatching(false); });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [question, listingId, companyListing]);

  if (!companyListing) return null;

  const ensureLogin = () => {
    if (user) return true;
    navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  };

  const send = async () => {
    if (!ensureLogin() || sending) return;
    const text = question.trim();
    if (text.length < 5) {
      setError('Escreva uma pergunta com um pouco mais de contexto.');
      return;
    }
    setSending(true); setError(''); setMessage('');
    try {
      const response = await api.post(`/classifieds/listings/${listingId}/questions`, {
        question: text,
        acceptedTerms: true,
      });
      setQuestion('');
      setMatch(null);
      setMessage(response.data?.message || 'Pergunta enviada. Ela fica privada até a empresa responder.');
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível enviar sua pergunta.');
    } finally { setSending(false); }
  };

  const helpful = async () => {
    if (!match || helping) return;
    if (!ensureLogin()) return;
    setHelping(true); setError('');
    try {
      await api.post(`/classifieds/questions/${match.id}/helpful`);
      setMessage('Que bom! Marcamos essa resposta como útil.');
      setQuestion('');
      setMatch(null);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível registrar agora.');
    } finally { setHelping(false); }
  };

  const pendingMine = mine.filter((item) => item.status === 'PENDING');
  const answeredMine = mine.filter((item) => item.status === 'ANSWERED');

  return (
    <section className="mt-5 rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-black/[.06] sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#edf7f5] text-[#155a55]"><MessageCircleQuestion className="h-5 w-5" /></span>
        <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#397c75]">Perguntas sobre este anúncio</p><h2 className="mt-1 font-serif text-2xl font-black text-stone-900">Ficou com alguma dúvida?</h2><p className="mt-1 text-xs leading-5 text-stone-500">Perguntas novas são privadas entre você e a empresa. Elas só aparecem publicamente depois que a empresa responder.</p></div>
      </div>

      <div className="mt-5 rounded-[22px] bg-stone-50 p-4 ring-1 ring-stone-200">
        <textarea value={question} onChange={(event) => { setQuestion(event.target.value.slice(0, 600)); setMessage(''); setError(''); }} rows={3} placeholder="Ex.: Esse produto acompanha carregador original?" className="w-full resize-y rounded-2xl border-0 bg-white px-4 py-3 text-sm font-semibold text-stone-800 outline-none ring-1 ring-stone-200 placeholder:text-stone-300 focus:ring-2 focus:ring-[#4b8f87]/30" />
        <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[9px] font-bold text-stone-400">{question.length}/600</p>{matching && <span className="inline-flex items-center gap-1 text-[9px] font-black text-[#397c75]"><Loader2 className="h-3 w-3 animate-spin" /> procurando resposta parecida</span>}</div>

        {match?.answer && <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-emerald-800"><HelpCircle className="h-4 w-4" /><p className="text-xs font-black">Acho que essa resposta pode te ajudar:</p></div><p className="mt-3 text-xs font-black text-stone-700">{match.question}</p><p className="mt-2 text-sm leading-6 text-stone-700">{match.answer}</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" disabled={helping} onClick={() => void helpful()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-50"><ThumbsUp className="h-4 w-4" /> {helping ? 'Marcando...' : 'Me ajudou'}</button><button type="button" disabled={sending} onClick={() => void send()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-stone-700 ring-1 ring-stone-200"><Send className="h-4 w-4" /> Enviar pergunta mesmo assim</button></div></div>}

        {!match && <button type="button" disabled={sending || question.trim().length < 5} onClick={() => void send()} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 text-xs font-black text-white disabled:opacity-40"><Send className="h-4 w-4" /> {sending ? 'Enviando...' : 'Enviar pergunta'}</button>}

        <div className="mt-3 flex items-start gap-2 text-[9px] leading-4 text-stone-400"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p>Ao realizar uma interação com a página do produto, você concorda com os <Link to="/classificados/termos" className="font-black text-stone-600 underline">Termos de Uso</Link> e a Política de Privacidade do PiraNegócios. Não compartilhe telefone, e-mail, redes sociais, links ou outros dados de contato.</p></div>
      </div>

      {message && <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> {message}</div>}
      {error && <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div>}

      {pendingMine.length > 0 && <div className="mt-6"><p className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">Suas perguntas aguardando resposta</p><div className="mt-2 space-y-2">{pendingMine.map((item) => <div key={item.id} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100"><p className="text-sm font-bold text-stone-700">{item.question}</p><p className="mt-2 text-[9px] font-black uppercase tracking-[.1em] text-amber-700">Privada · aguardando a empresa</p></div>)}</div></div>}

      {answeredMine.length > 0 && <div className="mt-6"><p className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">Perguntas que você fez</p><div className="mt-2 space-y-2">{answeredMine.slice(0, 5).map((item) => <QuestionAnswer key={item.id} item={item} />)}</div></div>}

      {publicQuestions.length > 0 && <div className="mt-7 border-t border-stone-100 pt-6"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">Já respondidas pela empresa</p><h3 className="mt-1 text-lg font-black text-stone-900">Talvez sua dúvida já esteja aqui</h3></div><span className="text-[10px] font-black text-stone-400">{publicQuestions.length}</span></div><div className="mt-4 space-y-3">{publicQuestions.slice(0, 12).map((item) => <QuestionAnswer key={item.id} item={item} />)}</div></div>}
    </section>
  );
}

function QuestionAnswer({ item }: { item: Question }) {
  return <article className="rounded-[18px] bg-stone-50 p-4 ring-1 ring-stone-200"><p className="text-sm font-black text-stone-800">{item.question}</p>{item.answer && <div className="mt-3 border-l-2 border-[#4b8f87] pl-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#397c75]">Resposta da empresa</p><p className="mt-1 text-sm leading-6 text-stone-600">{item.answer}</p></div>}{Number(item.helpfulCount || 0) > 0 && <p className="mt-3 text-[9px] font-bold text-stone-400">{item.helpfulCount} pessoa{Number(item.helpfulCount) === 1 ? '' : 's'} achou{Number(item.helpfulCount) === 1 ? '' : 'aram'} útil</p>}</article>;
}
