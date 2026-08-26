import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clipboard, Loader2, MapPin, PackageCheck, QrCode, ShieldCheck, ShoppingCart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ClassifiedMarketplaceTermsModal } from './ClassifiedMarketplaceTermsModal';

type Method = 'PIX' | 'CARD';
type Fulfillment = 'ARRANGE' | 'PICKUP' | 'DELIVERY';
type CheckoutConfig = {
  listing: { id: string; slug: string; title: string; image?: string | null; companyName?: string | null };
  publicKey: string;
  pricing: { currentPrice: number | null; pixPrice: number | null; cardPrice: number | null; maxInstallments: number; interestFreeInstallments: number };
  fulfillmentModes: Fulfillment[];
  stockQuantity: number | null;
  available: boolean;
  buyer: { email?: string; name?: string; deliveryAddress?: string; city?: string; state?: string };
  terms: { version: string; accepted: boolean; url: string };
};
type OrderResult = {
  id: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  status: string;
  totalCents: number;
  fulfillmentMode: Fulfillment;
  expiresAt?: string | null;
  processing?: boolean;
  message?: string;
  pix?: { copyPaste?: string | null; qrCodeBase64?: string | null; ticketUrl?: string | null } | null;
};

declare global {
  interface Window { MercadoPago?: any; }
}

let mpScriptPromise: Promise<void> | null = null;
function loadMercadoPagoSdk() {
  if (window.MercadoPago) return Promise.resolve();
  if (mpScriptPromise) return mpScriptPromise;
  mpScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-piranegocios-mp-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o Mercado Pago.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.dataset.piranegociosMpSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o Mercado Pago.'));
    document.head.appendChild(script);
  });
  return mpScriptPromise;
}

