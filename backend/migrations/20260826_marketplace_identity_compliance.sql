-- Verificação cadastral para vendedores do Marketplace.
-- Documentos não possuem URL pública. O conteúdo criptografado fica no cofre privado do backend.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS "complianceStatus" varchar(24) NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "complianceGraceDeadline" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "complianceSuspendedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "complianceSuspensionReason" text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='companies_compliance_status_check') THEN
    ALTER TABLE companies ADD CONSTRAINT companies_compliance_status_check
      CHECK ("complianceStatus" IN ('NOT_STARTED','GRACE','PENDING','APPROVED','REJECTED','SUSPENDED'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "companyId" uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  context varchar(20) NOT NULL DEFAULT 'PERSONAL',
  relationship varchar(20) NOT NULL DEFAULT 'PERSONAL',
  "partnerPercentage" numeric(7,4) NULL,
  "declaresRepresentationPowers" boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL DEFAULT 'DRAFT',
  "consentVersion" varchar(32) NULL,
  "consentAcceptedAt" timestamptz NULL,
  "submittedAt" timestamptz NULL,
  "reviewedAt" timestamptz NULL,
  "reviewedByUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "reviewReason" text NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identity_verification_context_check CHECK (context IN ('PERSONAL','COMPANY')),
  CONSTRAINT identity_verification_relationship_check CHECK (relationship IN ('PERSONAL','EMPLOYEE','PARTNER')),
  CONSTRAINT identity_verification_status_check CHECK (status IN ('DRAFT','PENDING','APPROVED','REJECTED','NEEDS_CHANGES')),
  CONSTRAINT identity_verification_partner_percentage_check CHECK ("partnerPercentage" IS NULL OR ("partnerPercentage" > 0 AND "partnerPercentage" <= 100))
);
CREATE UNIQUE INDEX IF NOT EXISTS identity_verifications_active_context_uq
  ON identity_verifications("userId",COALESCE("companyId",'00000000-0000-0000-0000-000000000000'::uuid),context);
CREATE INDEX IF NOT EXISTS identity_verifications_status_idx ON identity_verifications(status,"submittedAt");
CREATE INDEX IF NOT EXISTS identity_verifications_company_idx ON identity_verifications("companyId",status) WHERE "companyId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS identity_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "verificationId" uuid NOT NULL REFERENCES identity_verifications(id) ON DELETE CASCADE,
  kind varchar(32) NOT NULL,
  "storageKey" varchar(180) NOT NULL UNIQUE,
  "mimeType" varchar(100) NOT NULL,
  "originalName" varchar(240) NOT NULL,
  "sizeBytes" bigint NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "ivBase64" varchar(64) NOT NULL,
  "tagBase64" varchar(64) NOT NULL,
  "uploadedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identity_verification_document_kind_check CHECK (kind IN ('SELFIE','ID_FRONT','ID_BACK','ADDRESS_PROOF','REPRESENTATION_PROOF')),
  CONSTRAINT identity_verification_document_size_check CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 12582912)
);
CREATE UNIQUE INDEX IF NOT EXISTS identity_verification_document_kind_uq
  ON identity_verification_documents("verificationId",kind);

-- A ficha societária é declaratória. Não força aceite individual de todos os sócios.
-- Ela permite elevar a exigência futuramente caso contrato do arranjo/provedor exija UBO/KYC ampliado.
CREATE TABLE IF NOT EXISTS company_partner_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "declaredByUserId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  email varchar(255) NULL,
  phone varchar(40) NULL,
  "participationPercentage" numeric(7,4) NOT NULL,
  "hasAdministrativePowers" boolean NOT NULL DEFAULT false,
  "isBeneficialOwner" boolean NOT NULL DEFAULT false,
  "confirmationStatus" varchar(20) NOT NULL DEFAULT 'DECLARED',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_partner_percentage_check CHECK ("participationPercentage" > 0 AND "participationPercentage" <= 100),
  CONSTRAINT company_partner_confirmation_check CHECK ("confirmationStatus" IN ('DECLARED','INVITED','CONFIRMED','DECLINED'))
);
CREATE INDEX IF NOT EXISTS company_partner_company_idx ON company_partner_declarations("companyId","participationPercentage" DESC);

CREATE TABLE IF NOT EXISTS company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(24) NOT NULL DEFAULT 'EMPLOYEE',
  "isPartner" boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_membership_role_check CHECK (role IN ('PRIMARY_ADMIN','ADMIN','EMPLOYEE')),
  CONSTRAINT company_membership_status_check CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED')),
  UNIQUE("companyId","userId")
);
CREATE UNIQUE INDEX IF NOT EXISTS company_membership_primary_admin_uq
  ON company_memberships("companyId") WHERE role='PRIMARY_ADMIN' AND status='ACTIVE';

INSERT INTO company_memberships("companyId","userId",role,"isPartner",permissions,status)
SELECT id,"ownerId",'PRIMARY_ADMIN',false,'{"companyProfile":true,"recruitment":true,"marketplace":true,"finance":true,"team":true}'::jsonb,'ACTIVE'
FROM companies
WHERE "ownerId" IS NOT NULL
ON CONFLICT ("companyId","userId") DO NOTHING;

-- Empresas já verificadas recebem janela de 15 dias para o admin principal enviar a validação pessoal.
UPDATE companies
SET "complianceStatus"='GRACE',
    "complianceGraceDeadline"=COALESCE("complianceGraceDeadline",now()+interval '15 days')
WHERE ("isVerified"=true OR "verificationStatus"='VERIFIED')
  AND "complianceStatus"='NOT_STARTED';

CREATE TABLE IF NOT EXISTS compliance_resource_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "resourceType" varchar(24) NOT NULL,
  "resourceId" varchar(100) NOT NULL,
  "previousState" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "suspendedAt" timestamptz NOT NULL DEFAULT now(),
  "restoredAt" timestamptz NULL,
  CONSTRAINT compliance_resource_type_check CHECK ("resourceType" IN ('CLASSIFIED_LISTING','JOB','COMPANY_PAGE')),
  UNIQUE("companyId","resourceType","resourceId","suspendedAt")
);
CREATE INDEX IF NOT EXISTS compliance_resource_active_idx
  ON compliance_resource_suspensions("companyId","resourceType") WHERE "restoredAt" IS NULL;

CREATE TABLE IF NOT EXISTS compliance_document_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" uuid NOT NULL REFERENCES identity_verification_documents(id) ON DELETE CASCADE,
  "actorUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action varchar(24) NOT NULL,
  "ipHash" varchar(64) NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_document_access_action_check CHECK (action IN ('VIEW','DOWNLOAD','REVIEW'))
);
CREATE INDEX IF NOT EXISTS compliance_document_access_idx ON compliance_document_access_logs("documentId","createdAt" DESC);

COMMENT ON TABLE identity_verification_documents IS 'Encrypted private KYC documents. Never expose storageKey or file bytes through a public/static route.';
COMMENT ON TABLE company_partner_declarations IS 'Declaratory corporate ownership/administration record. Additional partner consent is policy-driven, not mandatory by default for an ordinary marketplace.';
COMMENT ON TABLE company_memberships IS 'Unified company membership and permission layer shared by Recruitment and Marketplace modules.';
