import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ChatGateway } from '../chat/chat.gateway';
import { ClassifiedsChatService } from './classifieds-chat.service';
import { ClassifiedsCommerceService } from './classifieds-commerce.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsService } from './classifieds.service';

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsPrivateController {
  constructor(
    private readonly classifieds: ClassifiedsService,
    private readonly identities: ClassifiedsIdentityService,
    private readonly chats: ClassifiedsChatService,
    private readonly commerce: ClassifiedsCommerceService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('me/context')
  context(@Req() req: any) {
    return this.identities.context(req.user.uid);
  }

  @Get('me/limits')
  limits(@Req() req: any) {
    return this.commerce.limits(req.user.uid);
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
  createOffer(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    return this.commerce.createOffer(req.user.uid, listingId, body?.amount);
  }

  @Post('me/offers/:offerId/respond')
  respondOffer(@Req() req: any, @Param('offerId') offerId: string, @Body() body: any) {
    return this.commerce.respondOffer(req.user.uid, offerId, body?.decision);
  }

  @Post('me/offers/:offerId/withdraw')
  withdrawOffer(@Req() req: any, @Param('offerId') offerId: string) {
    return this.commerce.withdrawOffer(req.user.uid, offerId);
  }

  @Post('me/listings')
  async create(@Req() req: any, @Body() body: Record<string, unknown>) {
    await this.commerce.assertImageLimit(req.user.uid, body.images);
    return this.classifieds.create(req.user.uid, normalizeOptionalPublicContacts(body));
  }

  @Patch('me/listings/:id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    if (Array.isArray(body.images)) await this.commerce.assertImageLimit(req.user.uid, body.images);
    return this.classifieds.update(req.user.uid, id, body);
  }

  @Post('me/listings/:id/publish')
  async publish(@Req() req: any, @Param('id') id: string) {
    const listing = await this.classifieds.publish(req.user.uid, id);
    const moderation = await this.commerce.moderatePublishedListing(req.user.uid, id);
    if ((moderation as any)?.status === 'PAUSED') {
      return {
        ...listing,
        status: 'PAUSED',
        moderationReason: (moderation as any).reason || 'Possível anúncio duplicado.',
        duplicateOfListingId: (moderation as any).duplicateListingId || null,
      };
    }
    return listing;
  }

  @Post('me/listings/:id/status')
  status(@Req() req: any, @Param('id') id: string, @Body() body: { status?: unknown }) {
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
    const result = await this.chats.send(conversationId, req.user.uid, body?.body);
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
  // A publicação externa de telefone/WhatsApp é opt-in.
  if (!String(body.contactPhone ?? '').trim()) payload.contactPhone = ' ';
  if (!String(body.contactWhatsapp ?? '').trim()) payload.contactWhatsapp = ' ';
  return payload;
}
