import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, MapPin, PackageCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import type { ClassifiedListing } from '../../types/classifieds';

type SavedAddress = {
  id: string;
  label: string;
  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
  active: boolean;
};

type FreightOption = {
  partnerId: string;
  partnerName: string;
  partnerType: string;
  eligible: boolean;
  reason?: string;
  amountCents?: number;
  estimatedMinutes?: number | null;
  distanceMeters?: number | null;
};

type QuoteResponse = {
  destination?: { zipCode?: string; street?: string; neighborhood?: string; city?: string; state?: string };
  distanceMeters?: number | null;
  options?: FreightOption[];
};

export function ClassifiedFreightCalculator({ listing }: { listing: ClassifiedListing }) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canCalculate = listing.listingType === 'PRODUCT' && Boolean(listing.companyId);
  const activeAddresses = useMemo(() => addresses.filter((item) => item.active), [addresses]);

  useEffect(() => {
    if (!user || !canCalculate) {
      setAddresses([]);
      setSelectedAddressId('');
      return;
    }
    let active = true;
    api.get('/classifieds/commerce/addresses')
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response.data) ? response.data.filter((item: SavedAddress) => item.active) : [];
        setAddresses(rows);
        const preferred = rows.find((item: SavedAddress) => item.isDefault) || rows[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setZipCode(formatCep(preferred.zipCode));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user, canCalculate, listing.id]);

  const selectSavedAddress = (id: string) => {
    setSelectedAddressId(id);
    const address = activeAddresses.find((item) => item.id === id);
    if (address) setZipCode(formatCep(address.zipCode));
    setQuote(null); setError('');
  };

  const calculate = async () => {
    const cep = digits(zipCode);
    setError(''); setQuote(null);
    if (cep.length !== 8) {
      setError('Informe um CEP com 8 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post(`/classifieds/listings/${listing.id}/shipping-quote`, { zipCode: cep, quantity: 1 });
      setQuote(response.data || {});
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível calcular o frete para este CEP.');
    } finally {
      setLoading(false);
    }
  };

  if (!canCalculate) return null;

  const eligible = quote?.options?.filter((item) => item.eligible) || [];
  const unavailable = quote?.options?.filter((item) => !item.eligible) || [];

  return (
    <section className="mt-5 rounded-[24px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef6f4] text-[#276b64]"><Truck className="h-5 w-5" /></div>
        <div>
          <h2 className="font-serif text-xl font-bold tracking-[-.02em]">Calcular frete</h2>
          <p className="mt-1 text-xs leading-5 text-[#806b60]">Informe o CEP para consultar as entregas locais disponíveis. Você não precisa estar logado para apenas consultar.</p>
        </div>
      </div>

      {activeAddresses.length > 0 && <div className="mt-4">
        <label className="text-[9px] font-black uppercase tracking-[.12em] text-[#9b8275]">Endereço salvo</label>
        <select value={selectedAddressId} onChange={(event) => selectSavedAddress(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[#4b3328]/10 bg-white px-3 text-sm font-bold text-[#4e3b32]">
          {activeAddresses.map((item) => <option key={item.id} value={item.id}>{item.isDefault ? 'Padrão · ' : ''}{item.label} · {item.city}/{item.state} · {formatCep(item.zipCode)}</option>)}
        </select>
      </div>}

      <div className="mt-4 flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          value={zipCode}
          onChange={(event) => { setZipCode(formatCep(event.target.value)); setSelectedAddressId(''); setQuote(null); setError(''); }}
          onKeyDown={(event) => { if (event.key === 'Enter') void calculate(); }}
          placeholder="Digite seu CEP"
          className="h-11 min-w-0 flex-1 rounded-xl border border-[#4b3328]/10 bg-[#fbfaf8] px-3 text-sm font-bold outline-none focus:border-[#8fbeb8]"
        />
        <button type="button" disabled={loading || digits(zipCode).length !== 8} onClick={() => void calculate()} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2d211c] px-4 text-xs font-black text-white disabled:opacity-45">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Calcular
        </button>
      </div>

      {user && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-[#806b60]">
        <span>{activeAddresses.length ? 'Você pode usar o padrão ou digitar outro CEP só para consultar.' : 'Você ainda não tem endereço salvo.'}</span>
        <Link to="/classificados/logistica" className="font-black text-[#a84f34] hover:underline">Gerenciar endereços</Link>
      </div>}

      {error && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{error}</p>}

      {quote && <div className="mt-4 space-y-3">
        {quote.destination?.city && <div className="flex items-center gap-2 rounded-xl bg-[#fbfaf8] px-3 py-2 text-xs font-bold text-[#604c42]"><MapPin className="h-4 w-4 text-[#c96847]" />Entrega para {quote.destination.city}/{quote.destination.state} · {formatCep(quote.destination.zipCode || zipCode)}</div>}
        {eligible.length > 0 ? eligible.map((option) => <div key={option.partnerId} className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 p-4 ring-1 ring-emerald-100">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700"><PackageCheck className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-black text-emerald-950">{option.partnerName}</p><p className="mt-0.5 text-[10px] font-bold text-emerald-700">{partnerLabel(option.partnerType)}{option.distanceMeters != null ? ` · ${(option.distanceMeters / 1000).toFixed(1).replace('.', ',')} km` : ''}</p></div>
          <div className="text-right"><p className="text-base font-black text-emerald-900">{money(option.amountCents || 0)}</p>{option.estimatedMinutes != null && <p className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700"><Clock3 className="h-3 w-3" />~{option.estimatedMinutes} min</p>}</div>
        </div>) : <p className="rounded-xl bg-stone-50 px-3 py-3 text-xs font-bold text-stone-600">Nenhuma modalidade de entrega está disponível para este CEP.</p>}
        {eligible.length === 0 && unavailable.length > 0 && <div className="space-y-1">{unavailable.slice(0, 3).map((option) => <p key={option.partnerId} className="text-[10px] text-stone-500"><strong>{option.partnerName}:</strong> {option.reason || 'indisponível'}</p>)}</div>}
      </div>}
    </section>
  );
}

function digits(value: unknown) { return String(value || '').replace(/\D/g, ''); }
function formatCep(value: unknown) { const clean = digits(value).slice(0, 8); return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean; }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100); }
function partnerLabel(value: string) { return value === 'MOTOBOY' ? 'Motoboy' : value === 'BIKE' ? 'Bike' : value === 'TRANSPORTADORA' ? 'Transportadora' : 'Entrega'; }
