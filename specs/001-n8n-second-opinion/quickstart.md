# Quickstart: Second Opinion n8n Application

**Date**: 2025-10-06
**Feature**: 001-n8n-second-opinion

## Purpose

Manual testing guide for validating the Second Opinion Telegram bot end-to-end. Execute these scenarios after implementation to verify all functional requirements are met.

---

## Prerequisites

### Environment Setup
- [ ] Supabase project created with all migrations applied
- [ ] n8n instance running (cloud or self-hosted)
- [ ] Telegram bot created via @BotFather
- [ ] All credentials configured in n8n:
  - `TELEGRAM_TOKEN`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `OPENAI_API_KEY`
- [ ] All n8n workflows imported and activated
- [ ] JSON Schema file (`airesponse.v1.schema.json`) uploaded to Supabase storage

### Verification Steps
```bash
# Check Supabase migrations
psql $SUPABASE_URL -c "\dt"
# Should show: users, user_profiles, sessions, messages, ai_responses, audit_logs, dlq

# Check n8n workflows
curl $N8N_URL/api/v1/workflows
# Should list: telegram-intake, user-resolve-create, profile-enrich,
#              recommendation-generate, response-send, error-handler, reusable/*

# Check Telegram bot
curl https://api.telegram.org/bot$TELEGRAM_TOKEN/getMe
# Should return bot info
```

---

## Scenario 1: New User Registration & First Consultation

**Objective**: Verify complete onboarding flow from /start to receiving AI recommendation

### Steps

1. **Initiate Contact**
   ```
   Action: Open Telegram, search for bot, send /start
   ```

   **Expected Response** (Russian):
   ```
   Добро пожаловать в Second Opinion!

   Для начала работы мне нужно ваше согласие на обработку медицинских данных.

   Я буду:
   - Собирать информацию о вашем здоровье
   - Анализировать её с помощью ИИ
   - Предоставлять рекомендации (не заменяющие визит к врачу)

   Ваши данные защищены и не будут переданы третьим лицам.

   [Принять] [Отклонить]
   ```

2. **Provide Consent**
   ```
   Action: Click "Принять" button
   ```

   **Expected Response**:
   ```
   Спасибо! Теперь давайте заполним ваш профиль здоровья.

   Сколько вам лет?
   ```

3. **Complete Profile**
   ```
   Actions (respond to each prompt):
   - Age: 35
   - Sex: мужской
   - Height: 180 см
   - Weight: 75 кг
   - Medical history: нет хронических заболеваний
   - Current medications: нет
   ```

   **Expected Response**:
   ```
   Отлично! Профиль создан.

   Теперь вы можете описать вашу проблему со здоровьем, и я дам рекомендации.

   Команды:
   /new - начать новую консультацию
   /profile - посмотреть профиль
   /help - справка
   ```

4. **Start Consultation**
   ```
   Action: Send /new
   ```

   **Expected Response**:
   ```
   Новая консультация начата. О какой проблеме со здоровьем вы хотели бы поговорить?
   ```

5. **Describe Health Concern**
   ```
   Action: Send message
   "У меня болит голова уже 3 дня, особенно в области лба. Боль усиливается к вечеру."
   ```

   **Expected Response** (after 5-20 seconds):
   ```
   📋 Краткое резюме:
   Головная боль в области лба в течение 3 дней, усиливающаяся к вечеру.
   Требуется оценка врачом для исключения серьезных причин.

   🚩 Тревожные признаки:
   - Головная боль длится более 72 часов

   🥗 Образ жизни:
   Питание: Следите за регулярным приемом пищи, избегайте длительных перерывов
   Физическая активность: Умеренная активность может помочь, но избегайте перенапряжения
   Сон: Обеспечьте регулярный сон 7-8 часов

   🛠️ Самопомощь:
   - Отдыхайте в тихом затемненном помещении
   - Прикладывайте холодный компресс на лоб
   - Пейте достаточно воды

   👨‍⚕️ Обсудите с врачом:
   - Характер и интенсивность головной боли
   - Возможные триггеры (стресс, недосып, питание)
   - Необходимость обследования (давление, зрение)

   ⏭️ Следующие шаги:
   1. Запишитесь на прием к терапевту в ближайшие дни
   2. Ведите дневник головной боли (время, интенсивность, сопутствующие факторы)

   🔒 Уверенность: 78%

   ⚠️ Дисклеймер: Это информационная рекомендация. Для диагностики и лечения обязательно обратитесь к квалифицированному врачу.
   ```

