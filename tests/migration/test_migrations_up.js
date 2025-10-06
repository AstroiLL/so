/**
 * Migration Test: Apply Migrations (Up)
 * Task: T015
 * Description: Apply all migrations 001-009 in sequence and verify tables exist with correct columns
 * Constitution: Transparent Evolution, Supabase as Source of Truth
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase connection (set environment variables before running)
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'your-service-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Migration files in order
const migrationFiles = [
  '001_create_users.sql',
  '002_create_user_profiles.sql',
  '003_create_sessions.sql',
  '004_create_messages.sql',
  '005_create_ai_responses.sql',
  '006_create_audit_logs.sql',
  '007_create_dlq.sql',
  '008_rls_policies.sql',
  '009_create_functions.sql'
];

// Helper: Execute SQL file
async function executeSQLFile(filename) {
  const filePath = path.join(__dirname, '../../supabase/migrations', filename);
  const sql = fs.readFileSync(filePath, 'utf8');

  // Note: This is a simplified approach. In production, use Supabase CLI: supabase db push
  // For testing, we execute raw SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    throw new Error(`Migration ${filename} failed: ${error.message}`);
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

// Helper: Get table columns
async function getTableColumns(tableName) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', tableName);

  if (error) throw new Error(`Failed to get columns for ${tableName}: ${error.message}`);
  return data;
}

// Helper: Check if function exists
async function functionExists(functionName) {
  const { data, error } = await supabase
    .rpc('exec_sql', {
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

describe('Migration Tests: Apply Migrations (Up)', () => {

  test('Apply all migrations sequentially', async () => {
    // Note: This test assumes a clean database state
    // In production, use Supabase CLI for proper migration management

    for (const file of migrationFiles) {
      console.log(`Applying migration: ${file}`);
      await executeSQLFile(file);
    }

    // If no errors thrown, migrations applied successfully
    expect(true).toBe(true);
  }, 60000); // 60s timeout for all migrations

  test('Verify users table exists with correct columns', async () => {
    const exists = await tableExists('users');
    expect(exists).toBe(true);

    const columns = await getTableColumns('users');
    const columnNames = columns.map(c => c.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('telegram_user_id');
    expect(columnNames).toContain('consent_given');
    expect(columnNames).toContain('account_status');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
    expect(columnNames).toContain('deleted_at');
  });

  test('Verify user_profiles table exists with correct columns', async () => {
    const exists = await tableExists('user_profiles');
    expect(exists).toBe(true);

    const columns = await getTableColumns('user_profiles');
    const columnNames = columns.map(c => c.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('age');
    expect(columnNames).toContain('biological_sex');
    expect(columnNames).toContain('height_cm');
    expect(columnNames).toContain('weight_kg');
    expect(columnNames).toContain('medical_history');
    expect(columnNames).toContain('current_medications');
  });

  test('Verify sessions table exists with correct columns', async () => {
    const exists = await tableExists('sessions');
    expect(exists).toBe(true);

    const columns = await getTableColumns('sessions');
    const columnNames = columns.map(c => c.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('session_status');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('completed_at');
  });

  test('Verify messages table exists with correct columns', async () => {
    const exists = await tableExists('messages');
    expect(exists).toBe(true);

    const columns = await getTableColumns('messages');
    const columnNames = columns.map(c => c.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('session_id');
    expect(columnNames).toContain('telegram_message_id');
    expect(columnNames).toContain('telegram_user_id');
    expect(columnNames).toContain('direction');
    expect(columnNames).toContain('content');
  });

  test('Verify ai_responses table exists with correct columns', async () => {
    const exists = await tableExists('ai_responses');
    expect(exists).toBe(true);

    const columns = await getTableColumns('ai_responses');
    const columnNames = columns.map(c => c.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('session_id');
    expect(columnNames).toContain('message_id');
    expect(columnNames).toContain('schema_version');
    expect(columnNames).toContain('response_data');
    expect(columnNames).toContain('confidence');
  });

  test('Verify audit_logs table exists with correct columns', async () => {
    const exists = await tableExists('audit_logs');
    expect(exists).toBe(true);

    const columns = await getTableColumns('audit_logs');
    const columnNames = columns.map(c => c.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('session_id');
    expect(columnNames).toContain('message_id');
    expect(columnNames).toContain('operation_type');
    expect(columnNames).toContain('operation_status');
    expect(columnNames).toContain('details');
  });

  test('Verify dlq table exists with correct columns', async () => {
    const exists = await tableExists('dlq');
    expect(exists).toBe(true);

    const columns = await getTableColumns('dlq');
    const columnNames = columns.map(c => c.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('workflow_name');
    expect(columnNames).toContain('original_data');
    expect(columnNames).toContain('failure_reason');
    expect(columnNames).toContain('retry_attempts');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('resolved_at');
  });

  test('Verify RPC functions exist', async () => {
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
      'delete_user_data'
    ];

    for (const fn of functions) {
      const exists = await functionExists(fn);
      expect(exists).toBe(true);
    }
  });

  test('Verify RLS is enabled on all tables', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'user_profiles', 'sessions', 'messages', 'ai_responses', 'audit_logs', 'dlq');
      `
    });

    expect(error).toBeNull();
    expect(data.length).toBe(7);

    // All tables should have RLS enabled (rowsecurity = true)
    for (const row of data) {
      expect(row.rowsecurity).toBe(true);
    }
  });
});

// Test runner notes
if (require.main === module) {
  console.log('Running Migration Up Tests...');
  console.log('Prerequisites:');
  console.log('1. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
  console.log('2. Ensure database is in clean state (or use test database)');
  console.log('3. Run with Jest: npm test tests/migration/test_migrations_up.js');
  console.log('');
  console.log('Note: In production, use Supabase CLI for migrations:');
  console.log('  supabase db push');
  console.log('  supabase db reset (for clean state)');
}
