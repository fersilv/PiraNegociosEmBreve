import { DataSource, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
export declare class ProductFeedbackService {
    private readonly dataSource;
    private readonly users;
    private readonly ai;
    private readonly notifications;
    private tablesReady;
    constructor(dataSource: DataSource, users: Repository<User>, ai: AiService, notifications: NotificationsService);
    private ensureTables;
    private user;
    assertAdmin(userId: string): Promise<User>;
    private text;
    private screenshot;
    private profileSnapshot;
    private recordAiUsage;
    private slug;
    submit(userId: string, input: any): Promise<any>;
    mineAwaitingExpectation(userId: string): Promise<any>;
    respondExpectation(userId: string, id: string, input: any): Promise<any>;
    private withoutScreenshotData;
    overview(): Promise<{
        feedback: any;
        insights: any;
        conversations: any;
        aiUsage: {
            summary: any;
            byFeature: any;
            daily: any;
            topUsers: any;
            logs: any;
        };
        faqs: any;
        lastAnalyzedAt: any;
    }>;
    updateFeedback(id: string, input: any): Promise<any>;
    screenshotForAdmin(source: 'feedback' | 'support', id: string): Promise<any>;
    private fallbackClusters;
    analyze(force?: boolean): Promise<{
        analyzed: boolean;
        reason: string;
        clusters?: undefined;
    } | {
        analyzed: boolean;
        clusters: number;
        reason?: undefined;
    }>;
    private message;
    mySupport(userId: string): Promise<any>;
    supportChat(userId: string, input: any): Promise<any>;
    escalateSupport(userId: string, id: string): Promise<any>;
    generateFaqs(force?: boolean): Promise<{
        generated: boolean;
        reason: string;
        articles?: undefined;
    } | {
        generated: boolean;
        articles: number;
        reason?: undefined;
    }>;
    updateFaq(id: string, input: any): Promise<any>;
    publicFaqs(slug?: string): Promise<any>;
    adminReply(id: string, input: any): Promise<any>;
}
