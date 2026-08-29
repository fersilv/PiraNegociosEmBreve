import { DataSource } from 'typeorm';
export declare class CompanyContextRepairService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    repair(uid: string): Promise<{
        companyId: any;
        companyName: any;
        owner: boolean;
        membership: any;
    } | null>;
}