6. **Verify Database State**
   ```sql
   -- Check user created
   SELECT id, telegram_user_id, consent_given, account_status
   FROM users
   WHERE telegram_user_id = <YOUR_TELEGRAM_ID>;

   -- Check profile created
   SELECT age, biological_sex, height_cm, weight_kg
   FROM user_profiles
   WHERE user_id = (SELECT id FROM users WHERE telegram_user_id = <YOUR_TELEGRAM_ID>);

   -- Check session created
   SELECT id, session_status, created_at
   FROM sessions
   WHERE user_id = (SELECT id FROM users WHERE telegram_user_id = <YOUR_TELEGRAM_ID>);

   -- Check message stored
   SELECT content, direction, created_at
   FROM messages
   WHERE session_id = (SELECT id FROM sessions WHERE user_id = <USER_ID> ORDER BY created_at DESC LIMIT 1);

   -- Check AI response stored
   SELECT response_data, confidence, schema_version
   FROM ai_responses
   WHERE session_id = (SELECT id FROM sessions WHERE user_id = <USER_ID> ORDER BY created_at DESC LIMIT 1);

   -- Check audit logs
   SELECT operation_type, operation_status, created_at
   FROM audit_logs
   WHERE user_id = (SELECT id FROM users WHERE telegram_user_id = <YOUR_TELEGRAM_ID>)
   ORDER BY created_at DESC;
   ```

   **Expected Database State**:
   - 1 user record (consent_given=true, account_status='active')
   - 1 user_profile record (with provided values)
   - 1 session record (session_status='active')
   - 2 message records (1 inbound, 1 outbound)
   - 1 ai_response record (schema_version='v1', confidence between 0-1)
   - Multiple audit_logs (USER_CREATED, CONSENT_GIVEN, PROFILE_CREATED, SESSION_STARTED, MESSAGE_RECEIVED, AI_RESPONSE_GENERATED)

### Success Criteria
- [ ] User receives Russian language responses at all steps
- [ ] Profile collection completes without errors
- [ ] AI recommendation matches airesponse.v1 schema structure
- [ ] Response time ≤20 seconds
- [ ] All database records created correctly
- [ ] No PII in system logs

---

## Scenario 2: Returning User - New Consultation

**Objective**: Verify returning user flow reuses profile without re-collection

### Steps

1. **Start New Session**
   ```
   Action: Send /new
   ```

   **Expected Response**:
   ```
   Новая консультация начата. О какой проблеме со здоровьем вы хотели бы поговорить?
   ```

   **Should NOT ask for profile information again**

2. **Describe Different Health Concern**
   ```
   Action: Send message
   "У меня кашель без температуры уже неделю"
   ```

   **Expected Response**:
   - New AI recommendation specific to cough
   - Different from previous consultation
   - Same format as Scenario 1

3. **Verify Database State**
   ```sql
   -- Check multiple sessions exist
   SELECT COUNT(*) FROM sessions
   WHERE user_id = (SELECT id FROM users WHERE telegram_user_id = <YOUR_TELEGRAM_ID>);
   -- Should be 2

   -- Check profile NOT duplicated
   SELECT COUNT(*) FROM user_profiles
   WHERE user_id = (SELECT id FROM users WHERE telegram_user_id = <YOUR_TELEGRAM_ID>);
   -- Should be 1
   ```

### Success Criteria
- [ ] No profile re-collection prompted
- [ ] New session created, old session remains
- [ ] New AI response generated
- [ ] Profile data reused in AI prompt

---

## Scenario 3: Idempotency Test

**Objective**: Verify duplicate message handling

