import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ChatGateway } from '../chat/chat.gateway';
import { ClassifiedsChatService } from './classifieds-chat.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsService } from './classifieds.service';

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsPrivateController {
  constructor(
    private readonly classifieds: ClassifiedsService,
    private readonly identities: ClassifiedsIdentityService,
    private readonly chats: ClassifiedsChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('me/context')
  context(@Req() req: any) {
    return this.identities.context(req.user.uid);
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

  @Post('me/listings')
  create(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.classifieds.create(req.user.uid, body);
  }

  @Patch('me/listings/:id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.classifieds.update(req.user.uid, id, body);
  }

  @Post('me/listings/:id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.classifieds.publish(req.user.uid, id);
  }

  @Post('me/listings/:id/status')
  status(@Req() req: any, @Param('id') id: string, @Body() body: { status?: unknown }) {
    return this.classifieds.setStatus(req.user.uid, id, body?.status);
  }

  @Post('listings/:id/favorite')
  favorite(@Req() req: any, @Param('id') id: string) {
    return this.classifieds.toggleFavorite(req.user.uid, id);
  }

  @Get('me/conversations')
  conversations(@Req() req: any) {
    return this.chats.list(req.user.uid);
  }

  @Post('listings/:listingId/conversations')
  startConversation(@Req() req: any, @Param('listingId') listingId: string) {
    return this.chats.start(listingId, req.user.uid);
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
