import React, { useEffect, useState } from 'react';
import { Loader2, Package, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type InventoryItem = {
  id: string;
  title: string;
  status: string;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  onlineCheckoutEnabled: boolean;
};

export default function ClassifiedsInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/classifieds/me/inventory');
      const rows = Array.isArray(response.data) ? response.data : [];
      setItems(rows);
      setDrafts(Object.fromEntries(rows.map((item: InventoryItem) => [item.id, item.stockQuantity == null ? '' : String(item.stockQuantity)])));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar o estoque.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const save = async (item: InventoryItem) => {
    const value = drafts[item.id] ?? '';
    if (value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0)) {
      setError('Informe uma quantidade inteira igual ou maior que zero.');
      return;
    }
    setSaving(item.id); setError('');
    try {
      const response = await api.patch(`/classifieds/me/inventory/${item.id}`, { stockQuantity: value === '' ? null : Number(value) });
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, ...response.data } : row));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível atualizar o estoque.');
    } finally { setSaving(null); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;
  return <div className="mx-auto max-w-5xl space-y-5">
    <header><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#37756f]">Business</p><h1 className="mt-1 font-serif text-3xl font-black">Estoque</h1><p className="mt-2 text-sm leading-6 text-stone-500">Atualize as quantidades sem abrir produto por produto. Deixe vazio para não limitar as vendas.</p></header>
    {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    {items.length ? <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-stone-200">{items.map((item) => <div key={item.id} className="flex flex-col gap-3 border-b border-stone-100 p-4 last:border-0 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf5f3] text-[#276b64]"><Package className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-black text-stone-900">{item.title}</p><p className="mt-1 text-[10px] font-bold text-stone-400">{item.status === 'PUBLISHED' ? 'Publicado' : item.status} {item.onlineCheckoutEnabled ? '· compra online' : '· somente vitrine'}</p></div></div><div className="flex items-center gap-2"><label className="min-w-0"><span className="sr-only">Estoque de {item.title}</span><input value={drafts[item.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} type="number" min="0" placeholder="Sem limite" className="h-10 w-28 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-bold outline-none focus:border-stone-400" /></label><button type="button" onClick={() => void save(item)} disabled={saving === item.id} className="flex h-10 items-center gap-2 rounded-xl bg-stone-900 px-3 text-xs font-black text-white disabled:opacity-50">{saving === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button><Link to={`/classificados/publicar?edit=${item.id}`} className="rounded-xl bg-stone-100 px-3 py-2.5 text-xs font-black text-stone-600">Editar</Link></div></div>)}</div> : <div className="rounded-[24px] border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">Você ainda não tem produtos para controlar. <Link to="/classificados/publicar" className="font-black underline">Criar produto</Link></div>}
  </div>;
}
