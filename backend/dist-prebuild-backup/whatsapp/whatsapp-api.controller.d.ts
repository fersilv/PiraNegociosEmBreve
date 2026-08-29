import { WhatsAppService } from './whatsapp.service';
export declare class WhatsAppApiController {
    private readonly whatsapp;
    constructor(whatsapp: WhatsAppService);
    status(id: string): Promise<{
        id: any;
        name: any;
        purpose: any;
        phoneNumber: any;
        provider: any;
        status: any;
        active: any;
        connected: any;
        lastConnectedAt: any;
        lastSeenAt: any;
        runtimeDetail: any;
        capabilities: any;
    }>;
    messages(id: string, limit?: string): Promise<import("./entities/whatsapp-message.entity").WhatsAppMessage[]>;
    sendMessage(id: string, body: {
        target?: string;
        text?: string;
        media?: string;
        filename?: string;
        caption?: string;
    }): Promise<{
        ok: boolean;
        chatId: string;
        result: any;
    }>;
    contacts(id: string): Promise<any[]>;
    savedContacts(id: string): Promise<import("./entities/whatsapp-contact.entity").WhatsAppSavedContact[]>;
    saveContact(id: string, body: {
        phoneNumber?: string;
        name?: string;
        notes?: string;
    }): Promise<import("./entities/whatsapp-contact.entity").WhatsAppSavedContact>;
    groups(id: string): Promise<any[]>;
    groupMessage(id: string, groupId: string, body: {
        text?: string;
    }): Promise<{
        ok: boolean;
        chatId: string;
        result: any;
    }>;
    channels(id: string): Promise<any[]>;
    channelPost(id: string, channelId: string, body: {
        text?: string;
    }): Promise<{
        ok: boolean;
        chatId: string;
        result: any;
    }>;
    publishStatus(id: string, body: {
        text?: string;
        media?: string;
        caption?: string;
    }): Promise<{
        ok: boolean;
    }>;
    private publicStatus;
}
