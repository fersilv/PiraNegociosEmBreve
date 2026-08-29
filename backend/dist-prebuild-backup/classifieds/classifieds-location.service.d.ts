import { DataSource } from 'typeorm';
export type ClassifiedLocationSource = 'PROFILE' | 'COMPANY_PROFILE' | 'MANUAL' | 'DEVICE';
export declare class ClassifiedsLocationService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    upsert(listingId: string, userId: string, input: Record<string, unknown>, defaults?: {
        address?: string | null;
        zipCode?: string | null;
    }): Promise<any>;
    forListings(listingIds: string[]): Promise<Map<unknown, unknown> | Map<string, any>>;
    distances(listingIds: string[], lat: number, lng: number): Promise<Map<unknown, unknown>>;
    private source;
    private text;
    private coordinate;
}
