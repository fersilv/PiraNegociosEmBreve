import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

export interface AiBehaviorSettings {
  name: string;
  tone: string;
  instructions: string;
  negativePrompt: string;
}

export interface AiBrainEntryInput {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  priority?: number;
  enabled?: boolean;
  source?: 'MANUAL' | 'SUGGESTED' | 'IMPORTED';
  reviewStatus?: 'APPROVED' | 'PENDING';
}

@Injectable()
export class SettingsService {
  private aiBrainReady: Promise<void> | null = null;

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Setting[]> {
    return this.settingRepository.find();
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.settingRepository.findOne({ where: { key } });
  }

  async getValue(key: string, defaultValue?: string): Promise<string | undefined> {
    const setting = await this.findByKey(key);
    return setting ? setting.value : defaultValue;
  }

  async createOrUpdate(
    key: string,
    value: string,
    description?: string,
    isPublic: boolean = false,
  ): Promise<Setting> {
    let setting = await this.findByKey(key);
    if (!setting) {
      setting = this.settingRepository.create({
        key,
        value,
        description,
        isPublic,
      });
    } else {
      setting.value = value;
      if (description !== undefined) setting.description = description;
      setting.isPublic = isPublic;
    }
    return this.settingRepository.save(setting);
  }

  async getAiBehavior(): Promise<AiBehaviorSettings> {
    const [name, tone, instructions, negativePrompt] = await Promise.all([
      this.getValue('AI_ASSISTANT_NAME', 'Assistente PiraNegócios'),
      this.getValue(
        'AI_TONE',
        'Profissional, humano, claro, acolhedor e direto.',
      ),
      this.getValue(
        'AI_SYSTEM_INSTRUCTIONS',
        'Use apenas informações verificáveis disponíveis no contexto. Quando faltar informação essencial, não invente.',
      ),
      this.getValue(
        'AI_NEGATIVE_PROMPT',
        'Jamais invente dados de candidatos, empresas, vagas, qualificações, contatos ou fatos não presentes nas fontes fornecidas.',
      ),
    ]);

    return {
      name: name || '',
      tone: tone || '',
      instructions: instructions || '',
      negativePrompt: negativePrompt || '',
    };
  }

  async saveAiBehavior(input: Partial<AiBehaviorSettings>) {
    const current = await this.getAiBehavior();
    const next: AiBehaviorSettings = {
      name: String(input.name ?? current.name).trim().slice(0, 120),
      tone: String(input.tone ?? current.tone).trim().slice(0, 1200),
      instructions: String(input.instructions ?? current.instructions)
        .trim()
        .slice(0, 12000),
      negativePrompt: String(input.negativePrompt ?? current.negativePrompt)
        .trim()
        .slice(0, 12000),
    };

    await Promise.all([
      this.createOrUpdate(
        'AI_ASSISTANT_NAME',
        next.name,
        'Nome/persona da assistente de IA',
      ),
      this.createOrUpdate(
        'AI_TONE',
        next.tone,
        'Tom de voz global da assistente de IA',
      ),
      this.createOrUpdate(
        'AI_SYSTEM_INSTRUCTIONS',
        next.instructions,
        'Instruções globais de comportamento da IA',
      ),
      this.createOrUpdate(
        'AI_NEGATIVE_PROMPT',
        next.negativePrompt,
        'Regras negativas e proibições globais da IA',
      ),
    ]);

    return next;
  }

