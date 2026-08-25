import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Loader2, MessageCircle, Pencil, Plus, Search, Send, ShoppingBag, Tag, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { API_URL, SOCKET_PATH, api } from '../lib/api';
import type { ClassifiedChatLabel, ClassifiedConversation, ClassifiedConversationMessage } from '../types/classifieds';

export default function ClassifiedsMessengerPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useClassifiedsWorkspace();
  const business = data?.activeIdentity === 'COMPANY';
  const [conversations, setConversations] = useState<ClassifiedConversation[]>([]);
  const [messages, setMessages] = useState<ClassifiedConversationMessage[]>([]);
  const [labels, setLabels] = useState<ClassifiedChatLabel[]>([]);
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => conversations.find((item) => item.id === conversationId) || null, [conversations, conversationId]);
  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return conversations;
    return conversations.filter((conversation) => {
      const counterpart = conversation.role === 'BUYER' ? conversation.seller : conversation.buyer;
      return normalize([
        conversation.customName,
        conversation.listing?.title,
        counterpart?.name,
        conversation.buyer?.name,
        conversation.seller?.name,
        conversation.lastMessage?.body,
        ...(conversation.labels || []).map((label) => label.name),
      ].filter(Boolean).join(' ')).includes(q);
    });
  }, [conversations, search]);

  const loadConversations = async () => {
    setLoading(true); setError('');
    try {
      const [conversationResponse, labelResponse] = await Promise.all([
        api.get('/classifieds/me/conversations'),
        business ? api.get('/classifieds/me/chat-labels').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      const rows = Array.isArray(conversationResponse.data) ? conversationResponse.data as ClassifiedConversation[] : [];
      setConversations(rows);
      setLabels(Array.isArray(labelResponse.data) ? labelResponse.data as ClassifiedChatLabel[] : []);
      if (!conversationId && rows[0]?.id && window.innerWidth >= 900) navigate(`/classificados/conversas/${rows[0].id}`, { replace: true });
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar suas conversas.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadConversations(); }, [data?.activeIdentity, data?.company?.id]);

  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    let alive = true;
    setMessagesLoading(true);
    api.get(`/classifieds/me/conversations/${conversationId}/messages`)
      .then((response) => {
        if (!alive) return;
        setMessages(Array.isArray(response.data) ? response.data : []);
        setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation));
      })
      .catch((requestError: any) => alive && setError(requestError?.response?.data?.message || 'Não foi possível abrir a conversa.'))
      .finally(() => alive && setMessagesLoading(false));
    return () => { alive = false; };
  }, [conversationId]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    user.getIdToken().then((token) => {
      if (!alive) return;
      const socket = io(API_URL, { path: SOCKET_PATH, auth: { token }, transports: ['websocket', 'polling'] });
      socket.on('chat:message', (message: ClassifiedConversationMessage) => {
        if (!message?.conversationId || !message.senderRole) return;
        setConversations((current) => current.map((conversation) => {
          if (conversation.id !== message.conversationId) return conversation;
          const incoming = message.senderRole !== conversation.role;
          const isOpen = message.conversationId === conversationId;
          return {
            ...conversation,
            lastMessage: { id: message.id, senderId: message.senderId, senderRole: message.senderRole, body: message.body, createdAt: message.createdAt },
            lastMessageAt: message.createdAt,
            unreadCount: isOpen ? 0 : incoming ? (conversation.unreadCount || 0) + 1 : conversation.unreadCount,
          };
        }));
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
      setConversations((current) => current.map((conversation) => conversation.id === conversationId ? {
        ...conversation,
        lastMessage: { id: message.id, senderId: message.senderId, senderRole: message.senderRole, body: message.body, createdAt: message.createdAt },
        lastMessageAt: message.createdAt,
        unreadCount: 0,
      } : conversation));
      setBody('');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível enviar a mensagem.');
    } finally { setSending(false); }
  };

  const updateConversation = (patch: Partial<ClassifiedConversation>) => {
    if (!conversationId) return;
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, ...patch } : conversation));
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-[1380px]">
      <header className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Negociações em tempo real</p><h1 className="mt-1 font-serif text-3xl font-black">Conversas</h1><p className="mt-2 text-sm text-stone-500">O anúncio é o assunto da conversa. Você também pode encontrar um chat pelo nome de qualquer participante.</p></header>
      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {!!conversations.length && <InterestBubbles conversations={conversations.slice(0, 12)} activeId={conversationId} navigate={navigate} />}

      <div className="mt-4 grid min-h-[650px] overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-black/[.07] md:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`${conversationId ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-stone-100`}>
          <div className="p-4"><label className="relative block"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Anúncio, pessoa ou empresa" className="h-11 w-full rounded-2xl bg-stone-100 pl-10 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#c96847]/20" /></label></div>
          <div className="min-h-0 flex-1 overflow-y-auto">{filtered.length ? filtered.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === conversationId} onClick={() => navigate(`/classificados/conversas/${conversation.id}`)} />) : <div className="px-6 py-16 text-center"><MessageCircle className="mx-auto h-8 w-8 text-stone-300" /><h2 className="mt-4 text-sm font-black">{conversations.length ? 'Nenhum chat encontrado' : 'Nenhuma conversa ainda'}</h2><p className="mt-2 text-xs leading-5 text-stone-500">{conversations.length ? 'Tente outro nome ou anúncio.' : 'Quando uma negociação começar, ela aparece aqui.'}</p>{!conversations.length && <Link to="/classificados/explorar" className="mt-5 inline-flex rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white">Explorar</Link>}</div>}</div>
        </aside>

        <section className={`${!conversationId ? 'hidden md:flex' : 'flex'} min-w-0 flex-col`}>
          {!active ? <div className="flex flex-1 items-center justify-center p-8 text-center"><div><MessageCircle className="mx-auto h-10 w-10 text-stone-300" /><p className="mt-4 text-sm font-bold text-stone-500">Escolha uma negociação.</p></div></div> : <>
            <ConversationHeader conversation={active} business={business} onBack={() => navigate('/classificados/conversas')} onEdit={() => setEditOpen(true)} />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f7f7f8] p-4 sm:p-5">{messagesLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-stone-400" /></div> : messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} ownSide={message.senderRole === active.role} ownUser={message.senderId === user?.uid} />) : <div className="py-16 text-center"><MessageCircle className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-bold text-stone-500">A negociação está pronta.</p><p className="mt-1 text-xs text-stone-400">Fale sobre preço, retirada, entrega ou os detalhes do item.</p></div>}<div ref={bottomRef} /></div>
            <div className="border-t border-stone-100 bg-white p-3 sm:p-4"><div className="flex items-end gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} maxLength={4000} placeholder="Mensagem..." className="min-h-[48px] flex-1 resize-none rounded-[22px] border-0 bg-stone-100 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#c96847]/20" /><button disabled={sending || !body.trim()} onClick={() => void send()} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c96847] text-white disabled:opacity-40" aria-label="Enviar">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div></div>
          </>}
        </section>
      </div>

      {editOpen && active && <ConversationSettings conversation={active} business={business} availableLabels={labels} close={() => setEditOpen(false)} update={updateConversation} refreshLabels={(next) => setLabels(next)} />}
    </div>
  );
}

