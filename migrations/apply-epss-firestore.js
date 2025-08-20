#!/usr/bin/env node

/**
 * Apply EPSS integration to Firestore findings
 * 
 * This script:
 * 1. Updates the findings structure to include epss_score
 * 2. Implements EAL calculation with EPSS-based prevalence
 * 3. Backfills existing findings with recalculated EAL values
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'apps', 'workers', 'scanner-sa-key.json');

console.log('🔄 Initializing Firestore with correct project...');

let app;
try {
  const serviceAccount = require(serviceAccountPath);
  // Force the correct project ID
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'precise-victory-467219-s4'  // Force correct project
  });
  console.log('✅ Using project:', 'precise-victory-467219-s4');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  console.error('Make sure GOOGLE_APPLICATION_CREDENTIALS is set or scanner-sa-key.json exists');
  process.exit(1);
}

const db = getFirestore(app);

/**
 * Calculate EAL with EPSS-based dynamic prevalence
 */
function calculateEAL(finding) {
  let baseCost = 0;
  let severityMultiplier = 1;
  let typeMultiplier = 1;
  let prevalenceFactor = 1;

  // Base cost by severity
  switch (finding.severity?.toUpperCase()) {
    case 'CRITICAL':
      baseCost = 250000;
      severityMultiplier = 4.0;
      break;
    case 'HIGH':
      baseCost = 50000;
      severityMultiplier = 2.0;
      break;
    case 'MEDIUM':
      baseCost = 10000;
      severityMultiplier = 1.0;
      break;
    case 'LOW':
      baseCost = 2500;
      severityMultiplier = 0.5;
      break;
    default:
      baseCost = 0;
      severityMultiplier = 0;
  }

  // Finding type multipliers
  switch (finding.finding_type) {
    case 'DENIAL_OF_WALLET':
    case 'CLOUD_COST_AMPLIFICATION':
      typeMultiplier = 10.0;
      break;
    case 'ADA_LEGAL_CONTINGENT_LIABILITY':
      // Fixed legal liability
      return {
        eal_low: 25000,
        eal_ml: 75000,
        eal_high: 500000,
        eal_daily: 0
      };
    case 'GDPR_VIOLATION':
      typeMultiplier = 5.0;
      break;
    case 'PCI_COMPLIANCE_FAILURE':
      typeMultiplier = 4.0;
      break;
    case 'EXPOSED_DATABASE':
      typeMultiplier = 8.0;
      break;
    case 'DATA_BREACH_EXPOSURE':
      typeMultiplier = 6.0;
      break;
    case 'CLIENT_SIDE_SECRET_EXPOSURE':
      typeMultiplier = 3.0;
      break;
    case 'VERIFIED_CVE':
      typeMultiplier = 2.5;
      break;
    case 'MALICIOUS_TYPOSQUAT':
      typeMultiplier = 3.0;
      break;
    case 'PHISHING_INFRASTRUCTURE':
      typeMultiplier = 4.0;
      break;
    default:
      typeMultiplier = 1.0;
  }

  // NEW: Dynamic prevalence factor based on EPSS score
  if (finding.epss_score !== undefined && finding.epss_score !== null) {
    if (finding.epss_score > 0.9) {
      // 90%+ probability of exploitation (critical risk)
      prevalenceFactor = 10.0;
      console.log(`  🔴 Critical EPSS: ${finding.epss_score} -> 10x multiplier`);
    } else if (finding.epss_score > 0.5) {
      // 50-90% probability (high risk)
      prevalenceFactor = 5.0;
      console.log(`  🟠 High EPSS: ${finding.epss_score} -> 5x multiplier`);
    } else if (finding.epss_score > 0.1) {
      // 10-50% probability (medium risk)
      prevalenceFactor = 2.0;
      console.log(`  🟡 Medium EPSS: ${finding.epss_score} -> 2x multiplier`);
    } else if (finding.epss_score > 0.01) {
      // 1-10% probability (low but present risk)
      prevalenceFactor = 1.2;
    } else {
      // Under 1% probability (minimal additional risk)
      prevalenceFactor = 1.0;
    }
  }

  // Calculate final EAL with all factors
  const eal_ml = baseCost * severityMultiplier * typeMultiplier * prevalenceFactor;
  
  return {
    eal_low: eal_ml * 0.6,
    eal_ml: eal_ml,
    eal_high: eal_ml * 1.4,
    eal_daily: eal_ml / 365,
    epss_risk_level: getEpssRiskLevel(finding.epss_score)
  };
}

/**
 * Get EPSS risk level category
 */
function getEpssRiskLevel(score) {
  if (score === null || score === undefined) return 'UNKNOWN';
  if (score > 0.9) return 'CRITICAL';
  if (score > 0.5) return 'HIGH';
  if (score > 0.1) return 'MEDIUM';
  if (score > 0.01) return 'LOW';
  return 'MINIMAL';
}

/**
 * Update findings with EPSS-enhanced EAL calculations
 */
