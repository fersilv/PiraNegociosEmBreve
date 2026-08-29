import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
export declare class ClassifiedsEntitlementsService {
    private readonly dataSource;
    private readonly identities;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService);
    limits(uid: string): Promise<{
        photoLimit: number;
        plan: string;
        paid: boolean;
        auctionCreation: boolean;
    }>;
    assertImageLimit(uid: string, rawImages: unknown): Promise<{
        photoLimit: number;
        plan: string;
        paid: boolean;
        auctionCreation: boolean;
    }>;
    assertAuctionCreation(uid: string): Promise<{
        allowed: boolean;
        plan: "ELITE";
        companyId: string;
    }>;
    assertAuctionParticipant(uid: string): Promise<{
        allowed: boolean;
        userId: string;
        email: string;
        whatsapp: string | null;
        photoURL: string;
    }>;
    companyPlan(companyId: string): Promise<'FREE' | 'PLUS' | 'ELITE'>;
}
