BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "publishedResumeSnapshot" jsonb;

UPDATE users
SET "publishedResumeSnapshot" = jsonb_build_object(
  'version', 1,
  'publishedAt', COALESCE("resumePublishedAt", "updatedAt", NOW()),
  'fullName', "fullName",
  'socialName', "socialName",
  'phone', phone,
  'email', email,
  'city', city,
  'state', state,
  'address', address,
  'bio', bio,
  'experiences', COALESCE(experiences, '[]'::jsonb),
  'education', COALESCE(education, '[]'::jsonb),
  'skills', COALESCE(skills, '[]'::jsonb),
  'courses', COALESCE(courses, '[]'::jsonb),
  'languages', COALESCE(languages, '[]'::jsonb),
  'salaryExpectation', "salaryExpectation",
  'resumePhotoURL', "resumePhotoURL",
  'resumePreferences', COALESCE("resumePreferences", '{}'::jsonb),
  'score', CASE
    WHEN "aiAnalysis" ? 'score' THEN "aiAnalysis" -> 'score'
    ELSE 'null'::jsonb
  END
)
WHERE "resumeStatus" = 'PUBLISHED'
  AND "publishedResumeSnapshot" IS NULL;

COMMIT;
