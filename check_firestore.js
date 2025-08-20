const {Firestore} = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: 'precise-victory-467219-s4'
});

async function checkScans() {
  try {
    // Get recent scans
    const scansSnapshot = await db.collection('scans')
      .orderBy('created_at', 'desc')
      .limit(5)
      .get();
    
    console.log(`Found ${scansSnapshot.size} recent scans:\n`);
    
    scansSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Scan ID: ${doc.id}`);
      console.log(`Domain: ${data.domain}`);
      console.log(`Status: ${data.status}`);
      console.log(`Created: ${data.created_at}`);
      console.log(`Updated: ${data.updated_at}`);
      console.log('---');
    });

    // Check for findings
    const findingsSnapshot = await db.collection('findings')
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();
    
    console.log(`\nFound ${findingsSnapshot.size} recent findings`);
    
  } catch (error) {
    console.error('Error checking Firestore:', error);
  }
}

checkScans();
