ALTER TABLE payments
ADD COLUMN IF NOT EXISTS "isSimulation" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS payments_simulation_status_idx
ON payments ("isSimulation", status, "createdAt" DESC);