  private async ensureAiBrainTable() {
    if (!this.aiBrainReady) {
      this.aiBrainReady = (async () => {
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS ai_brain_entries (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title varchar(160) NOT NULL,
            content text NOT NULL,
            category varchar(80) NOT NULL DEFAULT 'GERAL',
            tags jsonb NOT NULL DEFAULT '[]'::jsonb,
            priority integer NOT NULL DEFAULT 50,
            enabled boolean NOT NULL DEFAULT true,
            source varchar(20) NOT NULL DEFAULT 'MANUAL',
            "reviewStatus" varchar(20) NOT NULL DEFAULT 'APPROVED',
            "useCount" integer NOT NULL DEFAULT 0,
            "lastUsedAt" timestamptz NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT ai_brain_priority_range CHECK (priority >= 0 AND priority <= 100),
            CONSTRAINT ai_brain_source_check CHECK (source IN ('MANUAL', 'SUGGESTED', 'IMPORTED')),
            CONSTRAINT ai_brain_review_check CHECK ("reviewStatus" IN ('APPROVED', 'PENDING'))
          )
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS ai_brain_entries_enabled_priority_idx
          ON ai_brain_entries (enabled, "reviewStatus", priority DESC, "updatedAt" DESC)
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS ai_brain_entries_search_idx
          ON ai_brain_entries USING GIN (
            to_tsvector(
              'simple',
              coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(category, '')
            )
          )
        `);
      })().catch((error) => {
        this.aiBrainReady = null;
        throw error;
      });
    }
    await this.aiBrainReady;
  }

  private normalizeBrainInput(input: AiBrainEntryInput, partial = false) {
    const normalized: AiBrainEntryInput = {};
    if (!partial || input.title !== undefined) {
      normalized.title = String(input.title || '').trim().slice(0, 160);
    }
    if (!partial || input.content !== undefined) {
      normalized.content = String(input.content || '').trim().slice(0, 30000);
    }
    if (!partial || input.category !== undefined) {
      normalized.category = String(input.category || 'GERAL')
        .trim()
        .toUpperCase()
        .slice(0, 80);
    }
    if (!partial || input.tags !== undefined) {
      normalized.tags = Array.isArray(input.tags)
        ? input.tags
            .map((tag) => String(tag).trim().slice(0, 60))
            .filter(Boolean)
            .slice(0, 20)
        : [];
    }
    if (!partial || input.priority !== undefined) {
      const priority = Number(input.priority ?? 50);
      normalized.priority = Math.min(100, Math.max(0, Math.round(priority)));
    }
    if (!partial || input.enabled !== undefined) {
      normalized.enabled = input.enabled !== false;
    }
    if (!partial || input.source !== undefined) {
      normalized.source = ['MANUAL', 'SUGGESTED', 'IMPORTED'].includes(
        String(input.source),
      )
        ? input.source
        : 'MANUAL';
    }
    if (!partial || input.reviewStatus !== undefined) {
      normalized.reviewStatus = ['APPROVED', 'PENDING'].includes(
        String(input.reviewStatus),
      )
        ? input.reviewStatus
        : 'APPROVED';
    }
    return normalized;
  }

  async listAiBrain(search?: string) {
    await this.ensureAiBrainTable();
    const term = String(search || '').trim();
    if (!term) {
      return this.dataSource.query(`
        SELECT * FROM ai_brain_entries
        ORDER BY priority DESC, "updatedAt" DESC
      `);
    }
    return this.dataSource.query(
      `
        SELECT * FROM ai_brain_entries
        WHERE title ILIKE $1 OR content ILIKE $1 OR category ILIKE $1 OR tags::text ILIKE $1
        ORDER BY priority DESC, "updatedAt" DESC
      `,
      [`%${term.slice(0, 120)}%`],
    );
  }

  async createAiBrain(input: AiBrainEntryInput) {
    await this.ensureAiBrainTable();
    const item = this.normalizeBrainInput(input);
    if (!item.title || !item.content) {
      throw new Error('Título e conteúdo do aprendizado são obrigatórios.');
    }
    const rows = await this.dataSource.query(
      `
        INSERT INTO ai_brain_entries
          (title, content, category, tags, priority, enabled, source, "reviewStatus")
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        item.title,
        item.content,
        item.category,
        JSON.stringify(item.tags || []),
        item.priority,
        item.enabled,
        item.source,
        item.reviewStatus,
      ],
    );
    return rows[0];
  }

  async updateAiBrain(id: string, input: AiBrainEntryInput) {
    await this.ensureAiBrainTable();
    const item = this.normalizeBrainInput(input, true);
    const fields: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown, cast = '') => {
      values.push(value);
      fields.push(`${column} = $${values.length}${cast}`);
    };

    if (item.title !== undefined) push('title', item.title);
    if (item.content !== undefined) push('content', item.content);
    if (item.category !== undefined) push('category', item.category);
    if (item.tags !== undefined)
      push('tags', JSON.stringify(item.tags), '::jsonb');
    if (item.priority !== undefined) push('priority', item.priority);
    if (item.enabled !== undefined) push('enabled', item.enabled);
    if (item.source !== undefined) push('source', item.source);
    if (item.reviewStatus !== undefined)
      push('"reviewStatus"', item.reviewStatus);

    if (fields.length === 0) {
      const existing = await this.dataSource.query(
        'SELECT * FROM ai_brain_entries WHERE id = $1 LIMIT 1',
        [id],
      );
      if (!existing[0])
        throw new NotFoundException('Aprendizado não encontrado.');
      return existing[0];
    }

    values.push(id);
    const rows = await this.dataSource.query(
      `
        UPDATE ai_brain_entries
        SET ${fields.join(', ')}, "updatedAt" = now()
        WHERE id = $${values.length}
        RETURNING *
      `,
      values,
    );
    if (!rows[0]) throw new NotFoundException('Aprendizado não encontrado.');
    return rows[0];
  }

