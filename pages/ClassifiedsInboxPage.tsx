import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Loader2, MessageCircle, Send, ShoppingBag } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, SOCKET_PATH, api } from '../lib/api';
import type { ClassifiedConversation, ClassifiedConversationMessage } from '../types/classifieds';

export default function ClassifiedsInboxPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ClassifiedConversation[]>([]);
  const [messages, setMessages] = useState<ClassifiedConversationMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => conversations.find((item) => item.id === conversationId) || null, [conversations, conversationId]);

  const loadConversations = async () => {
    try {
      const response = await api.get('/classifieds/me/conversations');
      const rows = Array.isArray(response.data) ? response.data as ClassifiedConversation[] : [];
      setConversations(rows);
      if (!conversationId && rows[0]?.id && window.innerWidth >= 768) navigate(`/classificados/conversas/${rows[0].id}`, { replace: true });
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar suas conversas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadConversations(); }, []);

  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    let alive = true;
    setMessagesLoading(true);
    api.get(`/classifieds/me/conversations/${conversationId}/messages`)
      .then((response) => { if (alive) setMessages(Array.isArray(response.data) ? response.data : []); })
      .catch((requestError: any) => { if (alive) setError(requestError?.response?.data?.message || 'Não foi possível abrir a conversa.'); })
      .finally(() => { if (alive) setMessagesLoading(false); });
    return () => { alive = false; };
  }, [conversationId]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    user.getIdToken().then((token) => {
      if (!alive) return;
      const socket = io(API_URL, { path: SOCKET_PATH, auth: { token }, transports: ['websocket', 'polling'] });
      socket.on('chat:message', (message: ClassifiedConversationMessage) => {
        if (!message?.conversationId) return;
        setConversations((current) => current.map((conversation) => conversation.id === message.conversationId ? { ...conversation, lastMessage: { id: message.id, senderId: message.senderId, body: message.body, createdAt: message.createdAt }, lastMessageAt: message.createdAt, unreadCount: message.conversationId === conversationId ? 0 : (conversation.unreadCount || 0) + 1 } : conversation));
        if (message.conversationId === conversationId) {
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
          void api.post(`/classifieds/me/conversations/${message.conversationId}/read`).catch(() => undefined);
        }
      });
      socketRef.current = socket;
    });
    return () => { alive = false; socketRef.current?.disconnect(); socketRef.current = null; };
  }, [user, conversationId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = body.trim();
    if (!text || !conversationId || sending) return;
    setSending(true); setError('');
    try {
      const response = await api.post(`/classifieds/me/conversations/${conversationId}/messages`, { body: text });
      const message = response.data as ClassifiedConversationMessage;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, lastMessage: { id: message.id, senderId: message.senderId, body: message.body, createdAt: message.createdAt }, lastMessageAt: message.createdAt } : conversation));
      setBody('');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível enviar a mensagem.');
    } finally { setSending(false); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-stone-400">Negociação em tempo real</p><h1 className="mt-1 font-serif text-3xl font-black">Conversas</h1><p className="mt-2 text-sm text-stone-500">Cada conversa fica vinculada ao anúncio. Negocie sem perder o contexto do que está sendo comprado ou vendido.</p></div>
      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      <div className="grid min-h-[620px] overflow-hidden rounded-[28px] border border-black/[.07] bg-white shadow-sm md:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`${conversationId ? 'hidden md:block' : 'block'} border-r border-stone-100`}>
          <div className="border-b border-stone-100 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">Caixa de entrada</p></div>
          <div className="max-h-[680px] overflow-y-auto">{conversations.length ? conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === conversationId} onClick={() => navigate(`/classificados/conversas/${conversation.id}`)} />) : <div className="px-6 py-16 text-center"><MessageCircle className="mx-auto h-8 w-8 text-stone-300" /><h2 className="mt-4 text-sm font-black">Nenhuma conversa ainda</h2><p className="mt-2 text-xs leading-5 text-stone-500">Quando alguém tocar em Conversar em um anúncio, a negociação aparece aqui.</p><Link to="/classificados" className="mt-5 inline-flex rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white">Explorar anúncios</Link></div>}</div>
        </aside>

        <section className={`${!conversationId ? 'hidden md:flex' : 'flex'} min-w-0 flex-col`}>
          {!active ? <div className="flex flex-1 items-center justify-center p-8 text-center"><div><MessageCircle className="mx-auto h-10 w-10 text-stone-300" /><p className="mt-4 text-sm font-bold text-stone-500">Selecione uma conversa para começar.</p></div></div> : <>
            <ConversationHeader conversation={active} onBack={() => navigate('/classificados/conversas')} />
            <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 p-4 sm:p-5">{messagesLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-stone-400" /></div> : messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} own={message.senderId === user?.uid} />) : <div className="py-16 text-center"><MessageCircle className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-bold text-stone-500">A conversa está pronta.</p><p className="mt-1 text-xs text-stone-400">Comece falando sobre o anúncio, preço, retirada, entrega ou detalhes do serviço.</p></div>}<div ref={bottomRef} /></div>
            <div className="border-t border-stone-100 bg-white p-3 sm:p-4"><div className="flex items-end gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} maxLength={4000} placeholder="Escreva uma mensagem..." className="min-h-[48px] flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-stone-400 focus:bg-white" /><button disabled={sending || !body.trim()} onClick={() => void send()} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-white disabled:opacity-40" aria-label="Enviar mensagem">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div><p className="mt-2 px-1 text-[10px] text-stone-400">Negocie dentro do PiraNegócios. Não compartilhe senhas, códigos ou dados sensíveis.</p></div>
          </>}
        </section>
      </div>
    </div>
  );
}

