import { SettingsService } from '../admin/settings.service';
type AiProvider = 'GEMINI' | 'OPENAI' | 'GROQ';
export type AiTextResult = {
    text: string;
    provider: AiProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimated: boolean;
};
export declare class AiService {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    private isProvider;
    private getRuntimeConfig;
    getStatus(): Promise<{
        enabled: boolean;
        provider: AiProvider | null;
        model: string | null;
    }>;
    getSupportStatus(): Promise<{
        assistantName: string;
        enabled: boolean;
        provider: AiProvider | null;
        model: string | null;
    }>;
    private usageResult;
    private buildSystemInstruction;
    private cleanFile;
    private parseJson;
    private geminiGenerate;
    private generateResumeWithGemini;
    private generateResumeWithOpenAi;
    private generateResumeWithGroq;
    analyzeResume(base64File: string, mimeType: string): Promise<any>;
    private generateText;
    supportChatReply(input: {
        message: string;
        pagePath: string;
        process: string;
        profile: Record<string, unknown>;
        history?: Array<{
            role: string;
            text: string;
        }>;
        screenshot?: {
            data: string;
            mimeType: string;
        } | null;
    }): Promise<AiTextResult>;
    generateSupportFaqs(questions: Array<{
        conversationId: string;
        process: string;
        pagePath: string;
        question: string;
    }>): Promise<{
        articles: any;
        usage: AiTextResult;
    }>;
    analyzeProductFeedback(items: Array<{
        id: string;
        message: string;
        pagePath: string;
        process: string;
        profileType: string;
        createdAt: string;
    }>): Promise<{
        clusters: any;
    }>;
    matchJobs(profile: unknown, jobs: unknown[], applications: unknown[]): Promise<{
        matches: any;
    }>;
}
export {};
