ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "applicationUrl" text;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "applicationUrlTitle" varchar(180);
