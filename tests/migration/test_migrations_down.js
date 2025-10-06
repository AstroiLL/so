/**
 * Migration Test: Rollback Migrations (Down)
 * Task: T016
 * Description: Roll back migrations in reverse order and verify clean state
 * Constitution: Transparent Evolution, Supabase as Source of Truth
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase connection (set environment variables before running)
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'your-service-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Rollback SQL statements in reverse order
const rollbackStatements = [
  // 009: Drop RPC functions
  `
    DROP FUNCTION IF EXISTS delete_user_data CASCADE;
    DROP FUNCTION IF EXISTS insert_dlq_entry CASCADE;
    DROP FUNCTION IF EXISTS log_audit_event CASCADE;
    DROP FUNCTION IF EXISTS insert_ai_response CASCADE;
    DROP FUNCTION IF EXISTS get_cached_response CASCADE;
    DROP FUNCTION IF EXISTS insert_message CASCADE;
    DROP FUNCTION IF EXISTS get_active_session CASCADE;
    DROP FUNCTION IF EXISTS create_session CASCADE;
    DROP FUNCTION IF EXISTS get_user_profile CASCADE;
    DROP FUNCTION IF EXISTS get_user_by_telegram_id CASCADE;
    DROP FUNCTION IF EXISTS create_user_with_profile CASCADE;
    DROP FUNCTION IF EXISTS is_admin CASCADE;
  `,
  // 008: Disable RLS (policies dropped automatically with table drops)
  `
    ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS user_profiles DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS sessions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS ai_responses DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS dlq DISABLE ROW LEVEL SECURITY;
  `,
  // 007: Drop dlq table
  `DROP TABLE IF EXISTS dlq CASCADE;`,
  // 006: Drop audit_logs table
  `DROP TABLE IF EXISTS audit_logs CASCADE;`,
  // 005: Drop ai_responses table
  `DROP TABLE IF EXISTS ai_responses CASCADE;`,
  // 004: Drop messages table
  `DROP TABLE IF EXISTS messages CASCADE;`,
  // 003: Drop sessions table
  `DROP TABLE IF EXISTS sessions CASCADE;`,
  // 002: Drop user_profiles table
  `DROP TABLE IF EXISTS user_profiles CASCADE;`,
  // 001: Drop users table and trigger function
  `
    DROP TABLE IF EXISTS users CASCADE;
    DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
  `
];

// Helper: Execute SQL
async function executeSQL(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    throw new Error(`SQL execution failed: ${error.message}`);
  }

  return data;
}

// Helper: Check if table exists
async function tableExists(tableName) {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .single();

  return !error && data !== null;
}

// Helper: Check if function exists
async function functionExists(functionName) {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT COUNT(*) as count
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = '${functionName}';
    `
  });

  return !error && data && data[0]?.count > 0;
}

describe('Migration Tests: Rollback Migrations (Down)', () => {

  test('Rollback all migrations in reverse order', async () => {
    for (const sql of rollbackStatements) {
      console.log('Executing rollback statement...');
      await executeSQL(sql);
    }

    // If no errors thrown, rollback successful
    expect(true).toBe(true);
  }, 60000); // 60s timeout

  test('Verify users table does not exist', async () => {
    const exists = await tableExists('users');
    expect(exists).toBe(false);
  });

  test('Verify user_profiles table does not exist', async () => {
    const exists = await tableExists('user_profiles');
    expect(exists).toBe(false);
  });

  test('Verify sessions table does not exist', async () => {
    const exists = await tableExists('sessions');
    expect(exists).toBe(false);
  });

  test('Verify messages table does not exist', async () => {
    const exists = await tableExists('messages');
    expect(exists).toBe(false);
  });

  test('Verify ai_responses table does not exist', async () => {
    const exists = await tableExists('ai_responses');
    expect(exists).toBe(false);
  });

  test('Verify audit_logs table does not exist', async () => {
    const exists = await tableExists('audit_logs');
    expect(exists).toBe(false);
  });

  test('Verify dlq table does not exist', async () => {
    const exists = await tableExists('dlq');
    expect(exists).toBe(false);
  });

  test('Verify RPC functions do not exist', async () => {
    const functions = [
      'create_user_with_profile',
      'get_user_by_telegram_id',
      'get_user_profile',
      'create_session',
      'get_active_session',
      'insert_message',
      'get_cached_response',
      'insert_ai_response',
      'log_audit_event',
      'insert_dlq_entry',
      'delete_user_data',
      'is_admin'
    ];

    for (const fn of functions) {
      const exists = await functionExists(fn);
      expect(exists).toBe(false);
    }
  });

  test('Verify trigger function does not exist', async () => {
    const exists = await functionExists('update_updated_at_column');
    expect(exists).toBe(false);
  });

  test('Verify clean database state', async () => {
    // Check that public schema has no user-created tables
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as count
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'user_profiles', 'sessions', 'messages', 'ai_responses', 'audit_logs', 'dlq');
      `
    });

    expect(error).toBeNull();
    expect(data[0].count).toBe(0);
  });
});

// Test runner notes
if (require.main === module) {
  console.log('Running Migration Down Tests...');
  console.log('Prerequisites:');
  console.log('1. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
  console.log('2. Ensure migrations have been applied first (run test_migrations_up.js)');
  console.log('3. Run with Jest: npm test tests/migration/test_migrations_down.js');
  console.log('');
  console.log('WARNING: This test will DROP all tables and functions!');
  console.log('Use a test database, not production!');
  console.log('');
  console.log('Note: In production, use Supabase CLI for rollbacks:');
  console.log('  supabase db reset (rolls back to clean state)');
}
