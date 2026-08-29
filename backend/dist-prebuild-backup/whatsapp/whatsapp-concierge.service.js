"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var WhatsAppConciergeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppConciergeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const typeorm_2 = require("typeorm");
const resume_import_service_1 = require("../ai/resume-import.service");
const application_entity_1 = require("../applications/entities/application.entity");
const billing_support_service_1 = require("../payments/billing-support.service");
const payments_service_1 = require("../payments/payments.service");
const company_entity_1 = require("../companies/entities/company.entity");
const company_plans_service_1 = require("../company-plans/company-plans.service");
const company_whatsapp_premium_service_1 = require("../company-plans/company-whatsapp-premium.service");
const job_entity_1 = require("../jobs/entities/job.entity");
const jobs_service_1 = require("../jobs/jobs.service");
const job_match_service_1 = require("../job-match/job-match.service");
const user_entity_1 = require("../users/entities/user.entity");
const whatsapp_concierge_entity_1 = require("./entities/whatsapp-concierge.entity");
const whatsapp_message_entity_1 = require("./entities/whatsapp-message.entity");
const whatsapp_ai_service_1 = require("./whatsapp-ai.service");
const whatsapp_alert_service_1 = require("./whatsapp-alert.service");
let WhatsAppConciergeService = WhatsAppConciergeService_1 = class WhatsAppConciergeService {
    users;
    companies;
    jobs;
    applications;
    conversations;
    whatsappMessages;
    jobsService;
    jobMatch;
    resumeImport;
    payments;
    billingSupport;
    ai;
    alerts;
    companyPlans;
    companyPremium;
    logger = new common_1.Logger(WhatsAppConciergeService_1.name);
    buffers = new Map();
    constructor(users, companies, jobs, applications, conversations, whatsappMessages, jobsService, jobMatch, resumeImport, payments, billingSupport, ai, alerts, companyPlans, companyPremium) {
        this.users = users;
        this.companies = companies;
        this.jobs = jobs;
        this.applications = applications;
        this.conversations = conversations;
        this.whatsappMessages = whatsappMessages;
        this.jobsService = jobsService;
        this.jobMatch = jobMatch;
        this.resumeImport = resumeImport;
        this.payments = payments;
        this.billingSupport = billingSupport;
        this.ai = ai;
        this.alerts = alerts;
        this.companyPlans = companyPlans;
        this.companyPremium = companyPremium;
    }
    async handleInbound(instance, message, client) {
        if (!this.isDirectHumanInbound(message))
            return { accepted: false };
        const identity = await this.resolveWhatsAppIdentity(message, client);
        if (!identity.chatId || !identity.whatsappId)
            return { accepted: false };
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
        buffer.instance = instance;
        buffer.lastAt = now;
        buffer.senderWhatsAppId = identity.whatsappId;
        buffer.phoneE164 = identity.phoneE164 || buffer.phoneE164;
        buffer.messages.push(item);
        if (buffer.messages.length > 30)
            buffer.messages = buffer.messages.slice(-30);
        if (buffer.timer)
            clearTimeout(buffer.timer);
        const extension = Math.max(0, buffer.messages.length - 1) * 2500;
        const absoluteDeadline = Math.min(buffer.firstAt + 45_000, buffer.firstAt + 15_000 + extension);
        const deadline = Math.max(absoluteDeadline, now + 2500);
        buffer.timer = setTimeout(() => void this.flush(key), Math.max(1000, deadline - now));
        await this.touchConversation(buffer);
        return { accepted: true, buffered: buffer.messages.length, deadlineAt: new Date(deadline).toISOString() };
    }
    async flush(key) {
        const buffer = this.buffers.get(key);
        if (!buffer)
            return;
        this.buffers.delete(key);
        if (buffer.timer)
            clearTimeout(buffer.timer);
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
            if (resolved.user.type === user_entity_1.UserType.ADMIN) {
                conversation.contextMode = 'ADMIN';
            }
            else if (resolved.company && conversation.contextMode === 'UNRESOLVED') {
                conversation.state = { ...(conversation.state || {}), awaitingContextChoice: true };
                await this.conversations.save(conversation);
                await this.sendText(buffer, `${firstName}, encontrei também a empresa ${resolved.company.name} vinculada à sua conta. Este atendimento é para você ou para a empresa ${resolved.company.name}?`);
                return;
            }
            else if (resolved.company && conversation.state?.awaitingContextChoice) {
                const choice = this.readContextChoice(buffer.messages, resolved.company);
                if (!choice) {
                    await this.sendText(buffer, `Só preciso saber o contexto: atendimento pessoal ou para a empresa ${resolved.company.name}?`);
                    return;
                }
                conversation.contextMode = choice;
                conversation.state = { ...(conversation.state || {}), awaitingContextChoice: false };
            }
            else if (resolved.company && !conversation.activeFlow) {
                const explicitChoice = this.readContextChoice(buffer.messages, resolved.company);
                if (explicitChoice && explicitChoice !== conversation.contextMode) {
                    conversation.contextMode = explicitChoice;
                }
            }
            else if (conversation.contextMode === 'UNRESOLVED') {
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
                    displayName: resolved.user.displayName,
                    fullName: resolved.user.fullName,
                    socialName: resolved.user.socialName,
                    email: resolved.user.email,
                    phone: resolved.user.phone,
                    city: resolved.user.city,
                    state: resolved.user.state,
                    status: resolved.user.status,
                    isVerified: resolved.user.isVerified,
                    whatsappVerifiedAt: resolved.user.whatsappVerifiedAt,
                    company: resolved.company ? { id: resolved.company.id, name: resolved.company.name, slug: resolved.company.slug } : null,
                    whatsappInstance: {
                        id: buffer.instance.id,
                        name: buffer.instance.name,
                        purpose: buffer.instance.purpose,
                        phoneNumber: buffer.instance.phoneNumber,
                        status: buffer.instance.status,
                        isPrimarySupport: buffer.instance.isPrimarySupport,
                        conciergeEnabled: buffer.instance.conciergeEnabled,
                        lastConnectedAt: buffer.instance.lastConnectedAt,
                        lastSeenAt: buffer.instance.lastSeenAt,
                    },
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
            if (result?.handled)
                return;
            const reply = String(result?.reply || decision.reply || '').trim();
            if (reply) {
                const outgoing = conversation.contextMode === 'ADMIN' ? this.formatAdminReply(buffer, reply) : reply;
                await this.sendText(buffer, outgoing);
            }
        }
        catch (error) {
            if (this.isCompanyPlanRequired(error)) {
                const payload = this.companyPlanPayload(error);
                const requiredPlan = String(payload?.requiredPlan || 'Plus');
                const currentPlan = String(payload?.currentPlan || 'Free');
                await this.sendText(buffer, `Esse comando pelo WhatsApp faz parte do plano ${requiredPlan}. Sua empresa está no ${currentPlan}. Para liberar: https://piranegocios.com.br/company/planos`).catch(() => undefined);
                return;
            }
            if (this.isPaymentRequired(error)) {
                await this.sendText(buffer, 'A primeira organização do currículo por IA já foi utilizada nesta conta. Para usar a IA novamente, adquira um novo uso na área de currículo do PiraNegócios: https://piranegocios.com.br/dashboard/curriculo').catch(() => undefined);
                return;
            }
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
    async executeDecision(input) {
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
                return { reply: `${firstName}, a instância ${buffer.instance.name} está ${buffer.instance.status}. Última conexão: ${buffer.instance.lastConnectedAt || 'não registrada'}. Última atividade: ${buffer.instance.lastSeenAt || 'não registrada'}. O concierge está ${buffer.instance.conciergeEnabled ? 'ativado' : 'desativado'}.` };
            }
            return { reply: decision.reply || `${firstName}, identifiquei você como administrador. Posso usar o panorama operacional carregado nesta conversa para responder consultas administrativas de leitura.` };
        }
        if (conversation.contextMode === 'CANDIDATE') {
            if (intent === 'LIST_APPLICATIONS') {
                const rows = await this.applications.find({ where: { candidateId: user.id }, order: { createdAt: 'DESC' }, take: 12 });
                const result = rows.map((row) => ({ vaga: row.jobTitle, empresa: row.companyName, status: row.status, candidaturaEm: row.createdAt }));
                return { reply: await this.ai.composeReply({ firstName, request: requestText, result, contextMode: 'CANDIDATE' }) };
            }
            if (intent === 'JOB_MATCHES') {
                const matches = await this.jobMatch.getMatches(user.id);
                if (!matches.active) {
                    return { reply: `${firstName}, a busca automática por compatibilidade segue as mesmas regras do painel e não está ativa na sua conta agora. Você pode consultar/ativar esse recurso em https://piranegocios.com.br/dashboard/vagas` };
                }
                const top = (matches.matches || []).slice(0, 8);
                const ids = top.map((item) => item.jobId).filter(Boolean);
                const jobs = ids.length ? await this.jobs.findBy({ id: (0, typeorm_2.In)(ids) }) : [];
                const jobMap = new Map(jobs.map((job) => [job.id, job]));
                const result = top.map((item) => {
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
                    }
                    catch {
                    }
                }
                return { reply: `${firstName}, seu currículo está salvo no editor, mas esta versão ainda precisa ser renderizada em PDF pelo próprio editor para preservar exatamente o layout escolhido. Você pode abrir https://piranegocios.com.br/dashboard/curriculo e tocar em PDF. Estou mantendo esse caso separado para não te enviar um currículo com visual diferente do que você montou.` };
            }
            if (intent === 'SET_RESUME_PHOTO') {
                const media = [...buffer.messages].reverse().find((item) => item.isMedia && item.mimeType.startsWith('image/'));
                if (!media)
                    return { reply: 'Envie a foto que você quer usar e diga que deseja colocá-la no currículo.' };
                const url = await this.persistImageFromMessage(buffer.client, media.raw, media.mimeType, user.id);
                user.resumePhotoURL = url;
                await this.users.save(user);
                return { reply: `${firstName}, atualizei a foto do seu currículo. Ela já fica vinculada ao seu perfil no editor.` };
            }
            if (intent === 'IMPORT_RESUME') {
                const documents = await this.collectResumeDocuments(buffer);
                if (!documents.length)
                    return { reply: 'Pode me enviar o currículo, Carteira de Trabalho, certificados ou outros documentos em PDF ou imagem. Quando terminar, diga que posso organizar o currículo.' };
                const imported = await this.importResumeWithBilling(user, documents);
                this.applyImportedResume(user, imported);
                await this.users.save(user);
                return { reply: `${firstName}, organizei as informações dos documentos e salvei o rascunho do seu currículo. Revise no painel antes de publicar: https://piranegocios.com.br/dashboard/curriculo` };
            }
            if (intent === 'START_RESUME_CREATE' || intent === 'CONTINUE_RESUME_CREATE' || intent === 'CONFIRM_RESUME_CREATE' || conversation.activeFlow === 'RESUME_CREATE') {
                return this.resumeCreationFlow(conversation, user, decision, requestText);
            }
            return { reply: decision.reply || `${firstName}, como posso ajudar com suas vagas, candidaturas ou currículo?` };
        }
        if (conversation.contextMode === 'COMPANY') {
            if (!company)
                return { reply: 'Não consegui localizar a empresa vinculada a esta conta.' };
            const premiumResult = await this.handleCompanyPremiumDecision({
                buffer,
                conversation,
                user,
                company,
                decision,
                requestText,
            });
            if (premiumResult)
                return premiumResult;
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
                const counts = new Map(rows.map((row) => [String(row.jobId), Number(row.count || 0)]));
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
            if (intent === 'START_JOB_CREATE' || intent === 'CONTINUE_JOB_CREATE' || intent === 'CONFIRM_JOB_CREATE' || conversation.activeFlow === 'JOB_CREATE') {
                return this.jobCreationFlow(conversation, user, company, decision, requestText);
            }
            if (intent === 'START_JOB_EDIT' || intent === 'CONTINUE_JOB_EDIT' || intent === 'CONFIRM_JOB_EDIT' || conversation.activeFlow === 'JOB_EDIT') {
                return this.jobEditFlow(conversation, user, company, companyJobs, decision, requestText);
            }
            return { reply: decision.reply || `${firstName}, posso consultar vagas e candidatos ou iniciar a criação/edição de uma vaga da ${company.name}.` };
        }
        return { reply: decision.reply || 'Como posso ajudar?' };
    }
    async handleCompanyPremiumDecision(input) {
        const { buffer, conversation, user, company, decision, requestText } = input;
        const intent = String(decision.intent || '').toUpperCase();
        const args = decision.args && typeof decision.args === 'object' ? decision.args : {};
        const actor = {
            id: user.id,
            name: String(user.socialName || user.displayName || user.fullName || user.email || 'Empresa'),
        };
        if (conversation.activeFlow === 'COMPANY_ACTION_CONFIRM') {
            const pending = conversation.state?.pendingCompanyAction;
            const confirmed = intent === 'CONFIRM_COMPANY_ACTION' || /^\s*(CONFIRMO|PODE|PODE FAZER|SIM|CONFIRMAR)\s*[.!]?\s*$/i.test(requestText);
            if (!confirmed) {
                return { reply: 'A ação ainda não foi executada. Responda CONFIRMO para continuar ou CANCELAR para desistir.' };
            }
            if (!pending?.jobId || !['DEACTIVATE', 'CLOSE'].includes(String(pending.action))) {
                conversation.activeFlow = null;
                conversation.state = {};
                await this.conversations.save(conversation);
                return { reply: 'A confirmação anterior expirou. Faça o pedido novamente.' };
            }
            const result = await this.companyPremium.setJobState(company.id, String(pending.jobId), pending.action);
            conversation.activeFlow = null;
            conversation.state = {};
            await this.conversations.save(conversation);
            return { reply: pending.action === 'CLOSE' ? `Vaga encerrada: ${result.title}.` : `Vaga desativada: ${result.title}.` };
        }
        if (conversation.activeFlow === 'CANDIDATE_MESSAGE') {
            const pending = conversation.state?.pendingCandidateMessage;
            const confirmed = intent === 'CONFIRM_CANDIDATE_MESSAGE' || /^\s*(ENVIAR|CONFIRMO|PODE ENVIAR|SIM,? ENVIAR)\s*[.!]?\s*$/i.test(requestText);
            if (!confirmed) {
                return { reply: 'A mensagem ainda não foi enviada. Responda ENVIAR para confirmar ou CANCELAR para desistir.' };
            }
            if (!pending?.chatId || !pending?.message) {
                conversation.activeFlow = null;
                conversation.state = {};
                await this.conversations.save(conversation);
                return { reply: 'A prévia da mensagem expirou. Faça o pedido novamente.' };
            }
            await this.companyPlans.assertWhatsAppFeature(company.id, 'CANDIDATE_WHATSAPP');
            await buffer.client.sendText(String(pending.chatId), String(pending.message));
            conversation.activeFlow = null;
            conversation.state = {};
            await this.conversations.save(conversation);
            return { reply: `Mensagem enviada para ${String(pending.candidateName || 'o candidato')}.` };
        }
        if (intent === 'COMPANY_PLAN_STATUS') {
            const current = await this.companyPlans.getCompanyPlan(company.id);
            const label = current.plan === 'FREE' ? 'Free' : current.plan === 'PLUS' ? 'Plus' : 'Elite';
            return { reply: `A ${company.name} está no plano ${label}.${current.currentPeriodEnd ? ` Vigente até ${new Date(current.currentPeriodEnd).toLocaleDateString('pt-BR')}.` : ''} Você pode comparar os planos em https://piranegocios.com.br/company/planos` };
        }
        if (intent === 'JOB_ACTIVATE') {
            const jobId = await this.resolveCompanyJobId(company.id, args, requestText);
            if (!jobId)
                return { reply: await this.companyJobChoiceReply(company.id, 'ativar') };
            const result = await this.companyPremium.setJobState(company.id, jobId, 'ACTIVATE');
            return { reply: `Vaga ativada: ${result.title}.` };
        }
        if (intent === 'JOB_DEACTIVATE' || intent === 'JOB_CLOSE') {
            const jobId = await this.resolveCompanyJobId(company.id, args, requestText);
            if (!jobId)
                return { reply: await this.companyJobChoiceReply(company.id, intent === 'JOB_CLOSE' ? 'encerrar' : 'desativar') };
            await this.companyPlans.assertWhatsAppFeature(company.id, intent === 'JOB_CLOSE' ? 'JOB_CLOSE' : 'JOB_DEACTIVATE');
            const job = await this.jobs.findOne({ where: { id: jobId, companyId: company.id } });
            if (!job)
                return { reply: 'Não encontrei essa vaga na empresa.' };
            conversation.activeFlow = 'COMPANY_ACTION_CONFIRM';
            conversation.state = { ...(conversation.state || {}), pendingCompanyAction: { jobId, action: intent === 'JOB_CLOSE' ? 'CLOSE' : 'DEACTIVATE' } };
            await this.conversations.save(conversation);
            return { reply: intent === 'JOB_CLOSE'
                    ? `Você quer ENCERRAR a vaga "${job.title}"? Isso desativa a vaga e encerra o prazo. Responda CONFIRMO ou CANCELAR.`
                    : `Você quer DESATIVAR a vaga "${job.title}"? Responda CONFIRMO ou CANCELAR.` };
        }
        if (intent === 'LIST_JOB_CANDIDATES') {
            const jobId = await this.resolveCompanyJobId(company.id, args, requestText);
            if (!jobId)
                return { reply: await this.companyJobChoiceReply(company.id, 'listar os candidatos de') };
            const result = await this.companyPremium.listCandidates(company.id, jobId);
            if (!result.count)
                return { reply: `A vaga "${result.job.title}" ainda não possui candidaturas.` };
            const lines = result.candidates.map((item, index) => `${index + 1}. ${item.name || 'Candidato'} · ${item.status} · ${[item.city, item.state].filter(Boolean).join('/') || 'local não informado'} · candidato ${item.candidateId} · candidatura ${item.applicationId}`);
            return { reply: `${result.count} candidatura(s) em "${result.job.title}":\n${lines.join('\n')}` };
        }
        if (intent === 'GET_CANDIDATE_PROFILE') {
            const candidateId = String(args.candidateId || '').trim();
            if (!candidateId)
                return { reply: 'Qual candidato você quer abrir? Peça a lista de candidatos da vaga para eu mostrar os IDs disponíveis.' };
            const result = await this.companyPremium.candidateProfile(company.id, candidateId);
            const c = result.candidate;
            const summary = [
                c.name,
                [c.city, c.state].filter(Boolean).join('/'),
                c.phone,
                c.email,
                Array.isArray(c.skills) && c.skills.length ? `Habilidades: ${c.skills.slice(0, 12).join(', ')}` : '',
                c.bio ? `Resumo: ${String(c.bio).slice(0, 900)}` : '',
                Array.isArray(c.experiences) && c.experiences.length ? `Experiências: ${c.experiences.slice(0, 6).map((e) => [e.role, e.company].filter(Boolean).join(' @ ')).join('; ')}` : '',
                c.linkedinURL ? `LinkedIn: ${c.linkedinURL}` : '',
            ].filter(Boolean);
            if (c.resumeURL && /^https?:\/\//i.test(String(c.resumeURL))) {
                summary.push(`Currículo: ${c.resumeURL}`);
            }
            return { reply: summary.join('\n') };
        }
        if (intent === 'UPDATE_APPLICATION_STATUS') {
            const applicationId = String(args.applicationId || '').trim();
            const status = String(args.status || '').trim();
            if (!applicationId || !status)
                return { reply: 'Informe qual candidatura e o novo status. Você pode pedir a lista de candidatos da vaga para ver os IDs.' };
            const result = await this.companyPremium.updateApplicationStatus(company.id, applicationId, status, actor);
            return { reply: `Status atualizado para ${result.status} na candidatura ${result.id}.` };
        }
        if (intent === 'ADD_APPLICATION_NOTE') {
            const applicationId = String(args.applicationId || '').trim();
            const note = String(args.note || '').trim();
            if (!applicationId || !note)
                return { reply: 'Diga em qual candidatura deseja registrar a observação e qual é o texto.' };
            await this.companyPremium.addApplicationNote(company.id, applicationId, note, actor);
            return { reply: 'Observação interna registrada com seu nome e horário.' };
        }
        if (intent === 'INVITE_CANDIDATE') {
            const candidateId = String(args.candidateId || '').trim();
            const jobId = await this.resolveCompanyJobId(company.id, args, requestText);
            if (!candidateId || !jobId)
                return { reply: 'Para enviar o convite, preciso identificar o candidato e a vaga. Peça a lista de candidatos/vagas se precisar dos IDs.' };
            const result = await this.companyPremium.inviteCandidate(company, jobId, candidateId, user.id);
            return { reply: `Convite criado para ${result.candidateName} na vaga "${result.jobTitle}". Status: ${result.status}.` };
        }
        if (intent === 'LIST_CANDIDATE_INVITES') {
            const invites = await this.companyPremium.listInvites(company.id);
            if (!invites.length)
                return { reply: 'A empresa ainda não possui convites de vagas.' };
            return { reply: invites.slice(0, 20).map((invite, index) => `${index + 1}. ${invite.candidateName || invite.candidateEmail || 'Candidato'} · ${invite.jobTitle} · ${invite.status} · convite ${invite.id}`).join('\n') };
        }
        if (intent === 'CANCEL_CANDIDATE_INVITE') {
            const inviteId = String(args.inviteId || '').trim();
            if (!inviteId)
                return { reply: 'Qual convite deseja remover? Peça a lista de convites para eu mostrar os IDs.' };
            await this.companyPremium.cancelInvite(company.id, inviteId);
            return { reply: 'Convite pendente removido.' };
        }
        if (intent === 'LIST_TALENT_FOLDERS') {
            const folders = await this.companyPremium.listTalentFolders(company.id);
            return { reply: folders.length
                    ? `Pastas do Banco de Talentos:\n${folders.map((folder, index) => `${index + 1}. ${folder.name} · ${folder.id}`).join('\n')}`
                    : 'A empresa ainda não possui pastas no Banco de Talentos.' };
        }
        if (intent === 'ADD_TALENT') {
            const candidateId = String(args.candidateId || '').trim();
            if (!candidateId)
                return { reply: 'Qual candidato deseja salvar no Banco de Talentos?' };
            await this.companyPremium.saveTalent(company.id, candidateId, Array.isArray(args.folderIds) ? args.folderIds.map(String) : undefined, Array.isArray(args.jobIds) ? args.jobIds.map(String) : undefined);
            return { reply: 'Candidato salvo/atualizado no Banco de Talentos.' };
        }
        if (intent === 'REMOVE_TALENT') {
            const candidateId = String(args.candidateId || '').trim();
            const folderId = String(args.folderId || '').trim() || undefined;
            if (!candidateId)
                return { reply: 'Qual candidato deseja remover do Banco de Talentos?' };
            await this.companyPremium.removeTalent(company.id, candidateId, folderId);
            return { reply: folderId ? 'Candidato removido dessa pasta.' : 'Candidato removido do Banco de Talentos da empresa.' };
        }
        if (intent === 'ADD_TALENT_NOTE') {
            const candidateId = String(args.candidateId || '').trim();
            const note = String(args.note || '').trim();
            if (!candidateId || !note)
                return { reply: 'Informe o candidato e a observação que deseja registrar no histórico do Banco de Talentos.' };
            await this.companyPremium.addTalentNote(company.id, candidateId, user.id, note);
            return { reply: 'Observação registrada no histórico do candidato.' };
        }
        if (intent === 'RECENT_APPLICATIONS') {
            const window = String(args.window || requestText || '24h');
            const result = await this.companyPremium.recentApplications(company.id, window);
            if (!result.count)
                return { reply: 'Não houve novas candidaturas nesse período.' };
            const lines = result.applications.slice(0, 30).map((item, index) => `${index + 1}. ${item.candidateName} · ${item.jobTitle} · ${item.status} · candidatura ${item.applicationId}`);
            return { reply: `Foram ${result.count} nova(s) candidatura(s) no período:\n${lines.join('\n')}` };
        }
        if (intent === 'JOB_STATS') {
            const jobId = String(args.jobId || '').trim() || undefined;
            const stats = await this.companyPremium.jobStats(company.id, jobId);
            if (!stats.length)
                return { reply: 'Não encontrei vagas para calcular as estatísticas.' };
            return { reply: stats.slice(0, 20).map((item) => `${item.title}: ${item.views} visualizações · ${item.applications} candidaturas · ${item.newApplications24h} nas últimas 24h · conversão ${item.conversionPercent}% · ${item.active ? 'ativa' : 'inativa'}`).join('\n') };
        }
        if (intent === 'MESSAGE_CANDIDATE') {
            const candidateId = String(args.candidateId || '').trim();
            const message = String(args.message || '').trim().slice(0, 4000);
            if (!candidateId || !message)
                return { reply: 'Informe qual candidato e a mensagem que deseja enviar.' };
            const target = await this.companyPremium.candidateWhatsAppTarget(company.id, candidateId);
            conversation.activeFlow = 'CANDIDATE_MESSAGE';
            conversation.state = {
                ...(conversation.state || {}),
                pendingCandidateMessage: {
                    candidateId,
                    candidateName: target.candidateName,
                    chatId: target.chatId,
                    message,
                },
            };
            await this.conversations.save(conversation);
            return { reply: `Prévia para ${target.candidateName}:\n"${message}"\n\nResponda ENVIAR para confirmar ou CANCELAR para desistir.` };
        }
        return null;
    }
    async resolveCompanyJobId(companyId, args, requestText) {
        const explicit = String(args.jobId || '').trim();
        if (explicit) {
            const exists = await this.jobs.findOne({ where: { id: explicit, companyId } });
            return exists?.id || null;
        }
        const jobs = await this.jobs.find({ where: { companyId }, order: { updatedAt: 'DESC' } });
        if (jobs.length === 1)
            return jobs[0].id;
        const hint = String(args.jobTitle || requestText || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const matches = jobs.filter((job) => {
            const title = String(job.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            return title && hint.includes(title);
        });
        return matches.length === 1 ? matches[0].id : null;
    }
    async companyJobChoiceReply(companyId, action) {
        const jobs = await this.jobs.find({ where: { companyId }, order: { updatedAt: 'DESC' }, take: 12 });
        if (!jobs.length)
            return 'A empresa não possui vagas para essa ação.';
        return `Qual vaga deseja ${action}?\n${jobs.map((job, index) => `${index + 1}. ${job.title} · ${job.active ? 'ativa' : 'inativa'} · ${job.id}`).join('\n')}`;
    }
    async resumeCreationFlow(conversation, user, decision, requestText) {
        const state = { ...(conversation.state || {}) };
        const seed = {
            fullName: user.fullName || user.displayName || undefined,
            city: user.city || undefined,
            state: user.state || undefined,
            bio: user.bio || undefined,
            experiences: Array.isArray(user.experiences) ? user.experiences : undefined,
            education: Array.isArray(user.education) ? user.education : undefined,
            skills: Array.isArray(user.skills) ? user.skills : undefined,
            courses: Array.isArray(user.courses) ? user.courses : undefined,
            languages: Array.isArray(user.languages) ? user.languages : undefined,
        };
        const draft = {
            ...seed,
            ...(state.resumeDraft || {}),
            ...(decision.args?.patch && typeof decision.args.patch === 'object' ? decision.args.patch : {}),
            ...(decision.statePatch?.resumeDraft || {}),
        };
        conversation.activeFlow = 'RESUME_CREATE';
        state.resumeDraft = draft;
        conversation.state = state;
        const fields = [
            ['fullName', 'seu nome completo'],
            ['city', 'sua cidade'],
            ['state', 'seu estado/UF'],
            ['experiences', 'suas experiências profissionais, com empresa, cargo e período'],
            ['education', 'sua formação/escolaridade'],
            ['skills', 'suas principais habilidades'],
        ];
        const missing = fields.find(([field]) => !draft[field] || (Array.isArray(draft[field]) && !draft[field].length));
        const confirmed = String(decision.intent || '').toUpperCase() === 'CONFIRM_RESUME_CREATE' || /^\s*(SALVAR CURR[IÍ]CULO|FINALIZAR CURR[IÍ]CULO|PODE SALVAR|CONFIRMO)\s*[.!]?\s*$/i.test(requestText);
        if (confirmed && !missing) {
            this.applyImportedResume(user, draft);
            await this.users.save(user);
            conversation.activeFlow = null;
            conversation.state = {};
            await this.conversations.save(conversation);
            return { reply: 'Salvei o rascunho do currículo. Revise os dados e escolha o modelo visual no painel antes de publicar: https://piranegocios.com.br/dashboard/curriculo' };
        }
        await this.conversations.save(conversation);
        if (confirmed && missing)
            return { reply: `Ainda falta uma informação para eu fechar o rascunho: conte ${missing[1]}.` };
        if (missing)
            return { reply: `Vamos montar seu currículo. Me conte ${missing[1]}. Você também pode enviar currículo, Carteira de Trabalho ou certificados em PDF/foto a qualquer momento.` };
        return { reply: 'Já tenho os dados essenciais do rascunho. Se estiver tudo certo, responda SALVAR CURRÍCULO. Se quiser corrigir algo, me diga a correção antes.' };
    }
    async jobCreationFlow(conversation, user, company, decision, requestText) {
        const state = { ...(conversation.state || {}) };
        const current = { ...(state.jobDraft || {}) };
        const patch = decision.args?.patch && typeof decision.args.patch === 'object' ? decision.args.patch : {};
        const jobDraft = { ...current, ...patch };
        conversation.activeFlow = 'JOB_CREATE';
        state.jobDraft = jobDraft;
        conversation.state = state;
        const missing = [
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
            const created = await this.jobsService.create(user.id, company, jobDraft);
            conversation.activeFlow = null;
            conversation.state = {};
            await this.conversations.save(conversation);
            return { reply: `Vaga publicada: ${created.title}. ${created.slug ? `https://piranegocios.com.br/vagas/${created.slug}` : ''}`.trim() };
        }
        await this.conversations.save(conversation);
        if (next)
            return { reply: next[1] };
        const skills = Array.isArray(jobDraft.skills) && jobDraft.skills.length ? `\nHabilidades: ${jobDraft.skills.join(', ')}` : '';
        return { reply: `Rascunho pronto para ${company.name}: ${jobDraft.title}.\nLocal: ${jobDraft.city}/${jobDraft.state} · ${jobDraft.type} · ${jobDraft.workModel}.${skills}\nSe estiver certo, responda PUBLICAR. Para interromper, diga CANCELAR.` };
    }
    async jobEditFlow(conversation, user, company, companyJobs, decision, requestText) {
        const state = { ...(conversation.state || {}) };
        let jobId = String(decision.args?.jobId || state.jobEditId || '').trim();
        if (!jobId && companyJobs.length === 1)
            jobId = companyJobs[0].id;
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
            if (!Object.keys(patch).length)
                return { reply: 'Ainda não há nenhuma alteração no rascunho. Diga o que deseja mudar na vaga.' };
            await this.jobsService.update(user.id, job.id, patch, true);
            conversation.activeFlow = null;
            conversation.state = {};
            await this.conversations.save(conversation);
            return { reply: `Alterações salvas na vaga ${job.title}.` };
        }
        await this.conversations.save(conversation);
        if (!Object.keys(patch).length)
            return { reply: `Certo. O que você quer alterar na vaga ${job.title}?` };
        return { reply: `Preparei estas alterações para ${job.title}: ${JSON.stringify(patch)}. Se estiver correto, responda CONFIRMO. Se quiser mudar algo, me diga antes.` };
    }
    async contextSnapshot(user, company, mode) {
        const userProfile = {
            id: user.id,
            type: user.type,
            email: user.email,
            displayName: user.displayName,
            fullName: user.fullName,
            socialName: user.socialName,
            treatment: user.treatment,
            phone: user.phone,
            additionalPhones: user.additionalPhones,
            whatsappPhoneE164: user.whatsappPhoneE164,
            whatsappVerifiedAt: user.whatsappVerifiedAt,
            status: user.status,
            isVerified: user.isVerified,
            isCompanyAdmin: user.isCompanyAdmin,
            companyId: user.companyId,
            isOpenToWork: user.isOpenToWork,
            bio: user.bio,
            linkedinURL: user.linkedinURL,
            city: user.city,
            state: user.state,
            address: user.address,
            salaryExpectation: user.salaryExpectation,
            jobPreferences: user.jobPreferences,
            experiences: user.experiences,
            education: user.education,
            skills: user.skills,
            courses: user.courses,
            languages: user.languages,
            resumeStatus: user.resumeStatus,
            resumePublishedAt: user.resumePublishedAt,
            hasResumeFile: Boolean(user.resumeURL),
            hasResumePhoto: Boolean(user.resumePhotoURL),
            publishedResumeSnapshot: user.publishedResumeSnapshot,
            resumePreferences: user.resumePreferences,
            aiAnalysis: user.aiAnalysis,
            hasAiAnalyzed: user.hasAiAnalyzed,
            resumeScoreUnlocked: user.resumeScoreUnlocked,
            aiAnalysisCount: user.aiAnalysisCount,
            aiAnalysisLimit: user.aiAnalysisLimit,
            aiImportCount: user.aiImportCount,
            aiImportLimit: user.aiImportLimit,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
        if (mode === 'CANDIDATE') {
            const applications = await this.applications.find({ where: { candidateId: user.id }, order: { createdAt: 'DESC' }, take: 20 });
            return {
                profile: userProfile,
                applications: applications.map((item) => ({
                    id: item.id,
                    jobId: item.jobId,
                    title: item.jobTitle,
                    companyId: item.companyId,
                    company: item.companyName,
                    status: item.status,
                    priority: item.priority,
                    documentsRequested: item.documentsRequested,
                    submittedForReview: item.submittedForReview,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                })),
            };
        }
        if (mode === 'COMPANY' && company) {
            const jobs = await this.jobs.find({ where: { companyId: company.id }, order: { createdAt: 'DESC' }, take: 30 });
            const ids = jobs.map((job) => job.id);
            const applications = ids.length
                ? await this.applications.find({ where: { jobId: (0, typeorm_2.In)(ids) }, order: { createdAt: 'DESC' }, take: 30 })
                : [];
            return {
                user: userProfile,
                companyPlan: await this.companyPlans.getCompanyPlan(company.id),
                company: {
                    id: company.id,
                    name: company.name,
                    slug: company.slug,
                    category: company.category,
                    description: company.description,
                    website: company.website,
                    address: company.address,
                    cityState: company.cityState,
                    city: company.city,
                    state: company.state,
                    phone: company.phone,
                    verificationStatus: company.verificationStatus,
                    isVerified: company.isVerified,
                    socialInstagram: company.socialInstagram,
                    socialLinkedin: company.socialLinkedin,
                    socialFacebook: company.socialFacebook,
                    logoURL: company.logoURL,
                    hiringConfig: company.hiringConfig,
                    createdAt: company.createdAt,
                    updatedAt: company.updatedAt,
                },
                jobs: jobs.map((job) => ({
                    id: job.id,
                    title: job.title,
                    slug: job.slug,
                    description: job.description,
                    requirements: job.requirements,
                    skills: job.skills,
                    location: job.location,
                    city: job.city,
                    state: job.state,
                    type: job.type,
                    workModel: job.workModel,
                    salary: job.salary,
                    estimatedSalary: job.estimatedSalary,
                    pcdMode: job.pcdMode,
                    active: job.active,
                    views: job.views,
                    acceptsPlatformApplications: job.acceptsPlatformApplications,
                    deadlineDate: job.deadlineDate,
                    isSponsored: job.isSponsored,
                    createdAt: job.createdAt,
                    updatedAt: job.updatedAt,
                })),
                recentApplications: applications.map((item) => ({
                    id: item.id,
                    candidateId: item.candidateId,
                    jobId: item.jobId,
                    jobTitle: item.jobTitle,
                    status: item.status,
                    priority: item.priority,
                    documentsRequested: item.documentsRequested,
                    submittedForReview: item.submittedForReview,
                    createdAt: item.createdAt,
                })),
            };
        }
        if (mode === 'ADMIN') {
            const [totalUsers, totalCompanies, totalJobs, activeJobs, totalApplications, recentUsers, recentCompanies, recentJobs, recentApplications,] = await Promise.all([
                this.users.count(),
                this.companies.count(),
                this.jobs.count(),
                this.jobs.count({ where: { active: true } }),
                this.applications.count(),
                this.users.find({ order: { updatedAt: 'DESC' }, take: 25 }),
                this.companies.find({ order: { updatedAt: 'DESC' }, take: 25 }),
                this.jobs.find({ order: { updatedAt: 'DESC' }, take: 30 }),
                this.applications.find({ order: { updatedAt: 'DESC' }, take: 30 }),
            ]);
            return {
                admin: userProfile,
                platformTotals: {
                    users: totalUsers,
                    companies: totalCompanies,
                    jobs: totalJobs,
                    activeJobs,
                    inactiveJobs: Math.max(0, totalJobs - activeJobs),
                    applications: totalApplications,
                },
                recentUsers: recentUsers.map((item) => ({
                    id: item.id,
                    type: item.type,
                    displayName: item.displayName,
                    fullName: item.fullName,
                    socialName: item.socialName,
                    email: item.email,
                    phone: item.phone,
                    city: item.city,
                    state: item.state,
                    status: item.status,
                    companyId: item.companyId,
                    isVerified: item.isVerified,
                    isOpenToWork: item.isOpenToWork,
                    resumeStatus: item.resumeStatus,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                })),
                recentCompanies: recentCompanies.map((item) => ({
                    id: item.id,
                    name: item.name,
                    slug: item.slug,
                    category: item.category,
                    city: item.city,
                    state: item.state,
                    verificationStatus: item.verificationStatus,
                    isVerified: item.isVerified,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                })),
                recentJobs: recentJobs.map((job) => ({
                    id: job.id,
                    companyId: job.companyId,
                    companyName: job.companyName,
                    title: job.title,
                    slug: job.slug,
                    city: job.city,
                    state: job.state,
                    type: job.type,
                    workModel: job.workModel,
                    salary: job.salary,
                    estimatedSalary: job.estimatedSalary,
                    pcdMode: job.pcdMode,
                    active: job.active,
                    moderationStatus: job.moderationStatus,
                    isExternalListing: job.isExternalListing,
                    sourceName: job.sourceName,
                    views: job.views,
                    deadlineDate: job.deadlineDate,
                    createdAt: job.createdAt,
                    updatedAt: job.updatedAt,
                })),
                recentApplications: recentApplications.map((item) => ({
                    id: item.id,
                    candidateId: item.candidateId,
                    jobId: item.jobId,
                    jobTitle: item.jobTitle,
                    companyId: item.companyId,
                    companyName: item.companyName,
                    status: item.status,
                    priority: item.priority,
                    documentsRequested: item.documentsRequested,
                    submittedForReview: item.submittedForReview,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                })),
            };
        }
        return { user: userProfile };
    }
    async collectResumeDocuments(buffer) {
        const supported = buffer.messages.filter((item) => item.isMedia && /^(application\/pdf|image\/(png|jpeg|jpg|webp))$/i.test(item.mimeType));
        const documents = [];
        for (const [index, item] of supported.slice(0, 8).entries()) {
            const raw = await buffer.client.downloadMedia(item.raw);
            if (typeof raw !== 'string')
                continue;
            const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
            const mimeType = match?.[1] || item.mimeType;
            const base64File = match?.[2] || raw;
            documents.push({ base64File, mimeType, fileName: `whatsapp-documento-${index + 1}.${this.extensionForMime(mimeType)}` });
        }
        return documents;
    }
    async importResumeWithBilling(user, documents) {
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
            throw new common_1.ForbiddenException({ code: 'PAYMENT_REQUIRED', productCode: product.code, message: 'Sua primeira organização por IA já foi utilizada. Uma nova importação requer um crédito.' });
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
        }
        catch (error) {
            if (consumed)
                await this.payments.grantCredit(user.id, 'RESUME_AI_IMPORT', 1).catch(() => undefined);
            throw error;
        }
    }
    applyImportedResume(user, imported) {
        if (imported?.name && !user.fullName)
            user.fullName = String(imported.name);
        if (imported?.fullName && !user.fullName)
            user.fullName = String(imported.fullName);
        if (imported?.treatment && !user.treatment)
            user.treatment = String(imported.treatment);
        if (imported?.phone && !user.phone)
            user.phone = String(imported.phone);
        if (imported?.city)
            user.city = String(imported.city);
        if (imported?.state)
            user.state = String(imported.state).trim().slice(0, 2).toUpperCase();
        if (imported?.bio !== undefined)
            user.bio = imported.bio ? String(imported.bio) : user.bio;
        if (Array.isArray(imported?.experiences))
            user.experiences = imported.experiences;
        if (Array.isArray(imported?.education))
            user.education = imported.education;
        if (Array.isArray(imported?.skills))
            user.skills = imported.skills.map(String).slice(0, 20);
        if (Array.isArray(imported?.courses))
            user.courses = imported.courses;
        if (Array.isArray(imported?.languages))
            user.languages = imported.languages;
        if (Array.isArray(imported?.additionalPhones))
            user.additionalPhones = imported.additionalPhones.map(String);
        user.resumeStatus = 'DRAFT';
    }
    async persistImageFromMessage(client, message, mimeType, userId) {
        const raw = await client.downloadMedia(message);
        if (typeof raw !== 'string')
            throw new common_1.BadRequestException('Não foi possível baixar a imagem enviada.');
        const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
        const base64 = match?.[2] || raw;
        const mime = match?.[1] || mimeType || 'image/jpeg';
        if (!mime.startsWith('image/'))
            throw new common_1.BadRequestException('O arquivo enviado não é uma imagem.');
        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length > 10 * 1024 * 1024)
            throw new common_1.BadRequestException('A imagem excede 10 MB.');
        const dir = (0, path_1.join)(process.cwd(), 'uploads');
        await (0, promises_1.mkdir)(dir, { recursive: true });
        const ext = this.extensionForMime(mime);
        const fileName = `whatsapp-resume-photo-${this.safeId(userId)}-${Date.now()}.${ext}`;
        await (0, promises_1.writeFile)((0, path_1.join)(dir, fileName), buffer);
        return `${String(process.env.PUBLIC_BASE_URL || 'https://piranegocios.com.br').replace(/\/+$/, '')}/api/uploads/${fileName}`;
    }
    async resolvePlatformActor(whatsappId, phoneE164) {
        const variants = this.phoneVariants(phoneE164);
        const rows = await this.users.query(`SELECT u.* FROM users u
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
       LIMIT 4`, [whatsappId || '', phoneE164 || '', variants.length ? variants : ['__none__']]);
        const user = rows[0] || null;
        if (!user)
            return { user: null, company: null };
        let company = null;
        if (user.companyId)
            company = await this.companies.findOne({ where: { id: user.companyId } });
        if (!company)
            company = await this.companies.findOne({ where: { ownerId: user.id } });
        return { user, company };
    }
    async resolveWhatsAppIdentity(message, client) {
        const chatId = this.serializeWid(message?.chatId || message?.from);
        const senderId = this.serializeWid(message?.sender?.id || message?.from || message?.chatId);
        let whatsappId = senderId || chatId;
        let phoneE164 = null;
        try {
            const mapping = await client.getPnLidEntry(whatsappId);
            const phoneWid = this.serializeWid(mapping?.phoneNumber);
            const lidWid = this.serializeWid(mapping?.lid);
            if (lidWid && whatsappId.endsWith('@lid'))
                whatsappId = lidWid;
            phoneE164 = this.canonicalBrazilPhone(phoneWid || whatsappId);
        }
        catch {
            phoneE164 = this.canonicalBrazilPhone(whatsappId);
        }
        return { chatId: chatId || whatsappId, whatsappId, phoneE164 };
    }
    isDirectHumanInbound(message) {
        if (!message || message.fromMe)
            return false;
        if (message.broadcast || message.isNotification || message.isPSA)
            return false;
        if (message.isGroupMsg)
            return false;
        if (message.isNewMsg === false)
            return false;
        const chatId = this.serializeWid(message.chatId || message.from);
        if (!chatId)
            return false;
        if (/@g\.us$|@newsletter$|@broadcast$/.test(chatId) || chatId === 'status@broadcast')
            return false;
        if (!/@(?:c\.us|lid|s\.whatsapp\.net)$/.test(chatId))
            return false;
        const type = String(message.type || '').toLowerCase();
        const ignoredTypes = new Set(['e2e_notification', 'notification', 'gp2', 'protocol', 'revoked', 'ciphertext', 'unknown']);
        if (ignoredTypes.has(type))
            return false;
        return Boolean(String(message.body || message.caption || '').trim() || message.isMedia);
    }
    toBufferedInbound(message) {
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
    async touchConversation(buffer) {
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
        }
        else {
            row.lastInboundAt = new Date();
            row.whatsappId = buffer.senderWhatsAppId;
            if (buffer.phoneE164)
                row.phoneE164 = buffer.phoneE164;
        }
        return this.conversations.save(row);
    }
    async recentHistory(instanceId, chatId) {
        const rows = await this.whatsappMessages.find({ where: { instanceId, chatId }, order: { createdAt: 'DESC' }, take: 24 });
        return rows.reverse().map((row) => ({ direction: row.direction, body: row.body, createdAt: row.createdAt }));
    }
    async sendText(buffer, text) {
        const clean = String(text || '').trim();
        if (!clean)
            return;
        const result = await buffer.client.sendText(buffer.chatId, clean);
        await this.whatsappMessages.save(this.whatsappMessages.create({
            instanceId: buffer.instance.id,
            providerMessageId: this.serializeWid(result?.id?._serialized || result?.id).slice(0, 100) || null,
            chatId: buffer.chatId.slice(0, 120),
            senderId: null,
            direction: whatsapp_message_entity_1.WhatsAppMessageDirection.OUTBOUND,
            type: 'text',
            body: clean,
            metadata: { source: 'whatsapp_concierge' },
            providerTimestamp: new Date(),
        }));
    }
    formatAdminReply(buffer, text) {
        const clean = String(text || '').trim();
        if (!clean || clean.startsWith('🤖 *'))
            return clean;
        const name = String(buffer.instance.name || 'PiraNegócios').trim() || 'PiraNegócios';
        return `🤖 *${name}*:\n${clean}`;
    }
    readContextChoice(messages, company) {
        const text = messages.map((item) => item.text).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const companyName = String(company.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (/\b(empresa|recrutamento|rh|vaga da empresa|candidatos)\b/.test(text) || (companyName && text.includes(companyName)))
            return 'COMPANY';
        if (/\b(pessoal|pra mim|para mim|meu curriculo|meu currículo|minhas vagas|minha candidatura|candidato)\b/.test(text))
            return 'CANDIDATE';
        return null;
    }
    firstName(user) {
        return String(user.socialName || user.fullName || user.displayName || 'Olá').trim().split(/\s+/)[0] || 'Olá';
    }
    serializeWid(value) {
        if (!value)
            return '';
        if (typeof value === 'string')
            return value;
        if (typeof value?._serialized === 'string')
            return value._serialized;
        if (value?.user && value?.server)
            return `${value.user}@${value.server}`;
        const text = String(value);
        return text === '[object Object]' ? '' : text;
    }
    canonicalBrazilPhone(value) {
        let digits = String(value || '').split('@')[0].replace(/\D+/g, '');
        if (!digits)
            return null;
        if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55'))
            digits = `55${digits}`;
        if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'))
            return digits;
        return digits.length >= 10 && digits.length <= 15 ? digits : null;
    }
    phoneVariants(phoneE164) {
        if (!phoneE164)
            return [];
        const digits = phoneE164.replace(/\D/g, '');
        return Array.from(new Set([digits, digits.startsWith('55') ? digits.slice(2) : `55${digits}`].filter((value) => value.length >= 10)));
    }
    extensionForMime(mime) {
        const normalized = String(mime || '').toLowerCase();
        if (normalized.includes('png'))
            return 'png';
        if (normalized.includes('webp'))
            return 'webp';
        if (normalized.includes('pdf'))
            return 'pdf';
        return 'jpg';
    }
    safeId(value) {
        return (0, crypto_1.createHash)('sha256').update(value).digest('hex').slice(0, 16);
    }
    isCompanyPlanRequired(error) {
        if (!(error instanceof common_1.ForbiddenException))
            return false;
        const payload = error.getResponse();
        return Boolean(payload && typeof payload === 'object' && payload.code === 'COMPANY_WHATSAPP_PLAN_REQUIRED');
    }
    companyPlanPayload(error) {
        if (!(error instanceof common_1.ForbiddenException))
            return null;
        const payload = error.getResponse();
        return payload && typeof payload === 'object' ? payload : null;
    }
    isPaymentRequired(error) {
        if (!(error instanceof common_1.ForbiddenException))
            return false;
        const response = error.getResponse();
        return Boolean(response && typeof response === 'object' && response.code === 'PAYMENT_REQUIRED');
    }
    errorText(error) {
        if (error instanceof Error)
            return `${error.name}: ${error.message}`.slice(0, 2000);
        return String(error).slice(0, 2000);
    }
};
exports.WhatsAppConciergeService = WhatsAppConciergeService;
exports.WhatsAppConciergeService = WhatsAppConciergeService = WhatsAppConciergeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __param(2, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __param(3, (0, typeorm_1.InjectRepository)(application_entity_1.Application)),
    __param(4, (0, typeorm_1.InjectRepository)(whatsapp_concierge_entity_1.WhatsAppConversation)),
    __param(5, (0, typeorm_1.InjectRepository)(whatsapp_message_entity_1.WhatsAppMessage)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        jobs_service_1.JobsService,
        job_match_service_1.JobMatchService,
        resume_import_service_1.ResumeImportService,
        payments_service_1.PaymentsService,
        billing_support_service_1.BillingSupportService,
        whatsapp_ai_service_1.WhatsAppAiService,
        whatsapp_alert_service_1.WhatsAppAlertService,
        company_plans_service_1.CompanyPlansService,
        company_whatsapp_premium_service_1.CompanyWhatsAppPremiumService])
], WhatsAppConciergeService);
//# sourceMappingURL=whatsapp-concierge.service.js.map