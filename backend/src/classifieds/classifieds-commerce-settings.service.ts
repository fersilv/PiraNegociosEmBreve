import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { classifiedsCommerceFeatureFlags } from './classifieds-commerce-feature-flags';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

@Injectable()
export class ClassifiedsCommerceSettingsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
  ) {}

  features() {
    return classifiedsCommerceFeatureFlags();
  }

  async addresses(uid: string) {
    return this.dataSource.query(
      `SELECT * FROM delivery_addresses WHERE "userId"=$1 ORDER BY "isDefault" DESC, active DESC, "updatedAt" DESC`,
      [uid],
    );
  }

  async saveAddress(uid: string, raw: Record<string, unknown>, id?: string) {
    const input = this.cleanAddress(raw);
    return this.dataSource.transaction(async (manager) => {
      if (id) {
        const rows = await manager.query(`SELECT * FROM delivery_addresses WHERE id=$1 AND "userId"=$2 LIMIT 1`, [id, uid]);
        if (!rows[0]) throw new NotFoundException('Endereço não encontrado.');
      }
      if (input.isDefault) {
        await manager.query(`UPDATE delivery_addresses SET "isDefault"=false,"updatedAt"=now() WHERE "userId"=$1 AND active=true`, [uid]);
      }
      const rows = id
        ? await manager.query(
            `UPDATE delivery_addresses SET label=$3,"zipCode"=$4,street=$5,number=$6,complement=$7,neighborhood=$8,city=$9,state=$10,"placeId"=$11,latitude=$12,longitude=$13,"locationAccuracyMeters"=$14,"isDefault"=$15,active=$16,"updatedAt"=now() WHERE id=$1 AND "userId"=$2 RETURNING *`,
            [id, uid, input.label, input.zipCode, input.street, input.number, input.complement, input.neighborhood, input.city, input.state, input.placeId, input.latitude, input.longitude, input.locationAccuracyMeters, input.isDefault, input.active],
          )
        : await manager.query(
            `INSERT INTO delivery_addresses("userId",label,"zipCode",street,number,complement,neighborhood,city,state,"placeId",latitude,longitude,"locationAccuracyMeters","isDefault",active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [uid, input.label, input.zipCode, input.street, input.number, input.complement, input.neighborhood, input.city, input.state, input.placeId, input.latitude, input.longitude, input.locationAccuracyMeters, input.isDefault, input.active],
          );
      if (!input.isDefault) {
        const defaults = await manager.query(`SELECT id FROM delivery_addresses WHERE "userId"=$1 AND active=true AND "isDefault"=true LIMIT 1`, [uid]);
        if (!defaults[0]) {
          await manager.query(`UPDATE delivery_addresses SET "isDefault"=true,"updatedAt"=now() WHERE id=$1`, [rows[0].id]);
          rows[0].isDefault = true;
        }
      }
      return rows[0];
    });
  }

  async setDefaultAddress(uid: string, id: string) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT id FROM delivery_addresses WHERE id=$1 AND "userId"=$2 AND active=true LIMIT 1`, [id, uid]);
      if (!rows[0]) throw new NotFoundException('Endereço ativo não encontrado.');
      await manager.query(`UPDATE delivery_addresses SET "isDefault"=false,"updatedAt"=now() WHERE "userId"=$1 AND active=true`, [uid]);
      const updated = await manager.query(`UPDATE delivery_addresses SET "isDefault"=true,"updatedAt"=now() WHERE id=$1 RETURNING *`, [id]);
      return updated[0];
    });
  }

  async deactivateAddress(uid: string, id: string) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM delivery_addresses WHERE id=$1 AND "userId"=$2 LIMIT 1`, [id, uid]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Endereço não encontrado.');
      await manager.query(`UPDATE delivery_addresses SET active=false,"isDefault"=false,"updatedAt"=now() WHERE id=$1`, [id]);
      if (current.isDefault) {
        await manager.query(`UPDATE delivery_addresses SET "isDefault"=true,"updatedAt"=now() WHERE id=(SELECT id FROM delivery_addresses WHERE "userId"=$1 AND active=true ORDER BY "updatedAt" DESC LIMIT 1)`, [uid]);
      }
      return { deactivated: true };
    });
  }

  async companySettings(uid: string) {
    const companyId = await this.companyId(uid);
    const rows = await this.dataSource.query(`SELECT * FROM company_commerce_settings WHERE "companyId"=$1 LIMIT 1`, [companyId]);
    return rows[0] || this.defaultCompanySettings(companyId);
  }

  async saveCompanySettings(uid: string, raw: Record<string, unknown>) {
    const companyId = await this.companyId(uid);
    const current = await this.companySettings(uid);
    const settings = {
      onlinePaymentsEnabled: this.bool(raw.onlinePaymentsEnabled, current.onlinePaymentsEnabled),
      pixEnabled: this.bool(raw.pixEnabled, current.pixEnabled),
      cardEnabled: this.bool(raw.cardEnabled, current.cardEnabled),
      defaultPixDiscountBps: this.int(raw.defaultPixDiscountBps, 0, 10000, Number(current.defaultPixDiscountBps || 0)),
      defaultMaxInstallments: this.int(raw.defaultMaxInstallments, 1, 24, Number(current.defaultMaxInstallments || 1)),
      defaultInterestFreeInstallments: 0,
      pickupEnabled: this.bool(raw.pickupEnabled, current.pickupEnabled),
      ownDeliveryEnabled: this.bool(raw.ownDeliveryEnabled, current.ownDeliveryEnabled),
      platformPartnersEnabled: this.bool(raw.platformPartnersEnabled, current.platformPartnersEnabled),
      defaultStockTracking: this.bool(raw.defaultStockTracking, current.defaultStockTracking),
      defaultLowStockThreshold: raw.defaultLowStockThreshold === null || raw.defaultLowStockThreshold === ''
        ? null
        : this.int(raw.defaultLowStockThreshold, 0, 1_000_000, Number(current.defaultLowStockThreshold || 0)),
      settings: raw.settings && typeof raw.settings === 'object' ? raw.settings : current.settings || {},
    };
    settings.defaultInterestFreeInstallments = this.int(
      raw.defaultInterestFreeInstallments,
      0,
      settings.defaultMaxInstallments,
      Math.min(Number(current.defaultInterestFreeInstallments || 0), settings.defaultMaxInstallments),
    );
    const rows = await this.dataSource.query(
      `INSERT INTO company_commerce_settings("companyId","onlinePaymentsEnabled","pixEnabled","cardEnabled","defaultPixDiscountBps","defaultMaxInstallments","defaultInterestFreeInstallments","pickupEnabled","ownDeliveryEnabled","platformPartnersEnabled","defaultStockTracking","defaultLowStockThreshold",settings,"updatedByUserId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) ON CONFLICT ("companyId") DO UPDATE SET "onlinePaymentsEnabled"=EXCLUDED."onlinePaymentsEnabled","pixEnabled"=EXCLUDED."pixEnabled","cardEnabled"=EXCLUDED."cardEnabled","defaultPixDiscountBps"=EXCLUDED."defaultPixDiscountBps","defaultMaxInstallments"=EXCLUDED."defaultMaxInstallments","defaultInterestFreeInstallments"=EXCLUDED."defaultInterestFreeInstallments","pickupEnabled"=EXCLUDED."pickupEnabled","ownDeliveryEnabled"=EXCLUDED."ownDeliveryEnabled","platformPartnersEnabled"=EXCLUDED."platformPartnersEnabled","defaultStockTracking"=EXCLUDED."defaultStockTracking","defaultLowStockThreshold"=EXCLUDED."defaultLowStockThreshold",settings=EXCLUDED.settings,"updatedByUserId"=EXCLUDED."updatedByUserId","updatedAt"=now() RETURNING *`,
      [companyId, settings.onlinePaymentsEnabled, settings.pixEnabled, settings.cardEnabled, settings.defaultPixDiscountBps, settings.defaultMaxInstallments, settings.defaultInterestFreeInstallments, settings.pickupEnabled, settings.ownDeliveryEnabled, settings.platformPartnersEnabled, settings.defaultStockTracking, settings.defaultLowStockThreshold, JSON.stringify(settings.settings), uid],
    );
    await this.audit('COMPANY_COMMERCE_SETTINGS', companyId, 'UPDATED', uid, companyId, { settings: rows[0] });
    return rows[0];
  }

  async locations(uid: string) {
    const companyId = await this.companyId(uid);
    return this.dataSource.query(`SELECT * FROM company_fulfillment_locations WHERE "companyId"=$1 ORDER BY active DESC,"isDefaultPickup" DESC,"isDefaultDeliveryOrigin" DESC,name`, [companyId]);
  }

  async saveLocation(uid: string, raw: Record<string, unknown>, id?: string) {
    const companyId = await this.companyId(uid);
    const input = this.cleanLocation(raw);
    return this.dataSource.transaction(async (manager) => {
      if (id) {
        const rows = await manager.query(`SELECT id FROM company_fulfillment_locations WHERE id=$1 AND "companyId"=$2 LIMIT 1`, [id, companyId]);
        if (!rows[0]) throw new NotFoundException('Local da empresa não encontrado.');
      }
      if (input.isDefaultPickup) await manager.query(`UPDATE company_fulfillment_locations SET "isDefaultPickup"=false,"updatedAt"=now() WHERE "companyId"=$1 AND active=true`, [companyId]);
      if (input.isDefaultDeliveryOrigin) await manager.query(`UPDATE company_fulfillment_locations SET "isDefaultDeliveryOrigin"=false,"updatedAt"=now() WHERE "companyId"=$1 AND active=true`, [companyId]);
      const rows = id
        ? await manager.query(
            `UPDATE company_fulfillment_locations SET name=$3,"zipCode"=$4,street=$5,number=$6,complement=$7,neighborhood=$8,city=$9,state=$10,"placeId"=$11,latitude=$12,longitude=$13,"allowsPickup"=$14,"allowsDeliveryOrigin"=$15,"isDefaultPickup"=$16,"isDefaultDeliveryOrigin"=$17,"pickupInstructions"=$18,"businessHours"=$19::jsonb,active=$20,"updatedAt"=now() WHERE id=$1 AND "companyId"=$2 RETURNING *`,
            [id, companyId, input.name, input.zipCode, input.street, input.number, input.complement, input.neighborhood, input.city, input.state, input.placeId, input.latitude, input.longitude, input.allowsPickup, input.allowsDeliveryOrigin, input.isDefaultPickup, input.isDefaultDeliveryOrigin, input.pickupInstructions, JSON.stringify(input.businessHours), input.active],
          )
        : await manager.query(
            `INSERT INTO company_fulfillment_locations("companyId",name,"zipCode",street,number,complement,neighborhood,city,state,"placeId",latitude,longitude,"allowsPickup","allowsDeliveryOrigin","isDefaultPickup","isDefaultDeliveryOrigin","pickupInstructions","businessHours",active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19) RETURNING *`,
            [companyId, input.name, input.zipCode, input.street, input.number, input.complement, input.neighborhood, input.city, input.state, input.placeId, input.latitude, input.longitude, input.allowsPickup, input.allowsDeliveryOrigin, input.isDefaultPickup, input.isDefaultDeliveryOrigin, input.pickupInstructions, JSON.stringify(input.businessHours), input.active],
          );
      await this.ensureLocationDefaults(manager, companyId, rows[0].id);
      return rows[0];
    });
  }

  async deactivateLocation(uid: string, id: string) {
    const companyId = await this.companyId(uid);
    const refs = await this.dataSource.query(
      `SELECT EXISTS(SELECT 1 FROM classified_orders WHERE "fulfillmentLocationSnapshot"->>'id'=$1) AS used`,
      [id],
    ).catch(() => [{ used: false }]);
    const rows = await this.dataSource.query(`UPDATE company_fulfillment_locations SET active=false,"isDefaultPickup"=false,"isDefaultDeliveryOrigin"=false,"updatedAt"=now() WHERE id=$1 AND "companyId"=$2 RETURNING id`, [id, companyId]);
    if (!rows[0]) throw new NotFoundException('Local da empresa não encontrado.');
    return { deactivated: true, historicalReferencesPreserved: Boolean(refs[0]?.used) };
  }

  async listingShipping(uid: string, listingId: string) {
    const listing = await this.ownerListing(uid, listingId);
    const rows = await this.dataSource.query(`SELECT * FROM classified_listing_shipping WHERE "listingId"=$1 LIMIT 1`, [listingId]);
    return {
      listingId,
      listingType: listing.listingType,
      shipping: rows[0] || this.defaultListingShipping(listingId),
      source: rows[0]?.inheritCompanySettings === false ? 'LISTING_OVERRIDE' : 'COMPANY',
      companySettings: listing.companyId ? await this.dataSource.query(`SELECT * FROM company_commerce_settings WHERE "companyId"=$1 LIMIT 1`, [listing.companyId]).then((r: any[]) => r[0] || this.defaultCompanySettings(listing.companyId)) : null,
    };
  }

  async saveListingShipping(uid: string, listingId: string, raw: Record<string, unknown>) {
    const listing = await this.ownerListing(uid, listingId);
    if (listing.listingType !== 'PRODUCT') throw new BadRequestException('Peso e dimensões se aplicam a anúncios de produto.');
    if (!listing.companyId) throw new ForbiddenException('Configuração de logística por produto é exclusiva do Business.');
    const inherit = raw.inheritCompanySettings !== false;
    const weightGrams = this.optionalPositiveInt(raw.weightGrams, 2_000_000, 'Peso inválido.');
    const lengthCm = this.optionalPositiveNumber(raw.lengthCm, 1000, 'Comprimento inválido.');
    const widthCm = this.optionalPositiveNumber(raw.widthCm, 1000, 'Largura inválida.');
    const heightCm = this.optionalPositiveNumber(raw.heightCm, 1000, 'Altura inválida.');
    const volumeCm3 = lengthCm && widthCm && heightCm ? Math.round(lengthCm * widthCm * heightCm * 100) / 100 : null;
    const originLocationId = String(raw.originLocationId || '').trim() || null;
    if (originLocationId) {
      const locations = await this.dataSource.query(`SELECT id FROM company_fulfillment_locations WHERE id=$1 AND "companyId"=$2 AND active=true LIMIT 1`, [originLocationId, listing.companyId]);
      if (!locations[0]) throw new BadRequestException('Origem de entrega inválida para esta empresa.');
    }
    const handling = String(raw.handlingType || '').trim().toUpperCase();
    const handlingType = handling && ['STANDARD','FRAGILE','REFRIGERATED','LARGE','SPECIAL'].includes(handling) ? handling : null;
    const rows = await this.dataSource.query(
      `INSERT INTO classified_listing_shipping("listingId","inheritCompanySettings","originLocationId","weightGrams","lengthCm","widthCm","heightCm","volumeCm3","disableLocalPartners","handlingType","handlingNotes",overrides) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) ON CONFLICT ("listingId") DO UPDATE SET "inheritCompanySettings"=EXCLUDED."inheritCompanySettings","originLocationId"=EXCLUDED."originLocationId","weightGrams"=EXCLUDED."weightGrams","lengthCm"=EXCLUDED."lengthCm","widthCm"=EXCLUDED."widthCm","heightCm"=EXCLUDED."heightCm","volumeCm3"=EXCLUDED."volumeCm3","disableLocalPartners"=EXCLUDED."disableLocalPartners","handlingType"=EXCLUDED."handlingType","handlingNotes"=EXCLUDED."handlingNotes",overrides=EXCLUDED.overrides,"updatedAt"=now() RETURNING *`,
      [listingId, inherit, originLocationId, weightGrams, lengthCm, widthCm, heightCm, volumeCm3, raw.disableLocalPartners === true, handlingType, String(raw.handlingNotes || '').trim().slice(0, 500) || null, JSON.stringify(raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {})],
    );
    return rows[0];
  }

  async effectiveForListing(listingId: string) {
    const rows = await this.dataSource.query(
      `SELECT l.id,l."companyId",l."listingType",l."commerceConfig",l."deliveryModes",s.*,cs.*,
              COALESCE(s."originLocationId", (SELECT id FROM company_fulfillment_locations fl WHERE fl."companyId"=l."companyId" AND fl.active=true AND fl."isDefaultDeliveryOrigin"=true LIMIT 1)) AS "effectiveOriginLocationId"
       FROM classified_listings l
       LEFT JOIN classified_listing_shipping s ON s."listingId"=l.id
       LEFT JOIN company_commerce_settings cs ON cs."companyId"=l."companyId"
       WHERE l.id=$1 LIMIT 1`,
      [listingId],
    );
    return rows[0] || null;
  }

  private async ownerListing(uid: string, listingId: string) {
    const identity = await this.identities.active(uid);
    const rows = await this.dataSource.query(`SELECT * FROM classified_listings WHERE id=$1 LIMIT 1`, [listingId]);
    const listing = rows[0];
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');
    const allowed = identity.type === 'COMPANY' ? listing.companyId === identity.company!.id : !listing.companyId && listing.sellerUserId === uid;
    if (!allowed) throw new ForbiddenException('Este anúncio pertence a outra identidade.');
    return listing;
  }

  private async companyId(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY' || !identity.company?.id) throw new ForbiddenException('Esta configuração é exclusiva do workspace Business.');
    return identity.company.id;
  }

  private cleanAddress(raw: Record<string, unknown>) {
    const state = String(raw.state || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) throw new BadRequestException('UF inválida.');
    const required = {
      label: String(raw.label || 'Casa').trim().slice(0, 80),
      zipCode: String(raw.zipCode || '').replace(/\D/g, '').slice(0, 8),
      street: String(raw.street || '').trim().slice(0, 180),
      number: String(raw.number || '').trim().slice(0, 40),
      neighborhood: String(raw.neighborhood || '').trim().slice(0, 140),
      city: String(raw.city || '').trim().slice(0, 120),
    };
    if (!required.zipCode || !required.street || !required.number || !required.neighborhood || !required.city) throw new BadRequestException('Preencha CEP, rua, número, bairro e cidade.');
    return {
      ...required,
      state,
      complement: String(raw.complement || '').trim().slice(0, 160) || null,
      placeId: String(raw.placeId || '').trim().slice(0, 255) || null,
      latitude: this.coordinate(raw.latitude, -90, 90),
      longitude: this.coordinate(raw.longitude, -180, 180),
      locationAccuracyMeters: raw.locationAccuracyMeters == null ? null : this.int(raw.locationAccuracyMeters, 0, 1_000_000, 0),
      isDefault: raw.isDefault === true,
      active: raw.active !== false,
    };
  }

  private cleanLocation(raw: Record<string, unknown>) {
    const base = this.cleanAddress({ ...raw, label: raw.name || 'Local', isDefault: false });
    return {
      ...base,
      name: String(raw.name || '').trim().slice(0, 120) || 'Local',
      allowsPickup: raw.allowsPickup !== false,
      allowsDeliveryOrigin: raw.allowsDeliveryOrigin !== false,
      isDefaultPickup: raw.isDefaultPickup === true,
      isDefaultDeliveryOrigin: raw.isDefaultDeliveryOrigin === true,
      pickupInstructions: String(raw.pickupInstructions || '').trim().slice(0, 2000) || null,
      businessHours: raw.businessHours && typeof raw.businessHours === 'object' ? raw.businessHours : null,
    };
  }

  private async ensureLocationDefaults(manager: { query: (sql: string, params?: unknown[]) => Promise<any[]> }, companyId: string, fallbackId: string) {
    const pickup = await manager.query(`SELECT id FROM company_fulfillment_locations WHERE "companyId"=$1 AND active=true AND "isDefaultPickup"=true LIMIT 1`, [companyId]);
    if (!pickup[0]) await manager.query(`UPDATE company_fulfillment_locations SET "isDefaultPickup"=true WHERE id=$1 AND "allowsPickup"=true`, [fallbackId]);
    const origin = await manager.query(`SELECT id FROM company_fulfillment_locations WHERE "companyId"=$1 AND active=true AND "isDefaultDeliveryOrigin"=true LIMIT 1`, [companyId]);
    if (!origin[0]) await manager.query(`UPDATE company_fulfillment_locations SET "isDefaultDeliveryOrigin"=true WHERE id=$1 AND "allowsDeliveryOrigin"=true`, [fallbackId]);
  }

  private defaultCompanySettings(companyId: string) {
    return { companyId, onlinePaymentsEnabled: false, pixEnabled: true, cardEnabled: true, defaultPixDiscountBps: 0, defaultMaxInstallments: 1, defaultInterestFreeInstallments: 0, pickupEnabled: true, ownDeliveryEnabled: false, platformPartnersEnabled: false, defaultStockTracking: false, defaultLowStockThreshold: null, settings: {} };
  }

  private defaultListingShipping(listingId: string) {
    return { listingId, inheritCompanySettings: true, originLocationId: null, weightGrams: null, lengthCm: null, widthCm: null, heightCm: null, volumeCm3: null, disableLocalPartners: false, handlingType: null, handlingNotes: null, overrides: {} };
  }

  private bool(value: unknown, fallback: boolean) {
    return value === undefined ? fallback : value === true;
  }

  private int(value: unknown, min: number, max: number, fallback: number) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  private optionalPositiveInt(value: unknown, max: number, message: string) {
    if (value === null || value === undefined || value === '') return null;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n <= 0 || n > max) throw new BadRequestException(message);
    return n;
  }

  private optionalPositiveNumber(value: unknown, max: number, message: string) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > max) throw new BadRequestException(message);
    return Math.round(n * 100) / 100;
  }

  private coordinate(value: unknown, min: number, max: number) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  }

  private async audit(aggregateType: string, aggregateId: string, action: string, actorUserId: string, companyId: string | null, metadata: Record<string, unknown>) {
    await this.dataSource.query(
      `INSERT INTO classified_commerce_audit_events("aggregateType","aggregateId",action,"actorUserId","companyId",metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [aggregateType, aggregateId, action, actorUserId, companyId, JSON.stringify(metadata)],
    ).catch(() => undefined);
  }
}
