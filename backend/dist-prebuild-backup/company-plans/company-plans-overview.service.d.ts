import { DataSource } from 'typeorm';
import { CompanyPlansService } from './company-plans.service';
export declare class CompanyPlansOverviewService {
    private readonly dataSource;
    private readonly plans;
    constructor(dataSource: DataSource, plans: CompanyPlansService);
    getForUser(userId: string): Promise<any>;
    private subscription;
    private fallback;
    private freeCurrent;
    private normalizePlan;
    private firstMoney;
    private statusLabel;
    private planScopes;
    private isSchemaGap;
}
