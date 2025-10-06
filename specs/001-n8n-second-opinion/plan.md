# Implementation Plan: Second Opinion n8n Application

**Branch**: `001-n8n-second-opinion` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/astroill/Sync/GPT/NickRelax/so/specs/001-n8n-second-opinion/spec.md`

## Summary

Build a Telegram-first medical assistant using n8n for orchestration, Supabase for data persistence, and LLM for generating structured health recommendations. The system collects user health information through conversational Telegram interface, processes it through explicit n8n workflows, generates AI recommendations validated against strict JSON Schema, and ensures security through RLS policies, PII isolation, idempotency, DLQ, and comprehensive audit logging.

## Technical Context

**Language/Version**: n8n workflows (visual/JSON), PostgreSQL 15+ (Supabase), Node.js 18+ (for custom n8n functions)
**Primary Dependencies**: n8n (orchestration), Supabase (PostgreSQL + RLS + REST API), Telegram Bot API, OpenAI API (via n8n node), Ajv (JSON Schema validation in n8n)
**Storage**: Supabase PostgreSQL with RLS policies, separate tables for identity (users) and PII (user_profiles)
**Testing**: Contract tests (JSON Schema validation), migration tests (up/down/idempotency), idempotency tests (duplicate message handling)
**Target Platform**: n8n cloud/self-hosted, Supabase cloud/self-hosted
**Project Type**: Single project - n8n workflows + Supabase schemas (no traditional code structure)
**Performance Goals**: ≤20 second end-to-end response time, LLM call <15s, DB operations <500ms
**Constraints**: Must enforce RLS, PII masking in logs, idempotent operations, exponential backoff retry, DLQ after 3 retries
**Scale/Scope**: MVP for 100-1000 users, ~10 n8n workflows, 7 database tables, 1 JSON Schema version (airesponse.v1)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Backend-First ✅
- **Compliance**: All logic in n8n workflows and Supabase schemas; Telegram is transport only
- **Evidence**: No client-side validation or logic; all contracts defined in JSON Schema and DB migrations

### II. Event-Driven Orchestration (n8n) ✅
- **Compliance**: Every user action triggers explicit n8n workflow with retry, DLQ, and idempotency
- **Evidence**: Workflows defined for /start, /new, /profile, /help, message intake; messageId+telegramUserId composite keys

### III. Data Contracts First ✅
- **Compliance**: AI responses validated against airesponse.v1 JSON Schema before persistence
- **Evidence**: JSON Schema Validator node in every LLM response workflow; schema versioning strategy documented

### IV. Supabase as Source of Truth ✅
- **Compliance**: All data in PostgreSQL with RLS; PII separated; n8n uses service key
- **Evidence**: RLS policies on all tables scoped by userId; separate users and user_profiles tables

### V. Deterministic Integrations ✅
- **Compliance**: Reusable n8n sub-workflows for Supabase, Telegram, LLM with logging and error handling
- **Evidence**: Standard nodes: Supabase Client, Telegram Client, LLM Wrapper with correlation IDs

### VI. Observability and Audit ✅
- **Compliance**: Audit log table for critical operations; correlation by userId/sessionId/messageId
- **Evidence**: audit_logs table; structured logging nodes in all workflows; PII masking functions

### VII. Security by Default ✅
- **Compliance**: Secrets in n8n credentials; no PII in logs; least-privilege RLS
- **Evidence**: TELEGRAM_TOKEN, SUPABASE_KEY, LLM_KEY in n8n credentials; PII mask functions; RLS policies

### VIII. Transparent Evolution ✅
- **Compliance**: Migrations for all schema changes; JSON Schema versioning; constitution alignment
- **Evidence**: Migration files in /supabase/migrations; schema version in airesponse.v1; this plan aligns with constitution v2.0.0

**Initial Constitution Check**: ✅ PASS - No violations detected

## Project Structure

### Documentation (this feature)
```
specs/001-n8n-second-opinion/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── airesponse.v1.schema.json
│   ├── telegram-commands.yaml
│   └── supabase-rpc.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

Since this is an n8n-based project, there is no traditional src/ directory. Instead:

