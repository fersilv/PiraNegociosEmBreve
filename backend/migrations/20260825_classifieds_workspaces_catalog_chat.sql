-- Classificados: identidades Personal/Business, vitrine empresarial, catálogo flexível e negociação em tempo real.

ALTER TABLE classified_listings
  ADD COLUMN IF NOT EXISTS "listingType" varchar(20) NOT NULL DEFAULT 'PRODUCT',
  ADD COLUMN IF NOT EXISTS "publicationChannels" jsonb NOT NULL DEFAULT '["CLASSIFIEDS"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "catalogConfig" jsonb;

CREATE INDEX IF NOT EXISTS idx_classified_listings_company_page
  ON classified_listings ("companyId", "publishedAt" DESC)
  WHERE status = 'PUBLISHED';

CREATE TABLE IF NOT EXISTS classified_user_preferences (
  "userId" varchar PRIMARY KEY,
  "lastIdentityType" varchar(16),
  "lastCompanyId" uuid,
  "personalTermsVersion" varchar(32),
  "personalTermsAcceptedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_classified_pref_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_classified_pref_company FOREIGN KEY ("lastCompanyId") REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT ck_classified_pref_identity CHECK ("lastIdentityType" IS NULL OR "lastIdentityType" IN ('PERSONAL', 'COMPANY'))
);

CREATE TABLE IF NOT EXISTS company_classified_profiles (
  "companyId" uuid PRIMARY KEY,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "termsVersion" varchar(32),
  "termsAcceptedAt" timestamptz,
  "termsAcceptedByUserId" varchar,
  "businessSegments" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "canSellProducts" boolean NOT NULL DEFAULT true,
  "canOfferServices" boolean NOT NULL DEFAULT false,
  "defaultPublicationChannels" jsonb NOT NULL DEFAULT '["CLASSIFIEDS","COMPANY_PAGE"]'::jsonb,
  "pageSectionLabel" varchar(80),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_company_classified_profile_company FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_company_classified_profile_terms_user FOREIGN KEY ("termsAcceptedByUserId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS classified_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" uuid NOT NULL,
  "buyerUserId" varchar NOT NULL,
  "sellerUserId" varchar NOT NULL,
  "sellerCompanyId" uuid,
  "buyerLastReadAt" timestamptz,
  "sellerLastReadAt" timestamptz,
  "lastMessageAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_classified_conversation_listing FOREIGN KEY ("listingId") REFERENCES classified_listings(id) ON DELETE CASCADE,
  CONSTRAINT fk_classified_conversation_buyer FOREIGN KEY ("buyerUserId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_classified_conversation_seller FOREIGN KEY ("sellerUserId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_classified_conversation_company FOREIGN KEY ("sellerCompanyId") REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT uq_classified_conversation_buyer_listing UNIQUE ("listingId", "buyerUserId")
);

CREATE INDEX IF NOT EXISTS idx_classified_conversations_buyer ON classified_conversations ("buyerUserId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS idx_classified_conversations_seller ON classified_conversations ("sellerUserId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS idx_classified_conversations_company ON classified_conversations ("sellerCompanyId", "lastMessageAt" DESC);

CREATE TABLE IF NOT EXISTS classified_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" uuid NOT NULL,
  "senderId" varchar NOT NULL,
  "senderName" varchar(160) NOT NULL,
  body text NOT NULL,
  "messageType" varchar(20) NOT NULL DEFAULT 'TEXT',
  metadata jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_classified_message_conversation FOREIGN KEY ("conversationId") REFERENCES classified_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_classified_message_sender FOREIGN KEY ("senderId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classified_messages_conversation
  ON classified_conversation_messages ("conversationId", "createdAt" ASC);
