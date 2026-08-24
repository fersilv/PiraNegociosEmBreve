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
