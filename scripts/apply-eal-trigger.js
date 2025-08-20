#!/usr/bin/env node

/**
 * Apply EAL trigger migration via Supabase API
 * This creates database triggers that automatically calculate EAL values when findings are inserted
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cssqcaieeixukjxqpynp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('This migration requires the service role key to create database functions.');
  console.error('\nTo run this migration:');
  console.error('1. Get the service role key from Supabase Dashboard > Settings > API');
  console.error('2. Run: SUPABASE_SERVICE_ROLE_KEY=<your-key> node scripts/apply-eal-trigger.js');
  process.exit(1);
}

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250111_eal_trigger.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Applying EAL trigger migration...');

    // Execute the migration via Supabase API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Migration failed: ${error}`);
    }

    console.log('✅ EAL trigger migration applied successfully!');
    console.log('\n📋 What was created:');
    console.log('   - calculate_finding_eal() function');
    console.log('   - Automatic triggers on findings table (insert & update)');
    console.log('   - scan_eal_summary view for easy reporting');
    console.log('   - Index on findings for faster EAL queries');
    console.log('\n🚀 New findings will now automatically have EAL values calculated!');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('\nNote: You may need to run this directly in Supabase SQL Editor:');
    console.error('1. Go to: https://supabase.com/dashboard/project/cssqcaieeixukjxqpynp/sql');
    console.error('2. Copy the contents of supabase/migrations/20250111_eal_trigger.sql');
    console.error('3. Paste and run in the SQL editor');
    process.exit(1);
  }
}

// Note: Supabase doesn't have a direct SQL execution endpoint via REST API
// So we'll provide instructions for manual application
console.log('📝 EAL Trigger Migration');
console.log('========================\n');
console.log('This migration creates automatic EAL calculation for all findings.\n');
console.log('Since direct SQL execution requires database credentials, please apply this migration manually:\n');
console.log('1. Go to Supabase SQL Editor:');
console.log('   https://supabase.com/dashboard/project/cssqcaieeixukjxqpynp/sql\n');
console.log('2. Copy the migration file contents from:');
console.log('   supabase/migrations/20250111_eal_trigger.sql\n');
console.log('3. Paste into the SQL editor and click "Run"\n');
console.log('The migration will:');
console.log('- Create a function that calculates EAL based on severity & finding type');
console.log('- Add triggers to automatically calculate EAL on insert/update');
console.log('- Backfill any existing findings without EAL values');
console.log('- Create a summary view for easy EAL reporting\n');