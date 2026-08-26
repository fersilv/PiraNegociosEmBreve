import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { api } from '../../lib/api';

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

export type PaymentCheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  amountCents?: number | null;
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
  confirmLabel = 'Pagar com Pix',
  creatingLabel = 'Criando cobrança...',
  createCheckout,
  onCompleted,
  children,
}: PaymentCheckoutModalProps) {
  const [creating, setCreating] = useState(false);
  const [checkout, setCheckout] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const completedOnce = useRef(false);

  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setCheckout(null);
    setError('');
    setCopied(false);
    completedOnce.current = false;
  }, [open]);

  const completed = checkout?.completed === true || checkout?.status === 'PAID';
  const failed = ['CANCELED', 'EXPIRED', 'REFUNDED'].includes(String(checkout?.status || '').toUpperCase());
  const recurring = checkout?.recurring === true
    || checkout?.billingType === 'RECURRING'
    || checkout?.product?.billingType === 'RECURRING'
    || checkout?.metadata?.recurringApi === 'SUBSCRIPTIONS';
  const authorizationUrl = recurring
    ? checkout?.authorizationUrl || checkout?.metadata?.subscriptionCheckoutUrl || null
    : null;
  const ticketUrl = !recurring
    ? checkout?.ticketUrl || checkout?.metadata?.ticketUrl || null
    : null;
  const pixCopyPaste = checkout?.pixCopyPaste || null;
  const qrCodeBase64 = checkout?.qrCodeBase64 || null;
  const checkoutReady = Boolean(pixCopyPaste || qrCodeBase64 || authorizationUrl || ticketUrl || checkout?.checkoutReady);

  const shownAmount = useMemo(() => {
    if (checkout?.amountCents !== undefined && checkout?.amountCents !== null) return Number(checkout.amountCents);
    return amountCents === undefined ? null : amountCents;
  }, [amountCents, checkout?.amountCents]);

  useEffect(() => {
    if (!open || !checkout?.id || completed || failed) return;
    let active = true;
    let busy = false;

    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await api.get(`/payments/${checkout.id}/status`);
        if (!active) return;
        const next = response.data || {};
        setCheckout((current: any) => ({ ...current, ...next }));
        if (next.completed === true || next.status === 'PAID') {
          if (!completedOnce.current) {
            completedOnce.current = true;
            await onCompleted?.(next);
          }
        }
      } catch {
        // O webhook e a próxima consulta continuam sendo a fonte de verdade.
      } finally {
        busy = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [checkout?.id, completed, failed, onCompleted, open]);

  useEffect(() => {
    if (!completed || completedOnce.current) return;
    completedOnce.current = true;
    void onCompleted?.(checkout);
  }, [checkout, completed, onCompleted]);

  if (!open) return null;

  const begin = async () => {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const result = await createCheckout();
      const data = result?.data ?? result ?? {};
      if (data?.paymentRequired === false) {
        const done = { ...data, completed: true, status: data.status || 'PAID' };
        setCheckout(done);
        if (!completedOnce.current) {
          completedOnce.current = true;
          await onCompleted?.(done);
        }
        return;
      }
      setCheckout(data);
      if (!data?.id && !data?.checkoutReady && !data?.metadata?.subscriptionCheckoutUrl) {
        setError('O provedor criou a tentativa, mas não retornou um identificador que permita acompanhar a cobrança.');
      }
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

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-stone-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-[#fffdfa] shadow-2xl sm:rounded-[30px]">
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

              {authorizationUrl ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-center">
                  <img src="/brand/pix.svg" alt="Pix" className="mx-auto h-8 w-auto" />
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[.16em] text-violet-700">Autorização recorrente</p>
                  <h3 className="mt-1 font-bold text-stone-950">Autorize a cobrança no ambiente seguro</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-500">A janela pode ser aberta em outra aba. Esta modal continua acompanhando a autorização e será atualizada automaticamente.</p>
                  <a href={authorizationUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white">Abrir autorização <ExternalLink className="h-4 w-4" /></a>
                </div>
              ) : (pixCopyPaste || qrCodeBase64) ? (
                <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
                  {qrCodeBase64 ? (
                    <div className="flex min-h-[210px] items-center justify-center rounded-2xl border border-emerald-100 bg-white p-3">
                      <img src={String(qrCodeBase64).startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`} alt="QR Code Pix" className="h-auto max-h-[190px] w-auto max-w-full" />
                    </div>
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-center text-xs text-stone-500"><QrCode className="mr-2 h-5 w-5 text-emerald-600" />Use o Pix copia e cola ao lado.</div>
                  )}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-700">Pix copia e cola</p>
                    {pixCopyPaste ? <><div className="mt-2 max-h-28 overflow-auto break-all rounded-xl bg-white p-3 font-mono text-[11px] leading-5 text-stone-700 ring-1 ring-stone-200">{pixCopyPaste}</div><button type="button" onClick={() => void copyPix()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"><Copy className="h-3.5 w-3.5" />{copied ? 'Copiado!' : 'Copiar código Pix'}</button></> : <p className="mt-2 text-xs text-stone-500">O QR está disponível para leitura.</p>}
                  </div>
                </div>
              ) : ticketUrl ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                  <QrCode className="mx-auto h-8 w-8 text-emerald-700" />
                  <h3 className="mt-3 font-bold text-stone-950">Pix pronto no Mercado Pago</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-500">O provedor retornou a página de instruções antes do QR bruto. Você pode abrir essa página enquanto continuamos tentando carregar o QR dentro da modal.</p>
                  <a href={ticketUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white">Abrir instruções do Pix <ExternalLink className="h-4 w-4" /></a>
                </div>
              ) : checkoutReady ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><QrCode className="mx-auto h-8 w-8 text-emerald-700" /><p className="mt-3 text-sm font-bold text-stone-900">Cobrança criada. Preparando os dados do Pix...</p></div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-700" />
                  <h3 className="mt-3 font-bold text-stone-950">Preparando seu Pix...</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-600">A cobrança já tem identificador. Estamos consultando o provedor até o QR Code ficar disponível, sem criar outra cobrança.</p>
                </div>
              )}

              <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 text-[10px] font-bold text-stone-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                {recurring ? 'Aguardando autorização' : 'Aguardando confirmação do pagamento'}
              </div>

              {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{error}</div>}

              <div className="mt-4 flex items-center justify-center gap-2 border-t border-stone-200 pt-4 text-[10px] font-semibold text-stone-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />Pagamento processado por <span className="font-black text-stone-700">{providerName(checkout.provider)}</span></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentCheckoutModal;
