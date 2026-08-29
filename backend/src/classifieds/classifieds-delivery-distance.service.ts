import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassifiedsAddressResolutionService } from './classifieds-address-resolution.service';
import { resolveRoadDistance } from './classifieds-road-routing';

@Injectable()
export class ClassifiedsDeliveryDistanceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly addresses: ClassifiedsAddressResolutionService,
  ) {}

  async derive(uid: string, raw: Record<string, unknown>) {
    const destinationAddressId = String(raw.destinationAddressId || '').trim();
    if (!destinationAddressId) return { distanceMeters: null, source: 'UNAVAILABLE' as const };

    const destinationRows = await this.dataSource.query(
      `SELECT id,"zipCode",latitude,longitude FROM delivery_addresses
       WHERE id=$1 AND "userId"=$2 AND active=true LIMIT 1`,
      [destinationAddressId, uid],
    );
    const destination = destinationRows[0];
    if (!destination) throw new BadRequestException('Endereço de entrega não encontrado.');

    const rawItems = Array.isArray(raw.items) ? raw.items : [];
    const listingIds = rawItems
      .map((item: any) => String(item?.listingId || '').trim())
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (!listingIds.length) return { distanceMeters: null, source: 'UNAVAILABLE' as const };

    const listingRows = await this.dataSource.query(
      `SELECT l.id,l."companyId",s."originLocationId"
       FROM classified_listings l
       LEFT JOIN classified_listing_shipping s ON s."listingId"=l.id
       WHERE l.id=ANY($1::uuid[])`,
      [listingIds],
    );
    const companyIds = [...new Set(listingRows.map((row: any) => row.companyId).filter(Boolean))];
    if (listingRows.length !== listingIds.length || companyIds.length !== 1) {
      throw new BadRequestException('A distância só pode ser calculada para produtos da mesma empresa.');
    }

    let originLocationId = String(raw.originLocationId || '').trim() || null;
    if (!originLocationId) {
      const explicitOrigins = [...new Set(listingRows.map((row: any) => row.originLocationId).filter(Boolean))];
      if (explicitOrigins.length > 1) {
        throw new BadRequestException('Os produtos usam origens diferentes e não podem ser combinados nesta entrega.');
      }
      originLocationId = explicitOrigins[0] ? String(explicitOrigins[0]) : null;
    }
    if (!originLocationId) {
      const defaultRows = await this.dataSource.query(
        `SELECT id FROM company_fulfillment_locations
         WHERE "companyId"=$1 AND active=true AND "allowsDeliveryOrigin"=true
         ORDER BY "isDefaultDeliveryOrigin" DESC,"createdAt" ASC LIMIT 1`,
        [companyIds[0]],
      );
      originLocationId = defaultRows[0]?.id ? String(defaultRows[0].id) : null;
    }
    if (!originLocationId) return { distanceMeters: null, source: 'UNAVAILABLE' as const };

    const originRows = await this.dataSource.query(
      `SELECT id,"zipCode",latitude,longitude FROM company_fulfillment_locations
       WHERE id=$1 AND "companyId"=$2 AND active=true AND "allowsDeliveryOrigin"=true LIMIT 1`,
      [originLocationId, companyIds[0]],
    );
    const origin = originRows[0];
    if (!origin) throw new BadRequestException('Origem de entrega não configurada para esta empresa.');

    const destinationCoordinates = await this.coordinatesFromStoredOrCep(destination, 'delivery_addresses');
    const originCoordinates = await this.coordinatesFromStoredOrCep(origin, 'company_fulfillment_locations');
    if (!destinationCoordinates || !originCoordinates) {
      return { distanceMeters: null, source: 'UNAVAILABLE' as const };
    }

    const routed = await resolveRoadDistance(
      this.dataSource,
      { ...originCoordinates, zipCode: origin.zipCode },
      { ...destinationCoordinates, zipCode: destination.zipCode },
    );
    if (!routed) {
      return { distanceMeters: null, source: 'ROAD_ROUTE_UNAVAILABLE' as const };
    }

    return {
      distanceMeters: routed.distanceMeters,
      durationSeconds: routed.durationSeconds,
      source: routed.cacheHit ? `${routed.source}_CACHE` as const : routed.source,
      cacheHit: routed.cacheHit,
    };
  }

  private async coordinatesFromStoredOrCep(row: any, table: 'delivery_addresses' | 'company_fulfillment_locations') {
    const latitude = this.coordinate(row.latitude, -90, 90);
    const longitude = this.coordinate(row.longitude, -180, 180);
    if (latitude != null && longitude != null) return { latitude, longitude };

    const zipCode = String(row.zipCode || '').replace(/\D/g, '').slice(0, 8);
    if (!/^\d{8}$/.test(zipCode)) return null;
    const resolved = await this.addresses.byCep(zipCode).catch(() => null);
    const resolvedLatitude = this.coordinate(resolved?.latitude, -90, 90);
    const resolvedLongitude = this.coordinate(resolved?.longitude, -180, 180);
    if (resolvedLatitude == null || resolvedLongitude == null) return null;

    await this.dataSource.query(
      `UPDATE ${table} SET latitude=$2,longitude=$3,"updatedAt"=now() WHERE id=$1`,
      [row.id, resolvedLatitude, resolvedLongitude],
    ).catch(() => undefined);
    return { latitude: resolvedLatitude, longitude: resolvedLongitude };
  }

  private coordinate(value: unknown, min: number, max: number) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }
}
