import { DataSource, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { User } from '../users/entities/user.entity';
import { ProductFeedbackService } from './product-feedback.service';
import { SupportContextService } from './support-context.service';
export declare class SupportAssistantService {
    private readonly dataSource;
    private readonly users;
    private readonly ai;
    private readonly feedback;
    private readonly contexts;
    constructor(dataSource: DataSource, users: Repository<User>, ai: AiService, feedback: ProductFeedbackService, contexts: SupportContextService);
    chat(userId: string, input: any): Promise<any>;
    private recordAiUsage;
    private text;
    private message;
    private screenshot;
    private withoutScreenshotData;
}
