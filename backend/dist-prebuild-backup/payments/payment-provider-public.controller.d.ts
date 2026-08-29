import { PaymentProviderManagerService } from './payment-provider-manager.service';
export declare class PaymentProviderPublicController {
    private readonly providers;
    constructor(providers: PaymentProviderManagerService);
    activeProviderSummary(): Promise<{
        code: any;
        name: any;
        activeFor: any;
        capabilities: any;
        environment: any;
    }[]>;
}
