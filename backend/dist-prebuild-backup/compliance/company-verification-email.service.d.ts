export declare class CompanyVerificationEmailService {
    send(data: {
        to: string;
        partnerName: string;
        companyName: string;
        requestedByName: string;
        inviteUrl: string;
        expiresAt: Date;
    }): Promise<{
        status: "NOT_CONFIGURED";
        error?: undefined;
        messageId?: undefined;
    } | {
        status: "FAILED";
        error: string;
        messageId?: undefined;
    } | {
        status: "SENT";
        messageId: any;
        error?: undefined;
    }>;
}
