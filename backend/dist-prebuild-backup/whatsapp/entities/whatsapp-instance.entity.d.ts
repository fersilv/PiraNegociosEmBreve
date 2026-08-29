export declare enum WhatsAppConnectionStatus {
    DISCONNECTED = "DISCONNECTED",
    CONNECTING = "CONNECTING",
    QR_REQUIRED = "QR_REQUIRED",
    CONNECTED = "CONNECTED",
    ERROR = "ERROR"
}
export declare class WhatsAppInstance {
    id: string;
    name: string;
    purpose: string | null;
    phoneNumber: string | null;
    sessionName: string;
    provider: string;
    status: WhatsAppConnectionStatus;
    allowedScopes: string[];
    active: boolean;
    isPrimarySupport: boolean;
    conciergeEnabled: boolean;
    lastError: string | null;
    lastConnectedAt: Date | null;
    lastSeenAt: Date | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
}