export function ClassifiedCheckoutModal({ listingId, open, onClose }: { listingId: string; open: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<Method>('PIX');
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('ARRANGE');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsWorking, setTermsWorking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OrderResult | null>(null);
  const brickController = useRef<any>(null);
  const idempotencyRef = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    idempotencyRef.current = null;
    setLoading(true); setError(''); setResult(null); setConfig(null); setBrickReady(false); setQuantity(1); setDeliveryAddress(''); setDeliveryNote('');
    api.get(`/classifieds/listings/${listingId}/checkout`)
      .then((response) => {
        if (!mounted.current) return;
        const next = response.data as CheckoutConfig;
        setConfig(next);
        setFulfillment(next.fulfillmentModes?.[0] || 'ARRANGE');
        setDeliveryAddress(next.buyer?.deliveryAddress || '');
      })
      .catch((requestError: any) => mounted.current && setError(requestError?.response?.data?.message || 'Não foi possível preparar a compra online.'))
      .finally(() => mounted.current && setLoading(false));
    return () => { document.body.style.overflow = previous; };
  }, [open, listingId]);

  const unitPrice = method === 'PIX' ? Number(config?.pricing.pixPrice ?? config?.pricing.currentPrice ?? 0) : Number(config?.pricing.cardPrice ?? config?.pricing.currentPrice ?? 0);
  const amount = Math.max(0, unitPrice * quantity);
  const canMountBrick = Boolean(open && config?.publicKey && config.terms.accepted && config.available && amount > 0 && !result);

  useEffect(() => {
    let cancelled = false;
    const mount = async () => {
      if (brickController.current) {
        try { await brickController.current.unmount(); } catch { /* no-op */ }
        brickController.current = null;
      }
      setBrickReady(false);
      if (!canMountBrick || !config) return;
      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(config.publicKey, { locale: 'pt-BR' });
        const builder = mp.bricks();
        brickController.current = await builder.create('payment', 'classified-payment-brick', {
          initialization: {
            amount,
            marketplace: true,
            payer: { email: config.buyer?.email || undefined },
          },
          customization: {
            paymentMethods: method === 'PIX'
              ? { bankTransfer: 'all' }
              : { creditCard: 'all' },
            visual: { hideFormTitle: true },
          },
          callbacks: {
            onReady: () => !cancelled && setBrickReady(true),
            onError: (brickError: any) => !cancelled && setError(brickError?.message || 'O Mercado Pago não conseguiu abrir o formulário de pagamento.'),
            onSubmit: async ({ formData }: any) => {
              if (submitting) return;
              if (fulfillment === 'DELIVERY' && !deliveryAddress.trim()) {
                setError('Informe o endereço de entrega antes de pagar.');
                throw new Error('Endereço de entrega obrigatório.');
              }
              setSubmitting(true); setError('');
              const idempotencyKey = idempotencyRef.current || crypto.randomUUID().replace(/-/g, '');
              idempotencyRef.current = idempotencyKey;
              try {
                const payload: Record<string, any> = {
                  paymentMethod: method,
                  quantity,
                  fulfillmentMode: fulfillment,
                  fulfillmentData: {
                    address: fulfillment === 'DELIVERY' ? deliveryAddress.trim() : null,
                    note: deliveryNote.trim() || null,
                  },
                  idempotencyKey,
                  token: formData?.token,
                  paymentMethodId: formData?.payment_method_id,
                  issuerId: formData?.issuer_id,
                  installments: formData?.installments,
                  payer: { identification: formData?.payer?.identification },
                };
                const response = await api.post(`/classifieds/listings/${listingId}/checkout`, payload);
                setResult(response.data as OrderResult);
              } catch (requestError: any) {
                // Se o servidor respondeu, a tentativa teve desfecho conhecido e a próxima deve usar outra chave.
                // Se foi falha de rede/timeout, mantém a mesma chave para um retry seguro.
                if (requestError?.response) idempotencyRef.current = null;
                setError(requestError?.response?.data?.message || 'O pagamento não pôde ser concluído. Se houve falha de conexão, tente novamente sem recarregar a página.');
                throw requestError;
              } finally { setSubmitting(false); }
            },
          },
        });
      } catch (sdkError: any) {
        if (!cancelled) setError(sdkError?.message || 'Não foi possível carregar o checkout do Mercado Pago.');
      }
    };
    void mount();
    return () => {
      cancelled = true;
      if (brickController.current) {
        void Promise.resolve(brickController.current.unmount()).catch(() => undefined);
        brickController.current = null;
      }
    };
  }, [canMountBrick, config?.publicKey, config?.terms.accepted, method, quantity, amount, fulfillment, listingId, submitting, deliveryAddress, deliveryNote]);

  const maxQuantity = config?.stockQuantity == null ? 50 : Math.max(1, Math.min(50, config.stockQuantity));
  const accepted = Boolean(config?.terms.accepted);

  const acceptTerms = async () => {
    if (!config || termsWorking) return;
    setTermsWorking(true); setError('');
    try {
      await api.post('/classifieds/me/marketplace-terms/accept', { scope: 'ONLINE_PAYMENT_BUYER', surface: 'CHECKOUT' });
      setConfig((current) => current ? { ...current, terms: { ...current.terms, accepted: true } } : current);
      setTermsOpen(false);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível registrar o aceite dos termos.');
    } finally { setTermsWorking(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Fechar compra" onClick={() => !submitting && onClose()} />
      <section role="dialog" aria-modal="true" aria-label="Compra online" className="relative z-10 max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[30px] bg-[#fffdfa] shadow-2xl sm:rounded-[30px]">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-stone-100 bg-white/95 px-5 py-5 backdrop-blur sm:px-7">
          <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#009ee3]">Compra online</p><h2 className="mt-1 font-serif text-2xl font-black">{config?.listing.title || 'Finalizar compra'}</h2>{config?.listing.companyName && <p className="mt-1 text-xs text-stone-500">Vendido por <strong>{config.listing.companyName}</strong></p>}</div>
          <button type="button" disabled={submitting} onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </header>

        <div className="p-5 sm:p-7">
          {loading && <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#009ee3]" /></div>}
          {error && <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

          {!loading && config && !result && <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">{config.listing.image ? <img src={config.listing.image} alt="" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center text-stone-300"><ShoppingCart className="h-10 w-10" /></div>}<div className="p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Total</p><p className="mt-1 text-2xl font-black text-stone-950">{money(amount)}</p><p className="mt-1 text-[10px] text-stone-400">{quantity} × {money(unitPrice)}</p></div></div>

              <FieldLabel label="Quantidade"><div className="grid grid-cols-[40px_1fr_40px] overflow-hidden rounded-xl bg-white ring-1 ring-stone-200"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="h-10 font-black">−</button><div className="flex h-10 items-center justify-center text-sm font-black">{quantity}</div><button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} className="h-10 font-black">+</button></div>{config.stockQuantity != null && <p className="mt-1 text-[10px] text-stone-400">{config.stockQuantity} em estoque</p>}</FieldLabel>

              <FieldLabel label="Recebimento"><div className="space-y-2">{config.fulfillmentModes.map((mode) => <button type="button" key={mode} onClick={() => setFulfillment(mode)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-black ring-1 ${fulfillment === mode ? 'bg-stone-950 text-white ring-stone-950' : 'bg-white text-stone-600 ring-stone-200'}`}><MapPin className="h-4 w-4" />{fulfillmentLabel(mode)}</button>)}</div></FieldLabel>
            </aside>

            <main className="min-w-0">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5"><button type="button" onClick={() => setMethod('PIX')} className={`rounded-xl px-3 py-3 text-xs font-black ${method === 'PIX' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500'}`}>Pix · {money(config.pricing.pixPrice)}</button><button type="button" onClick={() => setMethod('CARD')} className={`rounded-xl px-3 py-3 text-xs font-black ${method === 'CARD' ? 'bg-white text-[#009ee3] shadow-sm' : 'text-stone-500'}`}>Cartão · {money(config.pricing.cardPrice)}</button></div>

              {fulfillment === 'DELIVERY' && <div className="mt-4 grid gap-3"><FieldLabel label="Endereço para entrega"><textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} rows={2} placeholder="Endereço onde o vendedor deverá entregar" className="w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-stone-200 focus:ring-[#009ee3]/40" /></FieldLabel><FieldLabel label="Observação opcional"><input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="Referência, horário, instruções" className="h-11 w-full rounded-xl bg-white px-3 text-sm outline-none ring-1 ring-stone-200" /></FieldLabel><p className="text-[10px] leading-5 text-amber-700">O PiraNegócios ainda não calcula frete. O valor exibido é apenas do produto; custo e condições de entrega devem estar informados ou ser combinados com o vendedor.</p></div>}

              {!accepted ? <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 p-5"><ShieldCheck className="h-5 w-5 text-amber-700" /><p className="mt-2 text-sm font-black text-amber-950">Leia os termos antes de pagar</p><p className="mt-1 text-xs leading-5 text-amber-800">Eles explicam o papel do vendedor, do PiraNegócios, do Mercado Pago, entrega, estorno e tratamento da negociação.</p><button type="button" onClick={() => setTermsOpen(true)} className="mt-4 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-black text-white">Abrir termos do marketplace</button></div> : <><div className="mt-5 min-h-[250px] rounded-[22px] bg-white p-3 ring-1 ring-stone-200"><div id="classified-payment-brick" />{!brickReady && <div className="flex min-h-52 items-center justify-center gap-2 text-xs font-bold text-stone-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pagamento seguro...</div>}</div><div className="mt-3 flex items-start gap-2 rounded-xl bg-[#eaf7fd] p-3 text-[10px] leading-5 text-[#35647d]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#009ee3]" /> O cartão é tokenizado pelo Mercado Pago. O PiraNegócios não recebe número completo nem CVV.</div></>}
            </main>
          </div>}

          {result && <PaymentResult result={result} />}
        </div>
      </section>

      <ClassifiedMarketplaceTermsModal open={termsOpen} mode="BUYER" working={termsWorking} accepted={accepted} onClose={() => !termsWorking && setTermsOpen(false)} onAccept={() => void acceptTerms()} />
    </div>
  );
}

function PaymentResult({ result }: { result: OrderResult }) {
  const approved = result.paymentStatus === 'APPROVED';
  const pending = result.paymentStatus === 'PENDING' || result.paymentStatus === 'IN_PROCESS' || result.processing;
  const copy = async () => { if (result.pix?.copyPaste) await navigator.clipboard.writeText(result.pix.copyPaste); };
  return <div className="mx-auto max-w-xl py-4 text-center">{approved ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /> : pending && result.paymentMethod === 'PIX' ? <QrCode className="mx-auto h-14 w-14 text-[#009ee3]" /> : <PackageCheck className="mx-auto h-14 w-14 text-stone-400" />}<h3 className="mt-4 font-serif text-3xl font-black">{approved ? 'Pagamento aprovado' : pending ? 'Pagamento iniciado' : 'Pedido registrado'}</h3><p className="mt-2 text-sm leading-6 text-stone-500">Pedido <strong>#{result.id.slice(0, 8).toUpperCase()}</strong> · {money(Number(result.totalCents || 0) / 100)}</p>{result.message && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">{result.message}</p>}{result.pix?.qrCodeBase64 && !approved && <img src={`data:image/png;base64,${result.pix.qrCodeBase64}`} alt="QR Code Pix" className="mx-auto mt-5 h-56 w-56 rounded-2xl bg-white p-2 ring-1 ring-stone-200" />}{result.pix?.copyPaste && !approved && <div className="mt-4 rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Pix copia e cola</p><p className="mt-2 break-all text-xs text-stone-600">{result.pix.copyPaste}</p><button type="button" onClick={() => void copy()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2 text-xs font-black text-white"><Clipboard className="h-3.5 w-3.5" /> Copiar código Pix</button></div>}<Link to="/classificados/compras" className="mt-6 inline-flex rounded-2xl bg-[#3a222b] px-5 py-3 text-sm font-black text-white">Acompanhar minhas compras</Link></div>;
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</span>{children}</label>; }
function fulfillmentLabel(mode: Fulfillment) { return mode === 'PICKUP' ? 'Somente retirada' : mode === 'DELIVERY' ? 'Entrega' : 'A combinar'; }
function money(value: unknown) { const n = Number(value); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0); }
