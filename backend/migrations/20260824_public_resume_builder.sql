-- Produto público e anônimo de criação de currículos.
-- O conteúdo do currículo NÃO é persistido nestas tabelas: somente sessão, funil e pedidos.

CREATE TABLE IF NOT EXISTS public_resume_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tokenHash" varchar(64) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "convertedUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "watermarkUnlocked" boolean NOT NULL DEFAULT false,
  "userAgent" varchar(500) NULL,
  referrer text NULL,
  "utmSource" varchar(160) NULL,
  "utmMedium" varchar(160) NULL,
  "utmCampaign" varchar(200) NULL,
  "utmContent" varchar(200) NULL,
  "utmTerm" varchar(200) NULL,
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "lastSeenAt" timestamptz NOT NULL DEFAULT now(),
  "completedAt" timestamptz NULL,
  "convertedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_resume_sessions_status_check CHECK (status IN ('ACTIVE','COMPLETED','CONVERTED','EXPIRED'))
);
CREATE INDEX IF NOT EXISTS public_resume_sessions_created_idx ON public_resume_sessions ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS public_resume_sessions_conversion_idx ON public_resume_sessions ("convertedAt" DESC) WHERE "convertedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS public_resume_sessions_utm_idx ON public_resume_sessions ("utmSource", "utmCampaign");

CREATE TABLE IF NOT EXISTS public_resume_events (
  id bigserial PRIMARY KEY,
  "sessionId" uuid NOT NULL REFERENCES public_resume_sessions(id) ON DELETE CASCADE,
  type varchar(64) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS public_resume_events_session_idx ON public_resume_events ("sessionId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS public_resume_events_type_idx ON public_resume_events (type, "createdAt" DESC);

INSERT INTO payment_products (code, name, description, "priceCents", enabled, "freeUses", "sortOrder") VALUES
  ('PUBLIC_RESUME_AI_REVIEW', 'Análise profissional do currículo', 'Analisa a qualidade do currículo público e entrega pontuação e recomendações objetivas.', 199, true, 0, 110),
  ('PUBLIC_RESUME_AI_IMPROVEMENT', 'Melhoria profissional do currículo', 'Propõe melhorias profissionais com IA sem inventar experiências ou competências.', 499, true, 0, 120),
  ('PUBLIC_RESUME_REMOVE_WATERMARK', 'Remover marca do currículo', 'Libera a exportação do currículo público sem o rodapé do PiraNegócios.', 199, true, 0, 130)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public_resume_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" uuid NOT NULL REFERENCES public_resume_sessions(id) ON DELETE CASCADE,
  "productCode" varchar(64) NOT NULL REFERENCES payment_products(code),
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  method varchar(12) NOT NULL DEFAULT 'PIX',
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
  "consumedAt" timestamptz NULL,
  "payerEmail" varchar(320) NULL,
  "isSimulation" boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_resume_orders_method_check CHECK (method = 'PIX'),
  CONSTRAINT public_resume_orders_status_check CHECK (status IN ('PENDING','PAID','EXPIRED','CANCELED','REFUNDED')),
  CONSTRAINT public_resume_orders_amount_check CHECK ("amountCents" >= 0 AND "originalAmountCents" >= 0 AND "discountCents" >= 0)
);
CREATE INDEX IF NOT EXISTS public_resume_orders_session_idx ON public_resume_orders ("sessionId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS public_resume_orders_status_idx ON public_resume_orders (status, "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS public_resume_orders_provider_id_unique
  ON public_resume_orders (provider, "providerPaymentId")
  WHERE "providerPaymentId" IS NOT NULL;
