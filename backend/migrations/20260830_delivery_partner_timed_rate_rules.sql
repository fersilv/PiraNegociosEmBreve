-- Precificação de parceiros por dia/horário.
-- As condições são internas e afetam apenas a seleção da regra de frete.

ALTER TABLE delivery_partner_rate_rules
  ADD COLUMN IF NOT EXISTS label varchar(120) NULL,
  ADD COLUMN IF NOT EXISTS "daysOfWeek" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "timeStart" varchar(5) NULL,
  ADD COLUMN IF NOT EXISTS "timeEnd" varchar(5) NULL,
  ADD COLUMN IF NOT EXISTS timezone varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo';

ALTER TABLE delivery_partner_rate_rules
  DROP CONSTRAINT IF EXISTS delivery_partner_rate_rules_time_start_check,
  DROP CONSTRAINT IF EXISTS delivery_partner_rate_rules_time_end_check,
  DROP CONSTRAINT IF EXISTS delivery_partner_rate_rules_time_pair_check,
  DROP CONSTRAINT IF EXISTS delivery_partner_rate_rules_days_check;

ALTER TABLE delivery_partner_rate_rules
  ADD CONSTRAINT delivery_partner_rate_rules_time_start_check
    CHECK ("timeStart" IS NULL OR "timeStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT delivery_partner_rate_rules_time_end_check
    CHECK ("timeEnd" IS NULL OR "timeEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT delivery_partner_rate_rules_time_pair_check
    CHECK (("timeStart" IS NULL) = ("timeEnd" IS NULL)),
  ADD CONSTRAINT delivery_partner_rate_rules_days_check
    CHECK (jsonb_typeof("daysOfWeek") = 'array');

COMMENT ON COLUMN delivery_partner_rate_rules."daysOfWeek" IS
  'Dias válidos da regra, 0=domingo ... 6=sábado. Lista vazia significa todos os dias.';
COMMENT ON COLUMN delivery_partner_rate_rules."timeStart" IS
  'Horário local inclusivo de início da faixa. Faixas que atravessam meia-noite são suportadas.';
COMMENT ON COLUMN delivery_partner_rate_rules."timeEnd" IS
  'Horário local exclusivo de fim da faixa.';
COMMENT ON COLUMN delivery_partner_rate_rules.timezone IS
  'Timezone IANA usada para avaliar dia e horário da regra.';