function InterestBubbles({ conversations, activeId, navigate }: { conversations: ClassifiedConversation[]; activeId?: string; navigate: ReturnType<typeof useNavigate> }) {
  return <div className="flex gap-3 overflow-x-auto pb-2">{conversations.map((conversation) => <button key={conversation.id} onClick={() => navigate(`/classificados/conversas/${conversation.id}`)} className="group w-[72px] shrink-0 text-center"><div className={`relative mx-auto h-14 w-14 rounded-full p-[3px] ${conversation.id === activeId ? 'bg-[#c96847]' : conversation.unreadCount ? 'bg-gradient-to-br from-[#c96847] to-[#613249]' : 'bg-stone-200'}`}><div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-stone-100">{conversation.listing?.image ? <img src={conversation.listing.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ShoppingBag className="h-5 w-5 text-stone-400" /></div>}</div>{conversation.unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-white">{Math.min(99, conversation.unreadCount)}</span>}</div><p className="mt-1 truncate text-[9px] font-bold text-stone-500">{chatTitle(conversation)}</p></button>)}</div>;
}

function ConversationRow({ conversation, active, onClick }: { conversation: ClassifiedConversation; active: boolean; onClick: () => void }) {
  const counterpart = conversation.role === 'BUYER' ? conversation.seller : conversation.buyer;
  return <button onClick={onClick} className={`flex w-full gap-3 border-t border-stone-100 p-4 text-left transition ${active ? 'bg-[#fff3ed]' : 'hover:bg-stone-50'}`}><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-stone-100">{conversation.listing?.image ? <img src={conversation.listing.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ShoppingBag className="h-5 w-5 text-stone-300" /></div>}{conversation.unreadCount > 0 && <span className="absolute bottom-0 right-0 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-white">{Math.min(99, conversation.unreadCount)}</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-stone-900">{chatTitle(conversation)}</p><div className="mt-0.5 flex items-center gap-1"><p className="truncate text-[11px] font-semibold text-stone-500">{counterpart?.name || 'Negociação'}</p>{counterpart?.verified && <BadgeCheck className="h-3 w-3 shrink-0 text-emerald-600" />}</div><p className={`mt-1 truncate text-[11px] ${conversation.unreadCount ? 'font-bold text-stone-800' : 'text-stone-400'}`}>{conversation.lastMessage?.body || 'Conversa iniciada'}</p><div className="mt-1 flex gap-1 overflow-hidden">{(conversation.labels || []).slice(0, 2).map((label) => <LabelPill key={label.id} label={label} />)}</div></div></button>;
}

