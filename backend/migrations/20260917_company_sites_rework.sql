ALTER TABLE company_pages ALTER COLUMN "templateKey" SET DEFAULT 'institutional';

UPDATE company_pages
SET
  "templateKey" = CASE
    WHEN lower(COALESCE("templateKey", '')) IN ('vitrine','bazar','portal','loja','marketplace','catalogo','classificados-pro','mercado','gazeta','mosaico','radar','pregao') THEN 'store'
    WHEN lower(COALESCE("templateKey", '')) IN ('services','careers','institutional') THEN lower("templateKey")
    ELSE 'institutional'
  END,
  draft = jsonb_strip_nulls(jsonb_build_object(
    'version', 3,
    'siteType', CASE
      WHEN lower(COALESCE("templateKey", '')) IN ('vitrine','bazar','portal','loja','marketplace','catalogo','classificados-pro','mercado','gazeta','mosaico','radar','pregao') THEN 'store'
      WHEN lower(COALESCE("templateKey", '')) IN ('services','careers','institutional') THEN lower("templateKey")
      ELSE 'institutional'
    END,
    'whatsapp', NULLIF(COALESCE(draft->>'whatsapp', draft#>>'{contacts,whatsapp}'), ''),
    'businessHours', draft->'businessHours',
    'legal', draft->'legal'
  )),
  published = CASE WHEN published IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
    'version', 3,
    'siteType', CASE
      WHEN lower(COALESCE("templateKey", '')) IN ('vitrine','bazar','portal','loja','marketplace','catalogo','classificados-pro','mercado','gazeta','mosaico','radar','pregao') THEN 'store'
      WHEN lower(COALESCE("templateKey", '')) IN ('services','careers','institutional') THEN lower("templateKey")
      ELSE 'institutional'
    END,
    'whatsapp', NULLIF(COALESCE(published->>'whatsapp', published#>>'{contacts,whatsapp}'), ''),
    'businessHours', published->'businessHours',
    'legal', published->'legal'
  )) END;

DROP TABLE IF EXISTS company_page_previews;
