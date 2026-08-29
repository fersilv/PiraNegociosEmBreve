import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, Clipboard, Loader2, MapPin, PackageCheck, Plus, QrCode, ShoppingCart, Truck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { SmartAddressFields } from './SmartAddressFields';

type Method = 'PIX' | 'CARD';
type Fulfillment = 'ARRANGE' | 'PICKUP' | 'DELIVERY';
type Step = 'RECEIPT' | 'PAYMENT';
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
type SavedAddress = {
  id: string;
  label: string;
  zipCode: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
  active: boolean;
};
type DeliveryOption = {
  quoteId?: string;
  partnerId: string;
  partnerName: string;
  partnerType: string;
  eligible: boolean;
  amountCents?: number;
  partnerPayableCents?: number;
  estimatedMinutes?: number | null;
  distanceMeters?: number | null;
  reason?: string;
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

declare global { interface Window { MercadoPago?: any } }

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

const emptyAddress = {
  label: 'Principal', zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  latitude: null as number | null, longitude: null as number | null, placeId: null as string | null, isDefault: false, active: true,
};

export function ClassifiedCheckoutModal({ listingId, open, onClose }: { listingId: string; open: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [addressForm, setAddressForm] = useState({ ...emptyAddress });
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [step, setStep] = useState<Step>('RECEIPT');
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<Method>('PIX');
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('ARRANGE');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [quoteOptions, setQuoteOptions] = useState<DeliveryOption[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<DeliveryOption | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OrderResult | null>(null);
  const brickController = useRef<any>(null);
  const idempotencyRef = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const loadAddresses = async () => {
    const response = await api.get('/classifieds/commerce/addresses').catch(() => ({ data: [] }));
    const rows = Array.isArray(response.data) ? response.data.filter((item: SavedAddress) => item.active) : [];
    setAddresses(rows);
    const preferred = rows.find((item: SavedAddress) => item.isDefault) || rows[0];
    if (preferred) setAddressId(preferred.id);
    return rows;
  };

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    idempotencyRef.current = null;
    setLoading(true); setError(''); setResult(null); setConfig(null); setBrickReady(false); setQuantity(1);
    setStep('RECEIPT'); setDeliveryNote(''); setQuoteOptions([]); setSelectedQuote(null); setShowNewAddress(false); setAddressForm({ ...emptyAddress });
    Promise.all([
      api.get(`/classifieds/listings/${listingId}/checkout`),
      loadAddresses(),
    ])
      .then(async ([response]) => {
        if (!mounted.current) return;
        let next = response.data as CheckoutConfig;
        if (!next.terms?.accepted) {
          await api.post('/classifieds/me/marketplace-terms/accept', { scope: 'ONLINE_PAYMENT_BUYER', surface: 'CHECKOUT_IMPLICIT' });
          next = { ...next, terms: { ...next.terms, accepted: true } };
        }
        if (!mounted.current) return;
        setConfig(next);
        const modes = next.fulfillmentModes || [];
        setFulfillment(modes.includes('DELIVERY') ? 'DELIVERY' : modes[0] || 'ARRANGE');
      })
      .catch((requestError: any) => mounted.current && setError(errorMessage(requestError, 'Não foi possível preparar a compra online.')))
      .finally(() => mounted.current && setLoading(false));
    return () => { document.body.style.overflow = previous; };
  }, [open, listingId]);

  useEffect(() => {
    setQuoteOptions([]);
    setSelectedQuote(null);
    setStep('RECEIPT');
  }, [quantity, addressId, fulfillment]);

  const unitPrice = method === 'PIX'
    ? Number(config?.pricing.pixPrice ?? config?.pricing.currentPrice ?? 0)
    : Number(config?.pricing.cardPrice ?? config?.pricing.currentPrice ?? 0);
  const itemAmount = Math.max(0, unitPrice * quantity);
  const shippingAmount = fulfillment === 'DELIVERY' ? Number(selectedQuote?.amountCents || 0) / 100 : 0;
  const amount = itemAmount + shippingAmount;
  const paymentPricesDiffer = Number(config?.pricing.pixPrice ?? config?.pricing.currentPrice ?? 0) !== Number(config?.pricing.cardPrice ?? config?.pricing.currentPrice ?? 0);
  const canMountBrick = Boolean(open && step === 'PAYMENT' && config?.publicKey && config.available && amount > 0 && !result);

  const calculateDelivery = async () => {
    if (!addressId || quoting) {
      if (!addressId) setError('Selecione ou cadastre um endereço para calcular a entrega.');
      return;
    }
    setQuoting(true); setError(''); setQuoteOptions([]); setSelectedQuote(null);
    try {
      const response = await api.post('/classifieds/delivery/quotes', {
        mode: 'DELIVERY',
        destinationAddressId: addressId,
        items: [{ listingId, quantity }],
      });
      const options = Array.isArray(response.data?.options) ? response.data.options as DeliveryOption[] : [];
      setQuoteOptions(options);
      const first = options.find((item) => item.eligible && item.quoteId);
      if (first) setSelectedQuote(first);
      if (!first && !options.length) setError('Nenhuma modalidade de entrega foi encontrada para este endereço.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Não foi possível calcular a entrega.'));
    } finally { setQuoting(false); }
  };

  const saveAddress = async () => {
    if (savingAddress) return;
    if (!addressForm.zipCode || !addressForm.street || !addressForm.number || !addressForm.city || !addressForm.state) {
      setError('Complete CEP, rua, número, cidade e UF.');
      return;
    }
    setSavingAddress(true); setError('');
    try {
      const response = await api.post('/classifieds/commerce/addresses', addressForm);
      const savedId = String(response.data?.id || '');
      const rows = await loadAddresses();
      const selected = rows.find((item: SavedAddress) => item.id === savedId) || rows.find((item: SavedAddress) => item.isDefault) || rows[0];
      if (selected) setAddressId(selected.id);
      setAddressForm({ ...emptyAddress });
      setShowNewAddress(false);
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Não foi possível salvar o endereço.'));
    } finally { setSavingAddress(false); }
  };

  const continueToPayment = () => {
    setError('');
    if (fulfillment === 'DELIVERY') {
      if (!addressId) { setError('Selecione um endereço de entrega.'); return; }
      if (!selectedQuote?.quoteId) { setError('Calcule o frete e escolha uma opção de entrega antes de continuar.'); return; }
    }
    setStep('PAYMENT');
  };

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
          initialization: { amount, marketplace: true, payer: { email: config.buyer?.email || undefined } },
          customization: {
            paymentMethods: method === 'PIX' ? { bankTransfer: 'all' } : { creditCard: 'all' },
            visual: { hideFormTitle: true },
          },
          callbacks: {
            onReady: () => !cancelled && setBrickReady(true),
            onError: (brickError: any) => !cancelled && setError(brickError?.message || 'O Mercado Pago não conseguiu abrir o formulário de pagamento.'),
            onSubmit: async ({ formData }: any) => {
              if (submitting) return;
              setSubmitting(true); setError('');
              const idempotencyKey = idempotencyRef.current || crypto.randomUUID().replace(/-/g, '');
              idempotencyRef.current = idempotencyKey;
              try {
                const address = addresses.find((item) => item.id === addressId);
                const payload: Record<string, any> = {
                  paymentMethod: method,
                  quantity,
                  fulfillmentMode: fulfillment,
                  deliveryAddressId: fulfillment === 'DELIVERY' ? addressId : null,
                  deliveryQuoteId: fulfillment === 'DELIVERY' ? selectedQuote?.quoteId : null,
                  fulfillmentData: {
                    address: fulfillment === 'DELIVERY' && address ? addressText(address) : null,
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
                if (requestError?.response) idempotencyRef.current = null;
                setError(errorMessage(requestError, 'O pagamento não pôde ser concluído.'));
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
  }, [canMountBrick, config?.publicKey, method, amount, fulfillment, listingId, submitting, addressId, selectedQuote?.quoteId, deliveryNote, addresses]);

  const maxQuantity = config?.stockQuantity == null ? 50 : Math.max(1, Math.min(50, config.stockQuantity));
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Fechar compra" onClick={() => !submitting && onClose()} />
      <section role="dialog" aria-modal="true" aria-label="Compra online" className="relative z-10 max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[30px] bg-[#fffdfa] shadow-2xl sm:rounded-[30px]">
        <header className="sticky top-0 z-20 border-b border-stone-100 bg-white/95 px-5 py-5 backdrop-blur sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#009ee3]">Compra online</p><h2 className="mt-1 font-serif text-2xl font-black">{config?.listing.title || 'Finalizar compra'}</h2>{config?.listing.companyName && <p className="mt-1 text-xs text-stone-500">Vendido por <strong>{config.listing.companyName}</strong></p>}</div>
            <button type="button" disabled={submitting} onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 disabled:opacity-50"><X className="h-4 w-4" /></button>
          </div>
          {!result && <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5">
            <button type="button" onClick={() => setStep('RECEIPT')} className={`rounded-xl px-3 py-2.5 text-[10px] font-black ${step === 'RECEIPT' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'}`}>1. {fulfillment === 'DELIVERY' ? 'Endereço e entrega' : 'Recebimento'}</button>
            <button type="button" disabled={fulfillment === 'DELIVERY' && !selectedQuote?.quoteId} onClick={continueToPayment} className={`rounded-xl px-3 py-2.5 text-[10px] font-black disabled:opacity-40 ${step === 'PAYMENT' ? 'bg-white text-[#009ee3] shadow-sm' : 'text-stone-400'}`}>2. Pagamento</button>
          </div>}
        </header>

        <div className="p-5 sm:p-7">
          {loading && <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#009ee3]" /></div>}
          {error && <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

          {!loading && config && !result && <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">{config.listing.image ? <img src={config.listing.image} alt="" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center text-stone-300"><ShoppingCart className="h-10 w-10" /></div>}<div className="p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Resumo</p><p className="mt-1 text-sm font-bold text-stone-600">Produtos <span className="float-right">{money(itemAmount)}</span></p>{fulfillment === 'DELIVERY' && <p className="mt-1 text-sm font-bold text-stone-600">Frete <span className="float-right">{selectedQuote ? money(shippingAmount) : 'a calcular'}</span></p>}<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Total</p><p className="mt-1 text-2xl font-black text-stone-950">{money(amount)}</p></div></div></div>
              <FieldLabel label="Quantidade"><div className="grid grid-cols-[40px_1fr_40px] overflow-hidden rounded-xl bg-white ring-1 ring-stone-200"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="h-10 font-black">−</button><div className="flex h-10 items-center justify-center text-sm font-black">{quantity}</div><button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} className="h-10 font-black">+</button></div>{config.stockQuantity != null && <p className="mt-1 text-[10px] text-stone-400">{config.stockQuantity} em estoque</p>}</FieldLabel>
            </aside>

            <main className="min-w-0">
              {step === 'RECEIPT' ? <>
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Como quer receber?</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">{config.fulfillmentModes.map((mode) => <button type="button" key={mode} onClick={() => setFulfillment(mode)} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-left text-xs font-black ring-1 ${fulfillment === mode ? 'bg-stone-950 text-white ring-stone-950' : 'bg-white text-stone-600 ring-stone-200'}`}>{mode === 'DELIVERY' ? <Truck className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}{fulfillmentLabel(mode)}</button>)}</div>

                {fulfillment === 'DELIVERY' && <div className="mt-5">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-stone-700">Endereço de entrega</p><p className="mt-1 text-[10px] text-stone-400">O padrão já vem selecionado. Você pode escolher ou cadastrar outro.</p></div><button type="button" onClick={() => setShowNewAddress((value) => !value)} className="inline-flex h-9 items-center gap-1 rounded-xl bg-stone-100 px-3 text-[10px] font-black text-stone-600"><Plus className="h-3.5 w-3.5" /> Novo</button></div>
                  {addresses.length > 0 ? <div className="mt-3 grid gap-2">{addresses.map((address) => <button key={address.id} type="button" onClick={() => setAddressId(address.id)} className={`rounded-2xl p-3 text-left ring-1 ${addressId === address.id ? 'bg-[#eaf7fd] ring-[#009ee3]/35' : 'bg-white ring-stone-200'}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-black">{address.label}</p>{address.isDefault && <span className="text-[8px] font-black text-emerald-700">PADRÃO</span>}</div><p className="mt-1 text-[10px] leading-4 text-stone-500">{addressText(address)}</p></button>)}</div> : <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-[10px] font-bold text-amber-800">Cadastre um endereço para calcular a entrega.</p>}

                  {showNewAddress && <div className="mt-4 rounded-2xl border border-dashed border-stone-300 p-3"><SmartAddressFields value={addressForm} onChange={setAddressForm as any} labelKey="label" /><label className="mt-3 flex items-center gap-2 text-[10px] font-bold text-stone-600"><input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))} /> Tornar padrão</label><button type="button" disabled={savingAddress} onClick={() => void saveAddress()} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-stone-900 px-4 text-[10px] font-black text-white disabled:opacity-50">{savingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Salvar endereço</button></div>}

                  <button type="button" disabled={!addressId || quoting} onClick={() => void calculateDelivery()} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:opacity-50">{quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Calcular frete</button>

                  {quoteOptions.length > 0 && <div className="mt-3 space-y-2">{quoteOptions.map((option) => <button key={`${option.partnerId}-${option.quoteId || 'none'}`} type="button" disabled={!option.eligible || !option.quoteId} onClick={() => setSelectedQuote(option)} className={`flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left ring-1 disabled:opacity-55 ${selectedQuote?.quoteId === option.quoteId ? 'bg-emerald-50 ring-emerald-300' : 'bg-white ring-stone-200'}`}><div><p className="text-xs font-black text-stone-800">{option.partnerName}</p><p className="mt-0.5 text-[9px] text-stone-500">{option.eligible ? `${partnerLabel(option.partnerType)}${option.distanceMeters != null ? ` · ${(option.distanceMeters / 1000).toFixed(1).replace('.', ',')} km` : ''}${option.estimatedMinutes ? ` · ~${option.estimatedMinutes} min` : ''}` : option.reason || 'Indisponível'}</p></div><strong className="text-sm">{option.eligible ? money(Number(option.amountCents || 0) / 100) : '—'}</strong></button>)}</div>}
                  <FieldLabel label="Observação opcional"><input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="Referência, horário, instruções" className="mt-4 h-11 w-full rounded-xl bg-white px-3 text-sm outline-none ring-1 ring-stone-200" /></FieldLabel>
                </div>}

                {fulfillment === 'PICKUP' && <div className="mt-5 rounded-2xl bg-stone-50 p-4"><p className="text-sm font-black">Retirada</p><p className="mt-1 text-xs leading-5 text-stone-500">Você retira o pedido no ponto informado pela empresa. O local definitivo fica registrado no pedido.</p></div>}
                {fulfillment === 'ARRANGE' && <div className="mt-5 rounded-2xl bg-stone-50 p-4"><p className="text-sm font-black">A combinar</p><p className="mt-1 text-xs leading-5 text-stone-500">A forma de recebimento será combinada diretamente com a empresa.</p></div>}

                <button type="button" onClick={continueToPayment} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#009ee3] text-sm font-black text-white">Continuar para pagamento</button>
              </> : <>
                <button type="button" onClick={() => setStep('RECEIPT')} className="mb-4 inline-flex items-center gap-1 text-[10px] font-black text-stone-500"><ChevronLeft className="h-3.5 w-3.5" /> Voltar para {fulfillment === 'DELIVERY' ? 'endereço e entrega' : 'recebimento'}</button>
                {paymentPricesDiffer ? <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5"><button type="button" onClick={() => setMethod('PIX')} className={`rounded-xl px-3 py-3 text-xs font-black ${method === 'PIX' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500'}`}>Pix · {money(Number(config.pricing.pixPrice ?? config.pricing.currentPrice ?? 0) * quantity + shippingAmount)}</button><button type="button" onClick={() => setMethod('CARD')} className={`rounded-xl px-3 py-3 text-xs font-black ${method === 'CARD' ? 'bg-white text-[#009ee3] shadow-sm' : 'text-stone-500'}`}>Cartão · {money(Number(config.pricing.cardPrice ?? config.pricing.currentPrice ?? 0) * quantity + shippingAmount)}</button></div> : <div className="flex items-center justify-between rounded-2xl bg-[#eaf7fd] px-4 py-3 text-xs font-bold text-[#35647d]"><span>{method === 'PIX' ? 'Pix selecionado.' : 'Cartão selecionado.'}</span><button type="button" onClick={() => setMethod(method === 'PIX' ? 'CARD' : 'PIX')} className="underline">Usar {method === 'PIX' ? 'cartão' : 'Pix'}</button></div>}
                {fulfillment === 'DELIVERY' && selectedQuote && <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-xs"><span><strong>{selectedQuote.partnerName}</strong><br /><span className="text-emerald-700">Frete incluído no pagamento</span></span><strong>{money(shippingAmount)}</strong></div>}
                <div className="mt-5 min-h-[250px] rounded-[22px] bg-white p-3 ring-1 ring-stone-200"><div id="classified-payment-brick" />{!brickReady && <div className="flex min-h-52 items-center justify-center gap-2 text-xs font-bold text-stone-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pagamento seguro...</div>}</div>
                <p className="mt-3 text-center text-[10px] leading-5 text-stone-400">Ao concluir esta compra, você concorda com os <Link to={config.terms?.url || '/classificados/termos'} target="_blank" className="font-black text-stone-600 underline">Termos do Marketplace</Link>. O cartão é tokenizado pelo Mercado Pago.</p>
              </>}
            </main>
          </div>}

          {result && <PaymentResult result={result} />}
        </div>
      </section>
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
function fulfillmentLabel(mode: Fulfillment) { return mode === 'PICKUP' ? 'Retirada' : mode === 'DELIVERY' ? 'Entrega' : 'A combinar'; }
function addressText(address: SavedAddress) { return `${address.street}, ${address.number}${address.complement ? ` · ${address.complement}` : ''} · ${address.neighborhood} · ${address.city}/${address.state} · ${address.zipCode}`; }
function partnerLabel(value: string) { return value === 'MOTOBOY' ? 'Motoboy' : value === 'BIKE' ? 'Bike' : value === 'TRANSPORTADORA' ? 'Transportadora' : 'Entrega'; }
function money(value: unknown) { const n = Number(value); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0); }
function errorMessage(error: any, fallback: string) { const value = error?.response?.data?.message; return typeof value === 'string' ? value : value?.message || fallback; }
