# Data Model: Second Opinion n8n Application

**Date**: 2025-10-06
**Feature**: 001-n8n-second-opinion
**Constitution**: v2.1.0

## Overview

This document describes the database schema for the Second Opinion Telegram bot application. The architecture implements PII isolation, Row-Level Security (RLS), and GDPR-compliant soft delete patterns per constitution principles.

**Key Design Principles**:
- **PII Isolation**: Identity data (`users`) separated from PII (`user_profiles`)
- **RLS Enforcement**: User data scoped by `user_id` at database level
- **Soft Delete**: `deleted_at` column for GDPR right to erasure
- **Idempotency**: Unique constraints on Telegram message identifiers
- **Audit Trail**: Full observability with correlation IDs

---

## Tables

### 1. `users`

**Purpose**: Identity and consent management. Links Telegram user ID to internal UUID.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal user identifier |
| `telegram_user_id` | BIGINT | NOT NULL, UNIQUE | Telegram user ID from Telegram API |
| `consent_given` | BOOLEAN | NOT NULL, DEFAULT false | User consent for medical data processing (GDPR) |
| `account_status` | TEXT | NOT NULL, DEFAULT 'active', CHECK IN ('active', 'suspended', 'deleted') | Account status |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | User creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp (auto-updated) |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft delete timestamp (GDPR right to erasure) |

**Indexes**:
- `idx_users_telegram_user_id` on `telegram_user_id` WHERE `deleted_at IS NULL`
- `idx_users_account_status` on `account_status` WHERE `deleted_at IS NULL`

**RLS Policies**:
- `users_select_own`: Users can read their own record (`id = auth.uid()`)
- `users_update_own`: Users can update their own record

**Notes**:
- No PII stored in this table
- Telegram user ID is external identifier; UUID is internal
- Soft delete via `deleted_at` preserves audit trail

---

### 2. `user_profiles`

**Purpose**: PII and medical data storage. One profile per user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Profile identifier |
| `user_id` | UUID | NOT NULL, UNIQUE, REFERENCES users(id) ON DELETE CASCADE | Foreign key to users table |
| `age` | INTEGER | CHECK (age >= 0 AND age <= 150) | User age in years |
| `biological_sex` | TEXT | CHECK IN ('male', 'female', 'other') | Biological sex |
| `height_cm` | INTEGER | CHECK (height_cm >= 50 AND height_cm <= 300) | Height in centimeters |
| `weight_kg` | NUMERIC(5, 2) | CHECK (weight_kg >= 2 AND weight_kg <= 500) | Weight in kilograms |
| `medical_history` | JSONB | NOT NULL, DEFAULT '[]' | JSONB array of medical history entries |
| `current_medications` | JSONB | NOT NULL, DEFAULT '[]' | JSONB array of current medications |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Profile creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp (auto-updated) |

**Indexes**:
- `idx_user_profiles_user_id` UNIQUE on `user_id`

**RLS Policies**:
- `user_profiles_select_own`: Users can read their own profile (`user_id = auth.uid()`)
- `user_profiles_update_own`: Users can update their own profile

**Notes**:
- CASCADE delete from `users` ensures GDPR compliance
- PII isolated from identity table for security
- JSONB fields for flexible medical data storage
- SI units enforced (cm, kg)

---

### 3. `sessions`

**Purpose**: Consultation session management. Tracks user conversation context.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Session identifier |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Foreign key to users table |
| `session_status` | TEXT | NOT NULL, DEFAULT 'active', CHECK IN ('active', 'completed', 'abandoned') | Session status |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Session creation timestamp |
| `completed_at` | TIMESTAMPTZ | NULLABLE | Session completion timestamp (NULL for active) |

**Indexes**:
- `idx_sessions_user_id` on `user_id`
- `idx_sessions_status` on `session_status` WHERE `session_status = 'active'`
- `idx_sessions_user_id_status` on `(user_id, session_status)` WHERE `session_status = 'active'`

