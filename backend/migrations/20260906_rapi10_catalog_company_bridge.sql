-- Ponte comercial PiraNegócios -> Catálogo Rapi10.
-- Mantém o endereço comercial como fonte e o endereço jurídico separado.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS "rapi10CatalogOptIn" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "businessHoursJson" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "specialBusinessDatesJson" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "servicesTagsJson" jsonb NULL;

COMMENT ON COLUMN companies."rapi10CatalogOptIn" IS 'Empresa autoriza ser candidata ao Catálogo Rapi10. A publicação final depende de validação operacional de coordenadas e categoria na Rapi10.';
COMMENT ON COLUMN companies."businessHoursJson" IS 'Linhas de horário comercial informadas pela empresa.';
COMMENT ON COLUMN companies."specialBusinessDatesJson" IS 'Datas/horários especiais informados pela empresa.';
COMMENT ON COLUMN companies."servicesTagsJson" IS 'Produtos, serviços ou atividades informados pela empresa para apresentação comercial.';
