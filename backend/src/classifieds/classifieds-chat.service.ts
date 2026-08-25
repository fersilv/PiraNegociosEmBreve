import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { User, UserType } from '../users/entities/user.entity';
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
  ) {}

  async start(listingId: string, uid: string) {
    const [listing, user] = await Promise.all([
      this.listings.findOne({ where: { id: listingId, status: 'PUBLISHED' } }),
      this.users.findOne({ where: { id: uid } }),
    ]);
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');
    if (!user) throw new ForbiddenException('Usuário não encontrado.');
    if (await this.isSeller(listing, user)) {
      throw new BadRequestException('Você não pode iniciar uma negociação com o seu próprio anúncio.');
    }

    let conversation = await this.conversations.findOne({ where: { listingId, buyerUserId: uid } });
    if (!conversation) {
      conversation = this.conversations.create({
        listingId,
        buyerUserId: uid,
        sellerUserId: listing.sellerUserId,
        sellerCompanyId: listing.companyId,
        buyerLastReadAt: new Date(),
        sellerLastReadAt: null,
        lastMessageAt: null,
      });
      conversation = await this.conversations.save(conversation);
    }
    return this.hydrate(conversation, uid);
  }

  async list(uid: string) {
    const user = await this.users.findOne({ where: { id: uid } });
    if (!user) throw new ForbiddenException('Usuário não encontrado.');

    const query = this.conversations.createQueryBuilder('conversation')
      .where(new Brackets((where) => {
        where.where('conversation.buyerUserId = :uid', { uid })
          .orWhere('conversation.sellerUserId = :uid', { uid });
        if (user.companyId && user.isCompanyAdmin) {
          where.orWhere('conversation.sellerCompanyId = :companyId', { companyId: user.companyId });
        }
      }))
      .orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST')
      .addOrderBy('conversation.updatedAt', 'DESC');

    const rows = await query.getMany();
    return Promise.all(rows.map((conversation) => this.hydrate(conversation, uid)));
  }

  async listMessages(conversationId: string, uid: string) {
    const { conversation, role } = await this.assertParticipant(conversationId, uid);
    await this.markReadEntity(conversation, role);
    return this.messages.find({ where: { conversationId }, order: { createdAt: 'ASC' } });
  }

  async send(conversationId: string, uid: string, rawBody: unknown) {
    const { conversation, user, role } = await this.assertParticipant(conversationId, uid);
    const body = String(rawBody ?? '').trim();
    if (!body) throw new BadRequestException('Escreva uma mensagem.');
    if (body.length > 4000) throw new BadRequestException('A mensagem excede o limite de 4.000 caracteres.');

    const senderName = role === 'SELLER' && conversation.sellerCompanyId
      ? (await this.companies.findOne({ where: { id: conversation.sellerCompanyId } }))?.name
        || user.socialName || user.displayName || user.fullName || 'Empresa'
      : user.socialName || user.displayName || user.fullName || 'Usuário';

    const message = await this.messages.save(this.messages.create({
      conversationId,
      senderId: uid,
      senderName,
      body,
      messageType: 'TEXT',
      metadata: null,
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
    if (conversation.buyerUserId === uid) return { conversation, user, role: 'BUYER' as const };
    if (conversation.sellerUserId === uid) return { conversation, user, role: 'SELLER' as const };
    if (conversation.sellerCompanyId && user.companyId === conversation.sellerCompanyId && user.isCompanyAdmin) {
      return { conversation, user, role: 'SELLER' as const };
    }
    if (user.type === UserType.ADMIN) return { conversation, user, role: 'SELLER' as const };
    throw new ForbiddenException('Você não participa desta conversa.');
  }

  private async isSeller(listing: ClassifiedListing, user: User) {
    if (listing.sellerUserId === user.id) return true;
    if (!listing.companyId) return false;
    if (user.companyId === listing.companyId && user.isCompanyAdmin) return true;
    const company = await this.companies.findOne({ where: { id: listing.companyId } });
    return company?.ownerId === user.id;
  }

  private async recipientIds(conversation: ClassifiedConversation, senderId: string) {
    const ids = new Set<string>();
    if (conversation.buyerUserId !== senderId) ids.add(conversation.buyerUserId);
    if (conversation.sellerUserId !== senderId) ids.add(conversation.sellerUserId);
    if (conversation.sellerCompanyId) {
      const admins = await this.users.find({ where: { companyId: conversation.sellerCompanyId, isCompanyAdmin: true } });
      admins.forEach((user) => { if (user.id !== senderId) ids.add(user.id); });
      const company = await this.companies.findOne({ where: { id: conversation.sellerCompanyId } });
      if (company?.ownerId && company.ownerId !== senderId) ids.add(company.ownerId);
    }
    return [...ids];
  }

  private async hydrate(conversation: ClassifiedConversation, uid: string) {
    const listing = await this.listings.findOne({ where: { id: conversation.listingId } });
    const image = listing ? await this.images.findOne({ where: { listingId: listing.id }, order: { sortOrder: 'ASC' } }) : null;
    const [buyer, seller, company, lastMessage] = await Promise.all([
      this.users.findOne({ where: { id: conversation.buyerUserId } }),
      this.users.findOne({ where: { id: conversation.sellerUserId } }),
      conversation.sellerCompanyId ? this.companies.findOne({ where: { id: conversation.sellerCompanyId } }) : Promise.resolve(null),
      this.messages.findOne({ where: { conversationId: conversation.id }, order: { createdAt: 'DESC' } }),
    ]);
    const role = conversation.buyerUserId === uid ? 'BUYER' : 'SELLER';
    const readAt = role === 'BUYER' ? conversation.buyerLastReadAt : conversation.sellerLastReadAt;
    const unreadCount = await this.messages.createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId: conversation.id })
      .andWhere('message.senderId != :uid', { uid })
      .andWhere(readAt ? 'message.createdAt > :readAt' : '1=1', readAt ? { readAt } : {})
      .getCount();

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
        id: buyer?.id || conversation.buyerUserId,
        name: buyer?.socialName || buyer?.displayName || buyer?.fullName || 'Comprador',
        photoURL: buyer?.photoURL || null,
      },
      seller: {
        id: conversation.sellerCompanyId || conversation.sellerUserId,
        type: conversation.sellerCompanyId ? 'COMPANY' : 'PERSON',
        name: company?.name || seller?.socialName || seller?.displayName || seller?.fullName || 'Anunciante',
        photoURL: company?.logoURL || seller?.photoURL || null,
        verified: Boolean(company?.isVerified || seller?.isVerified),
      },
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        senderId: lastMessage.senderId,
        body: lastMessage.body,
        createdAt: lastMessage.createdAt,
      } : null,
    };
  }
}
