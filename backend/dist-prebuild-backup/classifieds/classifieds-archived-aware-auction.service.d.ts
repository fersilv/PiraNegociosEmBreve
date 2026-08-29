import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsAuctionGateway } from './classifieds-auction.gateway';
import { ClassifiedsAuctionService } from './classifieds-auction.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
export declare class ClassifiedsArchivedAwareAuctionService extends ClassifiedsAuctionService {
    private readonly archiveDataSource;
    private readonly archiveIdentities;
    constructor(archiveDataSource: DataSource, archiveIdentities: ClassifiedsIdentityService, notifications: NotificationsService, auctionGateway: ClassifiedsAuctionGateway);
    list(uid: string): Promise<any>;
    private ensureArchiveColumn;
}
