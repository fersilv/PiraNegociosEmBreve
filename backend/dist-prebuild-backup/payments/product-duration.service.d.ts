import { DataSource } from 'typeorm';
export declare class ProductDurationService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    update(code: string, rawDays: number): Promise<any>;
}
