import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, ReceiptText, RefreshCw, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Payment = {
  id: string;
  productCode?: string | null;
  productName?: string | null;
  amountCents?: number | null;
  originalAmountCents?: number | null;
  discountCents?: number | null;
  status?: string | null;
  method?: string | null;
  provider?: string | null;
  providerPaymentId?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  expiresAt?: string | null;
  isSimulation?: boolean;
  metadata?: Record<string, any> | string | null;
};

type CompanyPlanPayload = { company?: { id?: string; name?: string } };

function metadataOf(value: Payment['metadata']) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try { return JSON.parse(String(value || '{}')); } catch { return {}; }
}

function money(cents?: number | null) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

function statusLabel(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'PAID') return 'Pago';
  if (value === 'PENDING') return 'Pendente';
  if (value === 'CANCELED') return 'Cancelado';
  if (value === 'EXPIRED') return 'Expirado';
  if (value === 'REFUNDED') return 'Estornado';
  return status || '—';
}

function statusClass(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'PAID') return 'bg-emerald-50 text-emerald-700';
  if (value === 'PENDING') return 'bg-amber-50 text-amber-700';
  if (value === 'CANCELED' || value === 'EXPIRED') return 'bg-stone-100 text-stone-500';
  if (value === 'REFUNDED') return 'bg-sky-50 text-sky-700';
  return 'bg-stone-100 text-stone-600';
}

export default function CompanyFinancialTransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [plansResponse, paymentsResponse] = await Promise.all([
        api.get('/company/plans'),
        api.get('/payments/me'),
      ]);
      const planData = (plansResponse.data || {}) as CompanyPlanPayload;
      const companyId = String(planData.company?.id || '').trim();
      const companyName = String(planData.company?.name || 'Empresa').trim();
      if (!companyId) throw new Error('Empresa não identificada.');
      const all = Array.isArray(paymentsResponse.data) ? paymentsResponse.data as Payment[] : [];
      const scoped = all.filter((payment) => {
        const metadata = metadataOf(payment.metadata);
        return String(metadata.companyId || '') === companyId
          || String(payment.productCode || '').startsWith('COMPANY_');
      });
      setCompany({ id: companyId, name: companyName });
      setPayments(scoped);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Não foi possível carregar as transações da empresa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => ({
    paid: payments.filter((item) => String(item.status).toUpperCase() === 'PAID' && !item.isSimulation).reduce((sum, item) => sum + Number(item.amountCents || 0), 0),
    pending: payments.filter((item) => String(item.status).toUpperCase() === 'PENDING' && !item.isSimulation).reduce((sum, item) => sum + Number(item.amountCents || 0), 0),
    count: payments.filter((item) => !item.isSimulation).length,
  }), [payments]);

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando financeiro...</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">Business · Financeiro</p>
          <h1 className="mt-1 font-serif text-4xl font-black text-stone-950">Transações financeiras</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">O mesmo histórico financeiro da empresa acompanha você no Business e no Classificados Business.</p>
          {company && <p className="mt-1 text-xs font-bold text-stone-400">Conta financeira de {company.name}</p>}
        </div>
        <div className="flex gap-2">
          <Link to="/company/planos" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 text-xs font-black text-white"><WalletCards className="h-4 w-4" /> Planos e cobrança</Link>
          <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" /> Atualizar</button>
        </div>
      </header>

      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<ReceiptText className="h-5 w-5" />} label="Transações" value={String(summary.count)} />
        <Metric icon={<CreditCard className="h-5 w-5" />} label="Pagamentos confirmados" value={money(summary.paid)} />
        <Metric icon={<WalletCards className="h-5 w-5" />} label="Aguardando pagamento" value={money(summary.pending)} />
      </section>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-stone-200">
        <div className="border-b border-stone-100 px-5 py-4 sm:px-6"><h2 className="font-serif text-xl font-black">Histórico da empresa</h2><p className="mt-1 text-xs text-stone-500">Assinaturas, compras avulsas e demais cobranças Business iniciadas por esta conta.</p></div>
        {!payments.length ? (
          <div className="px-6 py-14 text-center"><ReceiptText className="mx-auto h-9 w-9 text-stone-300" /><p className="mt-3 text-sm font-black text-stone-700">Nenhuma transação Business registrada.</p><p className="mt-1 text-xs text-stone-400">Quando houver uma compra ou assinatura da empresa, ela aparece aqui.</p></div>
        ) : (
          <div className="divide-y divide-stone-100">
            {payments.map((payment) => {
              const metadata = metadataOf(payment.metadata);
              return (
                <article key={payment.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_150px_140px] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-stone-900">{payment.productName || metadata.companyPlan ? payment.productName || `Plano ${metadata.companyPlan}` : payment.productCode || 'Cobrança Business'}</p>{payment.isSimulation && <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700">SIMULAÇÃO</span>}</div>
                    <p className="mt-1 text-[11px] text-stone-400">{dateTime(payment.createdAt)} · {payment.provider || 'Provedor a definir'}{payment.providerPaymentId ? ` · ${payment.providerPaymentId}` : ''}</p>
                  </div>
                  <div><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${statusClass(payment.status)}`}>{statusLabel(payment.status)}</span>{payment.paidAt && <p className="mt-1 text-[10px] text-stone-400">Pago em {dateTime(payment.paidAt)}</p>}</div>
                  <div className="sm:text-right"><p className="text-base font-black text-stone-950">{money(payment.amountCents)}</p>{Number(payment.discountCents || 0) > 0 && <p className="text-[10px] font-bold text-emerald-600">Economia {money(payment.discountCents)}</p>}</div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-stone-200"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e7f2ef] text-[#276b64]">{icon}</div><p className="mt-4 text-[10px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-1 text-2xl font-black text-stone-950">{value}</p></div>;
}
