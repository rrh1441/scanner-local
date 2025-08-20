It is entirely practical—and officially supported—to host your frontend on Vercel while running the backend on Google Cloud. The two platforms communicate over standard HTTPS, so the only things you need to solve are (1) network exposure / authentication and (2) browser CORS rules. Below is the minimal, production-grade approach.

---

### 1.  Expose the Google Cloud service

| Option                                                  | When to use                                                    | Key setup steps                                                                                                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public Cloud Run / Cloud Functions endpoint**         | Quickest path; auth handled at app layer (e.g. JWT or API key) | • Deploy container/function<br>• Set ingress **all** and “allow unauthenticated”<br>• Map `api.example.com` via Cloud Run domain-mapping or HTTPS LB                               |
| **Private Cloud Run with Workload Identity + IAP/OIDC** | You want Google-managed auth and to avoid long-lived secrets   | • Enable Workload Identity Federation in the GCP project<br>• Add Vercel as an OIDC provider and bind it to a service account<br>• Require authentication on the Cloud Run service |

Vercel publishes first-class instructions for the federation flow; after you create a Workload Identity Pool and provider, you export short-lived credentials inside any Vercel Serverless / Edge Function at runtime ([Vercel][1]).

---

### 2.  Handle CORS correctly

If you call the API **from the browser**, Cloud Run must add CORS headers:

```js
// example index.js for Cloud Run
import express from 'express';
const app = express();

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', 'https://frontend.example'); // tighten in prod
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/ping', (req, res) => res.json({status: 'ok'}));

const port = process.env.PORT || 8080;
app.listen(port);
```

Google’s docs show the same pattern in multiple languages; the key is to reply `204` on the pre-flight `OPTIONS` request and include `Access-Control-Allow-Origin` ([Google Cloud][2]).

> **Gotcha:** if you enforce Cloud Run/IAP authentication, pre-flight `OPTIONS` requests arrive **without** the `Authorization` header, so they will be rejected unless you either (a) allow unauthenticated for `OPTIONS` only or (b) use IAP, which injects the header for you ([Google Cloud][2]).

If the call happens **server-side** (e.g. inside a Vercel Route Handler or `getServerSideProps`) CORS is irrelevant because the browser is not involved; prefer this for sensitive operations.

---

### 3.  Wire the Vercel frontend

1. **Environment variables**

   ```bash
   # in Vercel Project Settings → Environment
   API_URL=https://api.example.com   # public URL of Cloud Run service
   ```

2. **Fetch in Next.js (Edge Runtime or Node Runtime):**

   ```ts
   export async function GET() {
     const res = await fetch(`${process.env.API_URL}/ping`, {cache: 'no-store'});
     return Response.json(await res.json());
   }
   ```

   If you used Workload Identity, call `getVercelOidcToken()` (as in the official example) to obtain an identity token and attach it in the `Authorization` header ([Vercel][1]).

3. **Local testing**
   Run `vercel dev` with `API_URL` pointed at the Cloud Run revision URL (or an emulator such as `functions-framework`).

---

### 4.  Operational considerations

* **Latency:** Put Cloud Run in a region near your primary user base; Vercel’s edge network will fetch from that region only on cache misses.
* **Scaling & cold starts:** Cloud Run auto-scales on concurrent request count; set min instances > 0 if your SLA cannot tolerate a first-request cold start.
* **Secrets:** Never hard-code service-account keys in Vercel. Use Workload Identity Federation so Vercel never stores credentials.
* **Observability:**

  * Cloud Run → Cloud Logging + Cloud Trace.
  * Vercel → `vercel analytics` and per-deployment logs.
    Correlate with a trace header (`X-Cloud-Trace-Context`) if needed.
* **CI/CD:** Let Vercel continue to deploy the frontend; use Cloud Build or GitHub Actions for the backend. They do not interfere with each other.

---

### 5.  Why Claude’s statement is incorrect

Nothing in Vercel’s architecture prevents outbound HTTPS calls, nor is Google Cloud limited to Google-hosted frontends. The combination is commonplace:

* Vercel OIDC federation → GCP (short-lived, rotation-free credentials) ([Vercel][1])
* Standard CORS handling on Cloud Run/Functions ([Google Cloud][2])

Provided you apply the steps above, a Vercel-hosted Next.js app will work with any GCP backend—public or private—without special work-arounds.

[1]: https://vercel.com/docs/oidc/gcp "Connect to Google Cloud Platform (GCP)"
[2]: https://cloud.google.com/run/docs/write-http-functions "Write HTTP Cloud Run functions  |  Cloud Run Documentation  |  Google Cloud"
