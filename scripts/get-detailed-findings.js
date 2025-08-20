import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function getDetailedFindings(scanId) {
  try {
    console.log(`🔍 Fetching detailed findings for scan: ${scanId}`);
    
    // Get artifacts with their findings
    const query = `
      SELECT 
        a.id as artifact_id,
        a.type,
        a.val_text,
        a.severity,
        a.src_url,
        a.sha256,
        a.mime,
        a.meta,
        a.created_at,
        f.id as finding_id,
        f.finding_type,
        f.recommendation,
        f.description as finding_description
      FROM artifacts a
      LEFT JOIN findings f ON a.id = f.artifact_id
      WHERE a.meta->>'scan_id' = $1 
      ORDER BY 
        CASE a.severity 
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2  
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          WHEN 'INFO' THEN 5
          ELSE 6
        END,
        a.created_at DESC
    `;
    
    const result = await pool.query(query, [scanId]);
    
    console.log(`📊 Found ${result.rows.length} records for scan ${scanId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Group by severity
    const bySeverity = {};
    result.rows.forEach(row => {
      if (!bySeverity[row.severity]) {
        bySeverity[row.severity] = [];
      }
      bySeverity[row.severity].push(row);
    });
    
    // Print summary
    Object.keys(bySeverity).forEach(severity => {
      console.log(`${severity}: ${bySeverity[severity].length} items`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Print detailed findings
    let counter = 1;
    result.rows.forEach(row => {
      console.log(`\n${counter}. [${row.severity}] ${row.type.toUpperCase()}`);
      console.log(`   Finding: ${row.val_text}`);
      
      if (row.finding_id) {
        console.log(`   Issue: ${row.finding_description}`);
        console.log(`   Recommendation: ${row.recommendation}`);
      }
      
      if (row.src_url) {
        console.log(`   Source: ${row.src_url}`);
      }
      
      if (row.meta && row.meta.service_info) {
        const svc = row.meta.service_info;
        console.log(`   Details: ${svc.ip}:${svc.port} - ${svc.product} ${svc.version} (${svc.organization})`);
        if (svc.location !== 'Unknown') {
          console.log(`   Location: ${svc.location}`);
        }
      }
      
      counter++;
    });
    
    // Also try to get artifacts without scan_id but for the domain
    if (result.rows.length === 0) {
      console.log('\n🔍 No results with scan_id, trying domain-based search...');
      
      const domainQuery = `
        SELECT * FROM artifacts 
        WHERE val_text ILIKE '%tesla%'
        ORDER BY created_at DESC
        LIMIT 50
      `;
      
      const domainResult = await pool.query(domainQuery);
      console.log(`📊 Found ${domainResult.rows.length} Tesla-related artifacts`);
      
      domainResult.rows.forEach((row, idx) => {
        console.log(`\n${idx + 1}. [${row.severity}] ${row.type}`);
        console.log(`   ${row.val_text}`);
        if (row.src_url) console.log(`   Source: ${row.src_url}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    
    // Try to connect to see if DB is accessible
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Database connection works');
    } catch (connError) {
      console.error('❌ Database connection failed:', connError.message);
    }
  } finally {
    await pool.end();
  }
}

// Run the script
const scanId = process.argv[2] || 'X1JBCITpx_H';
getDetailedFindings(scanId); 