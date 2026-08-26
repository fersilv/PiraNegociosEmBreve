import React, { useEffect, useState } from 'react';
import { Building2, CreditCard, Loader2, MapPin, QrCode, Save, Truck, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const defaultState = {
  companyId: '',
  companyVerified: false,
  companyAddress: '',
  pixEnabled: true,
  cardEnabled: true,
  cardMaxInstallments: 12,
  auctionFeePayerDefault: 'SELLER' as 'SELLER' | 'BUYER',
  pickupEnabled: true,
  deliveryEnabled: false,
  arrangeEnabled: true,
  mercadoPagoConnected: false,
};

export default function ClassifiedsReceiptPreferencesPage() {
  const [form, setForm] = useState(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/classifieds/me/payments/receipt-preferences')
      .then((response) => setForm((current) => ({ ...current, ...(response.data || {}) })))
      .catch((error) => setMessage(error?.response?.data?.message || 'Não foi possível carregar as formas de recebimento.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form.pixEnabled && !form.cardEnabled) {
      setMessage('Habilite pelo menos Pix ou cartão.');
      return;
    }
    if (!form.pickupEnabled && !form.deliveryEnabled && !form.arrangeEnabled) {
      setMessage('Habilite pelo menos retirada, entrega ou a combinar.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await api.patch('/classifieds/me/payments/receipt-preferences', {
        pixEnabled: form.pixEnabled,
        cardEnabled: form.cardEnabled,
        cardMaxInstallments: form.cardMaxInstallments,
        auctionFeePayerDefault: form.auctionFeePayerDefault,
        pickupEnabled: form.pickupEnabled,
        deliveryEnabled: form.deliveryEnabled,
        arrangeEnabled: form.arrangeEnabled,
      });
      setForm((current) => ({ ...current, ...(response.data || {}) }));
      setMessage('Formas de recebimento salvas. Novas vendas e leilões podem usar estas escolhas como padrão.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível salvar agora.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">Business · pagamentos</p>
        <h1 className="mt-1 font-serif text-3xl font-black text-stone-950">Formas de recebimento</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Escolha o que sua empresa deseja oferecer no PiraNegócios. O Mercado Pago continua sendo a conta recebedora e valida a disponibilidade técnica de cada meio.</p>
      </header>

      {message && <div className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">{message}</div>}

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf7fd] text-[#009ee3]"><WalletCards className="h-5 w-5" /></span><div><h2 className="font-black">Mercado Pago</h2><p className="mt-0.5 text-xs text-stone-500">Conta da empresa que recebe as vendas e arremates online.</p></div></div>
          {form.mercadoPagoConnected ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700">Conectado</span> : <Link to="/classificados/vendas" className="rounded-xl bg-[#009ee3] px-4 py-2.5 text-xs font-black text-white">Conectar Mercado Pago</Link>}
        </div>
        <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">As tarifas cobradas pelo próprio Mercado Pago, disponibilidade de cartão e regras da conta continuam sendo definidas pelo provedor. Aqui você decide quais opções deseja disponibilizar aos clientes do PiraNegócios.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ToggleCard icon={<QrCode className="h-5 w-5" />} title="Pix" text="Permitir pagamento por Pix nas vendas e arremates online." checked={form.pixEnabled} onChange={(value) => setForm((current) => ({ ...current, pixEnabled: value }))} />
        <div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <ToggleLine icon={<CreditCard className="h-5 w-5" />} title="Cartão" text="Permitir cartão quando a conta Mercado Pago suportar." checked={form.cardEnabled} onChange={(value) => setForm((current) => ({ ...current, cardEnabled: value }))} />
          {form.cardEnabled && <label className="mt-5 block"><span className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Máximo de parcelas oferecidas</span><select value={form.cardMaxInstallments} onChange={(event) => setForm((current) => ({ ...current, cardMaxInstallments: Number(event.target.value) }))} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold">{Array.from({ length: 24 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>até {value}x</option>)}</select><p className="mt-2 text-[10px] leading-4 text-stone-400">É um teto do PiraNegócios. O Mercado Pago pode oferecer menos parcelas conforme cartão, conta e condições do pagamento.</p></label>}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Building2 className="h-5 w-5" /></span><div><h2 className="font-black">Taxa de leilão</h2><p className="mt-0.5 text-xs text-stone-500">Padrão para novos leilões. Cada leilão pode alterar esta escolha.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Choice checked={form.auctionFeePayerDefault === 'SELLER'} title="A empresa absorve" text="O arrematante paga o lance vencedor e eventual entrega. A comissão do leilão sai do líquido da empresa." onClick={() => setForm((current) => ({ ...current, auctionFeePayerDefault: 'SELLER' }))} />
          <Choice checked={form.auctionFeePayerDefault === 'BUYER'} title="Repassar ao arrematante" text="O leilão mostra antes dos lances que o valor vencedor receberá a taxa PiraNegócios configurada no Admin." onClick={() => setForm((current) => ({ ...current, auctionFeePayerDefault: 'BUYER' }))} />
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><MapPin className="h-5 w-5" /></span><div><h2 className="font-black">Entrega e retirada</h2><p className="mt-0.5 text-xs leading-5 text-stone-500">Para empresas, o endereço cadastrado é a referência oficial de retirada.</p></div></div>
        <div className="mt-4 rounded-2xl bg-stone-50 p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Endereço da empresa</p><p className="mt-1 text-sm font-bold text-stone-800">{form.companyAddress || 'Complete o endereço no perfil da empresa.'}</p><Link to="/company/perfil" className="mt-2 inline-flex text-xs font-black text-[#397c75]">Editar endereço da empresa</Link></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Choice checked={form.pickupEnabled} title="Retirada" text="Exibe o endereço comercial cadastrado." onClick={() => setForm((current) => ({ ...current, pickupEnabled: !current.pickupEnabled }))} />
          <Choice checked={form.deliveryEnabled} title="Entrega" text="Permite combinar ou cobrar entrega quando aplicável." onClick={() => setForm((current) => ({ ...current, deliveryEnabled: !current.deliveryEnabled }))} />
          <Choice checked={form.arrangeEnabled} title="A combinar" text="Cliente e empresa acertam a logística no chat." onClick={() => setForm((current) => ({ ...current, arrangeEnabled: !current.arrangeEnabled }))} />
        </div>
      </section>

      <button onClick={() => void save()} disabled={saving} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0d4542] px-5 text-sm font-black text-white disabled:opacity-50 sm:w-auto">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar formas de recebimento</button>
    </div>
  );
}

function ToggleCard(props: { icon: React.ReactNode; title: string; text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-stone-200"><ToggleLine {...props} /></div>;
}

function ToggleLine({ icon, title, text, checked, onChange }: { icon: React.ReactNode; title: string; text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">{icon}</span><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-stone-500">{text}</p></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full ${checked ? 'bg-[#2f8b7d]' : 'bg-stone-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} /></button></div>;
}

function Choice({ checked, title, text, onClick }: { checked: boolean; title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${checked ? 'border-[#2f8b7d] bg-[#eef8f6] ring-2 ring-[#2f8b7d]/10' : 'border-stone-200 bg-white hover:bg-stone-50'}`}><span className="flex items-center justify-between gap-3"><strong className="text-sm">{title}</strong><span className={`h-4 w-4 rounded-full border-4 ${checked ? 'border-[#2f8b7d] bg-white' : 'border-stone-300'}`} /></span><span className="mt-2 block text-xs leading-5 text-stone-500">{text}</span></button>;
}
