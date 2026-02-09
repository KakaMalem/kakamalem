-- Migration: Yearly Billing and Crypto Payments
-- Description: Add yearly subscription support and self-hosted USDT crypto payments

-- ============================================================================
-- 1. Add yearly pricing to platform settings
-- ============================================================================
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS pro_plan_yearly_price_afn DECIMAL(10,2) NOT NULL DEFAULT '11000';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS usdt_wallet_config JSONB;

-- ============================================================================
-- 2. Add billing interval to tenants
-- ============================================================================
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(10) NOT NULL DEFAULT 'monthly';

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS stripe_yearly_price_id VARCHAR(255);

-- ============================================================================
-- 3. Add crypto_usdt to payment gateway enum
-- ============================================================================
ALTER TYPE payment_gateway ADD VALUE IF NOT EXISTS 'crypto_usdt';

-- ============================================================================
-- 4. Create crypto payment status enum
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE crypto_payment_status AS ENUM (
    'pending',
    'submitted',
    'verified',
    'expired',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 5. Create crypto network enum
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE crypto_network AS ENUM (
    'trc20',
    'erc20',
    'bep20'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 6. Create crypto payments table
-- ============================================================================
CREATE TABLE IF NOT EXISTS crypto_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_session_id UUID NOT NULL REFERENCES payment_sessions(id) ON DELETE CASCADE,

  -- Network and wallet
  network crypto_network NOT NULL,
  wallet_address VARCHAR(100) NOT NULL,

  -- Amount
  expected_amount DECIMAL(20,8) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USDT',

  -- Exchange rate at time of payment
  exchange_rate DECIMAL(20,8),
  original_amount_afn DECIMAL(14,2),

  -- Verification
  transaction_hash VARCHAR(100),
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,

  -- Status
  status crypto_payment_status NOT NULL DEFAULT 'pending',

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,

  -- Notes
  customer_notes TEXT,
  admin_notes TEXT,
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. Create indexes for crypto payments
-- ============================================================================
CREATE INDEX IF NOT EXISTS crypto_payments_session_idx ON crypto_payments(payment_session_id);
CREATE INDEX IF NOT EXISTS crypto_payments_status_idx ON crypto_payments(status);
CREATE INDEX IF NOT EXISTS crypto_payments_hash_idx ON crypto_payments(transaction_hash);
CREATE INDEX IF NOT EXISTS crypto_payments_expires_idx ON crypto_payments(expires_at);

-- ============================================================================
-- 8. Add comment for documentation
-- ============================================================================
COMMENT ON TABLE crypto_payments IS 'Self-hosted USDT crypto payment verification workflow. Customer sends USDT to platform wallet, submits transaction hash, admin verifies.';
COMMENT ON COLUMN crypto_payments.network IS 'Crypto network: trc20 (Tron), erc20 (Ethereum), bep20 (BSC)';
COMMENT ON COLUMN crypto_payments.expected_amount IS 'Expected USDT amount with high precision';
COMMENT ON COLUMN crypto_payments.exchange_rate IS 'AFN to USDT exchange rate at payment time';
COMMENT ON COLUMN platform_settings.pro_plan_yearly_price_afn IS 'Admin-configurable yearly price for Pro plan in AFN';
COMMENT ON COLUMN platform_settings.usdt_wallet_config IS 'USDT wallet addresses per network for crypto payments';
COMMENT ON COLUMN tenants.billing_interval IS 'Subscription billing interval: monthly or yearly';
