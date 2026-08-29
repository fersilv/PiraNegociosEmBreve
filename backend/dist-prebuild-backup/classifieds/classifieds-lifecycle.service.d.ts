import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
export declare class ClassifiedsLifecycleService {
    private readonly dataSource;
    private readonly identities;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService);
    archiveListing(uid: string, id: string): Promise<any>;
    restoreListing(uid: string, id: string): Promise<any>;
    republishListing(uid: string, id: string): Promise<any>;
    markSold(uid: string, id: string): Promise<any>;
    setUniqueItem(uid: string, id: string, uniqueRaw: unknown): Promise<any>;
    deleteListing(uid: string, id: string): Promise<any>;
    archiveAuction(uid: string, id: string): Promise<any>;
    restoreAuction(uid: string, id: string): Promise<any>;
    deleteAuction(uid: string, id: string): Promise<any>;
    private assertListingOwner;
    private assertAuctionOwner;
    private ensureSchema;
}
