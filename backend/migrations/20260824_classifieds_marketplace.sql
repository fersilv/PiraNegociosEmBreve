CREATE TABLE IF NOT EXISTS classified_categories (
  slug varchar(80) PRIMARY KEY,
  name varchar(120) NOT NULL,
  icon varchar(60),
  "parentSlug" varchar(80),
  "sortOrder" integer NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  "attributeSchema" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classified_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(180) NOT NULL UNIQUE,
  "sellerUserId" varchar NOT NULL,
  "companyId" uuid,
  "categorySlug" varchar(80) NOT NULL,
  title varchar(160) NOT NULL,
  description text NOT NULL,
  price numeric(12,2),
  "priceType" varchar(20) NOT NULL DEFAULT 'FIXED',
  condition varchar(24) NOT NULL DEFAULT 'USED',
  city varchar(120) NOT NULL,
  state varchar(2) NOT NULL,
  neighborhood varchar(140),
  "zipCode" varchar(20),
  latitude numeric(10,7),
  longitude numeric(10,7),
  status varchar(24) NOT NULL DEFAULT 'DRAFT',
  "isFeatured" boolean NOT NULL DEFAULT false,
  "sellerVerifiedSnapshot" boolean NOT NULL DEFAULT false,
  "viewsCount" integer NOT NULL DEFAULT 0,
  "favoritesCount" integer NOT NULL DEFAULT 0,
  attributes jsonb,
  "contactPhone" varchar(40),
  "contactWhatsapp" varchar(40),
  "publishedAt" timestamptz,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_classified_listing_user
    FOREIGN KEY ("sellerUserId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_classified_listing_company
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_classified_listing_category
    FOREIGN KEY ("categorySlug") REFERENCES classified_categories(slug)
);

CREATE INDEX IF NOT EXISTS idx_classified_listings_seller ON classified_listings ("sellerUserId");
CREATE INDEX IF NOT EXISTS idx_classified_listings_company ON classified_listings ("companyId");
CREATE INDEX IF NOT EXISTS idx_classified_listings_category ON classified_listings ("categorySlug");
CREATE INDEX IF NOT EXISTS idx_classified_listings_status ON classified_listings (status);
CREATE INDEX IF NOT EXISTS idx_classified_listings_location ON classified_listings (state, city);
CREATE INDEX IF NOT EXISTS idx_classified_listings_published ON classified_listings ("publishedAt" DESC) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_classified_listings_featured ON classified_listings ("isFeatured", "publishedAt" DESC) WHERE status = 'PUBLISHED';

CREATE TABLE IF NOT EXISTS classified_listing_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" uuid NOT NULL,
  url text NOT NULL,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "isPrimary" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_classified_image_listing
    FOREIGN KEY ("listingId") REFERENCES classified_listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classified_images_listing ON classified_listing_images ("listingId", "sortOrder");

CREATE TABLE IF NOT EXISTS classified_favorites (
  "userId" varchar NOT NULL,
  "listingId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "listingId"),
  CONSTRAINT fk_classified_favorite_user
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_classified_favorite_listing
    FOREIGN KEY ("listingId") REFERENCES classified_listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classified_favorites_listing ON classified_favorites ("listingId");

INSERT INTO classified_categories (slug, name, icon, "sortOrder", "attributeSchema") VALUES
  ('veiculos', 'Veículos', 'car', 10, '[{"key":"brand","label":"Marca","type":"text"},{"key":"model","label":"Modelo","type":"text"},{"key":"year","label":"Ano","type":"number"},{"key":"mileage","label":"Quilometragem","type":"number"},{"key":"transmission","label":"Câmbio","type":"text"},{"key":"fuel","label":"Combustível","type":"text"}]'::jsonb),
  ('imoveis', 'Imóveis', 'house', 20, '[{"key":"dealType","label":"Venda ou aluguel","type":"text"},{"key":"propertyType","label":"Tipo de imóvel","type":"text"},{"key":"bedrooms","label":"Quartos","type":"number"},{"key":"bathrooms","label":"Banheiros","type":"number"},{"key":"parking","label":"Vagas","type":"number"},{"key":"area","label":"Área em m²","type":"number"}]'::jsonb),
  ('eletronicos', 'Eletrônicos', 'smartphone', 30, '[{"key":"brand","label":"Marca","type":"text"},{"key":"model","label":"Modelo","type":"text"},{"key":"warranty","label":"Garantia","type":"text"}]'::jsonb),
  ('celulares', 'Celulares', 'phone', 40, '[{"key":"brand","label":"Marca","type":"text"},{"key":"model","label":"Modelo","type":"text"},{"key":"storage","label":"Armazenamento","type":"text"}]'::jsonb),
  ('informatica', 'Informática', 'laptop', 50, '[{"key":"brand","label":"Marca","type":"text"},{"key":"model","label":"Modelo","type":"text"},{"key":"specs","label":"Configuração","type":"text"}]'::jsonb),
  ('casa-moveis', 'Casa e móveis', 'sofa', 60, NULL),
  ('moda-beleza', 'Moda e beleza', 'shirt', 70, '[{"key":"size","label":"Tamanho","type":"text"},{"key":"brand","label":"Marca","type":"text"}]'::jsonb),
  ('criancas-bebes', 'Crianças e bebês', 'baby', 80, NULL),
  ('esportes-lazer', 'Esportes e lazer', 'dumbbell', 90, NULL),
  ('agro-ferramentas', 'Agro e ferramentas', 'wrench', 100, NULL),
  ('animais', 'Animais', 'paw-print', 110, NULL),
  ('servicos', 'Serviços', 'briefcase-business', 120, '[{"key":"serviceArea","label":"Área de atuação","type":"text"},{"key":"serviceMode","label":"Atendimento","type":"text"},{"key":"coverage","label":"Região atendida","type":"text"}]'::jsonb),
  ('outros', 'Outros', 'package', 999, NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  "sortOrder" = EXCLUDED."sortOrder",
  "attributeSchema" = EXCLUDED."attributeSchema",
  "isActive" = true;
