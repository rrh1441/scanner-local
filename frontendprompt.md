⏺ Frontend Development Prompt - Dealbrief Scanner Repository

  Project Context

  Build this frontend within the existing dealbrief-scanner repository structure,
  leveraging the current GCP infrastructure and API services.

  Repository Structure

  dealbrief-scanner/
  ├── apps/
  │   ├── api-main/          # Existing GCP API service
  │   ├── workers/           # Existing scanner workers
  │   └── frontend/          # NEW - Your frontend app
  ├── packages/              # Shared utilities (if needed)
  └── ...

  Technical Stack & Integration

  Use Existing Infrastructure

  - API Base URL: Use the deployed service at
  https://scanner-api-242181373909.us-central1.run.app
  - Authentication: Integrate with existing
  scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com
  - GCP Project: precise-victory-467219-s4
  - Database: Existing Firestore collections (scans, findings data)

  Framework Setup

  # From repo root
  cd apps/
  npx create-next-app@latest frontend --typescript --tailwind --eslint --app
  cd frontend
  npm install @google-cloud/firestore google-auth-library
  npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu lucide-react
  npm install @tanstack/react-query @tanstack/react-table

  Monorepo Integration

  Update root package.json scripts:
  {
    "scripts": {
      "dev:frontend": "pnpm --filter @dealbrief/frontend dev",
      "build:frontend": "pnpm --filter @dealbrief/frontend build",
      "dev:all": "concurrently \"pnpm dev:api\" \"pnpm dev:workers\" \"pnpm 
  dev:frontend\""
    }
  }

  API Integration - Use Existing Endpoints

  Reference the actual API implementation from apps/api-main/server.ts:

  Available Endpoints:
  - POST /scan - Create single scan (lines 212-293)
  - POST /scans - Alias endpoint (lines 296-378)
  - POST /scan/bulk - Bulk scan creation (lines 456-558)
  - POST /scan/csv - CSV upload (lines 564-705)
  - GET /scan/:scanId/status - Scan status (lines 381-395)
  - GET /scan/:scanId/findings - Scan findings (lines 427-453)
  - GET /scan/:scanId/artifacts - Raw artifacts (lines 398-424)
  - GET /health - API health check (lines 207-209)

  Authentication Implementation

  Create apps/frontend/lib/auth.ts:
  // Use the same authentication approach as the API
  import { GoogleAuth } from 'google-auth-library';

  // For Cloud Run deployment - automatic service account
  export async function getAccessToken(): Promise<string> {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const accessTokenResponse = await client.getAccessToken();

    if (!accessTokenResponse.token) {
      throw new Error('Failed to get access token');
    }

    return accessTokenResponse.token;
  }

  Data Models - Match Existing Schema

  Based on the API implementation (apps/api-main/server.ts lines 66-84):

  // Match Firestore schema from createScanRecord()
  interface Scan {
    scan_id: string;      // matches Firestore field
    company_name: string; // matches Firestore field  
    domain: string;
    original_domain: string;
    tags: string[];
    status: 'queued' | 'processing' | 'completed' | 'failed';
    created_at: string;   // ISO string
    updated_at: string;   // ISO string
  }

  Environment Configuration

  apps/frontend/.env.local:
  SCANNER_API_URL=https://scanner-api-242181373909.us-central1.run.app
  GOOGLE_CLOUD_PROJECT=precise-victory-467219-s4
  NODE_ENV=production

  Deployment Configuration

  apps/frontend/Dockerfile:
  FROM node:18-alpine
  WORKDIR /app

  # Copy workspace files
  COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
  COPY apps/frontend/package.json ./apps/frontend/

  # Install dependencies
  RUN npm install -g pnpm
  RUN pnpm install --filter @dealbrief/frontend

  # Copy frontend source
  COPY apps/frontend ./apps/frontend

  # Build
  RUN pnpm --filter @dealbrief/frontend build

  # Expose and start
  EXPOSE 3000
  WORKDIR /app/apps/frontend
  CMD ["pnpm", "start"]

  Integration with Existing Services

  Firestore Integration - Reference existing collections:
  // apps/frontend/lib/firestore.ts
  import { Firestore } from '@google-cloud/firestore';

  const firestore = new Firestore({
    projectId: 'precise-victory-467219-s4'
  });

  // Use existing collections from workers
  export const scansCollection = firestore.collection('scans');
  export const findingsCollection = firestore.collection('findings'); // if exists

  Development Workflow

  Run everything locally:
  # From repo root
  pnpm dev:all  # Runs API, workers, and frontend together

  Deploy frontend to Cloud Run:
  # From repo root
  gcloud builds submit apps/frontend \
    --tag
  us-central1-docker.pkg.dev/precise-victory-467219-s4/dealbrief/scanner-frontend

  gcloud run deploy scanner-frontend \
    --image
  us-central1-docker.pkg.dev/precise-victory-467219-s4/dealbrief/scanner-frontend
  \
    --service-account
  scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com \
    --allow-unauthenticated \
    --region us-central1 \
    --project precise-victory-467219-s4

  Package.json for Frontend

  apps/frontend/package.json:
  {
    "name": "@dealbrief/frontend",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "dev": "next dev -p 3001",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
    },
    "dependencies": {
      "next": "14.0.0",
      "@google-cloud/firestore": "^7.1.0",
      "google-auth-library": "^9.0.0",
      "@tanstack/react-query": "^5.0.0",
      "@tanstack/react-table": "^8.0.0"
    }
  }

  Reference Existing Code Patterns

  Look at existing patterns in:
  - apps/api-main/server.ts - API response formats
  - apps/workers/worker.ts - Scan processing logic
  - Root package.json - Monorepo script patterns

  Integration Points

  1. Use existing API directly - no need to duplicate authentication logic
  2. Monitor scans via existing Firestore - watch the same collections the workers
   use
  3. Leverage existing GCP setup - same project, service accounts, regions
  4. Match existing data formats - use the same field names and structures

  Build the frontend to complement the existing scanner infrastructure, not 
  replace it.