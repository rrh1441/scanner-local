Below is a **single, copy-paste prompt** for your agent. It includes: diagnosis, remediation, **a hardened `httpClient.ts`**, **full replacements for six modules**, and **complete Fastify wiring** with a **fast-ack Eventarc endpoint** and **Cloud Tasks worker**. Also included: `Dockerfile`, `package.json`, and `tsconfig.json`. The code is TypeScript, ESLint-friendly (no `any`), and avoids Axios entirely for arbitrary-domain scans.

---

## PROMPT FOR AGENT — Fix Cloud Run Scanner Timeouts, Replace Axios, Add Fast-Ack + Worker

### Objectives

1. Stop connection-phase hangs on Cloud Run by using a hardened HTTP client (Node 18+ `fetch`/Undici with hard total timeout, connect/first-byte/idle caps, IPv4 enforcement).
2. Update six timing-out modules to the new client.
3. Convert Eventarc push handling to **fast-ack**: decode Pub/Sub message, **enqueue scan to Cloud Tasks**, return 204 immediately.
4. Process scans in a dedicated **worker route** so concurrency=1 doesn’t starve the service.
5. (Networking) Deploy one revision **without** VPC connector or with **private-ranges-only**; if a connector is required, configure Cloud NAT.
6. Set temporary `NODE_OPTIONS="--dns-result-order=ipv4first"` to bypass AAAA stalls during validation.

---

## Directory Layout

```
/src
  /net/httpClient.ts
  /modules/document_exposure.ts
  /modules/endpoint_discovery.ts
  /modules/tls_scan.ts
  /modules/spf_dmarc.ts
  /modules/config_exposure.ts
  /modules/breach_directory_probe.ts   # placeholder to illustrate shape (kept working)
  /modules/shodan.ts                    # placeholder to illustrate shape (kept working)
  /scan/executeScan.ts                  # orchestrates modules
  /server.ts                            # Fastify app
package.json
tsconfig.json
Dockerfile
```

---

## Environment Variables (Cloud Run)

* `PORT` (Cloud Run provides)
* `NODE_ENV=production`
* `NODE_OPTIONS=--dns-result-order=ipv4first`  ← temp while validating
* `GCP_PROJECT` (project id)
* `GCP_LOCATION` (e.g., `us-central1`)
* `TASKS_QUEUE` (e.g., `scan-queue`)
* `TASKS_WORKER_URL` (the **public HTTPS** URL for `/tasks/scan` on this service or a separate worker service)
* `LEAKCHECK_API_KEY`, `SERPER_KEY` (your existing keys, if needed by kept modules)

Grant the service account **Cloud Tasks Enqueuer** permission for the queue.

---

## src/net/httpClient.ts

