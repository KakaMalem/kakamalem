-- USDT Payout Support Migration
-- Adds crypto-specific fields for seller and affiliate payouts
-- Adds purpose and tenant_id to crypto_payments for subscription payments

-- ============================================================================
-- 1. SELLER PAYOUTS - Add crypto fields
-- ============================================================================
ALTER TABLE seller_payouts
ADD COLUMN IF NOT EXISTS crypto_network VARCHAR(10),
ADD COLUMN IF NOT EXISTS crypto_tx_hash VARCHAR(100),
ADD COLUMN IF NOT EXISTS crypto_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN seller_payouts.crypto_network IS 'Crypto network for USDT payouts (trc20, erc20, bep20)';
COMMENT ON COLUMN seller_payouts.crypto_tx_hash IS 'Transaction hash when admin sends crypto payout';
COMMENT ON COLUMN seller_payouts.crypto_sent_at IS 'Timestamp when crypto was sent by admin';

-- ============================================================================
-- 2. PLATFORM AFFILIATE PAYOUTS - Add crypto fields
-- ============================================================================
ALTER TABLE platform_affiliate_payouts
ADD COLUMN IF NOT EXISTS crypto_tx_hash VARCHAR(100),
ADD COLUMN IF NOT EXISTS crypto_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN platform_affiliate_payouts.crypto_tx_hash IS 'Transaction hash when admin sends crypto payout';
COMMENT ON COLUMN platform_affiliate_payouts.crypto_sent_at IS 'Timestamp when crypto was sent by admin';

-- ============================================================================
-- 3. CRYPTO PAYMENTS - Add purpose and tenant_id for subscription payments
-- ============================================================================
-- Purpose: 'order' (default) for store checkout, 'subscription' for Pro plan payments
ALTER TABLE crypto_payments
ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) DEFAULT 'order',
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

COMMENT ON COLUMN crypto_payments.purpose IS 'Payment purpose: order (store checkout) or subscription (Pro plan)';
COMMENT ON COLUMN crypto_payments.tenant_id IS 'Tenant ID for subscription payments';

-- Add index for tenant lookup
CREATE INDEX IF NOT EXISTS crypto_payments_tenant_idx ON crypto_payments(tenant_id);
CREATE INDEX IF NOT EXISTS crypto_payments_purpose_idx ON crypto_payments(purpose);
