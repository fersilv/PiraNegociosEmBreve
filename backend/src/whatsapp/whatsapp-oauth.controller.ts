import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';

@Controller()
export class WhatsAppOAuthController {
  constructor(private readonly oauth: WhatsAppOAuthService) {}

  @Get('.well-known/oauth-authorization-server')
  authorizationServerMetadata() {
    return this.oauth.authorizationServerMetadata();
  }

  @Get('.well-known/oauth-protected-resource/api/whatsapp/mcp/:instanceId')
  standardResourceMetadata(@Param('instanceId') instanceId: string) {
    return this.oauth.resourceMetadata(instanceId);
  }

  @Get('whatsapp/oauth/resource/:instanceId')
  resourceMetadata(@Param('instanceId') instanceId: string) {
    return this.oauth.resourceMetadata(instanceId);
  }

  @Post('whatsapp/oauth/register')
  register(@Body() body: Record<string, unknown>) {
    return this.oauth.registerClient(body);
  }

  @Get('whatsapp/oauth/authorize')
  async authorizePage(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const html = await this.oauth.buildAuthorizationPage(query);
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  }

  @Post('whatsapp/oauth/authorize')
  async approve(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const redirect = await this.oauth.approveAuthorization(body);
    res.redirect(302, redirect);
  }

  @Post('whatsapp/oauth/token')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: Record<string, unknown>) {
    return this.oauth.exchangeToken(body);
  }
}
