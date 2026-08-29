import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import type { SupportKnowledgeBundle } from './support-knowledge.types';
export declare class SupportContextService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    resolve(user: User, input: {
        message: string;
        pagePath: string;
        process?: string;
    }): Promise<SupportKnowledgeBundle>;
    private scoreTopic;
    private routeScore;
    private procedureScore;
    private isRestrictedRequest;
    private loadLiveFacts;
    private renderKnowledge;
}
