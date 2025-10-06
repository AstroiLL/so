# Tasks: Second Opinion n8n Application

**Input**: Design documents from `/home/astroill/Sync/GPT/NickRelax/so/specs/001-n8n-second-opinion/`
**Prerequisites**: plan.md, spec.md, quickstart.md

## Path Conventions

Since this is an n8n orchestration project:
- **n8n workflows**: `n8n-workflows/` at repository root (visual workflows exported as JSON)
- **Database migrations**: `supabase/migrations/` at repository root (SQL files)
- **Contracts**: `specs/001-n8n-second-opinion/contracts/` (JSON Schema, YAML)
- **Tests**: `tests/` at repository root

## Phase 3.1: Setup & Prerequisites

- [ ] **T001** [P] Create directory structure: `n8n-workflows/`, `n8n-workflows/reusable/`, `supabase/migrations/`, `tests/contract/`, `tests/integration/`, `tests/migration/`

- [ ] **T002** [P] Create JSON Schema contract file `specs/001-n8n-second-opinion/contracts/airesponse.v1.schema.json` with required fields: summary, red_flags[], lifestyle{diet, exercise, sleep}, self_care{recommendations[]}, talk_to_doctor{topics[]}, next_steps[1-2], confidence (0-1), disclaimer, sources?[]

- [ ] **T003** [P] Create Telegram commands contract `specs/001-n8n-second-opinion/contracts/telegram-commands.yaml` documenting /start, /new, /profile, /help with expected flow sequences and responses (all in Russian)

- [ ] **T004** [P] Create Supabase RPC contract `specs/001-n8n-second-opinion/contracts/supabase-rpc.yaml` documenting functions: create_user_with_profile, get_user_by_telegram_id, create_session, insert_message, insert_ai_response, log_audit_event, insert_dlq_entry

## Phase 3.2: Database Migrations ⚠️ MUST COMPLETE BEFORE Phase 3.4

**CRITICAL**: All migrations must be created and applied to Supabase before n8n workflow implementation

- [ ] **T005** [P] Create migration `supabase/migrations/001_create_users.sql` with table: id (UUID PK), telegram_user_id (BIGINT UNIQUE), consent_given (BOOLEAN), account_status (TEXT CHECK 'active'/'suspended'), created_at, updated_at, deleted_at (soft delete)

- [ ] **T006** [P] Create migration `supabase/migrations/002_create_user_profiles.sql` with table: id (UUID PK), user_id (UUID FK → users.id ON DELETE CASCADE), age (INTEGER CHECK 0-150), biological_sex (ENUM), height_cm (INTEGER CHECK 50-300), weight_kg (NUMERIC CHECK 2-500), medical_history (JSONB DEFAULT '[]'), current_medications (JSONB DEFAULT '[]'), created_at, updated_at

- [ ] **T007** [P] Create migration `supabase/migrations/003_create_sessions.sql` with table: id (UUID PK), user_id (UUID FK → users.id), session_status (ENUM 'active'/'completed'/'abandoned'), created_at, completed_at

- [ ] **T008** [P] Create migration `supabase/migrations/004_create_messages.sql` with table: id (UUID PK), session_id (UUID FK → sessions.id), telegram_message_id (BIGINT), telegram_user_id (BIGINT), direction (ENUM 'inbound'/'outbound'), content (TEXT), created_at, UNIQUE INDEX (telegram_message_id, telegram_user_id) for idempotency

- [ ] **T009** [P] Create migration `supabase/migrations/005_create_ai_responses.sql` with table: id (UUID PK), session_id (UUID FK → sessions.id), message_id (UUID FK → messages.id), schema_version (TEXT DEFAULT 'v1'), response_data (JSONB), confidence (NUMERIC(3,2) CHECK 0-1), created_at

- [ ] **T010** [P] Create migration `supabase/migrations/006_create_audit_logs.sql` with table: id (UUID PK), user_id (UUID FK → users.id nullable), session_id (UUID nullable), message_id (UUID nullable), operation_type (TEXT), operation_status (ENUM 'success'/'failure'), details (JSONB DEFAULT '{}'), created_at

