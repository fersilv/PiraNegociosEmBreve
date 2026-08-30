import React, { useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { api } from '../../lib/api';

type Props = {
  value: any;
  onChange: React.Dispatch<React.SetStateAction<any>>;
  labelKey: 'label' | 'name';
};

type AddressSuggestion = {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
  ibgeCityId?: string | null;
};

export function SmartAddressFields({ value, onChange, labelKey }: Props) {
  const [loadingCep, setLoadingCep] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  const mergeResolved = (resolved: AddressSuggestion) => {
    onChange((current: any) => ({
      ...current,
      zipCode: formatCep(resolved.zipCode || current.zipCode),
      street: resolved.street || current.street,
      neighborhood: resolved.neighborhood || current.neighborhood,
      city: resolved.city || current.city,
      state: String(resolved.state || current.state || '').toUpperCase(),
      latitude: resolved.latitude ?? current.latitude ?? null,
      longitude: resolved.longitude ?? current.longitude ?? null,
      placeId: resolved.ibgeCityId ? `IBGE:${resolved.ibgeCityId}` : current.placeId || null,
    }));
  };

  const lookupCep = async (rawCep = value.zipCode) => {
    const cep = digits(rawCep).slice(0, 8);
    if (cep.length !== 8 || loadingCep) return;
    setLoadingCep(true); setError(''); setSuggestions([]);
    try {
      const response = await api.get(`/classifieds/address/cep/${cep}`);
      mergeResolved(response.data || {});
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'CEP não encontrado. Você pode preencher o endereço e pesquisar abaixo.');
    } finally {
      setLoadingCep(false);
    }
  };

  const searchAddress = async () => {
    const state = String(value.state || '').trim().toUpperCase();
    const city = String(value.city || '').trim();
    const street = String(value.street || '').trim();
    setError(''); setSuggestions([]);
    if (!/^[A-Z]{2}$/.test(state) || city.length < 3 || street.length < 3) {
      setError('Para pesquisar sem CEP, informe UF, cidade e pelo menos 3 caracteres da rua.');
      return;
    }
    setSearching(true);
    try {
      const response = await api.get('/classifieds/address/search', { params: { state, city, street } });
      setSuggestions(Array.isArray(response.data) ? response.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não encontrei endereços parecidos.');
    } finally {
      setSearching(false);
    }
  };

  const chooseSuggestion = async (suggestion: AddressSuggestion) => {
    mergeResolved(suggestion);
    setSuggestions([]);
    if (suggestion.zipCode) await lookupCep(suggestion.zipCode);
  };

  const field = (key: string, label: string, span = '', props: Record<string, unknown> = {}) => (
    <label className={span}>
      <span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span>
      <input
        value={value[key] || ''}
        onChange={(event) => onChange((current: any) => ({ ...current, [key]: key === 'state' ? event.target.value.toUpperCase().slice(0, 2) : event.target.value }))}
        className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#8fbeb8]"
        {...props}
      />
    </label>
  );

  return (
    <div className="mt-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {field(labelKey, labelKey === 'label' ? 'Nome do endereço' : 'Nome do ponto')}
        <label>
          <span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">CEP</span>
          <div className="mt-1 flex gap-2">
            <input
              inputMode="numeric"
              autoComplete="postal-code"
              value={value.zipCode || ''}
              onChange={(event) => {
                const next = formatCep(event.target.value);
                onChange((current: any) => ({ ...current, zipCode: next, latitude: null, longitude: null }));
              }}
              onBlur={() => void lookupCep()}
              className="h-10 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#8fbeb8]"
              placeholder="00000-000"
            />
            <button type="button" disabled={loadingCep || digits(value.zipCode).length !== 8} onClick={() => void lookupCep()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600 disabled:opacity-40" title="Buscar CEP">
              {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
        </label>
        {field('street','Rua','lg:col-span-2', { autoComplete: 'address-line1' })}
        {field('number','Número','', { autoComplete: 'address-line2' })}
        {field('complement','Complemento')}
        {field('neighborhood','Bairro')}
        {field('city','Cidade','', { autoComplete: 'address-level2' })}
        {field('state','UF','', { autoComplete: 'address-level1', maxLength: 2 })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={searching} onClick={() => void searchAddress()} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#eef6f4] px-3 text-[10px] font-black text-[#276b64] disabled:opacity-50">
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
          Não sei o CEP: localizar endereço
        </button>
        {(value.latitude != null && value.longitude != null) && <span className="text-[10px] font-bold text-emerald-700">Coordenadas encontradas para cálculo de distância.</span>}
      </div>

      {error && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">{error}</p>}
      {suggestions.length > 0 && <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-lg">
        <p className="px-2 py-1 text-[9px] font-black uppercase tracking-[.1em] text-stone-400">Escolha o endereço correto</p>
        {suggestions.map((item) => <button key={`${item.zipCode}-${item.street}`} type="button" onClick={() => void chooseSuggestion(item)} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-stone-50">
          <p className="text-xs font-black text-stone-700">{item.street || 'Logradouro'}{item.neighborhood ? ` · ${item.neighborhood}` : ''}</p>
          <p className="mt-0.5 text-[10px] text-stone-500">{item.city}/{item.state} · {formatCep(item.zipCode)}</p>
        </button>)}
      </div>}
    </div>
  );
}

function digits(value: unknown) { return String(value || '').replace(/\D/g, ''); }
function formatCep(value: unknown) {
  const clean = digits(value).slice(0, 8);
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}
