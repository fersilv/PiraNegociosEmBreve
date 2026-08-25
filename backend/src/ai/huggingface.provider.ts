import OpenAI from 'openai';

const HUGGINGFACE_ROUTER_BASE_URL = 'https://router.huggingface.co/v1';

export type HuggingFaceTextResult = {
  text: string;
  usage: { input?: number; output?: number };
};

export async function huggingFaceGenerateText(input: {
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  maxOutputTokens?: number;
  json?: boolean;
  images?: string[];
}): Promise<HuggingFaceTextResult> {
  const client = new OpenAI({
    apiKey: input.apiKey,
    baseURL: HUGGINGFACE_ROUTER_BASE_URL,
    timeout: 60_000,
  });

  const systemInstruction = [
    input.systemInstruction || '',
    input.json
      ? 'Responda exclusivamente com JSON válido, sem Markdown e sem texto antes ou depois do objeto JSON.'
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const images = Array.isArray(input.images)
    ? input.images.filter((value) => /^data:image\//i.test(String(value || '')))
    : [];

  const response: any = await client.responses.create({
    model: input.model,
    ...(systemInstruction ? { instructions: systemInstruction } : {}),
    input: images.length
      ? [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: input.prompt },
              ...images.map((imageUrl) => ({
                type: 'input_image',
                image_url: imageUrl,
              })),
            ],
          },
        ]
      : input.prompt,
    max_output_tokens: input.maxOutputTokens || 3500,
  } as any);

  if (response?.status === 'incomplete') {
    throw new Error(
      `AI_JSON_TRUNCATED:${response?.incomplete_details?.reason || 'incomplete'}`,
    );
  }

  return {
    text: String(response?.output_text || ''),
    usage: {
      input: response?.usage?.input_tokens,
      output: response?.usage?.output_tokens,
    },
  };
}

export async function huggingFacePreparePdf(
  base64: string,
  maxPages = 8,
): Promise<{ text: string; images: string[] }> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({
    data: new Uint8Array(Buffer.from(base64, 'base64')),
  });

  try {
    const textResult = await parser.getText({ first: maxPages });
    const text = String(textResult?.text || '')
      .replace(/\u0000/g, '')
      .trim()
      .slice(0, 220_000);

    // PDFs digitais ficam muito mais leves e baratos como texto. Quando o PDF
    // é escaneado/fotografado e não possui texto útil, renderizamos as páginas
    // para o VLM selecionado no Hugging Face.
    if (text.length >= 120) return { text, images: [] };

    const screenshots = await parser.getScreenshot({
      first: maxPages,
      desiredWidth: 1400,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const images = (screenshots?.pages || [])
      .map((page: any) => {
        if (!page?.data) return '';
        return `data:image/png;base64,${Buffer.from(page.data).toString('base64')}`;
      })
      .filter(Boolean);

    return { text, images };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
