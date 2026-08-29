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
  complement?: string | null;
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
  distanceSource?: string;
};

type QuoteResponse = {
  destination?: { zipCode?: string; street?: string; number?: string | null; neighborhood?: string; city?: string; state?: string };
  distanceMeters?: number | null;
  distanceSource?: string;
  routeCacheHit?: boolean;
  options?: FreightOption[];
};

export function ClassifiedFreightCalculator({ listing, embedded = false }: { listing: ClassifiedListing; embedded?: boolean }) {
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
    setQuote(null);
    setError('');
  };

  const calculate = async () => {
    const cep = digits(zipCode);
    setError('');
    setQuote(null);
    if (cep.length !== 8) {
      setError('Informe um CEP com 8 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const selectedAddress = activeAddresses.find((item) => item.id === selectedAddressId && digits(item.zipCode) === cep);
      const response = await api.post(`/classifieds/listings/${listing.id}/shipping-quote`, {
        zipCode: cep,
        quantity: 1,
        destinationAddress: selectedAddress ? {
          street: selectedAddress.street,
          number: selectedAddress.number,
          complement: selectedAddress.complement || '',
          neighborhood: selectedAddress.neighborhood,
        } : undefined,
      });
      setQuote(response.data || {});
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      setError(typeof message === 'string' ? message : message?.message || 'Não foi possível calcular o frete para este CEP.');
    } finally {
      setLoading(false);
    }
  };

  if (!canCalculate) return null;

  const eligible = quote?.options?.filter((item) => item.eligible) || [];
  const unavailable = quote?.options?.filter((item) => !item.eligible) || [];
  const shellClass = embedded
    ? 'mt-4 border-t border-stone-100 pt-4'
    : 'mt-5 rounded-[24px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7';

  return (
    <section className={shellClass}>
      <div className="flex items-start gap-3">
        <div className={`flex shrink-0 items-center justify-center bg-[#eef6f4] text-[#276b64] ${embedded ? 'h-9 w-9 rounded-xl' : 'h-10 w-10 rounded-2xl'}`}><Truck className="h-5 w-5" /></div>
        <div>
          <h2 className={`${embedded ? 'text-sm' : 'font-serif text-xl'} font-black tracking-[-.02em]`}>Calcular frete</h2>
          <p className="mt-1 text-[11px] leading-5 text-[#806b60]">Informe o CEP para consultar as entregas disponíveis.</p>
        </div>
      </div>

      {activeAddresses.length > 0 && <div className="mt-3">
        <label className="text-[9px] font-black uppercase tracking-[.12em] text-[#9b8275]">Endereço salvo</label>
        <select value={selectedAddressId} onChange={(event) => selectSavedAddress(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#4b3328]/10 bg-white px-3 text-xs font-bold text-[#4e3b32]">
          {activeAddresses.map((item) => <option key={item.id} value={item.id}>{item.isDefault ? 'Padrão · ' : ''}{item.label} · {item.street}, {item.number} · {item.city}/{item.state}</option>)}
        </select>
      </div>}

      <div className="mt-3 flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          value={zipCode}
          onChange={(event) => { setZipCode(formatCep(event.target.value)); setSelectedAddressId(''); setQuote(null); setError(''); }}
          onKeyDown={(event) => { if (event.key === 'Enter') void calculate(); }}
          placeholder="Digite seu CEP"
          className="h-10 min-w-0 flex-1 rounded-xl border border-[#4b3328]/10 bg-[#fbfaf8] px-3 text-xs font-bold outline-none focus:border-[#8fbeb8]"
        />
        <button type="button" disabled={loading || digits(zipCode).length !== 8} onClick={() => void calculate()} className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#2d211c] px-3 text-[10px] font-black text-white disabled:opacity-45">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />} Calcular
        </button>
      </div>

      {user && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold text-[#806b60]">
        <span>{activeAddresses.length ? 'O endereço salvo usa rua e número para uma rota mais precisa.' : 'Você ainda não tem endereço salvo.'}</span>
        <Link to="/classificados/logistica" className="font-black text-[#a84f34] hover:underline">Gerenciar endereços</Link>
      </div>}

      {error && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold leading-4 text-amber-800">{error}</p>}

      {quote && <div className="mt-3 space-y-2">
        {quote.destination?.city && <div className="flex items-center gap-2 rounded-xl bg-[#fbfaf8] px-3 py-2 text-[10px] font-bold text-[#604c42]"><MapPin className="h-3.5 w-3.5 text-[#c96847]" />Entrega para {quote.destination.street ? `${quote.destination.street}${quote.destination.number ? `, ${quote.destination.number}` : ''} · ` : ''}{quote.destination.city}/{quote.destination.state}</div>}
        {eligible.length > 0 ? eligible.map((option) => <div key={option.partnerId} className="flex items-center gap-2 rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-100">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700"><PackageCheck className="h-3.5 w-3.5" /></div>
          <div className="min-w-0 flex-1"><p className="text-xs font-black text-emerald-950">{option.partnerName}</p><p className="mt-0.5 text-[9px] font-bold text-emerald-700">{partnerLabel(option.partnerType)}{option.distanceMeters != null ? ` · ${(option.distanceMeters / 1000).toFixed(1).replace('.', ',')} km` : ''}</p></div>
          <div className="text-right"><p className="text-sm font-black text-emerald-900">{money(option.amountCents || 0)}</p>{option.estimatedMinutes != null && <p className="mt-0.5 inline-flex items-center gap-1 text-[8px] font-bold text-emerald-700"><Clock3 className="h-3 w-3" />~{option.estimatedMinutes} min</p>}</div>
        </div>) : <p className="rounded-xl bg-stone-50 px-3 py-3 text-[10px] font-bold text-stone-600">Nenhuma modalidade de entrega está disponível para este endereço.</p>}
        {eligible.length === 0 && unavailable.length > 0 && <div className="space-y-1">{unavailable.slice(0, 3).map((option) => <p key={option.partnerId} className="text-[9px] text-stone-500"><strong>{option.partnerName}:</strong> {option.reason || 'indisponível'}</p>)}</div>}
      </div>}
    </section>
  );
}

function digits(value: unknown) { return String(value || '').replace(/\D/g, ''); }
function formatCep(value: unknown) { const clean = digits(value).slice(0, 8); return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean; }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100); }
function partnerLabel(value: string) { return value === 'MOTOBOY' ? 'Motoboy' : value === 'BIKE' ? 'Bike' : value === 'TRANSPORTADORA' ? 'Transportadora' : 'Entrega'; }
