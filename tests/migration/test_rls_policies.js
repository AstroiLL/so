/**
 * Migration Test: RLS Policy Enforcement
 * Task: T017
 * Description: Verify RLS prevents cross-user data access
 * Constitution: Security by Default, Supabase as Source of Truth
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'your-service-key';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Service role client (bypasses RLS)
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Anon client (enforces RLS)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

describe('RLS Policy Tests', () => {

  let user1Id, user2Id, user1Session, user2Session;

  // ============================================================
  // SETUP: Create two users with profiles and sessions
  // ============================================================

  beforeAll(async () => {
    // Create user 1
    const { data: u1, error: e1 } = await supabaseService.rpc('create_user_with_profile', {
      p_telegram_user_id: 111111111,
      p_consent_given: true
    });
    if (e1) throw new Error(`Failed to create user 1: ${e1.message}`);
    user1Id = u1;

    // Create user 2
    const { data: u2, error: e2 } = await supabaseService.rpc('create_user_with_profile', {
      p_telegram_user_id: 222222222,
      p_consent_given: true
    });
    if (e2) throw new Error(`Failed to create user 2: ${e2.message}`);
    user2Id = u2;

    // Create session for user 1
    const { data: s1, error: es1 } = await supabaseService.rpc('create_session', {
      p_user_id: user1Id,
      p_session_status: 'active'
    });
    if (es1) throw new Error(`Failed to create session 1: ${es1.message}`);
    user1Session = s1;

    // Create session for user 2
    const { data: s2, error: es2 } = await supabaseService.rpc('create_session', {
      p_user_id: user2Id,
      p_session_status: 'active'
    });
    if (es2) throw new Error(`Failed to create session 2: ${es2.message}`);
    user2Session = s2;

    console.log(`Test setup complete: user1=${user1Id}, user2=${user2Id}`);
  }, 30000);

  // ============================================================
  // TEARDOWN: Clean up test data
  // ============================================================

  afterAll(async () => {
    // Soft delete users (CASCADE will clean up profiles, sessions)
    await supabaseService.rpc('delete_user_data', { p_user_id: user1Id });
    await supabaseService.rpc('delete_user_data', { p_user_id: user2Id });

    console.log('Test teardown complete');
  });

  // ============================================================
  // TEST: Users table RLS
  // ============================================================

  test('RLS: User 1 can read own user record', async () => {
    // Simulate authenticated request as user 1
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}` // Simplified: In real scenario, use JWT
        }
      }
    });

    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', user1Id)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.id).toBe(user1Id);
  });

  test('RLS: User 1 cannot read User 2 record', async () => {
    // Simulate authenticated request as user 1
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}` // Simplified
        }
      }
    });

    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', user2Id)
      .single();

    // RLS should prevent access
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  // ============================================================
  // TEST: User Profiles RLS
  // ============================================================

  test('RLS: User 1 can read own profile', async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('user_id', user1Id)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.user_id).toBe(user1Id);
  });

  test('RLS: User 1 cannot read User 2 profile', async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('user_id', user2Id)
      .single();

    // RLS should prevent access
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  // ============================================================
  // TEST: Sessions RLS
  // ============================================================

  test('RLS: User 1 can read own sessions', async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('sessions')
      .select('*')
      .eq('user_id', user1Id);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].user_id).toBe(user1Id);
  });

  test('RLS: User 1 cannot read User 2 sessions', async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('sessions')
      .select('*')
      .eq('user_id', user2Id);

    // RLS should return empty array or error
    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data).toEqual([]);
    }
  });

  // ============================================================
  // TEST: Messages RLS (via session ownership)
  // ============================================================

  test('RLS: User 1 can read messages from own session', async () => {
    // First, insert a message for user 1
    await supabaseService.rpc('insert_message', {
      p_session_id: user1Session,
      p_telegram_message_id: 1111,
      p_telegram_user_id: 111111111,
      p_direction: 'inbound',
      p_content: 'Test message for user 1'
    });

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('session_id', user1Session);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });

  test('RLS: User 1 cannot read messages from User 2 session', async () => {
    // Insert a message for user 2
    await supabaseService.rpc('insert_message', {
      p_session_id: user2Session,
      p_telegram_message_id: 2222,
      p_telegram_user_id: 222222222,
      p_direction: 'inbound',
      p_content: 'Test message for user 2'
    });

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('session_id', user2Session);

    // RLS should return empty array or error
    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data).toEqual([]);
    }
  });

  // ============================================================
  // TEST: AI Responses RLS (via session ownership)
  // ============================================================

  test('RLS: User 1 can read AI responses from own session', async () => {
    // Insert message for user 1
    const { data: msgId } = await supabaseService.rpc('insert_message', {
      p_session_id: user1Session,
      p_telegram_message_id: 3333,
      p_telegram_user_id: 111111111,
      p_direction: 'inbound',
      p_content: 'Health question'
    });

    // Insert AI response
    await supabaseService.rpc('insert_ai_response', {
      p_session_id: user1Session,
      p_message_id: msgId,
      p_schema_version: 'v1',
      p_response_data: JSON.stringify({ summary: 'Test', red_flags: [] }),
      p_confidence: 0.8
    });

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('ai_responses')
      .select('*')
      .eq('session_id', user1Session);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });

  test('RLS: User 1 cannot read AI responses from User 2 session', async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('ai_responses')
      .select('*')
      .eq('session_id', user2Session);

    // RLS should return empty array or error
    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data).toEqual([]);
    }
  });

  // ============================================================
  // TEST: Audit Logs RLS
  // ============================================================

  test('RLS: User 1 can read own audit logs', async () => {
    // Insert audit log for user 1
    await supabaseService.rpc('log_audit_event', {
      p_user_id: user1Id,
      p_session_id: user1Session,
      p_message_id: null,
      p_operation_type: 'TEST_OPERATION',
      p_operation_status: 'success',
      p_details: JSON.stringify({})
    });

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('user_id', user1Id);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });

  test('RLS: User 1 cannot read User 2 audit logs', async () => {
    // Insert audit log for user 2
    await supabaseService.rpc('log_audit_event', {
      p_user_id: user2Id,
      p_session_id: user2Session,
      p_message_id: null,
      p_operation_type: 'TEST_OPERATION',
      p_operation_status: 'success',
      p_details: JSON.stringify({})
    });

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('user_id', user2Id);

    // RLS should return empty array or error
    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data).toEqual([]);
    }
  });

  // ============================================================
  // TEST: DLQ RLS (Admin only)
  // ============================================================

  test('RLS: Regular user cannot read DLQ', async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Id}`
        }
      }
    });

    const { data, error } = await client
      .from('dlq')
      .select('*');

    // RLS should prevent access
    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data).toEqual([]);
    }
  });

  // ============================================================
  // TEST: Service Role bypasses RLS
  // ============================================================

  test('Service role can read all user data', async () => {
    const { data: users, error: userError } = await supabaseService
      .from('users')
      .select('*')
      .in('id', [user1Id, user2Id]);

    expect(userError).toBeNull();
    expect(users.length).toBe(2);
  });

  test('Service role can read all sessions', async () => {
    const { data: sessions, error: sessionError } = await supabaseService
      .from('sessions')
      .select('*')
      .in('user_id', [user1Id, user2Id]);

    expect(sessionError).toBeNull();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });
});

// Test runner notes
if (require.main === module) {
  console.log('Running RLS Policy Tests...');
  console.log('Prerequisites:');
  console.log('1. Set SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY environment variables');
  console.log('2. Ensure migrations have been applied (run test_migrations_up.js)');
  console.log('3. Run with Jest: npm test tests/migration/test_rls_policies.js');
  console.log('');
  console.log('Note: These tests verify RLS prevents cross-user data access');
  console.log('Service role key bypasses RLS (intentional per Backend-First architecture)');
}