  async deleteAiBrain(id: string) {
    await this.ensureAiBrainTable();
    const rows = await this.dataSource.query(
      'DELETE FROM ai_brain_entries WHERE id = $1 RETURNING id',
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Aprendizado não encontrado.');
    return { deleted: true, id };
  }

  private buildBrainSearchQuery(query: string) {
    const stopWords = new Set([
      'para',
      'como',
      'com',
      'uma',
      'uns',
      'das',
      'dos',
      'que',
      'por',
      'sem',
      'sobre',
      'este',
      'esta',
      'isso',
      'perfil',
    ]);
    const tokens = String(query || '')
      .toLocaleLowerCase('pt-BR')
      .match(/[\p{L}\p{N}_-]{3,}/gu);
    return Array.from(new Set(tokens || []))
      .filter((token) => !stopWords.has(token))
      .slice(0, 10)
      .join(' OR ');
  }

  private async getAiTaskInstruction(query: string): Promise<string> {
    const normalized = String(query || '').toLocaleLowerCase('pt-BR');
    let settingKey = '';

    if (normalized.includes('sugestão de habilidades')) {
      settingKey = 'AI_INSTRUCTION_SKILL_SUGGESTION';
    } else if (
      normalized.includes('compatibilidade semântica') ||
      normalized.includes('matching em lote de habilidades')
    ) {
      settingKey = 'AI_INSTRUCTION_SKILL_COMPATIBILITY';
    } else if (normalized.includes('matching de vagas')) {
      settingKey = 'AI_INSTRUCTION_JOB_MATCH';
    } else if (
      normalized.includes('currículo') &&
      (normalized.includes('extração') || normalized.includes('análise profissional'))
    ) {
      settingKey = 'AI_INSTRUCTION_RESUME_ANALYSIS';
    }

    if (!settingKey) return '';
    const instruction = await this.getValue(settingKey, '');
    return String(instruction || '').trim().slice(0, 12000);
  }

  async findRelevantAiBrain(
    query: string,
    limit = 6,
    maxChars = 5000,
  ): Promise<string> {
    await this.ensureAiBrainTable();
    const taskInstruction = await this.getAiTaskInstruction(query);
    const taskBlock = taskInstruction
      ? `[INSTRUÇÕES ESPECÍFICAS DO ADMINISTRADOR PARA ESTA TAREFA - OBRIGATÓRIAS]\n${taskInstruction}`
      : '';
    const search = this.buildBrainSearchQuery(query);
    if (!search) return taskBlock;

    const safeLimit = Math.min(10, Math.max(1, Math.round(limit)));
    const rows = await this.dataSource.query(
      `
        SELECT
          id, title, content, category, tags, priority,
          ts_rank_cd(
            to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(category, '')),
            websearch_to_tsquery('simple', $1)
          ) AS rank
        FROM ai_brain_entries
        WHERE enabled = true
          AND "reviewStatus" = 'APPROVED'
          AND to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(category, ''))
              @@ websearch_to_tsquery('simple', $1)
        ORDER BY (priority * 0.01) + ts_rank_cd(
          to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(category, '')),
          websearch_to_tsquery('simple', $1)
        ) DESC, "updatedAt" DESC
        LIMIT ${safeLimit}
      `,
      [search],
    );

    if (rows.length === 0) return taskBlock;

    const selectedIds: string[] = [];
    let used = 0;
    const blocks: string[] = [];
    for (const row of rows) {
      const header = `[${row.category}] ${row.title}`;
      const remaining = maxChars - used - header.length - 4;
      if (remaining <= 80) break;
      const content = String(row.content || '').slice(0, Math.min(1600, remaining));
      blocks.push(`${header}\n${content}`);
      used += header.length + content.length + 4;
      selectedIds.push(row.id);
    }

    if (selectedIds.length > 0) {
      void this.dataSource
        .query(
          `
            UPDATE ai_brain_entries
            SET "useCount" = "useCount" + 1, "lastUsedAt" = now()
            WHERE id = ANY($1::uuid[])
          `,
          [selectedIds],
        )
        .catch(() => undefined);
    }

    return [taskBlock, blocks.join('\n\n')].filter(Boolean).join('\n\n');
  }
}
