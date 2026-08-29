import { SettingsService } from '../admin/settings.service';
type ImageAiProvider = 'GEMINI' | 'OPENAI';
export declare class PhotoAiService {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    private isProvider;
    private isOpenAiEditableImageModel;
    private isGeminiImageModel;
    getStatus(): Promise<{
        enabled: boolean;
        provider: ImageAiProvider | null;
        model: string | null;
    }>;
    private getRuntimeConfig;
    private parseImageDataUrl;
    private findBase64Image;
    private professionalizeWithGemini;
    private professionalizeWithOpenAi;
    professionalize(image: string): Promise<{
        image: string;
        provider: ImageAiProvider;
        model: string;
    }>;
}
export {};
