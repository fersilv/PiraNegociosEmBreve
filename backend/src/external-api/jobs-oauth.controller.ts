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

  private sharedAuthorizationServerMetadata() {
    const base = this.oauth.publicBaseUrl();
    return {
      ...this.oauth.authorizationServerMetadata(),
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      service_documentation: `${base}/admin/api`,
    };
  }

  private sharedResourceMetadata() {
    return {
      ...this.oauth.resourceMetadata(),
      authorization_servers: [this.oauth.publicBaseUrl()],
    };
  }

  @Get('.well-known/oauth-authorization-server/jobs')
  authorizationServerMetadata() {
    return this.sharedAuthorizationServerMetadata();
  }

  @Get('.well-known/openid-configuration/jobs')
  openIdConfiguration() {
    return this.sharedAuthorizationServerMetadata();
  }

  @Get('.well-known/oauth-protected-resource/api/jobs/mcp')
  standardResourceMetadata() {
    return this.sharedResourceMetadata();
  }

  @Get('jobs/oauth/resource')
  resourceMetadata() {
    return this.sharedResourceMetadata();
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
    const redirect = new URL(await this.oauth.approveAuthorization(body));
    redirect.searchParams.set('iss', this.oauth.publicBaseUrl());
    res.redirect(302, redirect.toString());
  }

  @Post('jobs/oauth/token')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: Record<string, unknown>) {
    return this.oauth.exchangeToken(body);
  }
}
