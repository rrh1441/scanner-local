#!/usr/bin/env node

// Trigger a test scan to verify Shodan and Censys are working
import axios from 'axios';

async function triggerScan() {
  try {
    console.log('🚀 Triggering test scan...');
    
    const response = await axios.post('https://dealbrief-scanner.fly.dev/scan', {
      domain: 'example.com',
      companyName: 'Example Test Company'
    });
    
    console.log('✅ Scan triggered successfully');
    console.log('Scan ID:', response.data.scanId);
    console.log('\nMonitor the scan progress at:');
    console.log(`https://dealbrief-scanner.fly.dev/scan/${response.data.scanId}/status`);
    
    return response.data.scanId;
  } catch (error) {
    console.error('❌ Failed to trigger scan:', error.response?.data || error.message);
  }
}

async function checkScanStatus(scanId) {
  try {
    const response = await axios.get(`https://dealbrief-scanner.fly.dev/scan/${scanId}/status`);
    console.log('\n📊 Scan Status:', response.data);
  } catch (error) {
    console.error('❌ Failed to check status:', error.response?.data || error.message);
  }
}

async function main() {
  const scanId = await triggerScan();
  
  if (scanId) {
    console.log('\nWaiting 30 seconds before checking status...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    await checkScanStatus(scanId);
  }
}

main().catch(console.error);