import { Agent, request, interceptors } from 'undici';
const DEFAULTS = {
    totalTimeoutMs: 10000,
    connectTimeoutMs: 3000,
    firstByteTimeoutMs: 5000,
    idleSocketTimeoutMs: 5000,
    forceIPv4: true,
    probeConnectWithHead: false,
    maxBodyBytes: 2000000,
    maxRedirects: 5,
    disableKeepAlive: false,
};
// Create a custom Agent with better timeout control
// IPv4 forcing is handled by NODE_OPTIONS=--dns-result-order=ipv4first
const ipv4Agent = new Agent({
    connect: {
        timeout: DEFAULTS.connectTimeoutMs,
    },
    bodyTimeout: DEFAULTS.idleSocketTimeoutMs,
    headersTimeout: DEFAULTS.firstByteTimeoutMs,
    keepAliveTimeout: 1,
    keepAliveMaxTimeout: 1,
    pipelining: 0, // Disable pipelining
}).compose(interceptors.redirect({ maxRedirections: DEFAULTS.maxRedirects }));
// Standard agent without IPv4 forcing
const standardAgent = new Agent({
    connect: {
        timeout: DEFAULTS.connectTimeoutMs,
    },
    bodyTimeout: DEFAULTS.idleSocketTimeoutMs,
    headersTimeout: DEFAULTS.firstByteTimeoutMs,
    keepAliveTimeout: 5000,
    keepAliveMaxTimeout: 10000,
    pipelining: 0,
}).compose(interceptors.redirect({ maxRedirections: DEFAULTS.maxRedirects }));
function headersToObject(headers) {
    const obj = {};
    for (const [k, v] of Object.entries(headers)) {
        obj[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
    }
    return obj;
}
export async function httpRequest(opts) {
    const { url, method = 'GET', headers = {}, body, totalTimeoutMs = DEFAULTS.totalTimeoutMs, connectTimeoutMs = DEFAULTS.connectTimeoutMs, firstByteTimeoutMs = DEFAULTS.firstByteTimeoutMs, idleSocketTimeoutMs = DEFAULTS.idleSocketTimeoutMs, forceIPv4 = DEFAULTS.forceIPv4, probeConnectWithHead = DEFAULTS.probeConnectWithHead, maxBodyBytes = DEFAULTS.maxBodyBytes, maxRedirects = DEFAULTS.maxRedirects, disableKeepAlive = DEFAULTS.disableKeepAlive, } = opts;
    // Select the appropriate agent based on IPv4 forcing
    const agent = forceIPv4 ? ipv4Agent : standardAgent;
    const requestHeaders = { ...headers };
    // Disable keep-alive if requested
    if (disableKeepAlive) {
        requestHeaders['Connection'] = 'close';
    }
    // Optional: Probe connection with HEAD request first
    if (probeConnectWithHead && method !== 'HEAD') {
        try {
            await request(url, {
                method: 'HEAD',
                headers: requestHeaders,
                dispatcher: agent,
                bodyTimeout: connectTimeoutMs,
                headersTimeout: connectTimeoutMs,
            });
        }
        catch (err) {
            // Probe failed but continue with actual request
            console.warn('HEAD probe failed, continuing with actual request');
        }
    }
    // Make the actual request using undici
    const abortController = new AbortController();
    const totalTimer = setTimeout(() => abortController.abort(), totalTimeoutMs);
    try {
        const { statusCode, headers: respHeaders, body: respBody } = await request(url, {
            method: method,
            headers: requestHeaders,
            body,
            dispatcher: agent,
            signal: abortController.signal,
            bodyTimeout: idleSocketTimeoutMs,
            headersTimeout: firstByteTimeoutMs,
        });
        // Read the body with size limit
        const chunks = [];
        let received = 0;
        for await (const chunk of respBody) {
            const data = chunk instanceof Buffer ? new Uint8Array(chunk) : chunk;
            received += data.byteLength;
            if (received > maxBodyBytes) {
                respBody.destroy();
                throw new Error(`Body too large (> ${maxBodyBytes} bytes)`);
            }
            chunks.push(data);
        }
        // Combine chunks into single buffer
        const bodyData = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            bodyData.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return {
            url,
            status: statusCode,
            ok: statusCode >= 200 && statusCode < 300,
            headers: headersToObject(respHeaders),
            body: bodyData,
        };
    }
    catch (err) {
        if (err.name === 'AbortError' || err.code === 'UND_ERR_ABORTED') {
            throw new Error(`Request timeout after ${totalTimeoutMs}ms`);
        }
        if (err.code === 'UND_ERR_HEADERS_TIMEOUT') {
            throw new Error(`First byte timeout after ${firstByteTimeoutMs}ms`);
        }
        if (err.code === 'UND_ERR_BODY_TIMEOUT') {
            throw new Error(`Body read timeout after ${idleSocketTimeoutMs}ms`);
        }
        if (err.code === 'UND_ERR_CONNECT_TIMEOUT') {
            throw new Error(`Connection timeout after ${connectTimeoutMs}ms`);
        }
        throw err;
    }
    finally {
        clearTimeout(totalTimer);
    }
}
export async function httpGetText(url, opt) {
    const r = await httpRequest({ url, method: 'GET', ...(opt ?? {}) });
    return new TextDecoder('utf-8').decode(r.body);
}
// Axios error for compatibility
export class AxiosError extends Error {
    constructor(message, code, config, response) {
        super(message);
        this.name = 'AxiosError';
        this.code = code;
        this.config = config;
        this.response = response;
    }
}
export async function axiosCompat(config) {
    // Handle string URL
    if (typeof config === 'string') {
        config = { url: config, method: 'GET' };
    }
    const { url, method = 'GET', headers = {}, data, params, timeout = 10000, maxContentLength = 50 * 1024 * 1024, // 50MB default
    maxBodyLength = maxContentLength, maxRedirects = 5, validateStatus = (status) => status >= 200 && status < 300, responseType = 'json', httpsAgent // Ignored, we handle TLS internally
     } = config;
    if (!url)
        throw new Error('URL is required');
    // Build URL with query params
    let finalUrl = url;
    if (params && Object.keys(params).length > 0) {
        const urlObj = new URL(url);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                urlObj.searchParams.append(key, String(value));
            }
        });
        finalUrl = urlObj.toString();
    }
    // Convert data to appropriate format
    let body;
    if (data) {
        if (typeof data === 'string' || data instanceof Buffer) {
            body = data;
        }
        else {
            body = JSON.stringify(data);
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }
    }
    try {
        const response = await httpRequest({
            url: finalUrl,
            method,
            headers,
            body,
            totalTimeoutMs: timeout,
            maxBodyBytes: Math.min(maxContentLength, maxBodyLength),
            maxRedirects,
            forceIPv4: true
        });
        // Check status
        if (!validateStatus(response.status)) {
            const error = new Error(`Request failed with status code ${response.status}`);
            error.response = {
                data: response.body,
                status: response.status,
                headers: response.headers
            };
            throw error;
        }
        // Parse response data based on responseType
        let responseData;
        if (responseType === 'arraybuffer') {
            responseData = response.body;
        }
        else if (responseType === 'text') {
            responseData = new TextDecoder('utf-8').decode(response.body);
        }
        else {
            // Try to parse as JSON
            const text = new TextDecoder('utf-8').decode(response.body);
            try {
                responseData = text ? JSON.parse(text) : null;
            }
            catch {
                // If not JSON, return as text
                responseData = text;
            }
        }
        return {
            data: responseData,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: response.headers,
            config
        };
    }
    catch (error) {
        // Enhance error for axios compatibility
        if (!error.response) {
            error.config = config;
            error.code = error.code || 'ECONNABORTED';
            error.message = error.message || 'Network Error';
        }
        throw error;
    }
}
// Convenience methods for axios compatibility
export const httpClient = {
    get: (url, config) => axiosCompat({ ...config, url, method: 'GET' }),
    post: (url, data, config) => axiosCompat({ ...config, url, method: 'POST', data }),
    put: (url, data, config) => axiosCompat({ ...config, url, method: 'PUT', data }),
    delete: (url, config) => axiosCompat({ ...config, url, method: 'DELETE' }),
    patch: (url, data, config) => axiosCompat({ ...config, url, method: 'PATCH', data }),
    head: (url, config) => axiosCompat({ ...config, url, method: 'HEAD' }),
    options: (url, config) => axiosCompat({ ...config, url, method: 'OPTIONS' }),
    request: axiosCompat
};
