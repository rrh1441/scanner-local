/**
 * Breach Directory Probe Module
 *
 * Queries BreachDirectory and LeakCheck APIs for comprehensive domain breach intelligence
 * to identify compromised accounts and breach exposure statistics.
 */
import { httpClient } from '../net/httpClient.js';
import { insertArtifact, insertFinding } from '../core/artifactStore.js';
import { logLegacy as rootLog } from '../core/logger.js';
import { executeModule, apiCall } from '../util/errorHandler.js';
// Configuration constants
const BREACH_DIRECTORY_API_BASE = 'https://BreachDirectory.com/api_usage';
const LEAKCHECK_API_BASE = 'https://leakcheck.io/api/v2';
const API_TIMEOUT_MS = 30000;
const MAX_SAMPLE_USERNAMES = 100;
const LEAKCHECK_RATE_LIMIT_MS = 350; // 3 requests per second = ~333ms + buffer
// Enhanced logging
const log = (...args) => rootLog('[breachDirectoryProbe]', ...args);
/**
 * Query Breach Directory API for domain breach data
 */
async function queryBreachDirectory(domain, apiKey) {
    const operation = async () => {
        log(`Querying Breach Directory for domain: ${domain}`);
        const response = await httpClient.get(BREACH_DIRECTORY_API_BASE, {
            params: {
                method: 'domain',
                key: apiKey,
                query: domain
            },
            timeout: API_TIMEOUT_MS,
            validateStatus: (status) => status < 500 // Accept 4xx as valid responses
        });
        if (response.status === 200) {
            const data = response.data;
            log(`Breach Directory response for ${domain}: ${data.breached_total || 0} breached accounts`);
            return data;
        }
        else if (response.status === 404) {
            log(`No breach data found for domain: ${domain}`);
            return { breached_total: 0, sample_usernames: [] };
        }
        else if (response.status === 403) {
            // Enhanced logging for 403 Forbidden responses
            const responseData = response.data || {};
            const errorMessage = responseData.error || responseData.message || 'Access forbidden';
            log(`Breach Directory API returned 403 Forbidden for ${domain}: ${errorMessage}`);
            throw new Error(`API access forbidden (403): ${errorMessage}`);
        }
        else {
            // Enhanced generic error handling with response data
            const responseData = response.data || {};
            const errorMessage = responseData.error || responseData.message || `HTTP ${response.status}`;
            log(`Breach Directory API returned status ${response.status} for ${domain}: ${errorMessage}`);
            throw new Error(`API returned status ${response.status}: ${errorMessage}`);
        }
    };
    const result = await apiCall(operation, {
        moduleName: 'breachDirectoryProbe',
        operation: 'queryBreachDirectory',
        target: domain
    });
    if (!result.success) {
        throw new Error(result.error);
    }
    return result.data;
}
/**
 * Query LeakCheck API for domain breach data
 */
async function queryLeakCheck(domain, apiKey) {
    const operation = async () => {
        log(`Querying LeakCheck for domain: ${domain}`);
        const response = await httpClient.get(`${LEAKCHECK_API_BASE}/query/${domain}`, {
            headers: {
                'Accept': 'application/json',
                'X-API-Key': apiKey
            },
            params: {
                type: 'domain',
                limit: 1000 // Max allowed
            },
            timeout: API_TIMEOUT_MS,
            validateStatus: (status) => status < 500 // Accept 4xx as valid responses
        });
        if (response.status === 200) {
            const data = response.data;
            log(`LeakCheck response for ${domain}: ${data.found || 0} accounts found`);
            return data;
        }
        else if (response.status === 404) {
            log(`No leak data found for domain: ${domain}`);
            return { success: false, found: 0, quota: 0, result: [] };
        }
        else {
            const responseData = response.data || {};
            const errorMessage = responseData.error || `HTTP ${response.status}`;
            throw new Error(`LeakCheck API error: ${errorMessage}`);
        }
    };
    const result = await apiCall(operation, {
        moduleName: 'breachDirectoryProbe',
        operation: 'queryLeakCheck',
        target: domain
    });
    if (!result.success) {
        throw new Error(result.error);
    }
    return result.data;
}
/**
 * Analyze combined breach data from both sources
 */
