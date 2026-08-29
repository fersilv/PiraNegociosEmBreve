import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ExternalApiClient } from './entities/external-api-client.entity';
export declare class ApiKeyGuard implements CanActivate {
    private readonly clients;
    private readonly windows;
    constructor(clients: Repository<ExternalApiClient>);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
