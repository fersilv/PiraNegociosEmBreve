CREATE TABLE IF NOT EXISTS payment_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  description text NULL,
  "priceCents" integer NOT NULL DEFAULT 0,
  "promotionalPriceCents" integer NULL,
  "promotionStartsAt" timestamptz NULL,
  "promotionEndsAt" timestamptz NULL,
  enabled boolean NOT NULL DEFAULT true,
  "freeUses" integer NOT NULL DEFAULT 0,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_products_price_check CHECK ("priceCents" >= 0),
  CONSTRAINT payment_products_promo_price_check CHECK ("promotionalPriceCents" IS NULL OR "promotionalPriceCents" >= 0),
  CONSTRAINT payment_products_free_uses_check CHECK ("freeUses" >= 0)
);

INSERT INTO payment_products (code, name, description, "priceCents", enabled, "freeUses", "sortOrder") VALUES
  ('RESUME_REANALYSIS', 'Nova análise do currículo', 'Recalcula a pontuação e as recomendações do currículo atual.', 199, true, 1, 10),
  ('RESUME_AI_IMPROVEMENT', 'Otimização profissional com IA', 'Cria sugestões de melhoria para o currículo, permite aceitar mudanças seletivamente e inclui nova análise.', 499, true, 0, 20),
  ('RESUME_AI_IMPORT', 'Nova organização por IA', 'Nova leitura e organização inteligente de documentos profissionais. A primeira utilização permanece gratuita.', 199, false, 1, 30)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "productCode" varchar(64) NOT NULL REFERENCES payment_products(code),
  method varchar(12) NOT NULL DEFAULT 'PIX',
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  "originalAmountCents" integer NOT NULL,
  "amountCents" integer NOT NULL,
  "discountCents" integer NOT NULL DEFAULT 0,
  provider varchar(80) NULL,
  "providerPaymentId" varchar(180) NULL,
  "pixCopyPaste" text NULL,
  "qrCodeBase64" text NULL,
  "expiresAt" timestamptz NULL,
  "paidAt" timestamptz NULL,
  "canceledAt" timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_method_check CHECK (method = 'PIX'),
  CONSTRAINT payments_status_check CHECK (status IN ('PENDING','PAID','EXPIRED','CANCELED','REFUNDED')),
  CONSTRAINT payments_amount_check CHECK ("amountCents" >= 0 AND "originalAmountCents" >= 0 AND "discountCents" >= 0)
);
CREATE INDEX IF NOT EXISTS payments_user_created_idx ON payments ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS payments_status_created_idx ON payments (status, "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_id_unique ON payments (provider, "providerPaymentId") WHERE "providerPaymentId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_feature_credits (
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature varchar(64) NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", feature),
  CONSTRAINT user_feature_credits_check CHECK (credits >= 0)
);

CREATE TABLE IF NOT EXISTS resume_analysis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source varchar(32) NOT NULL,
  score integer NOT NULL,
  analysis jsonb NOT NULL,
  "resumeSnapshot" jsonb NOT NULL,
  "paymentId" uuid NULL REFERENCES payments(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_analysis_score_check CHECK (score >= 0 AND score <= 100),
  CONSTRAINT resume_analysis_source_check CHECK (source IN ('FREE','REANALYSIS','IMPROVEMENT'))
);
CREATE INDEX IF NOT EXISTS resume_analysis_history_user_idx ON resume_analysis_history ("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS resume_improvement_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  "beforeSnapshot" jsonb NOT NULL,
  proposal jsonb NOT NULL,
  "selectedChangeIds" jsonb NULL,
  "paymentId" uuid NULL REFERENCES payments(id) ON DELETE SET NULL,
  "appliedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_improvement_status_check CHECK (status IN ('PENDING','APPLIED','PARTIAL','DISMISSED'))
);
CREATE INDEX IF NOT EXISTS resume_improvement_user_idx ON resume_improvement_proposals ("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS resume_publication_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  score integer NULL,
  status varchar(20) NOT NULL DEFAULT 'PUBLISHED',
  "publishedAt" timestamptz NOT NULL DEFAULT now(),
  "unpublishedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_publication_status_check CHECK (status IN ('PUBLISHED','UNPUBLISHED')),
  UNIQUE ("userId", version)
);
CREATE INDEX IF NOT EXISTS resume_publication_history_user_idx ON resume_publication_history ("userId", version DESC);
