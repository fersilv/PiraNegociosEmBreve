export declare class ExternalApiRequest {
    id: string;
    clientId: string;
    action: string;
    jobId: string | null;
    result: string;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
}
