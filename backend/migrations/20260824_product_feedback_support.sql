CREATE TABLE IF NOT EXISTS product_feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL,
  "userEmail" varchar NULL,
  "userName" varchar NULL,
  "profileType" varchar(30) NOT NULL DEFAULT 'CANDIDATE',
  "companyId" varchar NULL,
  kind varchar(24) NOT NULL DEFAULT 'IMPROVEMENT',
  "pagePath" varchar(500) NOT NULL,
  process varchar(160) NOT NULL,
  message text NOT NULL,
  screenshot jsonb NULL,
  status varchar(32) NOT NULL DEFAULT 'NEW',
  "adminNote" text NULL,
  expectation varchar(20) NULL,
  "expectationComment" text NULL,
  "expectationAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_feedback_status_created_idx
ON product_feedback_requests (status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS product_feedback_user_idx
ON product_feedback_requests ("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS product_feedback_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(180) NOT NULL,
  summary text NOT NULL,
  "feedbackIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "requestCount" integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  reason text NULL,
  source varchar(20) NOT NULL DEFAULT 'AI',
  "generatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_feedback_insights_rank_idx
ON product_feedback_insights (score DESC, "requestCount" DESC);

CREATE TABLE IF NOT EXISTS product_support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL,
  "userEmail" varchar NULL,
  "userName" varchar NULL,
  "profileType" varchar(30) NOT NULL DEFAULT 'CANDIDATE',
  "companyId" varchar NULL,
  "pagePath" varchar(500) NOT NULL,
  process varchar(160) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'AI_ACTIVE',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  screenshot jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_support_status_updated_idx
ON product_support_conversations (status, "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NULL,
  "userEmail" varchar NULL,
  "userName" varchar NULL,
  "profileType" varchar(30) NULL,
  "companyId" varchar NULL,
  feature varchar(80) NOT NULL,
  operation varchar(120) NOT NULL,
  "conversationId" uuid NULL,
  provider varchar(30) NULL,
  model varchar(160) NULL,
  "inputTokens" integer NOT NULL DEFAULT 0,
  "outputTokens" integer NOT NULL DEFAULT 0,
  "totalTokens" integer NOT NULL DEFAULT 0,
  estimated boolean NOT NULL DEFAULT false,
  success boolean NOT NULL DEFAULT true,
  error text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx
ON ai_usage_logs ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS ai_usage_feature_created_idx
ON ai_usage_logs (feature, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS support_faq_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(220) UNIQUE NOT NULL,
  title varchar(180) NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  "sourceConversationIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "requestCount" integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  "aiGenerated" boolean NOT NULL DEFAULT true,
  "publishedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_faq_status_updated_idx
ON support_faq_articles (status, "updatedAt" DESC);
