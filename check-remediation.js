#!/usr/bin/env node

const https = require('https');

const scanId = 'yGe9uYb6qyk';
const checkInterval = 5000; // 5 seconds

function checkScanStatus() {
  https.get(`https://dealbrief-scanner.fly.dev/scan/${scanId}/status`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const status = JSON.parse(data);
        console.log(`[${new Date().toISOString()}] Status: ${status.state} - ${status.message}`);
        
        if (status.state === 'completed') {
          console.log('✅ Scan completed! Checking findings...');
          checkFindings();
        } else if (status.state === 'failed') {
          console.error('❌ Scan failed!');
          process.exit(1);
        } else {
          setTimeout(checkScanStatus, checkInterval);
        }
      } catch (error) {
        console.error('Error parsing status:', error);
        setTimeout(checkScanStatus, checkInterval);
      }
    });
  }).on('error', error => {
    console.error('Request error:', error);
    setTimeout(checkScanStatus, checkInterval);
  });
}

function checkFindings() {
  https.get(`https://dealbrief-scanner.fly.dev/api/scans/${scanId}/findings`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const findings = JSON.parse(data);
        console.log(`\n📊 Total findings: ${findings.length}`);
        
        const withRemediation = findings.filter(f => f.remediation);
        console.log(`🔧 Findings with remediation: ${withRemediation.length}`);
        
        if (withRemediation.length > 0) {
          console.log('\n✅ Sample remediation:');
          console.log(JSON.stringify(withRemediation[0].remediation, null, 2));
        }
      } catch (error) {
        console.error('Error checking findings:', error);
      }
    });
  }).on('error', error => {
    console.error('Request error:', error);
  });
}

console.log(`🔍 Monitoring scan ${scanId} for completion and remediation...`);
checkScanStatus();