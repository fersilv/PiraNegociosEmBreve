CREATE TABLE IF NOT EXISTS whatsapp_group_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), instance_id uuid NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  group_id varchar(120) NOT NULL, group_name varchar(255), monitored boolean NOT NULL DEFAULT false,
  approve_members boolean NOT NULL DEFAULT false, save_contacts boolean NOT NULL DEFAULT false, send_welcome boolean NOT NULL DEFAULT false,
  include_group_description boolean NOT NULL DEFAULT true, reject_members boolean NOT NULL DEFAULT false, remove_members boolean NOT NULL DEFAULT false,
  manage_admins boolean NOT NULL DEFAULT false, edit_group_info boolean NOT NULL DEFAULT false, send_group_messages boolean NOT NULL DEFAULT false,
  welcome_template text, channel_url text, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_group_automation UNIQUE (instance_id, group_id)
);
CREATE TABLE IF NOT EXISTS whatsapp_group_member_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), instance_id uuid NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  group_id varchar(120) NOT NULL, member_wa_id varchar(120), member_canonical_id varchar(120), actor_wa_id varchar(120), event_type varchar(60) NOT NULL,
  payload jsonb, occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS whatsapp_member_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), instance_id uuid NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  canonical_wa_id varchar(120) NOT NULL, phone_number varchar(32), contact_saved_at timestamptz, welcome_sent_at timestamptz,
  welcome_message_id varchar(160), origin_group_id varchar(120), metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_member_onboarding UNIQUE (instance_id, canonical_wa_id)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_member_events_member ON whatsapp_group_member_events(instance_id, group_id, member_canonical_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_member_events_time ON whatsapp_group_member_events(instance_id, occurred_at DESC);
CREATE OR REPLACE FUNCTION touch_whatsapp_group_automation_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_whatsapp_group_automation_updated_at ON whatsapp_group_automations;
CREATE TRIGGER trg_whatsapp_group_automation_updated_at BEFORE UPDATE ON whatsapp_group_automations FOR EACH ROW EXECUTE FUNCTION touch_whatsapp_group_automation_updated_at();
DROP TRIGGER IF EXISTS trg_whatsapp_member_onboarding_updated_at ON whatsapp_member_onboarding;
CREATE TRIGGER trg_whatsapp_member_onboarding_updated_at BEFORE UPDATE ON whatsapp_member_onboarding FOR EACH ROW EXECUTE FUNCTION touch_whatsapp_group_automation_updated_at();
