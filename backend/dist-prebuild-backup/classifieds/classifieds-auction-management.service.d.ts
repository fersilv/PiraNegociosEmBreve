import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
export type AuctionSettlementStatus = 'PENDING' | 'CONTACTED' | 'AGREED' | 'COMPLETED' | 'CANCELED';
export declare class ClassifiedsAuctionManagementService {
    private readonly dataSource;
    private readonly identities;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService);
    list(uid: string): Promise<any>;
    detail(uid: string, auctionId: string): Promise<any>;
    updateSettlement(uid: string, auctionId: string, rawStatus: unknown): Promise<any>;
    assertCooldown(listingId: string): Promise<{
        ok: boolean;
    }>;
    private present;
    private maskName;
}
