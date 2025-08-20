/* =============================================================================
 * MODULE: endpointDiscovery.ts (Consolidated v5 – 2025‑06‑15)
 * =============================================================================
 * - Discovers endpoints via robots.txt, sitemaps, crawling, JS analysis, and brute-force
 * - Integrates endpoint visibility checking to label whether each discovered route is:
 *     • public GET‑only (no auth)  → likely static content
 *     • requires auth             → sensitive / attack surface
 *     • allows state‑changing verbs (POST / PUT / …)
 * - Consolidated implementation with no external module dependencies
 * =============================================================================
 */
import { httpRequest } from '../net/httpClient.js';
import { parse as parseHTML } from 'node-html-parser';
import { insertArtifact } from '../core/artifactStore.js';
import { logLegacy as log } from '../core/logger.js';
import { URL } from 'node:url';
import * as https from 'node:https';
import { parse as parseJS } from 'acorn';
import { simple } from 'acorn-walk';
// ---------- Configuration ----------------------------------------------------
const MAX_CRAWL_DEPTH = 2;
const MAX_CONCURRENT_REQUESTS = 5;
const REQUEST_TIMEOUT = 10000;
const DELAY_BETWEEN_CHUNKS_MS = 500;
const MAX_JS_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
const VIS_PROBE_CONCURRENCY = 5;
const VIS_PROBE_TIMEOUT = 10000;
// Anti-infinite operation protection
const MAX_TOTAL_OPERATIONS = 5000; // Maximum operations per scan
const MAX_OPERATION_TIME_MS = 2 * 60 * 1000; // 2 minutes total (must be less than 3 minute module timeout)
let operationCount = 0;
let scanStartTime = 0;
const ENDPOINT_WORDLIST = [
    'api',
    'admin',
    'app',
    'auth',
    'login',
    'register',
    'dashboard',
    'config',
    'settings',
    'user',
    'users',
    'account',
    'profile',
    'upload',
    'download',
    'files',
    'docs',
    'documentation',
    'help',
    'support',
    'contact',
    'about',
    'status',
    'health',
    'ping',
    'test',
    'dev',
    'debug',
    'staging',
    'prod',
    'production',
    'v1',
    'v2',
    'graphql',
    'rest',
    'webhook',
    'callback',
    'oauth',
    'token',
    'jwt',
    'session',
    'logout',
    'forgot',
    'reset',
    'verify',
    'confirm',
    'activate',
    'wordpress'
];
const AUTH_PROBE_HEADERS = [
    { Authorization: 'Bearer test' },
    { 'X-API-Key': 'test' },
    { 'x-access-token': 'test' },
    { 'X-Auth-Token': 'test' },
    { Cookie: 'session=test' },
    { 'X-Forwarded-User': 'test' }
];
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'curl/8.8.0',
    'python-requests/2.32.0',
    'Go-http-client/2.0'
];
const VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const HTTPS_AGENT = new https.Agent({ rejectUnauthorized: true });
// Backend identifier detection patterns
const RX = {
    firebaseHost: /([a-z0-9-]{6,})\.(?:firebaseio\.com|(?:[a-z0-9-]+\.)?firebasedatabase\.app)/i,
    firebasePID: /projectId["']\s*:\s*["']([a-z0-9-]{6,})["']/i,
    s3Host: /([a-z0-9.\-]{3,63})\.s3[\.\-][a-z0-9\-\.]*\.amazonaws\.com/i,
    s3Path: /s3[\.\-]amazonaws\.com\/([a-z0-9.\-]{3,63})/i,
    s3CompatHost: /([a-z0-9.\-]{3,63})\.(?:r2\.cloudflarestorage\.com|digitaloceanspaces\.com|s3\.wasabisys\.com|s3\.[a-z0-9\-\.]*\.backblazeb2\.com)/i,
    bucketAssign: /bucket["']\s*[:=]\s*["']([a-z0-9.\-]{3,63})["']/i,
    azureHost: /([a-z0-9]{3,24})\.(?:blob|table|file)\.core\.windows\.net/i,
    azureAcct: /storageAccount["']\s*[:=]\s*["']([a-z0-9]{3,24})["']/i,
    azureSAS: /sv=\d{4}-\d{2}-\d{2}&ss=[bqtf]+&srt=[a-z]+&sp=[a-z]+&sig=[A-Za-z0-9%]+/i,
    gcsHost: /storage\.googleapis\.com\/([a-z0-9.\-_]+)/i,
    gcsGs: /gs:\/\/([a-z0-9.\-_]+)/i,
    gcsPath: /\/b\/([a-z0-9.\-_]+)\/o/i,
    supabaseHost: /https:\/\/([a-z0-9-]+)\.supabase\.(?:co|com)/i,
    realmHost: /https:\/\/([a-z0-9-]+)\.realm\.mongodb\.com/i,
    connString: /((?:postgres|mysql|mongodb|redis|mssql):\/\/[^ \n\r'"`]+@[^\s'":\/\[\]]+(?::\d+)?\/[^\s'"]+)/i
};
// ---------- Endpoint Visibility Checking ------------------------------------
async function safeVisibilityRequest(method, target) {
    try {
        const response = await httpRequest({
            url: target,
            method: method,
            totalTimeoutMs: VIS_PROBE_TIMEOUT,
            connectTimeoutMs: 3000,
            firstByteTimeoutMs: 5000,
            idleSocketTimeoutMs: 5000,
            forceIPv4: true,
            maxRedirects: 5,
        });
        return {
            status: response.status,
            data: new TextDecoder('utf-8').decode(response.body),
            headers: response.headers
        };
    }
    catch {
        return null;
    }
}
async function checkEndpoint(urlStr) {
    const notes = [];
    const result = {
        url: urlStr,
        publicGET: false,
        allowedVerbs: [],
        authNeeded: false,
        notes
    };
    /* Validate URL */
    let parsed;
    try {
        parsed = new URL(urlStr);
    }
    catch {
        notes.push('Invalid URL');
        return result;
    }
    /* OPTIONS preflight to discover allowed verbs */
    const optRes = await safeVisibilityRequest('OPTIONS', urlStr);
    if (optRes) {
        const allow = optRes.headers['allow']?.split(',');
        if (allow) {
            result.allowedVerbs = allow.map((v) => v.trim().toUpperCase()).filter(Boolean);
        }
    }
    /* Anonymous GET */
    const getRes = await safeVisibilityRequest('GET', urlStr);
    if (!getRes) {
        notes.push('GET request failed');
        return result;
    }
    result.publicGET = getRes.status === 200;
    /* Check auth headers and common tokens */
    if (getRes.status === 401 || getRes.status === 403) {
        result.authNeeded = true;
        return result;
    }
    const wwwAuth = getRes.headers['www-authenticate'];
    if (wwwAuth) {
        result.authNeeded = true;
        notes.push(`WWW-Authenticate: ${wwwAuth}`);
    }
    /* Test side‑effect verbs only if OPTIONS permitted them */
    for (const verb of VERBS.filter((v) => v !== 'GET')) {
        if (!result.allowedVerbs.includes(verb))
            continue;
        const res = await safeVisibilityRequest(verb, urlStr);
        if (!res)
            continue;
        if (res.status < 400) {
            notes.push(`${verb} responded with status ${res.status}`);
        }
    }
    return result;
}
// ---------- Discovery Helpers -----------------------------------------------
const discovered = new Map();
const webAssets = new Map();
const backendIdSet = new Map();
const getRandomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const safeRequest = async (url, cfg = {}) => {
    try {
        const res = await httpRequest({
            url,
            method: cfg.method || 'GET',
            headers: cfg.headers || { 'User-Agent': getRandomUA() },
            totalTimeoutMs: cfg.timeout || REQUEST_TIMEOUT,
            connectTimeoutMs: 3000,
            firstByteTimeoutMs: 5000,
            idleSocketTimeoutMs: 5000,
            forceIPv4: true,
            maxRedirects: cfg.maxRedirects || 5,
            maxBodyBytes: cfg.responseType === 'arraybuffer' ? 10000000 : 5000000,
        });
        const data = cfg.responseType === 'arraybuffer' ?
            res.body : new TextDecoder('utf-8').decode(res.body);
        return { ok: true, status: res.status, data };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'unknown network error';
        return { ok: false, error: message };
    }
};
const addEndpoint = (baseUrl, ep) => {
    if (discovered.has(ep.path))
        return;
    const fullUrl = `${baseUrl}${ep.path}`;
    discovered.set(ep.path, { ...ep, url: fullUrl });
    log(`[endpointDiscovery] +${ep.source} ${ep.path} (${ep.statusCode ?? '-'})`);
};
// Memory limits to prevent exhaustion
const MAX_WEB_ASSETS = 1000; // Maximum number of web assets to collect
const MAX_ASSET_SIZE = 2 * 1024 * 1024; // 2MB per asset
const MAX_TOTAL_ASSET_SIZE = 100 * 1024 * 1024; // 100MB total asset content
let totalAssetSize = 0;
function recordBackend(id) {
    const key = `${id.provider}:${id.id}`;
    if (!backendIdSet.has(key)) {
        backendIdSet.set(key, id);
        log(`[endpointDiscovery] +backend ${id.provider}:${id.id} from ${id.src.file}:${id.src.line}`);
    }
}
const addWebAsset = (asset) => {
    if (webAssets.has(asset.url))
        return;
    // Check memory limits
    if (webAssets.size >= MAX_WEB_ASSETS) {
        log(`[endpointDiscovery] Asset limit reached (${MAX_WEB_ASSETS}), skipping: ${asset.url}`);
        return;
    }
    const assetSize = asset.content?.length || asset.size || 0;
    if (assetSize > MAX_ASSET_SIZE) {
        log(`[endpointDiscovery] Asset too large (${assetSize} bytes), skipping: ${asset.url}`);
        return;
    }
    if (totalAssetSize + assetSize > MAX_TOTAL_ASSET_SIZE) {
        log(`[endpointDiscovery] Total asset size limit reached, skipping: ${asset.url}`);
        return;
    }
    totalAssetSize += assetSize;
    webAssets.set(asset.url, asset);
    log(`[endpointDiscovery] +web_asset ${asset.type} ${asset.url} (${assetSize} bytes, ${Math.round(totalAssetSize / 1024 / 1024)}MB total)`);
};
const getAssetType = (url, mimeType) => {
    if (url.endsWith('.js.map'))
        return 'sourcemap';
    if (url.endsWith('.js') || mimeType?.includes('javascript'))
        return 'javascript';
    if (url.endsWith('.css') || mimeType?.includes('css'))
        return 'css';
    if (url.endsWith('.json') || mimeType?.includes('json'))
        return 'json';
    if (url.endsWith('.html') || url.endsWith('.htm') || mimeType?.includes('html'))
        return 'html';
    return 'other';
};
// ---------- Backend Identifier Extraction -----------------------------------
function extractViaRegex(source, file) {
    const lines = source.split('\n');
    function m(rx, prov) {
        let match;
        rx.lastIndex = 0; // safety
        while ((match = rx.exec(source))) {
            const idx = match.index;
            const lnum = source.slice(0, idx).split('\n').length;
            recordBackend({ provider: prov, id: match[1], raw: match[0],
                src: { file, line: lnum } });
        }
    }
    m(RX.firebaseHost, 'firebase');
    m(RX.firebasePID, 'firebase');
    m(RX.s3Host, 's3');
    m(RX.s3Path, 's3');
    m(RX.s3CompatHost, 's3');
    m(RX.bucketAssign, 's3');
    m(RX.azureHost, 'azure');
    m(RX.azureAcct, 'azure');
    m(RX.gcsHost, 'gcs');
    m(RX.gcsGs, 'gcs');
    m(RX.gcsPath, 'gcs');
    m(RX.supabaseHost, 'supabase');
    m(RX.realmHost, 'realm');
    m(RX.connString, 's3'); // generic DB strings → handled later
}
function extractViaAST(source, file) {
    let ast;
    try {
        ast = parseJS(source, { ecmaVersion: 'latest' });
    }
    catch {
        return;
    }
    simple(ast, {
        Literal(node) {
            if (typeof node.value !== 'string')
                return;
            const v = node.value;
            extractViaRegex(v, file); // reuse regex on literals
        }
    });
}
// ---------- Passive Discovery ------------------------------------------------
const parseRobotsTxt = async (baseUrl) => {
    const res = await safeRequest(`${baseUrl}/robots.txt`, {
        timeout: REQUEST_TIMEOUT,
        headers: { 'User-Agent': getRandomUA() },
        validateStatus: () => true
    });
    if (!res.ok || typeof res.data !== 'string')
        return;
    for (const raw of res.data.split('\n')) {
        const [directiveRaw, pathRaw] = raw.split(':').map((p) => p.trim());
        if (!directiveRaw || !pathRaw)
            continue;
        const directive = directiveRaw.toLowerCase();
        if ((directive === 'disallow' || directive === 'allow') && pathRaw.startsWith('/')) {
            addEndpoint(baseUrl, {
                path: pathRaw,
                confidence: 'medium',
                source: 'robots.txt'
            });
        }
        else if (directive === 'sitemap') {
            await parseSitemap(new URL(pathRaw, baseUrl).toString(), baseUrl);
        }
    }
};
const parseSitemap = async (sitemapUrl, baseUrl) => {
    const res = await safeRequest(sitemapUrl, {
        timeout: REQUEST_TIMEOUT,
        headers: { 'User-Agent': getRandomUA() },
        validateStatus: () => true
    });
    if (!res.ok || typeof res.data !== 'string')
        return;
    const root = parseHTML(res.data);
    const locElems = root.querySelectorAll('loc');
    for (const el of locElems) {
        try {
            const url = new URL(el.text);
            addEndpoint(baseUrl, {
                path: url.pathname,
                confidence: 'high',
                source: 'sitemap.xml'
            });
        }
        catch {
            /* ignore bad URL */
        }
    }
};
// ---------- Active Discovery -------------------------------------------------
const analyzeJsFile = async (jsUrl, baseUrl) => {
    const res = await safeRequest(jsUrl, {
        timeout: REQUEST_TIMEOUT,
        maxContentLength: MAX_JS_FILE_SIZE_BYTES,
        headers: { 'User-Agent': getRandomUA() },
        validateStatus: () => true
    });
    if (!res.ok || typeof res.data !== 'string')
        return;
    // Save the JavaScript file as a web asset for secret scanning
    addWebAsset({
        url: jsUrl,
        type: 'javascript',
        size: res.data.length,
        confidence: 'high',
        source: 'js_analysis',
        content: res.data.length > 50000 ? res.data.substring(0, 50000) + '...[truncated]' : res.data,
        mimeType: 'application/javascript'
    });
    // Extract backend identifiers from JavaScript
    extractViaRegex(res.data, jsUrl);
    extractViaAST(res.data, jsUrl);
    // Hunt for corresponding source map
    await huntSourceMap(jsUrl, baseUrl);
    // Extract endpoint patterns (existing functionality)
    const re = /['"`](\/[a-zA-Z0-9\-._/]*(?:api|auth|v\d|graphql|jwt|token)[a-zA-Z0-9\-._/]*)['"`]/g;
    let m;
    while ((m = re.exec(res.data)) !== null) {
        addEndpoint(baseUrl, {
            path: m[1],
            confidence: 'medium',
            source: 'js_analysis'
        });
    }
    // Look for potential data endpoints that might contain secrets
    const dataEndpointRe = /fetch\s*\(['"`]([^'"`]+)['"`]\)|axios\.[get|post|put|delete]+\(['"`]([^'"`]+)['"`]\)|\$\.get\(['"`]([^'"`]+)['"`]\)/g;
    let dataMatch;
    while ((dataMatch = dataEndpointRe.exec(res.data)) !== null) {
        const endpoint = dataMatch[1] || dataMatch[2] || dataMatch[3];
        if (endpoint && endpoint.startsWith('/')) {
            addEndpoint(baseUrl, {
                path: endpoint,
                confidence: 'high',
                source: 'js_analysis'
            });
        }
    }
};
// Hunt for source maps that might expose backend secrets
const huntSourceMap = async (jsUrl, baseUrl) => {
    try {
        const sourceMapUrl = jsUrl + '.map';
        const res = await safeRequest(sourceMapUrl, {
            timeout: REQUEST_TIMEOUT,
            maxContentLength: 10 * 1024 * 1024,
            headers: { 'User-Agent': getRandomUA() },
            validateStatus: () => true
        });
        if (res.ok && typeof res.data === 'string') {
            log(`[endpointDiscovery] Found source map: ${sourceMapUrl}`);
            addWebAsset({
                url: sourceMapUrl,
                type: 'sourcemap',
                size: res.data.length,
                confidence: 'high',
                source: 'sourcemap_hunt',
                content: res.data.length > 100000 ? res.data.substring(0, 100000) + '...[truncated]' : res.data,
                mimeType: 'application/json'
            });
        }
    }
    catch (error) {
        // Source map hunting is opportunistic - don't log errors
    }
};
const crawlPage = async (url, depth, baseUrl, seen) => {
    // Circuit breaker: prevent infinite operations
    operationCount++;
    if (operationCount > MAX_TOTAL_OPERATIONS) {
        log(`[endpointDiscovery] Operation limit reached (${MAX_TOTAL_OPERATIONS}), stopping crawl`);
        return;
    }
    if (scanStartTime > 0 && Date.now() - scanStartTime > MAX_OPERATION_TIME_MS) {
        log(`[endpointDiscovery] Time limit reached (${MAX_OPERATION_TIME_MS}ms), stopping crawl`);
        return;
    }
    if (depth > MAX_CRAWL_DEPTH || seen.has(url))
        return;
    seen.add(url);
    const res = await safeRequest(url, {
        timeout: REQUEST_TIMEOUT,
        headers: { 'User-Agent': getRandomUA() },
        validateStatus: () => true
    });
    if (!res.ok || typeof res.data !== 'string')
        return;
    // Save HTML content as web asset for secret scanning
    const contentType = typeof res.data === 'object' && res.data && 'headers' in res.data ?
        res.data.headers?.['content-type'] || '' : '';
    addWebAsset({
        url,
        type: getAssetType(url, contentType),
        size: res.data.length,
        confidence: 'high',
        source: 'crawl',
        content: res.data.length > 100000 ? res.data.substring(0, 100000) + '...[truncated]' : res.data,
        mimeType: contentType
    });
    // Extract backend identifiers from HTML content
    extractViaRegex(res.data, url);
    const root = parseHTML(res.data);
    const pageLinks = new Set();
    root.querySelectorAll('a[href]').forEach((a) => {
        try {
            const abs = new URL(a.getAttribute('href'), baseUrl).toString();
            if (abs.startsWith(baseUrl)) {
                addEndpoint(baseUrl, {
                    path: new URL(abs).pathname,
                    confidence: 'low',
                    source: 'crawl_link'
                });
                pageLinks.add(abs);
            }
        }
        catch {
            /* ignore */
        }
    });
    root.querySelectorAll('script[src]').forEach((s) => {
        try {
            const abs = new URL(s.getAttribute('src'), baseUrl).toString();
            if (abs.startsWith(baseUrl))
                void analyzeJsFile(abs, baseUrl);
        }
        catch {
            /* ignore */
        }
    });
    // Extract CSS files
    root.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
        try {
            const abs = new URL(link.getAttribute('href'), baseUrl).toString();
            if (abs.startsWith(baseUrl)) {
                void analyzeCssFile(abs, baseUrl);
            }
        }
        catch {
            /* ignore */
        }
    });
    // Look for inline scripts with potential secrets
    root.querySelectorAll('script:not([src])').forEach((script, index) => {
        const content = script.innerHTML;
        if (content.length > 100) { // Only save substantial inline scripts
            const inlineUrl = `${url}#inline-script-${index}`;
            addWebAsset({
                url: inlineUrl,
                type: 'javascript',
                size: content.length,
                confidence: 'high',
                source: 'crawl',
                content: content.length > 10000 ? content.substring(0, 10000) + '...[truncated]' : content,
                mimeType: 'application/javascript'
            });
            // Extract backend identifiers from inline scripts
            extractViaRegex(content, inlineUrl);
            extractViaAST(content, inlineUrl);
        }
    });
    for (const link of pageLinks) {
        await crawlPage(link, depth + 1, baseUrl, seen);
    }
};
// Analyze CSS files for potential secrets (background URLs with tokens, etc.)
const analyzeCssFile = async (cssUrl, baseUrl) => {
    const res = await safeRequest(cssUrl, {
        timeout: REQUEST_TIMEOUT,
        maxContentLength: 2 * 1024 * 1024,
        headers: { 'User-Agent': getRandomUA() },
        validateStatus: () => true
    });
    if (!res.ok || typeof res.data !== 'string')
        return;
    addWebAsset({
        url: cssUrl,
        type: 'css',
        size: res.data.length,
        confidence: 'medium',
        source: 'crawl',
        content: res.data.length > 50000 ? res.data.substring(0, 50000) + '...[truncated]' : res.data,
        mimeType: 'text/css'
    });
};
// ---------- Brute-Force / Auth Probe -----------------------------------------
const bruteForce = async (baseUrl) => {
    // Circuit breaker: check operation limits
    if (operationCount > MAX_TOTAL_OPERATIONS * 0.8) { // Reserve 20% for other operations
        log(`[endpointDiscovery] Skipping brute force - operation limit approaching`);
        return;
    }
    const tasks = ENDPOINT_WORDLIST.flatMap((word) => {
        const path = `/${word}`;
        const uaHeader = { 'User-Agent': getRandomUA() };
        const basic = {
            promise: safeRequest(`${baseUrl}${path}`, {
                method: 'HEAD',
                timeout: REQUEST_TIMEOUT,
                headers: uaHeader,
                validateStatus: () => true
            }),
            path,
            source: 'wordlist_enum'
        };
        const auths = AUTH_PROBE_HEADERS.map((h) => ({
            promise: safeRequest(`${baseUrl}${path}`, {
                method: 'GET',
                timeout: REQUEST_TIMEOUT,
                headers: { ...uaHeader, ...h },
                validateStatus: () => true
            }),
            path,
            source: 'auth_probe'
        }));
        return [basic, ...auths];
    });
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENT_REQUESTS) {
        const slice = tasks.slice(i, i + MAX_CONCURRENT_REQUESTS);
        const settled = await Promise.all(slice.map((t) => t.promise));
        settled.forEach((res, idx) => {
            if (!res.ok)
                return;
            const { path, source } = slice[idx];
            if (res.status !== undefined && (res.status < 400 || res.status === 401 || res.status === 403)) {
                addEndpoint(baseUrl, {
                    path,
                    confidence: 'low',
                    source,
                    statusCode: res.status
                });
            }
        });
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS));
    }
};
// ---------- Visibility Probe -------------------------------------------------
async function enrichVisibility(endpoints) {
    const worker = async (ep) => {
        try {
            const rep = await checkEndpoint(ep.url);
            if (rep.authNeeded) {
                ep.visibility = 'auth_required';
            }
            else if (rep.allowedVerbs.some((v) => v !== 'GET')) {
                ep.visibility = 'state_changing';
            }
            else {
                ep.visibility = 'public_get';
            }
        }
        catch (err) {
            /* swallow errors – leave visibility undefined */
        }
    };
    // Process endpoints in chunks with controlled concurrency
    for (let i = 0; i < endpoints.length; i += VIS_PROBE_CONCURRENCY) {
        const chunk = endpoints.slice(i, i + VIS_PROBE_CONCURRENCY);
        const chunkTasks = chunk.map(worker);
        await Promise.allSettled(chunkTasks);
    }
}
// Target high-value paths that might contain secrets
const probeHighValuePaths = async (baseUrl) => {
    const highValuePaths = [
        '/',
        '/index.html',
        '/.env',
        '/config.json',
        '/app.config.json',
        '/settings.json',
        '/manifest.json',
        '/.env.local',
        '/.env.production',
        '/api/config',
        '/api/settings',
        '/_next/static/chunks/webpack.js',
        '/static/js/main.js',
        '/assets/config.js',
        '/config.js',
        '/build/config.json'
    ];
    const tasks = highValuePaths.map(async (path) => {
        try {
            const fullUrl = `${baseUrl}${path}`;
            const res = await safeRequest(fullUrl, {
                timeout: 5000,
                maxContentLength: 5 * 1024 * 1024,
                headers: { 'User-Agent': getRandomUA() },
                validateStatus: () => true
            });
            if (res.ok && res.data) {
                const contentType = '';
                addWebAsset({
                    url: fullUrl,
                    type: getAssetType(fullUrl, contentType),
                    size: typeof res.data === 'string' ? res.data.length : 0,
                    confidence: 'high',
                    source: 'targeted_probe',
                    content: typeof res.data === 'string' ?
                        (res.data.length > 50000 ? res.data.substring(0, 50000) + '...[truncated]' : res.data) :
                        '[binary content]',
                    mimeType: contentType
                });
                log(`[endpointDiscovery] Found high-value asset: ${fullUrl}`);
            }
        }
        catch (error) {
            // Expected for most paths - don't log
        }
    });
    await Promise.all(tasks);
};
// ---------- Main Export ------------------------------------------------------
export async function runEndpointDiscovery(job) {
    log(`[endpointDiscovery] ⇢ start ${job.domain}`);
    const baseUrl = `https://${job.domain}`;
    log(`[endpointDiscovery] baseUrl: ${baseUrl}`);
    // Initialize anti-infinite operation protection
    operationCount = 0;
    scanStartTime = Date.now();
    log(`[endpointDiscovery] Initialized - operationCount: 0, scanStartTime: ${scanStartTime}`);
    discovered.clear();
    webAssets.clear();
    backendIdSet.clear();
    totalAssetSize = 0; // Reset memory usage counter
    log(`[endpointDiscovery] Cleared all collections`);
    // Existing discovery methods with timeout protection
    log(`[endpointDiscovery] Starting parseRobotsTxt...`);
    try {
        await Promise.race([
            parseRobotsTxt(baseUrl),
            new Promise((_, reject) => setTimeout(() => reject(new Error('parseRobotsTxt timeout')), 30000))
        ]);
        log(`[endpointDiscovery] parseRobotsTxt completed successfully`);
    }
    catch (e) {
        log(`[endpointDiscovery] parseRobotsTxt failed or timed out: ${e instanceof Error ? e.message : String(e)}`);
    }
    log(`[endpointDiscovery] Starting parseSitemap...`);
    try {
        await Promise.race([
            parseSitemap(`${baseUrl}/sitemap.xml`, baseUrl),
            new Promise((_, reject) => setTimeout(() => reject(new Error('parseSitemap timeout')), 30000))
        ]);
        log(`[endpointDiscovery] parseSitemap completed successfully`);
    }
    catch (e) {
        log(`[endpointDiscovery] parseSitemap failed or timed out: ${e instanceof Error ? e.message : String(e)}`);
    }
    log(`[endpointDiscovery] Starting crawlPage...`);
    try {
        await Promise.race([
            crawlPage(baseUrl, 1, baseUrl, new Set()),
            new Promise((_, reject) => setTimeout(() => reject(new Error('crawlPage timeout')), 60000))
        ]);
        log(`[endpointDiscovery] crawlPage completed successfully`);
    }
    catch (e) {
        log(`[endpointDiscovery] crawlPage failed or timed out: ${e instanceof Error ? e.message : String(e)}`);
    }
    log(`[endpointDiscovery] Starting bruteForce...`);
    try {
        await Promise.race([
            bruteForce(baseUrl),
            new Promise((_, reject) => setTimeout(() => reject(new Error('bruteForce timeout')), 30000))
        ]);
        log(`[endpointDiscovery] bruteForce completed successfully`);
    }
    catch (e) {
        log(`[endpointDiscovery] bruteForce failed or timed out: ${e instanceof Error ? e.message : String(e)}`);
    }
    // New: Probe high-value paths for secrets
    log(`[endpointDiscovery] Starting probeHighValuePaths...`);
    try {
        await probeHighValuePaths(baseUrl);
        log(`[endpointDiscovery] probeHighValuePaths completed successfully`);
    }
    catch (e) {
        log(`[endpointDiscovery] probeHighValuePaths failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    const endpoints = [...discovered.values()];
    const assets = [...webAssets.values()];
    const backendArr = [...backendIdSet.values()];
    log(`[endpointDiscovery] Collected ${endpoints.length} endpoints, ${assets.length} assets, ${backendArr.length} backends`);
    /* ------- Visibility enrichment (public/static vs. auth) ---------------- */
    log(`[endpointDiscovery] Starting enrichVisibility...`);
    try {
        await enrichVisibility(endpoints);
        log(`[endpointDiscovery] enrichVisibility completed successfully`);
    }
    catch (e) {
        log(`[endpointDiscovery] enrichVisibility failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    // Save discovered endpoints
    if (endpoints.length) {
        await insertArtifact({
            type: 'discovered_endpoints',
            val_text: `Discovered ${endpoints.length} unique endpoints for ${job.domain}`,
            severity: 'INFO',
            meta: {
                scan_id: job.scanId,
                scan_module: 'endpointDiscovery',
                endpoints
            }
        });
    }
    // Save discovered web assets for secret scanning
    if (assets.length) {
        await insertArtifact({
            type: 'discovered_web_assets',
            val_text: `Discovered ${assets.length} web assets for secret scanning on ${job.domain}`,
            severity: 'INFO',
            meta: {
                scan_id: job.scanId,
                scan_module: 'endpointDiscovery',
                assets,
                asset_breakdown: {
                    javascript: assets.filter(a => a.type === 'javascript').length,
                    css: assets.filter(a => a.type === 'css').length,
                    html: assets.filter(a => a.type === 'html').length,
                    json: assets.filter(a => a.type === 'json').length,
                    sourcemap: assets.filter(a => a.type === 'sourcemap').length,
                    other: assets.filter(a => a.type === 'other').length
                }
            }
        });
    }
    // Save discovered backend identifiers
    if (backendArr.length) {
        await insertArtifact({
            type: 'backend_identifiers',
            severity: 'INFO',
            val_text: `Identified ${backendArr.length} backend IDs on ${job.domain}`,
            meta: {
                scan_id: job.scanId,
                scan_module: 'endpointDiscovery',
                backendArr
            }
        });
    }
    log(`[endpointDiscovery] ⇢ done – ${endpoints.length} endpoints, ${assets.length} web assets, ${backendArr.length} backend IDs`);
    // Return 0 as this module doesn't create findings, only artifacts
    return 0;
}
