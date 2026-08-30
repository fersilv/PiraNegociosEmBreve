import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

type ResolvedAddress = {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  ibgeCityId: string | null;
  source: string;
};

type CacheEntry<T> = { expiresAt: number; value: T };

@Injectable()
export class ClassifiedsAddressResolutionService {
  private readonly cepCache = new Map<string, CacheEntry<ResolvedAddress>>();
  private readonly searchCache = new Map<string, CacheEntry<ResolvedAddress[]>>();
  private readonly ttlMs = 6 * 60 * 60 * 1000;

  async byCep(rawCep: unknown): Promise<ResolvedAddress> {
    const cep = this.cleanCep(rawCep);
    const cached = this.cepCache.get(cep);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const brasilApi = await this.fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`).catch(() => null);
    if (brasilApi && !brasilApi.errors) {
      const coordinates = brasilApi?.location?.coordinates || {};
      const resolved: ResolvedAddress = {
        zipCode: this.cleanCep(brasilApi.cep || cep),
        street: String(brasilApi.street || '').trim(),
        neighborhood: String(brasilApi.neighborhood || '').trim(),
        city: String(brasilApi.city || '').trim(),
        state: String(brasilApi.state || '').trim().toUpperCase(),
        latitude: this.coordinate(coordinates.latitude, -90, 90),
        longitude: this.coordinate(coordinates.longitude, -180, 180),
        ibgeCityId: String(brasilApi?.ibge?.city || '').trim() || null,
        source: 'BRASIL_API_CEP_V2',
      };
      if (resolved.city && resolved.state) {
        this.cepCache.set(cep, { expiresAt: Date.now() + this.ttlMs, value: resolved });
        return resolved;
      }
    }

    const viaCep = await this.fetchJson(`https://viacep.com.br/ws/${cep}/json/`).catch(() => null);
    if (!viaCep || viaCep.erro) throw new NotFoundException('CEP não encontrado.');
    const resolved: ResolvedAddress = {
      zipCode: this.cleanCep(viaCep.cep || cep),
      street: String(viaCep.logradouro || '').trim(),
      neighborhood: String(viaCep.bairro || '').trim(),
      city: String(viaCep.localidade || '').trim(),
      state: String(viaCep.uf || '').trim().toUpperCase(),
      latitude: null,
      longitude: null,
      ibgeCityId: String(viaCep.ibge || '').trim() || null,
      source: 'VIACEP',
    };
    this.cepCache.set(cep, { expiresAt: Date.now() + this.ttlMs, value: resolved });
    return resolved;
  }

  async search(raw: Record<string, unknown>): Promise<ResolvedAddress[]> {
    const state = String(raw.state || '').trim().toUpperCase();
    const city = String(raw.city || '').trim();
    const street = String(raw.street || '').trim();
    if (!/^[A-Z]{2}$/.test(state)) throw new BadRequestException('Informe uma UF válida.');
    if (city.length < 3) throw new BadRequestException('Informe pelo menos 3 caracteres da cidade.');
    if (street.length < 3) throw new BadRequestException('Informe pelo menos 3 caracteres da rua.');

    const key = `${state}|${city.toLocaleLowerCase('pt-BR')}|${street.toLocaleLowerCase('pt-BR')}`;
    const cached = this.searchCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const url = `https://viacep.com.br/ws/${encodeURIComponent(state)}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`;
    const response = await this.fetchJson(url).catch(() => null);
    if (!Array.isArray(response)) throw new NotFoundException('Nenhum endereço correspondente foi encontrado.');

    const seen = new Set<string>();
    const items = response.slice(0, 50).map((item: any) => {
      const zipCode = String(item?.cep || '').replace(/\D/g, '').slice(0, 8);
      return {
        zipCode,
        street: String(item?.logradouro || '').trim(),
        neighborhood: String(item?.bairro || '').trim(),
        city: String(item?.localidade || city).trim(),
        state: String(item?.uf || state).trim().toUpperCase(),
        latitude: null,
        longitude: null,
        ibgeCityId: String(item?.ibge || '').trim() || null,
        source: 'VIACEP_ADDRESS_SEARCH',
      } satisfies ResolvedAddress;
    }).filter((item: ResolvedAddress) => {
      if (!item.zipCode || seen.has(item.zipCode)) return false;
      seen.add(item.zipCode);
      return true;
    });

    if (!items.length) throw new NotFoundException('Nenhum endereço correspondente foi encontrado.');
    this.searchCache.set(key, { expiresAt: Date.now() + this.ttlMs, value: items });
    return items;
  }

  private cleanCep(value: unknown) {
    const cep = String(value || '').replace(/\D/g, '').slice(0, 8);
    if (!/^\d{8}$/.test(cep)) throw new BadRequestException('Informe um CEP com 8 dígitos.');
    return cep;
  }

  private coordinate(value: unknown, min: number, max: number) {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }

  private async fetchJson(url: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'PiraNegocios/1.0' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
