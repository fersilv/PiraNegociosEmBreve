import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL, SOCKET_PATH, api } from '../../lib/api';
import { LocalQrCode } from '../LocalQrCode';

function money(cents?: number | null) {
  if (cents === null || cents === undefined) return '';
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function providerName(code?: string | null) {
  if (code === 'MERCADO_PAGO') return 'Mercado Pago';
  if (code === 'EFI') return 'Efí Bank';
  return 'provedor de pagamento';
}

function objectValue(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeCheckout(raw: any) {
  const root = objectValue(raw);
  const data = Object.keys(objectValue(root.data)).length ? objectValue(root.data) : root;
  const payment = objectValue(data.payment);
  const providerCheckout = objectValue(data.checkout);
  const result = objectValue(data.result);
  const merged = {
    ...payment,
    ...providerCheckout,
    ...result,
    ...data,
    metadata: {
      ...objectValue(payment.metadata),
      ...objectValue(providerCheckout.metadata),
      ...objectValue(result.metadata),
      ...objectValue(data.metadata),
    },
  };
  const paymentId = String(
    data.paymentId
      || payment.paymentId
      || payment.id
      || data.id
      || result.paymentId
      || result.id
      || providerCheckout.paymentId
      || '',
  ).trim() || null;
  return paymentId ? { ...merged, id: paymentId, paymentId } : merged;
}

export type PaymentCheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  amountCents?: number | null;
  productCode?: string | null;
  confirmLabel?: string;
  creatingLabel?: string;
  createCheckout: () => Promise<any>;
  onCompleted?: (checkout: any) => void | Promise<void>;
  children?: React.ReactNode;
};

export function PaymentCheckoutModal({
  open,
  onClose,
  title,
  description,
  amountCents,
  productCode,
  confirmLabel = 'Pagar com Pix',
  creatingLabel = 'Criando cobrança...',
  createCheckout,
  onCompleted,
  children,
}: PaymentCheckoutModalProps) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [checkout, setCheckout] = useState<any>(null);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [copied, setCopied] = useState(false);
  const completedOnce = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setCheckout(null);
    setError('');
    setPollError('');
    setCopied(false);
    completedOnce.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  const completed = checkout?.completed === true || checkout?.status === 'PAID';
  const failed = ['CANCELED', 'EXPIRED', 'REFUNDED'].includes(String(checkout?.status || '').toUpperCase());
  const recurring = checkout?.recurring === true
    || checkout?.billingType === 'RECURRING'
    || checkout?.product?.billingType === 'RECURRING'
    || checkout?.metadata?.recurringApi === 'SUBSCRIPTIONS'
    || checkout?.metadata?.efiAutomaticPix === true;
  const authorizationUrl = recurring
    ? checkout?.authorizationUrl || checkout?.metadata?.subscriptionCheckoutUrl || null
    : null;
  const ticketUrl = !recurring
    ? checkout?.ticketUrl || checkout?.metadata?.ticketUrl || null
    : null;
  const pixCopyPaste = checkout?.pixCopyPaste || null;
  const qrCodeBase64 = checkout?.qrCodeBase64 || null;
  const localQrByteLength = pixCopyPaste
    ? new TextEncoder().encode(String(pixCopyPaste)).length
    : 0;
  const canRenderLocalQr = Boolean(pixCopyPaste && localQrByteLength <= 271);
  const checkoutReady = Boolean(pixCopyPaste || qrCodeBase64 || authorizationUrl || ticketUrl || checkout?.checkoutReady);
  const paymentId = String(checkout?.paymentId || checkout?.id || '').trim();

  const shownAmount = useMemo(() => {
    if (checkout?.amountCents !== undefined && checkout?.amountCents !== null) return Number(checkout.amountCents);
    return amountCents === undefined ? null : amountCents;
  }, [amountCents, checkout?.amountCents]);

  useEffect(() => {
    if (!open || !paymentId || !user || completed || failed) return;
    let active = true;

    user.getIdToken().then((token) => {
      if (!active) return;
      const socket = io(API_URL, {
        path: SOCKET_PATH,
        auth: { token },
        transports: ['websocket', 'polling'],
      });
      socket.on('payment:updated', (payload: any) => {
        if (!active) return;
        const next = normalizeCheckout(payload);
        const nextPaymentId = String(next?.paymentId || next?.id || '').trim();
        if (!nextPaymentId || nextPaymentId !== paymentId) return;
        setPollError('');
        setCheckout((current: any) => normalizeCheckout({ ...current, ...next }));
      });
      socketRef.current = socket;
    }).catch(() => undefined);

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [completed, failed, open, paymentId, user]);

  useEffect(() => {
    if (!open || !paymentId || completed || failed) return;
    let active = true;
    let busy = false;
    let failures = 0;

    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await api.get(`/payments/${paymentId}/status`);
        if (!active) return;
        failures = 0;
        setPollError('');
        const next = normalizeCheckout(response.data || {});
        setCheckout((current: any) => normalizeCheckout({ ...current, ...next }));
        if (next.completed === true || next.status === 'PAID') {
          if (!completedOnce.current) {
            completedOnce.current = true;
            await onCompleted?.(next);
          }
        }
      } catch (requestError: any) {
        failures += 1;
        if (active && failures >= 3) {
          const message = requestError?.response?.data?.message;
          setPollError(
            (Array.isArray(message) ? message.join(' · ') : message)
            || 'O tempo real ficou indisponível e o fallback também não conseguiu atualizar agora. A cobrança continua a mesma e tentaremos novamente.',
          );
        }
      } finally {
        busy = false;
      }
    };

    void refresh();
    // Socket.IO é o caminho principal. O polling continua apenas como fallback
    // para proxies, bloqueadores ou redes que interrompam o WebSocket.
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [paymentId, completed, failed, onCompleted, open]);

  useEffect(() => {
    if (!completed || completedOnce.current) return;
    completedOnce.current = true;
    void onCompleted?.(checkout);
  }, [checkout, completed, onCompleted]);

  useEffect(() => () => {
    socketRef.current?.disconnect();
  }, []);

  if (!open || typeof document === 'undefined') return null;

  const recoverCheckout = async (rawInput: any) => {
    const raw = normalizeCheckout(rawInput);
    if (raw?.id) return raw;
    try {
      const historyResponse = await api.get('/payments/me');
      const rows = Array.isArray(historyResponse.data) ? historyResponse.data : [];
      const expectedProductCode = String(productCode || raw?.productCode || raw?.product?.code || '').trim();
      const expectedAmount = Number(raw?.amountCents ?? amountCents);
      const now = Date.now();
      const candidate = rows.find((item: any) => {
        if (!['PENDING', 'PAID'].includes(String(item?.status || '').toUpperCase())) return false;
        const createdAt = new Date(item?.createdAt || 0).getTime();
        if (!Number.isFinite(createdAt) || now - createdAt > 5 * 60 * 1000) return false;
        if (expectedProductCode) return String(item?.productCode || '') === expectedProductCode;
        if (Number.isFinite(expectedAmount) && expectedAmount > 0) return Number(item?.amountCents) === expectedAmount;
        return false;
      });
      if (!candidate?.id) return raw;
      return normalizeCheckout({
        ...candidate,
        ...raw,
        id: candidate.id,
        paymentId: candidate.id,
        provider: raw?.provider || candidate.provider || null,
        providerPaymentId: raw?.providerPaymentId || candidate.providerPaymentId || null,
        pixCopyPaste: raw?.pixCopyPaste || candidate.pixCopyPaste || null,
        qrCodeBase64: raw?.qrCodeBase64 || candidate.qrCodeBase64 || null,
        metadata: { ...(candidate.metadata || {}), ...(raw?.metadata || {}) },
      });
    } catch {
      return raw;
    }
  };

  const begin = async () => {
    if (creating) return;
    setCreating(true);
    setError('');
    setPollError('');
    try {
      const result = await createCheckout();
      const raw = result?.data ?? result ?? {};
      const data = await recoverCheckout(raw);
      if (data?.paymentRequired === false) {
        const done = normalizeCheckout({ ...data, completed: true, status: data.status || 'PAID' });
        setCheckout(done);
        if (!completedOnce.current) {
          completedOnce.current = true;
          await onCompleted?.(done);
        }
        return;
      }
      if (!data?.id && !data?.paymentId) {
        setCheckout(null);
        setError('A cobrança foi criada, mas não apareceu no histórico da sua conta. Nenhuma nova cobrança será criada automaticamente. Atualize a página e consulte Transações financeiras.');
        return;
      }
      setCheckout(normalizeCheckout(data));
    } catch (requestError: any) {
      const raw = requestError?.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(' · ') : raw || requestError?.message || 'Não foi possível iniciar o pagamento agora.');
    } finally {
      setCreating(false);
    }
  };

  const copyPix = async () => {
    if (!pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(String(pixCopyPaste));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.');
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[99999] flex h-[100dvh] w-screen items-stretch justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <div className="h-[100dvh] w-full max-w-2xl overflow-y-auto bg-[#fffdfa] shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[30px]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Pagamento seguro</p>
            <h2 className="mt-1 font-serif text-2xl font-black text-stone-950">{title}</h2>
            {description && <p className="mt-1 max-w-xl text-xs leading-5 text-stone-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200" aria-label="Fechar pagamento"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 sm:p-6">
          {completed ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></span>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Confirmado</p>
              <h3 className="mt-1 font-serif text-3xl font-black text-stone-950">{recurring ? 'Autorização concluída' : 'Pagamento concluído'}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">A confirmação chegou e o recurso já foi processado pelo PiraNegócios.</p>
              <button type="button" onClick={onClose} className="mt-6 rounded-2xl bg-stone-950 px-6 py-3 text-sm font-black text-white">Continuar</button>
            </div>
          ) : failed ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-500"><Clock3 className="h-8 w-8" /></span>
              <h3 className="mt-4 font-serif text-2xl font-black text-stone-950">Esta cobrança não está mais ativa</h3>
              <p className="mt-2 text-sm text-stone-500">Feche esta janela e gere uma nova cobrança quando quiser.</p>
              <button type="button" onClick={onClose} className="mt-5 rounded-2xl bg-stone-950 px-5 py-3 text-xs font-black text-white">Fechar</button>
            </div>
          ) : !checkout ? (
            <>
              {shownAmount !== null && <div className="mb-5 flex items-end justify-between gap-4 rounded-2xl bg-stone-950 p-5 text-white"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-white/45">Total</p><p className="mt-1 text-sm text-white/65">Pagamento processado pelo provedor selecionado.</p></div><p className="text-3xl font-black">{money(shownAmount)}</p></div>}
              {children}
              {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{error}</div>}
              <button type="button" onClick={() => void begin()} disabled={creating} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-50">{creating ? <><Loader2 className="h-4 w-4 animate-spin" />{creatingLabel}</> : <><QrCode className="h-4 w-4" />{confirmLabel}</>}</button>
            </>
          ) : (
            <>
              {shownAmount !== null && <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl bg-stone-950 px-5 py-4 text-white"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-white/45">Valor</p><p className="mt-1 text-xs text-white/55">{checkout.productName || title}</p></div><p className="text-2xl font-black">{money(shownAmount)}</p></div>}

              {pixCopyPaste || qrCodeBase64 ? (
                <div>
                  {recurring && checkout?.metadata?.efiAutomaticPix === true && (
                    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-700">Pix Automático</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-emerald-950">Escaneie uma única vez para autorizar a recorrência. As próximas cobranças serão processadas automaticamente conforme o plano.</p>
                    </div>
                  )}
                  <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
                    {qrCodeBase64 ? (
                      <div className="flex min-h-[210px] items-center justify-center rounded-2xl border border-emerald-100 bg-white p-3">
                        <img src={String(qrCodeBase64).startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`} alt={recurring ? 'QR Code de autorização do Pix Automático' : 'QR Code Pix'} className="h-auto max-h-[190px] w-auto max-w-full" />
                      </div>
                    ) : canRenderLocalQr ? (
                      <div className="flex min-h-[210px] items-center justify-center rounded-2xl border border-emerald-100 bg-white p-3">
                        <LocalQrCode value={String(pixCopyPaste)} label={recurring ? 'QR Code de autorização do Pix Automático' : 'QR Code Pix'} className="h-auto max-h-[190px] w-auto max-w-full" />
                      </div>
                    ) : (
                      <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-center text-xs text-stone-500"><QrCode className="mr-2 h-5 w-5 text-emerald-600" />O payload é maior que o QR local suportado. Use o Pix copia e cola ao lado.</div>
                    )}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-700">{recurring ? 'Pix Automático copia e cola' : 'Pix copia e cola'}</p>
                      {pixCopyPaste ? <><div className="mt-2 max-h-28 overflow-auto break-all rounded-xl bg-white p-3 font-mono text-[11px] leading-5 text-stone-700 ring-1 ring-stone-200">{pixCopyPaste}</div><button type="button" onClick={() => void copyPix()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"><Copy className="h-3.5 w-3.5" />{copied ? 'Copiado!' : recurring ? 'Copiar autorização Pix' : 'Copiar código Pix'}</button></> : <p className="mt-2 text-xs text-stone-500">O QR está disponível para leitura.</p>}
                    </div>
                  </div>
                </div>
              ) : authorizationUrl ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-center">
                  <img src="/brand/pix.svg" alt="Pix" className="mx-auto h-8 w-auto" />
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[.16em] text-violet-700">Assinatura do provedor</p>
                  <h3 className="mt-1 font-bold text-stone-950">Conclua a assinatura no ambiente do provedor</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-500">Este fluxo é uma assinatura hospedada e não um QR Code de Pix Automático. A modal continuará acompanhando o status em tempo real.</p>
                  <a href={authorizationUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white">Abrir assinatura <ExternalLink className="h-4 w-4" /></a>
                </div>
              ) : ticketUrl ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                  <QrCode className="mx-auto h-8 w-8 text-emerald-700" />
                  <h3 className="mt-3 font-bold text-stone-950">Pix pronto no provedor</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-500">O provedor retornou uma página de instruções antes do QR bruto. Você pode abrir essa página enquanto continuamos tentando carregar o QR dentro da modal.</p>
                  <a href={ticketUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white">Abrir instruções do Pix <ExternalLink className="h-4 w-4" /></a>
                </div>
              ) : checkoutReady ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><QrCode className="mx-auto h-8 w-8 text-emerald-700" /><p className="mt-3 text-sm font-bold text-stone-900">Cobrança criada. Preparando os dados do Pix...</p></div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-700" />
                  <h3 className="mt-3 font-bold text-stone-950">Preparando seu Pix...</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-600">A cobrança já tem identificador. O servidor está acompanhando o provedor em tempo real até o QR Code ficar disponível, sem criar outra cobrança.</p>
                </div>
              )}

              <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 text-[10px] font-bold text-stone-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                {recurring ? 'Aguardando autorização em tempo real' : 'Aguardando confirmação em tempo real'}
              </div>

              {pollError && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">{pollError}</div>}
              {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{error}</div>}

              <div className="mt-4 flex items-center justify-center gap-2 border-t border-stone-200 pt-4 text-[10px] font-semibold text-stone-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />Pagamento processado por <span className="font-black text-stone-700">{providerName(checkout.provider)}</span></div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default PaymentCheckoutModal;
