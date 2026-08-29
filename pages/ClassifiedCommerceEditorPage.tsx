import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgePercent, CreditCard, Loader2, MapPin, PackageOpen, Save, ShoppingCart, Sparkles, Truck, WalletCards } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { api } from '../lib/api';
import type { ClassifiedCommerceConfig, ClassifiedCommerceStatus, ClassifiedEffectivePricing } from '../types/classifieds';

type Form = {
  promotionEnabled: boolean;
  promotionPrice: string;
  promotionStartsAt: string;
  promotionEndsAt: string;
  promotionEndAction: 'REVERT' | 'PAUSE';
  pixEnabled: boolean;
  pixDiscountType: 'PERCENT' | 'FIXED';
  pixDiscountValue: string;
  cardEnabled: boolean;
  cardPrice: string;
  maxInstallments: string;
  interestFreeInstallments: string;
  onlineEnabled: boolean;
  inventoryMode: 'SINGLE' | 'TRACKED' | 'UNLIMITED';
  pickup: boolean;
  delivery: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
  orderWhatsappE164: string;
};

type ShippingForm = {
  inheritCompanySettings: boolean;
  originLocationId: string;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  disableLocalPartners: boolean;
  handlingType: 'STANDARD' | 'FRAGILE' | 'REFRIGERATED' | 'LARGE' | 'SPECIAL';
  handlingNotes: string;
};

type FulfillmentLocation = { id: string; name: string; city?: string; state?: string; active?: boolean; allowsDeliveryOrigin?: boolean; isDefaultDeliveryOrigin?: boolean };

const initialForm: Form = {
  promotionEnabled: false,
  promotionPrice: '',
  promotionStartsAt: '',
  promotionEndsAt: '',
  promotionEndAction: 'REVERT',
  pixEnabled: false,
  pixDiscountType: 'PERCENT',
  pixDiscountValue: '',
  cardEnabled: false,
  cardPrice: '',
  maxInstallments: '1',
  interestFreeInstallments: '0',
  onlineEnabled: false,
  inventoryMode: 'UNLIMITED',
  pickup: true,
  delivery: false,
  stockQuantity: '',
  lowStockThreshold: '',
  orderWhatsappE164: '',
};

const initialShipping: ShippingForm = {
  inheritCompanySettings: true,
  originLocationId: '',
  weightGrams: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  disableLocalPartners: false,
  handlingType: 'STANDARD',
  handlingNotes: '',
};

