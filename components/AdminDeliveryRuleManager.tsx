import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';

type Partner = { id: string; name: string };
type Rule = {
  id: string;
  priority?: number | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  zipCodeStart?: string | null;
  zipCodeEnd?: string | null;
  minDistanceMeters?: number | null;
  maxDistanceMeters?: number | null;
  fixedPriceCents?: number | null;
  minimumPriceCents?: number | null;
  perKmCents?: number | null;
  roundTripAdditionalCents?: number | null;
  weightAdditionalPerKgCents?: number | null;
  maxWeightGrams?: number | null;
  maxLengthCm?: number | null;
  maxWidthCm?: number | null;
  maxHeightCm?: number | null;
  maxVolumeCm3?: number | null;
  estimatedMinutes?: number | null;
};
type RateTable = { id: string; version: number; name: string; active: boolean; rules?: Rule[] };

type EditForm = {
  priority: string;
  state: string;
  city: string;
  neighborhood: string;
  zipCodeStart: string;
  zipCodeEnd: string;
  minDistanceKm: string;
  maxDistanceKm: string;
  fixedPrice: string;
  minimumPrice: string;
  perKm: string;
  roundTripAdditional: string;
  estimatedMinutes: string;
};

export function AdminDeliveryRuleManager() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [tables, setTables] = useState<RateTable[]>([]);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedPartner = useMemo(() => partners.find((item) => item.id === partnerId) || null, [partners, partnerId]);

  useEffect(() => { void loadPartners(); }, []);
  useEffect(() => {
    if (partnerId) void loadTables(partnerId);
    else setTables([]);
  }, [partnerId]);

  const loadPartners = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/classifieds-delivery/partners');
      const items = Array.isArray(response.data) ? response.data : [];
      setPartners(items);
      setPartnerId((current) => current || String(items[0]?.id || ''));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os parceiros.');
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async (id: string) => {
    setError('');
    try {
      const response = await api.get(`/admin/classifieds-delivery/partners/${id}/rate-tables`);
      setTables(Array.isArray(response.data) ? response.data : []);
    } catch (requestError: any) {
      setTables([]);
      setError(requestError?.response?.data?.message || 'Não foi possível carregar as regras de preço.');
    }
  };

  const beginEdit = (rule: Rule) => {
    setEditing(rule);
    setForm(formFromRule(rule));
    setError('');
    setNotice('');
  };

  const save = async () => {
    if (!editing || !form || !partnerId || working) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await api.put(`/admin/classifieds-delivery/rate-rules/${editing.id}`, {
        priority: integer(form.priority, 100),
        state: textOrNull(form.state)?.toUpperCase() || null,
        city: textOrNull(form.city),
        neighborhood: textOrNull(form.neighborhood),
        zipCodeStart: digits(form.zipCodeStart),
        zipCodeEnd: digits(form.zipCodeEnd),
        minDistanceMeters: kmToMeters(form.minDistanceKm),
        maxDistanceMeters: kmToMeters(form.maxDistanceKm),
        fixedPriceCents: moneyToCents(form.fixedPrice),
        minimumPriceCents: moneyToCents(form.minimumPrice) || 0,
        perKmCents: moneyToCents(form.perKm) || 0,
        roundTripAdditionalCents: moneyToCents(form.roundTripAdditional) || 0,
        weightAdditionalPerKgCents: editing.weightAdditionalPerKgCents || 0,
        maxWeightGrams: editing.maxWeightGrams ?? null,
        maxLengthCm: editing.maxLengthCm ?? null,
        maxWidthCm: editing.maxWidthCm ?? null,
        maxHeightCm: editing.maxHeightCm ?? null,
        maxVolumeCm3: editing.maxVolumeCm3 ?? null,
        estimatedMinutes: nullableInteger(form.estimatedMinutes),
      });
      await loadTables(partnerId);
      setEditing(null);
      setForm(null);
      setNotice('Regra de entrega atualizada.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível atualizar a regra.');
    } finally {
      setWorking(false);
    }
  };

  const remove = async (rule: Rule) => {
    if (!partnerId || working) return;
    if (!window.confirm('Excluir esta regra de preço? Essa ação só é permitida se ela ainda não tiver sido usada em uma cotação.')) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await api.delete(`/admin/classifieds-delivery/rate-rules/${rule.id}`);
      if (editing?.id === rule.id) { setEditing(null); setForm(null); }
      await loadTables(partnerId);
      setNotice('Regra excluída.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível excluir a regra.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="mx-auto mt-6 max-w-[1500px] rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">Preços · manutenção</p>
          <h2 className="mt-1 font-serif text-3xl font-black">Gerenciar regras existentes</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-stone-500">Edite uma regra criada por engano ou exclua uma regra ainda não utilizada. Regras que já participaram de cotações ficam preservadas para manter o histórico íntegro.</p>
        </div>
        <button type="button" onClick={() => partnerId && void loadTables(partnerId)} disabled={!partnerId || working} className="inline-flex h-10 items-center gap-2 rounded-xl bg-stone-100 px-4 text-xs font-black text-stone-700 disabled:opacity-40">
          <RefreshCw className="h-4 w-4" /> Atualizar regras
        </button>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}

      {loading ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : (
        <>
          <label className="mt-5 block max-w-xl">
            <span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">Parceiro</span>
            <select value={partnerId} onChange={(event) => { setPartnerId(event.target.value); setEditing(null); setForm(null); }} className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold outline-none">
              {!partners.length && <option value="">Nenhum parceiro cadastrado</option>}
              {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
            </select>
          </label>

          <div className="mt-5 space-y-4">
            {tables.map((table) => (
              <div key={table.id} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-black">v{table.version} · {table.name}</p><p className="mt-1 text-[9px] font-bold text-stone-400">{table.active ? 'ATIVA' : 'INATIVA'} · {table.rules?.length || 0} regra(s)</p></div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[9px] font-black text-stone-500 ring-1 ring-stone-200">{selectedPartner?.name}</span>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {(table.rules || []).map((rule) => (
                    <article key={rule.id} className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1"><p className="text-xs font-black text-stone-800">{ruleWhere(rule)}</p><p className="mt-1 text-[10px] font-bold text-stone-400">{rulePrice(rule)}{rule.estimatedMinutes ? ` · ~${rule.estimatedMinutes} min` : ''}</p></div>
                        <button type="button" onClick={() => beginEdit(rule)} disabled={working} title="Editar regra" className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700 disabled:opacity-40"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => void remove(rule)} disabled={working} title="Excluir regra" className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </article>
                  ))}
                  {!table.rules?.length && <p className="col-span-full py-4 text-center text-xs font-bold text-stone-400">Nenhuma regra nesta tabela.</p>}
                </div>
              </div>
            ))}
            {partnerId && !tables.length && <div className="rounded-2xl border border-dashed border-stone-300 px-5 py-8 text-center text-xs font-bold text-stone-400">Este parceiro ainda não possui tabela de preço.</div>}
          </div>
        </>
      )}

      {editing && form && (
        <div className="mt-6 rounded-3xl bg-[#fff8f4] p-5 ring-1 ring-[#ead5ca]">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#b06448]">Editando regra</p><p className="mt-1 text-sm font-black">{ruleWhere(editing)}</p></div><button type="button" onClick={() => { setEditing(null); setForm(null); }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-stone-500 ring-1 ring-stone-200"><X className="h-4 w-4" /></button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <EditField label="Prioridade" type="number" value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} />
            <EditField label="UF" value={form.state} onChange={(value) => setForm({ ...form, state: value.slice(0, 2).toUpperCase() })} />
            <EditField label="Cidade" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
            <EditField label="Bairro" value={form.neighborhood} onChange={(value) => setForm({ ...form, neighborhood: value })} />
            <EditField label="CEP inicial" value={form.zipCodeStart} onChange={(value) => setForm({ ...form, zipCodeStart: formatZip(value) })} />
            <EditField label="CEP final" value={form.zipCodeEnd} onChange={(value) => setForm({ ...form, zipCodeEnd: formatZip(value) })} />
            <EditField label="De (km)" type="number" value={form.minDistanceKm} onChange={(value) => setForm({ ...form, minDistanceKm: value })} />
            <EditField label="Até (km)" type="number" value={form.maxDistanceKm} onChange={(value) => setForm({ ...form, maxDistanceKm: value })} />
            <EditField label="Fixo (R$)" value={form.fixedPrice} onChange={(value) => setForm({ ...form, fixedPrice: value })} />
            <EditField label="Mínimo (R$)" value={form.minimumPrice} onChange={(value) => setForm({ ...form, minimumPrice: value })} />
            <EditField label="Por km (R$)" value={form.perKm} onChange={(value) => setForm({ ...form, perKm: value })} />
            <EditField label="Ida/volta + (R$)" value={form.roundTripAdditional} onChange={(value) => setForm({ ...form, roundTripAdditional: value })} />
            <EditField label="Estimativa (min)" type="number" value={form.estimatedMinutes} onChange={(value) => setForm({ ...form, estimatedMinutes: value })} />
          </div>
          <button type="button" disabled={working} onClick={() => void save()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-stone-950 px-5 text-xs font-black text-white disabled:opacity-40"><Save className="h-4 w-4" />{working ? 'Salvando...' : 'Salvar alterações'}</button>
        </div>
      )}
    </section>
  );
}

function EditField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#8fbeb8]" /></label>;
}

