import { ClassifiedsAuctionManagementService } from './classifieds-auction-management.service';
export declare class ClassifiedsAuctionManagementController {
    private readonly management;
    constructor(management: ClassifiedsAuctionManagementService);
    list(req: any): Promise<any>;
    detail(req: any, auctionId: string): Promise<any>;
    updateSettlement(req: any, auctionId: string, body: {
        status?: unknown;
    }): Promise<any>;
}
