-- Migration: 008_rls_policies.sql
-- Description: Row-Level Security (RLS) policies for all tables
-- Constitution: Supabase as Source of Truth, Security by Default

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlq ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Users: Read own record
CREATE POLICY users_select_own
ON users FOR SELECT
USING (id = auth.uid());

-- Users: Update own record (consent, account status)
CREATE POLICY users_update_own
ON users FOR UPDATE
USING (id = auth.uid());

-- Users: No insert (managed by backend via service_role)
-- Users: No delete (soft delete via backend)

-- ============================================================
-- USER_PROFILES TABLE POLICIES
-- ============================================================

-- User Profiles: Read own profile
CREATE POLICY user_profiles_select_own
ON user_profiles FOR SELECT
USING (user_id = auth.uid());

-- User Profiles: Update own profile
CREATE POLICY user_profiles_update_own
ON user_profiles FOR UPDATE
USING (user_id = auth.uid());

-- User Profiles: No insert (managed by backend via service_role)
-- User Profiles: No delete (CASCADE from users)

-- ============================================================
-- SESSIONS TABLE POLICIES
-- ============================================================

-- Sessions: Read own sessions
CREATE POLICY sessions_select_own
ON sessions FOR SELECT
USING (user_id = auth.uid());

-- Sessions: No insert/update/delete (managed by backend via service_role)

-- ============================================================
-- MESSAGES TABLE POLICIES
-- ============================================================

-- Messages: Read own messages (via session ownership)
CREATE POLICY messages_select_own
ON messages FOR SELECT
USING (
  session_id IN (
    SELECT id FROM sessions WHERE user_id = auth.uid()
  )
);

-- Messages: No insert/update/delete (managed by backend via service_role)

-- ============================================================
-- AI_RESPONSES TABLE POLICIES
-- ============================================================

-- AI Responses: Read own responses (via session ownership)
CREATE POLICY ai_responses_select_own
ON ai_responses FOR SELECT
USING (
  session_id IN (
    SELECT id FROM sessions WHERE user_id = auth.uid()
  )
);

-- AI Responses: No insert/update/delete (managed by backend via service_role)

-- ============================================================
-- AUDIT_LOGS TABLE POLICIES
-- ============================================================

-- Audit Logs: Read own audit logs
CREATE POLICY audit_logs_select_own
ON audit_logs FOR SELECT
USING (user_id = auth.uid());

-- Audit Logs: Admin role can read all audit logs
CREATE POLICY audit_logs_select_admin
ON audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND account_status = 'admin'
  )
);

-- Audit Logs: No insert/update/delete (managed by backend via service_role)

-- ============================================================
-- DLQ TABLE POLICIES
-- ============================================================

-- DLQ: Admin only access
CREATE POLICY dlq_select_admin
ON dlq FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND account_status = 'admin'
  )
);

-- DLQ: No insert/update/delete (managed by backend via service_role)

-- ============================================================
-- SERVICE_ROLE BYPASS
-- ============================================================

-- Comments
COMMENT ON POLICY users_select_own ON users IS 'RLS: Users can read their own record';
COMMENT ON POLICY users_update_own ON users IS 'RLS: Users can update their own record';
COMMENT ON POLICY user_profiles_select_own ON user_profiles IS 'RLS: Users can read their own profile';
COMMENT ON POLICY user_profiles_update_own ON user_profiles IS 'RLS: Users can update their own profile';
COMMENT ON POLICY sessions_select_own ON sessions IS 'RLS: Users can read their own sessions';
COMMENT ON POLICY messages_select_own ON messages IS 'RLS: Users can read their own messages';
COMMENT ON POLICY ai_responses_select_own ON ai_responses IS 'RLS: Users can read their own AI responses';
COMMENT ON POLICY audit_logs_select_own ON audit_logs IS 'RLS: Users can read their own audit logs';
COMMENT ON POLICY audit_logs_select_admin ON audit_logs IS 'RLS: Admins can read all audit logs';
COMMENT ON POLICY dlq_select_admin ON dlq IS 'RLS: Admins only can read DLQ entries';

-- Note: service_role key used by n8n workflows bypasses ALL RLS policies
-- This is intentional per Backend-First architecture principle
