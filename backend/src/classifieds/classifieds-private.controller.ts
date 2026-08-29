import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ChatGateway } from '../chat/chat.gateway';
import { IdentityComplianceService } from '../compliance/identity-compliance.service';
import { ClassifiedsAuctionService } from './classifieds-auction.service';
import { ClassifiedsCategoryTaxonomyService } from './classifieds-category-taxonomy.service';
import { ClassifiedsChatService } from './classifieds-chat.service';
import { ClassifiedsCommerceService } from './classifieds-commerce.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsLifecycleService } from './classifieds-lifecycle.service';
import { ClassifiedsOfferChatService } from './classifieds-offer-chat.service';
import { ClassifiedsService } from './classifieds.service';

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsPrivateController {
  constructor(
    private readonly classifieds: ClassifiedsService,
    private readonly taxonomy: ClassifiedsCategoryTaxonomyService,
    private readonly identities: ClassifiedsIdentityService,
    private readonly lifecycle: ClassifiedsLifecycleService,
    private readonly chats: ClassifiedsChatService,
    private readonly commerce: ClassifiedsCommerceService,
    private readonly entitlements: ClassifiedsEntitlementsService,
    private readonly auctions: ClassifiedsAuctionService,
    private readonly offerChat: ClassifiedsOfferChatService,
    private readonly chatGateway: ChatGateway,
    private readonly compliance: IdentityComplianceService,
  ) {}

  @Get('me/context')
  context(@Req() req: any) {
    return this.identities.context(req.user.uid);
  }

  @Get('me/limits')
  limits(@Req() req: any) {
    return this.entitlements.limits(req.user.uid);
  }

  @Post('me/context/select')
  selectIdentity(@Req() req: any, @Body() body: any) {
    return this.identities.select(req.user.uid, body?.identity);
  }

  @Post('me/terms/personal')
  acceptPersonalTerms(@Req() req: any, @Body() body: any) {
    return this.identities.acceptPersonalTerms(req.user.uid, body?.accepted);
  }

  @Post('me/company-profile')
  configureCompany(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.identities.configureCompany(req.user.uid, body || {});
  }

  @Patch('me/company-profile')
  updateCompany(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.identities.configureCompany(req.user.uid, body || {});
  }

  @Get('me/listings')
  mine(@Req() req: any) {
    return this.classifieds.mine(req.user.uid);
  }

  @Get('me/favorites')
  favorites(@Req() req: any) {
    return this.classifieds.favorites(req.user.uid);
  }

  @Get('me/analytics')
  analytics(@Req() req: any) {
    return this.commerce.analytics(req.user.uid);
  }

  @Get('me/offers')
  offers(@Req() req: any) {
    return this.commerce.listOffers(req.user.uid);
  }

  @Post('listings/:listingId/offers')
  async createOffer(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    await this.auctions.assertOffersAllowed(listingId);
    const offer = await this.commerce.createOffer(req.user.uid, listingId, body?.amount);
    const event = offer?.offerEvent === 'UPDATED' ? 'UPDATED' : 'CREATED';
    const chat = offer?.id ? await this.offerChat.record(req.user.uid, offer.id, event) : null;
    if (chat?.message) this.chatGateway.publishMessage(chat.message, chat.recipientIds);
    return { ...offer, conversationId: chat?.conversationId || null };
  }

  @Post('me/offers/:offerId/respond')
  async respondOffer(@Req() req: any, @Param('offerId') offerId: string, @Body() body: any) {
    const result = await this.commerce.respondOffer(req.user.uid, offerId, body?.decision);
    const event = String(body?.decision || '').toUpperCase().startsWith('ACCEPT') ? 'ACCEPTED' : 'REJECTED';
    const chat = await this.offerChat.record(req.user.uid, offerId, event);
    if (chat?.message) this.chatGateway.publishMessage(chat.message, chat.recipientIds);
    return { ...result, conversationId: chat?.conversationId || null };
  }

  @Post('me/offers/:offerId/withdraw')
  async withdrawOffer(@Req() req: any, @Param('offerId') offerId: string) {
    const result = await this.commerce.withdrawOffer(req.user.uid, offerId);
    const chat = await this.offerChat.record(req.user.uid, offerId, 'WITHDRAWN');
    if (chat?.message) this.chatGateway.publishMessage(chat.message, chat.recipientIds);
    return { ...result, conversationId: chat?.conversationId || null };
  }

  @Get('auctions')
  auctionsList(@Req() req: any) {
    return this.auctions.list(req.user.uid);
  }

  @Get('auctions/:auctionId')
  auctionDetail(@Req() req: any, @Param('auctionId') auctionId: string) {
    return this.auctions.detail(req.user.uid, auctionId);
  }

  @Post('me/auctions')
  async createAuction(@Req() req: any, @Body() body: Record<string, unknown>) {
    const identity = await this.identities.active(req.user.uid);
    await this.compliance.assertSellerEligible(req.user.uid, identity);
    await this.entitlements.assertAuctionCreation(req.user.uid);
    return this.auctions.create(req.user.uid, body || {});
  }

  @Post('auctions/:auctionId/bids')
  async bidAuction(@Req() req: any, @Param('auctionId') auctionId: string, @Body() body: any) {
    await this.entitlements.assertAuctionParticipant(req.user.uid);
    return this.auctions.bid(req.user.uid, auctionId, body?.amount);
  }

  @Post('me/auctions/:auctionId/cancel')
  async cancelAuction(@Req() req: any, @Param('auctionId') auctionId: string) {
    await this.entitlements.assertAuctionCreation(req.user.uid);
    return this.auctions.cancel(req.user.uid, auctionId);
  }

  @Post('me/listings')
  async create(@Req() req: any, @Body() body: Record<string, unknown>) {
    await this.taxonomy.assertCompatible(body.categorySlug, body.listingType, body.attributes);
    await this.entitlements.assertImageLimit(req.user.uid, body.images);
    return this.classifieds.create(req.user.uid, normalizeOptionalPublicContacts(body));
  }

  @Patch('me/listings/:id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    if (body.categorySlug !== undefined && body.listingType !== undefined) {
      await this.taxonomy.assertCompatible(body.categorySlug, body.listingType, body.attributes);
    }
    if (Array.isArray(body.images)) await this.entitlements.assertImageLimit(req.user.uid, body.images);
    return this.classifieds.update(req.user.uid, id, body);
  }

  @Post('me/listings/:id/publish')
  async publish(@Req() req: any, @Param('id') id: string) {
    await this.identities.assertPublishingReady(req.user.uid);
    const identity = await this.identities.active(req.user.uid);
    await this.compliance.assertSellerEligible(req.user.uid, identity);

    // A publicação não dispara mais moderação por IA automaticamente.
    // Revisões operacionais devem ser executadas sob demanda por API/MCP.
    return this.classifieds.publish(req.user.uid, id);
  }

  @Post('me/listings/:id/status')
  async status(@Req() req: any, @Param('id') id: string, @Body() body: { status?: unknown }) {
    const status = String(body?.status || '').toUpperCase();
    if (status === 'PUBLISHED') {
      const identity = await this.identities.active(req.user.uid);
      await this.compliance.assertSellerEligible(req.user.uid, identity);
    }
    if (status === 'SOLD') {
      return this.lifecycle.markSold(req.user.uid, id);
    }
    return this.classifieds.setStatus(req.user.uid, id, body?.status);
  }

  @Post('listings/:id/favorite')
  async favorite(@Req() req: any, @Param('id') id: string) {
    const result = await this.classifieds.toggleFavorite(req.user.uid, id);
    if ((result as any)?.favorited) await this.commerce.trackEvent(id, 'FAVORITE', req.user.uid);
    return result;
  }

  @Get('me/conversations')
  async conversations(@Req() req: any) {
    const rows = await this.chats.list(req.user.uid);
    return this.commerce.decorateConversations(req.user.uid, rows);
  }

  @Post('listings/:listingId/conversations')
  async startConversation(@Req() req: any, @Param('listingId') listingId: string) {
    const conversation = await this.chats.start(listingId, req.user.uid);
    const identity = await this.identities.active(req.user.uid);
    await this.commerce.trackEvent(
      listingId,
      'CHAT_START',
      req.user.uid,
      identity.type === 'COMPANY' ? identity.company!.id : null,
    );
    return conversation;
  }

  @Patch('me/conversations/:conversationId/name')
  renameConversation(@Req() req: any, @Param('conversationId') conversationId: string, @Body() body: any) {
    return this.commerce.renameConversation(req.user.uid, conversationId, body?.name);
  }

  @Delete('me/conversations/:conversationId')
  async archiveConversation(@Req() req: any, @Param('conversationId') conversationId: string) {
    return this.chats.archive(conversationId, req.user.uid);
  }

  @Get('me/chat-labels')
  labels(@Req() req: any) {
    return this.commerce.companyLabels(req.user.uid);
  }

  @Post('me/chat-labels')
  createLabel(@Req() req: any, @Body() body: any) {
    return this.commerce.createCompanyLabel(req.user.uid, body?.name, body?.colorKey);
  }

  @Patch('me/conversations/:conversationId/labels')
  setConversationLabels(@Req() req: any, @Param('conversationId') conversationId: string, @Body() body: any) {
    return this.commerce.setConversationLabels(req.user.uid, conversationId, body?.labelIds);
  }

  @Get('me/conversations/:conversationId/messages')
  messages(@Req() req: any, @Param('conversationId') conversationId: string) {
    return this.chats.listMessages(conversationId, req.user.uid);
  }

  @Post('me/conversations/:conversationId/messages')
  async sendMessage(@Req() req: any, @Param('conversationId') conversationId: string, @Body() body: any) {
    const result = await this.chats.send(conversationId, req.user.uid, body?.body, body?.metadata);
    this.chatGateway.publishMessage(result.message, result.recipientIds);
    return result.message;
  }

  @Post('me/conversations/:conversationId/read')
  readConversation(@Req() req: any, @Param('conversationId') conversationId: string) {
    return this.chats.markRead(conversationId, req.user.uid);
  }
}

function normalizeOptionalPublicContacts(body: Record<string, unknown>) {
  const payload = { ...body };
  if (!String(body.contactPhone ?? '').trim()) payload.contactPhone = ' ';
  if (!String(body.contactWhatsapp ?? '').trim()) payload.contactWhatsapp = ' ';
  return payload;
}
