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

const COMPANY_PERMISSION_KEYS = ['companyProfile', 'recruitment', 'marketplace', 'finance', 'team'] as const;

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
    await this.assertPermission(req.user.uid, companyId, 'companyProfile');
    const snapshot = await this.cnpj.lookup(cnpj);
    const applied = await this.cnpj.applyToCompany(companyId, snapshot);
    return { snapshot, changes: applied.changes };
  }

  @Patch('commercial-profile')
  async commercialProfile(@Req() req: any, @Body() body: Record<string, unknown>) {
    const companyId = await this.companyId(req.user.uid);
    await this.assertPermission(req.user.uid, companyId, 'companyProfile');
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
    const cleanLines = (value: unknown, maxItems: number, maxLength: number) => (Array.isArray(value) ? value : [])
      .map((item) => String(item || '').trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems);
    const rapi10CatalogOptIn = body.rapi10CatalogOptIn !== false;
    const businessHoursJson = cleanLines(body.businessHoursJson, 14, 160);
    const specialBusinessDatesJson = cleanLines(body.specialBusinessDatesJson, 40, 220);
    const servicesTagsJson = cleanLines(body.servicesTagsJson, 40, 120);
    const rows = await this.dataSource.query(
      `UPDATE companies SET name=$2::varchar,"commercialAddressSameAsLegal"=$3::boolean,address=$4::varchar,city=$5::varchar,state=$6::varchar,
       "cityState"=concat_ws(', ',NULLIF($5::varchar,''),NULLIF($6::varchar,'')),"rapi10CatalogOptIn"=$7::boolean,
       "businessHoursJson"=$8::jsonb,"specialBusinessDatesJson"=$9::jsonb,"servicesTagsJson"=$10::jsonb,"updatedAt"=now()
       WHERE id=$1 RETURNING id,name,address,city,state,"cityState","commercialAddressSameAsLegal","rapi10CatalogOptIn","businessHoursJson","specialBusinessDatesJson","servicesTagsJson"`,
      [companyId, name, same, address, city, state, rapi10CatalogOptIn, JSON.stringify(businessHoursJson), JSON.stringify(specialBusinessDatesJson), JSON.stringify(servicesTagsJson)],
    );
    return rows[0];
  }

  @Get('team')
  async team(@Req() req: any) {
    const companyId = await this.companyId(req.user.uid);
    await this.assertPermission(req.user.uid, companyId, 'team');
    return this.dataSource.query(
      `SELECT m.id,m."userId",m.role,m."isPartner",m.permissions,m.status,m."createdAt",m."updatedAt",
              COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS name,u.email,u."whatsappPhoneE164",u.phone
       FROM company_memberships m JOIN users u ON u.id=m."userId"
       WHERE m."companyId"=$1 AND m.status='ACTIVE'
       ORDER BY CASE m.role WHEN 'PRIMARY_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,name ASC`,
      [companyId],
    ).catch(() => []);
  }

  @Patch('team/:userId/permissions')
  async teamPermissions(@Req() req: any, @Param('userId') userId: string, @Body() body: Record<string, unknown>) {
    const companyId = await this.companyId(req.user.uid);
    const actor = await this.primaryAdmin(req.user.uid, companyId);
    if (actor.userId === userId) throw new BadRequestException('O administrador principal não pode remover os próprios poderes por esta tela.');
    const permissions = this.cleanPermissions(body.permissions);
    const role = String(body.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
    const rows = await this.dataSource.query(
      `UPDATE company_memberships SET role=$3,permissions=$4::jsonb,"updatedAt"=now()
       WHERE "companyId"=$1 AND "userId"=$2 AND role<>'PRIMARY_ADMIN' AND status='ACTIVE' RETURNING *`,
      [companyId, userId, role, JSON.stringify(permissions)],
    );
    if (!rows[0]) throw new BadRequestException('Pessoa não encontrada na equipe ou vínculo não editável.');
    await this.dataSource.query(
      `UPDATE users SET "isCompanyAdmin"=$3 WHERE id=$2 AND "companyId"=$1`,
      [companyId, userId, role === 'ADMIN'],
    ).catch(() => undefined);
    return rows[0];
  }

  @Post('responsible-authorization')
  createAuthorization(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.authorizations.create(req.user.uid, body || {});
  }

  @Get('responsible-authorizations')
  async myAuthorizations(@Req() req: any) {
    const companyId = await this.companyId(req.user.uid);
    await this.assertPermission(req.user.uid, companyId, 'companyProfile');
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

  private async membership(uid: string, companyId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND status='ACTIVE' LIMIT 1`,
      [companyId, uid],
    ).catch(() => []);
    return rows[0] || null;
  }

  private async primaryAdmin(uid: string, companyId: string) {
    const membership = await this.membership(uid, companyId);
    if (!membership || membership.role !== 'PRIMARY_ADMIN') throw new BadRequestException('Somente o administrador principal pode alterar permissões da equipe.');
    return membership;
  }

  private async assertPermission(uid: string, companyId: string, permission: typeof COMPANY_PERMISSION_KEYS[number]) {
    const membership = await this.membership(uid, companyId);
    if (!membership) throw new BadRequestException('Seu vínculo com a empresa não está ativo.');
    if (membership.role === 'PRIMARY_ADMIN' || membership.permissions?.[permission] === true) return membership;
    throw new BadRequestException('Seu perfil não tem permissão para esta área da empresa.');
  }

  private cleanPermissions(value: unknown) {
    const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.fromEntries(COMPANY_PERMISSION_KEYS.map((key) => [key, input[key] === true]));
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
  async selfie(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const file = await this.authorizations.adminSelfie(id, req.user.uid, req.ip || req.socket?.remoteAddress || '');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${String(file.originalName || 'selfie.jpg').replace(/[\r\n"\\/]/g, '_')}"`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  }

  @Post(':id/review')
  review(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.authorizations.adminReview(req.user.uid, id, body || {});
  }
}
