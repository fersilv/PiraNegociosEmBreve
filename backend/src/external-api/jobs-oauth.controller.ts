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
import { JobsOAuthService } from './jobs-oauth.service';

@Controller()
export class JobsOAuthController {
  constructor(private readonly oauth: JobsOAuthService) {}

  @Get('.well-known/oauth-authorization-server/jobs')
  authorizationServerMetadata() {
    return this.oauth.authorizationServerMetadata();
  }

  @Get('.well-known/openid-configuration/jobs')
  openIdConfiguration() {
    return this.oauth.authorizationServerMetadata();
  }

  @Get('.well-known/oauth-protected-resource/api/jobs/mcp')
  standardResourceMetadata() {
    return this.oauth.resourceMetadata();
  }

  @Get('jobs/oauth/resource')
  resourceMetadata() {
    return this.oauth.resourceMetadata();
  }

  @Post('jobs/oauth/register')
  register(@Body() body: Record<string, unknown>) {
    return this.oauth.registerClient(body);
  }

  @Get('jobs/oauth/authorize')
  async authorizePage(
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const html = await this.oauth.buildAuthorizationPage(query);
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  }

  @Post('jobs/oauth/authorize')
  async approve(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const redirect = await this.oauth.approveAuthorization(body);
    res.redirect(302, redirect);
  }

  @Post('jobs/oauth/token')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: Record<string, unknown>) {
    return this.oauth.exchangeToken(body);
  }
}
