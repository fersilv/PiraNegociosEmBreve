import { ClassifiedsLifecycleService } from './classifieds-lifecycle.service';
export declare class ClassifiedsLifecycleController {
    private readonly lifecycle;
    constructor(lifecycle: ClassifiedsLifecycleService);
    archiveListing(req: any, id: string): Promise<any>;
    restoreListing(req: any, id: string): Promise<any>;
    republishListing(req: any, id: string): Promise<any>;
    markSold(req: any, id: string): Promise<any>;
    setUniqueItem(req: any, id: string, body: {
        unique?: unknown;
    }): Promise<any>;
    deleteListing(req: any, id: string): Promise<any>;
    archiveAuction(req: any, id: string): Promise<any>;
    restoreAuction(req: any, id: string): Promise<any>;
    deleteAuction(req: any, id: string): Promise<any>;
}
