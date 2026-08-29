import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { WhatsAppPhoneOtp } from './entities/whatsapp-concierge.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';
import { WhatsAppService } from './whatsapp.service';
export declare class WhatsAppPhoneVerificationService {
    private readonly users;
    private readonly instances;
    private readonly otps;
    private readonly whatsapp;
    private readonly logger;
    constructor(users: Repository<User>, instances: Repository<WhatsAppInstance>, otps: Repository<WhatsAppPhoneOtp>, whatsapp: WhatsAppService);
    status(userId: string): Promise<{
        verified: boolean;
        phoneE164: string | null;
        whatsappId: string | null;
        verifiedAt: Date | null;
    }>;
    request(userId: string, rawPhone: string): Promise<{
        ok: boolean;
        phone: string;
        expiresAt: Date;
        message: string;
    }>;
    verify(userId: string, rawPhone: string, rawCode: string): Promise<{
        ok: boolean;
        verified: boolean;
        phoneE164: string;
        whatsappId: string;
        verifiedAt: Date;
    }>;
    private primaryInstance;
    private requireUser;
    private canonicalBrazilPhone;
    private extractWhatsappId;
    private serializeWid;
    private hashCode;
    private mask;
}
