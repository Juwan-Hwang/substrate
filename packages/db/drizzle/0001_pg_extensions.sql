-- Migration 0001: Platform-level utilities
--
-- Generic updated_at trigger function — usable by any application table.
-- Application tables create their own triggers using this function.

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