function analyzeCombinedBreach(breachDirectoryData, leakCheckData) {
    const breached_total = breachDirectoryData.breached_total || 0;
    const sample_usernames = (breachDirectoryData.sample_usernames || []).slice(0, MAX_SAMPLE_USERNAMES);
    // LeakCheck data processing
    const leakcheck_total = leakCheckData.found || 0;
    const leakcheck_sources = leakCheckData.result
        .map(entry => entry.source.name)
        .filter((name, index, array) => array.indexOf(name) === index) // Remove duplicates
        .slice(0, 20); // Limit to first 20 unique sources
    // Process LeakCheck results for enhanced analysis (NO sensitive data stored)
    const leakCheckResults = leakCheckData.result
        .map(entry => ({
        email: entry.email || null,
        username: entry.username || (entry.email ? entry.email.split('@')[0] : null),
        source: {
            name: entry.source?.name || 'Unknown',
            breach_date: entry.source?.breach_date || null,
            unverified: entry.source?.unverified || 0,
            passwordless: entry.source?.passwordless || 0,
            compilation: entry.source?.compilation || 0
        },
        // Only store field existence flags, NOT actual values
        has_password: entry.fields?.includes('password') || false,
        has_cookies: entry.fields?.includes('cookies') || entry.fields?.includes('cookie') || false,
        has_autofill: entry.fields?.includes('autofill') || entry.fields?.includes('autofill_data') || false,
        has_browser_data: entry.fields?.includes('browser_data') || entry.fields?.includes('browser') || false,
        field_count: entry.fields?.length || 0,
        first_name: entry.first_name || null,
        last_name: entry.last_name || null
    }))
        .slice(0, 100); // Limit to 100 for performance
    // Add usernames from LeakCheck to sample usernames for backward compatibility
    const leakCheckUsernames = leakCheckResults
        .map(entry => entry.username)
        .filter(username => username !== null)
        .slice(0, 50);
    const combinedUsernames = [...sample_usernames, ...leakCheckUsernames]
        .filter((name, index, array) => array.indexOf(name) === index) // Remove duplicates
        .slice(0, MAX_SAMPLE_USERNAMES);
    const combined_total = breached_total + leakcheck_total;
    // High risk assessment based on breach count and username patterns
    let high_risk_assessment = false;
    // Risk factors
    if (combined_total >= 100) {
        high_risk_assessment = true;
    }
    // Check for administrative/privileged account patterns
    const privilegedPatterns = [
        'admin', 'administrator', 'root', 'sa', 'sysadmin',
        'ceo', 'cto', 'cfo', 'founder', 'owner',
        'security', 'infosec', 'it', 'tech'
    ];
    const hasPrivilegedAccounts = combinedUsernames.some(username => privilegedPatterns.some(pattern => username.toLowerCase().includes(pattern)));
    if (hasPrivilegedAccounts && combined_total >= 10) {
        high_risk_assessment = true;
    }
    // Check for recent breaches in LeakCheck data
    const recentBreaches = leakCheckData.result.filter(entry => {
        if (!entry.source?.breach_date)
            return false;
        const breachYear = parseInt(entry.source.breach_date.split('-')[0]);
        return !isNaN(breachYear) && breachYear >= 2020; // Breaches from 2020 onwards
    });
    if (recentBreaches.length >= 10) {
        high_risk_assessment = true;
    }
    return {
        domain: '',
        breached_total,
        sample_usernames: combinedUsernames,
        high_risk_assessment,
        breach_directory_success: !breachDirectoryData.error,
        leakcheck_total,
        leakcheck_sources,
        leakcheck_success: leakCheckData.success,
        combined_total,
        leakcheck_results: leakCheckResults // Add full results with security flags
    };
}
/**
 * Check if breach source is infostealer malware
 */
function isInfostealerSource(credential) {
    if (!credential.source?.name)
        return false;
    const sourceName = credential.source.name.toLowerCase();
    return sourceName.includes('stealer') ||
        sourceName.includes('redline') ||
        sourceName.includes('raccoon') ||
        sourceName.includes('vidar') ||
        sourceName.includes('azorult') ||
        sourceName.includes('formbook') ||
        sourceName.includes('lokibot');
}
/**
 * Check if user has username + password + session data (CRITICAL)
 */
function hasUsernamePasswordCookies(credential) {
    return credential.has_password &&
        (credential.has_cookies || credential.has_autofill || credential.has_browser_data) &&
        (credential.username || credential.email);
}
/**
 * Check if user has username + password only (MEDIUM)
 */
