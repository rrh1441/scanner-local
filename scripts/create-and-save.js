import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'your-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTableAndSaveReport(scanId, companyName) {
  try {
    console.log('🏗️  Creating security_reports table...');
    
    // Create the table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS security_reports (
          id SERIAL PRIMARY KEY,
          scan_id VARCHAR(255) UNIQUE NOT NULL,
          company_name VARCHAR(255) NOT NULL,
          report_content TEXT NOT NULL,
          executive_summary TEXT,
          generated_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_security_reports_scan_id ON security_reports(scan_id);
        CREATE INDEX IF NOT EXISTS idx_security_reports_company ON security_reports(company_name);
        CREATE INDEX IF NOT EXISTS idx_security_reports_created_at ON security_reports(created_at);
      `
    });

    if (tableError) {
      console.log('Table might already exist or using direct SQL...');
    } else {
      console.log('✅ Table created successfully');
    }

    console.log(`📥 Fetching report for scan ${scanId}...`);
    
    // Fetch the report from our API
    const response = await fetch(`https://dealbrief-scanner.fly.dev/scan/${scanId}/report`);
    const data = await response.json();
    
    if (!data.report) {
      throw new Error('No report data found');
    }
    
    console.log(`📊 Report fetched successfully (${data.report.length} characters)`);
    
    // Save to Supabase using direct insert
    const { data: result, error } = await supabase
      .from('security_reports')
      .insert({
        scan_id: scanId,
        company_name: companyName,
        report_content: data.report,
        generated_at: data.generatedAt,
        created_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      console.log('Insert error:', error);
      // Try upsert instead
      const { data: upsertResult, error: upsertError } = await supabase
        .from('security_reports')
        .upsert({
          scan_id: scanId,
          company_name: companyName,
          report_content: data.report,
          generated_at: data.generatedAt,
          created_at: new Date().toISOString()
        })
        .select();
        
      if (upsertError) {
        throw upsertError;
      }
      console.log('✅ Report saved via upsert!');
    } else {
      console.log('✅ Report saved via insert!');
    }
    
    console.log(`📊 Company: ${companyName}`);
    console.log(`🔍 Scan ID: ${scanId}`);
    console.log(`📝 Report Length: ${data.report.length} characters`);
    
    // Also save summary
    console.log('📋 Fetching executive summary...');
    const summaryResponse = await fetch(`https://dealbrief-scanner.fly.dev/scan/${scanId}/summary`);
    const summaryData = await summaryResponse.json();
    
    if (summaryData.summary) {
      const { error: updateError } = await supabase
        .from('security_reports')
        .update({
          executive_summary: summaryData.summary
        })
        .eq('scan_id', scanId);
      
      if (!updateError) {
        console.log(`📋 Executive summary also saved`);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the script
const scanId = process.argv[2] || 'X1JBCITpx_H';
const companyName = process.argv[3] || 'Tesla Inc';

createTableAndSaveReport(scanId, companyName)
  .then(() => {
    console.log('\n🎉 SUCCESS! Tesla security report saved to Supabase!');
    console.log(`\n📋 Table: security_reports`);
    console.log(`🔍 Filter by: scan_id = "${scanId}"`);
    console.log(`🌐 Dashboard: ${process.env.SUPABASE_URL}/project/default/editor`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 