function ConversationHeader({ conversation, business, onBack, onEdit }: { conversation: ClassifiedConversation; business: boolean; onBack: () => void; onEdit: () => void }) {
  const counterpart = conversation.role === 'BUYER' ? conversation.seller : conversation.buyer;
  return <header className="flex items-center gap-3 border-b border-stone-100 bg-white p-3 sm:p-4"><button onClick={onBack} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black md:hidden">Voltar</button><Link to={conversation.listing ? `/classificados/explorar/${conversation.listing.slug}` : '/classificados/explorar'} className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-stone-100">{conversation.listing?.image ? <img src={conversation.listing.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ShoppingBag className="h-4 w-4 text-stone-400" /></div>}</Link><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{chatTitle(conversation)}</p><div className="flex items-center gap-1"><p className="truncate text-[10px] text-stone-400">com {counterpart?.name}</p>{counterpart?.verified && <BadgeCheck className="h-3 w-3 text-emerald-600" />}</div></div><div className="hidden gap-1 sm:flex">{(conversation.labels || []).slice(0, 3).map((label) => <LabelPill key={label.id} label={label} />)}</div><button onClick={onEdit} title={business ? 'Nome e etiquetas' : 'Renomear conversa'} className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500"><Pencil className="h-4 w-4" /></button></header>;
}

function ConversationSettings({ conversation, business, availableLabels, close, update, refreshLabels }: { conversation: ClassifiedConversation; business: boolean; availableLabels: ClassifiedChatLabel[]; close: () => void; update: (patch: Partial<ClassifiedConversation>) => void; refreshLabels: (labels: ClassifiedChatLabel[]) => void }) {
  const [name, setName] = useState(conversation.customName || '');
  const [selected, setSelected] = useState<string[]>((conversation.labels || []).map((label) => label.id));
  const [newLabel, setNewLabel] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setWorking(true); setError('');
    try {
      await api.patch(`/classifieds/me/conversations/${conversation.id}/name`, { name });
      if (business) await api.patch(`/classifieds/me/conversations/${conversation.id}/labels`, { labelIds: selected });
      update({ customName: name.trim() || null, labels: business ? availableLabels.filter((label) => selected.includes(label.id)) : conversation.labels });
      close();
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar.'); }
    finally { setWorking(false); }
  };

  const createLabel = async () => {
    const clean = newLabel.trim();
    if (!clean || working) return;
    setWorking(true); setError('');
    try {
      const response = await api.post('/classifieds/me/chat-labels', { name: clean, colorKey: 'TEAL' });
      const created = response.data as ClassifiedChatLabel;
      refreshLabels([...availableLabels, created]);
      setSelected((current) => [...current, created.id]);
      setNewLabel('');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível criar a etiqueta.'); }
    finally { setWorking(false); }
  };

  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"><button className="absolute inset-0" onClick={close} aria-label="Fechar" /><div className="relative w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl"><button onClick={close} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"><X className="h-4 w-4" /></button><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">Organizar negociação</p><h2 className="mt-1 font-serif text-2xl font-black">Nome da conversa</h2><p className="mt-2 text-xs leading-5 text-stone-500">O nome padrão é o produto ou serviço. Você pode renomear só para o seu workspace.</p><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} placeholder={conversation.listing?.title || 'Nome da conversa'} className="mt-4 h-12 w-full rounded-2xl bg-stone-100 px-4 text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#c96847]/20" />{business && <section className="mt-5"><p className="text-xs font-black text-stone-600">Etiquetas</p><div className="mt-3 flex flex-wrap gap-2">{availableLabels.map((label) => <button key={label.id} onClick={() => setSelected((current) => current.includes(label.id) ? current.filter((id) => id !== label.id) : [...current, label.id])} className={`rounded-full px-3 py-2 text-[10px] font-black ring-1 ${selected.includes(label.id) ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-600 ring-stone-200'}`}><Tag className="mr-1 inline h-3 w-3" />{label.name}</button>)}</div><div className="mt-3 flex gap-2"><input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createLabel(); } }} placeholder="Nova etiqueta personalizada" className="h-10 min-w-0 flex-1 rounded-xl bg-stone-100 px-3 text-xs outline-none" /><button disabled={working || !newLabel.trim()} onClick={() => void createLabel()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d4542] text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button></div></section>}{error && <p className="mt-4 text-xs font-bold text-red-600">{error}</p>}<button disabled={working} onClick={() => void save()} className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-stone-900 text-sm font-black text-white disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar organização'}</button></div></div>;
}

function MessageBubble({ message, ownSide, ownUser }: { message: ClassifiedConversationMessage; ownSide: boolean; ownUser: boolean }) { return <div className={`max-w-[82%] ${ownSide ? 'ml-auto' : ''}`}><div className={`rounded-[22px] px-4 py-2.5 text-sm leading-6 ${ownSide ? 'rounded-br-md bg-[#c96847] text-white' : 'rounded-bl-md bg-white text-stone-800 shadow-sm ring-1 ring-stone-100'}`}><p className={`mb-0.5 text-[9px] font-black ${ownSide ? 'text-white/65' : 'text-stone-400'}`}>{message.senderName}{ownSide && !ownUser ? ' · equipe' : ''}</p><p className="whitespace-pre-wrap break-words">{message.body}</p></div><p className={`mt-1 px-1 text-[8px] text-stone-400 ${ownSide ? 'text-right' : ''}`}>{new Date(message.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p></div>; }
function LabelPill({ label }: { label: ClassifiedChatLabel }) { const styles: Record<string,string> = { BLUE:'bg-blue-50 text-blue-700', AMBER:'bg-amber-50 text-amber-700', VIOLET:'bg-violet-50 text-violet-700', GREEN:'bg-emerald-50 text-emerald-700', ROSE:'bg-rose-50 text-rose-700', TEAL:'bg-teal-50 text-teal-700', STONE:'bg-stone-100 text-stone-600' }; return <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black uppercase ${styles[label.colorKey] || styles.STONE}`}>{label.name}</span>; }
function chatTitle(conversation: ClassifiedConversation) { return conversation.customName?.trim() || conversation.listing?.title || 'Negociação'; }
function normalize(value: unknown) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
