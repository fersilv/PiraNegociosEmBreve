-- Ponte comercial PiraNegócios → Catálogo Rapi10.
-- A empresa controla o opt-in. A Rapi10 continua responsável por categoria e coordenada operacional.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS "rapi10CatalogEnabled" boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN companies."rapi10CatalogEnabled" IS
  'Permite que empresa verificada seja candidata ao Catálogo Rapi10. Publicação final depende de validação operacional na Rapi10.';