### Steps

1. **Send Message Twice Rapidly**
   ```
   Action: Send same message twice within 1 second
   "Тест идемпотентности"
   ```

   **Expected Behavior**:
   - Same response returned both times
   - No duplicate processing
   - Response delivered near-instantly second time (cached)

2. **Verify Database State**
   ```sql
   -- Check only ONE message record created
   SELECT COUNT(*) FROM messages
   WHERE content = 'Тест идемпотентности'
   AND telegram_user_id = <YOUR_TELEGRAM_ID>;
   -- Should be 1

   -- Check only ONE ai_response created
   SELECT COUNT(*) FROM ai_responses
   WHERE message_id IN (
     SELECT id FROM messages
     WHERE content = 'Тест идемпотентности'
     AND telegram_user_id = <YOUR_TELEGRAM_ID>
   );
   -- Should be 1
   ```

### Success Criteria
- [ ] Duplicate message returns cached response
- [ ] No duplicate database records
- [ ] Second response latency <1 second
- [ ] No duplicate LLM API calls (check logs/billing)

---

## Scenario 4: Profile View

**Objective**: Verify profile display without PII leakage

### Steps

1. **Request Profile**
   ```
   Action: Send /profile
   ```

   **Expected Response**:
   ```
   Ваш профиль:
   - Возраст: 30-40
   - Рост: 170-180 см
   - Вес: 70-80 кг
   - Хронические заболевания: нет
   - Текущие препараты: нет

   Для обновления профиля напишите /update_profile
   ```

   **Note**: Values are ranges, not exact (PII masking)

2. **Verify Logs**
   ```bash
   # Check n8n execution logs for /profile workflow
   # Should NOT contain exact values (35, 180, 75)
   # Should contain ranges (30-40, 170-180, 70-80)
   ```

### Success Criteria
- [ ] Profile displayed in Russian
- [ ] PII masked (age/height/weight as ranges)
- [ ] Medical history count shown, not details
- [ ] No exact PII values in logs

---

## Scenario 5: Help Command

**Objective**: Verify help text display

### Steps

1. **Request Help**
   ```
   Action: Send /help
   ```

   **Expected Response**:
   ```
   Second Opinion Bot - Ваш помощник по здоровью

   Команды:
   /start - Начать работу (новые пользователи)
   /new - Начать новую консультацию
   /profile - Посмотреть профиль здоровья
   /help - Показать эту справку

   Как использовать:
   1. Начните с /new для новой консультации
   2. Опишите вашу проблему со здоровьем своими словами
   3. Получите структурированные рекомендации

   ⚠️ Дисклеймер: Этот бот предоставляет только информационные рекомендации. Всегда консультируйтесь с квалифицированным врачом для диагностики и лечения.
   ```

### Success Criteria
- [ ] Help text in Russian
- [ ] All commands listed
- [ ] Clear usage instructions
- [ ] Disclaimer present

---

## Scenario 6: Error Handling & DLQ

**Objective**: Verify error handling and DLQ routing

### Steps

1. **Trigger Schema Validation Failure** (requires mock/test mode)
   ```
   Action: Force LLM to return invalid JSON (remove required field)
   ```

   **Expected Behavior**:
   - User receives: "Обрабатываю ваш запрос, подождите..."
   - System retries 3 times with compressed prompt
   - After exhaustion → DLQ entry created
   - User receives: "Извините, возникла проблема. Наша команда уведомлена. Попробуйте снова через несколько минут."

2. **Verify DLQ**
   ```sql
   SELECT workflow_name, failure_reason, retry_attempts, created_at
   FROM dlq
   WHERE resolved_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;
   ```

   **Expected**: Entry with workflow_name='recommendation-generate', retry_attempts=3

