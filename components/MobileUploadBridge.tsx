import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, QrCode, ShieldCheck, Smartphone, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, SOCKET_PATH, api } from '../lib/api';

type MobileUploadPurpose = 'avatar' | 'resume' | 'document';

type SessionInfo = {
  id: string;
  pairingCode: string;
  purpose: MobileUploadPurpose;
  accept: string;
  maxSizeBytes: number;
  expiresAt: string;
};

export type MobileReceivedFile = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
};

function apiMessage(error: any, fallback: string) {
  const raw = error?.response?.data?.message;
  return Array.isArray(raw) ? raw.join(' · ') : raw || error?.message || fallback;
}

export function MobileUploadBridge({
  purpose,
  maxSizeKB,
  buttonLabel = 'Usar celular',
  className = '',
  onReceived,
}: {
  purpose: MobileUploadPurpose;
  maxSizeKB: number;
  buttonLabel?: string;
  className?: string;
  onReceived: (file: MobileReceivedFile) => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [opening, setOpening] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState('');
  const consumingRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  const publicTransferUrl = useMemo(
    () => session ? `${window.location.origin}/transferir/${session.id}` : '',
    [session],
  );

  // O serviço externo recebe apenas a URL pública com o UUID da sessão. O código
  // de pareamento e o token de upload nunca entram no QR Code.
  const qrImageUrl = useMemo(
    () => publicTransferUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(publicTransferUrl)}`
      : '',
    [publicTransferUrl],
  );

  const consume = useCallback(async (sessionId: string) => {
    if (consumingRef.current) return;
    consumingRef.current = true;
    setReceiving(true);
    setError('');
    try {
      const response = await api.post(`/uploads/mobile-sessions/${sessionId}/consume`);
      await onReceived(response.data as MobileReceivedFile);
      setReceived(true);
      window.setTimeout(() => {
        setSession(null);
        setReceived(false);
      }, 1200);
    } catch (requestError: any) {
      const status = requestError?.response?.data?.statusCode;
      if (status !== 400) setError(apiMessage(requestError, 'Não foi possível receber o arquivo no computador.'));
    } finally {
      consumingRef.current = false;
      setReceiving(false);
    }
  }, [onReceived]);

  const open = async () => {
    if (opening) return;
    setOpening(true);
    setReceived(false);
    setError('');
    try {
      const response = await api.post('/uploads/mobile-sessions', { purpose, maxSizeKB });
      setSession(response.data as SessionInfo);
    } catch (requestError: any) {
      setError(apiMessage(requestError, 'Não foi possível criar uma sessão para o celular.'));
    } finally {
      setOpening(false);
    }
  };

  const close = useCallback(async () => {
    const id = session?.id;
    setSession(null);
    setReceived(false);
    setError('');
    if (id && !received) await api.delete(`/uploads/mobile-sessions/${id}`).catch(() => undefined);
  }, [received, session?.id]);

  useEffect(() => {
    if (!session?.id || !user) return;
    let active = true;
    let timer: number | null = null;

    user.getIdToken().then((token) => {
      if (!active) return;
      const socket = io(API_URL, {
        path: SOCKET_PATH,
        auth: { token },
        transports: ['websocket', 'polling'],
      });
      socket.on('mobile-upload:ready', (payload: any) => {
        if (payload?.sessionId === session.id) void consume(session.id);
      });
      socketRef.current = socket;
    }).catch(() => undefined);

    const poll = async () => {
      try {
        const response = await api.get(`/uploads/mobile-sessions/${session.id}`);
        const status = String(response.data?.status || '');
        if (!active) return;
        if (status === 'UPLOADED') void consume(session.id);
        if (status === 'EXPIRED' || status === 'CANCELED') {
          setError(status === 'EXPIRED' ? 'Esta sessão expirou. Feche e gere um novo QR Code.' : 'Esta sessão foi encerrada.');
        }
      } catch {
        // Socket.IO é o caminho principal; polling é somente fallback.
      }
    };
    timer = window.setInterval(() => void poll(), 3000);

    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [consume, session?.id, user]);

  useEffect(() => () => {
    socketRef.current?.disconnect();
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={opening}
        className={className}
      >
        {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
        {opening ? 'Criando sessão...' : buttonLabel}
      </button>

      {session && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => void close()}>
          <section className="w-full max-w-md overflow-hidden rounded-[28px] border border-stone-200 bg-[#fffdfa] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-gradient-to-br from-violet-50 to-white p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><QrCode className="h-5 w-5" /></span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.15em] text-violet-600">Transferência segura</p>
                  <h3 className="mt-1 font-serif text-xl font-bold text-stone-950">Enviar pelo celular</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-500">Escaneie o QR Code e confirme no telefone com o código de pareamento abaixo.</p>
                </div>
              </div>
              <button type="button" onClick={() => void close()} className="rounded-full bg-white p-2 text-stone-400 shadow-sm" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-5 text-center">
              {received ? (
                <div className="py-8">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-7 w-7" /></span>
                  <p className="mt-3 font-bold text-emerald-800">Arquivo recebido no computador.</p>
                </div>
              ) : (
                <>
                  <img src={qrImageUrl} alt="QR Code da sessão temporária" className="mx-auto h-[220px] w-[220px] rounded-2xl border border-stone-200 bg-white p-2" />
                  <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-500">Código de pareamento</p>
                    <p className="mt-1 font-mono text-3xl font-black tracking-[.24em] text-violet-950">{session.pairingCode}</p>
                  </div>
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-left text-[10px] leading-4 text-stone-500">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>O QR contém apenas o identificador público da sessão. O código não aparece nele. A autorização é de uso único e expira em poucos minutos.</span>
                  </div>
                  {receiving && <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-violet-700"><Loader2 className="h-4 w-4 animate-spin" /> Recebendo arquivo...</div>}
                </>
              )}

              {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