**RLS Policies**:
- `sessions_select_own`: Users can read their own sessions (`user_id = auth.uid()`)

**Notes**:
- Multiple sessions per user allowed (new consultations)
- Active session query optimized via composite index
- CASCADE delete from `users` ensures GDPR compliance

---

### 4. `messages`

**Purpose**: Message log with idempotency constraint. Stores inbound (user) and outbound (bot) messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Message identifier |
| `session_id` | UUID | NOT NULL, REFERENCES sessions(id) ON DELETE CASCADE | Foreign key to sessions table |
| `telegram_message_id` | BIGINT | NOT NULL | Telegram message ID from Telegram API |
| `telegram_user_id` | BIGINT | NOT NULL | Telegram user ID from Telegram API |
| `direction` | TEXT | NOT NULL, CHECK IN ('inbound', 'outbound') | Message direction |
| `content` | TEXT | NOT NULL | Message text content |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Message creation timestamp |

**Indexes**:
- `idx_messages_idempotency` UNIQUE on `(telegram_message_id, telegram_user_id)` **(idempotency constraint)**
- `idx_messages_session_id` on `session_id`
- `idx_messages_telegram_user_id` on `telegram_user_id`

**RLS Policies**:
- `messages_select_own`: Users can read messages from their own sessions (via session ownership)

**Notes**:
- **Idempotency**: UNIQUE constraint on `(telegram_message_id, telegram_user_id)` prevents duplicate processing
- Duplicate Telegram deliveries result in ON CONFLICT DO NOTHING (safe)
- CASCADE delete from `sessions` ensures GDPR compliance

---

### 5. `ai_responses`

**Purpose**: Validated AI recommendation responses. Links to message and session.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | AI response identifier |
| `session_id` | UUID | NOT NULL, REFERENCES sessions(id) ON DELETE CASCADE | Foreign key to sessions table |
| `message_id` | UUID | NOT NULL, REFERENCES messages(id) ON DELETE CASCADE | Foreign key to messages table |
| `schema_version` | TEXT | NOT NULL, DEFAULT 'v1' | JSON Schema version (e.g., v1, v2) |
| `response_data` | JSONB | NOT NULL | Validated JSONB response (airesponse.v1.schema.json) |
| `confidence` | NUMERIC(3, 2) | NOT NULL, CHECK (confidence >= 0 AND confidence <= 1) | AI confidence score (0.0-1.0) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Response creation timestamp |

**Indexes**:
- `idx_ai_responses_session_id` on `session_id`
- `idx_ai_responses_message_id` on `message_id`
- `idx_ai_responses_schema_version` on `schema_version`

**RLS Policies**:
- `ai_responses_select_own`: Users can read AI responses from their own sessions (via session ownership)

**Notes**:
- **Pre-validated**: `response_data` validated against JSON Schema in n8n before persistence
- Schema versioning enables forward compatibility
- CASCADE delete from `sessions` and `messages` ensures GDPR compliance

**Response Data Structure** (airesponse.v1):
```json
{
  "summary": "string (10-500 chars)",
  "red_flags": ["string (5-200 chars)"],
  "lifestyle": {
    "diet": "string (10-300 chars)",
    "exercise": "string (10-300 chars)",
    "sleep": "string (10-300 chars)"
  },
  "self_care": {
    "recommendations": ["string (10-200 chars)"]
  },
  "talk_to_doctor": {
    "topics": ["string (5-200 chars)"]
  },
  "next_steps": ["string (10-200 chars)"],
  "confidence": 0.0-1.0,
  "disclaimer": "string (min 50 chars)",
  "sources": ["URI"] (optional)
}
```

---

### 6. `audit_logs`

