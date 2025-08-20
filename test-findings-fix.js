const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testScan() {
  console.log('🔍 Running test scan to verify findings fix...\n');
  
  try {
    // Trigger a scan using the existing script
    console.log('Triggering scan...');
    const { stdout, stderr } = await execAsync('node scripts/trigger-test-scan.js');
    
    if (stderr) {
      console.error('Error output:', stderr);
    }
    
    console.log('Scan output:', stdout);
    
    // Parse the scan ID from output
    const scanIdMatch = stdout.match(/Scan ID: (\w+)/);
    if (!scanIdMatch) {
      console.error('Could not find scan ID in output');
      return;
    }
    
    const scanId = scanIdMatch[1];
    console.log(`\n✅ Scan completed with ID: ${scanId}`);
    console.log('\nNow check the logs and Supabase to verify:');
    console.log('1. The total findings count in logs should match Supabase');
    console.log('2. endpointDiscovery should not contribute to findings count');
    console.log('3. Asset correlation should complete without stream.on errors');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testScan();