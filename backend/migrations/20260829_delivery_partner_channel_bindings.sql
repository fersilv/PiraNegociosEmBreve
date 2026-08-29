-- Vínculo operacional de parceiros de entrega com as instâncias reais de WhatsApp.
-- Mantido separado de delivery_partners para que canal/instância possam mudar sem
-- reescrever regras comerciais, cotações ou histórico do parceiro.
--
-- instanceId é um identificador lógico, sem FK cross-module: o backend valida a
-- instância no momento do cadastro. Assim a migration de comércio não depende da
-- ordem em que as migrations do módulo WhatsApp forem executadas em uma instalação nova.

CREATE TABLE IF NOT EXISTS delivery_partner_channel_bindings (
  "partnerId" uuid PRIMARY KEY REFERENCES delivery_partners(id) ON DELETE CASCADE,
  "instanceId" uuid NULL,
  "targetType" varchar(32) NOT NULL,
  "targetId" varchar(255) NULL,
  "targetLabel" varchar(180) NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updatedByUserId" varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_partner_channel_binding_type_check CHECK (
    "targetType" IN ('WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED','WHATSAPP_GROUP_MANUAL','INTEGRATION')
  )
);

CREATE INDEX IF NOT EXISTS delivery_partner_channel_binding_instance_idx
  ON delivery_partner_channel_bindings("instanceId")
  WHERE "instanceId" IS NOT NULL;

COMMENT ON TABLE delivery_partner_channel_bindings IS
  'Canal operacional atual do parceiro. Mantém instância e destino separados do cadastro comercial e das tabelas de frete.';
