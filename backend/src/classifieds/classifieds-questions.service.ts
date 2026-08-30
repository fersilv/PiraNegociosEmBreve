import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

const STOP_WORDS = new Set([
  'a','o','as','os','um','uma','uns','umas','de','da','do','das','dos','e','ou','em','no','na','nos','nas','para','por','com','sem','que','qual','quais','como','quando','onde','tem','ter','esse','essa','este','esta','isso','produto','item','servico','serviço','ele','ela','eu','voce','você','me','meu','minha','seu','sua','mais','menos','ja','já','ainda','sobre','pra','pro',
]);

@Injectable()
export class ClassifiedsQuestionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  async publicForListing(listingId: string) {
    await this.assertPublishedCompanyListing(listingId);
    const rows = await this.dataSource.query(
      `SELECT q.id,q.question,q.answer,q."answeredAt",q."publishedAt",q."helpfulCount"
       FROM classified_listing_questions q
       WHERE q."listingId"=$1 AND q.status='ANSWERED' AND q.answer IS NOT NULL
       ORDER BY q."helpfulCount" DESC,q."publishedAt" DESC,q."answeredAt" DESC
       LIMIT 80`,
      [listingId],
    ).catch(() => []);
    return rows.map((row: any) => this.publicQuestion(row));
  }

  async mine(uid: string, listingId: string) {
    await this.assertPublishedCompanyListing(listingId);
    const rows = await this.dataSource.query(
      `SELECT id,question,answer,status,"answeredAt","publishedAt","helpfulCount","createdAt","updatedAt"
       FROM classified_listing_questions
       WHERE "listingId"=$1 AND "askerUserId"=$2
       ORDER BY "createdAt" DESC LIMIT 50`,
      [listingId, uid],
    ).catch(() => []);
    return rows.map((row: any) => ({
      ...this.publicQuestion(row),
      status: row.status,
      own: true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async suggest(listingId: string, rawQuestion: unknown) {
    await this.assertPublishedCompanyListing(listingId);
    const question = this.cleanQuestion(rawQuestion);
    this.assertSafeInteraction(question);
    const source = this.tokens(question);
    if (!source.size) return { match: null };
    const rows = await this.dataSource.query(
      `SELECT id,question,answer,"answeredAt","publishedAt","helpfulCount"
       FROM classified_listing_questions
       WHERE "listingId"=$1 AND status='ANSWERED' AND answer IS NOT NULL
       ORDER BY "helpfulCount" DESC,"publishedAt" DESC LIMIT 100`,
      [listingId],
    ).catch(() => []);
    let best: { row: any; score: number } | null = null;
    for (const row of rows) {
      const target = this.tokens(row.question);
      const score = this.overlap(source, target);
      if (!best || score > best.score) best = { row, score };
    }
    if (!best || best.score < 0.55) return { match: null };
    return {
      match: {
        ...this.publicQuestion(best.row),
        similarity: Number(best.score.toFixed(3)),
      },
    };
  }

  async ask(uid: string, listingId: string, body: Record<string, unknown>) {
    if (body.acceptedTerms !== true) {
      throw new BadRequestException('Ao enviar uma pergunta, confirme os Termos de Uso e a Política de Privacidade do PiraNegócios.');
    }
    const listing = await this.assertPublishedCompanyListing(listingId);
    if (String(listing.sellerUserId) === uid) throw new BadRequestException('Você não pode perguntar no próprio anúncio.');
    const question = this.cleanQuestion(body.question);
    this.assertSafeInteraction(question);
    const normalized = this.normalize(question);
    const duplicate = await this.dataSource.query(
      `SELECT id,status FROM classified_listing_questions
       WHERE "listingId"=$1 AND "askerUserId"=$2 AND "normalizedQuestion"=$3
         AND "createdAt">now()-interval '24 hours'
       ORDER BY "createdAt" DESC LIMIT 1`,
      [listingId, uid, normalized],
    ).catch(() => []);
    if (duplicate[0]) throw new BadRequestException('Você já enviou esta pergunta recentemente.');

    const rows = await this.dataSource.query(
      `INSERT INTO classified_listing_questions("listingId","askerUserId","companyId",question,"normalizedQuestion")
       VALUES ($1,$2,$3,$4,$5) RETURNING id,question,status,"createdAt","updatedAt"`,
      [listingId, uid, listing.companyId, question, normalized],
    );
    await this.notifications.notifyCompany(listing.companyId, {
      title: 'Nova pergunta em um anúncio',
      message: `Uma nova pergunta chegou em “${String(listing.title || 'anúncio').slice(0, 120)}”.`,
      type: 'classified_question_new',
      link: '/classificados/perguntas',
    }).catch(() => undefined);
    return { ...rows[0], own: true, message: 'Pergunta enviada. Ela fica privada até a empresa responder.' };
  }

  async helpful(uid: string, questionId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const inserted = await manager.query(
        `INSERT INTO classified_listing_question_helpful("questionId","userId")
         SELECT q.id,$2 FROM classified_listing_questions q WHERE q.id=$1 AND q.status='ANSWERED'
         ON CONFLICT ("questionId","userId") DO NOTHING RETURNING "questionId"`,
        [questionId, uid],
      );
      if (!inserted[0]) return null;
      const rows = await manager.query(
        `UPDATE classified_listing_questions SET "helpfulCount"="helpfulCount"+1,"updatedAt"=now()
         WHERE id=$1 RETURNING "helpfulCount"`,
        [questionId],
      );
      return rows[0] || null;
    });
    return { registered: Boolean(result), helpfulCount: Number(result?.helpfulCount || 0) };
  }

  async companySummary(uid: string) {
    const companyId = await this.companyId(uid);
    const rows = await this.dataSource.query(
      `SELECT count(*) FILTER (WHERE status='PENDING')::int AS pending,
              count(*) FILTER (WHERE status='ANSWERED')::int AS answered,
              count(*) FILTER (WHERE status='HIDDEN')::int AS hidden
       FROM classified_listing_questions WHERE "companyId"=$1`,
      [companyId],
    ).catch(() => []);
    return {
      pending: Number(rows[0]?.pending || 0),
      answered: Number(rows[0]?.answered || 0),
      hidden: Number(rows[0]?.hidden || 0),
    };
  }

  async companyList(uid: string, statusRaw?: unknown) {
    const companyId = await this.companyId(uid);
    const status = String(statusRaw || 'ALL').trim().toUpperCase();
    if (!['ALL','PENDING','ANSWERED','HIDDEN'].includes(status)) throw new BadRequestException('Filtro de perguntas inválido.');
    const params: unknown[] = [companyId];
    const filter = status === 'ALL' ? '' : `AND q.status=$2`;
    if (status !== 'ALL') params.push(status);
    const rows = await this.dataSource.query(
      `SELECT q.*,l.title,l.slug,i.url AS image,
              COALESCE(u."socialName",u."displayName",u."fullName",'Cliente') AS "askerName"
       FROM classified_listing_questions q
       JOIN classified_listings l ON l.id=q."listingId"
       LEFT JOIN users u ON u.id=q."askerUserId"
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1
       ) i ON true
       WHERE q."companyId"=$1 ${filter}
       ORDER BY CASE q.status WHEN 'PENDING' THEN 0 WHEN 'ANSWERED' THEN 1 ELSE 2 END,q."createdAt" DESC
       LIMIT 500`,
      params,
    );
    return rows.map((row: any) => ({
      id: row.id,
      listingId: row.listingId,
      listingTitle: row.title,
      listingSlug: row.slug,
      image: row.image || null,
      askerFirstName: this.firstName(row.askerName),
      question: row.question,
      answer: row.answer || null,
      status: row.status,
      helpfulCount: Number(row.helpfulCount || 0),
      createdAt: row.createdAt,
      answeredAt: row.answeredAt || null,
      updatedAt: row.updatedAt,
    }));
  }

  async answer(uid: string, questionId: string, body: Record<string, unknown>) {
    const companyId = await this.companyId(uid);
    const answer = String(body.answer || '').trim().replace(/\s+/g, ' ');
    if (answer.length < 2 || answer.length > 1800) throw new BadRequestException('A resposta deve ter entre 2 e 1.800 caracteres.');
    this.assertSafeInteraction(answer);
    const rows = await this.dataSource.query(
      `UPDATE classified_listing_questions
       SET answer=$3,status='ANSWERED',"answeredByUserId"=$4,"answeredAt"=now(),"publishedAt"=COALESCE("publishedAt",now()),"updatedAt"=now()
       WHERE id=$1 AND "companyId"=$2
       RETURNING *`,
      [questionId, companyId, answer, uid],
    );
    if (!rows[0]) throw new NotFoundException('Pergunta não encontrada.');
    await this.notifications.notifyUser(rows[0].askerUserId, {
      title: 'Sua pergunta foi respondida',
      message: 'A empresa respondeu uma pergunta que você fez em um anúncio.',
      type: 'classified_question_answered',
      link: `/classificados/explorar`,
    }).catch(() => undefined);
    return this.presentCompanyQuestion(rows[0]);
  }

  async hide(uid: string, questionId: string) {
    const companyId = await this.companyId(uid);
    const rows = await this.dataSource.query(
      `UPDATE classified_listing_questions SET status='HIDDEN',"publishedAt"=NULL,"updatedAt"=now()
       WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      [questionId, companyId],
    );
    if (!rows[0]) throw new NotFoundException('Pergunta não encontrada.');
    return this.presentCompanyQuestion(rows[0]);
  }

  private async assertPublishedCompanyListing(listingId: string) {
    const rows = await this.dataSource.query(
      `SELECT id,title,"companyId","sellerUserId",status FROM classified_listings WHERE id=$1 LIMIT 1`,
      [listingId],
    );
    const listing = rows[0];
    if (!listing || listing.status !== 'PUBLISHED') throw new NotFoundException('Anúncio não encontrado.');
    if (!listing.companyId) throw new BadRequestException('Perguntas públicas estão disponíveis em anúncios de empresas.');
    return listing;
  }

  private async companyId(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY' || !identity.company?.id) throw new ForbiddenException('Abra o workspace Business para administrar perguntas.');
    return identity.company.id;
  }

  private cleanQuestion(value: unknown) {
    const question = String(value || '').trim().replace(/\s+/g, ' ');
    if (question.length < 5 || question.length > 600) throw new BadRequestException('A pergunta deve ter entre 5 e 600 caracteres.');
    return question;
  }

  private assertSafeInteraction(text: string) {
    const value = text.normalize('NFKC');
    const compactDigits = value.replace(/\D/g, '');
    const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value);
    const url = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|com\.br|net|org|io|app|dev|me|co|br)(?:\/|\b))/i.test(value);
    const handle = /(^|\s)@[a-z0-9._-]{2,}/i.test(value);
    const phone = compactDigits.length >= 8 && /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]*\d{4}/.test(value);
    const contactPhrase = /\b(?:me\s+cham[ae]|chama\s+(?:no|na)|meu|minha|manda|envia|segue)\s+(?:whats(?:app)?|zap|instagram|insta|telegram|facebook|tiktok|linkedin|telefone|celular|numero|número|email|e-mail|arroba)\b/i.test(value)
      || /\b(?:whats(?:app)?|instagram|telegram|facebook|tiktok|linkedin|telefone|celular|numero|número|email|e-mail|contato|arroba)\s*[:=]\s*\S+/i.test(value);
    if (email || url || handle || phone || contactPhrase) {
      throw new BadRequestException('Para sua segurança, perguntas e respostas não podem compartilhar telefone, e-mail, redes sociais, @usuários, links externos ou outros dados de contato. Use os recursos internos do PiraNegócios.');
    }
  }

  private normalize(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private tokens(value: string) {
    return new Set(this.normalize(value).split(' ').filter((token) => token.length >= 3 && !STOP_WORDS.has(token)));
  }

  private overlap(a: Set<string>, b: Set<string>) {
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection += 1;
    return intersection / Math.min(a.size, b.size);
  }

  private publicQuestion(row: any) {
    return {
      id: row.id,
      question: row.question,
      answer: row.answer || null,
      answeredAt: row.answeredAt || null,
      publishedAt: row.publishedAt || null,
      helpfulCount: Number(row.helpfulCount || 0),
    };
  }

  private presentCompanyQuestion(row: any) {
    return {
      id: row.id,
      listingId: row.listingId,
      question: row.question,
      answer: row.answer || null,
      status: row.status,
      helpfulCount: Number(row.helpfulCount || 0),
      createdAt: row.createdAt,
      answeredAt: row.answeredAt || null,
      updatedAt: row.updatedAt,
    };
  }

  private firstName(value: unknown) {
    return String(value || 'Cliente').trim().split(/\s+/)[0].slice(0, 80) || 'Cliente';
  }
}
