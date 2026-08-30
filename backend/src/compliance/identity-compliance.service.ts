import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { DataSource } from 'typeorm';

export const IDENTITY_COMPLIANCE_CONSENT_VERSION = '2026-08-26-simple';
const REQUIRED_STANDARD_FILES = ['SELFIE'] as const;
const VALID_DOCUMENT_KINDS = new Set(['SELFIE', 'ID_FRONT', 'ID_BACK', 'ADDRESS_PROOF', 'REPRESENTATION_PROOF']);
const VALID_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

type VerificationContext = 'PERSONAL' | 'COMPANY';
type Relationship = 'PERSONAL' | 'EMPLOYEE' | 'PARTNER';

@Injectable()
export class IdentityComplianceService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * The application normally stores the Firebase UID in users.id. Some legacy
   * installations, however, created that column as UUID and identify the
   * account by its e-mail. Resolve the database key once at the boundary so
   * the rest of the compliance flow always uses the column's native type.
   */
  async resolveUserId(firebaseUid: string, email?: string) {
    const rows = await this.dataSource.query(
      `SELECT id
       FROM users
       WHERE id::text=$1 OR ($2::varchar IS NOT NULL AND lower(email)=lower($2::varchar))
       ORDER BY CASE WHEN id::text=$1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [firebaseUid, String(email || '').trim().toLowerCase() || null],
    );
    if (!rows[0]?.id) throw new NotFoundException('Usuário não encontrado. Atualize seu cadastro antes de iniciar a verificação.');
    return String(rows[0].id);
  }

  async myStatus(uid: string) {
    const users = await this.dataSource.query(
      `SELECT u.id,u.email,u."displayName",u."fullName",u."socialName",u.phone,u."whatsappPhoneE164",u."whatsappVerifiedAt",u."companyId",
              c.name AS "companyName",c.cnpj,c."hasCnpj",c."legalName",c."registryTradeName",c."legalAddress",c."legalCity",c."legalState",c."legalZipCode",
              c."cnpjSituation",c."cnpjDataSource",c."cnpjDataCheckedAt",c."cnpjDataUpdatedAt",c."cnpjSnapshot",c."cnpjChangeAlert",
              c."commercialAddressSameAsLegal",c.address AS "commercialAddress",c.city AS "commercialCity",c.state AS "commercialState",
              c."verificationStatus",c."isVerified",c."complianceStatus"
       FROM users u LEFT JOIN companies c ON c.id::text=u."companyId"::text WHERE u.id::text=$1 LIMIT 1`,
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
    const authorizations = user.companyId ? await this.dataSource.query(
      `SELECT id,"partnerName","partnerEmail","partnerPhone","qsaQualification",status,"grantFullPowers",permissions,"submittedAt","reviewedAt","reviewReason","expiresAt","createdAt"
       FROM company_verification_authorizations WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 20`,
      [user.companyId],
    ).catch(() => []) : [];
    return {
      consentVersion: IDENTITY_COMPLIANCE_CONSENT_VERSION,
      user: {
        id: user.id,
        name: user.socialName || user.displayName || user.fullName || null,
        email: user.email || null,
        phone: user.whatsappPhoneE164 || user.phone || null,
        phoneVerified: Boolean(user.whatsappVerifiedAt),
        contactReady: Boolean(user.email && user.whatsappVerifiedAt),
      },
      company: user.companyId ? {
        id: user.companyId,
        name: user.companyName,
        cnpj: user.cnpj || null,
        hasCnpj: Boolean(user.hasCnpj),
        legalName: user.legalName || null,
        registryTradeName: user.registryTradeName || null,
        legalAddress: user.legalAddress || null,
        legalCity: user.legalCity || null,
        legalState: user.legalState || null,
        legalZipCode: user.legalZipCode || null,
        commercialAddress: user.commercialAddress || null,
        commercialCity: user.commercialCity || null,
        commercialState: user.commercialState || null,
        commercialAddressSameAsLegal: user.commercialAddressSameAsLegal !== false,
        cnpjSituation: user.cnpjSituation || null,
        cnpjDataSource: user.cnpjDataSource || null,
        cnpjDataCheckedAt: user.cnpjDataCheckedAt || null,
        cnpjDataUpdatedAt: user.cnpjDataUpdatedAt || null,
        cnpjSnapshot: user.cnpjSnapshot || null,
        cnpjChangeAlert: user.cnpjChangeAlert || null,
        verified: Boolean(user.isVerified || user.verificationStatus === 'VERIFIED'),
        verificationStatus: user.verificationStatus,
        complianceStatus: user.complianceStatus,
        membership,
        authorizations,
      } : null,
      verifications: verifications.map((row: any) => this.presentVerification(row)),
    };
  }

  async saveProfile(uid: string, body: Record<string, unknown>) {
    const context = this.context(body.context);
    const companyId = context === 'COMPANY' ? await this.companyForUser(uid) : null;
    const relationship = this.relationship(body.relationship, context);
    const row = await this.upsertVerification(uid, companyId, context);
    if (['PENDING','APPROVED'].includes(row.status)) throw new BadRequestException('Esta verificação já foi enviada e não pode ser alterada agora.');

    let selectedQsaName: string | null = null;
    let selectedQsaQualification: string | null = null;
    let declaresAtLeast25Percent = false;
    if (context === 'COMPANY' && relationship === 'PARTNER') {
      declaresAtLeast25Percent = body.declaresAtLeast25Percent === true;
      selectedQsaName = String(body.selectedQsaName || '').trim().slice(0, 180) || null;
      const companies = await this.dataSource.query(`SELECT "cnpjSnapshot" FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
      const qsa = Array.isArray(companies[0]?.cnpjSnapshot?.qsa) ? companies[0].cnpjSnapshot.qsa : [];
      if (qsa.length) {
        const match = qsa.find((item: any) => this.normalizeName(item?.name) === this.normalizeName(selectedQsaName));
        if (!match) throw new BadRequestException('Selecione seu nome entre os sócios retornados pela consulta do CNPJ.');
        selectedQsaName = String(match.name || '').trim();
        selectedQsaQualification = String(match.qualification || '').trim() || null;
      }
    }

    const rows = await this.dataSource.query(
      `UPDATE identity_verifications SET
         relationship=$2,
         "partnerPercentage"=NULL,
         "declaresRepresentationPowers"=CASE WHEN $2='PARTNER' THEN true ELSE false END,
         "selectedQsaName"=$3,
         "selectedQsaQualification"=$4,
         "declaresAtLeast25Percent"=$5,
         "verificationMethod"='SELFIE_MANUAL',
         "updatedAt"=now()
       WHERE id=$1 RETURNING *`,
      [row.id, relationship, selectedQsaName, selectedQsaQualification, declaresAtLeast25Percent],
    );
    return this.presentVerification(rows[0]);
  }

  // Mantido somente para compatibilidade/futura política ampliada. Não faz parte do fluxo padrão.
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
    if (cleaned.some((item) => !item.name || item.participationPercentage == null)) throw new BadRequestException('Preencha nome e participação dos sócios declarados.');
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
    if (!VALID_DOCUMENT_KINDS.has(kind)) throw new BadRequestException('Tipo de arquivo inválido.');
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo não recebido.');
    if (!VALID_MIMES.has(file.mimetype)) throw new BadRequestException('Envie JPG, PNG, WEBP ou PDF.');
    if (kind === 'SELFIE' && file.mimetype === 'application/pdf') throw new BadRequestException('A selfie precisa ser uma imagem.');
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
        `SELECT "storageKey" FROM identity_verification_documents WHERE "verificationId"=$1 AND kind=$2 LIMIT 1`,
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
      if (existing[0]?.storageKey && existing[0].storageKey !== storageKey) await unlink(join(dir, existing[0].storageKey)).catch(() => undefined);
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

    const users = await this.dataSource.query(`SELECT email,"whatsappVerifiedAt" FROM users WHERE id=$1 LIMIT 1`, [uid]);
    if (!users[0]?.email) throw new BadRequestException('Sua conta precisa ter um e-mail antes da verificação. Em login social, o e-mail da conta já é suficiente.');
    if (!users[0]?.whatsappVerifiedAt) throw new BadRequestException('Valide seu telefone/WhatsApp antes de solicitar a análise.');

    const documents = await this.dataSource.query(`SELECT kind FROM identity_verification_documents WHERE "verificationId"=$1`, [verification.id]);
    const kinds = new Set(documents.map((item: any) => item.kind));
    const missing = REQUIRED_STANDARD_FILES.filter((kind) => !kinds.has(kind));
    if (missing.length) throw new BadRequestException('Tire uma selfie atual antes de solicitar a análise.');

    if (context === 'COMPANY') {
      const companyRows = await this.dataSource.query(`SELECT cnpj,"hasCnpj","cnpjSnapshot" FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
      const company = companyRows[0];
      if (!company?.hasCnpj || !company?.cnpj || !company?.cnpjSnapshot) {
        throw new BadRequestException('Consulte o CNPJ da empresa antes de solicitar a verificação empresarial.');
      }
      if (verification.relationship !== 'PARTNER') {
        throw new BadRequestException('Se você não é o sócio responsável, use a opção de enviar autorização ao sócio.');
      }
      if (verification.declaresAtLeast25Percent !== true) {
        throw new BadRequestException('Se você não possui 25% ou mais, indique um sócio responsável para autorizar a empresa.');
      }
      const qsa = Array.isArray(company.cnpjSnapshot?.qsa) ? company.cnpjSnapshot.qsa : [];
      if (qsa.length && !verification.selectedQsaName) throw new BadRequestException('Selecione qual sócio do QSA é você.');
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
      await this.dataSource.query(`UPDATE companies SET "complianceStatus"='PENDING',"updatedAt"=now() WHERE id=$1 AND "complianceStatus"<>'APPROVED'`, [companyId]);
    }
    return this.presentVerification(rows[0]);
  }

  async adminList(statusRaw?: string) {
    const status = String(statusRaw || 'PENDING').toUpperCase();
    const filter = status === 'ALL' ? '' : `WHERE v.status=$1`;
    const params = status === 'ALL' ? [] : [status];
    return this.dataSource.query(
      `SELECT v.id,v."userId",v."companyId",v.context,v.relationship,v."declaresAtLeast25Percent",v."selectedQsaName",v.status,v."submittedAt",v."createdAt",
              COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS "userName",u.email,u.phone,u."whatsappPhoneE164",u."whatsappVerifiedAt",
              c.name AS "companyName",c."legalName",c.cnpj,c."verificationStatus" AS "companyVerificationStatus",c."complianceStatus",
              COALESCE(dc.count,0)::int AS "documentCount"
       FROM identity_verifications v JOIN users u ON u.id=v."userId" LEFT JOIN companies c ON c.id=v."companyId"
       LEFT JOIN LATERAL (SELECT count(*) AS count FROM identity_verification_documents d WHERE d."verificationId"=v.id) dc ON true
       ${filter} ORDER BY CASE v.status WHEN 'PENDING' THEN 0 WHEN 'NEEDS_CHANGES' THEN 1 ELSE 2 END,COALESCE(v."submittedAt",v."createdAt") ASC LIMIT 500`,
      params,
    );
  }

  async adminDetail(verificationId: string) {
    const rows = await this.dataSource.query(
      `SELECT v.*,COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS "userName",u.email,u.phone,u."whatsappPhoneE164",u."whatsappVerifiedAt",u.city,u.state,u.address,
              c.name AS "companyName",c."legalName",c."registryTradeName",c.cnpj,c."legalAddress",c."legalCity",c."legalState",c."legalZipCode",c."cnpjSituation",c."cnpjSnapshot",c."cnpjDataSource",c."cnpjDataCheckedAt",c."cnpjChangeAlert",
              c.address AS "companyAddress",c.city AS "companyCity",c.state AS "companyState",c."verificationStatus" AS "companyVerificationStatus",c."isVerified",c."complianceStatus",
              m.role AS "membershipRole",m."isPartner",m.permissions
       FROM identity_verifications v JOIN users u ON u.id=v."userId" LEFT JOIN companies c ON c.id=v."companyId"
       LEFT JOIN company_memberships m ON m."companyId"=v."companyId" AND m."userId"=v."userId" AND m.status='ACTIVE'
       WHERE v.id=$1 LIMIT 1`,
      [verificationId],
    );
    if (!rows[0]) throw new NotFoundException('Verificação não encontrada.');
    const [documents, auths, logs] = await Promise.all([
      this.dataSource.query(`SELECT id,kind,"mimeType","originalName","sizeBytes",sha256,"uploadedAt" FROM identity_verification_documents WHERE "verificationId"=$1 ORDER BY kind`, [verificationId]),
      rows[0].companyId ? this.dataSource.query(
        `SELECT id,"partnerName","partnerEmail","partnerPhone","qsaQualification",status,"grantFullPowers",permissions,"submittedAt","reviewedAt","reviewReason" FROM company_verification_authorizations WHERE "companyId"=$1 ORDER BY "createdAt" DESC`,
        [rows[0].companyId],
      ) : Promise.resolve([]),
      this.dataSource.query(
        `SELECT l.id,l."documentId",l."actorUserId",l.action,l."createdAt",COALESCE(u."displayName",u."fullName",u.email) AS "actorName"
         FROM compliance_document_access_logs l LEFT JOIN users u ON u.id=l."actorUserId"
         JOIN identity_verification_documents d ON d.id=l."documentId" WHERE d."verificationId"=$1 ORDER BY l."createdAt" DESC LIMIT 100`,
        [verificationId],
      ).catch(() => []),
    ]);
    return { verification: this.presentVerification(rows[0]), profile: rows[0], documents, authorizations: auths, accessLogs: logs };
  }

  async readDocument(actorUserId: string, documentId: string, ip?: string) {
    const rows = await this.dataSource.query(`SELECT * FROM identity_verification_documents WHERE id=$1 LIMIT 1`, [documentId]);
    const document = rows[0];
    if (!document) throw new NotFoundException('Arquivo não encontrado.');
    const ciphertext = await readFile(join(this.vaultDir(), document.storageKey)).catch(() => null);
    if (!ciphertext) throw new NotFoundException('Arquivo criptografado não encontrado no cofre.');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(document.ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(document.tagBase64, 'base64'));
    let plaintext: Buffer;
    try { plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]); }
    catch { throw new ServiceUnavailableException('Falha de integridade ao abrir o arquivo.'); }
    if (createHash('sha256').update(plaintext).digest('hex') !== document.sha256) throw new ServiceUnavailableException('O arquivo não passou na verificação de integridade.');
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : null;
    await this.dataSource.query(`INSERT INTO compliance_document_access_logs("documentId","actorUserId",action,"ipHash") VALUES ($1,$2,'VIEW',$3)`, [documentId, actorUserId, ipHash]).catch(() => undefined);
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
    if (decision === 'APPROVE') {
      await this.dataSource.query(`UPDATE users SET "isVerified"=true,"updatedAt"=now() WHERE id=$1`, [current.userId]).catch(() => undefined);
    }
    if (current.context === 'COMPANY' && current.companyId) {
      const membership = await this.assertMembership(current.userId, current.companyId).catch(() => null);
      const validatesCompany = current.relationship === 'PARTNER' && current.declaresAtLeast25Percent === true && membership?.role === 'PRIMARY_ADMIN';
      if (decision === 'APPROVE' && validatesCompany) {
        await this.dataSource.query(`UPDATE company_memberships SET "isPartner"=true,"updatedAt"=now() WHERE "companyId"=$1 AND "userId"=$2`, [current.companyId, current.userId]);
        await this.dataSource.query(
          `UPDATE companies SET "verificationStatus"='VERIFIED',"isVerified"=true,"complianceStatus"='APPROVED',"complianceGraceDeadline"=NULL,"complianceSuspendedAt"=NULL,"complianceSuspensionReason"=NULL,"updatedAt"=now() WHERE id=$1`,
          [current.companyId],
        );
        await this.restoreCompanyResources(current.companyId);
      } else if (decision !== 'APPROVE' && validatesCompany) {
        await this.dataSource.query(`UPDATE companies SET "complianceStatus"='REJECTED',"updatedAt"=now() WHERE id=$1`, [current.companyId]);
      }
    }
    return this.presentVerification(rows[0]);
  }

  async assertSellerEligible(uid: string, identity: { type?: string; company?: { id?: string } | null }) {
    if (identity?.type === 'COMPANY' && identity.company?.id) {
      const companyId = identity.company.id;
      const companies = await this.dataSource.query(`SELECT "verificationStatus","isVerified","complianceStatus" FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
      const company = companies[0];
      if (!company || !(company.isVerified || company.verificationStatus === 'VERIFIED') || company.complianceStatus !== 'APPROVED') {
        throw new ForbiddenException('A empresa precisa concluir a verificação simplificada antes de publicar no Marketplace.');
      }
      const membership = await this.assertMembership(uid, companyId);
      if (membership.status !== 'ACTIVE') throw new ForbiddenException('Seu vínculo com a empresa não está ativo.');
      if (membership.permissions?.marketplace === false) throw new ForbiddenException('Seu perfil não possui permissão para publicar no Marketplace.');
      return true;
    }
    if (!(await this.hasApprovedIdentity(uid))) {
      throw new ForbiddenException('Antes da primeira publicação, conclua a verificação simples com selfie e telefone validado. A análise pode levar até 48 horas.');
    }
    return true;
  }

  // Mantido por compatibilidade com chamadas antigas. O modelo simplificado não suspende
  // empresas automaticamente por prazo documental.
  async enforceCompanyDeadlines() {
    return { checked: 0, disabledBySimplifiedFlow: true };
  }

  private async restoreCompanyResources(companyId: string) {
    const rows = await this.dataSource.query(`SELECT * FROM compliance_resource_suspensions WHERE "companyId"=$1 AND "restoredAt" IS NULL ORDER BY "suspendedAt" ASC`, [companyId]).catch(() => []);
    for (const row of rows) {
      if (row.resourceType === 'CLASSIFIED_LISTING' && row.previousState?.status === 'PUBLISHED') {
        await this.dataSource.query(`UPDATE classified_listings SET status='PUBLISHED',"updatedAt"=now() WHERE id=$1::uuid AND status='PAUSED'`, [row.resourceId]).catch(() => undefined);
      } else if (row.resourceType === 'JOB' && row.previousState?.active === true) {
        await this.dataSource.query(`UPDATE jobs SET active=true WHERE id=$1::uuid AND active=false AND ("deadlineDate" IS NULL OR "deadlineDate">=CURRENT_DATE)`, [row.resourceId]).catch(() => undefined);
      } else if (row.resourceType === 'COMPANY_PAGE' && row.previousState?.status === 'PUBLISHED') {
        await this.dataSource.query(`UPDATE company_pages SET status='PUBLISHED',"updatedAt"=now() WHERE "companyId"=$1::uuid AND status='DRAFT'`, [row.resourceId]).catch(() => undefined);
      }
      await this.dataSource.query(`UPDATE compliance_resource_suspensions SET "restoredAt"=now() WHERE id=$1`, [row.id]).catch(() => undefined);
    }
  }

  private async hasApprovedIdentity(uid: string) {
    const rows = await this.dataSource.query(`SELECT id FROM identity_verifications WHERE "userId"=$1 AND status='APPROVED' LIMIT 1`, [uid]).catch(() => []);
    return Boolean(rows[0]);
  }

  private async upsertVerification(uid: string, companyId: string | null, context: VerificationContext) {
    const rows = await this.dataSource.query(
      `INSERT INTO identity_verifications("userId","companyId",context,relationship)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT ("userId",COALESCE("companyId",'00000000-0000-0000-0000-000000000000'::uuid),context)
       DO UPDATE SET "updatedAt"=identity_verifications."updatedAt" RETURNING *`,
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
    const rows = await this.dataSource.query(`SELECT * FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND status='ACTIVE' LIMIT 1`, [companyId, uid]).catch(() => []);
    if (rows[0]) return rows[0];
    const companies = await this.dataSource.query(`SELECT "ownerId" FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
    if (companies[0]?.ownerId !== uid) throw new ForbiddenException('Seu vínculo com a empresa não está ativo.');
    const inserted = await this.dataSource.query(
      `INSERT INTO company_memberships("companyId","userId",role,"isPartner",permissions,status)
       VALUES ($1,$2,'PRIMARY_ADMIN',false,'{"companyProfile":true,"recruitment":true,"marketplace":true,"finance":true,"team":true}'::jsonb,'ACTIVE')
       ON CONFLICT ("companyId","userId") DO UPDATE SET status='ACTIVE' RETURNING *`,
      [companyId, uid],
    );
    return inserted[0];
  }

  private async assertPrimaryAdmin(uid: string, companyId: string) {
    const membership = await this.assertMembership(uid, companyId);
    if (membership.role !== 'PRIMARY_ADMIN') throw new ForbiddenException('Somente o administrador principal pode alterar esses dados.');
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

  private normalizeName(value: unknown) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  private presentVerification(row: any) {
    return {
      id: row.id,
      userId: row.userId,
      companyId: row.companyId || null,
      context: row.context,
      relationship: row.relationship,
      selectedQsaName: row.selectedQsaName || null,
      selectedQsaQualification: row.selectedQsaQualification || null,
      declaresAtLeast25Percent: row.declaresAtLeast25Percent === true,
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
    if (!raw) throw new ServiceUnavailableException('IDENTITY_VAULT_ENCRYPTION_KEY não configurada. Gere uma chave aleatória de 32 bytes antes de habilitar verificação por selfie.');
    const candidates = [Buffer.from(raw, 'base64'), Buffer.from(raw, 'hex')];
    const key = candidates.find((item) => item.length === 32);
    if (!key) throw new ServiceUnavailableException('IDENTITY_VAULT_ENCRYPTION_KEY precisa representar exatamente 32 bytes em base64 ou hex.');
    return key;
  }
}
