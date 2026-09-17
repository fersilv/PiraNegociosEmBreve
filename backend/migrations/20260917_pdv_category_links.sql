-- PDV Inteligente: mapeamento seguro de categorias por empresa.
CREATE TABLE IF NOT EXISTS pdv_category_links (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "pdvCategoryId" varchar(120) NOT NULL,
  "categorySlug" varchar(80) NOT NULL REFERENCES classified_categories(slug) ON DELETE RESTRICT,
  "remoteSnapshot" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdv_category_links_company_remote_uq UNIQUE ("companyId","pdvCategoryId")
);
CREATE INDEX IF NOT EXISTS idx_pdv_category_links_company_slug ON pdv_category_links("companyId","categorySlug");
