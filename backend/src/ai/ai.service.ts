import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SettingsService } from '../admin/settings.service';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiService {
  constructor(private readonly settingsService: SettingsService) {}

  private async getGeminiClient(): Promise<GoogleGenAI> {
    const apiKey = await this.settingsService.getValue('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('A chave de API do Gemini não está configurada.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }

  async analyzeResume(base64File: string, mimeType: string) {
    // Cleanup base64 string prefix
    let cleanBase64 = base64File;
    const cleanMimeType = mimeType || "application/pdf";

    if (base64File.startsWith("data:")) {
      const parts = base64File.split(";base64,");
      if (parts.length === 2) {
        cleanBase64 = parts[1];
      }
    }

    const ai = await this.getGeminiClient();

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: cleanMimeType,
                },
              },
              {
                text: `Extraia as seguintes informações deste currículo e retorne **EXCLUSIVAMENTE** em formato JSON, sem crases, sem formatação markdown e sem texto adicional:

{
  "name": "Nome Completo (se não achar, deixe null)",
  "phone": "Telefone (se não achar, deixe null)",
  "email": "Email (se não achar, deixe null)",
  "bio": "Resumo Profissional (se não achar, deixe null)",
  "experiences": [
    { "role": "Cargo", "company": "Empresa", "startDate": "Mês/Ano", "endDate": "Mês/Ano ou Atual", "current": true/false, "description": "Resumo das atividades" }
  ],
  "education": [
    { "institution": "Instituição", "degree": "Grau", "fieldOfStudy": "Área", "startYear": "Ano", "endYear": "Ano", "current": true/false }
  ],
  "skills": ["Habilidade 1", "Habilidade 2"],
  "courses": [
    { "name": "Nome", "institution": "Instituição", "year": "Ano" }
  ]
}

REGRAS:
1. Retorne apenas um JSON válido. O root do JSON não deve ter marcação \`\`\`json.
2. Seja preciso e extraia o máximo que conseguir.
3. Se algo não existir, use null ou array vazio [].`,
              },
            ],
          },
        ],
      });

      const responseText = response.text || "{}";
      const cleanedJsonStr = responseText.replace(/```json/gi, "").replace(/```/gi, "").trim();
      return JSON.parse(cleanedJsonStr);
    } catch (e: any) {
      console.error("AI Service Error:", e);
      throw new InternalServerErrorException("Erro ao processar currículo com a inteligência artificial.");
    }
  }

  // TODO: job-match
}
