import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { OAuthBrokerService } from './oauth-broker.service';

@Controller()
export class OAuthBrokerController {
  constructor(private readonly broker: OAuthBrokerService) {}

  @Get('.well-known/oauth-authorization-server')
  authorizationServerMetadata() {
    return this.broker.authorizationServerMetadata();
  }

  @Get('.well-known/openid-configuration')
  openIdConfiguration() {
    return this.broker.authorizationServerMetadata();
  }

  @Post('oauth/register')
  register(@Body() body: Record<string, unknown>) {
    return this.broker.registerClient(body);
  }

  @Get('oauth/authorize')
  async authorizePage(
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const html = await this.broker.buildAuthorizationPage(query);
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  }

  @Post('oauth/authorize')
  async approve(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const redirect = await this.broker.approveAuthorization(body);
    res.redirect(302, redirect);
  }

  @Post('oauth/token')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: Record<string, unknown>) {
    return this.broker.exchangeToken(body);
  }
}