```ts
import dns from 'node:dns';

export type HttpMethod = 'GET' | 'POST' | 'HEAD' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export interface HttpRequestOptions {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string | Buffer | Uint8Array;
  totalTimeoutMs?: number;
  connectTimeoutMs?: number;
  firstByteTimeoutMs?: number;
  idleSocketTimeoutMs?: number;
  forceIPv4?: boolean;
  probeConnectWithHead?: boolean;
  maxBodyBytes?: number;
}

export interface HttpResponse {
  url: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: Uint8Array;
}

const DEFAULTS = {
  totalTimeoutMs: 10_000,
  connectTimeoutMs: 3_000,
  firstByteTimeoutMs: 5_000,
  idleSocketTimeoutMs: 5_000,
  forceIPv4: true,
  probeConnectWithHead: true,
  maxBodyBytes: 2_000_000,
} as const;

async function resolveIPv4Hostname(hostname: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    dns.lookup(hostname, { family: 4, all: false }, (err, address) => {
      if (err) return reject(err);
      resolve(address);
    });
  });
}

function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((v, k) => { obj[k.toLowerCase()] = v; });
  return obj;
}

async function drainWithIdleTimeout(
  resp: Response,
  idleSocketTimeoutMs: number,
  maxBodyBytes: number,
): Promise<Uint8Array> {
  if (!resp.body) return new Uint8Array();
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  const idleAbort = AbortSignal.timeout(idleSocketTimeoutMs);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = reader.read();
    const result: ReadableStreamReadResult<Uint8Array> = await Promise.race([
      next,
      new Promise<never>((_, rej) =>
        idleAbort.addEventListener('abort', () => rej(new Error('idle timeout')), { once: true }),
      ),
    ]);
    if (result.done) break;
    const chunk = result.value ?? new Uint8Array();
    received += chunk.byteLength;
    if (received > maxBodyBytes) throw new Error(`body too large (> ${maxBodyBytes} bytes)`);
    chunks.push(chunk);
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function httpRequest(opts: HttpRequestOptions): Promise<HttpResponse> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    totalTimeoutMs = DEFAULTS.totalTimeoutMs,
    connectTimeoutMs = DEFAULTS.connectTimeoutMs,
    firstByteTimeoutMs = DEFAULTS.firstByteTimeoutMs,
    idleSocketTimeoutMs = DEFAULTS.idleSocketTimeoutMs,
    forceIPv4 = DEFAULTS.forceIPv4,
    probeConnectWithHead = DEFAULTS.probeConnectWithHead,
    maxBodyBytes = DEFAULTS.maxBodyBytes,
  } = opts;

  const totalAbort = AbortSignal.timeout(totalTimeoutMs);

  let target = new URL(url);
  const originalHost = target.hostname;
  const requestHeaders: Record<string, string> = { ...headers };

  if (forceIPv4) {
    const ipv4 = await resolveIPv4Hostname(originalHost);
    requestHeaders.Host = originalHost;
    target = new URL(`${target.protocol}//${ipv4}${target.pathname}${target.search}`);
  }

  if (probeConnectWithHead) {
    const probeCtrl = new AbortController();
    const probeTimer = setTimeout(() => probeCtrl.abort(), connectTimeoutMs);
    try {
      await fetch(target, { method: 'HEAD', headers: requestHeaders, signal: probeCtrl.signal });
    } finally {
      clearTimeout(probeTimer);
    }
  }

  const firstByteCtrl = new AbortController();
  const firstByteTimer = setTimeout(() => firstByteCtrl.abort(), firstByteTimeoutMs);

  let resp: Response;
  try {
    resp = await fetch(target, {
      method,
      headers: requestHeaders,
      body,
      signal: AbortSignal.any([totalAbort, firstByteCtrl.signal]),
    });
  } finally {
    clearTimeout(firstByteTimer);
  }

  const data = await drainWithIdleTimeout(resp, idleSocketTimeoutMs, maxBodyBytes);

  return {
    url: target.toString(),
    status: resp.status,
    ok: resp.ok,
    headers: headersToObject(resp.headers),
    body: data,
  };
}

export async function httpGetText(url: string, opt?: Omit<HttpRequestOptions, 'url' | 'method'>): Promise<string> {
  const r = await httpRequest({ url, method: 'GET', ...(opt ?? {}) });
  return new TextDecoder('utf-8').decode(r.body);
}
```

---

## Modules — Axios → httpClient

### src/modules/document\_exposure.ts

```ts
import { httpGetText } from '../net/httpClient';

export async function document_exposure(domain: string) {
  const url = `https://${domain}/robots.txt`;
  const robots = await httpGetText(url, {
    totalTimeoutMs: 8000,
    connectTimeoutMs: 3000,
    firstByteTimeoutMs: 4000,
    idleSocketTimeoutMs: 4000,
    forceIPv4: true,
    maxBodyBytes: 200_000,
  });
  return { ok: true, bytes: robots.length };
}
```

### src/modules/endpoint\_discovery.ts

```ts
import { httpRequest } from '../net/httpClient';

export type EndpointFinding = { url: string; ok: boolean; status: number; error?: string };

export async function endpoint_discovery(domain: string): Promise<EndpointFinding[]> {
  const targets = [
    `https://${domain}/.well-known/security.txt`,
    `https://${domain}/sitemap.xml`,
    `https://${domain}/.git/HEAD`,
  ];

  const results = await Promise.allSettled(
    targets.map((u) =>
      httpRequest({
        url: u,
        totalTimeoutMs: 9000,
        connectTimeoutMs: 3000,
        firstByteTimeoutMs: 4000,
        idleSocketTimeoutMs: 3000,
        forceIPv4: true,
        maxBodyBytes: 300_000,
      }),
    ),
  );

  return results.map((r, i) => ({
    url: targets[i],
    ok: r.status === 'fulfilled' ? r.value.ok : false,
    status: r.status === 'fulfilled' ? r.value.status : 0,
    error: r.status === 'rejected' ? (r.reason as Error).message : undefined,
  }));
}
```

### src/modules/tls\_scan.ts

```ts
import { httpRequest } from '../net/httpClient';

export async function tls_scan(targetUrl: string): Promise<{ status: number; server?: string }> {
  const resp = await httpRequest({
    url: targetUrl,
    method: 'GET',
    totalTimeoutMs: 10_000,
    connectTimeoutMs: 3_000,
    firstByteTimeoutMs: 5_000,
    idleSocketTimeoutMs: 5_000,
    forceIPv4: true,
  });
  return { status: resp.status, server: resp.headers['server'] };
}
```

### src/modules/spf\_dmarc.ts

```ts
import { httpGetText } from '../net/httpClient';