function formFromRule(rule: Rule): EditForm {
  return {
    priority: String(rule.priority ?? 100),
    state: rule.state || '',
    city: rule.city || '',
    neighborhood: rule.neighborhood || '',
    zipCodeStart: formatZip(rule.zipCodeStart),
    zipCodeEnd: formatZip(rule.zipCodeEnd),
    minDistanceKm: rule.minDistanceMeters == null ? '' : String(Number(rule.minDistanceMeters) / 1000),
    maxDistanceKm: rule.maxDistanceMeters == null ? '' : String(Number(rule.maxDistanceMeters) / 1000),
    fixedPrice: centsToInput(rule.fixedPriceCents),
    minimumPrice: centsToInput(rule.minimumPriceCents),
    perKm: centsToInput(rule.perKmCents),
    roundTripAdditional: centsToInput(rule.roundTripAdditionalCents),
    estimatedMinutes: rule.estimatedMinutes == null ? '' : String(rule.estimatedMinutes),
  };
}

function ruleWhere(rule: Rule) {
  if (rule.neighborhood) return `${rule.neighborhood} · ${rule.city || ''}/${rule.state || ''}`;
  if (rule.zipCodeStart || rule.zipCodeEnd) return `CEP ${formatZip(rule.zipCodeStart)} a ${formatZip(rule.zipCodeEnd)}`;
  if (rule.minDistanceMeters != null || rule.maxDistanceMeters != null) return `${Number(rule.minDistanceMeters || 0) / 1000} a ${rule.maxDistanceMeters == null ? '∞' : Number(rule.maxDistanceMeters) / 1000} km`;
  if (rule.city) return `${rule.city}/${rule.state || ''}`;
  return 'Regra geral';
}

function rulePrice(rule: Rule) {
  if (rule.fixedPriceCents != null) return money(rule.fixedPriceCents);
  if (Number(rule.perKmCents || 0) > 0) return `${money(rule.perKmCents)}/km`;
  return `mín. ${money(rule.minimumPriceCents)}`;
}

function money(value: unknown) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0) / 100); }
function centsToInput(value: unknown) { return value == null ? '' : (Number(value) / 100).toFixed(2).replace('.', ','); }
function textOrNull(value: unknown) { return String(value || '').trim() || null; }
function integer(value: unknown, fallback: number) { const parsed = Math.round(Number(value)); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableInteger(value: unknown) { if (value === '' || value == null) return null; const parsed = Math.round(Number(value)); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
function moneyToCents(value: unknown) { if (value === '' || value == null) return null; const parsed = Number(String(value).replace(',', '.')); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null; }
function kmToMeters(value: unknown) { if (value === '' || value == null) return null; const parsed = Number(String(value).replace(',', '.')); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 1000) : null; }
function digits(value: unknown) { return String(value || '').replace(/\D/g, '').slice(0, 8) || null; }
function formatZip(value: unknown) { const clean = String(value || '').replace(/\D/g, '').slice(0, 8); return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean; }
