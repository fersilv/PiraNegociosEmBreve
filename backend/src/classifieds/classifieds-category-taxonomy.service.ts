import { Injectable } from '@nestjs/common';
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
