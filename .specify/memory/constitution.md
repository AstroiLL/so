<!--
Sync Impact Report:
Version change: 2.0.0 → 2.1.0
List of modified principles:
  - LLM Integration Rules: Updated to include mandatory Russian language instruction
Added sections:
  - Language Standards and Localization (new principle IX)
Removed sections: None
Templates requiring updates:
  ✅ plan-template.md (Constitution Check section aligns with new language principle)
  ✅ spec-template.md (Requirements should specify language for UI/content)
  ✅ tasks-template.md (Tasks should include language validation checks)
Follow-up TODOs: None
-->

# Second Opinion Constitution

**Version**: 2.1.0
**Ratified**: 2025-10-06
**Last Amended**: 2025-10-06

## Project Context

**Name**: Second Opinion
**Type**: Telegram-first medical assistant with backend-first architecture
**Technology Stack**: n8n (orchestration), Supabase (PostgreSQL + RLS), Telegram Bot API, LLM via n8n OpenAI node
**Key Artifacts**: JSON Schema for AI responses and recommendations, ERD/DDL for Supabase, status notation with enums, DLQ and idempotency in n8n
**MVP Goal**: Secure intake, data normalization, generation of structured recommendations (summary, red flags, lifestyle, self-care, talk-to-doctor, next steps, confidence, disclaimer) and dialog in Telegram

---

## Core Principles (Non-Negotiable)

### I. Backend-First

**Principle**: All business logic, validation, and contracts MUST reside in the backend and data schemas. Telegram serves ONLY as a transport and UX layer.

**Rules**:
- No critical business logic in client code
- All validation happens backend-side before persistence
- Contracts (JSON Schema, API specs) are source of truth
- Client receives pre-validated, structured responses

**Rationale**: Decoupling logic from UI ensures consistent behavior across clients, enables rigorous testing, and prevents client-side manipulation of critical flows.

### II. Event-Driven Orchestration (n8n)

**Principle**: All business flows MUST be expressed as explicit n8n workflows. Retry with exponential backoff, DLQ (Dead Letter Queue), and idempotency by messageId/composite keys are MANDATORY.

**Rules**:
- Every user action → n8n workflow trigger
- Failed operations → DLQ with retry strategy (exponential backoff)
- Idempotency enforced via messageId + telegramUserId composite keys
- No hidden state transitions outside workflow definitions

**Rationale**: Explicit workflows make business logic auditable and debuggable. DLQ and idempotency ensure resilience against transient failures and duplicate Telegram message deliveries.

### III. Data Contracts First

**Principle**: Any AI response MUST conform to approved JSON Schema. Any schema change MUST go through migrations and versioning.

**Rules**:
- JSON Schema validation precedes all persistence
- Schema versioning (e.g., airesponse.v1 → v2) is mandatory
- Schema changes require migration scripts and rollback plans
- No schema bypass or ad-hoc structure modifications

**Rationale**: Data contracts guarantee predictable system behavior, enable automated validation, and protect against breaking changes.

### IV. Supabase as Source of Truth

**Principle**: Supabase PostgreSQL database is the single source of truth. Strict RLS (Row-Level Security) enforcement, PII/domain data separation, and minimal REST/RPC surface area are MANDATORY.

**Rules**:
- All reads/writes enforce RLS policies
- PII isolated from domain data (separate tables/columns)
- n8n accesses via service key with strict access policies
- No direct public access to sensitive data

**Rationale**: Centralized data ownership with RLS ensures data integrity and access control at database level, reducing attack surface.

### V. Deterministic Integrations

**Principle**: All external calls (LLM, Telegram, Supabase) MUST be wrapped in clients with explicit serialization, logging, and error control.

**Rules**:
- Standardized client wrappers for each external service
- Request/response logged with correlation IDs
- Error handling with typed error codes
- No direct HTTP calls in business logic

**Rationale**: Deterministic integration layers enable tracing, testing, and consistent error handling across the system.

### VI. Observability and Audit

**Principle**: Full audit log for critical operations. Correlation by userId/sessionId/messageId is MANDATORY.

