import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { User, UserType } from '../users/entities/user.entity';
import { ActiveClassifiedIdentity, ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedConversation } from './entities/classified-conversation.entity';
import { ClassifiedConversationMessage } from './entities/classified-conversation-message.entity';
import { ClassifiedListing } from './entities/classified-listing.entity';
import { ClassifiedListingImage } from './entities/classified-listing-image.entity';

@Injectable()
export class ClassifiedsChatService {
  constructor(
    @InjectRepository(ClassifiedConversation)
    private readonly conversations: Repository<ClassifiedConversation>,
    @InjectRepository(ClassifiedConversationMessage)
    private readonly messages: Repository<ClassifiedConversationMessage>,
    @InjectRepository(ClassifiedListing)
    private readonly listings: Repository<ClassifiedListing>,
    @InjectRepository(ClassifiedListingImage)
    private readonly images: Repository<ClassifiedListingImage>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    private readonly identities: ClassifiedsIdentityService,
  ) {}

  async start(listingId: string, uid: string) {
    const [listing, user, identity] = await Promise.all([
      this.listings.findOne({ where: { id: listingId, status: 'PUBLISHED' } }),
      this.users.findOne({ where: { id: uid } }),
      this.identities.active(uid),
    ]);
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');
    if (!user) throw new ForbiddenException('Usuário não encontrado.');
    if (await this.isSeller(listing, user)) {
      throw new BadRequestException('Você não pode iniciar uma negociação com o seu próprio anúncio.');
    }

    const buyerCompanyId = identity.type === 'COMPANY' ? identity.company!.id : null;
    let conversation = buyerCompanyId
      ? await this.conversations.findOne({ where: { listingId, buyerCompanyId } })
      : await this.conversations.findOne({ where: { listingId, buyerUserId: uid, buyerCompanyId: IsNull() } });

    if (!conversation) {
      conversation = this.conversations.create({
        listingId,
        buyerUserId: uid,
        buyerCompanyId,
        sellerUserId: listing.sellerUserId,
        sellerCompanyId: listing.companyId,
        buyerLastReadAt: new Date(),
        sellerLastReadAt: null,
        lastMessageAt: null,
      });
      conversation = await this.conversations.save(conversation);
    }
    return this.hydrate(conversation, uid, identity);
  }

  async list(uid: string) {
    const [user, identity] = await Promise.all([
      this.users.findOne({ where: { id: uid } }),
      this.identities.active(uid),
    ]);
    if (!user) throw new ForbiddenException('Usuário não encontrado.');

    const query = this.conversations.createQueryBuilder('conversation')
      .where(new Brackets((where) => {
        if (identity.type === 'COMPANY') {
          const companyId = identity.company!.id;
          where.where('(conversation.buyerCompanyId = :companyId AND conversation.buyerDeletedAt IS NULL)', { companyId })
            .orWhere('(conversation.sellerCompanyId = :companyId AND conversation.sellerDeletedAt IS NULL)', { companyId });
        } else {
          where.where('(conversation.buyerUserId = :uid AND conversation.buyerCompanyId IS NULL AND conversation.buyerDeletedAt IS NULL)', { uid })
            .orWhere('(conversation.sellerUserId = :uid AND conversation.sellerCompanyId IS NULL AND conversation.sellerDeletedAt IS NULL)', { uid });
        }
      }))
      .orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST')
      .addOrderBy('conversation.updatedAt', 'DESC');

    const rows = await query.getMany();
    return Promise.all(rows.map((conversation) => this.hydrate(conversation, uid, identity)));
  }

  async listMessages(conversationId: string, uid: string) {
    const { conversation, role } = await this.assertParticipant(conversationId, uid);
    await this.markReadEntity(conversation, role);
    return this.messages.find({ where: { conversationId }, order: { createdAt: 'ASC' } });
  }