function hasUsernamePassword(credential) {
    return credential.has_password &&
        !credential.has_cookies &&
        !credential.has_autofill &&
        !credential.has_browser_data &&
        (credential.username || credential.email);
}
/**
 * Check if user has username/email only, no password (INFO)
 */
function hasUsernameOnly(credential) {
    return !credential.has_password &&
        !credential.has_cookies &&
        !credential.has_autofill &&
        !credential.has_browser_data &&
        (credential.username || credential.email);
}
/**
 * Calculate the highest severity for a user across all their breaches
 */
function calculateUserSeverity(userBreaches) {
    // Check for CRITICAL conditions first (highest priority)
    const hasInfostealer = userBreaches.some(isInfostealerSource);
    const hasPasswordAndSession = userBreaches.some(hasUsernamePasswordCookies);
    if (hasInfostealer || hasPasswordAndSession) {
        return 'CRITICAL';
    }
    // Check for MEDIUM condition
    const hasPasswordOnly = userBreaches.some(hasUsernamePassword);
    if (hasPasswordOnly) {
        return 'MEDIUM';
    }
    // Default to INFO (username/email only)
    return 'INFO';
}
/**
 * Deduplicate and consolidate breach data by user
 */
function consolidateBreachesByUser(leakCheckResults) {
    const userBreachMap = new Map();
    leakCheckResults.forEach(credential => {
        // Use email as primary identifier, fallback to username
        const userId = credential.email || credential.username;
        if (!userId)
            return;
        // Normalize userId (lowercase for consistent grouping)
        const normalizedUserId = userId.toLowerCase();
        if (!userBreachMap.has(normalizedUserId)) {
            userBreachMap.set(normalizedUserId, {
                userId: userId,
                breaches: [],
                highestSeverity: 'INFO',
                exposureTypes: [],
                allSources: [],
                earliestBreach: null,
                latestBreach: null
            });
        }
        const userRecord = userBreachMap.get(normalizedUserId);
        userRecord.breaches.push(credential);
        // Track unique sources
        if (credential.source?.name && !userRecord.allSources.includes(credential.source.name)) {
            userRecord.allSources.push(credential.source.name);
        }
        // Track breach dates for timeline
        if (credential.source?.breach_date) {
            const breachDate = credential.source.breach_date;
            if (!userRecord.earliestBreach || breachDate < userRecord.earliestBreach) {
                userRecord.earliestBreach = breachDate;
            }
            if (!userRecord.latestBreach || breachDate > userRecord.latestBreach) {
                userRecord.latestBreach = breachDate;
            }
        }
    });
    // Calculate severity and exposure types for each user
    for (const userRecord of userBreachMap.values()) {
        userRecord.highestSeverity = calculateUserSeverity(userRecord.breaches);
        // Determine exposure types
        const exposureTypes = new Set();
        userRecord.breaches.forEach(breach => {
            if (isInfostealerSource(breach)) {
                exposureTypes.add('Infostealer malware');
            }
            if (breach.has_password && (breach.has_cookies || breach.has_autofill || breach.has_browser_data)) {
                exposureTypes.add('Password + session data');
            }
            else if (breach.has_password) {
                exposureTypes.add('Password');
            }
            if (breach.has_cookies)
                exposureTypes.add('Cookies');
            if (breach.has_autofill)
                exposureTypes.add('Autofill data');
            if (breach.has_browser_data)
                exposureTypes.add('Browser data');
        });
        userRecord.exposureTypes = Array.from(exposureTypes);
    }
    return Array.from(userBreachMap.values());
}
/**
 * Get recommendation text based on severity
 */
function getRecommendationText(severity) {
    switch (severity) {
        case 'CRITICAL':
            return 'Immediately force password reset and revoke all sessions for affected accounts';
        case 'MEDIUM':
            return 'Force password reset and enable 2FA for affected accounts';
        case 'INFO':
            return 'Monitor for phishing attempts and consider security awareness training';
        default:
            return 'Review and monitor affected accounts';
    }
}
/**
 * Map severity to finding type
 */
function mapSeverityToFindingType(severity) {
    switch (severity) {
        case 'CRITICAL':
            return 'CRITICAL_BREACH_EXPOSURE';
        case 'MEDIUM':
            return 'PASSWORD_BREACH_EXPOSURE';
        case 'INFO':
            return 'EMAIL_BREACH_EXPOSURE';
        default:
            return 'BREACH_EXPOSURE';
    }
}
/**
 * Generate breach intelligence summary
 */
