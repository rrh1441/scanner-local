const {Firestore} = require('@google-cloud/firestore');
const db = new Firestore({projectId: 'precise-victory-467219-s4'});

const scanId = 'tier1-test-1755294792';

(async () => {
  // Get scan document
  const scanDoc = await db.collection('scans').doc(scanId).get();
  if (!scanDoc.exists) {
    console.log('Scan not found in Firestore');
    return;
  }
  
  const scanData = scanDoc.data();
  console.log('Scan Status:', scanData.status);
  console.log('Created:', new Date(scanData.created_at).toISOString());
  if (scanData.updated_at) {
    console.log('Updated:', new Date(scanData.updated_at).toISOString());
  }
  
  // Get findings
  const findings = await db.collection('findings')
    .where('scan_id', '==', scanId)
    .get();
    
  console.log('\nTotal findings:', findings.size);
  
  const findingsByType = {};
  findings.forEach(doc => {
    const d = doc.data();
    if (!findingsByType[d.type]) {
      findingsByType[d.type] = 0;
    }
    findingsByType[d.type]++;
  });
  
  console.log('\nFindings by type:');
  Object.entries(findingsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
})();
