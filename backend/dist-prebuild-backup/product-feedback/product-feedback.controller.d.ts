import { AiService } from '../ai/ai.service';
import { ProductFeedbackService } from './product-feedback.service';
import { SupportAssistantService } from './support-assistant.service';
export declare class ProductFeedbackController {
    private readonly feedback;
    private readonly ai;
    private readonly supportAssistant;
    constructor(feedback: ProductFeedbackService, ai: AiService, supportAssistant: SupportAssistantService);
    status(): Promise<{
        aiEnabled: boolean;
        assistantName: string;
    }>;
    submit(req: any, body: any): Promise<any>;
    expectations(req: any): Promise<any>;
    expectation(req: any, id: string, body: any): Promise<any>;
    mySupport(req: any): Promise<any>;
    supportChat(req: any, body: any): Promise<any>;
    escalate(req: any, id: string): Promise<any>;
}
export declare class AdminProductFeedbackController {
    private readonly feedback;
    constructor(feedback: ProductFeedbackService);
    private admin;
    overview(req: any): Promise<{
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
    analyze(req: any, body: any): Promise<{
        analyzed: boolean;
        reason: string;
        clusters?: undefined;
    } | {
        analyzed: boolean;
        clusters: number;
        reason?: undefined;
    }>;
    generateFaqs(req: any): Promise<{
        generated: boolean;
        reason: string;
        articles?: undefined;
    } | {
        generated: boolean;
        articles: number;
        reason?: undefined;
    }>;
    updateFaq(req: any, id: string, body: any): Promise<any>;
    update(req: any, id: string, body: any): Promise<any>;
    screenshot(req: any, source: 'feedback' | 'support', id: string): Promise<any>;
    reply(req: any, id: string, body: any): Promise<any>;
}
export declare class PublicFaqController {
    private readonly feedback;
    constructor(feedback: ProductFeedbackService);
    list(): Promise<any>;
    article(slug: string): Promise<any>;
}
