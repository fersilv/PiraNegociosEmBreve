import React, { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { API_URL, SOCKET_PATH, api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type ChatAttachment = { name: string; data: string; mimeType: string; size: number };
type ChatMessage = {
  id: string;
  applicationId: string;
  senderId: string;
  senderName: string;
  body?: string | null;
  type: 'TEXT' | 'DOCUMENT' | 'DOCUMENT_REQUEST';
  attachment?: ChatAttachment | null;
  documentId?: string | null;
  documentRequest?: { name: string; instructions?: string } | null;
  createdAt: string;
};

export function ApplicationChat({
  applicationId,
  canRequestDocuments = false,
  documentOptions = [],
  onApplicationUpdated,
}: {
  applicationId: string;
  canRequestDocuments?: boolean;
  documentOptions?: Array<{ id: string; name: string }>;
  onApplicationUpdated?: () => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [documentId, setDocumentId] = useState('');
  const [requestName, setRequestName] = useState('');
  const [requestInstructions, setRequestInstructions] = useState('');
  const [requestMode, setRequestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  const appendMessage = (message: ChatMessage) => {
    setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous, message]);
  };

  useEffect(() => {
    if (!user || !applicationId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await api.get(`/applications/${applicationId}/messages`);
        if (active) setMessages(response.data || []);
      } catch {
        if (active) setError('Não foi possível carregar a conversa.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    user.getIdToken().then(token => {
      if (!active) return;
      const socket = io(API_URL, { path: SOCKET_PATH, auth: { token }, transports: ['websocket', 'polling'] });
      socket.on('chat:message', (message: ChatMessage) => {
        if (message.applicationId === applicationId) appendMessage(message);
      });
      socketRef.current = socket;
    });
    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [applicationId, user]);

  useEffect(() => lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const selectFile = async (file?: File) => {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Envie PDF, PNG ou JPEG de até 10 MB.');
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(file);
    });
    setAttachment({ name: file.name, data, mimeType: file.type, size: file.size });
    setError('');
  };

  const send = async () => {
    if (!body.trim() && !attachment) return;
    setSending(true);
    setError('');
    try {
      const response = await api.post(`/applications/${applicationId}/messages`, {
        body,
        attachment,
        documentId: documentId || undefined,
      });
      appendMessage(response.data);
      setBody('');
      setAttachment(null);
      setDocumentId('');
      onApplicationUpdated?.();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  const requestDocument = async () => {
    if (!requestName.trim()) return;
    setSending(true);
    setError('');
    try {
      const response = await api.post(`/applications/${applicationId}/messages/document-request`, {
        name: requestName,
        instructions: requestInstructions,
        body,
      });
      appendMessage(response.data);
      setBody('');
      setRequestName('');
      setRequestInstructions('');
      setRequestMode(false);
      onApplicationUpdated?.();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Não foi possível solicitar o documento.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
      <header className="p-4 border-b border-stone-100 flex items-center justify-between gap-3 bg-stone-50/60">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-terracotta-600" />
          <div>
            <h2 className="font-bold text-sm text-stone-900">Conversa da candidatura</h2>
            <p className="text-[11px] text-stone-500">Mensagens e documentos ficam registrados neste processo.</p>
          </div>
        </div>
        {canRequestDocuments && <button type="button" onClick={() => setRequestMode(value => !value)} className="text-xs font-bold text-terracotta-700 bg-terracotta-50 px-3 py-2 rounded-xl">Solicitar documento</button>}
      </header>

      <div className="h-72 overflow-y-auto p-4 space-y-3 bg-stone-50/30" aria-live="polite">
        {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-terracotta-500" /></div> : messages.length === 0 ? <p className="text-center text-xs text-stone-500 pt-20">Nenhuma mensagem ainda. Use este espaço para alinhar os próximos passos.</p> : messages.map(message => {
          const own = message.senderId === user?.uid;
          return <div key={message.id} className={`max-w-[85%] ${own ? 'ml-auto' : ''}`}>
            <div className={`rounded-2xl px-3.5 py-2.5 text-xs ${own ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-800'}`}>
              <p className={`font-bold mb-1 ${own ? 'text-amber-200' : 'text-terracotta-700'}`}>{message.senderName}</p>
              {message.type === 'DOCUMENT_REQUEST' && <p className="font-bold mb-1">Documento solicitado: {message.documentRequest?.name}</p>}
              {message.body && <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>}
              {message.documentRequest?.instructions && <p className="mt-1 opacity-80">{message.documentRequest.instructions}</p>}
              {message.attachment && <a href={message.attachment.data} target="_blank" rel="noreferrer" className={`mt-2 flex items-center gap-1.5 font-bold underline ${own ? 'text-amber-200' : 'text-terracotta-700'}`}><FileText className="w-3.5 h-3.5" />{message.attachment.name}</a>}
            </div>
            <p className={`text-[10px] text-stone-400 mt-1 ${own ? 'text-right' : ''}`}>{new Date(message.createdAt).toLocaleString('pt-BR')}</p>
          </div>;
        })}
        <div ref={lastMessageRef} />
      </div>

      <div className="p-4 border-t border-stone-100 space-y-2">
        {requestMode ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input value={requestName} onChange={event => setRequestName(event.target.value)} placeholder="Nome do documento *" className="px-3 py-2.5 rounded-xl border border-stone-200 text-xs" /><input value={requestInstructions} onChange={event => setRequestInstructions(event.target.value)} placeholder="Instruções (opcional)" className="px-3 py-2.5 rounded-xl border border-stone-200 text-xs" /></div> : <>{documentOptions.length > 0 && attachment && <select value={documentId} onChange={event => setDocumentId(event.target.value)} className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"><option value="">Anexo geral — não vincular à lista</option>{documentOptions.map(document => <option key={document.id} value={document.id}>Vincular: {document.name}</option>)}</select>}</>}
        {attachment && <div className="flex items-center justify-between bg-stone-100 rounded-xl px-3 py-2 text-xs"><span className="truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remover anexo"><X className="w-4 h-4" /></button></div>}
        <div className="flex gap-2"><input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={event => selectFile(event.target.files?.[0])} /><button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl bg-stone-100 text-stone-600" aria-label="Anexar arquivo"><Paperclip className="w-4 h-4" /></button><textarea value={body} onChange={event => setBody(event.target.value)} placeholder={requestMode ? 'Mensagem para acompanhar a solicitação (opcional)' : 'Escreva uma mensagem...'} rows={2} className="flex-1 resize-none px-3 py-2.5 rounded-xl border border-stone-200 text-xs" /><button type="button" disabled={sending || (requestMode ? !requestName.trim() : (!body.trim() && !attachment))} onClick={requestMode ? requestDocument : send} className="px-3 rounded-xl bg-terracotta-600 text-white disabled:opacity-50" aria-label="Enviar">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button></div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </section>
  );
}
