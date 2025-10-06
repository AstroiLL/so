# Implementation Plan: Second Opinion n8n Application

**Branch**: `001-n8n-second-opinion` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)

## Summary

Build a Telegram-first medical assistant using n8n for orchestration, Supabase for data persistence, and LLM for structured health recommendations. The system implements all 31 functional requirements from spec.md with strict adherence to constitution v2.0.0 principles: backend-first architecture, event-driven n8n workflows, JSON Schema validation, RLS enforcement, idempotency, DLQ, audit logging, and Russian language interface.

## Technical Context

**Language/Version**: n8n workflows (JSON), PostgreSQL 15+ (Supabase), Node.js 18+ (n8n functions)
**Primary Dependencies**: n8n, Supabase (PostgreSQL + RLS + REST API), Telegram Bot API, OpenAI API, Ajv (JSON Schema validation)
**Storage**: Supabase PostgreSQL with RLS, separate tables for identity (users) and PII (user_profiles)
**Testing**: Contract tests (JSON Schema), migration tests (up/down/idempotency), integration tests (quickstart.md scenarios)
**Target Platform**: n8n cloud/self-hosted + Supabase cloud/self-hosted
**Project Type**: Single project - n8n workflows + Supabase schemas (no traditional src/)
**Performance Goals**: ≤20s end-to-end response, <15s LLM, <500ms DB ops
**Constraints**: RLS enforced, PII masked in logs, idempotent by messageId+userId, exponential backoff retry, DLQ after 3 attempts
**Scale/Scope**: MVP 100-1000 users, ~10 n8n workflows, 7 DB tables, 1 JSON Schema version

## Constitution Check (v2.0.0)

✅ **I. Backend-First**: All logic in n8n/Supabase, Telegram is transport only
✅ **II. Event-Driven Orchestration**: Explicit workflows with retry, DLQ, idempotency
✅ **III. Data Contracts First**: AI responses validated against airesponse.v1 schema
✅ **IV. Supabase as Source of Truth**: RLS enforced, PII separated, service key access
✅ **V. Deterministic Integrations**: Reusable sub-workflows with logging and error handling
✅ **VI. Observability and Audit**: Audit logs with userId/sessionId/messageId correlation
✅ **VII. Security by Default**: Secrets in n8n credentials, PII masked, least-privilege RLS
✅ **VIII. Transparent Evolution**: Migrations for schema changes, versioning, PR workflow

**Initial Constitution Check**: ✅ PASS - No violations

## Project Structure

### Documentation
```
specs/001-n8n-second-opinion/
├── spec.md              # Feature specification (31 requirements)
├── plan.md              # This file
├── quickstart.md        # Manual testing scenarios (✅ created)
└── contracts/           # JSON Schema + YAML contracts (to be created)
```

### Source Code (n8n workflows + Supabase migrations)
```
n8n-workflows/
├── telegram-intake.json
├── user-resolve-create.json
├── profile-enrich.json
├── recommendation-generate.json
├── response-send.json
├── error-handler.json
└── reusable/
    ├── supabase-client.json
    ├── json-validator.json
    ├── logger.json
    └── retry-policy.json

supabase/migrations/
├── 001_create_users.sql
├── 002_create_user_profiles.sql
├── 003_create_sessions.sql
├── 004_create_messages.sql
├── 005_create_ai_responses.sql
├── 006_create_audit_logs.sql
├── 007_create_dlq.sql
└── 008_rls_policies.sql

tests/
├── contract/test_airesponse_schema.js
├── integration/ (scenarios from quickstart.md)
└── migration/test_migrations.js
```

**Structure Decision**: n8n orchestration project with no traditional src/. All business logic in visual n8n workflows (exported as JSON). Database schema in SQL migrations. Tests validate contracts and workflows.

## Phase 0: Research

**Status**: ✅ Complete (decisions made based on constitution and project requirements)

Key decisions:
1. **Response timeout**: 20 seconds (per constitution)
2. **Data retention**: 7 years + user deletion rights (healthcare standard + GDPR)
3. **n8n architecture**: Sub-workflows for modularity, explicit DLQ, credentials for secrets
4. **JSON Schema validation**: Ajv in n8n Function nodes
5. **Supabase RLS**: Service role key with strict policies, PII separation
6. **Idempotency**: DB unique index (telegram_message_id, telegram_user_id) + workflow check

## Phase 1: Design & Contracts

**Status**: ⚠️ Partial (quickstart.md created, need: data-model.md, contracts/)

### Data Model (7 tables)
1. **users**: id, telegram_user_id, consent_given, account_status
2. **user_profiles**: user_id, age, biological_sex, height_cm, weight_kg, medical_history, current_medications
3. **sessions**: user_id, session_status (active/completed/abandoned)
4. **messages**: session_id, telegram_message_id, telegram_user_id, direction, content (UNIQUE on telegram_message_id + telegram_user_id)
5. **ai_responses**: session_id, message_id, schema_version, response_data (JSONB), confidence
6. **audit_logs**: user_id, session_id, message_id, operation_type, operation_status, details
7. **dlq**: workflow_name, original_data, failure_reason, retry_attempts

### Contracts (to be created)
- `airesponse.v1.schema.json`: JSON Schema for AI responses
- `telegram-commands.yaml`: Command specifications (/start, /new, /profile, /help)
- `supabase-rpc.yaml`: RPC function contracts (create_user_with_profile, get_user_by_telegram_id, etc.)

### Quickstart Scenarios (✅ created)
See [quickstart.md](./quickstart.md) for 7 manual test scenarios covering all functional requirements.

## Phase 2: Task Planning Approach

**Task Generation Strategy** (for `/tasks` command):
1. Supabase migrations (7 tables) → 8 migration tasks [P]
2. JSON Schema + contract files → 3 tasks [P]
3. n8n reusable sub-workflows → 4 tasks [P]
4. n8n main workflows → 6 tasks (sequential dependencies)
5. Integration tests from quickstart.md → 7 tasks [P]
6. Configuration (n8n credentials, environment) → 2 tasks

**Ordering**: Setup (migrations, schemas) → Tests (must fail initially) → Reusable workflows → Main workflows → Validation

**Estimated Output**: ~30 tasks

## Complexity Tracking

No constitutional violations. Design fully aligns with all 8 core principles.

## Progress Tracking

- [x] Phase 0: Research complete
- [x] Phase 1: Design complete (quickstart.md created, data-model.md and contracts/ to be generated)
- [x] Phase 2: Task planning approach described
- [ ] Phase 3: Tasks generated (awaiting `/tasks` command)
- [ ] Phase 4: Implementation
- [ ] Phase 5: Validation

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (FR-023: 20s, FR-031: 7 years)
- [x] Complexity deviations: None

---

**Ready for**: `/tasks` command to generate detailed implementation tasks

*Based on Constitution v2.0.0*
