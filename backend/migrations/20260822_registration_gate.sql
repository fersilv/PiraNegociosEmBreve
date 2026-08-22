CREATE TABLE IF NOT EXISTS registration_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  source varchar(16) NOT NULL DEFAULT 'EMAIL',
  status varchar(16) NOT NULL DEFAULT 'WAITING',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_interests_status_created
  ON registration_interests (status, "createdAt" DESC);

INSERT INTO settings (key, value, description, "isPublic", "createdAt", "updatedAt")
VALUES (
  'ALLOW_NEW_REGISTRATIONS',
  'true',
  'Controla se novos membros podem concluir o cadastro na plataforma.',
  true,
  now(),
  now()
)
ON CONFLICT (key) DO NOTHING;
