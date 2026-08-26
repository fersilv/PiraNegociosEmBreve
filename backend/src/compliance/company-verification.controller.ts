import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CnpjLookupService } from './cnpj-lookup.service';
import { CompanyVerificationAuthorizationService } from './company-verification-authorization.service';

@Controller('compliance/company')
@UseGuards(FirebaseAuthGuard)
export class CompanyVerificationController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cnpj: CnpjLookupService,
    private readonly authorizations: CompanyVerificationAuthorizationService,
  ) {}

  @Get('cnpj-preview/:cnpj')
  preview(@Param('cnpj') cnpj: string) {
    return this.cnpj.lookup(cnpj);
  }

  @Get('cnpj/:cnpj')
  async lookup(@Req() req: any, @Param('cnpj') cnpj: string) {
    const companyId = await this.companyId(req.user.uid);
    const snapshot = await this.cnpj.lookup(cnpj);
    const applied = await this.cnpj.applyToCompany(companyId, snapshot);
    return { snapshot, changes: applied.changes };
  }

  @Patch('commercial-profile')
  async commercialProfile(@Req() req: any, @Body() body: Record<string, unknown>) {
    const companyId = await this.companyId(req.user.uid);
    const memberships = await this.dataSource.query(
      `SELECT role,permissions FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND status='ACTIVE' LIMIT 1`,
      [companyId, req.user.uid],
    ).catch(() => []);
    const membership = memberships[0];
    if (!membership || (membership.role !== 'PRIMARY_ADMIN' && membership.permissions?.companyProfile !== true)) {
      throw new BadRequestException('Seu perfil não tem permissão para editar os dados comerciais da empresa.');
    }
    const companies = await this.dataSource.query(
      `SELECT "legalAddress","legalCity","legalState" FROM companies WHERE id=$1 LIMIT 1`,
      [companyId],
    );
    const company = companies[0];
    const same = body.commercialAddressSameAsLegal !== false;
    const name = String(body.name || '').trim().slice(0, 240);
    if (!name) throw new BadRequestException('Informe o nome comercial da empresa.');
    const address = same ? String(company?.legalAddress || '') : String(body.address || '').trim().slice(0, 500);
    const city = same ? String(company?.legalCity || '') : String(body.city || '').trim().slice(0, 120);
    const state = (same ? String(company?.legalState || '') : String(body.state || '')).trim().toUpperCase().slice(0, 2);
    if (!address || !city || state.length !== 2) throw new BadRequestException('Informe o endereço comercial completo.');
    const rows = await this.dataSource.query(
      `UPDATE companies SET name=$2,"commercialAddressSameAsLegal"=$3,address=$4,city=$5,state=$6,"cityState"=concat_ws('/',NULLIF($5,''),NULLIF($6,'')),"updatedAt"=now()
       WHERE id=$1 RETURNING id,name,address,city,state,"commercialAddressSameAsLegal"`,
      [companyId, name, same, address, city, state],
    );
    return rows[0];
  }

  @Post('responsible-authorization')
  createAuthorization(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.authorizations.create(req.user.uid, body || {});
  }

  @Get('responsible-authorizations')
  async myAuthorizations(@Req() req: any) {
    const companyId = await this.companyId(req.user.uid);
    return this.dataSource.query(
      `SELECT id,"partnerName","partnerEmail","partnerPhone","qsaQualification",status,"grantFullPowers",permissions,"submittedAt","reviewedAt","reviewReason","expiresAt","createdAt"
       FROM company_verification_authorizations WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 50`,
      [companyId],
    ).catch(() => []);
  }

  private async companyId(uid: string) {
    const users = await this.dataSource.query(`SELECT "companyId" FROM users WHERE id=$1 LIMIT 1`, [uid]);
    const companyId = users[0]?.companyId;
    if (!companyId) throw new BadRequestException('Conta sem empresa vinculada.');
    return companyId as string;
  }
}

@Controller('company-verification')
export class CompanyVerificationPublicController {
  constructor(private readonly authorizations: CompanyVerificationAuthorizationService) {}

  @Get(':token')
  info(@Param('token') token: string) {
    return this.authorizations.publicInfo(token);
  }

  @Post(':token/selfie')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } }))
  selfie(@Param('token') token: string, @UploadedFile() file: Express.Multer.File) {
    return this.authorizations.uploadSelfie(token, file);
  }

  @Post(':token/accept')
  accept(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.authorizations.accept(token, body || {});
  }
}

@Controller('admin/compliance/company-authorizations')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class CompanyVerificationAdminController {
  constructor(private readonly authorizations: CompanyVerificationAuthorizationService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.authorizations.adminList(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.authorizations.adminDetail(id);
  }

  @Get(':id/selfie')
  async selfie(@Param('id') id: string, @Res() res: Response) {
    const file = await this.authorizations.adminSelfie(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${String(file.originalName || 'selfie.jpg').replace(/[\r\n"\\/]/g, '_')}"`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  }

  @Post(':id/review')
  review(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.authorizations.adminReview(req.user.uid, id, body || {});
  }
}
