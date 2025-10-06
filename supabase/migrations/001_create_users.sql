-- Migration: 001_create_users.sql
-- Description: Create users table for identity and consent management
-- Constitution: Backend-First, Supabase as Source of Truth, Security by Default

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_users_telegram_user_id ON users(telegram_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_account_status ON users(account_status) WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE users IS 'Identity table: Telegram user ID, consent, account status. PII isolated in user_profiles.';
COMMENT ON COLUMN users.telegram_user_id IS 'Telegram user ID from Telegram API (unique identifier)';
COMMENT ON COLUMN users.consent_given IS 'User consent for medical data processing (GDPR compliance)';
COMMENT ON COLUMN users.account_status IS 'Account status: active (default), suspended, deleted';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp for GDPR right to erasure';