- [ ] **T011** [P] Create migration `supabase/migrations/007_create_dlq.sql` with table: id (UUID PK), workflow_name (TEXT), original_data (JSONB), failure_reason (TEXT), retry_attempts (INTEGER), created_at, resolved_at (nullable)

- [ ] **T012** Create migration `supabase/migrations/008_rls_policies.sql` with RLS policies for all tables: users/user_profiles/sessions/messages/ai_responses (user_id = auth.uid()), audit_logs (user_id = auth.uid() OR admin role), dlq (admin only), service_role bypasses all

- [ ] **T013** Create Supabase RPC functions in `supabase/migrations/009_create_functions.sql`: create_user_with_profile (atomic transaction), get_user_by_telegram_id, get_user_profile, create_session, insert_message (with idempotency), insert_ai_response, get_cached_response, log_audit_event, insert_dlq_entry, delete_user_data (soft delete), get_active_session

## Phase 3.3: Contract Tests (MUST FAIL before implementation)

- [ ] **T014** [P] Create contract test `tests/contract/test_airesponse_schema.js` that loads airesponse.v1.schema.json and validates sample AI responses (valid and invalid cases) using Ajv validator

- [ ] **T015** [P] Create migration test `tests/migration/test_migrations_up.js` that applies all migrations 001-009 in sequence and verifies tables exist with correct columns

- [ ] **T016** [P] Create migration test `tests/migration/test_migrations_down.js` that rolls back migrations in reverse order and verifies clean state

- [ ] **T017** [P] Create migration test `tests/migration/test_rls_policies.js` that verifies RLS prevents cross-user data access: create two users, attempt to access user1's data as user2, expect failure

## Phase 3.4: n8n Reusable Sub-Workflows

**PREREQUISITES**: T005-T013 complete (database must exist)

- [ ] **T018** [P] Create reusable sub-workflow `n8n-workflows/reusable/supabase-client.json` with nodes: HTTP Request (Supabase REST API), credentials reference, error handling, response parsing. Include examples for SELECT, INSERT, UPDATE operations with RLS headers

- [ ] **T019** [P] Create reusable sub-workflow `n8n-workflows/reusable/json-validator.json` with Function node using Ajv library to validate JSON against schema loaded from Supabase storage. Return {valid: boolean, errors: array}

- [ ] **T020** [P] Create reusable sub-workflow `n8n-workflows/reusable/logger.json` with Function node for structured logging (JSON format): {level, message, correlation_ids: {user_id, session_id, message_id}, timestamp}. PII masking function included

- [ ] **T021** [P] Create reusable sub-workflow `n8n-workflows/reusable/retry-policy.json` with Loop node implementing exponential backoff: attempt 1 (0s), attempt 2 (2s), attempt 3 (4s), then route to DLQ

## Phase 3.5: n8n Main Workflows

**PREREQUISITES**: T018-T021 complete (reusable workflows must exist)
**NOTE**: These workflows have dependencies - implement sequentially

- [ ] **T022** Create main workflow `n8n-workflows/error-handler.json` with nodes: Parse Error, Check Retry Attempts, If <3 Retries: Call retry-policy workflow, Else: Insert DLQ Entry (call supabase-client), Log Audit Event (operation_type='WORKFLOW_FAILED')

- [ ] **T023** Create main workflow `n8n-workflows/user-resolve-create.json` with nodes: Call get_user_by_telegram_id RPC, If Not Found: Call create_user_with_profile RPC (with consent_given=false initially), Return user_id. Include error handling via T022

- [ ] **T024** Create main workflow `n8n-workflows/profile-enrich.json` with nodes: Check if user has profile (get_user_profile RPC), If No Profile: Send Telegram prompts (age, sex, height, weight, medical_history, medications) in sequence with state management, Save to user_profiles via supabase-client, Log Audit Event (operation_type='PROFILE_CREATED')

- [ ] **T025** Create main workflow `n8n-workflows/response-send.json` with nodes: Format Response (Markdown for Telegram, Russian language), Call Telegram sendMessage API with chat_id and formatted text, Insert Outbound Message (insert_message RPC with direction='outbound'), Log Audit Event (operation_type='MESSAGE_SENT')