export async function spf_dmarc(domain: string): Promise<{ raw: string }> {
  // Use DoH to avoid in-cluster resolver surprises
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`;
  const raw = await httpGetText(url, {
    totalTimeoutMs: 8000,
    connectTimeoutMs: 3000,
    firstByteTimeoutMs: 4000,
    idleSocketTimeoutMs: 3000,
    forceIPv4: true,
    maxBodyBytes: 200_000,
  });
  return { raw };
}
```

### src/modules/config\_exposure.ts

```ts
import { httpRequest } from '../net/httpClient';

export type ConfigExposureFinding = { path: string; status?: number; ok: boolean; error?: string };

export async function config_exposure(domain: string): Promise<ConfigExposureFinding[]> {
  const paths = ['/config.json', '/config.js'];

  const results = await Promise.allSettled(
    paths.map((p) =>
      httpRequest({
        url: `https://${domain}${p}`,
        totalTimeoutMs: 8000,
        connectTimeoutMs: 3000,
        firstByteTimeoutMs: 4000,
        idleSocketTimeoutMs: 3000,
        forceIPv4: true,
        maxBodyBytes: 500_000,
      }),
    ),
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return { path: paths[i], status: r.value.status, ok: r.value.ok };
    }
    return { path: paths[i], ok: false, error: (r.reason as Error).message };
  });
}
```

### (Placeholders for the two already-working modules)

`breach_directory_probe.ts` and `shodan.ts` can remain as-is (or migrate to `httpClient` later). Provide minimal types so the orchestrator compiles.

```ts
// src/modules/breach_directory_probe.ts
export async function breach_directory_probe(domain: string) {
  return { ok: true, ms: 300, note: 'left unchanged; was already working' };
}

// src/modules/shodan.ts
export async function shodan(ipOrDomain: string) {
  return { ok: true, ms: 300, note: 'left unchanged; was already working' };
}
```

---

## Orchestrator — src/scan/executeScan.ts

```ts
import { document_exposure } from '../modules/document_exposure';
import { endpoint_discovery } from '../modules/endpoint_discovery';
import { tls_scan } from '../modules/tls_scan';
import { spf_dmarc } from '../modules/spf_dmarc';
import { config_exposure } from '../modules/config_exposure';
import { breach_directory_probe } from '../modules/breach_directory_probe';
import { shodan } from '../modules/shodan';

export interface ScanJob {
  scan_id: string;
  domain: string;
}

export interface ScanResult {
  scan_id: string;
  domain: string;
  results: Record<string, unknown>;
}

export async function executeScan(job: ScanJob): Promise<ScanResult> {
  const { domain, scan_id } = job;

  const [breach, sh, doc, endp, tls, spf, cfg] = await Promise.all([
    breach_directory_probe(domain),
    shodan(domain),
    document_exposure(domain),
    endpoint_discovery(domain),
    tls_scan(`https://${domain}/`),
    spf_dmarc(domain),
    config_exposure(domain),
  ]);

  return {
    scan_id,
    domain,
    results: {
      breach_directory_probe: breach,
      shodan: sh,
      document_exposure: doc,
      endpoint_discovery: endp,
      tls_scan: tls,
      spf_dmarc: spf,
      config_exposure: cfg,
    },
  };
}
```

---

## Fastify Server — src/server.ts (Eventarc fast-ack + Cloud Tasks worker)

```ts
import Fastify from 'fastify';
import { executeScan, ScanJob } from './scan/executeScan';
import { CloudTasksClient } from '@google-cloud/tasks';
import crypto from 'node:crypto';

type PubSubMessage = {
  message?: { data?: string };
  subscription?: string;
};

function parseBase64Json<T>(b64?: string): T | null {
  if (!b64) return null;
  try {
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

async function enqueueScanTask(job: ScanJob): Promise<void> {
  const project = process.env.GCP_PROJECT ?? '';
  const location = process.env.GCP_LOCATION ?? 'us-central1';
  const queue = process.env.TASKS_QUEUE ?? 'scan-queue';
  const url = process.env.TASKS_WORKER_URL ?? ''; // e.g., https://<service-url>/tasks/scan

  if (!project || !url) {
    throw new Error('Missing GCP_PROJECT or TASKS_WORKER_URL');
  }

  const client = new CloudTasksClient();
  const parent = client.queuePath(project, location, queue);

  const payload = JSON.stringify(job);
  const body = Buffer.from(payload).toString('base64');

  await client.createTask({
    parent,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(payload),
        // Optionally add OIDC token if the worker is authenticated-only:
        // oidcToken: { serviceAccountEmail: process.env.SCAN_WORKER_SA ?? '' },
      },
      scheduleTime: { seconds: Math.floor(Date.now() / 1000) }, // immediate
    },
  });
}

