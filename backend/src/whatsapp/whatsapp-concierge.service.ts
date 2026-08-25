import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { In, Repository } from 'typeorm';
import { ResumeImportService, type ResumeSourceDocumentInput } from '../ai/resume-import.service';
import { Application } from '../applications/entities/application.entity';
import { BillingSupportService } from '../payments/billing-support.service';
import { PaymentsService } from '../payments/payments.service';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobsService } from '../jobs/jobs.service';
import { JobMatchService } from '../job-match/job-match.service';
import { User, UserType } from '../users/entities/user.entity';
import { WhatsAppConversation } from './entities/whatsapp-concierge.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';
import { WhatsAppMessage, WhatsAppMessageDirection } from './entities/whatsapp-message.entity';
import { WhatsAppAiService } from './whatsapp-ai.service';
import { WhatsAppAlertService } from './whatsapp-alert.service';

type BufferedInbound = {
  raw: any;
  text: string;
  messageId: string;
  mimeType: string;
  isMedia: boolean;
};

type BufferState = {
  instance: WhatsAppInstance;
  client: any;
  chatId: string;
  senderWhatsAppId: string;
  phoneE164: string | null;
  firstAt: number;
  lastAt: number;
  messages: BufferedInbound[];
  timer: NodeJS.Timeout | null;
};

