import { WhatsAppService } from './whatsapp.service';
export declare class WhatsAppMcpController {
    private readonly whatsapp;
    constructor(whatsapp: WhatsAppService);
    handle(instanceId: string, req: any, res: any): Promise<void>;
    private safeConnectionStatus;
    private result;
    private mediaResult;
    private safeStringify;
}