function ConversationRow({ conversation, active, onClick }: { conversation: ClassifiedConversation; active: boolean; onClick: () => void }) {
  const counterpart = conversation.role === 'BUYER' ? conversation.seller : conversation.buyer;
  return <button onClick={onClick} className={`flex w-full gap-3 border-b border-stone-100 p-4 text-left transition ${active ? 'bg-stone-100' : 'hover:bg-stone-50'}`}><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-stone-100">{conversation.listing?.image ? <img src={conversation.listing.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ShoppingBag className="h-5 w-5 text-stone-300" /></div>}{conversation.unreadCount > 0 && <span className="absolute right-1 top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">{Math.min(99, conversation.unreadCount)}</span>}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-1"><p className="truncate text-xs font-black text-stone-900">{counterpart?.name || 'Negociação'}</p>{'verified' in counterpart && counterpart.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}</div><p className="mt-1 truncate text-xs font-bold text-stone-600">{conversation.listing?.title || 'Anúncio'}</p><p className={`mt-1 truncate text-[11px] ${conversation.unreadCount ? 'font-bold text-stone-800' : 'text-stone-400'}`}>{conversation.lastMessage?.body || 'Conversa iniciada'}</p></div></button>;
}

function ConversationHeader({ conversation, onBack }: { conversation: ClassifiedConversation; onBack: () => void }) {
  const counterpart = conversation.role === 'BUYER' ? conversation.seller : conversation.buyer;
  return <header className="flex items-center gap-3 border-b border-stone-100 bg-white p-4"><button onClick={onBack} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black md:hidden">Voltar</button><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-black">{counterpart?.name}</p>{'verified' in counterpart && counterpart.verified && <BadgeCheck className="h-4 w-4 text-emerald-600" />}</div><Link to={conversation.listing ? `/classificados/anuncio/${conversation.listing.slug}` : '/classificados'} className="mt-0.5 block truncate text-xs text-stone-500 hover:underline">{conversation.listing?.title}</Link></div>{conversation.listing?.status === 'SOLD' && <span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-black uppercase text-blue-700">Vendido</span>}</header>;
}

function MessageBubble({ message, own }: { message: ClassifiedConversationMessage; own: boolean }) { return <div className={`max-w-[86%] ${own ? 'ml-auto' : ''}`}><div className={`rounded-[20px] px-4 py-3 text-sm leading-6 shadow-sm ${own ? 'rounded-br-md bg-stone-900 text-white' : 'rounded-bl-md border border-stone-200 bg-white text-stone-800'}`}><p className={`mb-1 text-[10px] font-black ${own ? 'text-white/60' : 'text-stone-400'}`}>{message.senderName}</p><p className="whitespace-pre-wrap break-words">{message.body}</p></div><p className={`mt-1 px-1 text-[9px] text-stone-400 ${own ? 'text-right' : ''}`}>{new Date(message.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p></div>; }