function generateBreachSummary(results) {
    const summary = {
        total_breached_accounts: 0,
        leakcheck_total_accounts: 0,
        combined_total_accounts: 0,
        domains_with_breaches: 0,
        high_risk_domains: 0,
        privileged_accounts_found: false,
        unique_breach_sources: []
    };
    const allSources = new Set();
    results.forEach(result => {
        if ((result.breach_directory_success && result.breached_total > 0) ||
            (result.leakcheck_success && result.leakcheck_total > 0)) {
            summary.total_breached_accounts += result.breached_total;
            summary.leakcheck_total_accounts += result.leakcheck_total;
            summary.combined_total_accounts += result.combined_total;
            summary.domains_with_breaches += 1;
            if (result.high_risk_assessment) {
                summary.high_risk_domains += 1;
            }
            // Add unique breach sources from LeakCheck
            result.leakcheck_sources.forEach(source => allSources.add(source));
            // Check for privileged account indicators
            const privilegedPatterns = ['admin', 'ceo', 'root', 'sysadmin'];
            if (result.sample_usernames.some(username => privilegedPatterns.some(pattern => username.toLowerCase().includes(pattern)))) {
                summary.privileged_accounts_found = true;
            }
        }
    });
    summary.unique_breach_sources = Array.from(allSources);
    return summary;
}
/**
 * Main breach directory probe function
 */
