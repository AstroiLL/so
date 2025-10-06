# Data Model: Second Opinion n8n Application

**Date**: 2025-10-06
**Feature**: 001-n8n-second-opinion

## Overview

Data model for Telegram-first medical assistant with strict PII separation, RLS enforcement, and idempotency guarantees. All tables use UUID primary keys, timestamptz timestamps (UTC), and enforce user-scoped access via RLS policies.

---

## Entities

### 1. users (Identity, Non-PII)

**Purpose**: Core user identity linked to Telegram account; contains no health data.

**Schema**:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete timestamp
);

CREATE INDEX idx_users_telegram_id ON users(telegram_user_id) WHERE deleted_at IS NULL;
```

**RLS Policy**:
```sql
-- Users can view only their own record
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (id = auth.uid());

-- Service role can access all
CREATE POLICY "users_service_all" ON users FOR ALL
  USING (auth.role() = 'service_role');
```

**Relationships**:
- One-to-one with `user_profiles` (health data)
- One-to-many with `sessions`
- One-to-many with `audit_logs`

**Validation Rules**:
- `telegram_user_id` must be positive BIGINT
- `consent_given` must be TRUE before any health data collection
- `account_status` can only transition: active ↔ suspended

---

### 2. user_profiles (PII, Health Data)

**Purpose**: Sensitive health information separated from identity; strict RLS enforcement.

**Schema**:
```sql
CREATE TYPE biological_sex AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER CHECK (age BETWEEN 0 AND 150),
  biological_sex biological_sex,
  height_cm INTEGER CHECK (height_cm BETWEEN 50 AND 300),
  weight_kg NUMERIC(5,2) CHECK (weight_kg BETWEEN 2 AND 500),
  medical_history JSONB DEFAULT '[]',
  current_medications JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

**RLS Policy**:
```sql
-- Users can only access their own profile
CREATE POLICY "user_profiles_select_own" ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Service role can access all
CREATE POLICY "user_profiles_service_all" ON user_profiles FOR ALL
  USING (auth.role() = 'service_role');
```

**Relationships**:
- One-to-one with `users` (via user_id FK)

**Validation Rules**:
- `medical_history`: JSONB array of strings (conditions)
- `current_medications`: JSONB array of objects `[{name: "...", dosage: "...", frequency: "..."}]`
- All fields optional except `user_id`

**PII Masking**:
- Logs must mask: age (show range), height/weight (show ranges), medical_history (redact), medications (redact)

---

### 3. sessions

**Purpose**: Conversation instances; tracks user consultation lifecycle.

**Schema**:
```sql
CREATE TYPE session_status AS ENUM ('active', 'completed', 'abandoned');

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_status session_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(session_status) WHERE session_status = 'active';
```

**RLS Policy**:
```sql
-- Users can only access their own sessions
CREATE POLICY "sessions_select_own" ON sessions FOR SELECT
  USING (user_id = auth.uid());

-- Service role can access all
CREATE POLICY "sessions_service_all" ON sessions FOR ALL
  USING (auth.role() = 'service_role');
```

**Relationships**:
- Many-to-one with `users`
- One-to-many with `messages`
- One-to-many with `ai_responses`

**State Transitions**:
- `active` → `completed` (user finished consultation)
- `active` → `abandoned` (user inactive > 24 hours)
- `completed`/`abandoned` are terminal states

---

### 4. messages

**Purpose**: Individual communications; enables idempotency and audit trails.

**Schema**:
```sql
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  telegram_message_id BIGINT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  direction message_direction NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency constraint
CREATE UNIQUE INDEX idx_messages_telegram_dedup
  ON messages(telegram_message_id, telegram_user_id);

CREATE INDEX idx_messages_session_id ON messages(session_id);
```

**RLS Policy**:
```sql
-- Users can only access messages in their own sessions
CREATE POLICY "messages_select_own" ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = messages.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Service role can access all
CREATE POLICY "messages_service_all" ON messages FOR ALL
  USING (auth.role() = 'service_role');
```

**Relationships**:
- Many-to-one with `sessions`
- One-to-one with `ai_responses` (for inbound messages that triggered recommendation)

**Idempotency**:
- Unique constraint on `(telegram_message_id, telegram_user_id)` enforces deduplication at DB level
- n8n workflow checks for existing message before processing

---

### 5. ai_responses

**Purpose**: Structured AI-generated recommendations; validated against JSON Schema before persistence.

**Schema**:
```sql
CREATE TABLE ai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL DEFAULT 'v1',
  response_data JSONB NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_responses_session_id ON ai_responses(session_id);
CREATE INDEX idx_ai_responses_message_id ON ai_responses(message_id);
CREATE INDEX idx_ai_responses_schema_version ON ai_responses(schema_version);
```

**RLS Policy**:
```sql
-- Users can only access responses in their own sessions
CREATE POLICY "ai_responses_select_own" ON ai_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = ai_responses.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Service role can access all
CREATE POLICY "ai_responses_service_all" ON ai_responses FOR ALL
  USING (auth.role() = 'service_role');
```

**Relationships**:
- Many-to-one with `sessions`
- One-to-one with `messages` (inbound message that triggered this response)

**Validation Rules**:
- `response_data` MUST conform to `airesponse.{schema_version}.schema.json` before insert
- `confidence` range [0, 1] enforced by CHECK constraint
- `schema_version` used for forward compatibility (future migrations to v2, v3)

