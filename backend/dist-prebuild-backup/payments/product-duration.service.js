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
exports.ProductDurationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let ProductDurationService = class ProductDurationService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async update(code, rawDays) {
        const days = Math.round(Number(rawDays));
        if (!Number.isFinite(days) || days < 1 || days > 3650) {
            throw new common_1.BadRequestException('A duração deve ficar entre 1 e 3650 dias.');
        }
        const rows = await this.dataSource.query(`UPDATE payment_products SET "durationDays" = $2, "updatedAt" = now() WHERE code = $1 RETURNING *`, [code, days]);
        if (!rows[0])
            throw new common_1.NotFoundException('Produto não encontrado.');
        return rows[0];
    }
};
exports.ProductDurationService = ProductDurationService;
exports.ProductDurationService = ProductDurationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ProductDurationService);
//# sourceMappingURL=product-duration.service.js.map