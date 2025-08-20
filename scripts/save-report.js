import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'your-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function saveReportToSupabase(scanId, companyName) {
  try {
    console.log(`Fetching report for scan ${scanId}...`);
    
    // Fetch the report from our API
    const response = await fetch(`https://dealbrief-scanner.fly.dev/scan/${scanId}/report`);
    const data = await response.json();
    
    if (!data.report) {
      throw new Error('No report data found');
    }
    
    console.log(`Report fetched successfully (${data.report.length} characters)`);
    
    // Save to Supabase
    const { data: result, error } = await supabase
      .from('security_reports')
      .upsert({
        scan_id: scanId,
        company_name: companyName,
        report_content: data.report,
        generated_at: data.generatedAt,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Report saved to Supabase successfully!`);
    console.log(`📊 Company: ${companyName}`);
    console.log(`🔍 Scan ID: ${scanId}`);
    console.log(`📝 Report Length: ${data.report.length} characters`);
    
    // Also save summary
    const summaryResponse = await fetch(`https://dealbrief-scanner.fly.dev/scan/${scanId}/summary`);
    const summaryData = await summaryResponse.json();
    
    if (summaryData.summary) {
      await supabase
        .from('security_reports')
        .update({
          executive_summary: summaryData.summary
        })
        .eq('scan_id', scanId);
      
      console.log(`📋 Executive summary also saved`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error saving report:', error.message);
    throw error;
  }
}

// Run the script
const scanId = process.argv[2] || 'X1JBCITpx_H';
const companyName = process.argv[3] || 'Tesla Inc';

saveReportToSupabase(scanId, companyName)
  .then(() => {
    console.log('\n🎉 Done! You can now view the report in your Supabase dashboard.');
    console.log(`\n📋 Table: security_reports`);
    console.log(`🔍 Filter by: scan_id = "${scanId}"`);
    console.log(`🌐 Dashboard: ${process.env.SUPABASE_URL}/project/default/editor`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 