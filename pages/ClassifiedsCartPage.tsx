import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MapPin, Minus, PackageCheck, Plus, QrCode, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

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

type CartItem = { cartItemId: string; listingId: string; title: string; slug: string; image?: string | null; quantity: number; available: boolean; pricing?: { currentPrice?: number | null; pixPrice?: number | null; cardPrice?: number | null } };
type CartResponse = { cart: any | null; items: CartItem[]; selectedQuote?: any | null; totals: { quantity: number; subtotalCents: number; shippingCents: number; totalCents: number } };
type Address = { id: string; label: string; zipCode: string; street: string; number: string; complement?: string | null; neighborhood: string; city: string; state: string; isDefault: boolean; active: boolean };
type QuoteOption = { quoteId?: string; partnerId: string; partnerName: string; partnerType: string; eligible: boolean; amountCents?: number; partnerPayableCents?: number; estimatedMinutes?: number | null; reason?: string; mode?: string };
type Features = { cart: boolean; localDeliveryPartners: boolean; deliveryBalance: boolean; consultativeQuotes: boolean };
type PaymentConfig = { publicKey: string; paymentMethods: string[]; buyer: { email?: string; name?: string }; terms: { accepted: boolean; version: string; url: string }; cart: CartResponse };

export default function ClassifiedsCartPage() {
  const [features, setFeatures] = useState<Features | null>(null);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [addressId, setAddressId] = useState('');
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const featureResponse = await api.get('/classifieds/commerce/features');
      const nextFeatures = featureResponse.data as Features;
      setFeatures(nextFeatures);
      if (!nextFeatures.cart) { setCart(null); return; }
      const [cartResponse, addressesResponse] = await Promise.all([
        api.get('/classifieds/cart'),
        api.get('/classifieds/commerce/addresses').catch(() => ({ data: [] })),
      ]);
      setCart(cartResponse.data as CartResponse);
      const list = Array.isArray(addressesResponse.data) ? addressesResponse.data as Address[] : [];
      setAddresses(list);
      const selected = cartResponse.data?.cart?.selectedAddressId || list.find((item) => item.isDefault && item.active)?.id || list.find((item) => item.active)?.id || '';
      setAddressId(selected);
      const mode = String(cartResponse.data?.cart?.fulfillmentMode || 'PICKUP').toUpperCase();
      setFulfillment(mode === 'DELIVERY' || mode === 'ROUND_TRIP' ? 'DELIVERY' : 'PICKUP');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar o carrinho.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const setQuantity = async (item: CartItem, next: number) => {
    if (working || next < 1) return;
    setWorking(true); setError('');
    try { const response = await api.patch(`/classifieds/cart/items/${item.cartItemId}`, { quantity: next }); setCart(response.data); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível alterar a quantidade.'); }
    finally { setWorking(false); }
  };

  const remove = async (item: CartItem) => {
    if (working) return;
    setWorking(true); setError('');
    try { const response = await api.delete(`/classifieds/cart/items/${item.cartItemId}`); setCart(response.data); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível remover o item.'); }
    finally { setWorking(false); }
  };

  const calculateDelivery = async () => {
    if (!cart?.items.length || !addressId || quoting) return;
    setQuoting(true); setError(''); setQuoteOptions([]);
    try {
      const response = await api.post('/classifieds/delivery/quotes', { mode: 'DELIVERY', destinationAddressId: addressId, items: cart.items.map((item) => ({ listingId: item.listingId, quantity: item.quantity })) });
      setQuoteOptions(Array.isArray(response.data?.options) ? response.data.options : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível calcular a entrega.');
    } finally { setQuoting(false); }
  };

  const selectPickup = async () => {
    if (working) return;
    setWorking(true); setError('');
    try { const response = await api.patch('/classifieds/cart/fulfillment', { fulfillmentMode: 'PICKUP' }); setCart(response.data); setFulfillment('PICKUP'); setQuoteOptions([]); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível selecionar retirada.'); }
    finally { setWorking(false); }
  };

  const selectQuote = async (option: QuoteOption) => {
    if (!option.quoteId || !addressId || working) return;
    setWorking(true); setError('');
    try { const response = await api.patch('/classifieds/cart/fulfillment', { fulfillmentMode: 'DELIVERY', addressId, quoteId: option.quoteId }); setCart(response.data); setFulfillment('DELIVERY'); setNotice(`Entrega ${option.partnerName} selecionada.`); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível selecionar esta entrega.'); }
    finally { setWorking(false); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;
  if (features && !features.cart) return <FeatureDisabled title="Carrinho em preparação" text="A nova experiência de carrinho por empresa está instalada, mas ainda não foi liberada neste ambiente." />;
  if (!cart?.cart || !cart.items.length) return <div className="mx-auto max-w-3xl rounded-[30px] bg-white p-10 text-center shadow-sm ring-1 ring-stone-200"><ShoppingCart className="mx-auto h-10 w-10 text-stone-300" /><h1 className="mt-4 font-serif text-3xl font-black">Seu carrinho está vazio</h1><p className="mt-2 text-sm text-stone-500">Cada carrinho reúne produtos de uma única empresa.</p><Link to="/classificados/explorar" className="mt-6 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black text-white">Explorar produtos</Link></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Compra em uma empresa</p><h1 className="mt-1 font-serif text-3xl font-black">Carrinho</h1><p className="mt-2 text-sm text-stone-500">Revise itens, escolha retirada ou entrega e faça uma única cobrança.</p></header>
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{typeof error === 'string' ? error : JSON.stringify(error)}</div>}
      {notice && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-stone-200">
            <h2 className="font-serif text-xl font-black">Itens</h2>
            <div className="mt-4 divide-y divide-stone-100">{cart.items.map((item) => <div key={item.cartItemId} className="flex gap-4 py-4 first:pt-0 last:pb-0"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-stone-100">{item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><Link to={`/classificados/explorar/${item.slug}`} className="font-black text-stone-900 hover:underline">{item.title}</Link><p className="mt-1 text-sm font-bold text-stone-500">{moneyFromNumber(item.pricing?.currentPrice)}</p><div className="mt-3 flex items-center gap-2"><button disabled={working || item.quantity <= 1} onClick={() => void setQuantity(item, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button><span className="min-w-7 text-center text-sm font-black">{item.quantity}</span><button disabled={working} onClick={() => void setQuantity(item, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100"><Plus className="h-3.5 w-3.5" /></button><button disabled={working} onClick={() => void remove(item)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div></div></div>)}</div>
          </section>

          <section className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-stone-200"><h2 className="font-serif text-xl font-black">Como quer receber?</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={() => void selectPickup()} className={`rounded-2xl p-4 text-left ring-1 ${fulfillment === 'PICKUP' && !cart.selectedQuote ? 'bg-stone-950 text-white ring-stone-950' : 'bg-white ring-stone-200'}`}><PackageCheck className="h-5 w-5" /><p className="mt-2 text-sm font-black">Retirada</p><p className="mt-1 text-xs opacity-65">Retirar no local padrão informado pela empresa.</p></button><button disabled={!features?.localDeliveryPartners} onClick={() => setFulfillment('DELIVERY')} className={`rounded-2xl p-4 text-left ring-1 disabled:opacity-45 ${fulfillment === 'DELIVERY' ? 'bg-[#eaf7fd] text-[#235c78] ring-[#009ee3]/30' : 'bg-white ring-stone-200'}`}><Truck className="h-5 w-5" /><p className="mt-2 text-sm font-black">Entrega parceira</p><p className="mt-1 text-xs opacity-65">Mostra opções elegíveis por endereço, peso e regra vigente.</p></button></div>
            {fulfillment === 'DELIVERY' && <div className="mt-5"><label className="text-xs font-black text-stone-500">Endereço</label>{addresses.length ? <select value={addressId} onChange={(event) => setAddressId(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-bold outline-none">{addresses.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.label} · {item.street}, {item.number} · {item.neighborhood}</option>)}</select> : <p className="mt-2 rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-800">Você ainda não tem endereço cadastrado. Cadastre em <Link className="underline" to="/classificados/logistica">Logística e endereços</Link>.</p>}<button disabled={!addressId || quoting} onClick={() => void calculateDelivery()} className="mt-3 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:opacity-50">{quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} Calcular opções</button>
              {quoteOptions.length > 0 && <div className="mt-4 space-y-2">{quoteOptions.map((option) => <button key={`${option.partnerId}-${option.quoteId || 'none'}`} disabled={!option.eligible || !option.quoteId || working} onClick={() => void selectQuote(option)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left disabled:opacity-55"><div><p className="text-sm font-black">{option.partnerName} <span className="ml-1 text-[10px] text-stone-400">{option.partnerType}</span></p><p className="mt-1 text-xs text-stone-500">{option.eligible ? option.estimatedMinutes ? `Estimativa ${option.estimatedMinutes} min` : 'Prazo sob confirmação' : option.reason}</p></div>{option.eligible && <span className="text-sm font-black">{money(option.amountCents || 0)}</span>}</button>)}</div>}
            </div>}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start"><div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-stone-200"><h2 className="font-serif text-xl font-black">Resumo</h2><div className="mt-4 space-y-2 text-sm"><Summary label="Itens" value={money(cart.totals.subtotalCents)} /><Summary label="Frete" value={cart.totals.shippingCents ? money(cart.totals.shippingCents) : fulfillment === 'PICKUP' ? 'Grátis' : 'A calcular'} /><div className="border-t border-stone-100 pt-3"><Summary label="Total" value={money(cart.totals.totalCents)} strong /></div></div><button disabled={!cart.items.every((item) => item.available) || (fulfillment === 'DELIVERY' && !cart.selectedQuote)} onClick={() => setPaymentOpen(true)} className="mt-5 h-12 w-full rounded-2xl bg-[#009ee3] text-sm font-black text-white disabled:opacity-45">Ir para pagamento</button><p className="mt-3 text-[10px] leading-5 text-stone-400">Preço, estoque e frete são revalidados pelo servidor antes da cobrança.</p></div></aside>
      </div>
      {paymentOpen && <CartPaymentDialog onClose={() => setPaymentOpen(false)} onSuccess={() => { setPaymentOpen(false); void load(); }} />}
    </div>
  );
}

function CartPaymentDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [method, setMethod] = useState<'PIX' | 'CARD'>('PIX');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [termsWorking, setTermsWorking] = useState(false);
  const brickController = useRef<any>(null);
  const idempotencyRef = useRef<string | null>(null);

  useEffect(() => { api.get('/classifieds/cart/payment-config').then((response) => setConfig(response.data)).catch((e: any) => setError(e?.response?.data?.message || 'Não foi possível preparar o pagamento.')).finally(() => setLoading(false)); }, []);
  const totalCents = Number(config?.cart?.totals?.totalCents || 0);
  const amount = totalCents / 100;
  const accepted = Boolean(config?.terms?.accepted);

  useEffect(() => {
    let cancelled = false;
    const mount = async () => {
      if (brickController.current) { try { await brickController.current.unmount(); } catch {} brickController.current = null; }
      setBrickReady(false);
      if (!config?.publicKey || !accepted || amount <= 0 || result) return;
      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(config.publicKey, { locale: 'pt-BR' });
        brickController.current = await mp.bricks().create('payment', 'classified-cart-payment-brick', {
          initialization: { amount, marketplace: true, payer: { email: config.buyer?.email || undefined } },
          customization: { paymentMethods: method === 'PIX' ? { bankTransfer: 'all' } : { creditCard: 'all' }, visual: { hideFormTitle: true } },
          callbacks: {
            onReady: () => !cancelled && setBrickReady(true),
            onError: (brickError: any) => !cancelled && setError(brickError?.message || 'O Mercado Pago não conseguiu abrir o pagamento.'),
            onSubmit: async ({ formData }: any) => {
              if (submitting) return;
              setSubmitting(true); setError('');
              const key = idempotencyRef.current || crypto.randomUUID().replace(/-/g, '');
              idempotencyRef.current = key;
              try {
                const response = await api.post('/classifieds/cart/pay', { paymentMethod: method, idempotencyKey: key, token: formData?.token, paymentMethodId: formData?.payment_method_id, issuerId: formData?.issuer_id, installments: formData?.installments, payer: { identification: formData?.payer?.identification } });
                setResult(response.data);
                if (response.data?.paymentStatus === 'APPROVED') setTimeout(onSuccess, 1200);
              } catch (requestError: any) {
                if (requestError?.response) idempotencyRef.current = null;
                setError(requestError?.response?.data?.message || 'Não foi possível concluir o pagamento.');
                throw requestError;
              } finally { setSubmitting(false); }
            },
          },
        });
      } catch (sdkError: any) { if (!cancelled) setError(sdkError?.message || 'Não foi possível carregar o Mercado Pago.'); }
    };
    void mount();
    return () => { cancelled = true; if (brickController.current) void Promise.resolve(brickController.current.unmount()).catch(() => undefined); brickController.current = null; };
  }, [config?.publicKey, accepted, amount, method, result, submitting, onSuccess]);

  const acceptTerms = async () => {
    if (termsWorking) return;
    setTermsWorking(true); setError('');
    try { await api.post('/classifieds/me/marketplace-terms/accept', { scope: 'ONLINE_PAYMENT_BUYER', surface: 'CART_CHECKOUT' }); setConfig((current) => current ? { ...current, terms: { ...current.terms, accepted: true } } : current); }
    catch (e: any) { setError(e?.response?.data?.message || 'Não foi possível registrar o aceite.'); }
    finally { setTermsWorking(false); }
  };

  return <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"><button className="absolute inset-0" onClick={() => !submitting && onClose()} aria-label="Fechar" /><section className="relative z-10 max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#009ee3]">Pagamento único</p><h2 className="mt-1 font-serif text-2xl font-black">Finalizar pedido</h2><p className="mt-1 text-sm text-stone-500">Itens + frete no mesmo pagamento.</p></div><button disabled={submitting} onClick={onClose} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black">Fechar</button></div>{loading && <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}{error && <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}{!loading && config && !accepted && <div className="mt-5 rounded-2xl bg-amber-50 p-5"><p className="text-sm font-black text-amber-950">Aceite atualizado necessário</p><p className="mt-1 text-xs leading-5 text-amber-800">A versão atual cobre carrinho, pagamento único e entrega. <Link className="underline" target="_blank" to={config.terms.url}>Ler termos</Link></p><button disabled={termsWorking} onClick={() => void acceptTerms()} className="mt-3 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white">{termsWorking ? 'Registrando...' : 'Li e aceito'}</button></div>}{!loading && config && accepted && !result && <><div className="mt-5 flex items-center justify-between rounded-2xl bg-stone-50 p-4"><span className="text-sm font-bold text-stone-500">Total</span><span className="text-2xl font-black">{money(totalCents)}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => setMethod('PIX')} className={`rounded-xl py-3 text-xs font-black ${method === 'PIX' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'}`}>Pix</button><button onClick={() => setMethod('CARD')} className={`rounded-xl py-3 text-xs font-black ${method === 'CARD' ? 'bg-[#009ee3] text-white' : 'bg-stone-100 text-stone-600'}`}>Cartão</button></div><div className="mt-5 min-h-40"><div id="classified-cart-payment-brick" />{!brickReady && <p className="mt-3 text-center text-xs text-stone-400">Carregando ambiente seguro do Mercado Pago...</p>}</div></>}{result && <div className="mt-6 rounded-3xl bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h3 className="mt-3 text-xl font-black text-emerald-950">{result.paymentStatus === 'APPROVED' ? 'Pagamento aprovado' : result.processing ? 'Pagamento em processamento' : 'Pedido criado'}</h3><p className="mt-2 text-sm text-emerald-800">Pedido {result.id}</p>{result.pix?.copyPaste && <div className="mt-4 rounded-2xl bg-white p-3 text-left"><p className="text-[10px] font-black uppercase text-stone-400">Pix copia e cola</p><p className="mt-1 break-all text-xs">{result.pix.copyPaste}</p></div>}{result.pix?.qrCodeBase64 && <img alt="QR Code Pix" className="mx-auto mt-4 h-44 w-44 rounded-2xl bg-white p-2" src={`data:image/png;base64,${result.pix.qrCodeBase64}`} />}{result.processing && <p className="mt-3 text-xs text-emerald-700">Não tente pagar novamente. A confirmação será reconciliada pelo webhook.</p>}</div>}</section></div>;
}

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex items-center justify-between gap-3 ${strong ? 'text-lg font-black' : ''}`}><span className={strong ? '' : 'text-stone-500'}>{label}</span><span className={strong ? '' : 'font-bold'}>{value}</span></div>; }
function FeatureDisabled({ title, text }: { title: string; text: string }) { return <div className="mx-auto max-w-3xl rounded-[30px] bg-white p-10 text-center shadow-sm ring-1 ring-stone-200"><QrCode className="mx-auto h-9 w-9 text-stone-300" /><h1 className="mt-4 font-serif text-3xl font-black">{title}</h1><p className="mt-2 text-sm text-stone-500">{text}</p></div>; }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100); }
function moneyFromNumber(value: unknown) { const n = Number(value); return Number.isFinite(n) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n) : '—'; }
