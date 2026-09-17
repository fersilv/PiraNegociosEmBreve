import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { PdvIntegrationService } from './pdv-integration.service';

@Controller('pdv-integration')
export class PdvIntegrationController {
  constructor(private readonly integration:PdvIntegrationService) {}
  @Post('webhooks') webhook(@Headers() headers:Record<string,string|string[]|undefined>,@Body() body:any){ return this.integration.receiveWebhook(headers,body); }
  @Post('connect') @UseGuards(FirebaseAuthGuard) connect(@Req() req:any,@Body() body:any){ return this.integration.startOAuth(req.user.uid,String(body.companyId||''),body.pdvBaseUrl); }
  @Get('oauth/callback') async callback(@Query('code') code:string,@Query('state') state:string,@Res() res:Response){ const result=await this.integration.finishOAuth(code,state); res.redirect(302,`${this.integration.publicBaseUrl()}/company/integracoes/pdv?connected=1&companyId=${encodeURIComponent(result.companyId)}`); }
  @Get('status') @UseGuards(FirebaseAuthGuard) status(@Req() req:any,@Query('companyId') companyId:string){ return this.integration.status(req.user.uid,companyId); }
  @Patch('settings') @UseGuards(FirebaseAuthGuard) settings(@Req() req:any,@Body() body:any){ return this.integration.updateSettings(req.user.uid,String(body.companyId||''),body); }
  @Delete('connection') @UseGuards(FirebaseAuthGuard) disconnect(@Req() req:any,@Query('companyId') companyId:string){ return this.integration.disconnect(req.user.uid,companyId); }
  @Get('products') @UseGuards(FirebaseAuthGuard) products(@Req() req:any,@Query('companyId') companyId:string){ return this.integration.products(req.user.uid,companyId); }
  @Post('products/link-existing') @UseGuards(FirebaseAuthGuard) link(@Req() req:any,@Body() body:any){ return this.integration.linkExisting(req.user.uid,String(body.companyId||''),body); }
  @Post('products/:pdvProductId/resolve') @UseGuards(FirebaseAuthGuard) resolve(@Req() req:any,@Param('pdvProductId') pdvProductId:string,@Body() body:any){ return this.integration.resolveConflict(req.user.uid,String(body.companyId||''),pdvProductId,body.strategy); }
  @Patch('products/:pdvProductId') @UseGuards(FirebaseAuthGuard) productSettings(@Req() req:any,@Param('pdvProductId') pdvProductId:string,@Body() body:any){ return this.integration.configureProduct(req.user.uid,String(body.companyId||''),pdvProductId,body); }
  @Post('sync') @UseGuards(FirebaseAuthGuard) sync(@Req() req:any,@Body() body:any){ return this.integration.sync(req.user.uid,String(body.companyId||''),body,'MANUAL'); }
  @Get('local-products') @UseGuards(FirebaseAuthGuard) localProducts(@Req() req:any,@Query('companyId') companyId:string){ return this.integration.localProducts(req.user.uid,companyId); }
  @Post('push') @UseGuards(FirebaseAuthGuard) push(@Req() req:any,@Body() body:any){ return this.integration.pushProducts(req.user.uid,String(body.companyId||''),Array.isArray(body.listingIds)?body.listingIds:undefined); }
  @Post('push/:listingId') @UseGuards(FirebaseAuthGuard) pushOne(@Req() req:any,@Param('listingId') listingId:string,@Body() body:any){ return this.integration.pushProduct(req.user.uid,String(body.companyId||''),listingId); }
  @Get('sales') @UseGuards(FirebaseAuthGuard) sales(@Req() req:any,@Query('companyId') companyId:string,@Query('updatedSince') updatedSince?:string){ return this.integration.sales(req.user.uid,companyId,updatedSince); }
  @Post('sales/sync') @UseGuards(FirebaseAuthGuard) syncSales(@Req() req:any,@Body() body:any){ return this.integration.syncSales(req.user.uid,String(body.companyId||'')); }
}
