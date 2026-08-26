import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { DataSource } from 'typeorm';
import { CompanyVerificationEmailService } from './company-verification-email.service';
import { IDENTITY_COMPLIANCE_CONSENT_VERSION } from './identity-compliance.service';

const VALID_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FULL_PERMISSIONS = { companyProfile: true, recruitment: true, marketplace: true, finance: true, team: true };

@Injectable()
export class CompanyVerificationAuthorizationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly email: CompanyVerificationEmailService,
  ) {}

  async create(uid: string, body: Record<string, unknown>) {
    const users = await this.dataSource.query(`SELECT "companyId",COALESCE("socialName","displayName","fullName",email) AS name FROM users WHERE id=$1 LIMIT 1`, [uid]);
    const companyId = users[0]?.companyId;
    if (!companyId) throw new BadRequestException('Sua conta não está vinculada a uma empresa.');
    const membership = await this.primaryAdmin(uid, companyId);
    const companies = await this.dataSource.query(`SELECT id,name,"legalName","cnpjSnapshot" FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
    const company = companies[0];
    if (!company?.cnpjSnapshot) throw new BadRequestException('Consulte e confirme o CNPJ antes de solicitar autorização ao sócio responsável.');

    const partnerName = String(body.partnerName || '').trim().slice(0, 180);
    const partnerEmail = String(body.partnerEmail || '').trim().toLowerCase().slice(0, 255);
    const partnerPhone = String(body.partnerPhone || '').trim().slice(0, 40) || null;
    if (!partnerName || !/^\S+@\S+\.\S+$/.test(partnerEmail)) throw new BadRequestException('Informe nome completo e e-mail válido do sócio responsável.');
    const qsa = Array.isArray(company.cnpjSnapshot?.qsa) ? company.cnpjSnapshot.qsa : [];
    const qsaMember = qsa.find((item: any) => this.normalizeName(item?.name) === this.normalizeName(partnerName));
    if (!qsaMember) throw new BadRequestException('Selecione um nome que conste no QSA retornado pela consulta do CNPJ.');

    const grantFullPowers = body.grantFullPowers !== false;
    const permissions = grantFullPowers ? FULL_PERMISSIONS : this.permissions(body.permissions);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.dataSource.query(
      `UPDATE company_verification_authorizations SET status='REVOKED',"updatedAt"=now()
       WHERE "companyId"=$1 AND status IN ('PENDING','SUBMITTED')`,
      [companyId],
    ).catch(() => undefined);
    const rows = await this.dataSource.query(
      `INSERT INTO company_verification_authorizations
       ("companyId","requestedByUserId","partnerName","partnerEmail","partnerPhone","qsaQualification","tokenHash",permissions,"grantFullPowers","expiresAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING id,status,"expiresAt"`,
      [companyId, uid, partnerName, partnerEmail, partnerPhone, qsaMember?.qualification || null, tokenHash, JSON.stringify(permissions), grantFullPowers, expiresAt],
    );
    const origin = String(process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(/\/$/, '');
    const inviteUrl = `${origin}/empresa/autorizar/${encodeURIComponent(token)}`;
    const mail = await this.email.send({
      to: partnerEmail,
      partnerName,
      companyName: company.name || company.legalName || 'Empresa',
      requestedByName: users[0]?.name || 'Um administrador',
      inviteUrl,
      expiresAt,
    });
    await this.dataSource.query(
      `UPDATE companies SET "complianceStatus"='PENDING',"updatedAt"=now() WHERE id=$1 AND "complianceStatus"<>'APPROVED'`,
      [companyId],
    ).catch(() => undefined);
    return { ...rows[0], inviteUrl: mail.status === 'NOT_CONFIGURED' ? inviteUrl : undefined, emailStatus: mail.status, membershipPermissions: membership.permissions };
  }

  async publicInfo(token: string) {
    const row = await this.byToken(token);
    await this.expireIfNeeded(row);
    const current = await this.byToken(token);
    const companies = await this.dataSource.query(
      `SELECT c.name,c."legalName",c.cnpj,c."registryTradeName",c."legalAddress",c."legalCity",c."legalState",c."cnpjSituation",
              COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS "requestedByName"
       FROM companies c JOIN users u ON u.id=$2 WHERE c.id=$1 LIMIT 1`,
      [current.companyId, current.requestedByUserId],
    );
    const company = companies[0];
    return {
      id: current.id,
      status: current.status,
      partnerName: current.partnerName,
      partnerEmailMasked: this.maskEmail(current.partnerEmail),
      qsaQualification: current.qsaQualification || null,
      grantFullPowers: current.grantFullPowers !== false,
      permissions: current.permissions || {},
      expiresAt: current.expiresAt,
      selfieUploaded: Boolean(current.selfieStorageKey),
      consentVersion: IDENTITY_COMPLIANCE_CONSENT_VERSION,
      company: company ? {
        name: company.name,
        legalName: company.legalName,
        cnpj: company.cnpj,
        registryTradeName: company.registryTradeName,
        legalAddress: company.legalAddress,
        legalCity: company.legalCity,
        legalState: company.legalState,
        cnpjSituation: company.cnpjSituation,
      } : null,
      requestedByName: company?.requestedByName || null,
    };
  }

  async uploadSelfie(token: string, file: Express.Multer.File) {
    const row = await this.byToken(token);
    await this.assertUsable(row);
    if (!file?.buffer?.length) throw new BadRequestException('Selfie não recebida.');
    if (!VALID_IMAGE_MIMES.has(file.mimetype)) throw new BadRequestException('A selfie deve ser JPG, PNG ou WEBP.');
    if (file.size > 12 * 1024 * 1024) throw new BadRequestException('A selfie deve ter no máximo 12 MB.');

    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `company-auth-${row.id}-selfie-${randomBytes(12).toString('hex')}.bin`;
    const dir = this.vaultDir();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const finalPath = join(dir, storageKey);
    const tempPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tempPath, ciphertext, { mode: 0o600 });
    await rename(tempPath, finalPath);
    const previousKey = row.selfieStorageKey || null;
    try {
      await this.dataSource.query(
        `UPDATE company_verification_authorizations SET
          "selfieStorageKey"=$2,"selfieMimeType"=$3,"selfieOriginalName"=$4,"selfieSizeBytes"=$5,
          "selfieSha256"=$6,"selfieIvBase64"=$7,"selfieTagBase64"=$8,"updatedAt"=now()
         WHERE id=$1`,
        [row.id, storageKey, file.mimetype, String(file.originalname || 'selfie').slice(0, 240), file.size, sha256, iv.toString('base64'), tag.toString('base64')],
      );
      if (previousKey && previousKey !== storageKey) await unlink(join(dir, previousKey)).catch(() => undefined);
      return { uploaded: true };
    } catch (error) {
      await unlink(finalPath).catch(() => undefined);
      throw error;
    }
  }

  async accept(token: string, body: Record<string, unknown>) {
    const row = await this.byToken(token);
    await this.assertUsable(row);
    if (!row.selfieStorageKey) throw new BadRequestException('Tire a selfie antes de enviar a autorização.');
    if (body.accepted !== true || String(body.consentVersion || '') !== IDENTITY_COMPLIANCE_CONSENT_VERSION) {
      throw new BadRequestException('Leia e aceite os termos da autorização empresarial.');
    }
    const rows = await this.dataSource.query(
      `UPDATE company_verification_authorizations SET status='SUBMITTED',"consentVersion"=$2,"consentAcceptedAt"=now(),"submittedAt"=now(),"updatedAt"=now()
       WHERE id=$1 RETURNING id,status,"submittedAt"`,
      [row.id, IDENTITY_COMPLIANCE_CONSENT_VERSION],
    );
    return rows[0];
  }

  async adminList(statusRaw?: string) {
    const status = String(statusRaw || 'SUBMITTED').toUpperCase();
    const where = status === 'ALL' ? '' : 'WHERE a.status=$1';
    const params = status === 'ALL' ? [] : [status];
    return this.dataSource.query(
      `SELECT a.id,a.status,a."partnerName",a."partnerEmail",a."partnerPhone",a."qsaQualification",a."grantFullPowers",a.permissions,a."submittedAt",a."expiresAt",
              c.name AS "companyName",c."legalName",c.cnpj,c."verificationStatus",COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS "requestedByName"
       FROM company_verification_authorizations a JOIN companies c ON c.id=a."companyId" JOIN users u ON u.id=a."requestedByUserId"
       ${where} ORDER BY COALESCE(a."submittedAt",a."createdAt") ASC LIMIT 300`,
      params,
    ).catch(() => []);
  }

  async adminDetail(id: string) {
    const rows = await this.dataSource.query(
      `SELECT a.*,c.name AS "companyName",c."legalName",c.cnpj,c."registryTradeName",c."legalAddress",c."legalCity",c."legalState",c."cnpjSituation",c."cnpjSnapshot",
              COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS "requestedByName"
       FROM company_verification_authorizations a JOIN companies c ON c.id=a."companyId" JOIN users u ON u.id=a."requestedByUserId" WHERE a.id=$1 LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Autorização não encontrada.');
    return { ...rows[0], selfieAvailable: Boolean(rows[0].selfieStorageKey), selfieStorageKey: undefined, selfieIvBase64: undefined, selfieTagBase64: undefined, selfieSha256: undefined };
  }

  async adminSelfie(id: string) {
    const rows = await this.dataSource.query(`SELECT * FROM company_verification_authorizations WHERE id=$1 LIMIT 1`, [id]);
    const row = rows[0];
    if (!row?.selfieStorageKey) throw new NotFoundException('Selfie não encontrada.');
    const ciphertext = await readFile(join(this.vaultDir(), row.selfieStorageKey)).catch(() => null);
    if (!ciphertext) throw new NotFoundException('Selfie criptografada não encontrada.');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(row.selfieIvBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(row.selfieTagBase64, 'base64'));
    const buffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (createHash('sha256').update(buffer).digest('hex') !== row.selfieSha256) throw new ServiceUnavailableException('Falha de integridade da selfie.');
    return { buffer, mimeType: row.selfieMimeType || 'image/jpeg', originalName: row.selfieOriginalName || 'selfie.jpg' };
  }

  async adminReview(actorUid: string, id: string, body: Record<string, unknown>) {
    const decision = String(body.decision || '').toUpperCase();
    if (!['APPROVE','REJECT'].includes(decision)) throw new BadRequestException('Decisão inválida.');
    const reason = String(body.reason || '').trim().slice(0, 1500) || null;
    if (decision === 'REJECT' && !reason) throw new BadRequestException('Informe o motivo da reprovação.');
    const rows = await this.dataSource.query(`SELECT * FROM company_verification_authorizations WHERE id=$1 LIMIT 1`, [id]);
    const row = rows[0];
    if (!row || row.status !== 'SUBMITTED') throw new BadRequestException('Esta autorização não está aguardando análise.');
    if (decision === 'APPROVE') {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `UPDATE company_verification_authorizations SET status='APPROVED',"reviewedAt"=now(),"reviewedByUserId"=$2,"reviewReason"=$3,"updatedAt"=now() WHERE id=$1`,
          [id, actorUid, reason],
        );
        await manager.query(
          `UPDATE company_memberships SET role='PRIMARY_ADMIN',"isPartner"=false,permissions=$3::jsonb,status='ACTIVE',"updatedAt"=now()
           WHERE "companyId"=$1 AND "userId"=$2`,
          [row.companyId, row.requestedByUserId, JSON.stringify(row.grantFullPowers ? FULL_PERMISSIONS : row.permissions || {})],
        );
        await manager.query(
          `UPDATE companies SET "verificationStatus"='VERIFIED',"isVerified"=true,"complianceStatus"='APPROVED',"complianceGraceDeadline"=NULL,
           "complianceSuspendedAt"=NULL,"complianceSuspensionReason"=NULL,"updatedAt"=now() WHERE id=$1`,
          [row.companyId],
        );
      });
    } else {
      await this.dataSource.query(
        `UPDATE company_verification_authorizations SET status='REJECTED',"reviewedAt"=now(),"reviewedByUserId"=$2,"reviewReason"=$3,"updatedAt"=now() WHERE id=$1`,
        [id, actorUid, reason],
      );
    }
    return this.adminDetail(id);
  }

  private async byToken(token: string) {
    const hash = createHash('sha256').update(String(token || '')).digest('hex');
    const rows = await this.dataSource.query(`SELECT * FROM company_verification_authorizations WHERE "tokenHash"=$1 LIMIT 1`, [hash]);
    if (!rows[0]) throw new NotFoundException('Link de autorização inválido ou expirado.');
    return rows[0];
  }

  private async assertUsable(row: any) {
    await this.expireIfNeeded(row);
    if (!['PENDING'].includes(row.status)) throw new BadRequestException('Esta autorização não pode mais ser alterada.');
  }

  private async expireIfNeeded(row: any) {
    if (['PENDING'].includes(row.status) && new Date(row.expiresAt).getTime() <= Date.now()) {
      await this.dataSource.query(`UPDATE company_verification_authorizations SET status='EXPIRED',"updatedAt"=now() WHERE id=$1`, [row.id]);
    }
  }

  private async primaryAdmin(uid: string, companyId: string) {
    const rows = await this.dataSource.query(`SELECT * FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND role='PRIMARY_ADMIN' AND status='ACTIVE' LIMIT 1`, [companyId, uid]);
    if (!rows[0]) throw new ForbiddenException('Somente o administrador principal pode solicitar autorização ao sócio responsável.');
    return rows[0];
  }

  private permissions(value: unknown) {
    const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
      companyProfile: source.companyProfile !== false,
      recruitment: source.recruitment === true,
      marketplace: source.marketplace === true,
      finance: source.finance === true,
      team: source.team === true,
    };
  }

  private normalizeName(value: unknown) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  private maskEmail(value: string) {
    const [name, domain] = String(value || '').split('@');
    if (!domain) return '***';
    return `${name?.slice(0, 2) || '*'}***@${domain}`;
  }

  private vaultDir() {
    return resolve(process.env.IDENTITY_VAULT_DIR || '/var/lib/piranegocios/identity-vault');
  }

  private encryptionKey() {
    const raw = String(process.env.IDENTITY_VAULT_ENCRYPTION_KEY || '').trim();
    if (!raw) throw new ServiceUnavailableException('IDENTITY_VAULT_ENCRYPTION_KEY não configurada.');
    const candidates = [Buffer.from(raw, 'base64'), Buffer.from(raw, 'hex')];
    const key = candidates.find((item) => item.length === 32);
    if (!key) throw new ServiceUnavailableException('IDENTITY_VAULT_ENCRYPTION_KEY precisa representar 32 bytes em base64 ou hex.');
    return key;
  }
}
