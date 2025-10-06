# Claude Code Context - Second Opinion

**Last Updated**: 2025-10-06
**Constitution Version**: 2.1.0
**Current Feature**: 001-n8n-second-opinion

## Project Overview

**Second Opinion** - Telegram-first medical assistant with backend-first architecture

### Technology Stack
- **Orchestration**: n8n (visual workflows, no traditional code)
- **Database**: Supabase (PostgreSQL 15+ with RLS)
- **Messaging**: Telegram Bot API
- **AI**: OpenAI API via n8n node
- **Validation**: Ajv (JSON Schema) in n8n Function nodes

### Key Architectural Patterns
1. **Backend-First**: All logic in n8n workflows + Supabase schemas
2. **Event-Driven**: Every user action → explicit n8n workflow
3. **Data Contracts**: AI responses validated against JSON Schema before persistence
4. **RLS**: Row-Level Security enforces userId scoping at DB level
5. **Idempotency**: Composite keys (telegram_message_id, telegram_user_id)
6. **DLQ**: Failed operations → dead letter queue after 3 retries
7. **Russian-First**: All user-facing content in Russian language

### Project Structure
```
specs/001-n8n-second-opinion/    # Current feature documentation
  ├── spec.md                     # Feature requirements
  ├── contracts/                  # JSON Schema, YAML contracts
  ├── data-model.md               # Database schema
  └── quickstart.md               # Manual testing guide

n8n-workflows/                    # n8n workflow exports (JSON)
  ├── telegram-intake.json
  ├── recommendation-generate.json
  └── reusable/                   # Sub-workflows

supabase/migrations/              # Database migrations (SQL)
  ├── 001_create_users.sql
  ├── 002_create_user_profiles.sql
  └── 008_rls_policies.sql

tests/                            # Contract + integration tests
  ├── contract/
  ├── integration/
  └── migration/
```

### Core Data Model
- **users** (identity, non-PII): telegram_user_id, consent, status
- **user_profiles** (PII): age, sex, height, weight, medical_history, medications
- **sessions**: conversation instances
- **messages**: Telegram messages (unique on telegram_message_id + telegram_user_id)
- **ai_responses**: Validated AI outputs (JSONB conforming to airesponse.v1 schema)
- **audit_logs**: All critical operations
- **dlq**: Failed operations requiring manual review

### JSON Schema: airesponse.v1
```json
{
  "summary": "string",
  "red_flags": ["string"],
  "lifestyle": { "diet": "...", "exercise": "...", "sleep": "..." },
  "self_care": { "recommendations": ["..."] },
  "talk_to_doctor": { "topics": ["..."] },
  "next_steps": ["step1", "step2"],
  "confidence": 0.85,
  "disclaimer": "string",
  "sources": ["optional"]
}
```

### Standard n8n Workflow Pattern
```
Telegram Webhook →
  Check Duplicate (messageId + userId) →
    If Duplicate: Return Cached Response
    If New:
      Resolve/Create User →
      Enrich Profile (if needed) →
      Build Prompt (include Russian language instruction) →
      LLM Call →
      JSON Schema Validate →
        If Valid: Persist → Send Telegram Response
        If Invalid: Retry (max 3) → DLQ
      Log Audit Event
```

### Key Principles (Constitution v2.1.0)
1. **No business logic in Telegram client** - only UI/transport
2. **All AI responses MUST pass JSON Schema validation**
3. **RLS policies enforce data isolation** - no cross-user access
4. **Secrets only in n8n credentials** - never hardcoded
5. **PII masked in logs** - use ranges for age/height/weight
6. **Idempotent operations** - DB constraints + workflow checks
7. **Russian language mandatory** - prompts include "Отвечай исключительно на русском языке"
8. **Audit everything** - correlation via userId/sessionId/messageId

### Recent Changes
- 2025-10-06: Constitution v2.1.0 added Language Standards principle (Russian-first)
- 2025-10-06: Feature 001 specification created with 31 functional requirements
- 2025-10-06: Data model designed with 7 tables (RLS, PII separation)
- 2025-10-06: JSON Schema contract (airesponse.v1) defined
- 2025-10-06: Quickstart manual testing guide created

### Performance Targets
- End-to-end response: ≤20 seconds (95th percentile)
- LLM call: <15 seconds
- DB operations: <500ms
- Retry strategy: Exponential backoff, max 3 attempts
- DLQ threshold: After 3 failed retries

### Development Workflow
```
/constitution → /specify → /plan → /tasks → implement → PR → merge
```

Current status: Phase 1 (Design & Contracts) in progress

---

**Note**: This is an n8n orchestration project, not a traditional codebase. "Code" consists of visual n8n workflows exported as JSON files.
