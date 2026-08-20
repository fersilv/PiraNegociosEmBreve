ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS jobs_skills_gin_idx
ON jobs USING gin (skills);
