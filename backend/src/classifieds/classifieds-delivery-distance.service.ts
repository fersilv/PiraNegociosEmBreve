import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ClassifiedsDeliveryDistanceService {
  constructor(private readonly dataSource: DataSource) {}

  async derive(uid: string, raw: Record<string, unknown>) {
    const destinationAddressId = String(raw.destinationAddressId || '').trim();
    if (!destinationAddressId) return { distanceMeters: null, source: 'UNAVAILABLE' as const };

    const destinationRows = await this.dataSource.query(
      `SELECT id,latitude,longitude FROM delivery_addresses
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
      `SELECT id,latitude,longitude FROM company_fulfillment_locations
       WHERE id=$1 AND "companyId"=$2 AND active=true AND "allowsDeliveryOrigin"=true LIMIT 1`,
      [originLocationId, companyIds[0]],
    );
    const origin = originRows[0];
    if (!origin) throw new BadRequestException('Origem de entrega não configurada para esta empresa.');

    const originLat = this.coordinate(origin.latitude, -90, 90);
    const originLng = this.coordinate(origin.longitude, -180, 180);
    const destinationLat = this.coordinate(destination.latitude, -90, 90);
    const destinationLng = this.coordinate(destination.longitude, -180, 180);
    if (originLat == null || originLng == null || destinationLat == null || destinationLng == null) {
      return { distanceMeters: null, source: 'UNAVAILABLE' as const };
    }

    return {
      distanceMeters: this.haversineMeters(originLat, originLng, destinationLat, destinationLng),
      source: 'SERVER_HAVERSINE' as const,
    };
  }

  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
    const radius = 6_371_000;
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.max(0, Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
  }

  private coordinate(value: unknown, min: number, max: number) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }
}
