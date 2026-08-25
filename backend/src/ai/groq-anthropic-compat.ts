import OpenAI from 'openai';
import { huggingFacePreparePdf } from './huggingface.provider';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

type CompatOptions = {
  apiKey: string;
  timeout?: number;
};

export class GroqCompat {
  private readonly client: OpenAI;

  constructor(options: CompatOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: GROQ_BASE_URL,
      timeout: options.timeout || 60_000,
    });
  }

  models = {
    list: async () => {
      const result = await this.client.models.list();
      return {
        data: result.data.map((item: any) => ({
          ...item,
          display_name: item?.id || 'Groq',
        })),
      };
    },
  };

  messages = {
    create: async (input: any) => {
      const convertedMessages: any[] = [];
      for (const message of Array.isArray(input?.messages) ? input.messages : []) {
        const role = message?.role === 'assistant' ? 'assistant' : 'user';
        if (typeof message?.content === 'string') {
          convertedMessages.push({ role, content: message.content });
          continue;
        }

        const content: any[] = [];
        for (const block of Array.isArray(message?.content) ? message.content : []) {
          if (block?.type === 'text') {
            const text = String(block?.text || '').trim();
            if (text) content.push({ type: 'input_text', text });
            continue;
          }

          if (block?.type === 'image' && block?.source?.type === 'base64') {
            const mediaType = String(block.source.media_type || 'image/jpeg');
            const data = String(block.source.data || '');
            if (data) {
              content.push({
                type: 'input_image',
                image_url: `data:${mediaType};base64,${data}`,
                detail: 'auto',
              });
            }
            continue;
          }

          if (block?.type === 'document' && block?.source?.type === 'base64') {
            const data = String(block.source.data || '');
            if (!data) continue;
            const prepared = await huggingFacePreparePdf(data, 8);
            if (prepared.text) {
              content.push({
                type: 'input_text',
                text: `TEXTO EXTRAÍDO DO PDF:\n${prepared.text}`,
              });
            }
            for (const image of prepared.images.slice(0, 8)) {
              content.push({ type: 'input_image', image_url: image, detail: 'auto' });
            }
          }
        }
        convertedMessages.push({
          role,
          content: content.length ? content : [{ type: 'input_text', text: '' }],
        });
      }

      const response: any = await this.client.responses.create({
        model: String(input?.model || ''),
        ...(input?.system ? { instructions: String(input.system) } : {}),
        input: convertedMessages.length ? convertedMessages : '',
        max_output_tokens: Number(input?.max_tokens || 3500),
      } as any);

      if (response?.status === 'incomplete') {
        throw new Error(
          `GROQ_RESPONSE_INCOMPLETE:${response?.incomplete_details?.reason || 'incomplete'}`,
        );
      }

      let text = String(response?.output_text || '').trim();
      let usage = {
        input_tokens: response?.usage?.input_tokens,
        output_tokens: response?.usage?.output_tokens,
      };

      if (!text) {
        const chatMessages: any[] = [];
        if (input?.system) {
          chatMessages.push({ role: 'system', content: String(input.system) });
        }

        for (const message of convertedMessages) {
          if (typeof message?.content === 'string') {
            chatMessages.push({ role: message.role, content: message.content });
            continue;
          }

          const content = (Array.isArray(message?.content) ? message.content : [])
            .map((block: any) => {
              if (block?.type === 'input_text') {
                return { type: 'text', text: String(block.text || '') };
              }
              if (block?.type === 'input_image' && block?.image_url) {
                return {
                  type: 'image_url',
                  image_url: { url: String(block.image_url) },
                };
              }
              return null;
            })
            .filter(Boolean);

          chatMessages.push({
            role: message.role,
            content: content.length ? content : '',
          });
        }

        const completion: any = await this.client.chat.completions.create({
          model: String(input?.model || ''),
          messages: chatMessages.length
            ? chatMessages
            : [{ role: 'user', content: '' }],
          max_tokens: Number(input?.max_tokens || 3500),
        } as any);

        text = String(completion?.choices?.[0]?.message?.content || '').trim();
        usage = {
          input_tokens:
            completion?.usage?.prompt_tokens ?? response?.usage?.input_tokens,
          output_tokens:
            completion?.usage?.completion_tokens ?? response?.usage?.output_tokens,
        };
      }

      return {
        content: [{ type: 'text', text }],
        usage,
      };
    },
  };
}
