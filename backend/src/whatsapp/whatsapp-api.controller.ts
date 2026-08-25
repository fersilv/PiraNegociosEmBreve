import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RequireWhatsAppScope, WhatsAppApiKeyGuard } from './whatsapp-key.guard';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp/v1/:instanceId')
@UseGuards(WhatsAppApiKeyGuard)
export class WhatsAppApiController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get('status')
  @RequireWhatsAppScope('connection:read')
  async status(@Param('instanceId') id: string) {
    return this.publicStatus(await this.whatsapp.status(id));
  }

  @Get('messages')
  @RequireWhatsAppScope('messages:read')
  messages(@Param('instanceId') id: string, @Query('limit') limit?: string) {
    return this.whatsapp.listMessages(id, Number(limit || 50));
  }

  @Post('messages')
  @RequireWhatsAppScope('messages:send')
  sendMessage(
    @Param('instanceId') id: string,
    @Body() body: { target?: string; text?: string; media?: string; filename?: string; caption?: string },
  ) {
    if (body.media) return this.whatsapp.sendMedia(id, String(body.target || ''), body.media, body.filename, body.caption);
    return this.whatsapp.sendText(id, String(body.target || ''), String(body.text || ''));
  }

  @Get('contacts')
  @RequireWhatsAppScope('contacts:read')
  contacts(@Param('instanceId') id: string) {
    return this.whatsapp.listContacts(id);
  }

  @Get('contacts/saved')
  @RequireWhatsAppScope('contacts:read')
  savedContacts(@Param('instanceId') id: string) {
    return this.whatsapp.listSavedContacts(id);
  }

  @Post('contacts/saved')
  @RequireWhatsAppScope('contacts:write')
  saveContact(
    @Param('instanceId') id: string,
    @Body() body: { phoneNumber?: string; name?: string; notes?: string },
  ) {
    return this.whatsapp.saveContact(id, body);
  }

  @Get('groups')
  @RequireWhatsAppScope('groups:read')
  groups(@Param('instanceId') id: string) {
    return this.whatsapp.listGroups(id);
  }

  @Post('groups/:groupId/messages')
  @RequireWhatsAppScope('groups:send')
  groupMessage(
    @Param('instanceId') id: string,
    @Param('groupId') groupId: string,
    @Body() body: { text?: string },
  ) {
    return this.whatsapp.sendText(id, groupId, String(body.text || ''));
  }

  @Get('channels')
  @RequireWhatsAppScope('channels:read')
  channels(@Param('instanceId') id: string) {
    return this.whatsapp.listChannels(id);
  }

  @Post('channels/:channelId/posts')
  @RequireWhatsAppScope('channels:publish')
  channelPost(
    @Param('instanceId') id: string,
    @Param('channelId') channelId: string,
    @Body() body: { text?: string },
  ) {
    return this.whatsapp.publishChannel(id, channelId, String(body.text || ''));
  }

  @Post('status')
  @RequireWhatsAppScope('status:publish')
  publishStatus(
    @Param('instanceId') id: string,
    @Body() body: { text?: string; media?: string; caption?: string },
  ) {
    return this.whatsapp.publishStatus(id, body);
  }

  private publicStatus(value: any) {
    return {
      id: value.id,
      name: value.name,
      purpose: value.purpose,
      phoneNumber: value.phoneNumber,
      provider: value.provider,
      status: value.status,
      active: value.active,
      connected: value.connected,
      lastConnectedAt: value.lastConnectedAt,
      lastSeenAt: value.lastSeenAt,
      runtimeDetail: value.runtimeDetail,
      capabilities: value.capabilities,
    };
  }
}
