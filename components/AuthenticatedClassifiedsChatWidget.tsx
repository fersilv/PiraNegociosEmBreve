import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MessageCircle, X, Send, Loader2, Archive, ArrowLeft, BadgeCheck, Paperclip } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, SOCKET_PATH, api } from '../lib/api';
import type { ClassifiedConversation, ClassifiedConversationMessage } from '../types/classifieds';

type ChatAttachment = { url: string; name?: string; type: 'image' | 'document' };

function getChatAttachment(metadata: ClassifiedConversationMessage['metadata']): ChatAttachment | null {
  const attachment = metadata?.attachment;
  if (!attachment || typeof attachment !== 'object') return null;
  const { url, name, type } = attachment as Record<string, unknown>;
  if (typeof url !== 'string' || (type !== 'image' && type !== 'document')) return null;
  return { url, type, ...(typeof name === 'string' ? { name } : {}) };
}

export function AuthenticatedClassifiedsChatWidget() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ClassifiedConversation[]>([]);
  const [activeChat, setActiveChat] = useState<ClassifiedConversation | null>(null);
  const [messages, setMessages] = useState<ClassifiedConversationMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: 'image' | 'document' } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      loadConversations();
    } else {
      setActiveChat(null);
      setMessages([]);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id);
      setupSocket(activeChat.id);
    } else {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    setLoadingChats(true);
    try {
      const response = await api.get('/classifieds/me/conversations');
      setConversations(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadMessages = async (id: string) => {
    setLoadingMessages(true);
    try {
      const response = await api.get(`/classifieds/me/conversations/${id}/messages`);
      setMessages(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const setupSocket = (id: string) => {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = io(API_URL, {
      path: SOCKET_PATH,
      auth: { token: localStorage.getItem('token') },
    });
    socketRef.current.on('connect', () => {
      socketRef.current?.emit('classifieds:chat:subscribe', id);
    });
    socketRef.current.on('classifieds:chat:message', (message: ClassifiedConversationMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });
  };

  const sendMessage = async () => {
    const text = body.trim();
    if ((!text && !attachment) || !activeChat || sending) return;
    setSending(true);
    try {
      const payload: any = { body: text };
      if (attachment) payload.metadata = { attachment };
      const response = await api.post(`/classifieds/me/conversations/${activeChat.id}/messages`, payload);
      setBody('');
      setAttachment(null);
      setMessages((prev) => [...prev, response.data.message]);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('purpose', 'chat_attachment');
      const upload = await api.post('/uploads', form);
      setAttachment({
        url: upload.data.url,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document'
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const archiveConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/classifieds/me/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeChat?.id === id) setActiveChat(null);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !user) return null;
  if (location.pathname.startsWith('/classificados/conversas')) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end">
      {open && (
        <div className="mb-4 flex w-[360px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.12)] ring-1 ring-black/5" style={{ height: '500px', maxHeight: 'calc(100vh - 120px)' }}>
          {activeChat ? (
            <>
              <header className="flex items-center gap-3 border-b border-stone-100 bg-white p-3">
                <button onClick={() => setActiveChat(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{activeChat.customName || activeChat.listing?.title || 'Negociação'}</p>
                  <p className="truncate text-[10px] text-stone-500">com {activeChat.role === 'BUYER' ? activeChat.seller?.name : activeChat.buyer?.name}</p>
                </div>
                <button onClick={(e) => archiveConversation(activeChat.id, e)} title="Arquivar" className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100">
                  <Archive className="h-4 w-4" />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f8] p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-stone-400" /></div>
                ) : messages.length === 0 ? (
                  <div className="py-8 text-center"><p className="text-xs text-stone-500">Envie a primeira mensagem.</p></div>
                ) : (
                  messages.map((m) => {
                    const own = m.senderId === user.uid;
                    const messageAttachment = getChatAttachment(m.metadata);
                    return (
                      <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${own ? 'bg-stone-900 text-white rounded-br-none' : 'bg-white text-stone-800 shadow-sm rounded-bl-none'}`}>
                          {messageAttachment ? (
                            <div className="flex flex-col gap-1">
                              {messageAttachment.type === 'image' ? (
                                <img src={messageAttachment.url} alt="Anexo" className="max-h-40 rounded-xl object-cover" />
                              ) : (
                                <a href={messageAttachment.url} target="_blank" rel="noreferrer" className="underline">{messageAttachment.name || 'Baixar Arquivo'}</a>
                              )}
                              {m.body && <span>{m.body}</span>}
                            </div>
                          ) : m.body}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="border-t border-stone-100 bg-white p-3">
                {attachment && (
                  <div className="mb-2 flex items-center justify-between rounded-xl bg-stone-100 p-2 px-3 text-xs">
                    <span className="truncate font-bold text-stone-700">{attachment.name}</span>
                    <button onClick={() => setAttachment(null)} className="ml-2 text-stone-400 hover:text-stone-700"><X className="h-4 w-4" /></button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 disabled:opacity-40">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </button>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} rows={1} placeholder="Mensagem..." className="max-h-24 min-h-[40px] flex-1 resize-none rounded-[20px] border-0 bg-stone-100 px-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-stone-200" />
                  <button disabled={sending || (!body.trim() && !attachment)} onClick={sendMessage} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white disabled:opacity-40">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-stone-100 bg-white p-4">
                <div>
                  <h3 className="font-serif text-lg font-black text-stone-900">Conversas</h3>
                  <p className="text-xs text-stone-500">Classificados</p>
                </div>
                <button onClick={() => navigate('/classificados/conversas')} className="text-xs font-bold text-blue-600 hover:underline">Ver todas</button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {loadingChats ? (
                  <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-stone-400" /></div>
                ) : conversations.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <MessageCircle className="mx-auto h-8 w-8 text-stone-300" />
                    <p className="mt-3 text-sm font-bold text-stone-900">Nenhuma conversa</p>
                    <p className="mt-1 text-xs text-stone-500">Seus chats aparecerão aqui.</p>
                  </div>
                ) : (
                  conversations.map((c) => (
                    <div key={c.id} onClick={() => setActiveChat(c)} className="flex cursor-pointer gap-3 border-b border-stone-50 p-3 hover:bg-stone-50">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-stone-100">
                        {c.listing?.image && <img src={c.listing.image} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-black">{c.customName || c.listing?.title || 'Negociação'}</p>
                          <button onClick={(e) => archiveConversation(c.id, e)} className="ml-2 text-stone-300 hover:text-red-500" title="Arquivar">
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="truncate text-xs text-stone-500">{c.lastMessage?.body || 'Iniciada'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Fechar chat' : 'Abrir chat'}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d9c2b8] bg-[#fff8f2] text-[#9f4e3d] shadow-[0_16px_40px_rgba(90,45,34,.22)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#ead7cf]"
      >
        {open ? <X className="h-6 w-6" strokeWidth={2.2} /> : <MessageCircle className="h-6 w-6" strokeWidth={2.2} />}
      </button>
    </div>
  );
}
