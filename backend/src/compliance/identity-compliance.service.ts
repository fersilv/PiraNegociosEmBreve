import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { DataSource } from 'typeorm';

export const IDENTITY_COMPLIANCE_CONSENT_VERSION = '2026-08-26';
const REQUIRED_PERSONAL_DOCUMENTS = ['SELFIE', 'ID_FRONT', 'ADDRESS_PROOF'] as const;
const VALID_DOCUMENT_KINDS = new Set(['SELFIE', 'ID_FRONT', 'ID_BACK', 'ADDRESS_PROOF', 'REPRESENTATION_PROOF']);
const VALID_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

type VerificationContext = 'PERSONAL' | 'COMPANY';
type Relationship = 'PERSONAL' | 'EMPLOYEE' | 'PARTNER';

@Injectable()
export class IdentityComplianceService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.enforceCompanyDeadlines().catch(() => undefined), 60 * 60 * 1000);
    this.timer.unref?.();
    void this.enforceCompanyDeadlines().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async myStatus(uid: string) {
    const users = await this.dataSource.query(
      `SELECT u.id,u.email,u."displayName",u."fullName",u."socialName",u.phone,u."whatsappPhoneE164",u."companyId",
              c.name AS "companyName",c."verificationStatus",c."isVerified",c."complianceStatus",c."complianceGraceDeadline"
       FROM users u LEFT JOIN companies c ON c.id=u."companyId" WHERE u.id=$1 LIMIT 1`,
      [uid],
    );
    const user = users[0];
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const verifications = await this.dataSource.query(
      `SELECT v.*,COALESCE(d.docs,'[]'::json) AS documents
       FROM identity_verifications v
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object('id',id,'kind',kind,'mimeType',"mimeType",'originalName',"originalName",'sizeBytes',"sizeBytes",'uploadedAt',"uploadedAt") ORDER BY "uploadedAt") AS docs
         FROM identity_verification_documents WHERE "verificationId"=v.id
       ) d ON true
       WHERE v."userId"=$1 ORDER BY v."createdAt" DESC`,
      [uid],
    ).catch(() => []);
    const membership = user.companyId ? (await this.dataSource.query(
      `SELECT * FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND status='ACTIVE' LIMIT 1`,
      [user.companyId, uid],
    ).catch(() => []))[0] || null : null;
    const partners = user.companyId ? await this.dataSource.query(
      `SELECT id,name,email,phone,"participationPercentage","hasAdministrativePowers","isBeneficialOwner","confirmationStatus","createdAt"
       FROM company_partner_declarations WHERE "companyId"=$1 ORDER BY "participationPercentage" DESC,name ASC`,
      [user.companyId],
    ).catch(() => []) : [];
    return {
      consentVersion: IDENTITY_COMPLIANCE_CONSENT_VERSION,
      user: {
        id: user.id,
        name: user.socialName || user.displayName || user.fullName || null,
        email: user.email || null,
        phone: user.whatsappPhoneE164 || user.phone || null,
      },
      company: user.companyId ? {
        id: user.companyId,
        name: user.companyName,
        verified: Boolean(user.isVerified || user.verificationStatus === 'VERIFIED'),
        verificationStatus: user.verificationStatus,
        complianceStatus: user.complianceStatus,
        graceDeadline: user.complianceGraceDeadline,
        membership,
        partners,
      } : null,
      verifications: verifications.map((row: any) => this.presentVerification(row)),
    };
  }

  async saveProfile(uid: string, body: Record<string, unknown>) {
    const context = this.context(body.context);
    const companyId = context === 'COMPANY' ? await this.companyForUser(uid) : null;
    const relationship = this.relationship(body.relationship, context);
    const partnerPercentage = relationship === 'PARTNER' ? this.percentage(body.partnerPercentage) : null;
    const declaresRepresentationPowers = relationship === 'PARTNER' && body.declaresRepresentationPowers === true;
    if (context === 'COMPANY' && relationship === 'PARTNER' && !declaresRepresentationPowers) {
      throw new BadRequestException('Confirme que possui poderes para representar a empresa ou autorização válida para agir em nome dela.');
    }
    const row = await this.upsertVerification(uid, companyId, context);
    if (['PENDING','APPROVED'].includes(row.status)) throw new BadRequestException('Esta verificação já foi enviada e não pode ser alterada agora.');
    const rows = await this.dataSource.query(
      `UPDATE identity_verifications SET relationship=$2,"partnerPercentage"=$3,"declaresRepresentationPowers"=$4,"updatedAt"=now()
       WHERE id=$1 RETURNING *`,
      [row.id, relationship, partnerPercentage, declaresRepresentationPowers],
    );
    return this.presentVerification(rows[0]);
  }

  async replacePartners(uid: string, partnersRaw: unknown) {
    const companyId = await this.companyForUser(uid);
    await this.assertPrimaryAdmin(uid, companyId);
    const partners = Array.isArray(partnersRaw) ? partnersRaw.slice(0, 40) : [];
    const cleaned = partners.map((item: any) => ({
      name: String(item?.name || '').trim().slice(0, 180),
      email: String(item?.email || '').trim().toLowerCase().slice(0, 255) || null,
      phone: String(item?.phone || '').trim().slice(0, 40) || null,
      participationPercentage: this.percentage(item?.participationPercentage),
      hasAdministrativePowers: item?.hasAdministrativePowers === true,
    }));
    if (cleaned.some((item) => !item.name)) throw new BadRequestException('Informe o nome de cada sócio declarado.');
    const total = cleaned.reduce((sum, item) => sum + Number(item.participationPercentage || 0), 0);
    if (total > 100.0001) throw new BadRequestException('A soma das participações societárias não pode ultrapassar 100%.');
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM company_partner_declarations WHERE "companyId"=$1 AND "declaredByUserId"=$2`, [companyId, uid]);
      for (const item of cleaned) {
        await manager.query(
          `INSERT INTO company_partner_declarations
           ("companyId","declaredByUserId",name,email,phone,"participationPercentage","hasAdministrativePowers","isBeneficialOwner")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [companyId, uid, item.name, item.email, item.phone, item.participationPercentage, item.hasAdministrativePowers, Number(item.participationPercentage) > 25],
        );
      }
    });
    return this.myStatus(uid);
  }

  async uploadDocument(uid: string, kindRaw: string, file: Express.Multer.File, body: Record<string, unknown>) {
    const kind = String(kindRaw || '').trim().toUpperCase();
    if (!VALID_DOCUMENT_KINDS.has(kind)) throw new BadRequestException('Tipo de documento inválido.');
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo não recebido.');
    if (!VALID_MIMES.has(file.mimetype)) throw new BadRequestException('Envie JPG, PNG, WEBP ou PDF.');
    if (file.size > 12 * 1024 * 1024) throw new BadRequestException('O arquivo deve ter no máximo 12 MB.');
    const context = this.context(body.context);
    const companyId = context === 'COMPANY' ? await this.companyForUser(uid) : null;
    const verification = await this.upsertVerification(uid, companyId, context);
    if (['PENDING','APPROVED'].includes(verification.status)) throw new BadRequestException('Esta verificação já foi enviada.');

    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `${verification.id}-${kind.toLowerCase()}-${randomBytes(12).toString('hex')}.bin`;
    const dir = this.vaultDir();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const finalPath = join(dir, storageKey);
    const tempPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tempPath, ciphertext, { mode: 0o600 });
    await rename(tempPath, finalPath);

    try {
      const existing = await this.dataSource.query(
        `SELECT id,"storageKey" FROM identity_verification_documents WHERE "verificationId"=$1 AND kind=$2 LIMIT 1`,
        [verification.id, kind],
      );
      const rows = await this.dataSource.query(
        `INSERT INTO identity_verification_documents
         ("verificationId",kind,"storageKey","mimeType","originalName","sizeBytes",sha256,"ivBase64","tagBase64")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT ("verificationId",kind) DO UPDATE SET
           "storageKey"=EXCLUDED."storageKey","mimeType"=EXCLUDED."mimeType","originalName"=EXCLUDED."originalName",
           "sizeBytes"=EXCLUDED."sizeBytes",sha256=EXCLUDED.sha256,"ivBase64"=EXCLUDED."ivBase64","tagBase64"=EXCLUDED."tagBase64","uploadedAt"=now()
         RETURNING id,kind,"mimeType","originalName","sizeBytes","uploadedAt"`,
        [verification.id, kind, storageKey, file.mimetype, String(file.originalname || kind).slice(0, 240), file.size, sha256, iv.toString('base64'), tag.toString('base64')],
      );
      if (existing[0]?.storageKey && existing[0].storageKey !== storageKey) {
        await unlink(join(dir, existing[0].storageKey)).catch(() => undefined);
      }
      return rows[0];
    } catch (error) {
      await unlink(finalPath).catch(() => undefined);
      throw error;
    }
  }

  async submit(uid: string, body: Record<string, unknown>) {
    const context = this.context(body.context);
    const companyId = context === 'COMPANY' ? await this.companyForUser(uid) : null;
    const verification = await this.upsertVerification(uid, companyId, context);
    if (verification.status === 'APPROVED') return this.presentVerification(verification);
    const documents = await this.dataSource.query(
      `SELECT kind FROM identity_verification_documents WHERE "verificationId"=$1`,
      [verification.id],
    );
    const kinds = new Set(documents.map((item: any) => item.kind));
    const missing = REQUIRED_PERSONAL_DOCUMENTS.filter((kind) => !kinds.has(kind));
    if (missing.length) throw new BadRequestException(`Envie os documentos obrigatórios antes de solicitar análise: ${missing.join(', ')}.`);
    if (context === 'COMPANY') {
      if (!['EMPLOYEE','PARTNER'].includes(verification.relationship)) throw new BadRequestException('Informe se você é sócio(a) ou funcionário(a) da empresa.');
      if (verification.relationship === 'PARTNER' && verification.declaresRepresentationPowers !== true) {
        throw new BadRequestException('Sócio responsável precisa declarar poderes de representação ou autorização válida.');
      }
      const membership = await this.assertMembership(uid, companyId!);
      if (membership.role === 'PRIMARY_ADMIN' && verification.relationship !== 'PARTNER') {
        throw new BadRequestException('O administrador principal que valida a empresa precisa ser sócio(a)/representante.');
      }
    }
    if (body.accepted !== true || String(body.consentVersion || '') !== IDENTITY_COMPLIANCE_CONSENT_VERSION) {
      throw new BadRequestException('Leia e aceite a versão vigente dos termos de verificação cadastral.');
    }
    const rows = await this.dataSource.query(
      `UPDATE identity_verifications SET status='PENDING',"consentVersion"=$2,"consentAcceptedAt"=now(),"submittedAt"=now(),
       "reviewedAt"=NULL,"reviewedByUserId"=NULL,"reviewReason"=NULL,"updatedAt"=now() WHERE id=$1 RETURNING *`,
      [verification.id, IDENTITY_COMPLIANCE_CONSENT_VERSION],
    );
    if (context === 'COMPANY' && companyId) {
      await this.dataSource.query(
        `UPDATE companies SET "complianceStatus"='PENDING',"complianceSuspensionReason"=NULL WHERE id=$1 AND "complianceStatus" IN ('NOT_STARTED','GRACE','REJECTED','SUSPENDED')`,
        [companyId],
      );
    }
    return this.presentVerification(rows[0]);
  }

  async adminList(statusRaw?: string) {
    const status = String(statusRaw || 'PENDING').toUpperCase();
    const filter = status === 'ALL' ? '' : `WHERE v.status=$1`;
    const params = status === 'ALL' ? [] : [status];
    return this.dataSource.query(
      `SELECT v.id,v."userId",v."companyId",v.context,v.relationship,v."partnerPercentage",v.status,v."submittedAt",v."createdAt",
              COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS "userName",u.email,u.phone,u."whatsappPhoneE164",
              c.name AS "companyName",c."verificationStatus" AS "companyVerificationStatus",c."complianceStatus",c."complianceGraceDeadline",
              COALESCE(dc.count,0)::int AS "documentCount"
       FROM identity_verifications v JOIN users u ON u.id=v."userId" LEFT JOIN companies c ON c.id=v."companyId"
       LEFT JOIN LATERAL (SELECT count(*) AS count FROM identity_verification_documents d WHERE d."verificationId"=v.id) dc ON true
       ${filter} ORDER BY CASE v.status WHEN 'PENDING' THEN 0 WHEN 'NEEDS_CHANGES' THEN 1 ELSE 2 END,COALESCE(v."submittedAt",v."createdAt") ASC LIMIT 500`,
      params,
    );
  }

  async adminDetail(verificationId: string) {
    const rows = await this.dataSource.query(
      `SELECT v.*,COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS "userName",u.email,u.phone,u."whatsappPhoneE164",u.city,u.state,u.address,
              c.name AS "companyName",c.cnpj,c.cpf,c.address AS "companyAddress",c.city AS "companyCity",c.state AS "companyState",
              c."verificationStatus" AS "companyVerificationStatus",c."isVerified",c."complianceStatus",c."complianceGraceDeadline",
              m.role AS "membershipRole",m."isPartner",m.permissions
       FROM identity_verifications v JOIN users u ON u.id=v."userId" LEFT JOIN companies c ON c.id=v."companyId"
       LEFT JOIN company_memberships m ON m."companyId"=v."companyId" AND m."userId"=v."userId" AND m.status='ACTIVE'
       WHERE v.id=$1 LIMIT 1`,
      [verificationId],
    );
    if (!rows[0]) throw new NotFoundException('Verificação não encontrada.');
    const [documents, partners, logs] = await Promise.all([
      this.dataSource.query(
        `SELECT id,kind,"mimeType","originalName","sizeBytes",sha256,"uploadedAt" FROM identity_verification_documents WHERE "verificationId"=$1 ORDER BY kind`,
        [verificationId],
      ),
      rows[0].companyId ? this.dataSource.query(
        `SELECT id,name,email,phone,"participationPercentage","hasAdministrativePowers","isBeneficialOwner","confirmationStatus" FROM company_partner_declarations WHERE "companyId"=$1 ORDER BY "participationPercentage" DESC`,
        [rows[0].companyId],
      ) : Promise.resolve([]),
      this.dataSource.query(
        `SELECT l.id,l."documentId",l."actorUserId",l.action,l."createdAt",COALESCE(u."displayName",u."fullName",u.email) AS "actorName"
         FROM compliance_document_access_logs l LEFT JOIN users u ON u.id=l."actorUserId"
         JOIN identity_verification_documents d ON d.id=l."documentId" WHERE d."verificationId"=$1 ORDER BY l."createdAt" DESC LIMIT 100`,
        [verificationId],
      ).catch(() => []),
    ]);
    return { verification: this.presentVerification(rows[0]), profile: rows[0], documents, partners, accessLogs: logs };
  }

  async readDocument(actorUserId: string, documentId: string, ip?: string) {
    const rows = await this.dataSource.query(`SELECT * FROM identity_verification_documents WHERE id=$1 LIMIT 1`, [documentId]);
    const document = rows[0];
    if (!document) throw new NotFoundException('Documento não encontrado.');
    const ciphertext = await readFile(join(this.vaultDir(), document.storageKey)).catch(() => null);
    if (!ciphertext) throw new NotFoundException('Arquivo criptografado não encontrado no cofre.');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(document.ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(document.tagBase64, 'base64'));
    let plaintext: Buffer;
    try {
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new ServiceUnavailableException('Falha de integridade ao abrir o documento.');
    }
    const sha = createHash('sha256').update(plaintext).digest('hex');
    if (sha !== document.sha256) throw new ServiceUnavailableException('O documento não passou na verificação de integridade.');
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : null;
    await this.dataSource.query(
      `INSERT INTO compliance_document_access_logs("documentId","actorUserId",action,"ipHash") VALUES ($1,$2,'VIEW',$3)`,
      [documentId, actorUserId, ipHash],
    ).catch(() => undefined);
    return { buffer: plaintext, mimeType: document.mimeType, originalName: document.originalName };
  }

  async adminReview(actorUserId: string, verificationId: string, body: Record<string, unknown>) {
    const decision = String(body.decision || '').toUpperCase();
    if (!['APPROVE','REJECT','NEEDS_CHANGES'].includes(decision)) throw new BadRequestException('Decisão inválida.');
    const reason = String(body.reason || '').trim().slice(0, 2000) || null;
    if (decision !== 'APPROVE' && !reason) throw new BadRequestException('Informe o motivo para reprovação ou solicitação de ajustes.');
    const currentRows = await this.dataSource.query(`SELECT * FROM identity_verifications WHERE id=$1 LIMIT 1`, [verificationId]);
    const current = currentRows[0];
    if (!current) throw new NotFoundException('Verificação não encontrada.');
    const status = decision === 'APPROVE' ? 'APPROVED' : decision;
    const rows = await this.dataSource.query(
      `UPDATE identity_verifications SET status=$2,"reviewedAt"=now(),"reviewedByUserId"=$3,"reviewReason"=$4,"updatedAt"=now() WHERE id=$1 RETURNING *`,
      [verificationId, status, actorUserId, reason],
    );
    if (current.context === 'COMPANY' && current.companyId) {
      const membership = await this.assertMembership(current.userId, current.companyId).catch(() => null);
      if (decision === 'APPROVE' && current.relationship === 'PARTNER' && membership?.role === 'PRIMARY_ADMIN') {
        await this.dataSource.query(
          `UPDATE company_memberships SET "isPartner"=true,"updatedAt"=now() WHERE "companyId"=$1 AND "userId"=$2`,
          [current.companyId, current.userId],
        );
        await this.dataSource.query(
          `UPDATE companies SET "complianceStatus"='APPROVED',"complianceGraceDeadline"=NULL,"complianceSuspendedAt"=NULL,"complianceSuspensionReason"=NULL WHERE id=$1`,
          [current.companyId],
        );
        await this.restoreCompanyResources(current.companyId);
      } else if (decision !== 'APPROVE') {
        const companies = await this.dataSource.query(`SELECT "complianceGraceDeadline" FROM companies WHERE id=$1 LIMIT 1`, [current.companyId]);
        const deadline = companies[0]?.complianceGraceDeadline ? new Date(companies[0].complianceGraceDeadline).getTime() : 0;
        await this.dataSource.query(`UPDATE companies SET "complianceStatus"='REJECTED' WHERE id=$1`, [current.companyId]);
        if (deadline && deadline <= Date.now()) await this.suspendCompany(current.companyId, 'Validação cadastral do administrador principal não regularizada dentro do prazo.');
      }
    }
    return this.presentVerification(rows[0]);
  }

  async assertSellerEligible(uid: string, identity: { type?: string; company?: { id?: string } | null }) {
    if (identity?.type === 'COMPANY' && identity.company?.id) {
      const companyId = identity.company.id;
      const companies = await this.dataSource.query(
        `SELECT "complianceStatus","complianceGraceDeadline","verificationStatus","isVerified" FROM companies WHERE id=$1 LIMIT 1`,
        [companyId],
      );
      const company = companies[0];
      if (!company || !(company.isVerified || company.verificationStatus === 'VERIFIED')) {
        throw new ForbiddenException('A empresa precisa estar verificada para publicar no Marketplace.');
      }
      if (company.complianceStatus === 'SUSPENDED') throw new ForbiddenException('A empresa está suspensa até regularizar a validação cadastral.');
      const membership = await this.assertMembership(uid, companyId).catch(() => null);
      if (!membership) throw new ForbiddenException('Seu vínculo com esta empresa não está ativo.');
      if (membership.role === 'PRIMARY_ADMIN') {
        if (company.complianceStatus === 'APPROVED') return true;
        const deadline = company.complianceGraceDeadline ? new Date(company.complianceGraceDeadline).getTime() : 0;
        if (['GRACE','PENDING','REJECTED','NOT_STARTED'].includes(company.complianceStatus) && (!deadline || deadline > Date.now())) return true;
        throw new ForbiddenException('O administrador principal precisa regularizar a validação cadastral da empresa.');
      }
      const approved = await this.hasApprovedPersonalVerification(uid);
      if (!approved) throw new ForbiddenException('Para publicar em nome da empresa, conclua sua verificação cadastral pessoal.');
      return true;
    }
    if (!(await this.hasApprovedPersonalVerification(uid))) {
      throw new ForbiddenException('Antes da primeira publicação, conclua a verificação cadastral com selfie, documento oficial e comprovante de endereço. A análise pode levar até 48 horas.');
    }
    return true;
  }

  async enforceCompanyDeadlines() {
    const companies = await this.dataSource.query(
      `SELECT c.id,c."complianceGraceDeadline",m."userId" AS "primaryAdminUserId"
       FROM companies c LEFT JOIN company_memberships m ON m."companyId"=c.id AND m.role='PRIMARY_ADMIN' AND m.status='ACTIVE'
       WHERE c."complianceStatus" IN ('GRACE','REJECTED','NOT_STARTED')
         AND c."complianceGraceDeadline" IS NOT NULL AND c."complianceGraceDeadline"<=now()`,
    ).catch(() => []);
    for (const company of companies) {
      const submitted = company.primaryAdminUserId ? await this.dataSource.query(
        `SELECT id,status FROM identity_verifications WHERE "userId"=$1 AND "companyId"=$2 AND context='COMPANY' AND relationship='PARTNER'
         AND status IN ('PENDING','APPROVED') LIMIT 1`,
        [company.primaryAdminUserId, company.id],
      ).catch(() => []) : [];
      if (submitted[0]?.status === 'APPROVED') {
        await this.dataSource.query(`UPDATE companies SET "complianceStatus"='APPROVED',"complianceGraceDeadline"=NULL WHERE id=$1`, [company.id]).catch(() => undefined);
        continue;
      }
      if (submitted[0]?.status === 'PENDING') {
        await this.dataSource.query(`UPDATE companies SET "complianceStatus"='PENDING' WHERE id=$1`, [company.id]).catch(() => undefined);
        continue;
      }
      await this.suspendCompany(company.id, 'Prazo de 15 dias encerrado sem envio da validação cadastral do administrador principal.').catch(() => undefined);
    }
    return { checked: companies.length };
  }

  private async suspendCompany(companyId: string, reason: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO compliance_resource_suspensions("companyId","resourceType","resourceId","previousState")
         SELECT $1,'CLASSIFIED_LISTING',id::text,jsonb_build_object('status',status) FROM classified_listings
         WHERE "companyId"=$1 AND status='PUBLISHED'
         ON CONFLICT DO NOTHING`,
        [companyId],
      ).catch(() => undefined);
      await manager.query(`UPDATE classified_listings SET status='PAUSED',"updatedAt"=now() WHERE "companyId"=$1 AND status='PUBLISHED'`, [companyId]).catch(() => undefined);
      await manager.query(
        `INSERT INTO compliance_resource_suspensions("companyId","resourceType","resourceId","previousState")
         SELECT $1,'JOB',id::text,jsonb_build_object('active',active) FROM jobs WHERE "companyId"=$1 AND active=true
         ON CONFLICT DO NOTHING`,
        [companyId],
      ).catch(() => undefined);
      await manager.query(`UPDATE jobs SET active=false WHERE "companyId"=$1 AND active=true`, [companyId]).catch(() => undefined);
      await manager.query(
        `INSERT INTO compliance_resource_suspensions("companyId","resourceType","resourceId","previousState")
         SELECT $1,'COMPANY_PAGE',"companyId"::text,jsonb_build_object('status',status) FROM company_pages WHERE "companyId"=$1 AND status='PUBLISHED'
         ON CONFLICT DO NOTHING`,
        [companyId],
      ).catch(() => undefined);
      await manager.query(`UPDATE company_pages SET status='DRAFT',"updatedAt"=now() WHERE "companyId"=$1 AND status='PUBLISHED'`, [companyId]).catch(() => undefined);
      await manager.query(
        `UPDATE companies SET "complianceStatus"='SUSPENDED',"complianceSuspendedAt"=now(),"complianceSuspensionReason"=$2 WHERE id=$1`,
        [companyId, reason],
      );
    });
  }

  private async restoreCompanyResources(companyId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM compliance_resource_suspensions WHERE "companyId"=$1 AND "restoredAt" IS NULL ORDER BY "suspendedAt" ASC`,
      [companyId],
    ).catch(() => []);
    for (const row of rows) {
      if (row.resourceType === 'CLASSIFIED_LISTING' && row.previousState?.status === 'PUBLISHED') {
        await this.dataSource.query(`UPDATE classified_listings SET status='PUBLISHED',"updatedAt"=now() WHERE id=$1::uuid AND status='PAUSED'`, [row.resourceId]).catch(() => undefined);
      } else if (row.resourceType === 'JOB' && row.previousState?.active === true) {
        await this.dataSource.query(`UPDATE jobs SET active=true WHERE id=$1::uuid AND active=false AND ("deadlineDate" IS NULL OR "deadlineDate">=CURRENT_DATE)`, [row.resourceId]).catch(() => undefined);
      } else if (row.resourceType === 'COMPANY_PAGE' && row.previousState?.status === 'PUBLISHED') {
        await this.dataSource.query(`UPDATE company_pages SET status='PUBLISHED',"updatedAt"=now() WHERE "companyId"=$1::uuid AND status='DRAFT' AND published IS NOT NULL`, [row.resourceId]).catch(() => undefined);
      }
      await this.dataSource.query(`UPDATE compliance_resource_suspensions SET "restoredAt"=now() WHERE id=$1`, [row.id]).catch(() => undefined);
    }
  }

  private async hasApprovedPersonalVerification(uid: string) {
    const rows = await this.dataSource.query(
      `SELECT id FROM identity_verifications WHERE "userId"=$1 AND context='PERSONAL' AND status='APPROVED' LIMIT 1`,
      [uid],
    ).catch(() => []);
    return Boolean(rows[0]);
  }

  private async upsertVerification(uid: string, companyId: string | null, context: VerificationContext) {
    const rows = await this.dataSource.query(
      `INSERT INTO identity_verifications("userId","companyId",context,relationship)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT ("userId",COALESCE("companyId",'00000000-0000-0000-0000-000000000000'::uuid),context)
       DO UPDATE SET "updatedAt"=identity_verifications."updatedAt"
       RETURNING *`,
      [uid, companyId, context, context === 'PERSONAL' ? 'PERSONAL' : 'EMPLOYEE'],
    );
    return rows[0];
  }

  private async companyForUser(uid: string) {
    const users = await this.dataSource.query(`SELECT "companyId" FROM users WHERE id=$1 LIMIT 1`, [uid]);
    const companyId = users[0]?.companyId;
    if (!companyId) throw new BadRequestException('Sua conta não está vinculada a uma empresa.');
    await this.assertMembership(uid, companyId);
    return companyId as string;
  }

  private async assertMembership(uid: string, companyId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND status='ACTIVE' LIMIT 1`,
      [companyId, uid],
    ).catch(() => []);
    if (!rows[0]) {
      const companies = await this.dataSource.query(`SELECT "ownerId" FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
      if (companies[0]?.ownerId === uid) {
        const inserted = await this.dataSource.query(
          `INSERT INTO company_memberships("companyId","userId",role,"isPartner",permissions,status)
           VALUES ($1,$2,'PRIMARY_ADMIN',false,'{"companyProfile":true,"recruitment":true,"marketplace":true,"finance":true,"team":true}'::jsonb,'ACTIVE')
           ON CONFLICT ("companyId","userId") DO UPDATE SET status='ACTIVE' RETURNING *`,
          [companyId, uid],
        );
        return inserted[0];
      }
      throw new ForbiddenException('Seu vínculo com a empresa não está ativo.');
    }
    return rows[0];
  }

  private async assertPrimaryAdmin(uid: string, companyId: string) {
    const membership = await this.assertMembership(uid, companyId);
    if (membership.role !== 'PRIMARY_ADMIN') throw new ForbiddenException('Somente o administrador principal pode alterar a declaração societária.');
    return membership;
  }

  private context(value: unknown): VerificationContext {
    return String(value || 'PERSONAL').toUpperCase() === 'COMPANY' ? 'COMPANY' : 'PERSONAL';
  }

  private relationship(value: unknown, context: VerificationContext): Relationship {
    if (context === 'PERSONAL') return 'PERSONAL';
    const relationship = String(value || '').toUpperCase();
    if (!['EMPLOYEE','PARTNER'].includes(relationship)) throw new BadRequestException('Informe se você é sócio(a) ou funcionário(a).');
    return relationship as Relationship;
  }

  private percentage(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(number) || number <= 0 || number > 100) throw new BadRequestException('Percentual societário inválido.');
    return Number(number.toFixed(4));
  }

  private presentVerification(row: any) {
    return {
      id: row.id,
      userId: row.userId,
      companyId: row.companyId || null,
      context: row.context,
      relationship: row.relationship,
      partnerPercentage: row.partnerPercentage == null ? null : Number(row.partnerPercentage),
      declaresRepresentationPowers: row.declaresRepresentationPowers === true,
      status: row.status,
      consentVersion: row.consentVersion || null,
      consentAcceptedAt: row.consentAcceptedAt || null,
      submittedAt: row.submittedAt || null,
      reviewedAt: row.reviewedAt || null,
      reviewReason: row.reviewReason || null,
      documents: Array.isArray(row.documents) ? row.documents : [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private vaultDir() {
    return resolve(process.env.IDENTITY_VAULT_DIR || '/var/lib/piranegocios/identity-vault');
  }

  private encryptionKey() {
    const raw = String(process.env.IDENTITY_VAULT_ENCRYPTION_KEY || '').trim();
    if (!raw) throw new ServiceUnavailableException('IDENTITY_VAULT_ENCRYPTION_KEY não configurada. Gere uma chave aleatória de 32 bytes antes de habilitar KYC.');
    const candidates = [Buffer.from(raw, 'base64'), Buffer.from(raw, 'hex')];
    const key = candidates.find((item) => item.length === 32);
    if (!key) throw new ServiceUnavailableException('IDENTITY_VAULT_ENCRYPTION_KEY precisa representar exatamente 32 bytes em base64 ou hex.');
    return key;
  }
}
