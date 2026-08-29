import { ClassifiedsCheckoutService } from './classifieds-checkout.service';
export declare class ClassifiedsCheckoutWebhookController {
    private readonly checkout;
    constructor(checkout: ClassifiedsCheckoutService);
    mercadoPago(headers: Record<string, unknown>, query: Record<string, any>, body: Record<string, any>): Promise<{
        received: boolean;
        ignored: string;
    } | {
        received: boolean;
        ignored?: undefined;
    }>;
}