**Purpose**: Audit trail for critical operations. Enables observability and compliance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Audit log identifier |
| `user_id` | UUID | NULLABLE, REFERENCES users(id) ON DELETE SET NULL | Foreign key to users table (nullable for system events) |
| `session_id` | UUID | NULLABLE | Session UUID for correlation (not FK to preserve logs) |
| `message_id` | UUID | NULLABLE | Message UUID for correlation (not FK to preserve logs) |
| `operation_type` | TEXT | NOT NULL | Operation type (USER_CREATED, AI_RESPONSE_GENERATED, etc.) |
| `operation_status` | TEXT | NOT NULL, CHECK IN ('success', 'failure') | Operation result |
| `details` | JSONB | NOT NULL, DEFAULT '{}' | JSONB details **(PII MUST be masked)** |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Log creation timestamp |

**Indexes**:
- `idx_audit_logs_user_id` on `user_id`
- `idx_audit_logs_operation_type` on `operation_type`
- `idx_audit_logs_operation_status` on `operation_status`
- `idx_audit_logs_created_at` on `created_at`
- `idx_audit_logs_correlation` on `(user_id, session_id, message_id)` for correlation queries

**RLS Policies**:
- `audit_logs_select_own`: Users can read their own audit logs (`user_id = auth.uid()`)
- `audit_logs_select_admin`: Admins can read all audit logs

**Notes**:
- `session_id` and `message_id` are NOT foreign keys to preserve audit trail after deletions
- `user_id` SET NULL on delete maintains log integrity
- **PII masking**: All PII MUST be masked before logging (enforced at application layer)
- Common `operation_type` values: USER_CREATED, CONSENT_GIVEN, PROFILE_CREATED, SESSION_STARTED, MESSAGE_RECEIVED, AI_RESPONSE_GENERATED, SCHEMA_VALIDATION_FAILED, WORKFLOW_FAILED

---

### 7. `dlq`

**Purpose**: Dead Letter Queue for failed workflow handling after retry exhaustion.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | DLQ entry identifier |
| `workflow_name` | TEXT | NOT NULL | n8n workflow name (e.g., recommendation-generate) |
| `original_data` | JSONB | NOT NULL | Original workflow input data for replay/debugging |
| `failure_reason` | TEXT | NOT NULL | Error message or validation failure reason |
| `retry_attempts` | INTEGER | NOT NULL, DEFAULT 0 | Number of retry attempts (typically 3) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | DLQ entry creation timestamp |
| `resolved_at` | TIMESTAMPTZ | NULLABLE | Timestamp when manually resolved (NULL = unresolved) |

**Indexes**:
- `idx_dlq_workflow_name` on `workflow_name`
- `idx_dlq_created_at` on `created_at`
- `idx_dlq_resolved_at` on `resolved_at` WHERE `resolved_at IS NULL` (unresolved entries)

**RLS Policies**:
- `dlq_select_admin`: Admin only access

**Notes**:
- No foreign keys (workflow failures may occur for deleted users)
- Exponential backoff + DLQ pattern: attempt 1 (0s), attempt 2 (2s), attempt 3 (4s), then DLQ
- Manual resolution workflow: investigate → fix → mark `resolved_at`

---

## RPC Functions

All RPC functions use `SECURITY DEFINER` and are accessible via Supabase REST API from n8n workflows.

### User Management

1. **`create_user_with_profile(p_telegram_user_id BIGINT, p_consent_given BOOLEAN)`**
   Returns: `UUID` (user_id)
   Atomically creates user and empty profile. Idempotent: returns existing user_id if telegram_user_id exists.

2. **`get_user_by_telegram_id(p_telegram_user_id BIGINT)`**
   Returns: `TABLE (id, telegram_user_id, consent_given, account_status)`
   Retrieves user by Telegram user ID. Returns empty if not found.

3. **`get_user_profile(p_user_id UUID)`**
   Returns: `TABLE (age, biological_sex, height_cm, weight_kg, medical_history, current_medications)`
   Retrieves user profile. Returns empty if not found.

