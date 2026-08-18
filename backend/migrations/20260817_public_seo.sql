-- Public SEO addresses. Run once against production before deploying the backend.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug varchar;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS slug varchar;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements text;

WITH normalized AS (
  SELECT id,
    NULLIF(trim(both '-' FROM regexp_replace(translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')), '') AS base_slug,
    row_number() OVER (
      PARTITION BY NULLIF(trim(both '-' FROM regexp_replace(translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')), '')
      ORDER BY "createdAt", id
    ) AS sequence
  FROM companies
  WHERE slug IS NULL
)
UPDATE companies AS company
SET slug = CASE
  WHEN normalized.base_slug IS NULL THEN 'empresa-' || substring(company.id::text, 1, 8)
  WHEN normalized.sequence = 1 THEN left(normalized.base_slug, 72)
  ELSE left(normalized.base_slug, 60) || '-' || normalized.sequence
END
FROM normalized
WHERE company.id = normalized.id;

WITH normalized AS (
  SELECT job.id,
    NULLIF(trim(both '-' FROM regexp_replace(translate(lower(concat(job.title, '-', coalesce(company.slug, company.name))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')), '') AS base_slug,
    row_number() OVER (
      PARTITION BY NULLIF(trim(both '-' FROM regexp_replace(translate(lower(concat(job.title, '-', coalesce(company.slug, company.name))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')), '')
      ORDER BY job."createdAt", job.id
    ) AS sequence
  FROM jobs AS job
  LEFT JOIN companies AS company ON company.id = job."companyId"
  WHERE job.slug IS NULL
)
UPDATE jobs AS job
SET slug = CASE
  WHEN normalized.base_slug IS NULL THEN 'vaga-' || substring(job.id::text, 1, 8)
  WHEN normalized.sequence = 1 THEN left(normalized.base_slug, 72)
  ELSE left(normalized.base_slug, 60) || '-' || normalized.sequence
END
FROM normalized
WHERE job.id = normalized.id;

CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_unique_idx ON companies (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_slug_unique_idx ON jobs (slug) WHERE slug IS NOT NULL;
