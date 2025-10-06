-- Migration: 004_create_messages.sql
-- Description: Create messages table with idempotency constraint (telegram_message_id + telegram_user_id)
-- Constitution: Event-Driven Orchestration, Data Contracts First, Deterministic Integrations

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  telegram_message_id BIGINT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency constraint: prevent duplicate message processing
CREATE UNIQUE INDEX idx_messages_idempotency ON messages(telegram_message_id, telegram_user_id);

-- Indexes for querying
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_telegram_user_id ON messages(telegram_user_id);

-- Comments
COMMENT ON TABLE messages IS 'Message log: inbound and outbound messages with idempotency constraint.';
COMMENT ON COLUMN messages.session_id IS 'Foreign key to sessions.id (CASCADE delete for GDPR compliance)';
COMMENT ON COLUMN messages.telegram_message_id IS 'Telegram message ID from Telegram API';
COMMENT ON COLUMN messages.telegram_user_id IS 'Telegram user ID from Telegram API';
COMMENT ON COLUMN messages.direction IS 'Message direction: inbound (user to bot), outbound (bot to user)';
COMMENT ON COLUMN messages.content IS 'Message text content';
COMMENT ON INDEX idx_messages_idempotency IS 'Idempotency constraint: UNIQUE(telegram_message_id, telegram_user_id) prevents duplicate processing';
