#!/usr/bin/env node

const { Firestore } = require('@google-cloud/firestore');

// Get credentials from environment
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!projectId) {
  console.error('Missing Google Cloud credentials!');
  console.error('Please set GOOGLE_CLOUD_PROJECT_ID environment variable');
  process.exit(1);
}

const firestore = new Firestore({
  projectId,
  keyFilename
});
const scanId = process.argv[2] || 'I50E5WPlwFQ';

async function queryFindings() {
  try {
    console.log(`\nQuerying findings for scan_id: ${scanId}\n`);

    // Query 1: Breakdown by finding_type with EAL values
    console.log('1. BREAKDOWN BY FINDING_TYPE:\n');
    const findingsRef = firestore.collection('findings');
    const typeQuery = findingsRef.where('scan_id', '==', scanId);
    const typeSnapshot = await typeQuery.get();
    
    if (typeSnapshot.empty) {
      console.error('No findings found for scan_id:', scanId);
      return;
    }
    
    const typeBreakdown = [];
    typeSnapshot.forEach(doc => {
      const data = doc.data();
      typeBreakdown.push({
        finding_type: data.finding_type,
        severity: data.severity,
        eal_low: data.eal_low,
        eal_ml: data.eal_ml,
        eal_high: data.eal_high,
        eal_daily: data.eal_daily
      });
    });
    
    // Sort by finding_type
    typeBreakdown.sort((a, b) => a.finding_type.localeCompare(b.finding_type));


    // Group by finding_type
    const grouped = {};
    typeBreakdown.forEach(finding => {
      if (!grouped[finding.finding_type]) {
        grouped[finding.finding_type] = [];
      }
      grouped[finding.finding_type].push(finding);
    });

    // Display grouped results
    for (const [type, findings] of Object.entries(grouped)) {
      console.log(`Finding Type: ${type}`);
      console.log(`Count: ${findings.length}`);
      
      // Calculate averages for this type
      const totals = findings.reduce((acc, f) => {
        acc.eal_low += f.eal_low || 0;
        acc.eal_ml += f.eal_ml || 0;
        acc.eal_high += f.eal_high || 0;
        acc.eal_daily += f.eal_daily || 0;
        return acc;
      }, { eal_low: 0, eal_ml: 0, eal_high: 0, eal_daily: 0 });

      console.log(`Average EAL Low: $${(totals.eal_low / findings.length).toFixed(2)}`);
      console.log(`Average EAL ML: $${(totals.eal_ml / findings.length).toFixed(2)}`);
      console.log(`Average EAL High: $${(totals.eal_high / findings.length).toFixed(2)}`);
      console.log(`Average EAL Daily: $${(totals.eal_daily / findings.length).toFixed(2)}`);
      console.log('---');
    }

    // Query 2: Get 5-10 examples with full details
    console.log('\n2. SAMPLE FINDINGS (5-10 examples):\n');
    const exampleQuery = findingsRef.where('scan_id', '==', scanId).limit(10);
    const exampleSnapshot = await exampleQuery.get();
    
    const examples = [];
    exampleSnapshot.forEach(doc => {
      examples.push({ id: doc.id, ...doc.data() });
    });


    examples.forEach((finding, index) => {
      console.log(`\nExample ${index + 1}:`);
      console.log(`Finding Type: ${finding.finding_type}`);
      console.log(`Severity: ${finding.severity}`);
      console.log(`Asset: ${finding.asset}`);
      console.log(`Title: ${finding.title}`);
      console.log(`EAL Low: $${finding.eal_low || 0}`);
      console.log(`EAL ML: $${finding.eal_ml || 0}`);
      console.log(`EAL High: $${finding.eal_high || 0}`);
      console.log(`EAL Daily: $${finding.eal_daily || 0}`);
      console.log(`Description: ${finding.description?.substring(0, 100)}...`);
    });

    // Query 3: Summary statistics
    console.log('\n3. SUMMARY STATISTICS:\n');
    const summaryQuery = findingsRef.where('scan_id', '==', scanId);
    const summarySnapshot = await summaryQuery.get();
    
    const allFindings = [];
    summarySnapshot.forEach(doc => {
      const data = doc.data();
      allFindings.push({
        eal_low: data.eal_low,
        eal_ml: data.eal_ml,
        eal_high: data.eal_high,
        eal_daily: data.eal_daily
      });
    });


    const totalEAL = allFindings.reduce((acc, f) => {
      acc.low += f.eal_low || 0;
      acc.ml += f.eal_ml || 0;
      acc.high += f.eal_high || 0;
      acc.daily += f.eal_daily || 0;
      return acc;
    }, { low: 0, ml: 0, high: 0, daily: 0 });

    console.log(`Total Findings: ${allFindings.length}`);
    console.log(`Total EAL Low: $${totalEAL.low.toFixed(2)}`);
    console.log(`Total EAL ML: $${totalEAL.ml.toFixed(2)}`);
    console.log(`Total EAL High: $${totalEAL.high.toFixed(2)}`);
    console.log(`Total EAL Daily: $${totalEAL.daily.toFixed(2)}`);

  } catch (error) {
    console.error('Query failed:', error.message);
  }
}

queryFindings();