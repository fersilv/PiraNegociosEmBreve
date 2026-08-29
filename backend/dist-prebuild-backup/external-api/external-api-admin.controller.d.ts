import { Repository } from 'typeorm';
import { ExternalApiClient } from './entities/external-api-client.entity';
import { ExternalApiRequest } from './entities/external-api-request.entity';
export declare class ExternalApiAdminController {
    private readonly clients;
    private readonly requests;
    constructor(clients: Repository<ExternalApiClient>, requests: Repository<ExternalApiRequest>);
    list(): Promise<ExternalApiClient[]>;
    create(req: any, data: {
        name?: string;
        sourceLabel?: string;
    }): Promise<{
        client: {
            id: string;
            name: string;
            sourceLabel: string;
            keyPrefix: string;
            active: boolean;
        };
        apiKey: string;
        warning: string;
    }>;
    update(id: string, data: {
        active?: boolean;
        name?: string;
        sourceLabel?: string;
    }): Promise<ExternalApiClient>;
    rotate(id: string): Promise<{
        apiKey: string;
        warning: string;
    }>;
    usage(id: string, query: {
        page?: string;
        pageSize?: string;
    }): Promise<{
        data: ExternalApiRequest[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    private newKey;
    private hash;
}
