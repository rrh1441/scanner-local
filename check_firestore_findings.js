const { Firestore } = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: 'precise-victory-467219-s4'
});

async function checkScan() {
  const scanId = "Ta3HE1Wa2x9";
  
  // Check if scan exists
  const scansSnap = await db.collection("scans").where("id", "==", scanId).get();
  if (!scansSnap.empty) {
    const scanDoc = scansSnap.docs[0];
    console.log("✅ Scan found:", scanDoc.data());
  } else {
    console.log("❌ No scan found with ID:", scanId);
  }
  
  // Check findings
  const findingsSnap = await db.collection("findings").where("scan_id", "==", scanId).get();
  console.log(`📊 Findings count: ${findingsSnap.size}`);
  
  if (findingsSnap.size > 0) {
    findingsSnap.forEach(doc => {
      const data = doc.data();
      console.log(`🔍 Finding: ${data.finding_type} - ${data.severity}`);
    });
  }
  
  // Check artifacts
  const artifactsSnap = await db.collection("artifacts").where("meta.scan_id", "==", scanId).get();
  console.log(`📦 Artifacts count: ${artifactsSnap.size}`);
  
  if (artifactsSnap.size > 0) {
    artifactsSnap.forEach(doc => {
      const data = doc.data();
      console.log(`📄 Artifact: ${data.type}`);
    });
  }
}

checkScan().catch(console.error);