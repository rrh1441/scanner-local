# Frontend Connection Guide - GCP Scanner API

## Overview
This document provides the complete integration guide for connecting your Vercel-hosted frontend to the GCP Cloud Run scanner API.

## API Base URL
```
https://scanner-api-242181373909.us-central1.run.app
```

## 🚨 CRITICAL: Authentication Setup Required

### Current Issue
Your GCP organization has a policy that blocks service account key creation:
```
ERROR: Key creation is not allowed on this service account.
constraints/iam.disableServiceAccountKeyCreation
```

### Solutions (Choose One):

#### Option A: Request Org Policy Exception (Recommended)
Contact your GCP administrator to temporarily disable the service account key creation restriction for this project.

#### Option B: Use Different GCP Project
Create a new GCP project without the key creation restriction.

#### Option C: Move Frontend to Cloud Run
Deploy your frontend to Cloud Run to use automatic service account authentication.

---

## Authentication Implementation

### Step 1: Create Service Account (After Policy Fix)
```bash
# Create service account for frontend
gcloud iam service-accounts create frontend-api-client \
    --display-name="Frontend API Client" \
    --project=precise-victory-467219-s4

# Grant API access permissions
gcloud run services add-iam-policy-binding scanner-api \
    --region=us-central1 \
    --member="serviceAccount:frontend-api-client@precise-victory-467219-s4.iam.gserviceaccount.com" \
    --role="roles/run.invoker" \
    --project=precise-victory-467219-s4

# Create service account key
gcloud iam service-accounts keys create frontend-key.json \
    --iam-account=frontend-api-client@precise-victory-467219-s4.iam.gserviceaccount.com \
    --project=precise-victory-467219-s4
```

### Step 2: Vercel Environment Variables
Add these to your Vercel project settings:

| Variable | Value |
|----------|-------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Complete contents of `frontend-key.json` file |
| `SCANNER_API_URL` | `https://scanner-api-242181373909.us-central1.run.app` |

### Step 3: Install Dependencies
```bash
npm install google-auth-library
```

### Step 4: Create Auth Helper
Create `lib/auth.js`:
```javascript
import { GoogleAuth } from 'google-auth-library';

let auth;

export async function getAccessToken() {
  if (!auth) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
  }
  
  const client = await auth.getClient();
  const accessTokenResponse = await client.getAccessToken();
  return accessTokenResponse.token;
}

export async function makeAuthenticatedRequest(url, options = {}) {
  const token = await getAccessToken();
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}
```

---

## API Endpoints

### 1. Create New Scan
**POST** `/scan`

```javascript
import { makeAuthenticatedRequest } from '../lib/auth';

export async function createScan(companyName, domain, tags = []) {
  const response = await makeAuthenticatedRequest(
    `${process.env.SCANNER_API_URL}/scan`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        companyName,
        domain,
        tags
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Scan creation failed: ${error}`);
  }
  
  return response.json();
}
```

**Response Format:**
```json
{
  "scanId": "abc123def456",
  "status": "queued",
  "companyName": "Example Company",
  "domain": "example.com",
  "originalDomain": "https://example.com",
  "message": "Scan started successfully"
}
```

### 2. Check Scan Status
**GET** `/scan/:scanId/status`

```javascript
export async function getScanStatus(scanId) {
  const response = await makeAuthenticatedRequest(
    `${process.env.SCANNER_API_URL}/scan/${scanId}/status`
  );
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // Scan not found
    }
    throw new Error(`Status check failed: ${response.status}`);
  }
  
  return response.json();
}
```

**Response Format:**
```json
{
  "scanId": "abc123def456",
  "scan_id": "abc123def456",
  "company_name": "Example Company",
  "domain": "example.com",
  "original_domain": "https://example.com",
  "tags": ["api-test"],
  "status": "completed",
  "created_at": "2025-08-01T20:00:00.000Z",
  "updated_at": "2025-08-01T20:05:30.000Z"
}
```

**Status Values:**
- `queued` - Scan is waiting to start
- `processing` - Scan is currently running
- `completed` - Scan finished successfully
- `failed` - Scan encountered an error

### 3. Get Scan Findings
**GET** `/scan/:scanId/findings`

```javascript
export async function getScanFindings(scanId) {
  const response = await makeAuthenticatedRequest(
    `${process.env.SCANNER_API_URL}/scan/${scanId}/findings`
  );
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // No findings found
    }
    throw new Error(`Findings retrieval failed: ${response.status}`);
  }
  
  return response.json();
}
```

### 4. Get Raw Artifacts
**GET** `/scan/:scanId/artifacts`

```javascript
export async function getScanArtifacts(scanId) {
  const response = await makeAuthenticatedRequest(
    `${process.env.SCANNER_API_URL}/scan/${scanId}/artifacts`
  );
  
  return response.ok ? response.json() : null;
}
```

### 5. Health Check
**GET** `/health`

```javascript
export async function checkAPIHealth() {
  const response = await makeAuthenticatedRequest(
    `${process.env.SCANNER_API_URL}/health`
  );
  
  return response.json();
}
```

**Response Format:**
```json
{
  "status": "healthy",
  "pubsub": "connected",
  "firestore": "connected",
  "timestamp": "2025-08-01T20:00:00.000Z"
}
```

### 6. Bulk Scan Creation
**POST** `/scan/bulk`

```javascript
export async function createBulkScans(companies) {
  const response = await makeAuthenticatedRequest(
    `${process.env.SCANNER_API_URL}/scan/bulk`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        companies: companies.map(c => ({
          companyName: c.name,
          domain: c.domain,
          tags: c.tags || []
        }))
      })
    }
  );
  
  return response.json();
}
```

---

## Complete API Client Implementation

Create `lib/scanner-api.js`:
```javascript
import { makeAuthenticatedRequest } from './auth';

