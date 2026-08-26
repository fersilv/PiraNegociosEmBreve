-- Verificação empresarial simplificada por CNPJ público + selfie + aceite.
-- A infraestrutura documental anterior permanece disponível para uma política futura,
-- mas não é requisito do fluxo padrão desta versão.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS "hasCnpj" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "legalName" varchar(240) NULL,
  ADD COLUMN IF NOT EXISTS "registryTradeName" varchar(240) NULL,
  ADD COLUMN IF NOT EXISTS "legalAddress" text NULL,
  ADD COLUMN IF NOT EXISTS "legalCity" varchar(120) NULL,
  ADD COLUMN IF NOT EXISTS "legalState" varchar(2) NULL,
  ADD COLUMN IF NOT EXISTS "legalZipCode" varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS "cnpjSituation" varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS "cnpjDataSource" varchar(40) NULL,
  ADD COLUMN IF NOT EXISTS "cnpjDataCheckedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "cnpjDataUpdatedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "cnpjSnapshot" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "cnpjChangeAlert" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "commercialAddressSameAsLegal" boolean NOT NULL DEFAULT true;

UPDATE companies SET "hasCnpj"=true WHERE NULLIF(regexp_replace(COALESCE(cnpj,''),'[^0-9A-Za-z]','','g'),'') IS NOT NULL;

-- O fluxo anterior criava uma janela automática de KYC documental para empresas já
-- verificadas. No modelo simplificado, empresas que já tinham selo não perdem acesso.
UPDATE companies
SET "complianceStatus"='APPROVED',
    "complianceGraceDeadline"=NULL,
    "complianceSuspendedAt"=NULL,
    "complianceSuspensionReason"=NULL
WHERE "isVerified"=true OR "verificationStatus"='VERIFIED';

ALTER TABLE identity_verifications
  ADD COLUMN IF NOT EXISTS "verificationMethod" varchar(32) NOT NULL DEFAULT 'SELFIE_MANUAL',
  ADD COLUMN IF NOT EXISTS "selectedQsaName" varchar(180) NULL,
  ADD COLUMN IF NOT EXISTS "selectedQsaQualification" varchar(180) NULL,
  ADD COLUMN IF NOT EXISTS "declaresAtLeast25Percent" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS company_verification_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "requestedByUserId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "partnerName" varchar(180) NOT NULL,
  "partnerEmail" varchar(255) NOT NULL,
  "partnerPhone" varchar(40) NULL,
  "qsaQualification" varchar(180) NULL,
  "tokenHash" varchar(64) NOT NULL UNIQUE,
  status varchar(24) NOT NULL DEFAULT 'PENDING',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  "grantFullPowers" boolean NOT NULL DEFAULT true,
  "consentVersion" varchar(32) NULL,
  "consentAcceptedAt" timestamptz NULL,
  "submittedAt" timestamptz NULL,
  "reviewedAt" timestamptz NULL,
  "reviewedByUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "reviewReason" text NULL,
  "selfieStorageKey" varchar(180) NULL UNIQUE,
  "selfieMimeType" varchar(100) NULL,
  "selfieOriginalName" varchar(240) NULL,
  "selfieSizeBytes" bigint NULL,
  "selfieSha256" varchar(64) NULL,
  "selfieIvBase64" varchar(64) NULL,
  "selfieTagBase64" varchar(64) NULL,
  "expiresAt" timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_verification_authorization_status_check
    CHECK (status IN ('PENDING','SUBMITTED','APPROVED','REJECTED','EXPIRED','REVOKED')),
  CONSTRAINT company_verification_authorization_selfie_size_check
    CHECK ("selfieSizeBytes" IS NULL OR ("selfieSizeBytes" > 0 AND "selfieSizeBytes" <= 12582912))
);
CREATE INDEX IF NOT EXISTS company_verification_authorizations_company_idx
  ON company_verification_authorizations("companyId",status,"createdAt" DESC);
CREATE INDEX IF NOT EXISTS company_verification_authorizations_email_idx
  ON company_verification_authorizations(lower("partnerEmail"),status);

COMMENT ON COLUMN companies."legalAddress" IS 'Endereço jurídico obtido da consulta pública do CNPJ. Não deve ser sobrescrito pelo endereço comercial.';
COMMENT ON COLUMN companies.address IS 'Endereço comercial exibido pela empresa. Pode ser igual ou diferente do endereço jurídico.';
COMMENT ON COLUMN companies.name IS 'Nome comercial usado na plataforma; pode ser diferente da razão social.';
COMMENT ON TABLE company_verification_authorizations IS 'Autorização simplificada por sócio responsável quando o criador da empresa não é o sócio responsável pela validação.';