```
n8n-workflows/
├── telegram-intake.json          # Main Telegram webhook handler
├── user-resolve-create.json      # User resolution/creation sub-workflow
├── profile-enrich.json           # Profile collection sub-workflow
├── recommendation-generate.json  # LLM prompt building + call + validation
├── response-send.json            # Telegram message sending
├── error-handler.json            # DLQ and error routing
└── reusable/
    ├── supabase-client.json      # Reusable Supabase query node
    ├── json-validator.json       # JSON Schema validation node
    ├── logger.json               # Structured logging node
    └── retry-policy.json         # Exponential backoff retry node

supabase/
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_user_profiles.sql
│   ├── 003_create_sessions.sql
│   ├── 004_create_messages.sql
│   ├── 005_create_ai_responses.sql
│   ├── 006_create_audit_logs.sql
│   ├── 007_create_dlq.sql
│   └── 008_rls_policies.sql
└── schemas/
    └── airesponse.v1.schema.json

tests/
├── contract/
│   ├── test_airesponse_schema.js      # Validate LLM outputs against schema
│   └── test_telegram_commands.js      # Validate Telegram command contracts
├── integration/
│   ├── test_start_flow.js             # /start → profile → recommendation
│   ├── test_new_session.js            # /new → recommendation
│   ├── test_idempotency.js            # Duplicate message handling
│   └── test_dlq.js                    # Retry exhaustion → DLQ
└── migration/
    ├── test_migrations_up.js          # All migrations apply cleanly
    ├── test_migrations_down.js        # All migrations rollback cleanly
    └── test_rls_policies.js           # RLS prevents cross-user access
```

**Structure Decision**: This is an n8n orchestration project with Supabase backend. No traditional application code. All business logic is in n8n workflows (JSON files exported from n8n). Database schema and RLS policies are in Supabase migrations (SQL). JSON Schema contracts are versioned files. Tests validate contracts, workflows, and migrations.

## Phase 0: Outline & Research

**Approach**: Since the technical stack is defined in the constitution (n8n, Supabase, Telegram, OpenAI), Phase 0 focuses on resolving the two NEEDS CLARIFICATION items from the spec and researching n8n best practices for medical domain workflows.

### Research Tasks

1. **Response Timeout Threshold (FR-023)**
   - Decision: 20 seconds end-to-end (as per constitution)
   - Rationale: Constitution specifies ≤20s; medical assistant context requires thoughtful responses but must maintain conversational flow
   - Alternatives considered: 10s (too tight for LLM), 30s (too slow for user engagement)

2. **Data Retention Policy (FR-031)**
   - Decision: 7 years retention for audit/compliance, user-initiated deletion allowed
   - Rationale: Standard healthcare data retention period; GDPR/user rights require deletion option
   - Alternatives considered: Indefinite (compliance risk), 3 years (may be insufficient for medical history patterns)

3. **n8n Best Practices for Medical Workflows**
   - Decision: Use sub-workflows for reusable components, explicit error nodes for DLQ, credentials for secrets, execution history retention 30 days
   - Rationale: Modularity enables testing and auditability; explicit error handling meets medical safety requirements
   - Alternatives considered: Monolithic workflows (hard to test), try-catch nodes only (no DLQ visibility)

4. **JSON Schema Validation in n8n**
   - Decision: Use n8n Function node with Ajv library for JSON Schema validation
   - Rationale: Native support, industry standard validator, detailed error messages for debugging
   - Alternatives considered: Custom validation logic (error-prone), external service (latency overhead)

5. **Supabase RLS Best Practices**
   - Decision: Service role key for n8n with policies checking auth.uid() = userId; separate PII tables
   - Rationale: RLS at DB level prevents data leaks even if application logic fails
   - Alternatives considered: Application-level filtering (bypassable), no PII separation (compliance risk)

6. **Telegram Duplicate Message Handling**
   - Decision: Composite unique index on (telegram_message_id, telegram_user_id) in messages table; workflow checks for existing message before processing
   - Rationale: Database constraint enforces idempotency; workflow check prevents duplicate LLM calls
   - Alternatives considered: In-memory deduplication (loses state on restart), idempotency at LLM level only (wastes tokens)

### Research Summary

All unknowns resolved. Technical approach validated:
- n8n workflows with sub-workflow modularity
- Supabase with RLS and PII separation
- JSON Schema validation via Ajv in n8n Function nodes
- Idempotency via DB unique constraints + workflow checks
- 20s timeout, 7-year retention with user deletion rights

