import { runEndpointDiscovery } from '../modules/endpointDiscovery.js';
import { runTlsScan } from '../modules/tlsScan.js';
import { runSpfDmarc } from '../modules/spfDmarc.js';
import { runConfigExposureScanner } from '../modules/configExposureScanner.js';
import { runBreachDirectoryProbe } from '../modules/breachDirectoryProbe.js';
import { runShodanScan } from '../modules/shodan.js';
import { runDocumentExposure } from '../modules/documentExposure.js';
import { runWhoisWrapper } from '../modules/whoisWrapper.js';
// import { runAiPathFinder } from '../modules/aiPathFinder.js'; // Moved to Tier 2
import { runTechStackScan } from '../modules/techStackScan.js';
import { runAbuseIntelScan } from '../modules/abuseIntelScan.js';
// import { runAccessibilityScan } from '../modules/accessibilityScan.js'; // Moved to Tier 2 - too slow
// import { runNucleiLegacy as runNuclei } from '../modules/nuclei.js'; // Moved to Tier 2
import { executeModule as runLightweightCveCheck } from '../modules/lightweightCveCheck.js';
import { runClientSecretScanner } from '../modules/clientSecretScanner.js';
import { runBackendExposureScanner } from '../modules/backendExposureScanner.js';
import { runDenialWalletScan } from '../modules/denialWalletScan.js';
import { runAssetCorrelator } from '../modules/assetCorrelator.js';

export interface ScanJob {
  scan_id: string;
  domain: string;
  companyName?: string;
}

export interface ScanResult {
  scan_id: string;
  domain: string;
  results: Record<string, unknown>;
  metadata?: {
    duration_ms: number;
    modules_completed: number;
    modules_failed: number;
    module_timings?: Record<string, number>;
  };
}

