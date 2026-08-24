import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserType } from '../users/entities/user.entity';

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
export class ProductFeedbackService implements OnModuleInit, OnModuleDestroy {
  private tablesReady: Promise<void> | null = null;
  private analysisTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly ai: AiService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const firstRun = setTimeout(() => {
      void this.analyze(false).catch((error) =>
        console.warn('Análise diária de sugestões não executada:', error),
      );
    }, 60_000);
    firstRun.unref?.();
    this.analysisTimer = setInterval(() => {
      void this.analyze(false).catch((error) =>
        console.warn('Análise diária de sugestões não executada:', error),
      );
    }, 60 * 60 * 1000);
    this.analysisTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.analysisTimer) clearInterval(this.analysisTimer);
  }

  private async ensureTables() {
    if (!this.tablesReady) {
      this.tablesReady = (async () => {
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS product_feedback_requests (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "userId" varchar NOT NULL,
            "userEmail" varchar NULL,
            "userName" varchar NULL,
            "profileType" varchar(30) NOT NULL DEFAULT 'CANDIDATE',
            "companyId" varchar NULL,
            kind varchar(24) NOT NULL DEFAULT 'IMPROVEMENT',
            "pagePath" varchar(500) NOT NULL,
            process varchar(160) NOT NULL,
            message text NOT NULL,
            screenshot jsonb NULL,
            status varchar(32) NOT NULL DEFAULT 'NEW',
            "adminNote" text NULL,
            expectation varchar(20) NULL,
            "expectationComment" text NULL,
            "expectationAt" timestamptz NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
          )
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS product_feedback_status_created_idx
          ON product_feedback_requests (status, "createdAt" DESC)
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS product_feedback_user_idx
          ON product_feedback_requests ("userId", "createdAt" DESC)
        `);
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS product_feedback_insights (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title varchar(180) NOT NULL,
            summary text NOT NULL,
            "feedbackIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
            "requestCount" integer NOT NULL DEFAULT 1,
            score integer NOT NULL DEFAULT 0,
            reason text NULL,
            source varchar(20) NOT NULL DEFAULT 'AI',
            "generatedAt" timestamptz NOT NULL DEFAULT now()
          )
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS product_feedback_insights_rank_idx
          ON product_feedback_insights (score DESC, "requestCount" DESC)
        `);
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS product_support_conversations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "userId" varchar NOT NULL,
            "userEmail" varchar NULL,
            "userName" varchar NULL,
            "profileType" varchar(30) NOT NULL DEFAULT 'CANDIDATE',
            "companyId" varchar NULL,
            "pagePath" varchar(500) NOT NULL,
            process varchar(160) NOT NULL,
            status varchar(24) NOT NULL DEFAULT 'AI_ACTIVE',
            messages jsonb NOT NULL DEFAULT '[]'::jsonb,
            screenshot jsonb NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
          )
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS product_support_status_updated_idx
          ON product_support_conversations (status, "updatedAt" DESC)
        `);
      })().catch((error) => {
        this.tablesReady = null;
        throw error;
      });
    }
    await this.tablesReady;
  }

  private async user(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Perfil de usuário não encontrado.');
    return user;
  }

  async assertAdmin(userId: string) {
    const user = await this.user(userId);
    if (user.type !== UserType.ADMIN)
      throw new ForbiddenException('Acesso restrito à administração.');
    return user;
  }

  private text(value: unknown, max: number) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
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
      throw new BadRequestException(
        'A captura deve ser PNG, JPG ou WebP de até 2 MB.',
      );
    }
    return { name, mimeType, size, data };
  }

  private profileSnapshot(user: User) {
    return {
      type: user.type || 'CANDIDATE',
      companyId: user.companyId || null,
      hasPublishedResume: user.resumeStatus === 'PUBLISHED',
      isOpenToWork: Boolean(user.isOpenToWork),
      hasPhone: Boolean(user.phone),
      city: user.city || null,
      state: user.state || null,
    };
  }

  async submit(userId: string, input: any) {
    await this.ensureTables();
    const user = await this.user(userId);
    const message = this.text(input?.message, 5000);
    if (message.length < 3)
      throw new BadRequestException('Conte um pouco mais sobre o que está faltando.');
    const pagePath = this.text(input?.pagePath, 500) || '/';
    const process = this.text(input?.process, 160) || 'Navegação geral';
    const screenshot = this.screenshot(input?.screenshot);
    const rows = await this.dataSource.query(
      `
        INSERT INTO product_feedback_requests
          ("userId", "userEmail", "userName", "profileType", "companyId", kind, "pagePath", process, message, screenshot)
        VALUES ($1, $2, $3, $4, $5, 'IMPROVEMENT', $6, $7, $8, $9::jsonb)
        RETURNING id, status, "createdAt"
      `,
      [
        user.id,
        user.email || null,
        user.socialName || user.displayName || user.fullName || null,
        user.type || 'CANDIDATE',
        user.companyId || null,
        pagePath,
        process,
        message,
        screenshot ? JSON.stringify(screenshot) : null,
      ],
    );
    return rows[0];
  }

  async mineAwaitingExpectation(userId: string) {
    await this.ensureTables();
    return this.dataSource.query(
      `
        SELECT id, message, "pagePath", process, status, "updatedAt"
        FROM product_feedback_requests
        WHERE "userId" = $1 AND status = 'DELIVERED' AND expectation IS NULL
        ORDER BY "updatedAt" DESC
        LIMIT 5
      `,
      [userId],
    );
  }

  async respondExpectation(userId: string, id: string, input: any) {
    await this.ensureTables();
    const expectation = this.text(input?.expectation, 20).toUpperCase();
    if (!['YES', 'PARTLY', 'NO'].includes(expectation))
      throw new BadRequestException('Informe se a melhoria atendeu às expectativas.');
    const rows = await this.dataSource.query(
      `
        UPDATE product_feedback_requests
        SET expectation = $3, "expectationComment" = $4, "expectationAt" = now(), "updatedAt" = now()
        WHERE id = $1 AND "userId" = $2 AND status = 'DELIVERED' AND expectation IS NULL
        RETURNING id, expectation, "expectationAt"
      `,
      [id, userId, expectation, this.text(input?.comment, 3000) || null],
    );
    if (!rows[0]) throw new NotFoundException('Solicitação não encontrada.');
    return rows[0];
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

  async overview() {
    await this.ensureTables();
    const [feedback, insights, conversations] = await Promise.all([
      this.dataSource.query(`
        SELECT id, "userId", "userEmail", "userName", "profileType", "companyId", kind,
          "pagePath", process, message, screenshot, status, "adminNote", expectation,
          "expectationComment", "expectationAt", "createdAt", "updatedAt"
        FROM product_feedback_requests
        ORDER BY "createdAt" DESC
        LIMIT 500
      `),
      this.dataSource.query(`
        SELECT * FROM product_feedback_insights
        ORDER BY score DESC, "requestCount" DESC, "generatedAt" DESC
        LIMIT 100
      `),
      this.dataSource.query(`
        SELECT id, "userId", "userEmail", "userName", "profileType", "companyId",
          "pagePath", process, status, messages, screenshot, "createdAt", "updatedAt"
        FROM product_support_conversations
        ORDER BY CASE WHEN status = 'ESCALATED' THEN 0 ELSE 1 END, "updatedAt" DESC
        LIMIT 200
      `),
    ]);
    return {
      feedback: feedback.map((item: any) => this.withoutScreenshotData(item)),
      insights,
      conversations: conversations.map((item: any) =>
        this.withoutScreenshotData(item),
      ),
      lastAnalyzedAt: insights[0]?.generatedAt || null,
    };
  }

  async updateFeedback(id: string, input: any) {
    await this.ensureTables();
    const status = this.text(input?.status, 32).toUpperCase();
    if (!['NEW', 'REVIEWING', 'PLANNED', 'DELIVERED', 'CLOSED'].includes(status))
      throw new BadRequestException('Status de solicitação inválido.');
    const rows = await this.dataSource.query(
      `
        UPDATE product_feedback_requests
        SET status = $2, "adminNote" = $3, "updatedAt" = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, status, this.text(input?.adminNote, 5000) || null],
    );
    if (!rows[0]) throw new NotFoundException('Solicitação não encontrada.');
    if (status === 'DELIVERED') {
      await this.notifications.notifyUser(rows[0].userId, {
        title: 'Uma melhoria que você pediu foi entregue',
        message: 'Conte para a gente se a mudança atendeu às suas expectativas.',
        type: 'product_feedback_delivered',
        link: rows[0].pagePath || '/user',
      }).catch(() => undefined);
    }
    return this.withoutScreenshotData(rows[0]);
  }

  async screenshotForAdmin(source: 'feedback' | 'support', id: string) {
    await this.ensureTables();
    const table = source === 'support'
      ? 'product_support_conversations'
      : 'product_feedback_requests';
    const rows = await this.dataSource.query(
      `SELECT screenshot FROM ${table} WHERE id = $1`,
      [id],
    );
    if (!rows[0]?.screenshot)
      throw new NotFoundException('Esta solicitação não possui captura.');
    return rows[0].screenshot;
  }

  private fallbackClusters(items: any[]) {
    const groups = new Map<string, any[]>();
    for (const item of items) {
      const key = `${item.process || 'Geral'}|${item.pagePath || '/'}`;
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return [...groups.values()].map((group) => ({
      title: group[0].process || 'Melhoria geral',
      summary: group.length === 1
        ? group[0].message
        : `${group.length} solicitações relacionadas ao processo “${group[0].process}”.`,
      feedbackIds: group.map((item) => item.id),
      score: Math.min(100, 38 + group.length * 12),
      reason: 'Priorização provisória por frequência e contexto da página.',
      source: 'HEURISTIC',
    }));
  }

  async analyze(force = false) {
    await this.ensureTables();
    if (!force) {
      const recent = await this.dataSource.query(`
        SELECT "generatedAt" FROM product_feedback_insights
        ORDER BY "generatedAt" DESC LIMIT 1
      `);
      if (
        recent[0]?.generatedAt &&
        Date.now() - new Date(recent[0].generatedAt).getTime() < 24 * 60 * 60 * 1000
      ) {
        return { analyzed: false, reason: 'RECENT_ANALYSIS' };
      }
    }
    const items = await this.dataSource.query(`
      SELECT id, message, "pagePath", process, "profileType", "createdAt"
      FROM product_feedback_requests
      WHERE status IN ('NEW', 'REVIEWING', 'PLANNED')
      ORDER BY "createdAt" DESC
      LIMIT 500
    `);
    if (!items.length) return { analyzed: false, reason: 'NO_FEEDBACK' };

    let clusters: any[];
    try {
      const result = await this.ai.analyzeProductFeedback(items);
      clusters = result.clusters;
    } catch (error) {
      console.warn('IA indisponível para priorização; usando frequência:', error);
      clusters = this.fallbackClusters(items);
    }
    const validIds = new Set(items.map((item: any) => String(item.id)));
    const usedIds = new Set<string>();
    const normalized = clusters
      .map((cluster) => {
        const feedbackIds = Array.isArray(cluster?.feedbackIds)
          ? cluster.feedbackIds
              .map(String)
              .filter((id: string) => validIds.has(id) && !usedIds.has(id))
          : [];
        feedbackIds.forEach((id: string) => usedIds.add(id));
        return {
          title: this.text(cluster?.title, 180) || 'Melhoria sugerida',
          summary: this.text(cluster?.summary, 5000) || 'Solicitações relacionadas.',
          feedbackIds,
          requestCount: feedbackIds.length,
          score: Math.min(100, Math.max(0, Math.round(Number(cluster?.score) || 0))),
          reason: this.text(cluster?.reason, 2000) || null,
          source: cluster?.source === 'HEURISTIC' ? 'HEURISTIC' : 'AI',
        };
      })
      .filter((cluster) => cluster.requestCount > 0);
    for (const item of items) {
      if (usedIds.has(item.id)) continue;
      normalized.push({
        title: item.process || 'Melhoria sugerida',
        summary: item.message,
        feedbackIds: [item.id],
        requestCount: 1,
        score: 40,
        reason: 'Solicitação individual ainda sem agrupamento.',
        source: 'HEURISTIC',
      });
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM product_feedback_insights');
      for (const cluster of normalized) {
        await manager.query(
          `
            INSERT INTO product_feedback_insights
              (title, summary, "feedbackIds", "requestCount", score, reason, source)
            VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
          `,
          [
            cluster.title,
            cluster.summary,
            JSON.stringify(cluster.feedbackIds),
            cluster.requestCount,
            cluster.score,
            cluster.reason,
            cluster.source,
          ],
        );
      }
    });
    return { analyzed: true, clusters: normalized.length };
  }

  private message(role: SupportMessage['role'], text: string): SupportMessage {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role,
      text,
      createdAt: new Date().toISOString(),
    };
  }

  async mySupport(userId: string) {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `
        SELECT id, "pagePath", process, status, messages, screenshot, "createdAt", "updatedAt"
        FROM product_support_conversations
        WHERE "userId" = $1 AND status <> 'CLOSED'
        ORDER BY "updatedAt" DESC LIMIT 1
      `,
      [userId],
    );
    return rows[0] ? this.withoutScreenshotData(rows[0]) : null;
  }

  async supportChat(userId: string, input: any) {
    await this.ensureTables();
    const user = await this.user(userId);
    const text = this.text(input?.message, 3000);
    if (!text) throw new BadRequestException('Escreva sua dúvida.');
    const screenshot = this.screenshot(input?.screenshot);
    let conversation: any = null;
    const conversationId = this.text(input?.conversationId, 80);
    if (conversationId) {
      const rows = await this.dataSource.query(
        `SELECT * FROM product_support_conversations WHERE id = $1 AND "userId" = $2`,
        [conversationId, userId],
      );
      conversation = rows[0] || null;
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
          this.text(input?.pagePath, 500) || '/',
          this.text(input?.process, 160) || 'Navegação geral',
          screenshot ? JSON.stringify(screenshot) : null,
        ],
      );
      conversation = rows[0];
    }
    const history = Array.isArray(conversation.messages)
      ? (conversation.messages as SupportMessage[])
      : [];
    const userMessage = this.message('USER', text);
    let reply: string;
    let status = conversation.status === 'ESCALATED' ? 'ESCALATED' : 'AI_ACTIVE';
    try {
      reply = await this.ai.supportChatReply({
        message: text,
        pagePath: conversation.pagePath,
        process: conversation.process,
        profile: this.profileSnapshot(user),
        history: history.map((item) => ({ role: item.role, text: item.text })),
        screenshot: screenshot
          ? { data: screenshot.data, mimeType: screenshot.mimeType }
          : null,
      });
      if (!reply) throw new Error('Resposta vazia');
    } catch (error) {
      console.warn('Atendimento inteligente indisponível:', error);
      reply = 'Recebi sua mensagem, mas o atendimento inteligente não conseguiu responder agora. A conversa foi encaminhada para o suporte humano.';
      status = 'ESCALATED';
    }
    const messages = [...history, userMessage, this.message('ASSISTANT', reply)].slice(-40);
    const rows = await this.dataSource.query(
      `
        UPDATE product_support_conversations
        SET messages = $3::jsonb, status = $4,
          screenshot = COALESCE($5::jsonb, screenshot), "updatedAt" = now()
        WHERE id = $1 AND "userId" = $2
        RETURNING id, "pagePath", process, status, messages, screenshot, "createdAt", "updatedAt"
      `,
      [
        conversation.id,
        userId,
        JSON.stringify(messages),
        status,
        screenshot ? JSON.stringify(screenshot) : null,
      ],
    );
    return this.withoutScreenshotData(rows[0]);
  }

  async escalateSupport(userId: string, id: string) {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `
        UPDATE product_support_conversations
        SET status = 'ESCALATED', "updatedAt" = now()
        WHERE id = $1 AND "userId" = $2 AND status <> 'CLOSED'
        RETURNING id, status, "updatedAt"
      `,
      [id, userId],
    );
    if (!rows[0]) throw new NotFoundException('Conversa não encontrada.');
    return rows[0];
  }

  async adminReply(id: string, input: any) {
    await this.ensureTables();
    const text = this.text(input?.message, 4000);
    if (!text) throw new BadRequestException('Escreva a resposta do suporte.');
    const rows = await this.dataSource.query(
      'SELECT * FROM product_support_conversations WHERE id = $1',
      [id],
    );
    const conversation = rows[0];
    if (!conversation) throw new NotFoundException('Conversa não encontrada.');
    const messages = [
      ...(Array.isArray(conversation.messages) ? conversation.messages : []),
      this.message('ADMIN', text),
    ].slice(-40);
    const updated = await this.dataSource.query(
      `
        UPDATE product_support_conversations
        SET messages = $2::jsonb, status = 'WAITING_USER', "updatedAt" = now()
        WHERE id = $1
        RETURNING id, status, messages, "updatedAt"
      `,
      [id, JSON.stringify(messages)],
    );
    await this.notifications.notifyUser(conversation.userId, {
      title: 'O suporte respondeu você',
      message: text.slice(0, 180),
      type: 'support_message',
      link: conversation.pagePath || '/user',
    }).catch(() => undefined);
    return updated[0];
  }
}