- [ ] **T026** Create main workflow `n8n-workflows/recommendation-generate.json` with nodes: Get User Profile (get_user_profile RPC), Build Prompt (Function node: include profile context + user message + schema definition + Russian language instruction "Отвечай исключительно на русском языке"), Call OpenAI API, Validate Response (call json-validator with airesponse.v1 schema), If Invalid: Retry with compressed prompt (max 3), If Valid: Insert AI Response (insert_ai_response RPC), Log Audit Event (operation_type='AI_RESPONSE_GENERATED')

- [ ] **T027** Create main workflow `n8n-workflows/telegram-intake.json` (Webhook trigger) with nodes: Parse Telegram Update, Check Message Type (command vs text), If Command: Route to /start|/new|/profile|/help handlers, If Text: Check Duplicate (get_cached_response RPC by telegram_message_id+telegram_user_id), If Duplicate: Return Cached, If New: Insert Message (insert_message RPC), Get or Create Session (get_active_session RPC), Call recommendation-generate (T026), Call response-send (T025), All paths include error-handler (T022)

- [ ] **T028** Configure n8n webhook for T027: Set Telegram Bot webhook URL to n8n webhook endpoint via Telegram API setWebhook command

## Phase 3.6: n8n Configuration & Credentials

- [ ] **T029** Configure n8n credentials: TELEGRAM_TOKEN (from @BotFather), SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role key, bypasses RLS), OPENAI_API_KEY. Verify all workflows reference credentials correctly

- [ ] **T030** Upload airesponse.v1.schema.json to Supabase storage bucket 'schemas/' for runtime access by json-validator workflow. Set public read permissions

## Phase 3.7: Integration Tests

**PREREQUISITES**: T022-T028 complete (all workflows must be deployed and active)

- [ ] **T031** [P] Create integration test `tests/integration/test_start_flow.js` implementing quickstart.md Scenario 1: Send /start via Telegram API, verify consent prompt, provide consent, complete profile prompts, send health concern, verify structured Russian response received, verify database records (users, user_profiles, sessions, messages, ai_responses, audit_logs)

- [ ] **T032** [P] Create integration test `tests/integration/test_new_session.js` implementing quickstart.md Scenario 2: Send /new for existing user, verify no profile re-collection, send different health concern, verify new session and ai_response created, profile count remains 1

- [ ] **T033** [P] Create integration test `tests/integration/test_idempotency.js` implementing quickstart.md Scenario 3: Send same message twice rapidly, verify identical responses, verify single message and ai_response record in database, measure second response latency (<1s expected)

- [ ] **T034** [P] Create integration test `tests/integration/test_profile_view.js` implementing quickstart.md Scenario 4: Send /profile, verify profile displayed with PII masked (age/height/weight as ranges), verify logs contain no exact PII values

- [ ] **T035** [P] Create integration test `tests/integration/test_help_command.js` implementing quickstart.md Scenario 5: Send /help, verify Russian help text with all commands listed and disclaimer

- [ ] **T036** [P] Create integration test `tests/integration/test_error_handling.js` implementing quickstart.md Scenario 6: Force schema validation failure (mock invalid LLM response), verify retries occur, verify DLQ entry created after 3 attempts, verify user receives Russian error message

- [ ] **T037** [P] Create integration test `tests/integration/test_language_validation.js` implementing quickstart.md Scenario 7: Send English message "I have a headache", verify AI response is in Russian, verify prompt contained "Отвечай исключительно на русском языке"

## Phase 3.8: Documentation & Validation

- [ ] **T038** [P] Create data-model.md documentation file in `specs/001-n8n-second-opinion/` describing all 7 tables with fields, relationships, RLS policies, and ERD diagram

- [ ] **T039** Run all integration tests T031-T037 and verify 100% pass rate. Document any failures and fix workflows before proceeding

- [ ] **T040** Execute all 7 quickstart.md manual testing scenarios end-to-end. Document results and verify all functional requirements FR-001 through FR-031 are satisfied

- [ ] **T041** Performance validation: Execute quickstart.md performance tests (10 consultations), verify 95th percentile latency ≤20 seconds. If fails, optimize LLM prompts or workflow logic

