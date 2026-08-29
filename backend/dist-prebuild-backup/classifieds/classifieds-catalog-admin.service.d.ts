import { DataSource } from 'typeorm';
export declare class ClassifiedsCatalogAdminService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
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
    updateListing(id: string, adminUserId: string, body: Record<string, unknown>): Promise<any>;
    archiveListing(id: string, adminUserId: string): Promise<any>;
    restoreListing(id: string): Promise<any>;
    deleteListing(id: string, adminUserId?: string): Promise<{
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
    archiveAuction(id: string, adminUserId: string): Promise<any>;
    restoreAuction(id: string): Promise<any>;
    cancelAuction(id: string): Promise<any>;
    deleteAuction(id: string, adminUserId?: string): Promise<{
        deleted: boolean;
        soft: boolean;
        id: any;
        listingId: any;
        deletedAt: any;
    }>;
    private ensureSchema;
}
