import { SettingsService } from '../admin/settings.service';
export interface ResumeSourceDocumentInput {
    base64File: string;
    mimeType?: string;
    fileName?: string;
}
export declare class ResumeImportService {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    private isProvider;
    private getRuntimeConfig;
    private extension;
    private normalizedMimeType;
    private decodeRtf;
    private extractWordText;
    private cleanDocument;
    private prepareDocuments;
    private parseJson;
    private buildSystemInstruction;
    private withGemini;
    private withOpenAi;
    private withGroq;
    importDocuments(inputs: ResumeSourceDocumentInput[]): Promise<{
        documentsProcessed: number;
    }>;
}
