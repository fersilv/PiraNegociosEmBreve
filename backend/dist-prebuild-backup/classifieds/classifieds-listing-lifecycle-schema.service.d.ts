import { OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
export declare class ClassifiedsListingLifecycleSchemaService implements OnModuleInit {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    onModuleInit(): void;
    ensure(): Promise<void>;
}
