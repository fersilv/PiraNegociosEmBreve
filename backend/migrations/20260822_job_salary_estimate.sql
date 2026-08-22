ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "estimatedSalary" varchar NULL,
  ADD COLUMN IF NOT EXISTS "estimatedSalarySource" varchar NULL,
  ADD COLUMN IF NOT EXISTS "estimatedSalarySourceUrl" text NULL,
  ADD COLUMN IF NOT EXISTS "estimatedSalaryRegion" varchar NULL,
  ADD COLUMN IF NOT EXISTS "estimatedSalaryUpdatedAt" timestamp NULL;

COMMENT ON COLUMN "jobs"."estimatedSalary" IS 'Optional market salary estimate. Only used for display when salary is not informed by the vacancy source.';
COMMENT ON COLUMN "jobs"."estimatedSalarySource" IS 'Human-readable source used to support the market salary estimate.';
COMMENT ON COLUMN "jobs"."estimatedSalarySourceUrl" IS 'Optional URL for the salary estimate source.';
COMMENT ON COLUMN "jobs"."estimatedSalaryRegion" IS 'Geographic scope used for the salary estimate, e.g. Pirassununga/SP or Estado de Sao Paulo.';
COMMENT ON COLUMN "jobs"."estimatedSalaryUpdatedAt" IS 'Date/time when the salary estimate was researched or refreshed.';