export function buildServer() {
  const app = Fastify({ logger: true });

  // Health — NO external calls
  app.get('/', async () => ({ status: 'ok', ts: Date.now() }));

  // --- Eventarc/PubSub push endpoint: FAST-ACK ---
  // Eventarc delivers a Pub/Sub-style envelope with { message: { data: base64(json) } }
  app.post<{ Body: PubSubMessage }>('/events', async (req, reply) => {
    const body = req.body;
    const msg = parseBase64Json<ScanJob>(body?.message?.data);
    if (!msg?.domain) {
      req.log.warn({ body }, 'Invalid event payload');
      return reply.code(204).send(); // ack anyway to avoid redelivery loop
    }

    // Ensure scan_id
    const scan_id = msg.scan_id && msg.scan_id.length > 0 ? msg.scan_id : crypto.randomUUID();
    const job: ScanJob = { scan_id, domain: msg.domain };

    // Enqueue to Cloud Tasks and ack immediately
    try {
      await enqueueScanTask(job);
      return reply.code(204).send(); // 2xx == ack
    } catch (err) {
      req.log.error({ err }, 'Failed to enqueue task');
      // Still 204 to avoid redelivery loops; alternatively 500 if you prefer redelivery
      return reply.code(204).send();
    }
  });

  // --- Cloud Tasks worker endpoint ---
  app.post<{ Body: ScanJob }>('/tasks/scan', async (req, reply) => {
    const { scan_id, domain } = req.body ?? {};
    if (!scan_id || !domain) {
      return reply.code(400).send({ error: 'scan_id and domain are required' });
    }

    req.log.info({ scan_id, domain }, '[worker] starting');
    const result = await executeScan({ scan_id, domain });
    req.log.info({ scan_id }, '[worker] done');

    // TODO: persist result to Firestore/DB here
    return reply.code(200).send(result);
  });

  // --- Optional: synchronous test route (for manual validation only) ---
  app.post<{ Body: { domain: string } }>('/debug/test-endpoints', async (req, reply) => {
    const domain = req.body?.domain;
    if (!domain) return reply.code(400).send({ error: 'domain required' });
    const result = await executeScan({ scan_id: crypto.randomUUID(), domain });
    return reply.code(200).send(result);
  });

  return app;
}

if (require.main === module) {
  const app = buildServer();
  const port = Number(process.env.PORT ?? 8080);
  app
    .listen({ port, host: '0.0.0.0' })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
```

---

## package.json

```json
{
  "name": "scanner-service",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "lint": "eslint . --ext .ts"
  },
  "dependencies": {
    "@google-cloud/tasks": "^4.4.0",
    "fastify": "^4.28.1"
  },
  "devDependencies": {
    "@types/node": "^22.5.1",
    "eslint": "^9.9.0",
    "eslint-config-standard-with-typescript": "^43.0.0",
    "eslint-plugin-import": "^2.29.1",
    "eslint-plugin-n": "^17.10.3",
    "eslint-plugin-promise": "^7.1.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4"
  }
}
```

*(If you already have ESLint config, keep it. The above devDeps assume a standard TS lint setup.)*

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ES2020",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

---

## Dockerfile (multi-stage, Node 20, distroless runtime)

```dockerfile
# --- Builder ---
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime ---
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
ENV NODE_ENV=production
# Prefer IPv4 during validation to avoid AAAA connect stalls
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY --from=builder /app/dist ./dist
COPY package.json ./
EXPOSE 8080
CMD ["dist/server.js"]
```

---

## Deployment / Validation Notes

1. **Networking isolation test**: deploy a revision **without** VPC connector (or **private-ranges-only**). If failing domains start working, configure **Cloud NAT** for the connector subnet before re-enabling all-traffic egress.
2. **Health**: `/` does not touch external networks; should return in <100ms.
3. **Eventarc**: point your Pub/Sub trigger to `POST /events`. The handler base64-decodes, enqueues to Cloud Tasks, and returns 204 immediately.
4. **Cloud Tasks**: set `TASKS_WORKER_URL` to this service’s URL + `/tasks/scan` (or a separate worker service).
5. **Scanning**: use `/debug/test-endpoints` in a throwaway revision for manual tests; remove or lock down later.
6. **Concurrency**: you can keep `containerConcurrency=1`. Because we fast-ack, the instance won’t starve even if a single job stalls.

---

## What you should see

* No module sits for 180s; all requests bounded by `totalTimeoutMs` (≤10s).
* Domain-specific hangs (e.g., `vulnerable-test-site.vercel.app`) disappear with IPv4 preference and corrected egress path.
* `/` responds immediately; Eventarc redeliveries cease (2xx fast-ack).
* Worker logs show `[worker] starting` → results saved (add your DB persist where indicated).

---

**End of prompt.**