**Output**: [research.md will be created with this content]

## Phase 1: Design & Contracts

### Data Model

The following entities will be defined in `data-model.md`:

1. **users** (identity, non-PII)
   - id (UUID, PK)
   - telegram_user_id (BIGINT, unique)
   - consent_given (BOOLEAN)
   - account_status (ENUM: active, suspended)
   - created_at (TIMESTAMPTZ)
   - updated_at (TIMESTAMPTZ)

2. **user_profiles** (PII, health data)
   - id (UUID, PK)
   - user_id (UUID, FK → users.id)
   - age (INTEGER)
   - biological_sex (ENUM: male, female, other, prefer_not_to_say)
   - height_cm (INTEGER)
   - weight_kg (NUMERIC(5,2))
   - medical_history (JSONB)
   - current_medications (JSONB)
   - created_at (TIMESTAMPTZ)
   - updated_at (TIMESTAMPTZ)
   - RLS: user_id = auth.uid()

3. **sessions**
   - id (UUID, PK)
   - user_id (UUID, FK → users.id)
   - session_status (ENUM: active, completed, abandoned)
   - created_at (TIMESTAMPTZ)
   - completed_at (TIMESTAMPTZ)
   - RLS: user_id = auth.uid()

4. **messages**
   - id (UUID, PK)
   - session_id (UUID, FK → sessions.id)
   - telegram_message_id (BIGINT)
   - telegram_user_id (BIGINT)
   - direction (ENUM: inbound, outbound)
   - content (TEXT)
   - created_at (TIMESTAMPTZ)
   - UNIQUE (telegram_message_id, telegram_user_id)
   - RLS: session.user_id = auth.uid()

5. **ai_responses**
   - id (UUID, PK)
   - session_id (UUID, FK → sessions.id)
   - message_id (UUID, FK → messages.id)
   - schema_version (VARCHAR, default 'v1')
   - response_data (JSONB) -- validated against airesponse.v1
   - confidence (NUMERIC(3,2))
   - created_at (TIMESTAMPTZ)
   - RLS: session.user_id = auth.uid()

6. **audit_logs**
   - id (UUID, PK)
   - user_id (UUID, FK → users.id)
   - session_id (UUID, nullable)
   - message_id (UUID, nullable)
   - operation_type (VARCHAR)
   - operation_status (ENUM: success, failure)
   - details (JSONB)
   - created_at (TIMESTAMPTZ)
   - RLS: user_id = auth.uid() OR admin role

7. **dlq** (dead letter queue)
   - id (UUID, PK)
   - workflow_name (VARCHAR)
   - original_data (JSONB)
   - failure_reason (TEXT)
   - retry_attempts (INTEGER)
   - created_at (TIMESTAMPTZ)
   - resolved_at (TIMESTAMPTZ, nullable)
   - RLS: admin role only

### Contracts

#### airesponse.v1.schema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["summary", "red_flags", "lifestyle", "self_care", "talk_to_doctor", "next_steps", "confidence", "disclaimer"],
  "properties": {
    "summary": { "type": "string", "minLength": 10, "maxLength": 500 },
    "red_flags": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 0,
      "maxItems": 10
    },
    "lifestyle": {
      "type": "object",
      "required": ["diet", "exercise", "sleep"],
      "properties": {
        "diet": { "type": "string" },
        "exercise": { "type": "string" },
        "sleep": { "type": "string" }
      }
    },
    "self_care": {
      "type": "object",
      "required": ["recommendations"],
      "properties": {
        "recommendations": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "maxItems": 5
        }
      }
    },
    "talk_to_doctor": {
      "type": "object",
      "required": ["topics"],
      "properties": {
        "topics": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "maxItems": 5
        }
      }
    },
    "next_steps": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "maxItems": 2
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "disclaimer": { "type": "string", "minLength": 50 },
    "sources": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