  async archive(conversationId: string, uid: string) {
    const { conversation, role } = await this.assertParticipant(conversationId, uid);
    if (role === 'BUYER') conversation.buyerDeletedAt = new Date();
    else conversation.sellerDeletedAt = new Date();
    await this.conversations.save(conversation);
    return { archived: true };
  }

  async send(conversationId: string, uid: string, rawBody: unknown, rawMetadata: unknown = null) {
    const { conversation, user, role } = await this.assertParticipant(conversationId, uid);
    const body = String(rawBody ?? '').trim();
    if (!body && !rawMetadata) throw new BadRequestException('Escreva uma mensagem ou envie um anexo.');
    if (body.length > 4000) throw new BadRequestException('A mensagem excede o limite de 4.000 caracteres.');

    const companyId = role === 'BUYER' ? conversation.buyerCompanyId : conversation.sellerCompanyId;
    const company = companyId ? await this.companies.findOne({ where: { id: companyId } }) : null;
    const senderName = company?.name || user.socialName || user.displayName || user.fullName || 'Usuário';

    let metadata = null;
    if (rawMetadata && typeof rawMetadata === 'object') {
      metadata = rawMetadata;
    }

    const message = await this.messages.save(this.messages.create({
      conversationId,
      senderId: uid,
      senderName,
      senderRole: role,
      body,
      messageType: 'TEXT',
      metadata,
    }));

    conversation.lastMessageAt = message.createdAt || new Date();
    if (role === 'BUYER') conversation.buyerLastReadAt = new Date();
    else conversation.sellerLastReadAt = new Date();
    await this.conversations.save(conversation);

    return {
      message,
      recipientIds: await this.recipientIds(conversation, uid),
    };
  }

  async markRead(conversationId: string, uid: string) {
    const { conversation, role } = await this.assertParticipant(conversationId, uid);
    await this.markReadEntity(conversation, role);
    return { ok: true };
  }

  private async markReadEntity(conversation: ClassifiedConversation, role: 'BUYER' | 'SELLER') {
    if (role === 'BUYER') conversation.buyerLastReadAt = new Date();
    else conversation.sellerLastReadAt = new Date();
    await this.conversations.save(conversation);
  }

  private async assertParticipant(conversationId: string, uid: string) {
    const [conversation, user] = await Promise.all([
      this.conversations.findOne({ where: { id: conversationId } }),
      this.users.findOne({ where: { id: uid } }),
    ]);
    if (!conversation || !user) throw new NotFoundException('Conversa não encontrada.');
    if (user.type === UserType.ADMIN) return { conversation, user, role: 'SELLER' as const };

    const identity = await this.identities.active(uid);
    if (identity.type === 'COMPANY') {
      const companyId = identity.company!.id;
      if (conversation.buyerCompanyId === companyId) return { conversation, user, role: 'BUYER' as const };
      if (conversation.sellerCompanyId === companyId) return { conversation, user, role: 'SELLER' as const };
    } else {
      if (!conversation.buyerCompanyId && conversation.buyerUserId === uid) return { conversation, user, role: 'BUYER' as const };
      if (!conversation.sellerCompanyId && conversation.sellerUserId === uid) return { conversation, user, role: 'SELLER' as const };
    }
    throw new ForbiddenException('Esta conversa pertence a outra identidade dos Classificados.');
  }

  private async isSeller(listing: ClassifiedListing, user: User) {
    if (listing.sellerUserId === user.id) return true;
    if (!listing.companyId) return false;
    return this.isCompanyOperator(listing.companyId, user);
  }

  private async isCompanyOperator(companyId: string, user: User) {
    if (user.companyId === companyId && user.isCompanyAdmin) return true;
    const company = await this.companies.findOne({ where: { id: companyId } });
    return company?.ownerId === user.id;
  }

