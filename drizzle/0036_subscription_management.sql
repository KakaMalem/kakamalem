-- =============================================================================
-- SUBSCRIPTION MANAGEMENT: Pause/Resume + Reminder Tracking
-- =============================================================================
-- Adds ability to pause/resume subscriptions and track renewal reminders sent
-- =============================================================================

-- Add pause/resume fields to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_resume_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pause_credits_days INTEGER DEFAULT 0;

-- Track renewal reminders sent (avoid duplicate notifications)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_reminder_days_before INTEGER;

-- Add subscription refunds table for tracking prorated refunds
CREATE TABLE IF NOT EXISTS subscription_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Refund details
  original_amount DECIMAL(14, 2) NOT NULL,      -- What was paid
  refund_amount DECIMAL(14, 2) NOT NULL,        -- Prorated refund
  days_used INTEGER NOT NULL,                   -- Days of subscription used
  days_remaining INTEGER NOT NULL,              -- Days refunded
  daily_rate DECIMAL(14, 4) NOT NULL,           -- Calculated daily rate

  -- Billing period being refunded
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Processing
  reason TEXT NOT NULL,                         -- Reason for refund
  reason_code VARCHAR(50) NOT NULL,             -- 'cancellation' | 'downgrade' | 'admin' | 'dispute'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'processing' | 'completed' | 'rejected'

  -- Payment method for refund
  refund_method VARCHAR(50),                    -- 'original_payment' | 'store_credit' | 'manual'
  gateway_refund_id VARCHAR(255),               -- Stripe refund ID if applicable

  -- Audit (no FK constraints - user might be deleted but we keep audit trail)
  requested_by UUID,
  approved_by UUID,
  processed_by UUID,

  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,

  admin_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_subscription_refunds_tenant ON subscription_refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_refunds_status ON subscription_refunds(status);

-- Comment for documentation
COMMENT ON TABLE subscription_refunds IS 'Tracks prorated subscription refunds for cancelled/downgraded Pro subscriptions';
COMMENT ON COLUMN tenants.paused_at IS 'When the subscription was paused (NULL if active)';
COMMENT ON COLUMN tenants.pause_reason IS 'Reason for pausing the subscription';
COMMENT ON COLUMN tenants.auto_resume_at IS 'Optional date when subscription should auto-resume';
COMMENT ON COLUMN tenants.pause_credits_days IS 'Days of subscription credited due to pause (extends renewal date)';
COMMENT ON COLUMN tenants.last_reminder_sent_at IS 'When the last renewal reminder was sent';
COMMENT ON COLUMN tenants.last_reminder_days_before IS 'How many days before expiry the last reminder was for (7, 3, 1)';
