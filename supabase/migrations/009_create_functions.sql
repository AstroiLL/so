-- Migration: 009_create_functions.sql
-- Description: Create Supabase RPC functions for n8n workflows
-- Constitution: Deterministic Integrations, Backend-First, Security by Default

-- ============================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
    AND account_status = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CREATE_USER_WITH_PROFILE
-- ============================================================
CREATE OR REPLACE FUNCTION create_user_with_profile(
  p_telegram_user_id BIGINT,
  p_consent_given BOOLEAN
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM users
  WHERE telegram_user_id = p_telegram_user_id
  AND deleted_at IS NULL;

  -- If exists, return existing user_id
  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;

  -- Create user
  INSERT INTO users (telegram_user_id, consent_given, account_status)
  VALUES (p_telegram_user_id, p_consent_given, 'active')
  RETURNING id INTO v_user_id;

  -- Create empty profile
  INSERT INTO user_profiles (user_id)
  VALUES (v_user_id);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_user_with_profile IS 'Atomically create user and empty profile. Returns existing user_id if telegram_user_id already exists (idempotent).';

-- ============================================================
-- GET_USER_BY_TELEGRAM_ID
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_by_telegram_id(
  p_telegram_user_id BIGINT
)
RETURNS TABLE (
  id UUID,
  telegram_user_id BIGINT,
  consent_given BOOLEAN,
  account_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.telegram_user_id, u.consent_given, u.account_status
  FROM users u
  WHERE u.telegram_user_id = p_telegram_user_id
  AND u.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_by_telegram_id IS 'Retrieve user by Telegram user ID. Returns empty if not found.';

-- ============================================================
-- GET_USER_PROFILE
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_profile(
  p_user_id UUID
)
RETURNS TABLE (
  age INTEGER,
  biological_sex TEXT,
  height_cm INTEGER,
  weight_kg NUMERIC,
  medical_history JSONB,
  current_medications JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT up.age, up.biological_sex, up.height_cm, up.weight_kg, up.medical_history, up.current_medications
  FROM user_profiles up
  WHERE up.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_profile IS 'Retrieve user profile by user_id. Returns empty if not found.';

-- ============================================================
-- CREATE_SESSION
-- ============================================================
CREATE OR REPLACE FUNCTION create_session(
  p_user_id UUID,
  p_session_status TEXT DEFAULT 'active'
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO sessions (user_id, session_status)
  VALUES (p_user_id, p_session_status)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_session IS 'Create new consultation session. Default status: active.';

-- ============================================================
-- GET_ACTIVE_SESSION
-- ============================================================
CREATE OR REPLACE FUNCTION get_active_session(
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  SELECT id INTO v_session_id
  FROM sessions
  WHERE user_id = p_user_id
  AND session_status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_active_session IS 'Get most recent active session for user. Returns NULL if none.';

-- ============================================================
-- INSERT_MESSAGE
-- ============================================================
CREATE OR REPLACE FUNCTION insert_message(
  p_session_id UUID,
  p_telegram_message_id BIGINT,
  p_telegram_user_id BIGINT,
  p_direction TEXT,
  p_content TEXT
)
RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Idempotency: ON CONFLICT DO NOTHING
  INSERT INTO messages (session_id, telegram_message_id, telegram_user_id, direction, content)
  VALUES (p_session_id, p_telegram_message_id, p_telegram_user_id, p_direction, p_content)
  ON CONFLICT (telegram_message_id, telegram_user_id) DO NOTHING
  RETURNING id INTO v_message_id;

  -- If conflict, retrieve existing message_id
  IF v_message_id IS NULL THEN
    SELECT id INTO v_message_id
    FROM messages
    WHERE telegram_message_id = p_telegram_message_id
    AND telegram_user_id = p_telegram_user_id;
  END IF;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION insert_message IS 'Insert message with idempotency. ON CONFLICT returns existing message_id.';

-- ============================================================
-- GET_CACHED_RESPONSE
-- ============================================================
CREATE OR REPLACE FUNCTION get_cached_response(
  p_telegram_message_id BIGINT,
  p_telegram_user_id BIGINT
)
RETURNS TABLE (
  response_data JSONB,
  confidence NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT ar.response_data, ar.confidence
  FROM ai_responses ar
  JOIN messages m ON ar.message_id = m.id
  WHERE m.telegram_message_id = p_telegram_message_id
  AND m.telegram_user_id = p_telegram_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_cached_response IS 'Retrieve cached AI response for duplicate message (idempotency). Returns empty if not found.';

-- ============================================================
-- INSERT_AI_RESPONSE
-- ============================================================
CREATE OR REPLACE FUNCTION insert_ai_response(
  p_session_id UUID,
  p_message_id UUID,
  p_schema_version TEXT,
  p_response_data JSONB,
  p_confidence NUMERIC
)
RETURNS UUID AS $$
DECLARE
  v_ai_response_id UUID;
BEGIN
  INSERT INTO ai_responses (session_id, message_id, schema_version, response_data, confidence)
  VALUES (p_session_id, p_message_id, p_schema_version, p_response_data, p_confidence)
  RETURNING id INTO v_ai_response_id;

  RETURN v_ai_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION insert_ai_response IS 'Insert validated AI response (pre-validated against JSON Schema in n8n).';

-- ============================================================
-- LOG_AUDIT_EVENT
-- ============================================================
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_session_id UUID,
  p_message_id UUID,
  p_operation_type TEXT,
  p_operation_status TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_audit_log_id UUID;
BEGIN
  INSERT INTO audit_logs (user_id, session_id, message_id, operation_type, operation_status, details)
  VALUES (p_user_id, p_session_id, p_message_id, p_operation_type, p_operation_status, p_details)
  RETURNING id INTO v_audit_log_id;

  RETURN v_audit_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_event IS 'Insert audit log entry with correlation IDs. PII MUST be masked before calling.';

-- ============================================================
-- INSERT_DLQ_ENTRY
-- ============================================================
CREATE OR REPLACE FUNCTION insert_dlq_entry(
  p_workflow_name TEXT,
  p_original_data JSONB,
  p_failure_reason TEXT,
  p_retry_attempts INTEGER DEFAULT 3
)
RETURNS UUID AS $$
DECLARE
  v_dlq_id UUID;
BEGIN
  INSERT INTO dlq (workflow_name, original_data, failure_reason, retry_attempts)
  VALUES (p_workflow_name, p_original_data, p_failure_reason, p_retry_attempts)
  RETURNING id INTO v_dlq_id;

  RETURN v_dlq_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION insert_dlq_entry IS 'Insert DLQ entry for failed workflow after retry exhaustion.';

-- ============================================================
-- DELETE_USER_DATA (Soft Delete)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_user_data(
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET deleted_at = NOW(), account_status = 'deleted'
  WHERE id = p_user_id;

  -- CASCADE deletes handled by foreign key ON DELETE CASCADE
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_user_data IS 'Soft-delete user (GDPR right to erasure). CASCADE deletes handled by FK constraints.';

-- ============================================================
-- GRANT EXECUTE TO service_role
-- ============================================================

GRANT EXECUTE ON FUNCTION create_user_with_profile TO service_role;
GRANT EXECUTE ON FUNCTION get_user_by_telegram_id TO service_role;
GRANT EXECUTE ON FUNCTION get_user_profile TO service_role;
GRANT EXECUTE ON FUNCTION create_session TO service_role;
GRANT EXECUTE ON FUNCTION get_active_session TO service_role;
GRANT EXECUTE ON FUNCTION insert_message TO service_role;
GRANT EXECUTE ON FUNCTION get_cached_response TO service_role;
GRANT EXECUTE ON FUNCTION insert_ai_response TO service_role;
GRANT EXECUTE ON FUNCTION log_audit_event TO service_role;
GRANT EXECUTE ON FUNCTION insert_dlq_entry TO service_role;
GRANT EXECUTE ON FUNCTION delete_user_data TO service_role;
GRANT EXECUTE ON FUNCTION is_admin TO service_role;

-- Note: n8n uses service_role key which has full access
-- These GRANTs ensure functions are accessible via REST API