export async function runBreachDirectoryProbe(job) {
    const { domain, scanId } = job;
    return executeModule('breachDirectoryProbe', async () => {
        const startTime = Date.now();
        log(`Starting comprehensive breach probe for domain="${domain}" (BreachDirectory + LeakCheck)`);
        // Check for API keys
        const breachDirectoryApiKey = process.env.BREACH_DIRECTORY_API_KEY;
        const leakCheckApiKey = process.env.LEAKCHECK_API_KEY;
        if (!breachDirectoryApiKey && !leakCheckApiKey) {
            log('No breach API keys found - need BREACH_DIRECTORY_API_KEY or LEAKCHECK_API_KEY environment variable');
            return 0;
        }
        let breachData = { breached_total: 0, sample_usernames: [] };
        let leakCheckData = { success: false, found: 0, quota: 0, result: [] };
        // Query BreachDirectory if API key available
        if (breachDirectoryApiKey) {
            try {
                breachData = await queryBreachDirectory(domain, breachDirectoryApiKey);
            }
            catch (error) {
                log(`BreachDirectory query failed: ${error.message}`);
                breachData = { breached_total: 0, sample_usernames: [], error: error.message };
            }
        }
        else {
            log('BreachDirectory API key not found, skipping BreachDirectory query');
        }
        // Query LeakCheck if API key available  
        if (leakCheckApiKey) {
            try {
                // Add rate limiting delay if we queried BreachDirectory first
                if (breachDirectoryApiKey) {
                    await new Promise(resolve => setTimeout(resolve, LEAKCHECK_RATE_LIMIT_MS));
                }
                leakCheckData = await queryLeakCheck(domain, leakCheckApiKey);
            }
            catch (error) {
                log(`LeakCheck query failed: ${error.message}`);
                leakCheckData = { success: false, found: 0, quota: 0, result: [], error: error.message };
            }
        }
        else {
            log('LeakCheck API key not found, skipping LeakCheck query');
        }
        // Analyze combined results
        const analysis = analyzeCombinedBreach(breachData, leakCheckData);
        analysis.domain = domain;
        // Generate summary for reporting
        const summary = generateBreachSummary([analysis]);
        log(`Combined breach analysis complete: BD=${analysis.breached_total}, LC=${analysis.leakcheck_total}, Total=${analysis.combined_total}`);
        let findingsCount = 0;
        // Process breach findings with proper deduplication and severity logic
        if (analysis.leakcheck_results && analysis.leakcheck_results.length > 0) {
            // Step 1: Consolidate breaches by unique user
            const consolidatedUsers = consolidateBreachesByUser(analysis.leakcheck_results);
            log(`Consolidated ${analysis.leakcheck_results.length} breach records into ${consolidatedUsers.length} unique users`);
            // Step 2: Group users by severity level
            const usersBySeverity = new Map();
            consolidatedUsers.forEach(user => {
                const severity = user.highestSeverity;
                if (!usersBySeverity.has(severity)) {
                    usersBySeverity.set(severity, []);
                }
                usersBySeverity.get(severity).push(user);
            });
            // Step 3: Create separate artifact for each severity level (fixes severity inheritance bug)
            for (const [severityLevel, users] of usersBySeverity) {
                if (users.length === 0)
                    continue;
                // Create artifact with correct severity for this specific level
                const artifactId = await insertArtifact({
                    type: 'breach_directory_summary',
                    val_text: `Breach probe: ${users.length} ${severityLevel.toLowerCase()} breach exposures for ${domain}`,
                    severity: severityLevel,
                    meta: {
                        scan_id: scanId,
                        scan_module: 'breachDirectoryProbe',
                        domain,
                        breach_analysis: analysis,
                        summary,
                        breach_sources: analysis.leakcheck_sources,
                        scan_duration_ms: Date.now() - startTime,
                        severity_level: severityLevel,
                        user_count: users.length
                    }
                });
                // Create consolidated finding with all users of this severity
                const userList = users.map(u => u.userId).join(', ');
                const allSources = [...new Set(users.flatMap(u => u.allSources))].join(', ');
                const allExposureTypes = [...new Set(users.flatMap(u => u.exposureTypes))].join(', ');
                // Build timeline info
                const timelineInfo = users
                    .filter(u => u.earliestBreach || u.latestBreach)
                    .map(u => {
                    if (u.earliestBreach === u.latestBreach) {
                        return u.earliestBreach;
                    }
                    else {
                        return `${u.earliestBreach || 'unknown'} to ${u.latestBreach || 'unknown'}`;
                    }
                })
                    .filter((timeline, index, array) => array.indexOf(timeline) === index) // dedupe
                    .join(', ');
                // Create detailed description with user information
                const userDetails = users.length <= 5
                    ? users.map(u => u.userId).join(', ')
                    : `${users.map(u => u.userId).slice(0, 5).join(', ')} and ${users.length - 5} more`;
                const detailedDescription = `${users.length} ${severityLevel.toLowerCase()} breach exposures found: ${userDetails}` +
                    (allExposureTypes ? ` | Exposure types: ${allExposureTypes}` : '') +
                    (allSources ? ` | Sources: ${allSources.slice(0, 100)}${allSources.length > 100 ? '...' : ''}` : '') +
                    (timelineInfo ? ` | Timeline: ${timelineInfo}` : '');
                await insertFinding({
                    scan_id: scanId,
                    type: mapSeverityToFindingType(severityLevel),
                    severity: severityLevel,
                    title: `${users.length} ${severityLevel.toLowerCase()} breach exposures found`,
                    description: detailedDescription,
                    data: {
                        recommendation: getRecommendationText(severityLevel),
                        user_count: users.length,
                        users: users.map(u => u.userId).slice(0, 10), // Limit stored user count
                        exposure_types: allExposureTypes,
                        sources: allSources?.slice(0, 100), // Limit source string length
                        timeline: timelineInfo
                    }
                });
                findingsCount++;
                log(`Created ${severityLevel} finding for ${users.length} users: ${users.map(u => u.userId).slice(0, 5).join(', ')}${users.length > 5 ? '...' : ''}`);
            }
        }
        // Create summary artifact with overall stats
        const overallSeverity = analysis.combined_total >= 100 ? 'HIGH' : analysis.combined_total > 0 ? 'MEDIUM' : 'INFO';
        await insertArtifact({
            type: 'breach_directory_summary',
            val_text: `Breach probe complete: ${analysis.combined_total} total breached accounts (BD: ${analysis.breached_total}, LC: ${analysis.leakcheck_total}) for ${domain}`,
            severity: overallSeverity,
            meta: {
                scan_id: scanId,
                scan_module: 'breachDirectoryProbe',
                domain,
                breach_analysis: analysis,
                summary,
                breach_sources: analysis.leakcheck_sources,
                scan_duration_ms: Date.now() - startTime,
                is_summary: true
            }
        });
        const duration = Date.now() - startTime;
        log(`Breach probe completed: ${findingsCount} findings in ${duration}ms`);
        return findingsCount;
    }, { scanId, target: domain });
}