  private async recipientIds(conversation: ClassifiedConversation, senderId: string) {
    const ids = new Set<string>();
    await this.addIdentityRecipients(ids, conversation.buyerUserId, conversation.buyerCompanyId);
    await this.addIdentityRecipients(ids, conversation.sellerUserId, conversation.sellerCompanyId);
    ids.delete(senderId);
    return [...ids];
  }

  private async addIdentityRecipients(ids: Set<string>, fallbackUserId: string, companyId: string | null) {
    if (!companyId) {
      ids.add(fallbackUserId);
      return;
    }
    ids.add(fallbackUserId);
    const [admins, company] = await Promise.all([
      this.users.find({ where: { companyId, isCompanyAdmin: true } }),
      this.companies.findOne({ where: { id: companyId } }),
    ]);
    admins.forEach((user) => ids.add(user.id));
    if (company?.ownerId) ids.add(company.ownerId);
  }

  private async hydrate(conversation: ClassifiedConversation, uid: string, identity?: ActiveClassifiedIdentity) {
    const activeIdentity = identity || await this.identities.active(uid);
    const role: 'BUYER' | 'SELLER' = activeIdentity.type === 'COMPANY'
      ? conversation.buyerCompanyId === activeIdentity.company!.id ? 'BUYER' : 'SELLER'
      : !conversation.buyerCompanyId && conversation.buyerUserId === uid ? 'BUYER' : 'SELLER';

    const listing = await this.listings.findOne({ where: { id: conversation.listingId } });
    const image = listing ? await this.images.findOne({ where: { listingId: listing.id }, order: { sortOrder: 'ASC' } }) : null;
    const [buyer, buyerCompany, seller, sellerCompany, lastMessage] = await Promise.all([
      this.users.findOne({ where: { id: conversation.buyerUserId } }),
      conversation.buyerCompanyId ? this.companies.findOne({ where: { id: conversation.buyerCompanyId } }) : Promise.resolve(null),
      this.users.findOne({ where: { id: conversation.sellerUserId } }),
      conversation.sellerCompanyId ? this.companies.findOne({ where: { id: conversation.sellerCompanyId } }) : Promise.resolve(null),
      this.messages.findOne({ where: { conversationId: conversation.id }, order: { createdAt: 'DESC' } }),
    ]);
    const readAt = role === 'BUYER' ? conversation.buyerLastReadAt : conversation.sellerLastReadAt;
    const unreadQuery = this.messages.createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId: conversation.id })
      .andWhere('message.senderRole != :role', { role });
    if (readAt) unreadQuery.andWhere('message.createdAt > :readAt', { readAt });
    const unreadCount = await unreadQuery.getCount();

    return {
      ...conversation,
      role,
      unreadCount,
      listing: listing ? {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        price: listing.price,
        priceType: listing.priceType,
        status: listing.status,
        image: image?.url || null,
      } : null,
      buyer: {
        id: conversation.buyerCompanyId || buyer?.id || conversation.buyerUserId,
        type: conversation.buyerCompanyId ? 'COMPANY' : 'PERSON',
        name: buyerCompany?.name || buyer?.socialName || buyer?.displayName || buyer?.fullName || 'Comprador',
        photoURL: buyerCompany?.logoURL || buyer?.photoURL || null,
        verified: Boolean(buyerCompany?.isVerified || buyer?.isVerified),
      },
      seller: {
        id: conversation.sellerCompanyId || conversation.sellerUserId,
        type: conversation.sellerCompanyId ? 'COMPANY' : 'PERSON',
        name: sellerCompany?.name || seller?.socialName || seller?.displayName || seller?.fullName || 'Anunciante',
        photoURL: sellerCompany?.logoURL || seller?.photoURL || null,
        verified: Boolean(sellerCompany?.isVerified || seller?.isVerified),
      },
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        senderId: lastMessage.senderId,
        senderRole: lastMessage.senderRole,
        body: lastMessage.body,
        createdAt: lastMessage.createdAt,
      } : null,
    };
  }
}
