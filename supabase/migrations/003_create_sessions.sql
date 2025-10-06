-- Migration: 003_create_sessions.sql
-- Description: Create sessions table for consultation session management
-- Constitution: Event-Driven Orchestration, Observability and Audit

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_status TEXT NOT NULL DEFAULT 'active' CHECK (session_status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for querying active sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(session_status) WHERE session_status = 'active';
CREATE INDEX idx_sessions_user_id_status ON sessions(user_id, session_status) WHERE session_status = 'active';

-- Comments
COMMENT ON TABLE sessions IS 'Consultation sessions: tracks user conversation context with status.';
COMMENT ON COLUMN sessions.user_id IS 'Foreign key to users.id (CASCADE delete for GDPR compliance)';
COMMENT ON COLUMN sessions.session_status IS 'Session status: active (default), completed, abandoned';
COMMENT ON COLUMN sessions.completed_at IS 'Timestamp when session completed or abandoned (NULL for active)';