async function updateFindingsWithEPSS() {
  console.log('\n📊 Updating findings with EPSS-enhanced EAL calculations...\n');
  
  try {
    // Get all findings
    const findingsSnapshot = await db.collection('findings').get();
    
    if (findingsSnapshot.empty) {
      console.log('No findings found in database.');
      return;
    }
    
    console.log(`Found ${findingsSnapshot.size} findings to process.\n`);
    
    let updated = 0;
    let withEpss = 0;
    let criticalEpss = 0;
    let highEpss = 0;
    
    // Process in batches of 500
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of findingsSnapshot.docs) {
      const finding = doc.data();
      
      // Check if finding has artifact reference to get EPSS score
      if (finding.artifact_id) {
        // Try to get EPSS score from related artifact
        const artifactSnapshot = await db.collection('artifacts')
          .where('id', '==', finding.artifact_id)
          .limit(1)
          .get();
        
        if (!artifactSnapshot.empty) {
          const artifact = artifactSnapshot.docs[0].data();
          if (artifact.meta?.epss_score !== undefined) {
            finding.epss_score = artifact.meta.epss_score;
            withEpss++;
            
            if (finding.epss_score > 0.9) criticalEpss++;
            else if (finding.epss_score > 0.5) highEpss++;
          }
        }
      }
      
      // Calculate EAL with EPSS factor
      const ealValues = calculateEAL(finding);
      
      // Update the document
      batch.update(doc.ref, {
        ...ealValues,
        epss_score: finding.epss_score || null,
        eal_updated_at: new Date().toISOString(),
        eal_calculation_version: 'v2_with_epss'
      });
      
      batchCount++;
      updated++;
      
      // Commit batch every 500 documents
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`✅ Committed batch of ${batchCount} updates (${updated} total)`);
        batchCount = 0;
      }
    }
    
    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 EPSS Integration Summary:');
    console.log('='.repeat(60));
    console.log(`Total findings updated: ${updated}`);
    console.log(`Findings with EPSS scores: ${withEpss} (${(withEpss/updated*100).toFixed(1)}%)`);
    console.log(`Critical EPSS (>90%): ${criticalEpss}`);
    console.log(`High EPSS (>50%): ${highEpss}`);
    console.log('='.repeat(60));
    
    // Show example of high-EPSS findings
    if (criticalEpss > 0 || highEpss > 0) {
      console.log('\n🎯 High-Risk Findings (EPSS > 50%):');
      const highRiskQuery = await db.collection('findings')
        .where('epss_score', '>', 0.5)
        .orderBy('epss_score', 'desc')
        .limit(5)
        .get();
      
      highRiskQuery.forEach(doc => {
        const f = doc.data();
        console.log(`  - ${f.finding_type || 'Unknown'}: EPSS ${(f.epss_score*100).toFixed(1)}% | EAL: $${f.eal_ml?.toLocaleString() || 0}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating findings:', error);
    process.exit(1);
  }
}

/**
 * Create summary statistics
 */
async function createSummaryStats() {
  console.log('\n📊 Creating EPSS summary statistics...\n');
  
  try {
    // Get all scans with findings
    const scansWithFindings = new Map();
    
    const findingsSnapshot = await db.collection('findings').get();
    
    findingsSnapshot.forEach(doc => {
      const finding = doc.data();
      const scanId = finding.scan_id || finding.meta?.scan_id;
      
      if (scanId) {
        if (!scansWithFindings.has(scanId)) {
          scansWithFindings.set(scanId, {
            total: 0,
            withEpss: 0,
            criticalEpss: 0,
            highEpss: 0,
            totalEalMl: 0,
            maxEpss: 0
          });
        }
        
        const stats = scansWithFindings.get(scanId);
        stats.total++;
        if (finding.epss_score) {
          stats.withEpss++;
          if (finding.epss_score > 0.9) stats.criticalEpss++;
          if (finding.epss_score > 0.5) stats.highEpss++;
          if (finding.epss_score > stats.maxEpss) stats.maxEpss = finding.epss_score;
        }
        if (finding.eal_ml) {
          stats.totalEalMl += finding.eal_ml;
        }
      }
    });
    
    console.log('Scan Summary with EPSS Enhancement:\n');
    console.log('Scan ID                              | Findings | w/EPSS | Critical | High | Max EPSS | Total EAL');
    console.log('-'.repeat(110));
    
    for (const [scanId, stats] of scansWithFindings) {
      console.log(
        `${scanId.substring(0, 36).padEnd(36)} | ` +
        `${stats.total.toString().padStart(8)} | ` +
        `${stats.withEpss.toString().padStart(6)} | ` +
        `${stats.criticalEpss.toString().padStart(8)} | ` +
        `${stats.highEpss.toString().padStart(4)} | ` +
        `${(stats.maxEpss * 100).toFixed(1).padStart(8)}% | ` +
        `$${stats.totalEalMl.toLocaleString().padStart(10)}`
      );
    }
    
  } catch (error) {
    console.error('❌ Error creating summary:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 EPSS Integration for Firestore Findings');
  console.log('==========================================\n');
  
  await updateFindingsWithEPSS();
  await createSummaryStats();
  
  console.log('\n✅ EPSS integration complete!');
  console.log('\n📝 Next steps:');
  console.log('1. New findings will automatically get EPSS scores from the scanner modules');
  console.log('2. EAL calculations now factor in real-world exploit probability');
  console.log('3. Monitor high EPSS findings (>50%) for immediate remediation');
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});