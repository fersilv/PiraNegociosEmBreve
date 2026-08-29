import { DataSource } from 'typeorm';
export declare class ClassifiedsCategoryTaxonomyService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    categories(): Promise<any>;
    assertCompatible(categorySlugRaw: unknown, listingTypeRaw: unknown, attributesRaw?: unknown): Promise<void>;
    private ensureServiceTaxonomy;
}
