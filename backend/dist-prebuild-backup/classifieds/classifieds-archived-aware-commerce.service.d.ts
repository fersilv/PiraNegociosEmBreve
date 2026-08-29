import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsAiReviewService } from './classifieds-ai-review.service';
import { ClassifiedsCommerceService } from './classifieds-commerce.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
export declare class ClassifiedsArchivedAwareCommerceService extends ClassifiedsCommerceService {
    private readonly reportingDataSource;
    private readonly reportingIdentities;
    constructor(reportingDataSource: DataSource, reportingIdentities: ClassifiedsIdentityService, notifications: NotificationsService, aiReview: ClassifiedsAiReviewService);
    analytics(uid: string): Promise<{
        totals: any;
        listings: any;
        daily: any;
    }>;
}
