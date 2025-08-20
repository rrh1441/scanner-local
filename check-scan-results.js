const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScanResults(scanId) {
  console.log(`\n🔍 Checking results for scan: ${scanId}\n`);
  
  // Get scan details
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .single();
    
  if (scanError) {
    console.error('Error fetching scan:', scanError);
    return;
  }
  
  console.log(`Total findings reported: ${scan.total_findings_count}`);
  console.log(`Total artifacts: ${scan.total_artifacts_count}`);
  
  // Get actual findings count from database
  const { data: findings, error: findingsError } = await supabase
    .from('findings')
    .select('id, finding_type')
    .eq('scan_id', scanId);
    
  if (findingsError) {
    console.error('Error fetching findings:', findingsError);
    return;
  }
  
  console.log(`\nActual findings in database: ${findings.length}`);
  
  if (scan.total_findings_count === findings.length) {
    console.log('✅ SUCCESS: Reported findings count matches database!');
  } else {
    console.log(`❌ MISMATCH: Reported ${scan.total_findings_count} but found ${findings.length} in database`);
    console.log(`   Missing: ${scan.total_findings_count - findings.length} findings`);
  }
  
  // Check for endpointDiscovery artifacts
  const { data: endpointArtifacts } = await supabase
    .from('artifacts')
    .select('type, val_text')
    .eq('meta->scan_id', scanId)
    .in('type', ['discovered_endpoints', 'discovered_web_assets']);
    
  console.log(`\nEndpoint Discovery artifacts: ${endpointArtifacts?.length || 0}`);
  endpointArtifacts?.forEach(a => {
    console.log(`- ${a.type}: ${a.val_text.substring(0, 80)}...`);
  });
}

checkScanResults('fUHSYMa9pgD');