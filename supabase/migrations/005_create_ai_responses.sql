-- Migration: 005_create_ai_responses.sql
-- Description: Create ai_responses table for validated AI recommendations
-- Constitution: Data Contracts First, LLM Integration Rules

CREATE TABLE IF NOT EXISTS ai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL DEFAULT 'v1',
  response_data JSONB NOT NULL,
  confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying
CREATE INDEX idx_ai_responses_session_id ON ai_responses(session_id);
CREATE INDEX idx_ai_responses_message_id ON ai_responses(message_id);
CREATE INDEX idx_ai_responses_schema_version ON ai_responses(schema_version);

-- Comments
COMMENT ON TABLE ai_responses IS 'AI recommendation responses: validated against JSON Schema before persistence.';
COMMENT ON COLUMN ai_responses.session_id IS 'Foreign key to sessions.id (CASCADE delete for GDPR compliance)';
COMMENT ON COLUMN ai_responses.message_id IS 'Foreign key to messages.id (CASCADE delete for GDPR compliance)';
COMMENT ON COLUMN ai_responses.schema_version IS 'JSON Schema version (e.g., v1, v2) for forward compatibility';
COMMENT ON COLUMN ai_responses.response_data IS 'JSONB validated against airesponse.v1.schema.json (summary, red_flags, lifestyle, self_care, talk_to_doctor, next_steps, confidence, disclaimer)';
COMMENT ON COLUMN ai_responses.confidence IS 'AI confidence score (0.0-1.0) from LLM response';
