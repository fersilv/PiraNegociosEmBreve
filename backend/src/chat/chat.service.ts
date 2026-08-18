import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from '../applications/entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { User, UserType } from '../users/entities/user.entity';
import { ChatMessage, ChatMessageType } from './entities/chat-message.entity';

type AttachmentInput = { name?: unknown; data?: unknown; mimeType?: unknown; size?: unknown };

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(applicationId: string, uid: string) {
    await this.assertParticipant(applicationId, uid);
    return this.messages.find({ where: { applicationId }, order: { createdAt: 'ASC' } });
  }

  async send(applicationId: string, uid: string, body: unknown, attachment?: AttachmentInput, documentId?: unknown) {
    const { application, user, isCandidate } = await this.assertParticipant(applicationId, uid);
    const cleanBody = typeof body === 'string' ? body.trim() : '';
    const cleanAttachment = this.validateAttachment(attachment);
    if (!cleanBody && !cleanAttachment) throw new BadRequestException('Escreva uma mensagem ou anexe um arquivo.');
    if (cleanBody.length > 4000) throw new BadRequestException('A mensagem excede o limite de 4.000 caracteres.');

    let cleanDocumentId: string | null = null;
    if (documentId !== undefined) {
      if (!isCandidate || !cleanAttachment || typeof documentId !== 'string') throw new ForbiddenException('Apenas o candidato pode vincular um documento enviado.');
      if (documentId.trim().length === 0 || documentId.length > 160) throw new BadRequestException('Documento solicitado inválido.');
      cleanDocumentId = documentId;
      application.onboardingDocs = {
        ...(application.onboardingDocs || {}),
        [cleanDocumentId]: { url: cleanAttachment.data, status: 'pending', uploadedAt: new Date().toISOString(), feedback: '' },
      };
      application.submittedForReview = false;
      if (application.status === ApplicationStatus.DOCUMENTS_SUBMITTED) application.status = ApplicationStatus.DOCUMENTS_REQUESTED;
      await this.applications.save(application);
    }

    const message = this.messages.create({
      applicationId,
      senderId: uid,
      senderName: user.socialName || user.displayName || user.fullName || 'Usuário',
      senderRole: user.type,
      type: cleanAttachment ? ChatMessageType.DOCUMENT : ChatMessageType.TEXT,
      body: cleanBody || null,
      attachment: cleanAttachment,
      documentId: cleanDocumentId,
      documentRequest: null,
    });
    const saved = await this.messages.save(message);
    return { message: saved, recipientIds: await this.recipientIds(application, uid) };
  }

  async requestDocument(applicationId: string, uid: string, data: { name?: unknown; instructions?: unknown; required?: unknown; body?: unknown }) {
    const { application, user, isCandidate } = await this.assertParticipant(applicationId, uid);
    if (isCandidate) throw new ForbiddenException('Apenas a empresa pode solicitar documentos adicionais.');
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name || name.length > 120) throw new BadRequestException('Informe um nome de documento válido.');
    const document = {
      id: `chat-doc-${Date.now()}`,
      name,
      instructions: typeof data.instructions === 'string' ? data.instructions.trim().slice(0, 500) : '',
      required: data.required !== false,
      requestedAt: new Date().toISOString(),
    };
    application.customDocs = [...(application.customDocs || []), document];
    application.documentsRequested = true;
    application.documentsRequestedAt = new Date();
    application.status = ApplicationStatus.DOCUMENTS_REQUESTED;
    await this.applications.save(application);

    const message = this.messages.create({
      applicationId,
      senderId: uid,
      senderName: user.socialName || user.displayName || user.fullName || 'Empresa',
      senderRole: user.type,
      type: ChatMessageType.DOCUMENT_REQUEST,
      body: typeof data.body === 'string' ? data.body.trim().slice(0, 4000) || null : null,
      attachment: null,
      documentId: document.id,
      documentRequest: document,
    });
    const saved = await this.messages.save(message);
    return { message: saved, recipientIds: await this.recipientIds(application, uid), application };
  }

  async assertParticipant(applicationId: string, uid: string) {
    const [application, user] = await Promise.all([
      this.applications.findOne({ where: { id: applicationId } }),
      this.users.findOne({ where: { id: uid } }),
    ]);
    if (!application || !user) throw new NotFoundException('Candidatura não encontrada.');
    const isHiringPhase = application.documentsRequested || [
      ApplicationStatus.DOCUMENTS_REQUESTED,
      ApplicationStatus.DOCUMENTS_SUBMITTED,
      ApplicationStatus.HIRED,
    ].includes(application.status);
    if (!isHiringPhase) {
      throw new ForbiddenException('A conversa fica disponível somente durante a fase de contratação.');
    }
    if (application.candidateId === uid) return { application, user, isCandidate: true };
    const job = await this.jobs.findOne({ where: { id: application.jobId } });
    const isManager = user.type === UserType.ADMIN || (user.type === UserType.COMPANY && job && (job.ownerId === uid || (user.companyId === job.companyId && user.isCompanyAdmin)));
    if (!isManager) throw new ForbiddenException('Você não participa desta conversa.');
    return { application, user, isCandidate: false };
  }

  private validateAttachment(input?: AttachmentInput) {
    if (!input) return null;
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const data = typeof input.data === 'string' ? input.data : '';
    const mimeType = typeof input.mimeType === 'string' ? input.mimeType : '';
    const size = typeof input.size === 'number' ? input.size : 0;
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (!name || !data.startsWith('data:') || !allowed.has(mimeType) || size <= 0 || size > 10 * 1024 * 1024 || data.length > 14 * 1024 * 1024) {
      throw new BadRequestException('Anexo inválido. Envie PDF, PNG ou JPEG de até 10 MB.');
    }
    return { name: name.slice(0, 180), data, mimeType, size };
  }

  private async recipientIds(application: Application, senderId: string) {
    const job = await this.jobs.findOne({ where: { id: application.jobId } });
    const ids = new Set<string>([application.candidateId]);
    if (job) {
      ids.add(job.ownerId);
      const companyAdmins = job.companyId ? await this.users.find({ where: { companyId: job.companyId, isCompanyAdmin: true } }) : [];
      companyAdmins.forEach(user => ids.add(user.id));
    }
    ids.delete(senderId);
    return [...ids];
  }
}