- [ ] **T042** Constitution compliance check: Verify all 8 core principles (Backend-First, Event-Driven, Data Contracts, RLS, Deterministic Integrations, Observability, Security, Transparent Evolution) are implemented. Document evidence for each

## Dependencies

```
Setup (T001-T004) →
  Migrations (T005-T013) →
    Contract Tests (T014-T017, must fail) →
      Reusable Workflows (T018-T021) →
        Error Handler (T022) →
          User/Profile Workflows (T023-T024) →
            Response Workflow (T025) →
              Recommendation Workflow (T026) →
                Telegram Intake (T027) →
                  Config (T028-T030) →
                    Integration Tests (T031-T037) →
                      Documentation & Validation (T038-T042)
```

**Critical Path**: T005-T013 (migrations) MUST complete before T018-T027 (n8n workflows)

## Parallel Execution Examples

### Parallel Group 1: Setup & Contracts (T001-T004)
```bash
# All independent file creations
Task: "Create directory structure for n8n-workflows/, supabase/migrations/, tests/"
Task: "Create JSON Schema contract airesponse.v1.schema.json with all required fields"
Task: "Create Telegram commands contract telegram-commands.yaml documenting all commands"
Task: "Create Supabase RPC contract supabase-rpc.yaml documenting all functions"
```

### Parallel Group 2: Migrations (T005-T011)
```bash
# All independent table creations (but run T012-T013 after these complete)
Task: "Create migration 001_create_users.sql"
Task: "Create migration 002_create_user_profiles.sql"
Task: "Create migration 003_create_sessions.sql"
Task: "Create migration 004_create_messages.sql"
Task: "Create migration 005_create_ai_responses.sql"
Task: "Create migration 006_create_audit_logs.sql"
Task: "Create migration 007_create_dlq.sql"
```

### Parallel Group 3: Contract Tests (T014-T017)
```bash
# All independent test files
Task: "Create contract test test_airesponse_schema.js"
Task: "Create migration test test_migrations_up.js"
Task: "Create migration test test_migrations_down.js"
Task: "Create migration test test_rls_policies.js"
```

### Parallel Group 4: Reusable Workflows (T018-T021)
```bash
# All independent sub-workflows
Task: "Create reusable sub-workflow supabase-client.json"
Task: "Create reusable sub-workflow json-validator.json"
Task: "Create reusable sub-workflow logger.json"
Task: "Create reusable sub-workflow retry-policy.json"
```

### Parallel Group 5: Integration Tests (T031-T037)
```bash
# All independent test scenarios (run after T022-T030 complete)
Task: "Create integration test test_start_flow.js for Scenario 1"
Task: "Create integration test test_new_session.js for Scenario 2"
Task: "Create integration test test_idempotency.js for Scenario 3"
Task: "Create integration test test_profile_view.js for Scenario 4"
Task: "Create integration test test_help_command.js for Scenario 5"
Task: "Create integration test test_error_handling.js for Scenario 6"
Task: "Create integration test test_language_validation.js for Scenario 7"
```

### Parallel Group 6: Final Documentation (T038, T041-T042)
```bash
# Independent documentation tasks (after T039-T040 pass)
Task: "Create data-model.md documentation"
Task: "Execute performance validation tests"
Task: "Verify constitution compliance for all 8 principles"
```

## Notes

- **[P] tasks** = Different files, no dependencies, safe for parallel execution
- **No [P] tasks** = Sequential dependencies or same file modifications
- **TDD approach**: All tests (T014-T017) must fail initially before workflows implemented
- **Russian language**: All user-facing messages, AI prompts, and responses must be in Russian per constitution v2.0.0/v2.1.0
- **Commit strategy**: Commit after each task completion with descriptive message
- **Avoid**: Creating workflows before database migrations; implementing workflows before reusable sub-workflows exist; running integration tests before workflows deployed

---

**Total Tasks**: 42
**Estimated Parallel Groups**: 6
**Critical Path Length**: ~15 sequential tasks
**Ready for implementation**: Proceed with T001-T004 in parallel

*Generated from spec.md, plan.md, quickstart.md | Constitution v2.0.0*
