/**
 * Contract Test: AI Response Schema Validation
 * Task: T014
 * Description: Load airesponse.v1.schema.json and validate sample AI responses (valid and invalid cases)
 * Constitution: Data Contracts First
 */

const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

// Load JSON Schema
const schemaPath = path.join(__dirname, '../../specs/001-n8n-second-opinion/contracts/airesponse.v1.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Initialize Ajv validator
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

// Test suite
describe('AI Response Schema v1 Validation', () => {

  // ============================================================
  // VALID CASES
  // ============================================================

  test('Valid response: All required fields present', () => {
    const validResponse = {
      summary: 'Головная боль в области лба в течение 3 дней, усиливающаяся к вечеру.',
      red_flags: ['Головная боль длится более 72 часов'],
      lifestyle: {
        diet: 'Следите за регулярным приемом пищи, избегайте длительных перерывов',
        exercise: 'Умеренная активность может помочь, но избегайте перенапряжения',
        sleep: 'Обеспечьте регулярный сон 7-8 часов'
      },
      self_care: {
        recommendations: [
          'Отдыхайте в тихом затемненном помещении',
          'Прикладывайте холодный компресс на лоб',
          'Пейте достаточно воды'
        ]
      },
      talk_to_doctor: {
        topics: [
          'Характер и интенсивность головной боли',
          'Возможные триггеры (стресс, недосып, питание)',
          'Необходимость обследования (давление, зрение)'
        ]
      },
      next_steps: [
        'Запишитесь на прием к терапевту в ближайшие дни',
        'Ведите дневник головной боли (время, интенсивность, сопутствующие факторы)'
      ],
      confidence: 0.78,
      disclaimer: 'Это информационная рекомендация. Для диагностики и лечения обязательно обратитесь к квалифицированному врачу.'
    };

    const valid = validate(validResponse);
    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  test('Valid response: With optional sources field', () => {
    const validResponse = {
      summary: 'Кашель без температуры в течение недели может быть вызван различными причинами.',
      red_flags: [],
      lifestyle: {
        diet: 'Пейте теплые жидкости, избегайте холодных напитков',
        exercise: 'Легкая активность допустима, но избегайте интенсивных нагрузок',
        sleep: 'Обеспечьте достаточный отдых для восстановления'
      },
      self_care: {
        recommendations: [
          'Используйте увлажнитель воздуха',
          'Избегайте раздражающих веществ (дым, пыль)'
        ]
      },
      talk_to_doctor: {
        topics: [
          'Характер кашля (сухой/влажный)',
          'Возможная аллергия или астма'
        ]
      },
      next_steps: [
        'Наблюдайте за симптомами в течение нескольких дней'
      ],
      confidence: 0.65,
      disclaimer: 'Консультация врача необходима для точной диагностики.',
      sources: [
        'https://example.com/medical-resource',
        'https://example.com/health-guide'
      ]
    };

    const valid = validate(validResponse);
    expect(valid).toBe(true);
  });

  test('Valid response: Empty red_flags array', () => {
    const validResponse = {
      summary: 'Легкое недомогание без серьезных симптомов.',
      red_flags: [],
      lifestyle: {
        diet: 'Сбалансированное питание',
        exercise: 'Регулярная физическая активность',
        sleep: 'Достаточный сон'
      },
      self_care: {
        recommendations: ['Отдыхайте по необходимости']
      },
      talk_to_doctor: {
        topics: ['Общее самочувствие']
      },
      next_steps: ['Следите за состоянием'],
      confidence: 0.5,
      disclaimer: 'Обратитесь к врачу при ухудшении симптомов.'
    };

    const valid = validate(validResponse);
    expect(valid).toBe(true);
  });

  // ============================================================
  // INVALID CASES - Missing Required Fields
  // ============================================================

  test('Invalid: Missing summary field', () => {
    const invalidResponse = {
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'required',
        params: expect.objectContaining({ missingProperty: 'summary' })
      })
    );
  });

  test('Invalid: Missing lifestyle.diet', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
  });

  test('Invalid: Missing self_care.recommendations', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {},
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
  });

  // ============================================================
  // INVALID CASES - Type Violations
  // ============================================================

  test('Invalid: confidence not a number', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 'high', // Should be number
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'type',
        params: expect.objectContaining({ type: 'number' })
      })
    );
  });

  test('Invalid: red_flags not an array', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: 'Not an array',
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
  });

  // ============================================================
  // INVALID CASES - Constraint Violations
  // ============================================================

  test('Invalid: confidence out of range (>1)', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 1.5, // Should be 0-1
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'maximum'
      })
    );
  });

  test('Invalid: confidence out of range (<0)', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: -0.1, // Should be 0-1
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'minimum'
      })
    );
  });

  test('Invalid: summary too short (<10 chars)', () => {
    const invalidResponse = {
      summary: 'Short',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'minLength'
      })
    );
  });

  test('Invalid: disclaimer too short (<50 chars)', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 0.8,
      disclaimer: 'Too short'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
  });

  test('Invalid: next_steps empty array (minItems: 1)', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: [],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'minItems'
      })
    );
  });

  test('Invalid: next_steps too many items (>2)', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Step 1', 'Step 2', 'Step 3'],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'maxItems'
      })
    );
  });

  test('Invalid: red_flags too many items (>10)', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: Array(11).fill('Red flag item'),
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'maxItems'
      })
    );
  });

  test('Invalid: Additional properties not allowed', () => {
    const invalidResponse = {
      summary: 'Test summary',
      red_flags: [],
      lifestyle: {
        diet: 'Test',
        exercise: 'Test',
        sleep: 'Test'
      },
      self_care: {
        recommendations: ['Test']
      },
      talk_to_doctor: {
        topics: ['Test']
      },
      next_steps: ['Test'],
      confidence: 0.8,
      disclaimer: 'Test disclaimer with sufficient length for validation requirements.',
      extra_field: 'This should not be here'
    };

    const valid = validate(invalidResponse);
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'additionalProperties'
      })
    );
  });
});

// Test runner helper
if (require.main === module) {
  console.log('Running AI Response Schema Contract Tests...');
  console.log('Note: Run this file with Jest: npm test tests/contract/test_airesponse_schema.js');
}
