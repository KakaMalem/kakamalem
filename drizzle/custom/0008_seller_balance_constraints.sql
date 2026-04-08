-- Prevent negative balances in seller_balances table.
-- These constraints ensure no application bug or race condition
-- can result in a seller having negative available/pending/reserved funds.

DO $$ BEGIN
  ALTER TABLE seller_balances
    ADD CONSTRAINT check_available_non_negative CHECK (available::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE seller_balances
    ADD CONSTRAINT check_pending_non_negative CHECK (pending::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE seller_balances
    ADD CONSTRAINT check_reserved_non_negative CHECK (reserved::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
