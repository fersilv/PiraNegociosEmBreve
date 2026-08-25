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
import { OAuthBrokerService } from './oauth-broker.service';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';

@Controller()
export class WhatsAppOAuthController {
  constructor(
    private readonly oauth: WhatsAppOAuthService,
    private readonly broker: OAuthBrokerService,
  ) {}

  @Get('.well-known/oauth-protected-resource/api/whatsapp/mcp/:instanceId')
  standardResourceMetadata(@Param('instanceId') instanceId: string) {
    return this.oauth.resourceMetadata(instanceId);
  }

  @Get('whatsapp/oauth/resource/:instanceId')
  resourceMetadata(@Param('instanceId') instanceId: string) {
    return this.oauth.resourceMetadata(instanceId);
  }

  // Mantido por compatibilidade com clientes que já descobriram o endpoint
  // antigo. O registro agora cria um client_id compartilhado entre os MCPs.
  @Post('whatsapp/oauth/register')
  register(@Body() body: Record<string, unknown>) {
    return this.broker.registerClient(body);
  }

  // Compatibilidade: URLs OAuth antigas do WhatsApp também despacham para
  // Vagas quando o parâmetro resource aponta para /api/jobs/mcp.
  @Get('whatsapp/oauth/authorize')
  async authorizePage(
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const html = await this.broker.buildAuthorizationPage(query);
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  }

  @Post('whatsapp/oauth/authorize')
  async approve(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const redirect = await this.broker.approveAuthorization(body);
    res.redirect(302, redirect);
  }

  @Post('whatsapp/oauth/token')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: Record<string, unknown>) {
    return this.broker.exchangeToken(body);
  }
}
