import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { User } from '../users/entities/user.entity';
import { ProductFeedbackService } from './product-feedback.service';
import { SupportContextService } from './support-context.service';

type ScreenshotInput = {
  name?: unknown;
  mimeType?: unknown;
  size?: unknown;
  data?: unknown;
};

type SupportMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'ADMIN';
  text: string;
  createdAt: string;
};

@Injectable()
export class SupportAssistantService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly ai: AiService,
    private readonly feedback: ProductFeedbackService,
    private readonly contexts: SupportContextService,
  ) {}

  async chat(userId: string, input: any) {
    // Reaproveita a inicialização das tabelas e mantém um único contrato de armazenamento.
    await this.feedback.mySupport(userId);

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Perfil de usuário não encontrado.');

    const text = this.text(input?.message, 3000);
    if (!text) throw new BadRequestException('Escreva sua dúvida.');
    const pagePath = this.text(input?.pagePath, 500) || '/';
    const process = this.text(input?.process, 160) || 'Navegação geral';
    const screenshot = this.screenshot(input?.screenshot);

    let conversation: any = null;
    const conversationId = this.text(input?.conversationId, 80);
    if (conversationId) {
      const rows = await this.dataSource.query(
        'SELECT * FROM product_support_conversations WHERE id = $1 AND "userId" = $2',
        [conversationId, userId],
      );
      conversation = rows[0] || null;
      if (conversation?.status === 'CLOSED') conversation = null;
    }

    if (!conversation) {
      const rows = await this.dataSource.query(
        `
          INSERT INTO product_support_conversations
            ("userId", "userEmail", "userName", "profileType", "companyId", "pagePath", process, messages, screenshot)
          VALUES ($1, $2, $3, $4, $5, $6, $7, '[]'::jsonb, $8::jsonb)
          RETURNING *
        `,
        [
          user.id,
          user.email || null,
          user.socialName || user.displayName || user.fullName || null,
          user.type || 'CANDIDATE',
          user.companyId || null,
          pagePath,
          process,
          screenshot ? JSON.stringify(screenshot) : null,
        ],
      );
      conversation = rows[0];
    }

    const history = Array.isArray(conversation.messages)
      ? (conversation.messages as SupportMessage[])
      : [];
    const userMessage = this.message('USER', text);
    const messagesWithUser = [...history, userMessage].slice(-39);

    // A tela atual é atualizada a cada turno. O chat antigo mantinha o contexto
    // da primeira tela da conversa, mesmo depois que a pessoa navegava.
    await this.dataSource.query(
      `
        UPDATE product_support_conversations
        SET "pagePath" = $3, process = $4, messages = $5::jsonb,
            screenshot = COALESCE($6::jsonb, screenshot), "updatedAt" = now()
        WHERE id = $1 AND "userId" = $2
      `,
      [
        conversation.id,
        userId,
        pagePath,
        process,
        JSON.stringify(messagesWithUser),
        screenshot ? JSON.stringify(screenshot) : null,
      ],
    );

    // Depois de assumir atendimento humano, a IA não entra de novo no meio da conversa.
    if (conversation.status === 'ESCALATED' || conversation.status === 'WAITING_USER') {
      const rows = await this.dataSource.query(
        `
          UPDATE product_support_conversations
          SET status = 'ESCALATED', "pagePath" = $3, process = $4,
              messages = $5::jsonb, screenshot = COALESCE($6::jsonb, screenshot), "updatedAt" = now()
          WHERE id = $1 AND "userId" = $2
          RETURNING id, "pagePath", process, status, messages, screenshot, "createdAt", "updatedAt"
        `,
        [conversation.id, userId, pagePath, process, JSON.stringify(messagesWithUser), screenshot ? JSON.stringify(screenshot) : null],
      );
      return this.withoutScreenshotData(rows[0]);
    }

    const bundle = await this.contexts.resolve(user, { message: text, pagePath, process });
    let reply: string;
    let status = 'AI_ACTIVE';

    try {
      const aiResult = await this.ai.supportChatReply({
        message: text,
        pagePath,
        process: bundle.currentScreen || process,
        profile: {
          type: user.type || 'CANDIDATE',
          supportAudience: bundle.audience,
          hasPublishedResume: user.resumeStatus === 'PUBLISHED',
          isOpenToWork: Boolean(user.isOpenToWork),
          hasCompany: Boolean(user.companyId),
          isCompanyAdmin: Boolean(user.isCompanyAdmin),
          city: user.city || null,
          state: user.state || null,
          currentScreen: bundle.currentScreen,
          supportContextIds: bundle.contextIds,
          restrictedRequest: bundle.restrictedRequest,
          liveFacts: bundle.liveFacts,
          supportPolicy: 'Siga apenas os subcontextos liberados pelo servidor. Não revele rotas, funções, dados, credenciais ou passos de outro perfil. Fatos vivos vencem suposições. Se faltar um fato necessário, diga que precisa ser consultado em vez de inventar.',
          supportKnowledge: bundle.knowledge,
        },
        history: history.slice(-16).map((item) => ({ role: item.role, text: item.text })),
        screenshot: screenshot
          ? { data: screenshot.data, mimeType: screenshot.mimeType }
          : null,
      });
      reply = aiResult.text;
      if (!reply) throw new Error('Resposta vazia');

      await this.recordAiUsage({
        user,
        conversationId: conversation.id,
        provider: aiResult.provider,
        model: aiResult.model,
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        estimated: aiResult.estimated,
        success: true,
        metadata: {
          pagePath,
          process,
          currentScreen: bundle.currentScreen,
          contextIds: bundle.contextIds,
          restrictedRequest: bundle.restrictedRequest,
          hasScreenshot: Boolean(screenshot),
        },
      }).catch((usageError) => console.warn('Falha ao registrar consumo da IA de suporte:', usageError));
    } catch (error) {
      console.warn('Atendimento inteligente contextual indisponível:', error);
      reply = 'Recebi sua mensagem, mas não consegui confirmar uma resposta segura agora. Você pode tentar novamente ou encaminhar esta conversa para o atendimento humano.';
      status = 'AI_ERROR';
      await this.recordAiUsage({
        user,
        conversationId: conversation.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          pagePath,
          process,
          currentScreen: bundle.currentScreen,
          contextIds: bundle.contextIds,
          restrictedRequest: bundle.restrictedRequest,
          hasScreenshot: Boolean(screenshot),
        },
      }).catch(() => undefined);
    }

    const messages = [...messagesWithUser, this.message('ASSISTANT', reply)].slice(-40);
    const rows = await this.dataSource.query(
      `
        UPDATE product_support_conversations
        SET "pagePath" = $3, process = $4, messages = $5::jsonb, status = $6,
            screenshot = COALESCE($7::jsonb, screenshot), "updatedAt" = now()
        WHERE id = $1 AND "userId" = $2
        RETURNING id, "pagePath", process, status, messages, screenshot, "createdAt", "updatedAt"
      `,
      [
        conversation.id,
        userId,
        pagePath,
        process,
        JSON.stringify(messages),
        status,
        screenshot ? JSON.stringify(screenshot) : null,
      ],
    );
    return this.withoutScreenshotData(rows[0]);
  }

  private async recordAiUsage(input: {
    user: User;
    conversationId: string;
    provider?: string | null;
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    estimated?: boolean;
    success: boolean;
    error?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const inputTokens = Math.max(0, Math.round(Number(input.inputTokens) || 0));
    const outputTokens = Math.max(0, Math.round(Number(input.outputTokens) || 0));
    await this.dataSource.query(
      `
        INSERT INTO ai_usage_logs
          ("userId", "userEmail", "userName", "profileType", "companyId", feature,
           operation, "conversationId", provider, model, "inputTokens", "outputTokens",
           "totalTokens", estimated, success, error, metadata)
        VALUES ($1, $2, $3, $4, $5, 'SUPPORT_CHAT', 'support.contextual-reply',
                $6::uuid, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      `,
      [
        input.user.id,
        input.user.email || null,
        input.user.socialName || input.user.displayName || input.user.fullName || null,
        input.user.type || null,
        input.user.companyId || null,
        input.conversationId,
        input.provider || null,
        input.model || null,
        inputTokens,
        outputTokens,
        inputTokens + outputTokens,
        Boolean(input.estimated),
        input.success,
        this.text(input.error, 4000) || null,
        JSON.stringify(input.metadata || {}),
      ],
    );
  }

  private text(value: unknown, max: number) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  private message(role: SupportMessage['role'], text: string): SupportMessage {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role,
      text,
      createdAt: new Date().toISOString(),
    };
  }

  private screenshot(input?: ScreenshotInput | null) {
    if (!input) return null;
    const name = this.text(input.name, 180);
    const mimeType = this.text(input.mimeType, 40);
    const data = typeof input.data === 'string' ? input.data : '';
    const size = Number(input.size || 0);
    if (
      !name ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) ||
      !data.startsWith(`data:${mimeType};base64,`) ||
      !Number.isFinite(size) ||
      size <= 0 ||
      size > 2 * 1024 * 1024 ||
      data.length > 2.9 * 1024 * 1024
    ) {
      throw new BadRequestException('A captura deve ser PNG, JPG ou WebP de até 2 MB.');
    }
    return { name, mimeType, size, data };
  }

  private withoutScreenshotData<T extends Record<string, any>>(item: T): T {
    if (!item?.screenshot) return item;
    return {
      ...item,
      screenshot: {
        name: item.screenshot.name,
        mimeType: item.screenshot.mimeType,
        size: item.screenshot.size,
      },
    };
  }
}
