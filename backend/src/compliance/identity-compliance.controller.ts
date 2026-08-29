import {
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
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CompanyContextRepairService } from './company-context-repair.service';
import { IdentityComplianceService } from './identity-compliance.service';

@Controller('compliance')
@UseGuards(FirebaseAuthGuard)
export class IdentityComplianceController {
  constructor(
    private readonly compliance: IdentityComplianceService,
    private readonly companyContext: CompanyContextRepairService,
  ) {}

  @Get('me')
  async me(@Req() req: any) {
    const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
    await this.companyContext.repair(userId);
    return this.compliance.myStatus(userId);
  }

  @Patch('me/profile')
  async profile(@Req() req: any, @Body() body: Record<string, unknown>) {
    const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
    await this.companyContext.repair(userId);
    return this.compliance.saveProfile(userId, body || {});
  }

  @Patch('me/company-partners')
  async partners(@Req() req: any, @Body() body: any) {
    const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
    await this.companyContext.repair(userId);
    return this.compliance.replacePartners(userId, body?.partners);
  }

  @Post('me/documents/:kind')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } }))
  async upload(
    @Req() req: any,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
    await this.companyContext.repair(userId);
    return this.compliance.uploadDocument(userId, kind, file, body || {});
  }

  @Post('me/submit')
  async submit(@Req() req: any, @Body() body: Record<string, unknown>) {
    const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
    await this.companyContext.repair(userId);
    return this.compliance.submit(userId, body || {});
  }
}

@Controller('admin/compliance')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class IdentityComplianceAdminController {
  constructor(private readonly compliance: IdentityComplianceService) {}

  @Get('verifications')
  list(@Query('status') status?: string) {
    return this.compliance.adminList(status);
  }

  @Get('verifications/:id')
  detail(@Param('id') id: string) {
    return this.compliance.adminDetail(id);
  }

  @Get('documents/:documentId')
  async document(@Req() req: any, @Param('documentId') documentId: string, @Res() res: Response) {
    const file = await this.compliance.readDocument(req.user.uid, documentId, req.ip || req.socket?.remoteAddress || '');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName(file.originalName)}"`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  }

  @Post('verifications/:id/review')
  review(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.compliance.adminReview(req.user.uid, id, body || {});
  }
}

function safeFileName(value: string) {
  return String(value || 'documento').replace(/[\r\n"\\/]/g, '_').slice(0, 180);
}