**Schema Evolution**:
- v1 → v2: Create adapter function `migrate_response_v1_to_v2(JSONB) RETURNS JSONB`
- Queries handle multiple versions: `SELECT response_data FROM ai_responses WHERE schema_version IN ('v1', 'v2')`

---

### 6. audit_logs

**Purpose**: Compliance and debugging; records all critical operations.

**Schema**:
```sql
CREATE TYPE operation_status AS ENUM ('success', 'failure');

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL,
  operation_status operation_status NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_operation_type ON audit_logs(operation_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

**RLS Policy**:
```sql
-- Users can view their own audit logs
CREATE POLICY "audit_logs_select_own" ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Admin role can view all logs
CREATE POLICY "audit_logs_select_admin" ON audit_logs FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- Service role can insert/update
CREATE POLICY "audit_logs_service_all" ON audit_logs FOR ALL
  USING (auth.role() = 'service_role');
```

**Relationships**:
- Many-to-one with `users` (nullable for system operations)
- References `sessions`, `messages` (nullable for context)

**Operation Types** (examples):
- `USER_CREATED`, `USER_CONSENT_GIVEN`, `PROFILE_UPDATED`
- `SESSION_STARTED`, `SESSION_COMPLETED`
- `MESSAGE_RECEIVED`, `AI_RESPONSE_GENERATED`
- `SCHEMA_VALIDATION_FAILED`, `LLM_CALL_FAILED`
- `USER_DELETION_REQUESTED`

**Retention**:
- Kept for 7 years (compliance requirement)
- Even after user deletion, audit logs retain operation_type='USER_DELETION' record

---

### 7. dlq (Dead Letter Queue)

**Purpose**: Failed operations requiring manual review; enables reliability monitoring.

**Schema**:
```sql
CREATE TABLE dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  original_data JSONB NOT NULL,
  failure_reason TEXT NOT NULL,
  retry_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_dlq_workflow_name ON dlq(workflow_name);
CREATE INDEX idx_dlq_resolved ON dlq(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_dlq_created_at ON dlq(created_at DESC);
```

**RLS Policy**:
```sql
-- Only admin role can access DLQ
CREATE POLICY "dlq_admin_only" ON dlq FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Service role can insert/update
CREATE POLICY "dlq_service_all" ON dlq FOR ALL
  USING (auth.role() = 'service_role');
```

**Relationships**:
- Standalone table (no FK); contains serialized context from any failed workflow

**Lifecycle**:
1. n8n workflow fails after 3 retry attempts
2. Error handler inserts record into DLQ
3. Admin reviews DLQ (dashboard or query)
4. Admin resolves issue (manual intervention or code fix)
5. Admin marks `resolved_at = NOW()`

**Monitoring**:
- Alert if DLQ row count > 10 (indicates systemic issue)
- Weekly review of unresolved DLQ entries

---

## Entity Relationship Diagram

```
users (1) ─────────── (1) user_profiles
  │
  ├── (1) ─────────── (N) sessions
  │                      │
  │                      ├── (1) ─────── (N) messages
  │                      │                  │
  │                      └── (1) ─────── (N) ai_responses
  │                                         │
  └── (1) ─────────── (N) audit_logs        │
                                            │
                                   (1:1 with inbound messages)

dlq (standalone, no FKs)
```

---

## Data Migration Strategy

**Initial Setup** (MVP):
- Create all tables in order: users → user_profiles → sessions → messages → ai_responses → audit_logs → dlq
- Create RLS policies after tables
- Create indexes for performance

**Future Changes**:
- Schema version bump: Create new table `ai_responses_v2` or add `schema_version` column
- Add columns: Use `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` with migration
- Deprecate columns: Soft deprecation (ignore in queries) → hard delete after 1 version

**Rollback**:
- Every migration has corresponding `DOWN` SQL for rollback
- Test `UP` → `DOWN` → `UP` cycle before deployment

---

## Performance Considerations

**Expected Load** (MVP: 100-1000 users):
- 1000 users × 10 sessions/user/month = 10K sessions/month
- 10K sessions × 5 messages/session = 50K messages/month
- 50K messages × 0.5 AI responses = 25K ai_responses/month

**Index Strategy**:
- Primary queries: Fetch session with messages + AI responses for user → covered by FK indexes
- Audit log queries: Filter by user_id, operation_type, date range → covered by composite index

**Partitioning** (future, >10K users):
- Partition `audit_logs` by created_at (monthly partitions)
- Partition `ai_responses` by schema_version (v1, v2, v3)

---

## Security & Compliance

**RLS Enforcement**:
- Every user-scoped table has RLS policy: `WHERE user_id = auth.uid()`
- Service role bypasses RLS (n8n workflows use service key)
- Admin role has read access to audit_logs and dlq

**PII Isolation**:
- Health data in `user_profiles` (separate from `users`)
- AI responses contain no raw PII (only processed recommendations)
- Audit logs mask PII in `details` JSONB field

**GDPR Compliance**:
- User deletion: Soft delete users + cascade to related tables
- Data export: Query all tables for user_id → JSON export
- Right to rectification: Update user_profiles via Telegram command

---

*Generated from spec.md and research.md | Phase 1 output*