#### telegram-commands.yaml
```yaml
commands:
  - command: /start
    description: "Initiate new user session and collect consent"
    parameters: []
    response_type: "text"
    flow: "telegram-intake → user-resolve-create → profile-enrich → send welcome"

  - command: /new
    description: "Begin fresh health consultation session"
    parameters: []
    response_type: "text"
    flow: "telegram-intake → create session → request health concern"

  - command: /profile
    description: "Display stored user health profile"
    parameters: []
    response_type: "text"
    flow: "telegram-intake → fetch user_profiles → mask PII → send formatted profile"

  - command: /help
    description: "Provide usage instructions"
    parameters: []
    response_type: "text"
    flow: "telegram-intake → send help text"

message_intake:
  type: "free-form text"
  flow: "telegram-intake → recommendation-generate → response-send"
```

#### supabase-rpc.yaml
```yaml
functions:
  - name: create_user_with_profile
    description: "Atomic user + profile creation"
    parameters:
      - telegram_user_id: bigint
      - consent_given: boolean
      - age: integer
      - biological_sex: text
      - height_cm: integer
      - weight_kg: numeric
    returns: uuid (user_id)
    security: service_role

  - name: get_user_by_telegram_id
    description: "Resolve user from Telegram ID"
    parameters:
      - telegram_user_id: bigint
    returns: user row
    security: service_role

  - name: create_session
    description: "Start new consultation session"
    parameters:
      - user_id: uuid
    returns: uuid (session_id)
    security: RLS enforced

  - name: log_audit_event
    description: "Append to audit log"
    parameters:
      - user_id: uuid
      - operation_type: text
      - operation_status: text
      - details: jsonb
    returns: void
    security: service_role
```

### Quickstart Scenarios

The `quickstart.md` will contain manual testing steps:

1. **New User Flow**
   - Send `/start` to bot
   - Verify consent prompt appears
   - Provide consent
   - Verify profile collection (age, sex, height, weight, conditions, meds)
   - Describe health concern
   - Verify structured recommendation appears with all required fields
   - Check Supabase: users, user_profiles, sessions, messages, ai_responses, audit_logs all populated

2. **Returning User Flow**
   - Send `/new` to bot
   - Verify session created without profile re-collection
   - Describe different health concern
   - Verify new recommendation without duplication

3. **Idempotency Test**
   - Send same message twice in rapid succession
   - Verify identical response both times
   - Check Supabase: only one message, one ai_response record

4. **Profile View**
   - Send `/profile`
   - Verify profile displayed without raw PII in bot message

5. **Help**
   - Send `/help`
   - Verify command list displayed

### Agent File Update

Will execute `.specify/scripts/bash/update-agent-context.sh claude` to create/update `CLAUDE.md` with:
- Technology stack: n8n, Supabase, Telegram Bot API, OpenAI API
- Key patterns: JSON Schema validation, RLS policies, idempotency via composite keys
- Recent changes: Initial MVP architecture

**Output**: data-model.md, contracts/airesponse.v1.schema.json, contracts/telegram-commands.yaml, contracts/supabase-rpc.yaml, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load data-model.md → generate migration tasks for each table (7 tasks) [P]
2. Load contracts/ → generate JSON Schema file creation task, contract test tasks (3 tasks) [P]
3. Load quickstart.md → generate integration test tasks for each scenario (5 tasks) [P]
4. Generate n8n workflow creation tasks based on standard workflow pattern:
   - Reusable sub-workflows (4 tasks) [P]
   - Main workflows (6 tasks, sequential dependencies)
5. Generate n8n configuration tasks (credentials, environment) (2 tasks)
6. Generate documentation and validation tasks (2 tasks)

**Ordering Strategy**:
1. Setup: Supabase migrations, JSON Schema files, n8n credentials
2. Tests: Contract tests for schemas, integration tests for workflows (all must fail initially)
3. Core: Reusable n8n sub-workflows
4. Integration: Main n8n workflows (depend on sub-workflows)
5. Validation: Run quickstart.md, verify all tests pass

**Estimated Output**: ~30 tasks in tasks.md

**Dependencies**:
- Migrations must complete before n8n workflows (workflows query DB)
- Reusable sub-workflows before main workflows
- Tests before implementations (TDD mindset for workflows)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md: create migrations, JSON schemas, n8n workflows)
**Phase 5**: Validation (run quickstart.md, execute contract and integration tests, verify metrics)

## Complexity Tracking

No constitutional violations detected. This design fully aligns with all 8 core principles.

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (20s timeout, 7-year retention)
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.0.0 - See `.specify/memory/constitution.md`*
