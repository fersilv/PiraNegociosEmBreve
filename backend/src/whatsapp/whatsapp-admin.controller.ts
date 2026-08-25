import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WHATSAPP_CAPABILITIES } from './whatsapp.scopes';
import { WhatsAppService } from './whatsapp.service';

@Controller('admin/whatsapp')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class WhatsAppAdminController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    @InjectRepository(WhatsAppApiKey)
    private readonly keysRepository: Repository<WhatsAppApiKey>,
  ) {}

  @Get('capabilities') capabilities() {
    return WHATSAPP_CAPABILITIES;
  }

  @Get('instances') listInstances() {
    return this.whatsapp.listInstances();
  }

  @Post('instances') createInstance(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.whatsapp.createInstance(req.user.uid, body);
  }

  @Get('instances/:id') getInstance(@Param('id') id: string) {
    return this.whatsapp.status(id);
  }

  @Put('instances/:id') updateInstance(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.whatsapp.updateInstance(id, body);
  }

  @Delete('instances/:id') removeInstance(@Param('id') id: string) {
    return this.whatsapp.removeInstance(id);
  }

  @Post('instances/:id/connect') connect(@Param('id') id: string) {
    return this.whatsapp.connect(id);
  }

  @Post('instances/:id/disconnect') disconnect(@Param('id') id: string, @Body() body: { logout?: boolean }) {
    return this.whatsapp.disconnect(id, Boolean(body?.logout));
  }

  @Get('instances/:id/contacts') contacts(@Param('id') id: string) {
    return this.whatsapp.listContacts(id);
  }

  @Get('instances/:id/saved-contacts') savedContacts(@Param('id') id: string) {
    return this.whatsapp.listSavedContacts(id);
  }

  @Post('instances/:id/saved-contacts') saveContact(
    @Param('id') id: string,
    @Body() body: { phoneNumber?: string; name?: string; notes?: string },
  ) {
    return this.whatsapp.saveContact(id, body);
  }

  @Get('instances/:id/groups') groups(@Param('id') id: string) {
    return this.whatsapp.listGroups(id);
  }

  @Get('instances/:id/channels') channels(@Param('id') id: string) {
    return this.whatsapp.listChannels(id);
  }

  @Get('instances/:id/messages') messages(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.whatsapp.listMessages(id, Number(limit || 50));
  }

  @Post('instances/:id/test-message') testMessage(
    @Param('id') id: string,
    @Body() body: { target?: string; text?: string },
  ) {
    return this.whatsapp.sendText(id, String(body.target || ''), String(body.text || ''));
  }

  @Get('instances/:id/keys') keys(@Param('id') id: string) {
    return this.whatsapp.listKeys(id);
  }

  @Post('instances/:id/keys') createKey(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.whatsapp.createKey(id, req.user.uid, body);
  }

  @Put('keys/:keyId') updateKey(@Param('keyId') keyId: string, @Body() body: Record<string, unknown>) {
    return this.whatsapp.updateKey(keyId, body);
  }

  @Post('keys/:keyId/rotate') rotateKey(@Param('keyId') keyId: string) {
    return this.whatsapp.rotateKey(keyId);
  }

  @Delete('keys/:keyId')
  async removeKey(@Param('keyId') keyId: string) {
    const key = await this.keysRepository.findOne({ where: { id: keyId } });
    if (!key) throw new NotFoundException('Chave do WhatsApp não encontrada.');
    await this.keysRepository.remove(key);
    return { ok: true };
  }
}