**Rules**:
- Structured logging with levels (DEBUG, INFO, WARN, ERROR)
- PII masked in logs
- All critical operations (user creation, LLM calls, data mutations) audited
- Correlation IDs propagated through entire request chain

**Rationale**: Observability enables debugging production issues, security audits, and compliance verification.

### VII. Security by Default

**Principle**: Minimal privileges, secrets ONLY in n8n credentials, strict user data access policies.

**Rules**:
- Secrets never hardcoded or logged
- n8n credentials store for all API keys
- Least-privilege access patterns (RLS policies enforce userId scoping)
- PII never exposed in API responses or logs

**Rationale**: Security-first design prevents credential leaks, unauthorized access, and data breaches.

### VIII. Transparent Evolution

**Principle**: Any contract/schema/constitution change MUST go through PR, update checklist, and semantic versioning.

**Rules**:
- PR required for all constitution amendments
- Update checklist verifies impact on /plan, /tasks, templates
- Semantic versioning: MAJOR (breaking), MINOR (additive), PATCH (clarification)
- Change log maintained in constitution header

**Rationale**: Transparent evolution ensures team alignment, prevents accidental breaking changes, and maintains project coherence.

### IX. Language Standards and Localization

**Principle**: Russian language is the primary interface language. All user-facing content MUST be in Russian. Technical implementation uses English conventions with Russian documentation.

**Rules**:

**User-Facing Content** (MUST be Russian):
- All Telegram bot messages, commands, buttons, and instructions
- AI-generated responses (summary, red_flags, lifestyle, self_care, talk_to_doctor, next_steps, disclaimer)
- Error messages and user notifications
- System prompts MUST include explicit instruction: "Отвечай исключительно на русском языке"
- Medical disclaimers formatted for Russian medical context and mentality

**Technical Implementation** (English with Russian documentation):
- Variable names, function names, n8n workflow names in English (compatibility)
- Code comments in n8n workflows and SQL schemas in Russian (team convenience)
- System logs in English with Russian explanations where needed

**Data Processing**:
- User input accepted and processed in Russian
- Text validation and normalization handles Cyrillic and Russian morphology
- PostgreSQL full-text search configured for Russian language (russian configuration)
- JSON Schema supports UTF-8 for correct Cyrillic storage

**Quality Control**:
- AI prompts include style instructions: "Используй медицинскую терминологию, понятную обычному пользователю"
- Responses align with Russian cultural expectations regarding health
- Testing includes validation of correct Russian language in AI outputs

**Future Scalability**:
- Architecture allows adding languages via `user.preferred_language` parameter
- Current implementation optimized for Russian as primary language

**Rationale**: Russian-first approach ensures cultural and linguistic appropriateness for target user base, while English technical conventions maintain compatibility with international tooling and libraries.

---

## Data Standards and Contracts

### Units and Identifiers

- **Units**: SI units (cm, kg); timestamps as `timestamptz` (UTC)
- **Identifiers**: UUID for entities; `telegramUserId` stored separately, linked via `userId`

### Row-Level Security (RLS)

- Access scoped by `userId`
- All n8n queries use service key with strict policies
- No user can access another user's data

### JSON Schema Standards

**`airesponse.v1`** structure (fixed):
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

**Validation**: All AI responses validated against JSON Schema in n8n before persistence.

### Enums

- Source, session status, and other domain enums centralized
- Changes via migrations only

---

## Quality, Security, and Compliance

### Validation Gates

- Incoming Telegram intake → normalization → schema validate → persist → response
- Validation failure → structured error + DLQ

### PII Policy

- PII isolated (separate tables/columns)
- Access only on strict need-to-know basis
- PII masked in all logs

### Logging Standards

- Structured logs (JSON format) with levels
- No PII in logs
- Trace correlation via userId/sessionId/messageId

### Testing Standards

- Contract tests for JSON Schema conformance
- Migration tests (up/down, idempotency)
- Idempotency tests for duplicate Telegram message handling
- Language validation tests for Russian content correctness

### Load and Longevity Risks

- DLQ and retry strategy documented
- Telegram delivery windows assessed
- Performance benchmarks for LLM and DB operations

---

## LLM Integration Rules

