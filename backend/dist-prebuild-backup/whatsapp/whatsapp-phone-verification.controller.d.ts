import { WhatsAppPhoneVerificationService } from './whatsapp-phone-verification.service';
export declare class WhatsAppPhoneVerificationController {
    private readonly verification;
    constructor(verification: WhatsAppPhoneVerificationService);
    status(req: any): Promise<{
        verified: boolean;
        phoneE164: string | null;
        whatsappId: string | null;
        verifiedAt: Date | null;
    }>;
    requestOtp(req: any, body: {
        phone?: string;
    }): Promise<{
        ok: boolean;
        phone: string;
        expiresAt: Date;
        message: string;
    }>;
    verifyOtp(req: any, body: {
        phone?: string;
        code?: string;
    }): Promise<{
        ok: boolean;
        verified: boolean;
        phoneE164: string;
        whatsappId: string;
        verifiedAt: Date;
    }>;
}
