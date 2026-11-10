-- Daily aggregate counters. No per-user rows, IPs, cookies or identifiers.
CREATE TABLE IF NOT EXISTS ad_daily_stats (
  ad_id uuid NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  event_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  placement varchar(100) NOT NULL,
  slot integer NOT NULL CHECK(slot BETWEEN 0 AND 100),
  impressions bigint NOT NULL DEFAULT 0 CHECK(impressions >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK(clicks >= 0),
  PRIMARY KEY (ad_id,event_day,placement,slot)
);
CREATE INDEX IF NOT EXISTS ad_daily_stats_by_day ON ad_daily_stats(event_day);