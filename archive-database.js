#!/usr/bin/env node

/**
 * Database Archival Script
 * Archives existing scan data and starts fresh for production reset
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL
});

async function executeArchival() {
  let client;
  
  try {
    client = await pool.connect();
    
    console.log('🚀 Starting database archival process...');
    
    // Phase 1: Data Assessment
    console.log('\n=== PHASE 1: DATA ASSESSMENT ===');
    
    const tables = ['artifacts', 'findings', 'scans_master', 'worker_instances'];
    const dataCounts = {};
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        dataCounts[table] = parseInt(result.rows[0].count);
        console.log(`📊 ${table}: ${dataCounts[table]} records`);
      } catch (error) {
        console.log(`⚠️  ${table}: Table not found or error - ${error.message}`);
        dataCounts[table] = 0;
      }
    }
    
    // Check if there's any data to archive
    const totalRecords = Object.values(dataCounts).reduce((sum, count) => sum + count, 0);
    if (totalRecords === 0) {
      console.log('✅ No data found to archive. Database is already clean.');
      return;
    }
    
    // Check date ranges
    try {
      const artifactDates = await client.query('SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM artifacts LIMIT 1');
      if (artifactDates.rows[0] && artifactDates.rows[0].earliest) {
        console.log(`📅 Artifacts date range: ${artifactDates.rows[0].earliest} to ${artifactDates.rows[0].latest}`);
      }
    } catch (error) {
      console.log('📅 No artifacts date range available');
    }
    
    console.log(`\n💾 Total records to archive: ${totalRecords}`);
    
    // Phase 2: Create Archive Tables
    console.log('\n=== PHASE 2: CREATE ARCHIVE TABLES ===');
    
    await client.query('BEGIN');
    
    try {
      // Create artifacts_archive table
      await client.query(`
        CREATE TABLE IF NOT EXISTS artifacts_archive (
          id INTEGER,
          type VARCHAR(50),
          val_text TEXT,
          severity VARCHAR(20),
          src_url TEXT,
          sha256 VARCHAR(64),
          mime VARCHAR(100),
          meta JSONB,
          created_at TIMESTAMP,
          archived_at TIMESTAMP DEFAULT NOW(),
          archive_reason VARCHAR(255) DEFAULT 'production_reset',
          original_table VARCHAR(50) DEFAULT 'artifacts'
        )
      `);
      console.log('✅ Created artifacts_archive table');
      
      // Create findings_archive table
      await client.query(`
        CREATE TABLE IF NOT EXISTS findings_archive (
          id INTEGER,
          artifact_id INTEGER,
          finding_type VARCHAR(50),
          recommendation TEXT,
          description TEXT,
          created_at TIMESTAMP,
          archived_at TIMESTAMP DEFAULT NOW(),
          archive_reason VARCHAR(255) DEFAULT 'production_reset',
          original_table VARCHAR(50) DEFAULT 'findings'
        )
      `);
      console.log('✅ Created findings_archive table');
      
      // Create scans_master_archive table
      await client.query(`
        CREATE TABLE IF NOT EXISTS scans_master_archive (
          scan_id VARCHAR(255),
          company_name VARCHAR(255),
          domain VARCHAR(255),
          status VARCHAR(50),
          progress INTEGER,
          current_module VARCHAR(100),
          total_modules INTEGER,
          created_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          error_message TEXT,
          total_findings_count INTEGER,
          max_severity VARCHAR(20),
          total_artifacts_count INTEGER,
          archived_at TIMESTAMP DEFAULT NOW(),
          archive_reason VARCHAR(255) DEFAULT 'production_reset',
          original_table VARCHAR(50) DEFAULT 'scans_master'
        )
      `);
      console.log('✅ Created scans_master_archive table');
      
      await client.query('COMMIT');
      console.log('✅ Archive tables created successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to create archive tables: ${error.message}`);
    }
    
    // Phase 3: Data Migration
    console.log('\n=== PHASE 3: DATA MIGRATION ===');
    
    await client.query('BEGIN');
    
    try {
      // Archive artifacts (parent table first)
      if (dataCounts.artifacts > 0) {
        const artifactResult = await client.query(`
          INSERT INTO artifacts_archive 
          (id, type, val_text, severity, src_url, sha256, mime, meta, created_at)
          SELECT id, type, val_text, severity, src_url, sha256, mime, meta, created_at 
          FROM artifacts
        `);
        console.log(`✅ Archived ${dataCounts.artifacts} artifacts`);
      }
      
      // Archive findings (child table)
      if (dataCounts.findings > 0) {
        const findingResult = await client.query(`
          INSERT INTO findings_archive 
          (id, artifact_id, finding_type, recommendation, description, created_at)
          SELECT id, artifact_id, finding_type, recommendation, description, created_at 
          FROM findings
        `);
        console.log(`✅ Archived ${dataCounts.findings} findings`);
      }
      
      // Archive scans_master
      if (dataCounts.scans_master > 0) {
        const scanResult = await client.query(`
          INSERT INTO scans_master_archive 
          (scan_id, company_name, domain, status, progress, current_module, total_modules, 
           created_at, updated_at, completed_at, error_message, total_findings_count, 
           max_severity, total_artifacts_count)
          SELECT scan_id, company_name, domain, status, progress, current_module, total_modules,
                 created_at, updated_at, completed_at, error_message, total_findings_count,
                 max_severity, total_artifacts_count
          FROM scans_master
        `);
        console.log(`✅ Archived ${dataCounts.scans_master} scan records`);
      }
      
      await client.query('COMMIT');
      console.log('✅ Data migration completed successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to migrate data: ${error.message}`);
    }
    
    // Phase 4: Verify Archive Integrity
    console.log('\n=== PHASE 4: VERIFY ARCHIVE INTEGRITY ===');
    
    const archiveVerification = await client.query(`
      SELECT 
        'artifacts_archive' as table_name, COUNT(*) as count FROM artifacts_archive
      UNION ALL
      SELECT 'findings_archive' as table_name, COUNT(*) as count FROM findings_archive  
      UNION ALL
      SELECT 'scans_master_archive' as table_name, COUNT(*) as count FROM scans_master_archive
    `);
    
    let verificationPassed = true;
    for (const row of archiveVerification.rows) {
      const originalTable = row.table_name.replace('_archive', '');
      const expectedCount = dataCounts[originalTable] || 0;
      const actualCount = parseInt(row.count);
      
      if (expectedCount === actualCount) {
        console.log(`✅ ${row.table_name}: ${actualCount} records (verified)`);
      } else {
        console.log(`❌ ${row.table_name}: Expected ${expectedCount}, got ${actualCount}`);
        verificationPassed = false;
      }
    }
    
    if (!verificationPassed) {
      throw new Error('Archive verification failed - data counts do not match');
    }
    
    // Phase 5: Clean Production Tables
    console.log('\n=== PHASE 5: CLEAN PRODUCTION TABLES ===');
    
    await client.query('BEGIN');
    
    try {
      // Clean in dependency order (child tables first)
      if (dataCounts.findings > 0) {
        await client.query('TRUNCATE findings CASCADE');
        console.log('✅ Truncated findings table');
      }
      
      if (dataCounts.artifacts > 0) {
        await client.query('TRUNCATE artifacts CASCADE');
        console.log('✅ Truncated artifacts table');
      }
      
      if (dataCounts.scans_master > 0) {
        await client.query('TRUNCATE scans_master CASCADE');
        console.log('✅ Truncated scans_master table');
      }
      
      if (dataCounts.worker_instances > 0) {
        await client.query('DELETE FROM worker_instances');
        console.log('✅ Cleaned worker_instances table');
      }
      
      // Reset sequences
      await client.query('ALTER SEQUENCE IF EXISTS artifacts_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE IF EXISTS findings_id_seq RESTART WITH 1');
      console.log('✅ Reset ID sequences');
      
      await client.query('COMMIT');
      console.log('✅ Production tables cleaned successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to clean production tables: ${error.message}`);
    }
    
    // Phase 6: Create Archive Access Views
    console.log('\n=== PHASE 6: CREATE ARCHIVE ACCESS VIEWS ===');
    
    try {
      await client.query(`
        CREATE OR REPLACE VIEW archived_scans AS 
        SELECT 
          s.*,
          COUNT(DISTINCT a.id) as artifact_count,
          COUNT(DISTINCT f.id) as finding_count
        FROM scans_master_archive s
        LEFT JOIN artifacts_archive a ON a.meta->>'scan_id' = s.scan_id  
        LEFT JOIN findings_archive f ON f.artifact_id = a.id
        GROUP BY s.scan_id, s.company_name, s.domain, s.status, s.progress, 
                 s.current_module, s.total_modules, s.created_at, s.updated_at,
                 s.completed_at, s.error_message, s.total_findings_count,
                 s.max_severity, s.total_artifacts_count, s.archived_at,
                 s.archive_reason, s.original_table
      `);
      console.log('✅ Created archived_scans view');
      
    } catch (error) {
      console.log(`⚠️  Warning: Failed to create archive views: ${error.message}`);
    }
    
    // Final Summary
    console.log('\n=== 🎉 ARCHIVAL COMPLETE ===');
    console.log(`📊 Summary:`);
    console.log(`   • ${dataCounts.artifacts || 0} artifacts archived`);
    console.log(`   • ${dataCounts.findings || 0} findings archived`);
    console.log(`   • ${dataCounts.scans_master || 0} scans archived`);
    console.log(`   • Production tables cleaned and ready for fresh scans`);
    console.log(`   • Archive data accessible via *_archive tables`);
    console.log(`   • Use 'SELECT * FROM archived_scans' to view archived scan summary`);
    
  } catch (error) {
    console.error('\n❌ ARCHIVAL FAILED:', error.message);
    console.error('\nTo recover, check the archive tables for data integrity.');
    console.error('Archive tables: artifacts_archive, findings_archive, scans_master_archive');
    process.exit(1);
    
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received interrupt signal. Cleaning up...');
  await pool.end();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received terminate signal. Cleaning up...');
  await pool.end();
  process.exit(1);
});

// Run the archival
if (require.main === module) {
  executeArchival().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { executeArchival };