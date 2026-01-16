ALTER TABLE truelayer_accounts
  ADD COLUMN sync_status text NOT NULL DEFAULT 'OK',
  ADD COLUMN last_synced_at timestamptz,
  ADD COLUMN next_sync_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX idx_truelayer_accounts_sync_due
ON truelayer_accounts (next_sync_at)
WHERE sync_status = 'OK';
