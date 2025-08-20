#!/usr/bin/env node

/**
 * Test script to verify Firestore findings are being written correctly
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node test-firestore-findings.js
 */

const { Firestore } = require('@google-cloud/firestore');

const PROJECT_ID = 'precise-victory-467219-s4';
const db = new Firestore({ projectId: PROJECT_ID });

async function testFirestoreConnection() {
  console.log('🔍 Testing Firestore Connection...\n');
  
  try {
    // 1. Check recent scans
    console.log('📊 Recent Scans:');
    console.log('─'.repeat(80));
    
    const scansSnapshot = await db.collection('scans')
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();
    
    if (scansSnapshot.empty) {
      console.log('❌ No scans found in database');
      return;
    }
    
    const scanStats = {
      total: 0,
      completed: 0,
      failed: 0,
      withFindings: 0
    };
    
    const scanIds = [];
    
    scansSnapshot.forEach(doc => {
      const data = doc.data();
      scanStats.total++;
      
      if (data.status === 'completed') scanStats.completed++;
      if (data.status === 'failed') scanStats.failed++;
      if (data.findings_count > 0) scanStats.withFindings++;
      
      scanIds.push(doc.id);
      
      console.log(`Scan ID: ${doc.id}`);
      console.log(`  Domain: ${data.domain || 'N/A'}`);
      console.log(`  Status: ${data.status || 'unknown'}`);
      console.log(`  Findings: ${data.findings_count || 0}`);
      console.log(`  Created: ${data.created_at ? new Date(data.created_at._seconds * 1000).toISOString() : 'N/A'}`);
      console.log(`  Duration: ${data.duration_ms ? (data.duration_ms / 1000).toFixed(1) + 's' : 'N/A'}`);
      console.log('');
    });
    
    // 2. Check findings for recent scans
    console.log('\n📋 Findings Summary:');
    console.log('─'.repeat(80));
    
    for (const scanId of scanIds.slice(0, 3)) {
      const findingsSnapshot = await db.collection('findings')
        .where('scan_id', '==', scanId)
        .limit(5)
        .get();
      
      console.log(`\nScan ${scanId}:`);
      
      if (findingsSnapshot.empty) {
        console.log('  No findings');
        continue;
      }
      
      const severityCounts = {};
      
      findingsSnapshot.forEach(doc => {
        const finding = doc.data();
        const severity = finding.severity || 'UNKNOWN';
        severityCounts[severity] = (severityCounts[severity] || 0) + 1;
        
        console.log(`  - [${severity}] ${finding.title || 'Untitled'}`);
        if (finding.description) {
          console.log(`    ${finding.description.substring(0, 100)}...`);
        }
      });
      
      console.log(`  Total: ${Object.entries(severityCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    
    // 3. Check artifacts
    console.log('\n📦 Artifacts Summary:');
    console.log('─'.repeat(80));
    
    const artifactsSnapshot = await db.collection('artifacts')
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();
    
    if (artifactsSnapshot.empty) {
      console.log('❌ No artifacts found');
    } else {
      const artifactTypes = {};
      
      artifactsSnapshot.forEach(doc => {
        const artifact = doc.data();
        const type = artifact.type || 'unknown';
        artifactTypes[type] = (artifactTypes[type] || 0) + 1;
      });
      
      console.log('Artifact types:', Object.entries(artifactTypes)
        .map(([type, count]) => `${type} (${count})`)
        .join(', '));
    }
    
    // 4. Summary statistics
    console.log('\n📈 Overall Statistics:');
    console.log('─'.repeat(80));
    console.log(`Total scans: ${scanStats.total}`);
    console.log(`Completed: ${scanStats.completed}`);
    console.log(`Failed: ${scanStats.failed}`);
    console.log(`Scans with findings: ${scanStats.withFindings}`);
    
    // 5. Check if writes are happening
    console.log('\n✅ Firestore connection test complete!');
    
    if (scanStats.withFindings === 0) {
      console.log('\n⚠️  WARNING: No scans have findings. Possible issues:');
      console.log('  - Modules not writing findings correctly');
      console.log('  - insertFinding() function not being called');
      console.log('  - Firestore permissions issue');
    }
    
  } catch (error) {
    console.error('❌ Error testing Firestore:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testFirestoreConnection().catch(console.error);