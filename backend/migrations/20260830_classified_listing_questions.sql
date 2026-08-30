-- Perguntas de produtos/serviços.
-- A pergunta nasce privada entre autor e empresa e só se torna pública após resposta.

CREATE TABLE IF NOT EXISTS classified_listing_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE CASCADE,
  "askerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  question text NOT NULL,
  "normalizedQuestion" text NOT NULL,
  answer text NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  "answeredByUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "answeredAt" timestamptz NULL,
  "publishedAt" timestamptz NULL,
  "helpfulCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_listing_questions_status_check CHECK (status IN ('PENDING','ANSWERED','HIDDEN')),
  CONSTRAINT classified_listing_questions_question_check CHECK (char_length(question) BETWEEN 5 AND 600),
  CONSTRAINT classified_listing_questions_answer_check CHECK (answer IS NULL OR char_length(answer) BETWEEN 2 AND 1800),
  CONSTRAINT classified_listing_questions_helpful_check CHECK ("helpfulCount" >= 0)
);

CREATE INDEX IF NOT EXISTS classified_listing_questions_public_idx
  ON classified_listing_questions("listingId", status, "publishedAt" DESC)
  WHERE status='ANSWERED';
CREATE INDEX IF NOT EXISTS classified_listing_questions_company_idx
  ON classified_listing_questions("companyId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_listing_questions_asker_idx
  ON classified_listing_questions("askerUserId", "listingId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS classified_listing_question_helpful (
  "questionId" uuid NOT NULL REFERENCES classified_listing_questions(id) ON DELETE CASCADE,
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("questionId","userId")
);
