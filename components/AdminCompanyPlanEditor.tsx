import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CalendarDays, Loader2, Save, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { AdminCompanyMembershipManager } from './AdminCompanyMembershipManager';

type CompanyPlan = 'FREE' | 'PLUS' | 'ELITE';

type PlanPayload = {
  company?: { id: string; name: string };
  current?: {
    plan?: CompanyPlan;
    basePlan?: CompanyPlan;
    status?: string;
    currentPeriodEnd?: string | null;
    paidCurrentPeriodEnd?: string | null;
    isTrial?: boolean;
    trialEndsAt?: string | null;
    provider?: string | null;
    isSimulation?: boolean;
  };
  plans?: Array<{ id: CompanyPlan; name: string; priceCents?: number }>;
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function defaultEndDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toDateInput(date.toISOString());
}

function money(cents = 0) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AdminCompanyPlanEditor({ companyId, companyName }: { companyId: string; companyName?: string }) {
  const [data, setData] = useState<PlanPayload | null>(null);
  const [plan, setPlan] = useState<CompanyPlan>('FREE');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/company-plans/${companyId}`);
      const payload = response.data || {};
      setData(payload);
      const current = payload.current || {};
      const effectivePlan = (current.isTrial ? current.plan : current.basePlan || current.plan || 'FREE') as CompanyPlan;
      setPlan(effectivePlan || 'FREE');
      setCurrentPeriodEnd(toDateInput(current.paidCurrentPeriodEnd || current.currentPeriodEnd));
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível carregar o plano da empresa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [companyId]);

  const prices = useMemo(() => {
    const map = new Map<CompanyPlan, number>();
    for (const item of data?.plans || []) map.set(item.id, Number(item.priceCents || 0));
    return map;
  }, [data?.plans]);

  const save = async () => {
    if (saving) return;
    if (plan !== 'FREE' && !currentPeriodEnd) {
      setMessage('Informe até quando o plano ficará ativo.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const end = plan === 'FREE' ? null : new Date(`${currentPeriodEnd}T23:59:59-03:00`).toISOString();
      const response = await api.patch(`/admin/company-plans/${companyId}`, { plan, currentPeriodEnd: end });
      setData(response.data || null);
      setMessage(plan === 'FREE' ? 'Empresa movida para o plano Free.' : `Plano ${plan} aplicado administrativamente.`);
      const current = response.data?.current || {};
      setPlan((current.basePlan || current.plan || plan) as CompanyPlan);
      setCurrentPeriodEnd(toDateInput(current.paidCurrentPeriodEnd || current.currentPeriodEnd));
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível alterar o plano da empresa.');
    } finally {
      setSaving(false);
    }
  };

  const current = data?.current || {};
  const currentLabel = current.isTrial ? 'Elite em teste' : (current.basePlan || current.plan || 'FREE');

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-violet-600">Assinatura empresarial</p>
            <h3 className="mt-1 flex items-center gap-2 font-bold text-stone-950"><Sparkles className="h-4 w-4 text-violet-600" /> Plano da empresa</h3>
            <p className="mt-1 text-xs leading-5 text-stone-600">{companyName || data?.company?.name} está atualmente em <strong>{currentLabel}</strong>. Alterações feitas aqui são administrativas e não geram cobrança.</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-black text-violet-700 ring-1 ring-violet-200"><BadgeCheck className="h-3.5 w-3.5" /> {current.status || 'FREE'}</span>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-violet-100 bg-white/70 p-4 text-xs font-semibold text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando plano da empresa...</div>
        ) : (
          <>
            {current.isTrial && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Teste Elite ativo até {current.trialEndsAt ? new Date(current.trialEndsAt).toLocaleDateString('pt-BR') : 'a data configurada'}. Ao salvar um plano manualmente, o teste é encerrado e a escolha administrativa passa a valer.</div>}

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-500">Plano</span>
                <select value={plan} onChange={(event) => { const next = event.target.value as CompanyPlan; setPlan(next); if (next !== 'FREE' && !currentPeriodEnd) setCurrentPeriodEnd(defaultEndDate()); }} className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold outline-none focus:border-violet-400">
                  <option value="FREE">Free · {money(prices.get('FREE') || 0)}</option>
                  <option value="PLUS">Plus · {money(prices.get('PLUS') || 0)}/mês</option>
                  <option value="ELITE">Elite · {money(prices.get('ELITE') || 0)}/mês</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-500">Válido até</span>
                <div className="relative mt-1"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input type="date" disabled={plan === 'FREE'} value={plan === 'FREE' ? '' : currentPeriodEnd} onChange={(event) => setCurrentPeriodEnd(event.target.value)} className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm font-bold outline-none disabled:bg-stone-100 disabled:text-stone-400" /></div>
              </label>

              <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar plano</button>
            </div>

            {message && <p className="mt-3 text-xs font-bold text-violet-800">{message}</p>}
            <p className="mt-3 text-[10px] leading-4 text-stone-500">Override administrativo: não cria Pix, não entra como receita e fica marcado internamente como concessão administrativa.</p>
          </>
        )}
      </section>

      <AdminCompanyMembershipManager companyId={companyId} companyName={companyName || data?.company?.name} />
    </div>
  );
}