export default function ClassifiedCommerceEditorPage() {
  const { listingId } = useParams();
  const { data } = useClassifiedsWorkspace();
  const business = data?.activeIdentity === 'COMPANY';
  const [form, setForm] = useState<Form>(initialForm);
  const [shipping, setShipping] = useState<ShippingForm>(initialShipping);
  const [locations, setLocations] = useState<FulfillmentLocation[]>([]);
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [pricing, setPricing] = useState<ClassifiedEffectivePricing | null>(null);
  const [commerceStatus, setCommerceStatus] = useState<ClassifiedCommerceStatus | null>(null);
  const [title, setTitle] = useState('Produto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!listingId) return;
    setLoading(true); setError('');
    try {
      const requests: Promise<any>[] = [
        api.get(`/classifieds/me/commerce/listings/${listingId}`),
        api.get('/classifieds/me/listings'),
      ];
      if (business) requests.push(api.get('/classifieds/me/commerce/status'));
      const responses = await Promise.all(requests);
      const commerce = responses[0].data;
      const listings = Array.isArray(responses[1].data) ? responses[1].data : [];
      const listing = listings.find((item: any) => item.id === listingId);
      if (listing) setTitle(listing.title || 'Produto');
      setBasePrice(commerce.basePrice == null ? null : Number(commerce.basePrice));
      setPricing(commerce.pricing as ClassifiedEffectivePricing);
      if (business) setCommerceStatus(responses[2].data as ClassifiedCommerceStatus);
      setForm(fromConfig(commerce.commerceConfig as ClassifiedCommerceConfig | null));

      if (business) {
        const [shippingResponse, locationsResponse] = await Promise.all([
          api.get(`/classifieds/commerce/listings/${listingId}/shipping`).catch(() => ({ data: null })),
          api.get('/classifieds/commerce/company/locations').catch(() => ({ data: [] })),
        ]);
        setShipping(fromShipping(shippingResponse.data?.shipping));
        setLocations(Array.isArray(locationsResponse.data) ? locationsResponse.data : []);
      } else {
        setShipping(initialShipping);
        setLocations([]);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível abrir as condições comerciais deste produto.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [listingId, business, data?.company?.id]);

  const onlineAvailable = Boolean(business && commerceStatus?.companyVerified && commerceStatus?.paymentConnections?.some((item) => item.status === 'CONNECTED') && commerceStatus?.feeRule);
  const preview = useMemo(() => calculatePreview(basePrice, form), [basePrice, form]);
  const patch = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const patchShipping = <K extends keyof ShippingForm>(key: K, value: ShippingForm[K]) => setShipping((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!listingId || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = {
        promotion: form.promotionEnabled ? {
          price: form.promotionPrice,
          startsAt: localToIso(form.promotionStartsAt),
          endsAt: localToIso(form.promotionEndsAt),
          endAction: form.promotionEndAction,
        } : null,
        paymentPricing: {
          pix: {
            enabled: form.pixEnabled,
            discountType: form.pixDiscountType,
            discountValue: form.pixDiscountValue || 0,
          },
          card: {
            enabled: form.cardEnabled,
            price: form.cardPrice || null,
            maxInstallments: Number(form.maxInstallments || 1),
            interestFreeInstallments: Number(form.interestFreeInstallments || 0),
          },
        },
        onlineCheckout: {
          enabled: business && form.onlineEnabled,
          fulfillmentModes: [form.pickup ? 'PICKUP' : null, form.delivery ? 'DELIVERY' : null].filter(Boolean),
          stockQuantity: form.inventoryMode === 'UNLIMITED' ? null : form.inventoryMode === 'SINGLE' ? 1 : Number(form.stockQuantity || 0),
          lowStockThreshold: form.lowStockThreshold === '' ? null : Number(form.lowStockThreshold),
          orderWhatsappE164: form.orderWhatsappE164 || null,
        },
      };
      const response = await api.patch(`/classifieds/me/commerce/listings/${listingId}`, payload);
      setPricing(response.data?.pricing || null);

      if (business) {
        await api.patch(`/classifieds/commerce/listings/${listingId}/shipping`, {
          inheritCompanySettings: shipping.inheritCompanySettings,
          originLocationId: shipping.originLocationId || null,
          weightGrams: optionalNumber(shipping.weightGrams),
          lengthCm: optionalNumber(shipping.lengthCm),
          widthCm: optionalNumber(shipping.widthCm),
          heightCm: optionalNumber(shipping.heightCm),
          disableLocalPartners: shipping.disableLocalPartners,
          handlingType: shipping.handlingType,
          handlingNotes: shipping.handlingNotes.trim() || null,
        });
      }

      setNotice('Condições comerciais e logística salvas. A vitrine passa a usar os valores configurados.');
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível salvar as condições comerciais.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-start gap-3"><Link to="/classificados/anuncios" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-stone-200"><ArrowLeft className="h-4 w-4" /></Link><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">Preço, venda e logística</p><h1 className="mt-1 truncate font-serif text-3xl font-black">Comercial · {title}</h1><p className="mt-2 text-sm leading-6 text-stone-500">Preço, pagamento, estoque e transporte ficam no mesmo editor. A empresa define padrões globais e este produto só guarda o que realmente precisa ser diferente.</p></div></header>

      {(error || notice) && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <Card icon={<Sparkles className="h-5 w-5" />} eyebrow="Promoção" title="Preço promocional com prazo">
            <Toggle checked={form.promotionEnabled} onChange={(value) => patch('promotionEnabled', value)} label="Ativar promoção neste produto" />
            {form.promotionEnabled && <div className="mt-4 grid gap-4 sm:grid-cols-2"><MoneyField label="Preço promocional" value={form.promotionPrice} setValue={(value) => patch('promotionPrice', value)} /><SelectField label="Quando terminar" value={form.promotionEndAction} setValue={(value) => patch('promotionEndAction', value as Form['promotionEndAction'])}><option value="REVERT">Voltar ao preço normal</option><option value="PAUSE">Pausar o anúncio</option></SelectField><DateField label="Começa em (opcional)" value={form.promotionStartsAt} setValue={(value) => patch('promotionStartsAt', value)} /><DateField label="Termina em (opcional)" value={form.promotionEndsAt} setValue={(value) => patch('promotionEndsAt', value)} /></div>}
          </Card>

          <Card icon={<BadgePercent className="h-5 w-5" />} eyebrow="Pix" title="Dê vantagem para pagamento imediato">
            <Toggle checked={form.pixEnabled} onChange={(value) => patch('pixEnabled', value)} label="Oferecer condição especial no Pix" />
            {form.pixEnabled && <div className="mt-4 grid gap-4 sm:grid-cols-2"><SelectField label="Tipo de desconto" value={form.pixDiscountType} setValue={(value) => patch('pixDiscountType', value as Form['pixDiscountType'])}><option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option></SelectField><Field label={form.pixDiscountType === 'PERCENT' ? 'Desconto (%)' : 'Desconto (R$)'}><input type="number" min="0" step="0.01" value={form.pixDiscountValue} onChange={(event) => patch('pixDiscountValue', event.target.value)} className={inputClass} /></Field></div>}
          </Card>

          <Card icon={<CreditCard className="h-5 w-5" />} eyebrow="Cartão" title="Preço e parcelamento">
            <Toggle checked={form.cardEnabled} onChange={(value) => patch('cardEnabled', value)} label="Exibir condições para cartão" />
            {form.cardEnabled && <div className="mt-4 grid gap-4 sm:grid-cols-3"><MoneyField label="Preço no cartão (opcional)" value={form.cardPrice} setValue={(value) => patch('cardPrice', value)} placeholder="Usar preço vigente" /><Field label="Até quantas vezes"><input type="number" min="1" max="24" value={form.maxInstallments} onChange={(event) => patch('maxInstallments', event.target.value)} className={inputClass} /></Field><Field label="Sem juros até"><input type="number" min="0" max={form.maxInstallments || '24'} value={form.interestFreeInstallments} onChange={(event) => patch('interestFreeInstallments', event.target.value)} className={inputClass} /></Field></div>}
          </Card>

          {business && <Card icon={<ShoppingCart className="h-5 w-5" />} eyebrow="Compra online" title="Transforme o anúncio em checkout">
            {!onlineAvailable && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Para ativar compra online, a empresa precisa estar verificada, conectar um provedor em <Link to="/classificados/vendas" className="font-black underline">Vendas</Link> e ter uma regra de comissão configurada. O anúncio continua funcionando normalmente por chat/oferta sem isso.</div>}
            <Toggle checked={form.onlineEnabled} disabled={!onlineAvailable} onChange={(value) => patch('onlineEnabled', value)} label="Permitir comprar e pagar online" />
            {form.onlineEnabled && <div className="mt-4 space-y-4"><div><p className="text-xs font-black text-stone-600">Como o cliente recebe?</p><div className="mt-2 flex gap-2"><CheckButton active={form.pickup} onClick={() => patch('pickup', !form.pickup)} label="Retirada" /><CheckButton active={form.delivery} onClick={() => patch('delivery', !form.delivery)} label="Entrega" /></div></div><div><p className="text-xs font-black text-stone-600">Disponibilidade</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><CheckButton active={form.inventoryMode === 'SINGLE'} onClick={() => { patch('inventoryMode', 'SINGLE'); patch('stockQuantity', '1'); }} label="Produto único" /><CheckButton active={form.inventoryMode === 'TRACKED'} onClick={() => patch('inventoryMode', 'TRACKED')} label="Controlar estoque" /><CheckButton active={form.inventoryMode === 'UNLIMITED'} onClick={() => patch('inventoryMode', 'UNLIMITED')} label="Sem limite" /></div></div><div className="grid gap-4 sm:grid-cols-2">{form.inventoryMode === 'TRACKED' && <Field label="Em estoque"><input type="number" min="0" value={form.stockQuantity} onChange={(event) => patch('stockQuantity', event.target.value)} className={inputClass} /></Field>}<Field label="Avisar estoque baixo em"><input type="number" min="0" value={form.lowStockThreshold} onChange={(event) => patch('lowStockThreshold', event.target.value)} className={inputClass} /></Field></div><Link to="/classificados/estoque" className="inline-flex text-xs font-black text-[#a84f34] underline">Abrir gestão rápida de estoque</Link><Field label="WhatsApp para receber pedidos (opcional)"><input value={form.orderWhatsappE164} onChange={(event) => patch('orderWhatsappE164', event.target.value)} placeholder="5516999999999" className={inputClass} /></Field><p className="text-[10px] leading-5 text-stone-400">O número fica como preferência operacional da empresa. O envio automático de pedidos por WhatsApp depende da integração de mensagens estar habilitada.</p></div>}
          </Card>}

          {business && <Card icon={<Truck className="h-5 w-5" />} eyebrow="Logística do produto" title="Peso, dimensões, origem e exceções">
            <div className="rounded-2xl bg-[#f4faf8] p-4 text-xs leading-5 text-[#315f5a]">Os modos de pagamento e entrega seguem os <Link to="/classificados/logistica" className="font-black underline">padrões da empresa</Link>. Aqui ficam apenas dados físicos e exceções deste produto.</div>
            <div className="mt-4"><Toggle checked={shipping.inheritCompanySettings} onChange={(value) => patchShipping('inheritCompanySettings', value)} label="Herdar regras globais de entrega da empresa" /></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Origem / loja"><select value={shipping.originLocationId} onChange={(event) => patchShipping('originLocationId', event.target.value)} className={inputClass}><option value="">Usar origem padrão</option>{locations.filter((item) => item.active !== false && item.allowsDeliveryOrigin !== false).map((item) => <option key={item.id} value={item.id}>{item.name}{item.isDefaultDeliveryOrigin ? ' · padrão' : ''}{item.city ? ` · ${item.city}/${item.state || ''}` : ''}</option>)}</select></Field>
              <SelectField label="Manuseio" value={shipping.handlingType} setValue={(value) => patchShipping('handlingType', value as ShippingForm['handlingType'])}><option value="STANDARD">Padrão</option><option value="FRAGILE">Frágil</option><option value="REFRIGERATED">Refrigerado</option><option value="LARGE">Grande volume</option><option value="SPECIAL">Especial</option></SelectField>
              <Field label="Peso (gramas)"><input type="number" min="0" value={shipping.weightGrams} onChange={(event) => patchShipping('weightGrams', event.target.value)} placeholder="Ex.: 850" className={inputClass} /></Field>
              <div className="grid grid-cols-3 gap-2"><Field label="C (cm)"><input type="number" min="0" step="0.1" value={shipping.lengthCm} onChange={(event) => patchShipping('lengthCm', event.target.value)} className={inputClass} /></Field><Field label="L (cm)"><input type="number" min="0" step="0.1" value={shipping.widthCm} onChange={(event) => patchShipping('widthCm', event.target.value)} className={inputClass} /></Field><Field label="A (cm)"><input type="number" min="0" step="0.1" value={shipping.heightCm} onChange={(event) => patchShipping('heightCm', event.target.value)} className={inputClass} /></Field></div>
            </div>
            <div className="mt-4"><Toggle checked={shipping.disableLocalPartners} onChange={(value) => patchShipping('disableLocalPartners', value)} label="Não oferecer parceiros locais para este produto" /></div>
            <Field label="Observação de manuseio"><textarea rows={3} value={shipping.handlingNotes} onChange={(event) => patchShipping('handlingNotes', event.target.value)} placeholder="Ex.: transportar sempre na vertical" className={`${inputClass} mt-0 h-auto py-3`} /></Field>
            {!locations.length && <p className="mt-3 flex items-center gap-2 text-[10px] font-bold text-amber-700"><MapPin className="h-3.5 w-3.5" /> Cadastre um ponto de origem em Logística para selecionar uma unidade específica.</p>}
          </Card>}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start"><div className="rounded-[28px] bg-[#211c19] p-5 text-white shadow-xl"><p className="text-[9px] font-black uppercase tracking-[.15em] text-white/45">Prévia de preço</p><p className="mt-3 text-xs text-white/45">Preço normal</p><p className={`${preview.promotionActive ? 'text-sm text-white/35 line-through' : 'text-3xl font-black'}`}>{money(basePrice)}</p>{preview.promotionActive && <><div className="mt-3 inline-flex rounded-full bg-[#c96847] px-3 py-1 text-[9px] font-black uppercase tracking-[.1em]">Oferta</div><p className="mt-2 text-3xl font-black">{money(preview.currentPrice)}</p>{form.promotionEndsAt && <p className="mt-1 text-[10px] text-white/45">Até {formatLocal(form.promotionEndsAt)}</p>}</>}{form.pixEnabled && <div className="mt-5 rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-300/15"><p className="text-[9px] font-black uppercase tracking-[.1em] text-emerald-200">No Pix</p><p className="mt-1 text-xl font-black text-emerald-200">{money(preview.pixPrice)}</p></div>}{form.cardEnabled && <div className="mt-3 rounded-2xl bg-white/[.06] p-4"><p className="text-[9px] font-black uppercase tracking-[.1em] text-white/45">No cartão</p><p className="mt-1 text-lg font-black">{money(preview.cardPrice)}</p><p className="mt-1 text-[10px] text-white/45">até {Math.max(1, Number(form.maxInstallments || 1))}x{Number(form.interestFreeInstallments || 0) > 0 ? ` · ${form.interestFreeInstallments}x sem juros` : ''}</p></div>}{business && form.onlineEnabled && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-blue-400/10 p-3 text-xs font-bold text-blue-100"><WalletCards className="h-4 w-4" /> Compra online habilitada</div>}{business && <div className="mt-3 rounded-2xl bg-white/[.06] p-3 text-[10px] leading-5 text-white/55"><Truck className="mr-1 inline h-3.5 w-3.5" /> {shipping.disableLocalPartners ? 'Parceiros locais desativados para este item.' : 'Parceiros elegíveis serão filtrados por peso, dimensões, distância e tabela vigente.'}</div>}<button disabled={saving} onClick={() => void save()} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-stone-900 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar condições</button></div>
          <div className="mt-4 rounded-[22px] bg-white p-4 text-xs leading-5 text-stone-500 ring-1 ring-stone-200"><PackageOpen className="mb-2 h-5 w-5 text-stone-400" />O preço promocional não apaga o preço normal. Cotações e pedidos também guardam seus próprios snapshots, portanto mudar peso, origem ou tabela depois não reescreve o histórico.</div>
        </aside>
      </section>
    </div>
  );
}

function Card({ icon, eyebrow, title, children }: { icon: React.ReactNode; eyebrow: string; title: string; children: React.ReactNode }) { return <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">{icon}</span><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{eyebrow}</p><h2 className="mt-0.5 text-base font-black">{title}</h2></div></div><div className="mt-5">{children}</div></section>; }
function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) { return <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 text-left disabled:opacity-40"><span className="text-sm font-bold text-stone-700">{label}</span><span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-[#0d4542]' : 'bg-stone-200'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></span></button>; }
function CheckButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2 text-xs font-black ${active ? 'bg-[#0d4542] text-white' : 'bg-stone-100 text-stone-500'}`}>{label}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span>{children}</label>; }
function MoneyField({ label, value, setValue, placeholder = '0,00' }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string }) { return <Field label={label}><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">R$</span><input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className={`${inputClass} pl-11`} /></div></Field>; }
function DateField({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) { return <Field label={label}><input type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} /></Field>; }
function SelectField({ label, value, setValue, children }: { label: string; value: string; setValue: (value: string) => void; children: React.ReactNode }) { return <Field label={label}><select value={value} onChange={(event) => setValue(event.target.value)} className={inputClass}>{children}</select></Field>; }

const inputClass = 'h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-800 outline-none focus:border-stone-400 focus:bg-white';

function fromConfig(config: ClassifiedCommerceConfig | null): Form {
  const promotion = config?.promotion;
  const pix = config?.paymentPricing?.pix;
  const card = config?.paymentPricing?.card;
  const checkout = config?.onlineCheckout;
  return {
    promotionEnabled: Boolean(promotion),
    promotionPrice: promotion?.price == null ? '' : String(promotion.price),
    promotionStartsAt: isoToLocal(promotion?.startsAt),
    promotionEndsAt: isoToLocal(promotion?.endsAt),
    promotionEndAction: promotion?.endAction === 'PAUSE' ? 'PAUSE' : 'REVERT',
    pixEnabled: pix?.enabled === true,
    pixDiscountType: pix?.discountType === 'FIXED' ? 'FIXED' : 'PERCENT',
    pixDiscountValue: pix?.discountValue == null ? '' : String(pix.discountValue),
    cardEnabled: card?.enabled === true,
    cardPrice: card?.price == null ? '' : String(card.price),
    maxInstallments: String(card?.maxInstallments || 1),
    interestFreeInstallments: String(card?.interestFreeInstallments || 0),
    onlineEnabled: checkout?.enabled === true,
    inventoryMode: checkout?.stockQuantity == null ? 'UNLIMITED' : Number(checkout.stockQuantity) === 1 ? 'SINGLE' : 'TRACKED',
    pickup: checkout?.fulfillmentModes?.includes('PICKUP') ?? true,
    delivery: checkout?.fulfillmentModes?.includes('DELIVERY') ?? false,
    stockQuantity: checkout?.stockQuantity == null ? '' : String(checkout.stockQuantity),
    lowStockThreshold: checkout?.lowStockThreshold == null ? '' : String(checkout.lowStockThreshold),
    orderWhatsappE164: checkout?.orderWhatsappE164 || '',
  };
}

function fromShipping(raw: any): ShippingForm {
  return {
    inheritCompanySettings: raw?.inheritCompanySettings !== false,
    originLocationId: raw?.originLocationId || '',
    weightGrams: raw?.weightGrams == null ? '' : String(raw.weightGrams),
    lengthCm: raw?.lengthCm == null ? '' : String(raw.lengthCm),
    widthCm: raw?.widthCm == null ? '' : String(raw.widthCm),
    heightCm: raw?.heightCm == null ? '' : String(raw.heightCm),
    disableLocalPartners: raw?.disableLocalPartners === true,
    handlingType: ['FRAGILE','REFRIGERATED','LARGE','SPECIAL'].includes(String(raw?.handlingType || '').toUpperCase()) ? String(raw.handlingType).toUpperCase() as ShippingForm['handlingType'] : 'STANDARD',
    handlingNotes: raw?.handlingNotes || '',
  };
}

function calculatePreview(base: number | null, form: Form): ClassifiedEffectivePricing {
  const normal = Number(base);
  const promo = Number(form.promotionPrice);
  const now = Date.now();
  const starts = form.promotionStartsAt ? new Date(form.promotionStartsAt).getTime() : null;
  const ends = form.promotionEndsAt ? new Date(form.promotionEndsAt).getTime() : null;
  const promotionActive = Boolean(form.promotionEnabled && Number.isFinite(promo) && promo >= 0 && (starts == null || starts <= now) && (ends == null || ends > now));
  const current = promotionActive ? promo : normal;
  const discount = Number(form.pixDiscountValue || 0);
  const pixPrice = form.pixEnabled ? (form.pixDiscountType === 'FIXED' ? current - discount : current * (1 - discount / 100)) : current;
  const card = form.cardEnabled && form.cardPrice !== '' ? Number(form.cardPrice) : current;
  return { basePrice: Number.isFinite(normal) ? normal : null, currentPrice: Number.isFinite(current) ? Math.max(0, current) : null, promotionActive, promotionEndsAt: form.promotionEndsAt || null, pixPrice: Number.isFinite(pixPrice) ? Math.max(0, pixPrice) : null, cardPrice: Number.isFinite(card) ? Math.max(0, card) : null, maxInstallments: Number(form.maxInstallments || 1), interestFreeInstallments: Number(form.interestFreeInstallments || 0) };
}
function optionalNumber(value: string) { if (String(value).trim() === '') return null; const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; }
function money(value: unknown) { const n = Number(value); return Number.isFinite(n) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n) : '—'; }
function localToIso(value: string) { if (!value) return null; const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toISOString() : value; }
function isoToLocal(value: string | null | undefined) { if (!value) return ''; const d = new Date(value); if (!Number.isFinite(d.getTime())) return ''; const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatLocal(value: string) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : value; }
