"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifiedsLocationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let ClassifiedsLocationService = class ClassifiedsLocationService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async upsert(listingId, userId, input, defaults = {}) {
        const source = this.source(input.locationSource);
        const latitude = this.coordinate(input.latitude, -90, 90, 'Latitude inválida.');
        const longitude = this.coordinate(input.longitude, -180, 180, 'Longitude inválida.');
        const address = this.text(input.privateAddress ?? input.address ?? defaults.address, 1000);
        const zipCode = this.text(input.zipCode ?? defaults.zipCode, 20);
        if ((latitude == null) !== (longitude == null))
            throw new common_1.BadRequestException('Latitude e longitude precisam ser informadas juntas.');
        if (!address && !zipCode && latitude == null && longitude == null) {
            await this.dataSource.query(`DELETE FROM classified_listing_private_locations WHERE "listingId"=$1`, [listingId]).catch(() => undefined);
            return null;
        }
        const rows = await this.dataSource.query(`INSERT INTO classified_listing_private_locations
        ("listingId",address,"zipCode",latitude,longitude,source,"updatedByUserId","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT ("listingId") DO UPDATE SET address=EXCLUDED.address,"zipCode"=EXCLUDED."zipCode",latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,source=EXCLUDED.source,"updatedByUserId"=EXCLUDED."updatedByUserId","updatedAt"=now()
       RETURNING *`, [listingId, address, zipCode, latitude, longitude, source, userId]);
        return rows[0] || null;
    }
    async forListings(listingIds) {
        const ids = [...new Set(listingIds.filter(Boolean))];
        if (!ids.length)
            return new Map();
        const rows = await this.dataSource.query(`SELECT * FROM classified_listing_private_locations WHERE "listingId"=ANY($1::uuid[])`, [ids]).catch(() => []);
        return new Map(rows.map((row) => [row.listingId, row]));
    }
    async distances(listingIds, lat, lng) {
        const ids = [...new Set(listingIds.filter(Boolean))];
        if (!ids.length)
            return new Map();
        const rows = await this.dataSource.query(`SELECT "listingId",6371 * 2 * asin(sqrt(
         power(sin(radians(latitude::double precision - $2) / 2),2) +
         cos(radians($2))*cos(radians(latitude::double precision))*power(sin(radians(longitude::double precision - $3) / 2),2)
       )) AS "distanceKm"
       FROM classified_listing_private_locations
       WHERE "listingId"=ANY($1::uuid[]) AND latitude IS NOT NULL AND longitude IS NOT NULL`, [ids, lat, lng]).catch(() => []);
        return new Map(rows.map((row) => [row.listingId, Number(row.distanceKm)]));
    }
    source(value) { const s = String(value || 'PROFILE').toUpperCase(); return ['PROFILE', 'COMPANY_PROFILE', 'MANUAL', 'DEVICE'].includes(s) ? s : 'PROFILE'; }
    text(value, max) { const v = String(value ?? '').trim().slice(0, max); return v || null; }
    coordinate(value, min, max, message) { if (value === undefined || value === null || value === '')
        return null; const n = Number(value); if (!Number.isFinite(n) || n < min || n > max)
        throw new common_1.BadRequestException(message); return n; }
};
exports.ClassifiedsLocationService = ClassifiedsLocationService;
exports.ClassifiedsLocationService = ClassifiedsLocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ClassifiedsLocationService);
//# sourceMappingURL=classifieds-location.service.js.map