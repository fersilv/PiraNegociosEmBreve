ALTER TABLE users
  ADD COLUMN IF NOT EXISTS city varchar,
  ADD COLUMN IF NOT EXISTS state varchar(2),
  ADD COLUMN IF NOT EXISTS "jobPreferences" jsonb;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "pcdMode" varchar(16) NOT NULL DEFAULT 'GENERAL';

UPDATE users
SET
  city = trim(split_part(address, ',', 1)),
  state = upper(trim(split_part(address, ',', 2)))
WHERE
  city IS NULL
  AND state IS NULL
  AND address IS NOT NULL
  AND address ~ ',\s*[A-Za-z]{2}\s*$';

CREATE INDEX IF NOT EXISTS idx_users_city_state
  ON users (lower(city), upper(state));

CREATE INDEX IF NOT EXISTS idx_jobs_pcd_mode
  ON jobs ("pcdMode");
