import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CompanyMcpOAuthService } from './company-mcp-oauth.service';

@Controller()
export class CompanyMcpOAuthController {
  constructor(private readonly oauth: CompanyMcpOAuthService) {}

  @Get('.well-known/oauth-authorization-server/company')
  authorizationServerMetadata() {
    return this.oauth.authorizationServerMetadata();
  }

  @Get('.well-known/openid-configuration/company')
  openIdConfiguration() {
    return this.oauth.authorizationServerMetadata();
  }

  @Get('.well-known/oauth-protected-resource/api/company/mcp')
  resourceMetadata() {
    return this.oauth.resourceMetadata();
  }

  @Get('company/oauth/resource')
  resourceMetadataAlias() {
    return this.oauth.resourceMetadata();
  }

  @Post('company/oauth/register')
  register(@Body() body: Record<string, unknown>) {
    return this.oauth.registerClient(body || {});
  }

  @Post('company/mcp/connection-code')
  @UseGuards(FirebaseAuthGuard)
  createConnectionCode(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.oauth.createConnectionCode(req.user.uid, body?.scopes);
  }

  @Get('company/oauth/authorize')
  async authorizePage(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const html = await this.oauth.buildAuthorizationPage(query);
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  }

  @Post('company/oauth/authorize')
  async approve(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const redirect = await this.oauth.approveAuthorization(body);
    res.redirect(302, redirect);
  }

  @Post('company/oauth/token')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: Record<string, unknown>) {
    return this.oauth.exchangeToken(body || {});
  }
}
