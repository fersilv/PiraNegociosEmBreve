import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type ClassifiedLocationSource = 'PROFILE' | 'COMPANY_PROFILE' | 'MANUAL' | 'DEVICE';

@Injectable()
export class ClassifiedsLocationService {
  constructor(private readonly dataSource: DataSource) {}

  async upsert(listingId: string, userId: string, input: Record<string, unknown>, defaults: { address?: string | null; zipCode?: string | null } = {}) {
    const source = this.source(input.locationSource);
    const latitude = this.coordinate(input.latitude, -90, 90, 'Latitude inválida.');
    const longitude = this.coordinate(input.longitude, -180, 180, 'Longitude inválida.');
    const address = this.text(input.privateAddress ?? input.address ?? defaults.address, 1000);
    const zipCode = this.text(input.zipCode ?? defaults.zipCode, 20);
    if ((latitude == null) !== (longitude == null)) throw new BadRequestException('Latitude e longitude precisam ser informadas juntas.');
    if (!address && !zipCode && latitude == null && longitude == null) {
      await this.dataSource.query(`DELETE FROM classified_listing_private_locations WHERE "listingId"=$1`, [listingId]).catch(() => undefined);
      return null;
    }
    const rows = await this.dataSource.query(
      `INSERT INTO classified_listing_private_locations
        ("listingId",address,"zipCode",latitude,longitude,source,"updatedByUserId","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT ("listingId") DO UPDATE SET address=EXCLUDED.address,"zipCode"=EXCLUDED."zipCode",latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,source=EXCLUDED.source,"updatedByUserId"=EXCLUDED."updatedByUserId","updatedAt"=now()
       RETURNING *`,
      [listingId, address, zipCode, latitude, longitude, source, userId],
    );
    return rows[0] || null;
  }

  async forListings(listingIds: string[]) {
    const ids=[...new Set(listingIds.filter(Boolean))]; if(!ids.length)return new Map<string,any>();
    const rows=await this.dataSource.query(`SELECT * FROM classified_listing_private_locations WHERE "listingId"=ANY($1::uuid[])`,[ids]).catch(()=>[]);
    return new Map(rows.map((row:any)=>[row.listingId,row]));
  }

  async distances(listingIds:string[],lat:number,lng:number){
    const ids=[...new Set(listingIds.filter(Boolean))];if(!ids.length)return new Map<string,number>();
    const rows=await this.dataSource.query(
      `SELECT "listingId",6371 * 2 * asin(sqrt(
         power(sin(radians(latitude::double precision - $2) / 2),2) +
         cos(radians($2))*cos(radians(latitude::double precision))*power(sin(radians(longitude::double precision - $3) / 2),2)
       )) AS "distanceKm"
       FROM classified_listing_private_locations
       WHERE "listingId"=ANY($1::uuid[]) AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [ids,lat,lng],
    ).catch(()=>[]);
    return new Map(rows.map((row:any)=>[row.listingId,Number(row.distanceKm)]));
  }

  private source(value:unknown):ClassifiedLocationSource{const s=String(value||'PROFILE').toUpperCase();return ['PROFILE','COMPANY_PROFILE','MANUAL','DEVICE'].includes(s)?s as ClassifiedLocationSource:'PROFILE'}
  private text(value:unknown,max:number){const v=String(value??'').trim().slice(0,max);return v||null}
  private coordinate(value:unknown,min:number,max:number,message:string){if(value===undefined||value===null||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new BadRequestException(message);return n}
}