3. **Verify Audit Log**
   ```sql
   SELECT operation_type, operation_status, details
   FROM audit_logs
   WHERE operation_type = 'SCHEMA_VALIDATION_FAILED'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

### Success Criteria
- [ ] User receives error message in Russian
- [ ] DLQ entry created after 3 retries
- [ ] Audit log records failure
- [ ] User experience gracefully degraded

---

## Scenario 7: Language Validation

**Objective**: Verify all AI responses are in Russian (Constitution IX)

### Steps

1. **Send English Message**
   ```
   Action: Send "I have a headache"
   ```

   **Expected Response**:
   - AI response should still be in Russian
   - System detects language but responds in Russian per constitution

2. **Verify Response Language**
   - All fields (summary, red_flags, lifestyle, etc.) in Russian
   - No English text in response
   - Disclaimer in Russian

3. **Check Prompt**
   ```
   Action: Review n8n execution log for LLM call
   ```

   **Expected**: Prompt contains "Отвечай исключительно на русском языке"

### Success Criteria
- [ ] All bot messages in Russian
- [ ] AI responses in Russian regardless of input language
- [ ] System prompts include language instruction
- [ ] Medical disclaimers use Russian medical context

---

## Performance Validation

### Latency Tests

```bash
# Measure end-to-end latency for 10 consultations
for i in {1..10}; do
  START=$(date +%s.%N)
  # Send message via Telegram API
  curl -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
    -d "chat_id=$CHAT_ID" \
    -d "text=Test message $i"
  # Wait for response (manual: record timestamp when response arrives)
  END=$(date +%s.%N)
  LATENCY=$(echo "$END - $START" | bc)
  echo "Message $i latency: $LATENCY seconds"
done
```

**Target**: 95th percentile ≤20 seconds

### Load Test (Optional)

```bash
# Send 50 requests concurrently
seq 1 50 | xargs -n1 -P10 bash -c '
  curl -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
    -d "chat_id=$CHAT_ID" \
    -d "text=Load test message"
'

# Monitor n8n and Supabase for:
# - No failed workflows
# - No timeouts
# - RLS policies enforced
```

---

## Validation Checklist

### Functional Requirements (from spec.md)
- [ ] FR-001: /start command initiates session
- [ ] FR-002: /new command starts consultation
- [ ] FR-003: /profile displays user profile
- [ ] FR-004: /help provides instructions
- [ ] FR-005: Free-text messages trigger AI recommendations
- [ ] FR-006: Profile collection before recommendations
- [ ] FR-007: Data normalization and validation
- [ ] FR-008: Consent collection before data storage
- [ ] FR-009: Telegram ID linked to internal user ID
- [ ] FR-010-014: AI recommendations with all required fields
- [ ] FR-015-019: Data management and security (RLS, audit, PII masking)
- [ ] FR-020-024: Reliability (idempotency, retry, DLQ, error messages)
- [ ] FR-025-027: Observability (logging, metrics, alerts)
- [ ] FR-028-030: Compliance (no diagnosis, no prescriptions, disclaimer)

### Constitution Alignment
- [ ] Backend-First: All logic in n8n/Supabase, Telegram is transport
- [ ] Event-Driven: All flows as n8n workflows with DLQ
- [ ] Data Contracts: AI responses validated against JSON Schema
- [ ] RLS: User data access scoped by userId
- [ ] Observability: Audit logs with correlation IDs
- [ ] Security: Secrets in n8n credentials, PII masked
- [ ] Language: All user-facing content in Russian

---

## Troubleshooting

### Common Issues

**Issue**: Bot doesn't respond
```bash
# Check Telegram webhook
curl https://api.telegram.org/bot$TELEGRAM_TOKEN/getWebhookInfo
# Should show n8n webhook URL

# Check n8n workflow active
# n8n UI → Workflows → telegram-intake → Status: Active
```

**Issue**: AI response validation fails
```bash
# Check JSON Schema file exists in Supabase
# Storage → schemas → airesponse.v1.schema.json

# Check n8n Function node has Ajv installed
# n8n → Settings → Dependencies → ajv@8.x
```

**Issue**: RLS policy blocks query
```sql
-- Check RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Verify service role key used in n8n
-- n8n → Credentials → Supabase → Key should be service_role key
```

---

*Manual testing guide | Phase 1 output | Ready for implementation*
