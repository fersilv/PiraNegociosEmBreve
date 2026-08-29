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
exports.ClassifiedsCategoryTaxonomyService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const SERVICE_CATEGORIES = [
    ['servicos-limpeza', 'Limpeza e conservação', 'sparkles', 210],
    ['servicos-manutencao', 'Manutenção e reparos', 'wrench', 220],
    ['servicos-construcao', 'Construção e reformas', 'hammer', 230],
    ['servicos-tecnologia', 'Tecnologia e informática', 'laptop', 240],
    ['servicos-design-marketing', 'Design, marketing e conteúdo', 'palette', 250],
    ['servicos-beleza', 'Beleza e bem-estar', 'scissors', 260],
    ['servicos-aulas', 'Aulas e educação', 'graduation-cap', 270],
    ['servicos-eventos', 'Eventos e fotografia', 'camera', 280],
    ['servicos-transporte', 'Transporte e entregas', 'truck', 290],
    ['servicos-profissionais', 'Serviços profissionais', 'briefcase-business', 300],
    ['servicos-outros', 'Outro serviço', 'ellipsis', 390],
];
let ClassifiedsCategoryTaxonomyService = class ClassifiedsCategoryTaxonomyService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async categories() {
        await this.ensureServiceTaxonomy();
        return this.dataSource.query(`SELECT slug,name,icon,"parentSlug","sortOrder","isActive","attributeSchema"
       FROM classified_categories
       WHERE "isActive"=true
       ORDER BY "sortOrder" ASC,name ASC`);
    }
    async assertCompatible(categorySlugRaw, listingTypeRaw, attributesRaw) {
        await this.ensureServiceTaxonomy();
        const categorySlug = String(categorySlugRaw || '').trim();
        const listingType = String(listingTypeRaw || '').trim().toUpperCase();
        if (!categorySlug || !['PRODUCT', 'SERVICE'].includes(listingType)) {
            throw new common_1.BadRequestException('Informe o tipo e a categoria do anúncio.');
        }
        const rows = await this.dataSource.query(`SELECT slug,"parentSlug","isActive" FROM classified_categories WHERE slug=$1 LIMIT 1`, [categorySlug]);
        const category = rows[0];
        if (!category?.isActive)
            throw new common_1.BadRequestException('Categoria inválida ou inativa.');
        const serviceCategory = category.parentSlug === 'servicos';
        if (listingType === 'SERVICE' && !serviceCategory) {
            throw new common_1.BadRequestException('Escolha uma categoria própria de serviços.');
        }
        if (listingType === 'PRODUCT' && (serviceCategory || category.slug === 'servicos')) {
            throw new common_1.BadRequestException('Escolha uma categoria própria de produtos.');
        }
        const needsCustom = (listingType === 'SERVICE' && category.slug === 'servicos-outros')
            || (listingType === 'PRODUCT' && category.slug === 'outros');
        if (needsCustom) {
            const attributes = attributesRaw && typeof attributesRaw === 'object' && !Array.isArray(attributesRaw)
                ? attributesRaw
                : {};
            const custom = String(attributes.customCategory || '').trim();
            if (!custom)
                throw new common_1.BadRequestException(listingType === 'SERVICE' ? 'Digite qual serviço você oferece.' : 'Digite qual é a categoria do produto.');
        }
    }
    async ensureServiceTaxonomy() {
        await this.dataSource.query(`INSERT INTO classified_categories(slug,name,icon,"parentSlug","sortOrder","isActive","attributeSchema")
       VALUES ('servicos','Serviços','wrench',NULL,200,true,'[]'::jsonb)
       ON CONFLICT (slug) DO UPDATE SET "isActive"=true`);
        for (const [slug, name, icon, sortOrder] of SERVICE_CATEGORIES) {
            await this.dataSource.query(`INSERT INTO classified_categories(slug,name,icon,"parentSlug","sortOrder","isActive","attributeSchema")
         VALUES ($1,$2,$3,'servicos',$4,true,'[]'::jsonb)
         ON CONFLICT (slug) DO UPDATE SET
           name=EXCLUDED.name,
           icon=EXCLUDED.icon,
           "parentSlug"='servicos',
           "sortOrder"=EXCLUDED."sortOrder",
           "isActive"=true`, [slug, name, icon, sortOrder]);
        }
    }
};
exports.ClassifiedsCategoryTaxonomyService = ClassifiedsCategoryTaxonomyService;
exports.ClassifiedsCategoryTaxonomyService = ClassifiedsCategoryTaxonomyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ClassifiedsCategoryTaxonomyService);
//# sourceMappingURL=classifieds-category-taxonomy.service.js.map