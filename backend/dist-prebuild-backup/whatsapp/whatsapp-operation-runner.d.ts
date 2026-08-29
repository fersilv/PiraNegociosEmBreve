import { WhatsAppService } from './whatsapp.service';
type BufferedWppEvent = {
    at: string;
    event: string;
    args: unknown[];
};
export declare function executeWppOperation(whatsapp: WhatsAppService, instanceId: string, scope: string, args?: unknown[]): Promise<{
    operation: string;
    scope: string;
    result: unknown;
    mode?: undefined;
    subscribed?: undefined;
    retainedEvents?: undefined;
    note?: undefined;
    signature?: undefined;
} | {
    operation: string;
    scope: string;
    mode: string;
    result: unknown;
    subscribed?: undefined;
    retainedEvents?: undefined;
    note?: undefined;
    signature?: undefined;
} | {
    operation: string;
    scope: string;
    mode: string;
    subscribed: boolean;
    retainedEvents: number;
    result: BufferedWppEvent[];
    note: string;
    signature?: undefined;
} | {
    operation: string;
    scope: string;
    signature: string;
    result: unknown;
    mode?: undefined;
    subscribed?: undefined;
    retainedEvents?: undefined;
    note?: undefined;
}>;
export {};
