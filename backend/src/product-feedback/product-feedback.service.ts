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
      void this.runDailyAutomation();
    }, 60_000);
    firstRun.unref?.();
    this.analysisTimer = setInterval(() => {
      void this.runDailyAutomation();
    }, 60 * 60 * 1000);
    this.analysisTimer.unref?.();
  }

  private async runDailyAutomation() {
    await this.analyze(false).catch((error) =>
      console.warn('Análise diária de sugestões não executada:', error),
    );
    await this.generateFaqs(false).catch((error) =>
      console.warn('Geração diária de FAQs não executada:', error),
    );
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
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS ai_usage_logs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "userId" varchar NULL,
            "userEmail" varchar NULL,
            "userName" varchar NULL,
            "profileType" varchar(30) NULL,
            "companyId" varchar NULL,
            feature varchar(80) NOT NULL,
            operation varchar(120) NOT NULL,
            "conversationId" uuid NULL,
            provider varchar(30) NULL,
            model varchar(160) NULL,
            "inputTokens" integer NOT NULL DEFAULT 0,
            "outputTokens" integer NOT NULL DEFAULT 0,
            "totalTokens" integer NOT NULL DEFAULT 0,
            estimated boolean NOT NULL DEFAULT false,
            success boolean NOT NULL DEFAULT true,
            error text NULL,
            metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
            "createdAt" timestamptz NOT NULL DEFAULT now()
          )
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx
          ON ai_usage_logs ("userId", "createdAt" DESC)
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS ai_usage_feature_created_idx
          ON ai_usage_logs (feature, "createdAt" DESC)
        `);
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS support_faq_articles (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            slug varchar(220) UNIQUE NOT NULL,
            title varchar(180) NOT NULL,
            summary text NOT NULL,
            body text NOT NULL,
            "sourceConversationIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
            "requestCount" integer NOT NULL DEFAULT 0,
            status varchar(20) NOT NULL DEFAULT 'DRAFT',
            "aiGenerated" boolean NOT NULL DEFAULT true,
            "publishedAt" timestamptz NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
          )
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS support_faq_status_updated_idx
          ON support_faq_articles (status, "updatedAt" DESC)
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

  private async recordAiUsage(input: {
    user?: User | null;
    feature: string;
    operation: string;
    conversationId?: string | null;
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
      `,
      [
        input.user?.id || null,
        input.user?.email || null,
        input.user?.socialName || input.user?.displayName || input.user?.fullName || null,
        input.user?.type || null,
        input.user?.companyId || null,
        input.feature,
        input.operation,
        input.conversationId || null,
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

  private slug(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 190) || `ajuda-${Date.now()}`;
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
    const [feedback, insights, conversations, usageSummary, usageByFeature, usageDaily, topUsers, usageLogs, faqs] = await Promise.all([
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
      this.dataSource.query(`
        SELECT COUNT(*)::int AS requests,
          COALESCE(SUM("inputTokens"), 0)::int AS "inputTokens",
          COALESCE(SUM("outputTokens"), 0)::int AS "outputTokens",
          COALESCE(SUM("totalTokens"), 0)::int AS "totalTokens",
          COUNT(*) FILTER (WHERE success = false)::int AS failures
        FROM ai_usage_logs WHERE "createdAt" >= now() - interval '30 days'
      `),
      this.dataSource.query(`
        SELECT feature, COUNT(*)::int AS requests, COALESCE(SUM("totalTokens"), 0)::int AS tokens,
          COUNT(*) FILTER (WHERE success = false)::int AS failures
        FROM ai_usage_logs WHERE "createdAt" >= now() - interval '30 days'
        GROUP BY feature ORDER BY tokens DESC
      `),
      this.dataSource.query(`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS requests, COALESCE(SUM("totalTokens"), 0)::int AS tokens
        FROM ai_usage_logs WHERE "createdAt" >= now() - interval '30 days'
        GROUP BY date_trunc('day', "createdAt") ORDER BY date_trunc('day', "createdAt")
      `),
      this.dataSource.query(`
        SELECT "userId", MAX("userName") AS "userName", MAX("userEmail") AS "userEmail",
          MAX("profileType") AS "profileType", COUNT(*)::int AS requests,
          COALESCE(SUM("totalTokens"), 0)::int AS tokens
        FROM ai_usage_logs WHERE "createdAt" >= now() - interval '30 days' AND "userId" IS NOT NULL
        GROUP BY "userId" ORDER BY tokens DESC LIMIT 25
      `),
      this.dataSource.query(`
        SELECT id, "userId", "userName", "userEmail", "profileType", "companyId", feature,
          operation, "conversationId", provider, model, "inputTokens", "outputTokens",
          "totalTokens", estimated, success, error, metadata, "createdAt"
        FROM ai_usage_logs ORDER BY "createdAt" DESC LIMIT 200
      `),
      this.dataSource.query(`SELECT * FROM support_faq_articles ORDER BY "updatedAt" DESC LIMIT 200`),
    ]);
    return {
      feedback: feedback.map((item: any) => this.withoutScreenshotData(item)),
      insights,
      conversations: conversations.map((item: any) =>
        this.withoutScreenshotData(item),
      ),
      aiUsage: {
        summary: usageSummary[0] || { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, failures: 0 },
        byFeature: usageByFeature,
        daily: usageDaily,
        topUsers,
        logs: usageLogs,
      },
      faqs,
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
    const messagesWithUser = [...history, userMessage].slice(-39);
    await this.dataSource.query(
      `
        UPDATE product_support_conversations
        SET messages = $3::jsonb, screenshot = COALESCE($4::jsonb, screenshot), "updatedAt" = now()
        WHERE id = $1 AND "userId" = $2
      `,
      [conversation.id, userId, JSON.stringify(messagesWithUser), screenshot ? JSON.stringify(screenshot) : null],
    );
    let reply: string;
    let status = 'AI_ACTIVE';
    try {
      const aiResult = await this.ai.supportChatReply({
        message: text,
        pagePath: conversation.pagePath,
        process: conversation.process,
        profile: this.profileSnapshot(user),
        history: history.map((item) => ({ role: item.role, text: item.text })),
        screenshot: screenshot
          ? { data: screenshot.data, mimeType: screenshot.mimeType }
          : null,
      });
      reply = aiResult.text;
      if (!reply) throw new Error('Resposta vazia');
      await this.recordAiUsage({
        user,
        feature: 'SUPPORT_CHAT',
        operation: 'support.reply',
        conversationId: conversation.id,
        provider: aiResult.provider,
        model: aiResult.model,
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        estimated: aiResult.estimated,
        success: true,
        metadata: { pagePath: conversation.pagePath, process: conversation.process, hasScreenshot: Boolean(screenshot) },
      }).catch((usageError) => console.warn('Falha ao registrar consumo da IA:', usageError));
    } catch (error) {
      console.warn('Atendimento inteligente indisponível:', error);
      reply = 'Recebi sua mensagem, mas não consegui responder agora. Tente novamente em instantes.';
      status = 'AI_ERROR';
      await this.recordAiUsage({
        user,
        feature: 'SUPPORT_CHAT',
        operation: 'support.reply',
        conversationId: conversation.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { pagePath: conversation.pagePath, process: conversation.process, hasScreenshot: Boolean(screenshot) },
      }).catch((usageError) => console.warn('Falha ao registrar consumo da IA:', usageError));
    }
    const messages = [...messagesWithUser, this.message('ASSISTANT', reply)].slice(-40);
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

  async generateFaqs(force = false) {
    await this.ensureTables();
    if (!force) {
      const recent = await this.dataSource.query(`
        SELECT "updatedAt" FROM support_faq_articles WHERE "aiGenerated" = true
        ORDER BY "updatedAt" DESC LIMIT 1
      `);
      if (recent[0]?.updatedAt && Date.now() - new Date(recent[0].updatedAt).getTime() < 24 * 60 * 60 * 1000)
        return { generated: false, reason: 'RECENT_GENERATION' };
    }
    const conversations = await this.dataSource.query(`
      SELECT id, process, "pagePath", messages
      FROM product_support_conversations
      WHERE "createdAt" >= now() - interval '90 days'
      ORDER BY "updatedAt" DESC LIMIT 500
    `);
    const questions = conversations.flatMap((conversation: any) =>
      (Array.isArray(conversation.messages) ? conversation.messages : [])
        .filter((message: SupportMessage) => message.role === 'USER')
        .map((message: SupportMessage) => ({
          conversationId: String(conversation.id),
          process: conversation.process,
          pagePath: conversation.pagePath,
          question: this.text(message.text, 2000),
        })),
    ).filter((item: any) => item.question);
    if (questions.length < 2) return { generated: false, reason: 'NOT_ENOUGH_QUESTIONS' };

    try {
      const result = await this.ai.generateSupportFaqs(questions);
      const validIds = new Set(conversations.map((item: any) => String(item.id)));
      let saved = 0;
      for (const article of result.articles) {
        const ids = [...new Set((Array.isArray(article?.conversationIds) ? article.conversationIds : [])
          .map(String).filter((id: string) => validIds.has(id)))];
        if (ids.length < 2) continue;
        const title = this.text(article?.title, 180);
        const summary = this.text(article?.summary, 5000);
        const body = this.text(article?.body, 20000);
        if (!title || !summary || !body) continue;
        await this.dataSource.query(
          `
            INSERT INTO support_faq_articles
              (slug, title, summary, body, "sourceConversationIds", "requestCount")
            VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            ON CONFLICT (slug) DO UPDATE SET
              title = CASE WHEN support_faq_articles.status = 'DRAFT' THEN EXCLUDED.title ELSE support_faq_articles.title END,
              summary = CASE WHEN support_faq_articles.status = 'DRAFT' THEN EXCLUDED.summary ELSE support_faq_articles.summary END,
              body = CASE WHEN support_faq_articles.status = 'DRAFT' THEN EXCLUDED.body ELSE support_faq_articles.body END,
              "sourceConversationIds" = EXCLUDED."sourceConversationIds",
              "requestCount" = EXCLUDED."requestCount",
              "updatedAt" = now()
          `,
          [this.slug(title), title, summary, body, JSON.stringify(ids), ids.length],
        );
        saved += 1;
      }
      await this.recordAiUsage({
        feature: 'FAQ_GENERATION',
        operation: 'faq.generate',
        provider: result.usage.provider,
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimated: result.usage.estimated,
        success: true,
        metadata: { questionCount: questions.length, articleCount: saved },
      });
      return { generated: true, articles: saved };
    } catch (error) {
      await this.recordAiUsage({
        feature: 'FAQ_GENERATION', operation: 'faq.generate', success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { questionCount: questions.length },
      }).catch(() => undefined);
      throw error;
    }
  }

  async updateFaq(id: string, input: any) {
    await this.ensureTables();
    const status = this.text(input?.status, 20).toUpperCase();
    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status))
      throw new BadRequestException('Status de FAQ inválido.');
    const title = this.text(input?.title, 180);
    const summary = this.text(input?.summary, 5000);
    const body = this.text(input?.body, 20000);
    if (!title || !summary || !body) throw new BadRequestException('Preencha título, resumo e conteúdo.');
    const rows = await this.dataSource.query(
      `
        UPDATE support_faq_articles SET title = $2, slug = $3, summary = $4, body = $5,
          status = $6, "publishedAt" = CASE WHEN $6 = 'PUBLISHED' THEN COALESCE("publishedAt", now()) ELSE NULL END,
          "updatedAt" = now() WHERE id = $1 RETURNING *
      `,
      [id, title, this.slug(title), summary, body, status],
    );
    if (!rows[0]) throw new NotFoundException('FAQ não encontrada.');
    return rows[0];
  }

  async publicFaqs(slug?: string) {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT id, slug, title, summary, body, "publishedAt", "updatedAt"
       FROM support_faq_articles WHERE status = 'PUBLISHED' ${slug ? 'AND slug = $1' : ''}
       ORDER BY "publishedAt" DESC`,
      slug ? [slug] : [],
    );
    if (slug && !rows[0]) throw new NotFoundException('Conteúdo de ajuda não encontrado.');
    return slug ? rows[0] : rows;
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