4. **`delete_user_data(p_user_id UUID)`**
   Returns: `VOID`
   Soft-deletes user (sets `deleted_at`, `account_status='deleted'`). CASCADE deletes handled by FK constraints.

### Session Management

5. **`create_session(p_user_id UUID, p_session_status TEXT DEFAULT 'active')`**
   Returns: `UUID` (session_id)
   Creates new consultation session.

6. **`get_active_session(p_user_id UUID)`**
   Returns: `UUID` (session_id or NULL)
   Retrieves most recent active session. Returns NULL if none.

### Message Management

7. **`insert_message(p_session_id UUID, p_telegram_message_id BIGINT, p_telegram_user_id BIGINT, p_direction TEXT, p_content TEXT)`**
   Returns: `UUID` (message_id)
   Inserts message with idempotency (ON CONFLICT DO NOTHING). Returns existing message_id if duplicate.

8. **`get_cached_response(p_telegram_message_id BIGINT, p_telegram_user_id BIGINT)`**
   Returns: `TABLE (response_data JSONB, confidence NUMERIC)`
   Retrieves cached AI response for duplicate message (idempotency). Returns empty if not found.

### AI Response Management

9. **`insert_ai_response(p_session_id UUID, p_message_id UUID, p_schema_version TEXT, p_response_data JSONB, p_confidence NUMERIC)`**
   Returns: `UUID` (ai_response_id)
   Inserts validated AI response (pre-validated in n8n).

### Observability

10. **`log_audit_event(p_user_id UUID, p_session_id UUID, p_message_id UUID, p_operation_type TEXT, p_operation_status TEXT, p_details JSONB DEFAULT '{}')`**
    Returns: `UUID` (audit_log_id)
    Inserts audit log entry. PII MUST be masked before calling.

11. **`insert_dlq_entry(p_workflow_name TEXT, p_original_data JSONB, p_failure_reason TEXT, p_retry_attempts INTEGER DEFAULT 3)`**
    Returns: `UUID` (dlq_id)
    Inserts DLQ entry for failed workflow after retry exhaustion.

---

## Entity Relationship Diagram (ERD)

```
┌─────────────────┐
│     users       │
│─────────────────│
│ id (PK)         │◄──────┐
│ telegram_user_id│       │
│ consent_given   │       │
│ account_status  │       │
│ deleted_at      │       │
└─────────────────┘       │
         ▲                │
         │ user_id (FK)   │
         │                │
┌─────────────────┐       │
│ user_profiles   │       │
│─────────────────│       │
│ id (PK)         │       │
│ user_id (FK)    │───────┘
│ age             │
│ biological_sex  │
│ height_cm       │
│ weight_kg       │
│ medical_history │
│ current_meds    │
└─────────────────┘

         ▲
         │ user_id (FK)
         │
┌─────────────────┐
│    sessions     │
│─────────────────│
│ id (PK)         │◄──────────┐
│ user_id (FK)    │           │
│ session_status  │           │
│ completed_at    │           │
└─────────────────┘           │
         ▲                    │
         │ session_id (FK)    │ session_id (FK)
         │                    │
┌─────────────────┐    ┌──────────────────┐
│    messages     │    │  ai_responses    │
│─────────────────│    │──────────────────│
│ id (PK)         │◄───│ id (PK)          │
│ session_id (FK) │    │ session_id (FK)  │
│ telegram_msg_id │    │ message_id (FK)  │
│ telegram_user_id│    │ schema_version   │
│ direction       │    │ response_data    │
│ content         │    │ confidence       │
└─────────────────┘    └──────────────────┘
   UNIQUE(telegram_message_id, telegram_user_id)

┌─────────────────┐    ┌──────────────────┐
│  audit_logs     │    │       dlq        │
│─────────────────│    │──────────────────│
│ id (PK)         │    │ id (PK)          │
│ user_id (FK)    │    │ workflow_name    │
│ session_id      │    │ original_data    │
│ message_id      │    │ failure_reason   │
│ operation_type  │    │ retry_attempts   │
│ operation_status│    │ resolved_at      │
│ details (JSONB) │    └──────────────────┘
└─────────────────┘
```

