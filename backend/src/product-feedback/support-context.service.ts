import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { SUPPORT_KNOWLEDGE_TOPICS } from './support-knowledge';
import type {
  SupportAudience,
  SupportKnowledgeBundle,
  SupportKnowledgeTopic,
  SupportProcedure,
} from './support-knowledge.types';

const RESERVED_PUBLIC_ROOTS = new Set([
  'user', 'company', 'admin', 'vagas', 'vagas-em', 'classificados', 'ajuda', 'termos',
  'login', 'embed', 'transferir', 'preview', 'convites', 'criador-de-curriculo',
  'criar-curriculo', 'curriculo-online',
]);

@Injectable()
export class SupportContextService {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(
    user: User,
    input: { message: string; pagePath: string; process?: string },
  ): Promise<SupportKnowledgeBundle> {
    const message = clean(input.message, 3000);
    const pagePath = normalizePath(clean(input.pagePath, 500) || '/');
    const process = clean(input.process, 160);
    const canAdmin = user.type === UserType.ADMIN;
    const canCompany = !canAdmin && Boolean(user.companyId);
    const canCandidate = !canAdmin;
    const audience: SupportKnowledgeBundle['audience'] = canAdmin
      ? 'ADMIN'
      : canCompany
        ? 'COMPANY'
        : 'CANDIDATE';

    const restrictedRequest = this.isRestrictedRequest({
      message,
      pagePath,
      canAdmin,
      canCompany,
      canCandidate,
    });

    const allowedAudiences = new Set<SupportAudience>(['PUBLIC']);
    if (canAdmin) allowedAudiences.add('ADMIN');
    if (canCandidate) allowedAudiences.add('CANDIDATE');
    if (canCompany) allowedAudiences.add('COMPANY');

    const haystack = normalizeText(`${message} ${process}`);
    const scored = SUPPORT_KNOWLEDGE_TOPICS
      .filter((topic) => topic.audiences.some((item) => allowedAudiences.has(item)))
      .map((topic) => ({ topic, score: this.scoreTopic(topic, pagePath, haystack) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const routeMatches = scored.filter((entry) => this.routeScore(entry.topic, pagePath) > 0);
    const selected: SupportKnowledgeTopic[] = [];
    if (routeMatches[0]) selected.push(routeMatches[0].topic);
    for (const entry of scored) {
      if (selected.some((item) => item.id === entry.topic.id)) continue;
      selected.push(entry.topic);
      if (selected.length >= 3) break;
    }

    if (!selected.length) {
      const fallback = SUPPORT_KNOWLEDGE_TOPICS.find((topic) =>
        topic.id === (canAdmin ? 'admin.overview' : canCompany ? 'company.home-profile' : 'candidate.home'),
      );
      if (fallback) selected.push(fallback);
    }

    const contextIds = selected.map((topic) => topic.id);
    const liveFacts = await this.loadLiveFacts(user, contextIds);
    const knowledge = this.renderKnowledge(selected, haystack, restrictedRequest);

    return {
      audience,
      currentScreen: routeMatches[0]?.topic.title || selected[0]?.title || process || 'Navegação geral',
      contextIds,
      restrictedRequest,
      liveFacts,
      knowledge,
    };
  }

  private scoreTopic(topic: SupportKnowledgeTopic, pagePath: string, haystack: string) {
    let score = this.routeScore(topic, pagePath);
    for (const keyword of topic.keywords) {
      const normalized = normalizeText(keyword);
      if (normalized && haystack.includes(normalized)) score += normalized.includes(' ') ? 22 : 12;
    }
    for (const procedure of topic.procedures) {
      if (this.procedureScore(procedure, haystack) > 0) score += 16;
    }
    return score;
  }

  private routeScore(topic: SupportKnowledgeTopic, pagePath: string) {
    return topic.routes.reduce((best, route) => Math.max(best, matchRoute(route, pagePath)), 0);
  }

  private procedureScore(procedure: SupportProcedure, haystack: string) {
    return procedure.intents.reduce((best, intent) => {
      const normalized = normalizeText(intent);
      return normalized && haystack.includes(normalized) ? Math.max(best, normalized.includes(' ') ? 30 : 16) : best;
    }, 0);
  }

  private isRestrictedRequest(input: {
    message: string;
    pagePath: string;
    canAdmin: boolean;
    canCompany: boolean;
    canCandidate: boolean;
  }) {
    const normalized = normalizeText(input.message);
    if (input.pagePath.startsWith('/admin') && !input.canAdmin) return true;
    if (input.pagePath.startsWith('/company') && !input.canCompany) return true;
    if (input.pagePath.startsWith('/user') && !input.canCandidate) return true;

    if (!input.canAdmin) {
      const adminOperations = [
        'painel admin', 'rota admin', 'moderar usuario', 'moderar empresa', 'aprovar empresa',
        'rejeitar empresa', 'vinculos admin', 'vault', 'api key interna', 'chave do gateway',
        'credencial do gateway', 'central whatsapp admin', 'rotacionar chave whatsapp',
        'configurar provedor de pagamento', 'configurar ia global',
      ];
      if (adminOperations.some((term) => normalized.includes(normalizeText(term)))) return true;
    }

    if (!input.canCompany) {
      const companyOperations = [
        'publicar vaga', 'editar vaga da empresa', 'ver candidatos inscritos', 'gerenciar candidato',
        'banco de talentos', 'convidar candidato', 'minha pagina da empresa', 'configurar contratacao',
        'triagem da empresa',
      ];
      if (companyOperations.some((term) => normalized.includes(normalizeText(term)))) return true;
    }

    return false;
  }

  private async loadLiveFacts(user: User, contextIds: string[]) {
    const facts: Record<string, unknown> = {
      account: {
        profileType: user.type || 'CANDIDATE',
        hasCompany: Boolean(user.companyId),
        isCompanyAdmin: Boolean(user.isCompanyAdmin),
        resumeStatus: user.resumeStatus || 'DRAFT',
        resumePublishedAt: user.resumePublishedAt || null,
        isOpenToWork: Boolean(user.isOpenToWork),
        hasPhone: Boolean(user.phone),
        city: user.city || null,
        state: user.state || null,
      },
    };

    if (user.companyId && user.type !== UserType.ADMIN) {
      try {
        const rows = await this.dataSource.query(
          `SELECT id, name, slug, "verificationStatus", category, city, state
           FROM companies WHERE id = $1 LIMIT 1`,
          [user.companyId],
        );
        if (rows[0]) facts.company = rows[0];
      } catch {
        // Suporte continua funcional mesmo se uma tabela opcional estiver indisponível.
      }
    }

    if (user.companyId && contextIds.includes('company.page')) {
      try {
        const rows = await this.dataSource.query(
          `SELECT status, revision, "publishedAt", "templateKey"
           FROM company_pages WHERE "companyId" = $1 LIMIT 1`,
          [user.companyId],
        );
        facts.companyPage = rows[0] || { status: 'DRAFT', publishedAt: null };
      } catch {
        // Sem fato vivo é melhor que inventar estado.
      }
    }

    if (user.companyId && contextIds.includes('company.jobs')) {
      try {
        const rows = await this.dataSource.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE active = true)::int AS active
           FROM jobs WHERE "companyId" = $1`,
          [user.companyId],
        );
        if (rows[0]) facts.companyJobs = rows[0];
      } catch {
        // noop
      }
    }

    if (contextIds.includes('candidate.classifieds')) {
      try {
        const rows = await this.dataSource.query(
          `SELECT status, COUNT(*)::int AS count
           FROM classified_listings WHERE "sellerUserId" = $1 GROUP BY status`,
          [user.id],
        );
        facts.classifieds = { byStatus: rows };
      } catch {
        // O módulo pode ainda não ter sido migrado no ambiente.
      }
    }

    if (contextIds.includes('candidate.payments')) {
      try {
        const rows = await this.dataSource.query(
          `SELECT p.id, p."productCode", pp.name AS "productName", p.status,
                  p.method, p.provider, p."amountCents", p."createdAt", p."paidAt", p."expiresAt"
           FROM payments p
           LEFT JOIN payment_products pp ON pp.code = p."productCode"
           WHERE p."userId" = $1
           ORDER BY p."createdAt" DESC
           LIMIT 5`,
          [user.id],
        );
        facts.recentPayments = rows;
      } catch {
        // Nunca substituir consulta falha por um status inventado.
      }
    }

    return facts;
  }

  private renderKnowledge(
    topics: SupportKnowledgeTopic[],
    haystack: string,
    restrictedRequest: boolean,
  ) {
    const chunks: string[] = [];
    chunks.push(
      'REGRA DE ACESSO: o servidor já filtrou estes subcontextos para o perfil autenticado. Use somente o conteúdo abaixo. Não complete lacunas com rotas, telas, permissões ou dados de outro perfil.',
    );
    if (restrictedRequest) {
      chunks.push(
        'PEDIDO RESTRITO DETECTADO: não forneça passos operacionais, nomes de controles internos, rotas privadas, dados ou credenciais da área que o perfil não pode acessar. Explique apenas que aquela função é restrita e ofereça um caminho permitido ao cliente.',
      );
    }

    for (const topic of topics) {
      const matchingProcedures = topic.procedures
        .map((procedure) => ({ procedure, score: this.procedureScore(procedure, haystack) }))
        .sort((a, b) => b.score - a.score);
      const procedures = matchingProcedures.filter((item) => item.score > 0).slice(0, 2);
      if (!procedures.length && topic.procedures[0]) procedures.push({ procedure: topic.procedures[0], score: 0 });

      const lines = [
        `\n[${topic.id}] ${topic.title}`,
        `Resumo: ${topic.summary}`,
        `Funções: ${topic.functions.slice(0, 7).join(' | ')}`,
      ];
      for (const { procedure } of procedures) {
        lines.push(`Passo a passo — ${procedure.title}: ${procedure.steps.map((step, index) => `${index + 1}) ${step}`).join(' ')}`);
        if (procedure.notes?.length) lines.push(`Observações: ${procedure.notes.slice(0, 2).join(' | ')}`);
      }
      if (topic.consults?.length) {
        lines.push(`Onde consultar: ${topic.consults.slice(0, 3).map((item) => `${item.label} -> ${item.source}. Regra: ${item.rule}`).join(' | ')}`);
      }
      if (topic.boundaries?.length) lines.push(`Limites: ${topic.boundaries.slice(0, 5).join(' | ')}`);
      chunks.push(lines.join('\n'));
    }

    const text = chunks.join('\n');
    return text.length <= 3400 ? text : `${text.slice(0, 3380)}\n[contexto truncado com segurança]`;
  }
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePath(value: string) {
  const path = String(value || '/').split('?')[0].split('#')[0];
  if (!path.startsWith('/')) return `/${path}`;
  return path || '/';
}

function matchRoute(pattern: string, path: string) {
  if (pattern === path) return 140;

  if (pattern === '/:companySlug') {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 1 && !RESERVED_PUBLIC_ROOTS.has(segments[0])) return 115;
    return 0;
  }
  if (pattern === '/:companySlug/termos' || pattern === '/:companySlug/privacidade') {
    const suffix = pattern.endsWith('/termos') ? 'termos' : 'privacidade';
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 2 && segments[1] === suffix && !RESERVED_PUBLIC_ROOTS.has(segments[0])) return 125;
    return 0;
  }

  if (pattern.endsWith('/') && path.startsWith(pattern)) return 130;

  // Raízes de workspace só pontuam a página inicial. Evita que /company
  // contamine todos os subcontextos de /company/*.
  if (pattern === '/user' || pattern === '/company' || pattern === '/admin') return 0;

  return 0;
}
