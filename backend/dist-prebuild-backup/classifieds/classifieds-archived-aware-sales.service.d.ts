import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsSalesService } from './classifieds-sales.service';
export declare class ClassifiedsArchivedAwareSalesService extends ClassifiedsSalesService {
    private readonly reportingDataSource;
    private readonly reportingIdentities;
    constructor(reportingDataSource: DataSource, reportingIdentities: ClassifiedsIdentityService, entitlements: ClassifiedsEntitlementsService, notifications: NotificationsService);
    dashboard(uid: string): Promise<{
        totals: any;
        recentOrders: any;
        products: any;
        calendar: any;
    }>;
}
