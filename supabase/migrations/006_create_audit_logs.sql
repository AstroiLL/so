-- Migration: 006_create_audit_logs.sql
-- Description: Create audit_logs table for observability and compliance
-- Constitution: Observability and Audit, Security by Default

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID,
  message_id UUID,
  operation_type TEXT NOT NULL,
  operation_status TEXT NOT NULL CHECK (operation_status IN ('success', 'failure')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_operation_type ON audit_logs(operation_type);
CREATE INDEX idx_audit_logs_operation_status ON audit_logs(operation_status);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Composite index for correlation ID queries
CREATE INDEX idx_audit_logs_correlation ON audit_logs(user_id, session_id, message_id);

-- Comments
COMMENT ON TABLE audit_logs IS 'Audit trail: all critical operations with correlation IDs. PII masked in details.';
COMMENT ON COLUMN audit_logs.user_id IS 'Foreign key to users.id (SET NULL on delete for audit integrity)';
COMMENT ON COLUMN audit_logs.session_id IS 'Session UUID for correlation (not FK to allow orphaned logs)';
COMMENT ON COLUMN audit_logs.message_id IS 'Message UUID for correlation (not FK to allow orphaned logs)';
COMMENT ON COLUMN audit_logs.operation_type IS 'Operation type: USER_CREATED, CONSENT_GIVEN, MESSAGE_RECEIVED, AI_RESPONSE_GENERATED, SCHEMA_VALIDATION_FAILED, WORKFLOW_FAILED, etc.';
COMMENT ON COLUMN audit_logs.operation_status IS 'Operation result: success or failure';
COMMENT ON COLUMN audit_logs.details IS 'JSONB details (PII MUST be masked before logging)';