const API_BASE = process.env.SCANNER_API_URL;

class ScannerAPI {
  async createScan(companyName, domain, tags = []) {
    const response = await makeAuthenticatedRequest(`${API_BASE}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, domain, tags })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Scan creation failed: ${error}`);
    }
    
    return response.json();
  }
  
  async getScanStatus(scanId) {
    const response = await makeAuthenticatedRequest(`${API_BASE}/scan/${scanId}/status`);
    return response.ok ? response.json() : null;
  }
  
  async getScanFindings(scanId) {
    const response = await makeAuthenticatedRequest(`${API_BASE}/scan/${scanId}/findings`);
    return response.ok ? response.json() : null;
  }
  
  async getScanArtifacts(scanId) {
    const response = await makeAuthenticatedRequest(`${API_BASE}/scan/${scanId}/artifacts`);
    return response.ok ? response.json() : null;
  }
  
  async createBulkScans(companies) {
    const response = await makeAuthenticatedRequest(`${API_BASE}/scan/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies })
    });
    
    return response.json();
  }
  
  async checkHealth() {
    const response = await makeAuthenticatedRequest(`${API_BASE}/health`);
    return response.json();
  }
  
  // Polling helper for scan completion
  async waitForScanCompletion(scanId, timeoutMs = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getScanStatus(scanId);
      
      if (!status) {
        throw new Error('Scan not found');
      }
      
      if (status.status === 'completed') {
        return status;
      }
      
      if (status.status === 'failed') {
        throw new Error('Scan failed');
      }
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    throw new Error('Scan timeout');
  }
}

export const scannerAPI = new ScannerAPI();
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/scan` | 10 requests | Per minute |
| `/scan/bulk` | 2 requests | Per minute |
| `/scan/:id/status` | 60 requests | Per minute |
| All others | 100 requests | Per minute |

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

**400 Bad Request:**
```json
{
  "error": "Invalid domain format",
  "details": ["Domain is required"],
  "suggestion": "Expected format: 'example.com'"
}
```

**404 Not Found:**
```json
{
  "error": "Scan not found"
}
```

**429 Rate Limited:**
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 60000ms",
  "expiresIn": 60000
}
```

### Error Handling Example
```javascript
try {
  const scan = await scannerAPI.createScan("Test Company", "example.com");
  console.log("Scan created:", scan.scanId);
} catch (error) {
  if (error.message.includes('Rate limit')) {
    // Handle rate limiting
    console.log("Rate limited, waiting...");
  } else if (error.message.includes('Invalid domain')) {
    // Handle validation error
    console.log("Invalid domain provided");
  } else {
    // Handle other errors
    console.error("Scan creation failed:", error.message);
  }
}
```

---

## Migration from Fly.io

### Changes Required:

1. **Update Base URL:**
   - Old: `https://your-fly-app.fly.dev`
   - New: `https://scanner-api-242181373909.us-central1.run.app`

2. **Update Authentication:**
   - Old: Fly.io API tokens
   - New: Google Cloud service account tokens

3. **Update Response Handling:**
   - New GCP API may have slightly different response formats
   - Check all field names in responses

4. **Update Error Handling:**
   - GCP returns different error formats
   - Update error parsing logic

---

## Testing

### Test API Connection:
```javascript
import { scannerAPI } from './lib/scanner-api';

async function testConnection() {
  try {
    const health = await scannerAPI.checkHealth();
    console.log("API Health:", health);
    
    const scan = await scannerAPI.createScan(
      "Test Company", 
      "httpbin.org", 
      ["test"]
    );
    console.log("Test scan created:", scan.scanId);
    
    // Wait for completion
    const completed = await scannerAPI.waitForScanCompletion(scan.scanId);
    console.log("Scan completed:", completed);
    
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}
```

---

## Next Steps

1. **🚨 FIRST: Fix service account key creation policy**
2. Create service account and download key
3. Add environment variables to Vercel
4. Install dependencies and implement auth helper
5. Update all API calls to use new endpoints
6. Test thoroughly with your existing frontend code
7. Deploy and monitor for any issues

---

## Support

If you encounter issues:
1. Check Vercel environment variables are set correctly
2. Verify service account has `roles/run.invoker` permission
3. Check API logs: `gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="scanner-api"' --project=precise-victory-467219-s4 --limit=20`
4. Test authentication with curl: `curl -H "Authorization: Bearer $(gcloud auth print-access-token)" https://scanner-api-242181373909.us-central1.run.app/health`