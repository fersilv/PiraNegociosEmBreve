import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { classifiedsCommerceFeatureFlags } from './classifieds-commerce-feature-flags';
import { ClassifiedsAddressResolutionService } from './classifieds-address-resolution.service';

@Injectable()
export class ClassifiedsDeliveryPreviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly addresses: ClassifiedsAddressResolutionService,
  ) {}

  async listingQuote(listingId: string, raw: Record<string, unknown>) {
    if (!classifiedsCommerceFeatureFlags().localDeliveryPartners) {
      throw new BadRequestException('Frete por parceiros locais ainda não está habilitado neste ambiente.');
    }
    const quantity = this.int(raw.quantity, 1, 999, 1);
    const destination = await this.addresses.byCep(raw.zipCode);

    const listingRows = await this.dataSource.query(
      `SELECT l.id,l.title,l.status,l."listingType",l."companyId",
              s."originLocationId",s."weightGrams",s."lengthCm",s."widthCm",s."heightCm",s."volumeCm3",
              COALESCE(s."disableLocalPartners",false) AS "disableLocalPartners"
       FROM classified_listings l
       LEFT JOIN classified_listing_shipping s ON s."listingId"=l.id
       WHERE l.id=$1 LIMIT 1`,
      [listingId],
    );
    const listing = listingRows[0];
    if (!listing || listing.status !== 'PUBLISHED') throw new NotFoundException('Anúncio não encontrado.');
    if (listing.listingType !== 'PRODUCT' || !listing.companyId) throw new BadRequestException('Este anúncio não possui cálculo de frete por parceiro local.');
    if (listing.disableLocalPartners === true) throw new BadRequestException('Este produto não aceita entrega por parceiro local.');

    const settingsRows = await this.dataSource.query(
      `SELECT * FROM company_commerce_settings WHERE "companyId"=$1 LIMIT 1`,
      [listing.companyId],
    );
    if (settingsRows[0]?.platformPartnersEnabled !== true) {
      throw new BadRequestException('A empresa ainda não habilitou parceiros de entrega da plataforma.');
    }

    let originLocationId = String(listing.originLocationId || '').trim() || null;
    if (!originLocationId) {
      const defaultRows = await this.dataSource.query(
        `SELECT id FROM company_fulfillment_locations
         WHERE "companyId"=$1 AND active=true AND "allowsDeliveryOrigin"=true
         ORDER BY "isDefaultDeliveryOrigin" DESC,"createdAt" ASC LIMIT 1`,
        [listing.companyId],
      );
      originLocationId = defaultRows[0]?.id ? String(defaultRows[0].id) : null;
    }
    if (!originLocationId) throw new BadRequestException('A empresa ainda não cadastrou uma origem de entrega.');

    const originRows = await this.dataSource.query(
      `SELECT * FROM company_fulfillment_locations
       WHERE id=$1 AND "companyId"=$2 AND active=true AND "allowsDeliveryOrigin"=true LIMIT 1`,
      [originLocationId, listing.companyId],
    );
    const origin = originRows[0];
    if (!origin) throw new BadRequestException('Origem de entrega indisponível.');

    let originLatitude = this.coordinate(origin.latitude, -90, 90);
    let originLongitude = this.coordinate(origin.longitude, -180, 180);
    if ((originLatitude == null || originLongitude == null) && origin.zipCode) {
      const resolvedOrigin = await this.addresses.byCep(origin.zipCode).catch(() => null);
      originLatitude = resolvedOrigin?.latitude ?? null;
      originLongitude = resolvedOrigin?.longitude ?? null;
    }
    const destinationLatitude = this.coordinate(destination.latitude, -90, 90);
    const destinationLongitude = this.coordinate(destination.longitude, -180, 180);
    const distanceMeters = originLatitude != null && originLongitude != null && destinationLatitude != null && destinationLongitude != null
      ? this.haversineMeters(originLatitude, originLongitude, destinationLatitude, destinationLongitude)
      : null;

    const aggregate = {
      weightGrams: listing.weightGrams == null ? null : Number(listing.weightGrams) * quantity,
      maxLengthCm: listing.lengthCm == null ? null : Number(listing.lengthCm),
      maxWidthCm: listing.widthCm == null ? null : Number(listing.widthCm),
      maxHeightCm: listing.heightCm == null ? null : Number(listing.heightCm),
      volumeCm3: listing.volumeCm3 == null ? null : Number(listing.volumeCm3) * quantity,
    };

    const partners = await this.dataSource.query(
      `SELECT p.*,cp."settlementMode"
       FROM delivery_partners p
       JOIN company_delivery_partner_preferences cp
         ON cp."partnerId"=p.id AND cp."companyId"=$1 AND cp.enabled=true
       WHERE p.status='ACTIVE'
       ORDER BY p.priority,p.name`,
      [listing.companyId],
    );

    const options: any[] = [];
    for (const partner of partners) {
      const restriction = this.partnerRestriction(partner, aggregate, destination);
      if (restriction) {
        options.push({ partnerId: partner.id, partnerName: partner.name, partnerType: partner.type, eligible: false, reason: restriction });
        continue;
      }

      const tables = await this.dataSource.query(
        `SELECT * FROM delivery_partner_rate_tables
         WHERE "partnerId"=$1 AND active=true AND "startsAt"<=now() AND ("endsAt" IS NULL OR "endsAt">now())
         ORDER BY version DESC LIMIT 1`,
        [partner.id],
      );
      const table = tables[0];
      if (!table) {
        options.push({ partnerId: partner.id, partnerName: partner.name, partnerType: partner.type, eligible: false, reason: 'Parceiro sem tabela de preço vigente.' });
        continue;
      }

      const rules = await this.dataSource.query(
        `SELECT * FROM delivery_partner_rate_rules WHERE "rateTableId"=$1 ORDER BY priority,id`,
        [table.id],
      );
      const selected = rules.find((rule: any) => this.ruleMatches(rule, aggregate, destination, distanceMeters));
      if (!selected) {
        const needsDistance = rules.some((rule: any) => rule.minDistanceMeters != null || rule.maxDistanceMeters != null);
        options.push({
          partnerId: partner.id,
          partnerName: partner.name,
          partnerType: partner.type,
          eligible: false,
          reason: needsDistance && distanceMeters == null
            ? 'Não foi possível obter coordenadas suficientes para calcular a faixa por km deste CEP.'
            : 'Nenhuma regra vigente atende este endereço ou volume.',
        });
        continue;
      }

      const amountCents = this.rulePrice(selected, aggregate, distanceMeters);
      options.push({
        partnerId: partner.id,
        partnerName: partner.name,
        partnerType: partner.type,
        eligible: true,
        amountCents,
        estimatedMinutes: selected.estimatedMinutes == null ? null : Number(selected.estimatedMinutes),
        distanceMeters,
        rateTableVersion: Number(table.version),
        rateRuleId: selected.id,
      });
    }

    return {
      listingId: listing.id,
      quantity,
      destination,
      origin: {
        id: origin.id,
        name: origin.name,
        zipCode: origin.zipCode,
        city: origin.city,
        state: origin.state,
      },
      distanceMeters,
      distanceSource: distanceMeters == null ? 'UNAVAILABLE' : 'CEP_COORDINATES_HAVERSINE',
      options,
    };
  }

  private partnerRestriction(partner: any, aggregate: any, destination: any) {
    const cities = Array.isArray(partner.cities) ? partner.cities : [];
    if (cities.length) {
      const supported = cities.some((entry: any) =>
        String(entry?.city || entry || '').toLocaleLowerCase('pt-BR') === String(destination.city || '').toLocaleLowerCase('pt-BR')
        && (!entry?.state || String(entry.state).toUpperCase() === String(destination.state || '').toUpperCase()),
      );
      if (!supported) return 'Parceiro não atende esta cidade.';
    }
    if (partner.maxWeightGrams != null && (aggregate.weightGrams == null || aggregate.weightGrams > Number(partner.maxWeightGrams))) {
      return aggregate.weightGrams == null ? 'Informe o peso do produto para usar este parceiro.' : 'Peso excede o limite do parceiro.';
    }
    const dimensions: Array<[number | null, unknown, string]> = [
      [aggregate.maxLengthCm, partner.maxLengthCm, 'comprimento'],
      [aggregate.maxWidthCm, partner.maxWidthCm, 'largura'],
      [aggregate.maxHeightCm, partner.maxHeightCm, 'altura'],
      [aggregate.volumeCm3, partner.maxVolumeCm3, 'volume'],
    ];
    for (const [value, limit, label] of dimensions) {
      if (limit != null && value == null) return `Informe ${label} do produto para usar este parceiro.`;
      if (limit != null && value != null && value > Number(limit)) return `${label[0].toUpperCase()}${label.slice(1)} excede o limite do parceiro.`;
    }
    return null;
  }

  private ruleMatches(rule: any, aggregate: any, destination: any, distanceMeters: number | null) {
    if (rule.city && String(rule.city).toLocaleLowerCase('pt-BR') !== String(destination.city || '').toLocaleLowerCase('pt-BR')) return false;
    if (rule.state && String(rule.state).toUpperCase() !== String(destination.state || '').toUpperCase()) return false;
    if (rule.neighborhood && String(rule.neighborhood).toLocaleLowerCase('pt-BR') !== String(destination.neighborhood || '').toLocaleLowerCase('pt-BR')) return false;
    const zip = String(destination.zipCode || '').replace(/\D/g, '');
    if (rule.zipCodeStart && zip < String(rule.zipCodeStart).replace(/\D/g, '')) return false;
    if (rule.zipCodeEnd && zip > String(rule.zipCodeEnd).replace(/\D/g, '')) return false;
    if ((rule.minDistanceMeters != null || rule.maxDistanceMeters != null) && distanceMeters == null) return false;
    if (rule.minDistanceMeters != null && Number(distanceMeters) < Number(rule.minDistanceMeters)) return false;
    if (rule.maxDistanceMeters != null && Number(distanceMeters) > Number(rule.maxDistanceMeters)) return false;
    if (rule.maxWeightGrams != null && (aggregate.weightGrams == null || aggregate.weightGrams > Number(rule.maxWeightGrams))) return false;
    if (rule.maxLengthCm != null && (aggregate.maxLengthCm == null || aggregate.maxLengthCm > Number(rule.maxLengthCm))) return false;
    if (rule.maxWidthCm != null && (aggregate.maxWidthCm == null || aggregate.maxWidthCm > Number(rule.maxWidthCm))) return false;
    if (rule.maxHeightCm != null && (aggregate.maxHeightCm == null || aggregate.maxHeightCm > Number(rule.maxHeightCm))) return false;
    if (rule.maxVolumeCm3 != null && (aggregate.volumeCm3 == null || aggregate.volumeCm3 > Number(rule.maxVolumeCm3))) return false;
    return true;
  }

  private rulePrice(rule: any, aggregate: any, distanceMeters: number | null) {
    let cents = rule.fixedPriceCents == null ? 0 : Number(rule.fixedPriceCents);
    if (rule.fixedPriceCents == null && Number(rule.perKmCents || 0) > 0 && distanceMeters != null) {
      cents += Math.ceil(distanceMeters / 1000) * Number(rule.perKmCents || 0);
    }
    if (aggregate.weightGrams != null && Number(rule.weightAdditionalPerKgCents || 0) > 0) {
      cents += Math.ceil(aggregate.weightGrams / 1000) * Number(rule.weightAdditionalPerKgCents || 0);
    }
    return Math.max(Number(rule.minimumPriceCents || 0), Math.round(cents));
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

  private int(value: unknown, min: number, max: number, fallback: number) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }
}