**Legend**:
- `PK` = Primary Key
- `FK` = Foreign Key
- `◄──` = One-to-Many relationship
- `UNIQUE(...)` = Unique constraint (idempotency)

---

## Key Relationships

1. **`users` ← `user_profiles`**: One-to-One (ON DELETE CASCADE)
2. **`users` ← `sessions`**: One-to-Many (ON DELETE CASCADE)
3. **`sessions` ← `messages`**: One-to-Many (ON DELETE CASCADE)
4. **`sessions` ← `ai_responses`**: One-to-Many (ON DELETE CASCADE)
5. **`messages` ← `ai_responses`**: One-to-One (ON DELETE CASCADE)
6. **`users` ← `audit_logs`**: One-to-Many (ON DELETE SET NULL)
7. **`dlq`**: No foreign keys (orphaned by design for failed workflows)

---

## Security and Compliance

### Row-Level Security (RLS)

All tables have RLS enabled. Policies enforce user data scoping:

- **User-scoped access**: `user_id = auth.uid()` for `users`, `user_profiles`, `sessions`
- **Session-scoped access**: Messages and AI responses accessible via session ownership
- **Admin-only**: DLQ table, admin-level audit logs
- **Service role bypass**: n8n workflows use `service_role` key which bypasses RLS (Backend-First architecture)

### PII Protection

- **PII isolation**: `user_profiles` separated from `users`
- **PII masking**: All audit logs mask PII before insertion
- **Minimal exposure**: Profile data accessed only via `get_user_profile` RPC

### GDPR Compliance

- **Soft delete**: `deleted_at` column in `users` table
- **CASCADE delete**: Foreign keys ensure related data deleted/nullified
- **Right to erasure**: `delete_user_data` RPC function
- **Consent tracking**: `consent_given` column in `users` table
- **Audit trail**: `audit_logs` preserves compliance evidence

### Idempotency

- **Messages**: UNIQUE constraint on `(telegram_message_id, telegram_user_id)`
- **RPC functions**: `insert_message` and `create_user_with_profile` are idempotent
- **Duplicate handling**: ON CONFLICT DO NOTHING returns existing record

---

## Data Flow Example: New User Consultation

1. User sends `/start` to Telegram bot
2. n8n workflow calls `create_user_with_profile` (creates `users` + `user_profiles`)
3. Profile enrichment workflow collects age, sex, height, weight
4. User sends health concern message
5. n8n calls `create_session` (creates `sessions`)
6. n8n calls `insert_message` (creates `messages` - idempotent)
7. n8n calls LLM, validates response against JSON Schema
8. n8n calls `insert_ai_response` (creates `ai_responses`)
9. n8n formats response, sends to Telegram
10. n8n calls `log_audit_event` for each critical operation

---

## Migration Files

All schema definitions in `supabase/migrations/`:

- `001_create_users.sql`
- `002_create_user_profiles.sql`
- `003_create_sessions.sql`
- `004_create_messages.sql`
- `005_create_ai_responses.sql`
- `006_create_audit_logs.sql`
- `007_create_dlq.sql`
- `008_rls_policies.sql`
- `009_create_functions.sql`

Apply via Supabase CLI:
```bash
supabase db push
```

Rollback via:
```bash
supabase db reset
```

---

## Testing

Migration tests in `tests/migration/`:

- `test_migrations_up.js`: Apply all migrations, verify tables/columns/functions
- `test_migrations_down.js`: Rollback all migrations, verify clean state
- `test_rls_policies.js`: Verify RLS prevents cross-user access

Contract tests in `tests/contract/`:

- `test_airesponse_schema.js`: Validate AI responses against JSON Schema

---

*Data Model Documentation | Constitution v2.1.0 | Generated 2025-10-06*
