import { WhatsAppService } from './whatsapp.service';
type ChannelMediaType = 'image' | 'document' | 'audio' | 'video';
type ChannelMediaOptions = {
    media: string;
    type: ChannelMediaType;
    caption?: string;
    filename?: string;
    mimetype?: string;
    asVoice?: boolean;
};
export declare function publishChannelLink(whatsapp: WhatsAppService, instanceId: string, newsletterIdRaw: string, urlRaw: string): Promise<{
    operation: string;
    mode: string;
    result: any;
}>;
export declare function publishChannelTextWithLink(whatsapp: WhatsAppService, instanceId: string, newsletterIdRaw: string, textRaw: string, urlRaw: string): Promise<{
    operation: string;
    mode: string;
    result: any;
}>;
export declare function publishChannelMedia(whatsapp: WhatsAppService, instanceId: string, newsletterIdRaw: string, options: ChannelMediaOptions): Promise<{
    operation: string;
    scope: string;
    mode: string;
    ok: boolean;
    result: any;
}>;
export {};
