import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function findScansWithFindings() {
  try {
    console.log('🔍 Querying for recent scans...\n');
    
    // First, get the most recent 5 scans
    const scansQuery = `
      SELECT 
        id as scan_id,
        status,
        created_at,
        updated_at,
        config
      FROM scans
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    const scansResult = await pool.query(scansQuery);
    console.log(`📊 Found ${scansResult.rows.length} recent scans:\n`);
    
    // For each scan, check if it has findings
    for (const scan of scansResult.rows) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Scan ID: ${scan.scan_id}`);
      console.log(`Status: ${scan.status}`);
      console.log(`Created: ${scan.created_at}`);
      
      if (scan.config && scan.config.domain) {
        console.log(`Domain: ${scan.config.domain}`);
      }
      
      // Count findings for completed scans
      if (scan.status === 'completed') {
        const findingsQuery = `
          SELECT COUNT(*) as finding_count
          FROM findings
          WHERE scan_id = $1
        `;
        
        const findingsResult = await pool.query(findingsQuery, [scan.scan_id]);
        const findingCount = parseInt(findingsResult.rows[0].finding_count);
        
        console.log(`Findings: ${findingCount}`);
        
        // If there are findings, show more details
        if (findingCount > 0) {
          const severityQuery = `
            SELECT 
              severity,
              COUNT(*) as count
            FROM findings
            WHERE scan_id = $1
            GROUP BY severity
            ORDER BY 
              CASE severity
                WHEN 'CRITICAL' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'MEDIUM' THEN 3
                WHEN 'LOW' THEN 4
                WHEN 'INFO' THEN 5
                ELSE 6
              END
          `;
          
          const severityResult = await pool.query(severityQuery, [scan.scan_id]);
          console.log('\nFindings by severity:');
          severityResult.rows.forEach(row => {
            console.log(`  ${row.severity}: ${row.count}`);
          });
        }
      } else {
        console.log(`Findings: N/A (scan not completed)`);
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('\n✅ Query complete! Use any scan_id with findings to test the EAL calculator.');
    
  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the script
findScansWithFindings();