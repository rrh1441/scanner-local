import { runEndpointDiscovery } from '../modules/endpointDiscovery.js';
import { runTlsScan } from '../modules/tlsScan.js';
import { runSpfDmarc } from '../modules/spfDmarc.js';
import { runConfigExposureScanner } from '../modules/configExposureScanner.js';
import { runBreachDirectoryProbe } from '../modules/breachDirectoryProbe.js';
import { runShodanScan } from '../modules/shodan.js';
import { runDocumentExposure } from '../modules/documentExposure.js';
export async function executeScan(job) {
    const { domain, scan_id } = job;
    const companyName = job.companyName || domain.split('.')[0] || 'Unknown';
    const startTime = Date.now();
    // Run all scans in parallel with proper error handling and timeouts
    const scanPromises = [
        runBreachDirectoryProbe({ domain, scanId: scan_id })
            .then(result => ({ success: true, data: result, module: 'breach' }))
            .catch(err => ({ success: false, error: err.message, module: 'breach' })),
        runShodanScan({ domain, scanId: scan_id, companyName })
            .then(result => ({ success: true, data: result, module: 'shodan' }))
            .catch(err => ({ success: false, error: err.message, module: 'shodan' })),
        runDocumentExposure({ companyName, domain, scanId: scan_id })
            .then(result => ({ success: true, data: result, module: 'document' }))
            .catch(err => ({ success: false, error: err.message, module: 'document' })),
        runEndpointDiscovery({ domain, scanId: scan_id })
            .then(result => ({ success: true, data: result, module: 'endpoint' }))
            .catch(err => ({ success: false, error: err.message, module: 'endpoint' })),
        runTlsScan({ domain, scanId: scan_id })
            .then(result => ({ success: true, data: result, module: 'tls' }))
            .catch(err => ({ success: false, error: err.message, module: 'tls' })),
        runSpfDmarc({ domain, scanId: scan_id })
            .then(result => ({ success: true, data: result, module: 'spf' }))
            .catch(err => ({ success: false, error: err.message, module: 'spf' })),
        runConfigExposureScanner({ domain, scanId: scan_id })
            .then(result => ({ success: true, data: result, module: 'config' }))
            .catch(err => ({ success: false, error: err.message, module: 'config' })),
    ];
    const results = await Promise.all(scanPromises);
    // Count successes and failures
    const modulesCompleted = results.filter(r => r.success).length;
    const modulesFailed = results.filter(r => !r.success).length;
    // Log any failures
    results.filter(r => !r.success).forEach(r => {
        console.error(`Module ${r.module} failed:`, r.error);
    });
    // Transform results into the expected format
    const resultMap = {};
    for (const result of results) {
        const key = `${result.module}_${result.module === 'breach' ? 'directory_probe' :
            result.module === 'document' ? 'exposure' :
                result.module === 'endpoint' ? 'discovery' :
                    result.module === 'config' ? 'exposure' :
                        result.module === 'spf' ? 'dmarc' :
                            'scan'}`;
        resultMap[key] = result.success ? result.data : { error: result.error };
    }
    return {
        scan_id,
        domain,
        results: resultMap,
        metadata: {
            duration_ms: Date.now() - startTime,
            modules_completed: modulesCompleted,
            modules_failed: modulesFailed,
        },
    };
}
