-- Migration: 007_create_dlq.sql
-- Description: Create Dead Letter Queue (DLQ) table for failed workflow handling
-- Constitution: Event-Driven Orchestration, Observability and Audit

CREATE TABLE IF NOT EXISTS dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  original_data JSONB NOT NULL,
  failure_reason TEXT NOT NULL,
  retry_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for querying DLQ entries
CREATE INDEX idx_dlq_workflow_name ON dlq(workflow_name);
CREATE INDEX idx_dlq_created_at ON dlq(created_at);
CREATE INDEX idx_dlq_resolved_at ON dlq(resolved_at) WHERE resolved_at IS NULL;

-- Comments
COMMENT ON TABLE dlq IS 'Dead Letter Queue: failed workflow data for manual intervention after exponential backoff exhaustion.';
COMMENT ON COLUMN dlq.workflow_name IS 'n8n workflow name (e.g., recommendation-generate, telegram-intake)';
COMMENT ON COLUMN dlq.original_data IS 'JSONB original workflow input data for replay/debugging';
COMMENT ON COLUMN dlq.failure_reason IS 'Error message or validation failure reason';
COMMENT ON COLUMN dlq.retry_attempts IS 'Number of retry attempts before DLQ routing (typically 3)';
COMMENT ON COLUMN dlq.resolved_at IS 'Timestamp when DLQ entry manually resolved (NULL = unresolved)';
