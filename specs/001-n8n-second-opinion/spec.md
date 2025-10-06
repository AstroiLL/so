# Feature Specification: Second Opinion n8n Application

**Feature Branch**: `001-n8n-second-opinion`
**Created**: 2025-10-06
**Status**: Draft
**Input**: User description: "построй план создания приложения на n8n по проекту Second Opinion"

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story

A user with a health concern wants to receive structured, evidence-based guidance about their symptoms or medical questions through a conversational Telegram interface. The system collects the user's health information, processes it to generate actionable recommendations, and presents them in a clear, organized format while ensuring the user understands when professional medical consultation is necessary.

### Acceptance Scenarios

1. **Given** a new user starts a conversation via `/start`, **When** they provide their health concern, **Then** the system collects necessary profile information, generates structured recommendations (summary, red flags, lifestyle advice, self-care suggestions, doctor consultation topics, and next steps), and presents them with clear disclaimers about seeking professional medical advice.

2. **Given** an existing user initiates a new session via `/new`, **When** they describe a different health concern, **Then** the system uses their stored profile information, processes the new concern, and delivers fresh recommendations while maintaining conversation history.

3. **Given** a user sends the same message multiple times (duplicate delivery), **When** the system receives these duplicates, **Then** it responds identically without creating duplicate records or side effects.

4. **Given** a user requests `/profile`, **When** the command is received, **Then** the system displays their stored health profile information without exposing sensitive details in logs.

5. **Given** a user asks `/help`, **When** the command is received, **Then** the system explains available commands and how to use the service effectively.

### Edge Cases

- What happens when a user provides incomplete or unclear health information?
- How does the system handle users who attempt to bypass disclaimer acknowledgment?
- What occurs if a user's message contains explicit medical emergency indicators?
- How does the system respond when the AI-generated response fails validation against the required schema?
- What happens when external services (AI provider, database) are temporarily unavailable?
- How are conversations handled when a user deletes and recreates their Telegram account with the same username?

---

## Requirements

### Functional Requirements

**User Interaction & Commands**
- **FR-001**: System MUST support `/start` command to initiate a new user session and collect initial consent for data processing
- **FR-002**: System MUST support `/new` command to begin a fresh health consultation session
- **FR-003**: System MUST support `/profile` command to display stored user health profile information
- **FR-004**: System MUST support `/help` command to provide usage instructions and available commands
- **FR-005**: Users MUST be able to send free-form text messages describing their health concerns

**Data Collection & Intake**
- **FR-006**: System MUST collect user health profile information (age, biological sex, height, weight, pre-existing conditions, current medications) before providing recommendations
- **FR-007**: System MUST normalize and validate all collected health data before persistence
- **FR-008**: System MUST obtain explicit user consent for data processing before storing any personal information
- **FR-009**: System MUST link Telegram user identifiers to internal user records while maintaining separation between identity and health data

**Recommendation Generation**
- **FR-010**: System MUST generate structured health recommendations containing: summary, red flags, lifestyle advice, self-care suggestions, topics to discuss with a doctor, and next steps
- **FR-011**: System MUST validate all AI-generated recommendations against a predefined schema before presenting to users
- **FR-012**: System MUST include a confidence score (0 to 1) with each recommendation set
- **FR-013**: System MUST include mandatory medical disclaimer with every recommendation emphasizing the need for professional consultation
- **FR-014**: System MUST highlight critical health concerns ("red flags") that require immediate medical attention

**Data Management & Security**
- **FR-015**: System MUST store all user health data in a centralized database with access controls
- **FR-016**: System MUST enforce user-scoped data access so no user can view another user's information
- **FR-017**: System MUST maintain audit logs for all critical operations (user creation, data modifications, recommendation generation)
- **FR-018**: System MUST mask personally identifiable information in all operational logs
- **FR-019**: System MUST store authentication credentials and API keys securely, never in code or logs

**Reliability & Error Handling**
- **FR-020**: System MUST handle duplicate message deliveries idempotently using message identifiers and user identifiers as composite keys
- **FR-021**: System MUST retry failed operations using exponential backoff strategy
- **FR-022**: System MUST route failed operations to a dead letter queue after retry exhaustion for manual review
- **FR-023**: System MUST respond to users within a reasonable timeframe [NEEDS CLARIFICATION: specific timeout threshold not specified - 20 seconds per constitution or different?]
- **FR-024**: System MUST provide meaningful error messages to users when operations fail, without exposing internal system details

**Observability & Monitoring**
- **FR-025**: System MUST log all user interactions with correlation identifiers (user ID, session ID, message ID) for traceability
- **FR-026**: System MUST track key operational metrics: recommendation generation success rate, retry/failure rates, response latency, dead letter queue frequency
- **FR-027**: System MUST emit alerts when critical thresholds are exceeded (increased failure rates, elevated latency, security violations)

**Compliance & Safety**
- **FR-028**: System MUST NOT generate medical diagnoses
- **FR-029**: System MUST NOT prescribe treatments or medications
- **FR-030**: System MUST ensure every user-facing recommendation explicitly states the need for professional medical consultation
- **FR-031**: System MUST retain user data according to defined policies [NEEDS CLARIFICATION: retention period and deletion policy not specified]

### Key Entities

- **User**: Represents an individual using the service; linked to Telegram identity; contains non-health profile attributes (registration date, consent status, account status)

- **User Profile**: Health-related information for a user (age, biological sex, height, weight, medical history, current medications); separated from identity data for privacy; scoped access by user ID

- **Session**: A conversation instance initiated by a user; tracks session state, creation timestamp, associated messages; links user to their consultation history

- **Message**: Individual communication from user or system; contains content, timestamp, message identifier from Telegram, session association; enables idempotency and audit trails

- **AI Response**: Structured recommendation output; contains summary, red flags array, lifestyle object, self-care object, talk-to-doctor object, next steps array (1-2 items), confidence score, disclaimer, optional sources; validated against schema before persistence

- **Audit Log**: Record of critical system operations; contains operation type, user identifier, session identifier, message identifier, timestamp, operation status; enables security review and debugging

- **Dead Letter Queue Entry**: Failed operation record requiring manual review; contains original message/data, failure reason, retry attempts, timestamps; enables reliability monitoring and recovery

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

**Outstanding Clarifications**:
- FR-023: Specific response timeout threshold (20 seconds assumed but needs confirmation)
- FR-031: Data retention period and deletion policy

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed (pending clarifications)

---
