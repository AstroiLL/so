# Research: Second Opinion n8n Application

**Date**: 2025-10-06
**Feature**: 001-n8n-second-opinion

## Purpose

Resolve NEEDS CLARIFICATION items from spec.md and validate technical approach for n8n + Supabase + Telegram + LLM architecture.

---

## 1. Response Timeout Threshold (FR-023)

### Decision
20 seconds end-to-end response time

### Rationale
- Constitution explicitly specifies ≤20 seconds
- Medical assistant context requires thoughtful, detailed responses (can't rush AI generation)
- User engagement research shows conversational interfaces lose user attention beyond 20-25 seconds
- Breakdown: Telegram delivery (0.5s) + n8n orchestration (1s) + DB queries (1s) + LLM call (15s) + validation (0.5s) + response formatting (1s) + Telegram send (1s) = ~20s

### Alternatives Considered
- **10 seconds**: Too tight for LLM generation with detailed medical recommendations; would require streaming (not supported in Telegram bot architecture)
- **30 seconds**: Acceptable for batch operations but too slow for conversational flow; users would assume bot is broken
- **No timeout**: Risks indefinite hangs; prevents proper error handling and DLQ routing

### Implementation Notes
- n8n workflow timeout set to 22 seconds (buffer for network variance)
- If LLM call exceeds 15 seconds → DLQ with retry
- User receives "Processing your request, this may take a moment..." after 5 seconds

---

## 2. Data Retention Policy (FR-031)

### Decision
7 years retention for audit/compliance, with user-initiated deletion allowed

### Rationale
- **7 years**: Standard healthcare data retention period in most jurisdictions (HIPAA, GDPR healthcare extensions)
- **User deletion rights**: GDPR Article 17 "Right to Erasure" requires ability to delete personal data on request
- **Audit requirement**: Constitution mandates full audit logs for critical operations; logs must persist for compliance review

### Alternatives Considered
- **Indefinite retention**: Compliance risk (GDPR "storage limitation" principle); storage cost grows unbounded
- **3 years**: May be insufficient for medical history pattern analysis; some healthcare regulations require longer
- **No deletion option**: GDPR violation; user cannot exercise data rights

### Implementation Notes
- Supabase function `delete_user_data(user_id UUID)` performs cascading soft-delete (sets deleted_at timestamp)
- Audit logs retain operation_type='USER_DELETION' record even after user data purged
- Automated cleanup job (Supabase cron or n8n scheduled workflow) hard-deletes records where deleted_at > 7 years
- User deletion triggered via Telegram command `/delete_my_data` with confirmation flow

---

## 3. n8n Best Practices for Medical Workflows

### Decision
- Sub-workflows for reusable components (Supabase Client, JSON Validator, Logger, Retry Policy)
- Explicit error nodes for DLQ (no silent failures)
- Credentials store for all secrets
- Execution history retention: 30 days (regulatory requirement)

### Rationale
- **Sub-workflows**: Modularity enables unit testing, version control, and reuse across main workflows
- **Explicit error handling**: Medical domain requires visibility into all failure modes; no silent degradation
- **Credentials store**: n8n encrypted credentials prevent secret leakage in workflow exports/backups
- **30-day history**: Minimum retention for debugging user-reported issues and compliance audits

### Alternatives Considered
- **Monolithic workflows**: Simpler to build initially but impossible to test components in isolation; debugging becomes nightmare at scale
- **Try-catch nodes only**: Errors caught but not routed to DLQ for manual review; silent failures violate medical safety principles
- **Environment variables for secrets**: Risk exposure in logs, process dumps, or CI/CD pipelines

### Implementation Notes
- Create reusable sub-workflows in `n8n-workflows/reusable/`
- Every main workflow includes error handler sub-workflow call on failure
- n8n credentials: `TELEGRAM_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`
- Enable n8n execution data retention setting: 30 days

---

## 4. JSON Schema Validation in n8n

### Decision
Use n8n Function node with Ajv library for JSON Schema validation

### Rationale
- **Ajv**: Industry-standard JSON Schema validator (draft-07 support), battle-tested, detailed error messages
- **Function node**: Native n8n support, runs synchronously in workflow, no external service latency
- **Constitution alignment**: "Post-validation MANDATORY: response MUST match JSON Schema"

### Alternatives Considered
- **Custom validation logic**: Error-prone to implement; misses edge cases; no standard error format
- **External validation service**: Adds network hop (~200ms latency); introduces single point of failure; requires credentials
- **No validation**: Constitutional violation; allows malformed AI responses to reach users

### Implementation Notes
```javascript
// n8n Function node: JSON Schema Validator
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });

const schema = $node["Load Schema"].json; // From previous node
const data = $node["LLM Response"].json;

const validate = ajv.compile(schema);
const valid = validate(data);

if (!valid) {
  throw new Error(`Schema validation failed: ${JSON.stringify(validate.errors)}`);
}

return { json: data };
```

- Validation failure → caught by error handler → DLQ with retry
- Schema file loaded from Supabase storage (versioned, immutable)

---

## 5. Supabase RLS Best Practices

### Decision
- n8n uses service role key (bypasses RLS) with explicit policy enforcement in workflows
- RLS policies on all user-scoped tables: `WHERE user_id = auth.uid()`
- Separate tables for PII (`user_profiles`) and identity (`users`)

### Rationale
- **Service role key**: n8n acts as trusted backend service; needs access across users for admin operations (e.g., audit logs)
- **Explicit policy enforcement**: n8n workflows must pass `user_id` in every query; RLS prevents accidental cross-user data leaks
- **PII separation**: Constitution requirement; limits blast radius of accidental data exposure

### Alternatives Considered
- **Anonymous key with RLS**: n8n would need to authenticate as each user (complex token management); doesn't fit backend-first architecture
- **Application-level filtering only**: Bypassable if workflow logic has bug; RLS at DB level is last line of defense
- **No PII separation**: Single breach exposes all user data; violates constitution's "PII isolated" rule

### Implementation Notes
- Supabase RLS policies:
  ```sql
  CREATE POLICY "Users can only access their own profile"
    ON user_profiles FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY "Service role can access all"
    ON user_profiles FOR ALL
    USING (auth.role() = 'service_role');
  ```
- n8n workflows: Always query with `WHERE user_id = $user_id` filter
- PII tables: `user_profiles` (health data), separate from `users` (identity)

---

## 6. Telegram Duplicate Message Handling

### Decision
- Composite unique index on `(telegram_message_id, telegram_user_id)` in messages table
- n8n workflow checks for existing message before processing (idempotency key lookup)
- If duplicate detected → return cached response from ai_responses table

### Rationale
- **DB constraint**: Enforces idempotency at persistence layer; impossible to insert duplicate
- **Workflow check**: Prevents expensive LLM calls for duplicate messages
- **Constitution alignment**: "Idempotency enforced via messageId + telegramUserId composite keys"

### Alternatives Considered
- **In-memory deduplication (Redis)**: Loses state on restart; requires additional infrastructure; eventual consistency risk
- **Idempotency at LLM level only**: Still wastes tokens and latency on duplicate prompts
- **No deduplication**: Telegram webhooks occasionally deliver duplicates; users would see different responses to same message

### Implementation Notes
```sql
-- Migration: 004_create_messages.sql
CREATE UNIQUE INDEX idx_messages_telegram_id_user
  ON messages (telegram_message_id, telegram_user_id);
```

```javascript
// n8n workflow: Check for duplicate
const existingMessage = await supabase
  .from('messages')
  .select('id, ai_responses(response_data)')
  .eq('telegram_message_id', $input.message_id)
  .eq('telegram_user_id', $input.user_id)
  .single();

if (existingMessage.data) {
  // Duplicate detected, return cached response
  return existingMessage.data.ai_responses[0].response_data;
}
// Else: proceed with normal flow
```

---

## Summary

All NEEDS CLARIFICATION items resolved. Technical approach validated:

| Item | Decision | Constitutional Alignment |
|------|----------|-------------------------|
| Response timeout (FR-023) | 20 seconds | Constitution specifies ≤20s |
| Data retention (FR-031) | 7 years + user deletion | Audit requirement + GDPR |
| n8n architecture | Sub-workflows + explicit DLQ | Event-Driven Orchestration principle |
| JSON Schema validation | Ajv in Function node | Data Contracts First principle |
| Supabase RLS | Service key + policies | Supabase as Source of Truth principle |
| Idempotency | DB unique index + workflow check | Event-Driven Orchestration principle |

**Ready for Phase 1**: Design & Contracts
