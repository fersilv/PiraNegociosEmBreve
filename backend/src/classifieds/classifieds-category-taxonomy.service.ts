import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
] as const;

@Injectable()
export class ClassifiedsCategoryTaxonomyService {
  constructor(private readonly dataSource: DataSource) {}

  async categories() {
    await this.ensureServiceTaxonomy();
    return this.dataSource.query(
      `SELECT slug,name,icon,"parentSlug","sortOrder","isActive","attributeSchema"
       FROM classified_categories
       WHERE "isActive"=true
       ORDER BY "sortOrder" ASC,name ASC`,
    );
  }

  async assertCompatible(categorySlugRaw: unknown, listingTypeRaw: unknown, attributesRaw?: unknown) {
    await this.ensureServiceTaxonomy();
    const categorySlug = String(categorySlugRaw || '').trim();
    const listingType = String(listingTypeRaw || '').trim().toUpperCase();
    if (!categorySlug || !['PRODUCT', 'SERVICE'].includes(listingType)) {
      throw new BadRequestException('Informe o tipo e a categoria do anúncio.');
    }

    const rows = await this.dataSource.query(
      `SELECT slug,"parentSlug","isActive" FROM classified_categories WHERE slug=$1 LIMIT 1`,
      [categorySlug],
    );
    const category = rows[0];
    if (!category?.isActive) throw new BadRequestException('Categoria inválida ou inativa.');

    const serviceCategory = category.parentSlug === 'servicos';
    if (listingType === 'SERVICE' && !serviceCategory) {
      throw new BadRequestException('Escolha uma categoria própria de serviços.');
    }
    if (listingType === 'PRODUCT' && (serviceCategory || category.slug === 'servicos')) {
      throw new BadRequestException('Escolha uma categoria própria de produtos.');
    }

    const needsCustom = (listingType === 'SERVICE' && category.slug === 'servicos-outros')
      || (listingType === 'PRODUCT' && category.slug === 'outros');
    if (needsCustom) {
      const attributes = attributesRaw && typeof attributesRaw === 'object' && !Array.isArray(attributesRaw)
        ? attributesRaw as Record<string, unknown>
        : {};
      const custom = String(attributes.customCategory || '').trim();
      if (!custom) throw new BadRequestException(listingType === 'SERVICE' ? 'Digite qual serviço você oferece.' : 'Digite qual é a categoria do produto.');
    }
  }

  private async ensureServiceTaxonomy() {
    await this.dataSource.query(
      `INSERT INTO classified_categories(slug,name,icon,"parentSlug","sortOrder","isActive","attributeSchema")
       VALUES ('servicos','Serviços','wrench',NULL,200,true,'[]'::jsonb)
       ON CONFLICT (slug) DO UPDATE SET "isActive"=true`,
    );

    for (const [slug, name, icon, sortOrder] of SERVICE_CATEGORIES) {
      await this.dataSource.query(
        `INSERT INTO classified_categories(slug,name,icon,"parentSlug","sortOrder","isActive","attributeSchema")
         VALUES ($1,$2,$3,'servicos',$4,true,'[]'::jsonb)
         ON CONFLICT (slug) DO UPDATE SET
           name=EXCLUDED.name,
           icon=EXCLUDED.icon,
           "parentSlug"='servicos',
           "sortOrder"=EXCLUDED."sortOrder",
           "isActive"=true`,
        [slug, name, icon, sortOrder],
      );
    }
  }
}