export async function executeScan(job: ScanJob): Promise<ScanResult> {
  const { domain, scan_id } = job;
  const companyName = job.companyName || domain.split('.')[0] || 'Unknown';
  const startTime = Date.now();
  const moduleTimings: Record<string, number> = {};

  // Helper function to time module execution
  const timeModule = async (moduleName: string, moduleFunc: Promise<any>) => {
    const moduleStart = Date.now();
    try {
      const result = await moduleFunc;
      const duration = Date.now() - moduleStart;
      moduleTimings[moduleName] = duration;
      console.log(`[TIMING] ${moduleName}: ${duration}ms`);
      return { success: true, data: result, module: moduleName };
    } catch (err: any) {
      const duration = Date.now() - moduleStart;
      moduleTimings[moduleName] = duration;
      console.log(`[TIMING] ${moduleName}: ${duration}ms (failed)`);
      return { success: false, error: err.message, module: moduleName };
    }
  };

  // Run all 16 Tier 1 scans in parallel (accessibility moved to Tier 2)
  const scanPromises = [
    timeModule('breach_directory_probe', runBreachDirectoryProbe({ domain, scanId: scan_id })),
    
    timeModule('shodan_scan', runShodanScan({ domain, scanId: scan_id, companyName })),
    
    timeModule('document_exposure', runDocumentExposure({ companyName, domain, scanId: scan_id })),
    
    timeModule('whois_wrapper', runWhoisWrapper({ domain, scanId: scan_id })),
    
    // ai_path_finder moved to Tier 2 - was taking 90+ seconds
    
    timeModule('endpoint_discovery', runEndpointDiscovery({ domain, scanId: scan_id })),
    
    timeModule('tech_stack_scan', runTechStackScan({ domain, scanId: scan_id })),
    
    timeModule('abuse_intel_scan', runAbuseIntelScan({ scanId: scan_id })),
    
    // accessibility_scan moved to Tier 2 - too slow
    
    timeModule('lightweight_cve_check', (async () => {
      const result = await runLightweightCveCheck({ scanId: scan_id, domain, artifacts: [] });
      return result.findings ? result.findings.length : 0;
    })()),
    
    timeModule('tls_scan', runTlsScan({ domain, scanId: scan_id })),
    
    timeModule('spf_dmarc', runSpfDmarc({ domain, scanId: scan_id })),
    
    timeModule('client_secret_scanner', runClientSecretScanner({ scanId: scan_id })),
    
    timeModule('backend_exposure_scanner', runBackendExposureScanner({ scanId: scan_id })),
    
    timeModule('config_exposure', runConfigExposureScanner({ domain, scanId: scan_id })),
    
    timeModule('denial_wallet_scan', runDenialWalletScan({ domain, scanId: scan_id })),
  ];

  // Add overall timeout protection to prevent hanging scans
  const SCAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total timeout
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Scan timeout - exceeded 5 minutes')), SCAN_TIMEOUT_MS)
  );
  
  console.log(`[executeScan] Starting ${scanPromises.length} modules with ${SCAN_TIMEOUT_MS/1000}s timeout...`);
  
  let results: any[];
  try {
    const settledResults = await Promise.race([
      Promise.allSettled(scanPromises), // Use allSettled instead of all to prevent one failure from killing everything
      timeoutPromise
    ]) as PromiseSettledResult<any>[];
    
    // Convert allSettled results back to our format
    results = settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Module failed with rejection:`, result.reason);
        return { success: false, error: result.reason?.message || 'Module rejected', module: `module_${index}` };
      }
    });
    
    console.log(`[executeScan] Completed with ${results.filter(r => r.success).length}/${results.length} modules successful`);
  } catch (error) {
    // Timeout occurred
    console.error(`[executeScan] SCAN TIMEOUT after ${SCAN_TIMEOUT_MS/1000} seconds:`, error);
    
    // Create failure results for all modules since we don't know which ones completed
    results = scanPromises.map((_, index) => ({
      success: false,
      error: 'Scan timeout exceeded',
      module: `module_${index}`
    }));
  }
  
  // Run asset correlator after all other modules complete
  const assetStart = Date.now();
  try {
    await runAssetCorrelator({ scanId: scan_id, domain, tier: 'tier1' });
    const assetDuration = Date.now() - assetStart;
    moduleTimings['asset_correlator'] = assetDuration;
    console.log(`[TIMING] asset_correlator: ${assetDuration}ms`);
    results.push({ success: true, data: 0, module: 'asset_correlator' }); // Returns void, so we use 0
  } catch (err: any) {
    const assetDuration = Date.now() - assetStart;
    moduleTimings['asset_correlator'] = assetDuration;
    console.log(`[TIMING] asset_correlator: ${assetDuration}ms (failed)`);
    console.error('Asset correlator failed:', err.message);
    results.push({ success: false, error: err.message, module: 'asset_correlator' });
  }
  
  // Count successes and failures
  const modulesCompleted = results.filter(r => r.success).length;
  const modulesFailed = results.filter(r => !r.success).length;
  
  // Log any failures
  results.filter(r => !r.success).forEach(r => {
    console.error(`Module ${r.module} failed:`, (r as any).error);
  });

  // Transform results into the expected format
  const resultMap: Record<string, unknown> = {};
  for (const result of results) {
    // Use the module name directly as the key since we already have full names
    resultMap[result.module] = result.success ? (result as any).data : { error: (result as any).error };
  }

  // Print timing summary
  const totalDuration = Date.now() - startTime;
  console.log('\n========== MODULE TIMING SUMMARY ==========');
  const sortedTimings = Object.entries(moduleTimings).sort((a, b) => b[1] - a[1]);
  sortedTimings.forEach(([module, time]) => {
    console.log(`${module.padEnd(30)} ${time.toString().padStart(6)}ms`);
  });
  console.log('============================================');
  console.log(`TOTAL SCAN TIME:               ${totalDuration}ms`);
  console.log(`Modules completed: ${modulesCompleted}, failed: ${modulesFailed}\n`);

  return {
    scan_id,
    domain,
    results: resultMap,
    metadata: {
      duration_ms: totalDuration,
      modules_completed: modulesCompleted,
      modules_failed: modulesFailed,
      module_timings: moduleTimings,
    },
  };
}