@Injectable()
export class WhatsAppConciergeService {
  private readonly logger = new Logger(WhatsAppConciergeService.name);
  private readonly buffers = new Map<string, BufferState>();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(WhatsAppConversation) private readonly conversations: Repository<WhatsAppConversation>,
    @InjectRepository(WhatsAppMessage) private readonly whatsappMessages: Repository<WhatsAppMessage>,
    private readonly jobsService: JobsService,
    private readonly jobMatch: JobMatchService,
    private readonly resumeImport: ResumeImportService,
    private readonly payments: PaymentsService,
    private readonly billingSupport: BillingSupportService,
    private readonly ai: WhatsAppAiService,
    private readonly alerts: WhatsAppAlertService,
  ) {}

  async handleInbound(instance: WhatsAppInstance, message: any, client: any) {
    if (!this.isDirectHumanInbound(message)) return { accepted: false };

    const identity = await this.resolveWhatsAppIdentity(message, client);
    if (!identity.chatId || !identity.whatsappId) return { accepted: false };

    const key = `${instance.id}:${identity.chatId}`;
    const now = Date.now();
    const item = this.toBufferedInbound(message);
    let buffer = this.buffers.get(key);
    if (!buffer) {
      buffer = {
        instance,
        client,
        chatId: identity.chatId,
        senderWhatsAppId: identity.whatsappId,
        phoneE164: identity.phoneE164,
        firstAt: now,
        lastAt: now,
        messages: [],
        timer: null,
      };
      this.buffers.set(key, buffer);
    }

    buffer.client = client;
    buffer.lastAt = now;
    buffer.senderWhatsAppId = identity.whatsappId;
    buffer.phoneE164 = identity.phoneE164 || buffer.phoneE164;
    buffer.messages.push(item);
    if (buffer.messages.length > 30) buffer.messages = buffer.messages.slice(-30);
    if (buffer.timer) clearTimeout(buffer.timer);

    // Primeira mensagem aguarda 30s. Cada fragmento adicional acrescenta 4s,
    // com teto de 90s para que uma conversa muito fragmentada não fique presa.
    const extension = Math.max(0, buffer.messages.length - 1) * 4000;
    const absoluteDeadline = Math.min(buffer.firstAt + 90_000, buffer.firstAt + 30_000 + extension);
    const deadline = Math.max(absoluteDeadline, now + 4000);
    buffer.timer = setTimeout(() => void this.flush(key), Math.max(1000, deadline - now));

    await this.touchConversation(buffer);
    return { accepted: true, buffered: buffer.messages.length, deadlineAt: new Date(deadline).toISOString() };
  }

  private async flush(key: string) {
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    this.buffers.delete(key);
    if (buffer.timer) clearTimeout(buffer.timer);

    try {
      const conversation = await this.touchConversation(buffer);
      const resolved = await this.resolvePlatformActor(buffer.senderWhatsAppId, buffer.phoneE164);
      conversation.userId = resolved.user?.id || null;
      conversation.companyId = resolved.company?.id || null;
      conversation.whatsappId = buffer.senderWhatsAppId;
      conversation.phoneE164 = buffer.phoneE164;
      conversation.lastProcessedAt = new Date();

      if (!resolved.user) {
        conversation.contextMode = 'GUEST';
        await this.conversations.save(conversation);
        await this.sendText(buffer, 'Ainda não encontrei uma conta do PiraNegócios vinculada a este WhatsApp. Entre ou crie sua conta em https://piranegocios.com.br/login e valide este número para eu conseguir acessar seus dados com segurança.');
        return;
      }

      const firstName = this.firstName(resolved.user);
      if (resolved.user.type === UserType.ADMIN) {
        conversation.contextMode = 'ADMIN';
      } else if (resolved.company && conversation.contextMode === 'UNRESOLVED') {
        const choice = this.readContextChoice(buffer.messages, resolved.company);
        if (!choice) {
          conversation.state = { ...(conversation.state || {}), awaitingContextChoice: true };
          await this.conversations.save(conversation);
          await this.sendText(buffer, `${firstName}, encontrei também a empresa ${resolved.company.name} vinculada à sua conta. Este atendimento é para você ou para a empresa ${resolved.company.name}?`);
          return;
        }
        conversation.contextMode = choice;
        conversation.state = { ...(conversation.state || {}), awaitingContextChoice: false };
      } else if (resolved.company && (conversation.state as any)?.awaitingContextChoice) {
        const choice = this.readContextChoice(buffer.messages, resolved.company);
        if (!choice) {
          await this.sendText(buffer, `Só preciso saber o contexto: atendimento pessoal ou para a empresa ${resolved.company.name}?`);
          return;
        }
        conversation.contextMode = choice;
        conversation.state = { ...(conversation.state || {}), awaitingContextChoice: false };
      } else if (conversation.contextMode === 'UNRESOLVED') {
        conversation.contextMode = 'CANDIDATE';
      }

      await this.conversations.save(conversation);
      const history = await this.recentHistory(buffer.instance.id, buffer.chatId);
      const requestText = buffer.messages.map((item) => item.text).filter(Boolean).join('\n');
      const availableContext = await this.contextSnapshot(resolved.user, resolved.company, conversation.contextMode);
      const decision = await this.ai.decide({
        actor: {
          id: resolved.user.id,
          type: resolved.user.type,
          firstName,
          company: resolved.company ? { id: resolved.company.id, name: resolved.company.name } : null,
        },
        contextMode: conversation.contextMode,
        activeFlow: conversation.activeFlow,
        flowState: conversation.state || {},
        messages: buffer.messages.map((item) => item.text),
        history,
        availableContext,
      });

      const result = await this.executeDecision({
        buffer,
        conversation,
        user: resolved.user,
        company: resolved.company,
        decision,
        requestText,
      });

      if (result?.handled) return;
      const reply = String(result?.reply || decision.reply || '').trim();
      if (reply) await this.sendText(buffer, reply);
    } catch (error) {
      this.logger.error(`Falha no concierge WhatsApp: ${this.errorText(error)}`);
      await this.alerts.send({
        severity: 'ATTENTION',
        title: 'Falha no atendimento automático do WhatsApp',
        instanceName: buffer.instance.name,
        instanceId: buffer.instance.id,
        error,
        context: { chatId: buffer.chatId, phoneE164: buffer.phoneE164, messageCount: buffer.messages.length },
      });
      await this.sendText(buffer, 'Tive um problema interno ao concluir esse atendimento. Sua mensagem foi recebida, mas a ação não foi executada. Tente novamente em instantes.').catch(() => undefined);
    }
  }

  private async executeDecision(input: {
    buffer: BufferState;
    conversation: WhatsAppConversation;
    user: User;
    company: Company | null;
    decision: any;
    requestText: string;
  }): Promise<{ handled?: boolean; reply?: string }> {
    const { buffer, conversation, user, company, decision, requestText } = input;
    const firstName = this.firstName(user);
    const intent = String(decision.intent || 'CHAT').toUpperCase();

    if (intent === 'CANCEL_FLOW') {
      conversation.activeFlow = null;
      conversation.state = {};
      await this.conversations.save(conversation);
      return { reply: 'Processo cancelado. Se quiser começar outra coisa, é só me dizer.' };
    }

    if (conversation.contextMode === 'ADMIN') {
      if (intent === 'ADMIN_STATUS') {
        return { reply: `${firstName}, a instância ${buffer.instance.name} está conectada e recebendo mensagens. Posso consultar também os dados operacionais que você pedir.` };
      }
      return { reply: decision.reply || `${firstName}, identifiquei você como administrador. O que precisa consultar ou executar?` };
    }

    if (conversation.contextMode === 'CANDIDATE') {
      if (intent === 'LIST_APPLICATIONS') {
        const rows = await this.applications.find({ where: { candidateId: user.id }, order: { createdAt: 'DESC' }, take: 12 });
        const result = rows.map((row) => ({ vaga: row.jobTitle, empresa: row.companyName, status: row.status, candidaturaEm: row.createdAt }));
        return { reply: await this.ai.composeReply({ firstName, request: requestText, result, contextMode: 'CANDIDATE' }) };
      }
      if (intent === 'JOB_MATCHES') {
        const matches = await this.jobMatch.getMatches(user.id);
        if (!(matches as any).active) {
          return { reply: `${firstName}, a busca automática por compatibilidade segue as mesmas regras do painel e não está ativa na sua conta agora. Você pode consultar/ativar esse recurso em https://piranegocios.com.br/dashboard/vagas` };
        }
        const top = ((matches as any).matches || []).slice(0, 8);
        const ids = top.map((item: any) => item.jobId).filter(Boolean);
        const jobs = ids.length ? await this.jobs.findBy({ id: In(ids) }) : [];
        const jobMap = new Map(jobs.map((job) => [job.id, job]));
        const result = top.map((item: any) => {
          const job = jobMap.get(item.jobId);
          return { ...item, title: job?.title, companyName: job?.companyName, city: job?.city, state: job?.state, url: job?.slug ? `https://piranegocios.com.br/vagas/${job.slug}` : null };
        });
        return { reply: await this.ai.composeReply({ firstName, request: requestText, result, contextMode: 'CANDIDATE' }) };
      }
      if (intent === 'GET_RESUME') {
        if (!user.publishedResumeSnapshot && !user.resumeURL) {
          return { reply: `${firstName}, você ainda não tem um currículo salvo/publicado. Abra https://piranegocios.com.br/dashboard/curriculo para criar o seu. Se preferir, diga “quero criar meu currículo” e eu inicio a triagem por aqui.` };
        }
        if (user.resumeURL) {
          try {
            await buffer.client.sendFile(buffer.chatId, user.resumeURL, `curriculo-${firstName}.pdf`, 'Seu currículo do PiraNegócios.');
            return { handled: true };
          } catch {
            // Currículos construídos no editor nem sempre possuem um arquivo físico legado.
          }
        }
        return { reply: `${firstName}, seu currículo está salvo no editor, mas esta versão ainda precisa ser renderizada em PDF pelo próprio editor para preservar exatamente o layout escolhido. Você pode abrir https://piranegocios.com.br/dashboard/curriculo e tocar em PDF. Estou mantendo esse caso separado para não te enviar um currículo com visual diferente do que você montou.` };
      }
      if (intent === 'SET_RESUME_PHOTO') {
        const media = [...buffer.messages].reverse().find((item) => item.isMedia && item.mimeType.startsWith('image/'));
        if (!media) return { reply: 'Envie a foto que você quer usar e diga que deseja colocá-la no currículo.' };
        const url = await this.persistImageFromMessage(buffer.client, media.raw, media.mimeType, user.id);
        user.resumePhotoURL = url;
        await this.users.save(user);
        return { reply: `${firstName}, atualizei a foto do seu currículo. Ela já fica vinculada ao seu perfil no editor.` };
      }
      if (intent === 'IMPORT_RESUME') {
        const documents = await this.collectResumeDocuments(buffer);
        if (!documents.length) return { reply: 'Pode me enviar o currículo, Carteira de Trabalho, certificados ou outros documentos em PDF ou imagem. Quando terminar, diga que posso organizar o currículo.' };
        const imported = await this.importResumeWithBilling(user, documents);
        this.applyImportedResume(user, imported);
        await this.users.save(user);
        return { reply: `${firstName}, organizei as informações dos documentos e salvei o rascunho do seu currículo. Revise no painel antes de publicar: https://piranegocios.com.br/dashboard/curriculo` };
      }
      if (intent === 'START_RESUME_CREATE' || conversation.activeFlow === 'RESUME_CREATE') {
        return this.resumeCreationFlow(conversation, user, decision, requestText);
      }
      return { reply: decision.reply || `${firstName}, como posso ajudar com suas vagas, candidaturas ou currículo?` };
    }

    if (conversation.contextMode === 'COMPANY') {
      if (!company) return { reply: 'Não consegui localizar a empresa vinculada a esta conta.' };
      const companyJobs = await this.jobs.find({ where: { companyId: company.id }, order: { createdAt: 'DESC' } });
      if (intent === 'LIST_COMPANY_JOBS') {
        const result = companyJobs.slice(0, 20).map((job) => ({ id: job.id, title: job.title, active: job.active, city: job.city, state: job.state, url: job.slug ? `https://piranegocios.com.br/vagas/${job.slug}` : null }));
        return { reply: await this.ai.composeReply({ firstName, request: requestText, result, contextMode: 'COMPANY' }) };
      }
      if (intent === 'JOB_APPLICATION_COUNTS') {
        const ids = companyJobs.map((job) => job.id);
        const rows = ids.length ? await this.applications.createQueryBuilder('app')
          .select('app.jobId', 'jobId')
          .addSelect('COUNT(*)', 'count')
          .where('app.jobId IN (:...ids)', { ids })
          .groupBy('app.jobId')
          .getRawMany() : [];
        const counts = new Map(rows.map((row: any) => [String(row.jobId), Number(row.count || 0)]));
        const result = companyJobs.map((job) => ({ id: job.id, title: job.title, active: job.active, candidates: counts.get(job.id) || 0 }));
        return { reply: await this.ai.composeReply({ firstName, request: requestText, result, contextMode: 'COMPANY' }) };
      }
      if (intent === 'JOB_MATCH_CANDIDATES') {
        const jobId = String(decision.args?.jobId || (companyJobs.length === 1 ? companyJobs[0].id : '')).trim();
        const job = companyJobs.find((item) => item.id === jobId);
        if (!job) {
          return { reply: `Qual vaga você quer analisar? ${companyJobs.slice(0, 8).map((item) => `${item.title} (${item.id})`).join('; ')}` };
        }
        const result = await this.jobMatch.getCompanyCandidatesForJob(user.id, job.id);
        return { reply: await this.ai.composeReply({ firstName, request: requestText, result: { job: job.title, ...result }, contextMode: 'COMPANY' }) };
      }
      if (intent === 'START_JOB_CREATE' || conversation.activeFlow === 'JOB_CREATE') {
        return this.jobCreationFlow(conversation, user, company, decision, requestText);
      }
      if (intent === 'START_JOB_EDIT' || conversation.activeFlow === 'JOB_EDIT') {
        return this.jobEditFlow(conversation, user, company, companyJobs, decision, requestText);
      }
      return { reply: decision.reply || `${firstName}, posso consultar vagas e candidatos ou iniciar a criação/edição de uma vaga da ${company.name}.` };
    }

    return { reply: decision.reply || 'Como posso ajudar?' };
  }

  private async resumeCreationFlow(conversation: WhatsAppConversation, user: User, decision: any, requestText: string) {
    const state = { ...(conversation.state || {}) } as any;
    const draft = { ...(state.resumeDraft || {}), ...(decision.args?.patch && typeof decision.args.patch === 'object' ? decision.args.patch : {}), ...(decision.statePatch?.resumeDraft || {}) };
    conversation.activeFlow = 'RESUME_CREATE';
    state.resumeDraft = draft;
    conversation.state = state;

    const fields = [
      ['fullName', 'seu nome completo'],
      ['city', 'sua cidade e estado'],
      ['experiences', 'suas experiências profissionais, com empresa, cargo e período'],
      ['education', 'sua formação/escolaridade'],
      ['skills', 'suas principais habilidades'],
    ];
    const missing = fields.find(([field]) => !draft[field] || (Array.isArray(draft[field]) && !draft[field].length));
    if (String(requestText).trim().toUpperCase() === 'SALVAR CURRICULO' && !missing) {
      this.applyImportedResume(user, draft);
      await this.users.save(user);
      conversation.activeFlow = null;
      conversation.state = {};
      await this.conversations.save(conversation);
      return { reply: 'Salvei o rascunho do currículo. Revise os dados e escolha o modelo visual no painel antes de publicar: https://piranegocios.com.br/dashboard/curriculo' };
    }

    await this.conversations.save(conversation);
    if (missing) return { reply: `Vamos montar seu currículo. Me conte ${missing[1]}. Você também pode enviar currículo, Carteira de Trabalho ou certificados em PDF/foto a qualquer momento.` };
    return { reply: 'Já tenho os dados essenciais do rascunho. Se estiver tudo certo, responda SALVAR CURRICULO. Se quiser corrigir algo, me diga a correção antes.' };
  }

  private async jobCreationFlow(conversation: WhatsAppConversation, user: User, company: Company, decision: any, requestText: string) {
    const state = { ...(conversation.state || {}) } as any;
    const current = { ...(state.jobDraft || {}) };
    const patch = decision.args?.patch && typeof decision.args.patch === 'object' ? decision.args.patch : {};
    const jobDraft = { ...current, ...patch };
    conversation.activeFlow = 'JOB_CREATE';
    state.jobDraft = jobDraft;
    conversation.state = state;

    const missing: Array<[string, string]> = [
      ['title', 'Qual é o cargo/título da vaga?'],
      ['description', 'Quais serão as principais atividades e responsabilidades?'],
      ['requirements', 'Quais requisitos são obrigatórios ou desejáveis?'],
      ['city', 'Em qual cidade será o trabalho?'],
      ['state', 'Qual é o estado/UF?'],
      ['type', 'Qual o tipo de contratação? Ex.: CLT, temporário, estágio.'],
      ['workModel', 'O trabalho é presencial, híbrido ou remoto?'],
    ];
    const next = missing.find(([field]) => !jobDraft[field] || (Array.isArray(jobDraft[field]) && !jobDraft[field].length));

    if (String(decision.intent || '').toUpperCase() === 'CONFIRM_JOB_CREATE' || /^\s*(PUBLICAR|CONFIRMO|PODE PUBLICAR)\s*[.!]?\s*$/i.test(requestText)) {
      if (next) {
        await this.conversations.save(conversation);
        return { reply: `Antes de publicar ainda falta uma informação: ${next[1]}` };
      }
      const created = await this.jobsService.create(user.id, company, jobDraft as Partial<Job>);
      conversation.activeFlow = null;
      conversation.state = {};
      await this.conversations.save(conversation);
      return { reply: `Vaga publicada: ${created.title}. ${created.slug ? `https://piranegocios.com.br/vagas/${created.slug}` : ''}`.trim() };
    }

    await this.conversations.save(conversation);
    if (next) return { reply: next[1] };
    const skills = Array.isArray(jobDraft.skills) && jobDraft.skills.length ? `\nHabilidades: ${jobDraft.skills.join(', ')}` : '';
    return { reply: `Rascunho pronto para ${company.name}: ${jobDraft.title}.\nLocal: ${jobDraft.city}/${jobDraft.state} · ${jobDraft.type} · ${jobDraft.workModel}.${skills}\nSe estiver certo, responda PUBLICAR. Para interromper, diga CANCELAR.` };
  }

  private async jobEditFlow(conversation: WhatsAppConversation, user: User, company: Company, companyJobs: Job[], decision: any, requestText: string) {
    const state = { ...(conversation.state || {}) } as any;
    let jobId = String(decision.args?.jobId || state.jobEditId || '').trim();
    if (!jobId && companyJobs.length === 1) jobId = companyJobs[0].id;
    const job = companyJobs.find((item) => item.id === jobId);
    if (!job) {
      conversation.activeFlow = 'JOB_EDIT';
      await this.conversations.save(conversation);
      return { reply: `Qual vaga deseja editar? ${companyJobs.slice(0, 10).map((item) => `${item.title} (${item.id})`).join('; ')}` };
    }
    const patch = { ...(state.jobEditPatch || {}), ...(decision.args?.patch && typeof decision.args.patch === 'object' ? decision.args.patch : {}) };
    state.jobEditId = job.id;
    state.jobEditPatch = patch;
    conversation.activeFlow = 'JOB_EDIT';
    conversation.state = state;

    if (String(decision.intent || '').toUpperCase() === 'CONFIRM_JOB_EDIT' || /^\s*(CONFIRMO|PODE ALTERAR|SALVAR ALTERACOES|SALVAR ALTERAÇÕES)\s*[.!]?\s*$/i.test(requestText)) {
      if (!Object.keys(patch).length) return { reply: 'Ainda não há nenhuma alteração no rascunho. Diga o que deseja mudar na vaga.' };
      await this.jobsService.update(user.id, job.id, patch as Partial<Job>, true);
      conversation.activeFlow = null;
      conversation.state = {};
      await this.conversations.save(conversation);
      return { reply: `Alterações salvas na vaga ${job.title}.` };
    }

    await this.conversations.save(conversation);
    if (!Object.keys(patch).length) return { reply: `Certo. O que você quer alterar na vaga ${job.title}?` };
    return { reply: `Preparei estas alterações para ${job.title}: ${JSON.stringify(patch)}. Se estiver correto, responda CONFIRMO. Se quiser mudar algo, me diga antes.` };
  }

  private async contextSnapshot(user: User, company: Company | null, mode: string) {
    if (mode === 'CANDIDATE') {
      const applications = await this.applications.find({ where: { candidateId: user.id }, order: { createdAt: 'DESC' }, take: 8 });
      return {
        resumeStatus: user.resumeStatus,
        hasPublishedResume: Boolean(user.publishedResumeSnapshot || user.resumeURL),
        aiImportCount: user.aiImportCount,
        applications: applications.map((item) => ({ id: item.id, jobId: item.jobId, title: item.jobTitle, company: item.companyName, status: item.status })),
      };
    }
    if (mode === 'COMPANY' && company) {
      const jobs = await this.jobs.find({ where: { companyId: company.id }, order: { createdAt: 'DESC' }, take: 20 });
      return { company: { id: company.id, name: company.name }, jobs: jobs.map((job) => ({ id: job.id, title: job.title, active: job.active, city: job.city, state: job.state })) };
    }
    return {};
  }

  private async collectResumeDocuments(buffer: BufferState): Promise<ResumeSourceDocumentInput[]> {
    const supported = buffer.messages.filter((item) => item.isMedia && /^(application\/pdf|image\/(png|jpeg|jpg|webp))$/i.test(item.mimeType));
    const documents: ResumeSourceDocumentInput[] = [];
    for (const [index, item] of supported.slice(0, 8).entries()) {
      const raw = await buffer.client.downloadMedia(item.raw);
      if (typeof raw !== 'string') continue;
      const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
      const mimeType = match?.[1] || item.mimeType;
      const base64File = match?.[2] || raw;
      documents.push({ base64File, mimeType, fileName: `whatsapp-documento-${index + 1}.${this.extensionForMime(mimeType)}` });
    }
    return documents;
  }

  private async importResumeWithBilling(user: User, documents: ResumeSourceDocumentInput[]) {
    const [product, credits, lifetimeFree, devMode] = await Promise.all([
      this.payments.findProduct('RESUME_AI_IMPORT', true),
      this.payments.getCredits(user.id),
      this.billingSupport.isLifetimeFree(user.id),
      this.payments.getDevMode(),
    ]);
    const override = lifetimeFree || devMode.enabled;
    const count = Number(user.aiImportCount || 0);
    const freeLimit = user.aiImportLimit ?? Number(product.freeUses ?? 1);
    const freeAvailable = count < freeLimit;
    const freeNow = Boolean(product.enabled) && Number(product.effectivePriceCents || 0) === 0;
    const hasCredit = Number(credits.RESUME_AI_IMPORT || 0) > 0;

    if (!override && !freeAvailable && !freeNow && !hasCredit) {
      throw new ForbiddenException({ code: 'PAYMENT_REQUIRED', productCode: product.code, message: 'Sua primeira organização por IA já foi utilizada. Uma nova importação requer um crédito.' });
    }

    let consumed = false;
    if (!override && !freeAvailable && !freeNow && hasCredit) {
      await this.payments.consumeCredit(user.id, 'RESUME_AI_IMPORT');
      consumed = true;
    }
    try {
      const result = await this.resumeImport.importDocuments(documents);
      user.aiImportCount = count + 1;
      return result;
    } catch (error) {
      if (consumed) await this.payments.grantCredit(user.id, 'RESUME_AI_IMPORT', 1).catch(() => undefined);
      throw error;
    }
  }

  private applyImportedResume(user: User, imported: any) {
    if (imported?.name && !user.fullName) user.fullName = String(imported.name);
    if (imported?.treatment && !user.treatment) user.treatment = String(imported.treatment);
    if (imported?.phone && !user.phone) user.phone = String(imported.phone);
    if (imported?.bio !== undefined) user.bio = imported.bio ? String(imported.bio) : user.bio;
    if (Array.isArray(imported?.experiences)) user.experiences = imported.experiences;
    if (Array.isArray(imported?.education)) user.education = imported.education;
    if (Array.isArray(imported?.skills)) user.skills = imported.skills.map(String).slice(0, 20);
    if (Array.isArray(imported?.courses)) user.courses = imported.courses;
    if (Array.isArray(imported?.languages)) user.languages = imported.languages;
    if (Array.isArray(imported?.additionalPhones)) user.additionalPhones = imported.additionalPhones.map(String);
    user.resumeStatus = 'DRAFT';
  }

  private async persistImageFromMessage(client: any, message: any, mimeType: string, userId: string) {
    const raw = await client.downloadMedia(message);
    if (typeof raw !== 'string') throw new BadRequestException('Não foi possível baixar a imagem enviada.');
    const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
    const base64 = match?.[2] || raw;
    const mime = match?.[1] || mimeType || 'image/jpeg';
    if (!mime.startsWith('image/')) throw new BadRequestException('O arquivo enviado não é uma imagem.');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 10 * 1024 * 1024) throw new BadRequestException('A imagem excede 10 MB.');
    const dir = join(process.cwd(), 'uploads');
    await mkdir(dir, { recursive: true });
    const ext = this.extensionForMime(mime);
    const fileName = `whatsapp-resume-photo-${this.safeId(userId)}-${Date.now()}.${ext}`;
    await writeFile(join(dir, fileName), buffer);
    return `${String(process.env.PUBLIC_BASE_URL || 'https://piranegocios.com.br').replace(/\/+$/, '')}/api/uploads/${fileName}`;
  }

  private async resolvePlatformActor(whatsappId: string, phoneE164: string | null) {
    const variants = this.phoneVariants(phoneE164);
    const rows = await this.users.query(
      `SELECT u.* FROM users u
       WHERE ($1 <> '' AND u."whatsappId" = $1)
          OR ($2 <> '' AND u."whatsappPhoneE164" = $2)
          OR regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = ANY($3::text[])
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(u."additionalPhones", '[]'::jsonb)) AS p(value)
            WHERE regexp_replace(p.value, '[^0-9]', '', 'g') = ANY($3::text[])
          )
       ORDER BY CASE WHEN u.type = 'ADMIN' THEN 0 ELSE 1 END,
                CASE WHEN u."whatsappVerifiedAt" IS NOT NULL THEN 0 ELSE 1 END,
                u."updatedAt" DESC
       LIMIT 4`,
      [whatsappId || '', phoneE164 || '', variants.length ? variants : ['__none__']],
    ) as User[];
    const user = rows[0] || null;
    if (!user) return { user: null, company: null };
    let company: Company | null = null;
    if (user.companyId) company = await this.companies.findOne({ where: { id: user.companyId } });
    if (!company) company = await this.companies.findOne({ where: { ownerId: user.id } });
    return { user, company };
  }

  private async resolveWhatsAppIdentity(message: any, client: any) {
    const chatId = this.serializeWid(message?.chatId || message?.from);
    const senderId = this.serializeWid(message?.sender?.id || message?.from || message?.chatId);
    let whatsappId = senderId || chatId;
    let phoneE164: string | null = null;
    try {
      const mapping = await client.getPnLidEntry(whatsappId);
      const phoneWid = this.serializeWid(mapping?.phoneNumber);
      const lidWid = this.serializeWid(mapping?.lid);
      if (lidWid && whatsappId.endsWith('@lid')) whatsappId = lidWid;
      phoneE164 = this.canonicalBrazilPhone(phoneWid || whatsappId);
    } catch {
      phoneE164 = this.canonicalBrazilPhone(whatsappId);
    }
    return { chatId: chatId || whatsappId, whatsappId, phoneE164 };
  }

  private isDirectHumanInbound(message: any) {
    if (!message || message.fromMe) return false;
    if (message.broadcast || message.isNotification || message.isPSA) return false;
    if (message.isGroupMsg) return false;
    if (message.isNewMsg === false) return false;
    const chatId = this.serializeWid(message.chatId || message.from);
    if (!chatId) return false;
    if (/@g\.us$|@newsletter$|@broadcast$/.test(chatId) || chatId === 'status@broadcast') return false;
    if (!/@(?:c\.us|lid|s\.whatsapp\.net)$/.test(chatId)) return false;
    const type = String(message.type || '').toLowerCase();
    const ignoredTypes = new Set(['e2e_notification', 'notification', 'gp2', 'protocol', 'revoked', 'ciphertext', 'unknown']);
    if (ignoredTypes.has(type)) return false;
    return Boolean(String(message.body || message.caption || '').trim() || message.isMedia);
  }

  private toBufferedInbound(message: any): BufferedInbound {
    const messageId = this.serializeWid(message?.id?._serialized || message?.id);
    const mimeType = String(message?.mimetype || message?.mimeType || '').toLowerCase();
    const body = String(message?.body || message?.caption || '').trim();
    const mediaLabel = message?.isMedia ? `[${mimeType || String(message?.type || 'mídia')} recebida${messageId ? ` · id ${messageId}` : ''}]` : '';
    return {
      raw: message,
      text: [body, mediaLabel].filter(Boolean).join(' '),
      messageId,
      mimeType,
      isMedia: Boolean(message?.isMedia),
    };
  }

  private async touchConversation(buffer: BufferState) {
    let row = await this.conversations.findOne({ where: { instanceId: buffer.instance.id, chatId: buffer.chatId } });
    if (!row) {
      row = this.conversations.create({
        instanceId: buffer.instance.id,
        chatId: buffer.chatId,
        whatsappId: buffer.senderWhatsAppId,
        phoneE164: buffer.phoneE164,
        userId: null,
        companyId: null,
        contextMode: 'UNRESOLVED',
        activeFlow: null,
        state: {},
        lastInboundAt: new Date(),
        lastProcessedAt: null,
      });
    } else {
      row.lastInboundAt = new Date();
      row.whatsappId = buffer.senderWhatsAppId;
      if (buffer.phoneE164) row.phoneE164 = buffer.phoneE164;
    }
    return this.conversations.save(row);
  }

  private async recentHistory(instanceId: string, chatId: string) {
    const rows = await this.whatsappMessages.find({ where: { instanceId, chatId }, order: { createdAt: 'DESC' }, take: 24 });
    return rows.reverse().map((row) => ({ direction: row.direction, body: row.body, createdAt: row.createdAt }));
  }

  private async sendText(buffer: BufferState, text: string) {
    const clean = String(text || '').trim();
    if (!clean) return;
    const result = await buffer.client.sendText(buffer.chatId, clean);
    await this.whatsappMessages.save(this.whatsappMessages.create({
      instanceId: buffer.instance.id,
      providerMessageId: this.serializeWid(result?.id?._serialized || result?.id).slice(0, 100) || null,
      chatId: buffer.chatId.slice(0, 120),
      senderId: null,
      direction: WhatsAppMessageDirection.OUTBOUND,
      type: 'text',
      body: clean,
      metadata: { source: 'whatsapp_concierge' },
      providerTimestamp: new Date(),
    }));
  }

  private readContextChoice(messages: BufferedInbound[], company: Company): 'CANDIDATE' | 'COMPANY' | null {
    const text = messages.map((item) => item.text).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const companyName = String(company.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/\b(empresa|recrutamento|rh|vaga da empresa|candidatos)\b/.test(text) || (companyName && text.includes(companyName))) return 'COMPANY';
    if (/\b(pessoal|meu curriculo|meu currículo|minhas vagas|minha candidatura|candidato)\b/.test(text)) return 'CANDIDATE';
    return null;
  }

  private firstName(user: User) {
    return String(user.socialName || user.fullName || user.displayName || 'Olá').trim().split(/\s+/)[0] || 'Olá';
  }

  private serializeWid(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value?._serialized === 'string') return value._serialized;
    if (value?.user && value?.server) return `${value.user}@${value.server}`;
    const text = String(value);
    return text === '[object Object]' ? '' : text;
  }

  private canonicalBrazilPhone(value: string | null) {
    let digits = String(value || '').split('@')[0].replace(/\D+/g, '');
    if (!digits) return null;
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`;
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
    return digits.length >= 10 && digits.length <= 15 ? digits : null;
  }

  private phoneVariants(phoneE164: string | null) {
    if (!phoneE164) return [];
    const digits = phoneE164.replace(/\D/g, '');
    return Array.from(new Set([digits, digits.startsWith('55') ? digits.slice(2) : `55${digits}`].filter((value) => value.length >= 10)));
  }

  private extensionForMime(mime: string) {
    const normalized = String(mime || '').toLowerCase();
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('webp')) return 'webp';
    if (normalized.includes('pdf')) return 'pdf';
    return 'jpg';
  }

  private safeId(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
  }

  private errorText(error: unknown) {
    if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 2000);
    return String(error).slice(0, 2000);
  }
}
