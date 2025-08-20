/*
 * =============================================================================
 * MODULE: shodan.ts  (Hardened v2.1 — compile-clean)
 * =============================================================================
 * Queries the Shodan REST API for exposed services and vulnerabilities
 * associated with a target domain and discovered sub-targets.
 *
 * Key features
 *   • Built-in rate-limit guard (configurable RPS) and exponential back-off
 *   • Pagination (PAGE_LIMIT pages per query) and target-set cap (TARGET_LIMIT)
 *   • CVSS-aware severity escalation and contextual recommendations
 *   • All findings persisted through insertArtifact / insertFinding
 *   • Lint-clean & strict-mode TypeScript
 * =============================================================================
 */
import { httpClient } from '../net/httpClient.js';
import { insertArtifact, insertFinding } from '../core/artifactStore.js';
import { logLegacy as log } from '../core/logger.js';
/* -------------------------------------------------------------------------- */
/*  Configuration                                                              */
/* -------------------------------------------------------------------------- */
const API_KEY = process.env.SHODAN_API_KEY ?? '';
if (!API_KEY) {
    throw new Error('SHODAN_API_KEY environment variable must be configured');
}
const RPS = Number.parseInt(process.env.SHODAN_RPS ?? '1', 10); // reqs / second
const PAGE_LIMIT = Number.parseInt(process.env.SHODAN_PAGE_LIMIT ?? '10', 10);
const TARGET_LIMIT = Number.parseInt(process.env.SHODAN_TARGET_LIMIT ?? '100', 10);
const SEARCH_BASE = 'https://api.shodan.io/shodan/host/search';
/* -------------------------------------------------------------------------- */
/*  Severity helpers                                                           */
/* -------------------------------------------------------------------------- */
const PORT_RISK = {
    21: 'MEDIUM',
    22: 'MEDIUM',
    23: 'HIGH',
    25: 'LOW',
    53: 'LOW',
    80: 'LOW',
    110: 'LOW',
    135: 'HIGH',
    139: 'HIGH',
    445: 'HIGH',
    502: 'CRITICAL',
    1883: 'CRITICAL',
    3306: 'MEDIUM',
    3389: 'HIGH',
    5432: 'MEDIUM',
    5900: 'HIGH',
    6379: 'MEDIUM',
    9200: 'MEDIUM',
    20000: 'CRITICAL',
    47808: 'CRITICAL', // BACnet
};
const cvssToSeverity = (s) => {
    if (s === undefined)
        return 'INFO';
    if (s >= 9)
        return 'CRITICAL';
    if (s >= 7)
        return 'HIGH';
    if (s >= 4)
        return 'MEDIUM';
    return 'LOW';
};
/* -------------------------------------------------------------------------- */
/*  Rate-limited fetch with retry                                              */
/* -------------------------------------------------------------------------- */
const tsQueue = [];
let apiCallsCount = 0;
async function rlFetch(url, attempt = 0) {
    const now = Date.now();
    while (tsQueue.length && now - tsQueue[0] > 1000)
        tsQueue.shift();
    if (tsQueue.length >= RPS) {
        await new Promise((r) => setTimeout(r, 1000 - (now - tsQueue[0])));
    }
    tsQueue.push(Date.now());
    try {
        const res = await httpClient.get(url, { timeout: 30000 });
        apiCallsCount++;
        log(`[Shodan] API call ${apiCallsCount} - ${url.includes('search') ? 'search' : 'host'} query`);
        return res.data;
    }
    catch (err) {
        const ae = err;
        const retriable = ae.code === 'ECONNABORTED' || (ae.response && ae.response.status >= 500);
        if (retriable && attempt < 3) {
            const backoff = 500 * 2 ** attempt;
            await new Promise((r) => setTimeout(r, backoff));
            return rlFetch(url, attempt + 1);
        }
        throw err;
    }
}
/* -------------------------------------------------------------------------- */
/*  Recommendation text                                                        */
/* -------------------------------------------------------------------------- */
function buildRecommendation(port, finding, product, version) {
    if (finding.startsWith('CVE-')) {
        return `Patch ${product || 'service'} ${version || ''} immediately to remediate ${finding}.`;
    }
    if (finding === 'Expired SSL certificate') {
        return 'Renew the TLS certificate and configure automated renewal.';
    }
    switch (port) {
        case 3389:
            return 'Secure RDP with VPN or gateway and enforce MFA.';
        case 445:
        case 139:
            return 'Block SMB/NetBIOS from the Internet; use VPN.';
        case 23:
            return 'Disable Telnet; migrate to SSH.';
        case 5900:
            return 'Avoid exposing VNC publicly; tunnel through SSH or VPN.';
        case 502:
            return 'CRITICAL: Modbus TCP exposed to internet. Isolate OT networks behind firewall/VPN immediately.';
        case 1883:
            return 'CRITICAL: MQTT broker exposed to internet. Implement authentication and network isolation.';
        case 20000:
            return 'CRITICAL: DNP3 protocol exposed to internet. Air-gap industrial control systems immediately.';
        case 47808:
            return 'CRITICAL: BACnet exposed to internet. Isolate building automation systems behind firewall.';
        default:
            return 'Restrict public access and apply latest security hardening guides.';
    }
}
/* -------------------------------------------------------------------------- */
/*  Persist a single Shodan match                                              */
/* -------------------------------------------------------------------------- */
async function persistMatch(m, scanId, searchTarget) {
    let inserted = 0;
    /* --- baseline severity ------------------------------------------------- */
    let sev = (PORT_RISK[m.port] ?? 'INFO');
    const findings = [];
    /* --- ICS/OT protocol detection ----------------------------------------- */
    const ICS_PORTS = [502, 1883, 20000, 47808];
    const ICS_PRODUCTS = ['modbus', 'mqtt', 'bacnet', 'dnp3', 'scada'];
    let isICSProtocol = false;
    if (ICS_PORTS.includes(m.port)) {
        isICSProtocol = true;
        sev = 'CRITICAL';
    }
    // Check product field for ICS indicators
    const productLower = (m.product ?? '').toLowerCase();
    if (ICS_PRODUCTS.some(ics => productLower.includes(ics))) {
        isICSProtocol = true;
        if (sev === 'INFO')
            sev = 'CRITICAL';
    }
    if (m.ssl?.cert?.expired) {
        findings.push('Expired SSL certificate');
        if (sev === 'INFO')
            sev = 'LOW';
    }
    // CVE processing removed - handled by techStackScan module
    const artId = await insertArtifact({
        type: 'shodan_service',
        val_text: `${m.ip_str}:${m.port} ${m.product ?? ''} ${m.version ?? ''}`.trim(),
        severity: sev,
        src_url: `https://www.shodan.io/host/${m.ip_str}`,
        meta: {
            scan_id: scanId,
            search_term: searchTarget,
            ip: m.ip_str,
            port: m.port,
            product: m.product,
            version: m.version,
            hostnames: m.hostnames ?? [],
            location: m.location,
            org: m.org,
            isp: m.isp,
        },
    });
    inserted += 1;
    // Only create findings for genuinely concerning services, not common web ports
    const COMMON_WEB_PORTS = [80, 443, 8080, 8443];
    const shouldCreateFinding = isICSProtocol ||
        sev === 'CRITICAL' ||
        sev === 'HIGH' ||
        !COMMON_WEB_PORTS.includes(m.port) ||
        findings.length > 0; // Has specific security issues
    if (shouldCreateFinding) {
        // Only create generic finding if no specific issues found
        if (findings.length === 0) {
            findings.push(`Exposed service on port ${m.port}`);
        }
        for (const f of findings) {
            // Use specific finding type for ICS/OT protocols
            const findingType = isICSProtocol ? 'OT_PROTOCOL_EXPOSED' : 'EXPOSED_SERVICE';
            await insertFinding({
                scan_id: scanId,
                type: findingType,
                severity: isICSProtocol ? 'CRITICAL' : 'HIGH',
                title: `${findingType === 'OT_PROTOCOL_EXPOSED' ? 'Industrial Control System exposed' : 'Service exposed'} on port ${m.port}`,
                description: f,
                data: {
                    recommendation: buildRecommendation(m.port, f, m.product ?? '', m.version ?? ''),
                    port: m.port,
                    product: m.product,
                    version: m.version,
                    ip: m.ip_str
                }
            });
            inserted += 1;
        }
    }
    return inserted;
}
/* -------------------------------------------------------------------------- */
/*  Main exported function                                                     */
/* -------------------------------------------------------------------------- */
export async function runShodanScan(job) {
    const { domain, scanId } = job;
    log(`[Shodan] Start scan for ${domain}`);
    /* Build target set ------------------------------------------------------ */
    const targets = new Set([domain]);
    // Pool query removed for GCP migration - starting fresh
    const rows = [];
    const result = { rows: [] };
    result.rows.forEach((r) => targets.add(r.val_text.trim()));
    log(`[Shodan] Querying ${targets.size} targets (PAGE_LIMIT=${PAGE_LIMIT})`);
    let totalItems = 0;
    const seenServices = new Set(); // Deduplication for similar services
    for (const tgt of targets) {
        let fetched = 0;
        for (let page = 1; page <= PAGE_LIMIT; page += 1) {
            const q = encodeURIComponent(`hostname:${tgt}`);
            const url = `${SEARCH_BASE}?key=${API_KEY}&query=${q}&page=${page}`;
            try {
                // eslint-disable-next-line no-await-in-loop
                const data = await rlFetch(url);
                if (data.matches.length === 0)
                    break;
                for (const m of data.matches) {
                    // Deduplicate similar services to prevent spam
                    const serviceKey = `${m.ip_str}:${m.port}:${m.product || 'unknown'}`;
                    if (seenServices.has(serviceKey)) {
                        continue; // Skip duplicate service
                    }
                    seenServices.add(serviceKey);
                    // eslint-disable-next-line no-await-in-loop
                    totalItems += await persistMatch(m, scanId, tgt);
                }
                fetched += data.matches.length;
                if (fetched >= data.total)
                    break;
            }
            catch (err) {
                log(`[Shodan] ERROR for ${tgt} (page ${page}): ${err.message}`);
                break; // next target
            }
        }
    }
    await insertArtifact({
        type: 'scan_summary',
        val_text: `Shodan scan: ${totalItems} services found, ${seenServices.size} unique after deduplication`,
        severity: 'INFO',
        meta: {
            scan_id: scanId,
            total_items: totalItems,
            unique_services: seenServices.size,
            api_calls_used: apiCallsCount,
            targets_queried: targets.size,
            timestamp: new Date().toISOString()
        },
    });
    log(`[Shodan] Done — ${totalItems} services found, ${seenServices.size} unique after deduplication, ${apiCallsCount} API calls for ${targets.size} targets`);
    return totalItems;
}
export default runShodanScan;
