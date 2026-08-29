import { Repository } from 'typeorm';
import { Advertisement } from './entities/advertisement.entity';
import { AdvertisingConfig } from './entities/advertising-config.entity';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
export declare class AdvertisingController {
    private readonly advertisements;
    private readonly configs;
    private readonly companies;
    private readonly users;
    constructor(advertisements: Repository<Advertisement>, configs: Repository<AdvertisingConfig>, companies: Repository<Company>, users: Repository<User>);
    private normalizeOwner;
    publicAds(): Promise<Advertisement[]>;
    publicConfig(): Promise<AdvertisingConfig | {
        googleAdsEnabled: false;
        googleAdsClient: null;
        googleAdsSlotLeaderboard: null;
        googleAdsSlotRectangle: null;
    }>;
    listAds(): Promise<Advertisement[]>;
    createAd(data: Partial<Advertisement>): Promise<Advertisement>;
    updateAd(id: string, data: Partial<Advertisement>): Promise<Advertisement>;
    updateConfig(data: Partial<AdvertisingConfig>): Promise<AdvertisingConfig>;
}