### Principle

LLM is a formatting and extraction tool. Source of truth is schemas and database.

### Rules

- Prompts constructed from code (n8n Function/Template) with strict JSON output instructions
- All prompts MUST include language instruction: "Отвечай исключительно на русском языке"
- Post-validation MANDATORY: response MUST match JSON Schema
- Schema mismatch → retry with compressed context; exhaustion → DLQ
- No "guessing" of identifiers or personal data; all from DB and intake

### Prompt Construction

- Hardcoded prompt templates in n8n
- Schema definition embedded in prompt
- Clear instruction: "Output ONLY valid JSON matching schema X"
- Explicit language instruction: "Отвечай исключительно на русском языке"
- Style guidance: "Используй медицинскую терминологию, понятную обычному пользователю"

---

## Telegram UX and Behavior

### Commands

- `/start`: Initiate session
- `/profile`: View user profile
- `/help`: Get help
- `/new`: Start new conversation

### Response Behavior

- Atomic responses with explicit reference to original messageId
- No PII leakage
- CTA hints during wait states
- All messages in Russian

### Duplicate Handling

- Idempotent processing by `messageId + telegramUserId`
- Duplicate messages result in same response (no side effects)

---

## n8n Mandatory Patterns

### Reusable Node Library

- Supabase Client (query, insert, update with RLS)
- JSON Schema Validator
- Logger (structured logging)
- Retry Policy (exponential backoff + DLQ)

### Standard Workflow

```
Intake → Resolve/Create User → Enrich Profile → Build Prompt → LLM Call →
JSON Validate → Persist AI Response → Send Telegram → Error Handler
```

### Secrets Management

- `TELEGRAM_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `LLM_KEY` stored in n8n credentials ONLY

---

## Schema Migrations and Evolution

### Migration Rules

- All DB changes via migrations
- Forward compatibility where possible
- JSON Schema versioning (v1 → v2) with adapters for reading old versions

### Versioning

- Semantic versioning for schemas: MAJOR (breaking), MINOR (additive), PATCH (fix)
- Adapters for cross-version reads

### Update Checklist

- Update constitution when schema principles change
- Review impact on /plan and /tasks
- Update templates and prompts

---

## SDD Workflow and Branching

### Workflow Sequence

`/constitution → /specify → /plan → /tasks → implement → PR → merge`

### Branching Strategy

- Each feature → dedicated branch
- Linear history; small, focused tasks
- Automated schema and migration checks in CI

### Alignment Requirement

- Plans and tasks MUST align with constitution
- Non-compliant plans rejected and reworked

---

## Prohibited Practices

1. Saving AI responses without JSON Schema validation
2. Bypassing RLS or mixing PII with domain data
3. Hidden schema/enum changes outside migrations and review
4. Hardcoding secrets, logging PII, arbitrary retries without strategy
5. Generating AI responses in languages other than Russian without explicit user preference

---

## Metrics and Observability

### Key Metrics

- Valid AI response rate
- Retry/dropout rate
- Average LLM latency
- Average Telegram latency
- DLQ frequency
- CTA conversion rate

### Alarms

- DLQ growth
- Invalid response rate increase
- RLS/access errors
- Latency threshold exceeded

---

## Constitution Amendment Procedure

### Process

1. Initiate via PR + `constitution_update_checklist.md` with motivation and impact description
2. Audit impact on `/plan` and `/tasks`
3. Update templates and prompts if necessary
4. Semantic versioning: MAJOR, MINOR, or PATCH
5. Change log in constitution header

### Versioning Rules

- **MAJOR**: Backward-incompatible governance or principle removal/redefinition
- **MINOR**: New principle/section or material expansion
- **PATCH**: Clarification, wording, typo fixes

---

## Governance

### Authority

This constitution supersedes all other practices. In case of conflict, constitution principles take precedence.

### Compliance Review

- All PRs MUST verify alignment with constitution
- Plans and tasks checked against principles
- Complexity must be justified (documented in Complexity Tracking section)

### Amendment Requirements

- PR with rationale
- Impact analysis
- Team approval
- Version bump

---

*End of Constitution v2.1.0*
