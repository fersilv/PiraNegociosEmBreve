import { PhotoAiService } from './photo-ai.service';
export declare class PhotoAiController {
    private readonly photoAiService;
    constructor(photoAiService: PhotoAiService);
    photoStatus(): Promise<{
        enabled: boolean;
        provider: ("GEMINI" | "OPENAI") | null;
        model: string | null;
    }>;
    professionalizePhoto(body: {
        image?: string;
    }): Promise<{
        image: string;
        provider: "GEMINI" | "OPENAI";
        model: string;
    }>;
}
