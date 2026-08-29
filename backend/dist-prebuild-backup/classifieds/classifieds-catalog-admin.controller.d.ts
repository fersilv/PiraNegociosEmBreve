import { ClassifiedsCatalogAdminService } from './classifieds-catalog-admin.service';
export declare class ClassifiedsCatalogAdminController {
    private readonly catalog;
    constructor(catalog: ClassifiedsCatalogAdminService);
    summary(): Promise<{
        products: number;
        services: number;
        published: number;
        paused: number;
        pendingReview: number;
        archivedListings: number;
        auctions: number;
        activeAuctions: number;
        archivedAuctions: number;
    }>;
    listings(query: Record<string, unknown>): Promise<{
        items: any;
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    listing(id: string): Promise<any>;
    updateListing(req: any, id: string, body: Record<string, unknown>): Promise<any>;
    archiveListing(req: any, id: string): Promise<any>;
    restoreListing(id: string): Promise<any>;
    deleteListing(req: any, id: string): Promise<{
        deleted: boolean;
        soft: boolean;
        id: any;
        title: any;
        deletedAt: any;
    }>;
    auctions(query: Record<string, unknown>): Promise<{
        items: any;
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    archiveAuction(req: any, id: string): Promise<any>;
    restoreAuction(id: string): Promise<any>;
    cancelAuction(id: string): Promise<any>;
    deleteAuction(req: any, id: string): Promise<{
        deleted: boolean;
        soft: boolean;
        id: any;
        listingId: any;
        deletedAt: any;
    }>;
}
