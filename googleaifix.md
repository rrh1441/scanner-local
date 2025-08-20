Excellent. Replacing the active `dbPortScan` with the passive `shodan` module is a smart architectural decision, especially for your goal of a high-speed initial scan. It dramatically reduces scan time and your direct interaction with the target's infrastructure.

I have re-evaluated the entire system with this change in mind. Your custom modules for DNS, TLS, email, and credential checks are indeed robust. The core issue remains in the integration and data flow between these powerful, specialized modules.

Here is a comprehensive set of recommendations to get your system working effectively, reflecting the new Shodan-centric approach.

---

### **High-Level Impact of Your Change**

First, let's acknowledge the impact of swapping `dbPortScan` for `shodan`.

*   **Pro: Massive Speed Gain.** You've replaced active `nmap` scans (seconds to minutes per host) with a single, fast API query to Shodan's pre-compiled data. This is a huge win for your <5 minute goal.
*   **Pro: Increased Stealth.** Your scanner is no longer actively port-scanning database ports, reducing its "noise" and making it less likely to be blocked or detected.
*   **Con: Loss of Deep Verification.** You lose the ability to perform deep checks that `nmap` provided, such as verifying default credentials (`mysql-empty-password`) or enumerating databases. This is an acceptable trade-off for a fast, Tier-1 scan.
*   **New Requirement:** The `shodan` module is now critically dependent on having a comprehensive list of the target's IP addresses. The system must be able to provide this.

### **Revised High-Speed Workflow**

With Shodan replacing the active database scan, your new ideal workflow looks like this:

```mermaid
graph TD
    A[Start Scan] --> B(Phase 1: Parallel Discovery);
    
    subgraph Phase 1: Foundational OSINT (0-2 minutes)
        B --> C[runEndpointDiscovery];
        B --> D[runDnsTwist];
        B --> E[runDocumentExposure];
        B --> F[runTlsScan];
        B --> G[runSpfDmarc];
        B --> H(dnsResolver.ts);
    end

    I(Phase 2: External Asset & Credential Analysis) --> J[runShodanScan];
    I --> K[runBreachDirectoryProbe];

    H --> J;
    
    L(Phase 3: Vulnerability & Secret Analysis) --> M[runTrufflehog];
    L --> N[runTechStackScan & runNuclei];

    C --> M;
    D --> K;
    I --> L;
    
    P(End Scan)
    L --> P;
```

---

### **Comprehensive Recommendations**

Here are the step-by-step recommendations to fix your system and align it with this new workflow.

#### **Step 1: Fix the Foundation (System-Breaking Issues)**

These are unchanged from the previous analysis but remain the **absolute highest priority**. The rest of the system cannot function until these are fixed.

1.  **Fix the Queue Authentication (`401 Unauthorized`):**
    *   **Problem:** Your `api` process cannot start `scanner_worker` machines because its `FLY_API_TOKEN` is invalid.
    *   **Action:** Regenerate your Fly.io API token and update your app's secret: `fly secrets set FLY_API_TOKEN="..."`. Restart the `api` machine.

2.  **Make the Queue Reliable:**
    *   **Problem:** Your current `rpop` implementation can lose jobs if a worker crashes.
    *   **Action:** Switch to a reliable queue pattern. I strongly recommend using **BullMQ**, as it handles job persistence, retries, and atomicity for you. A manual fix would involve using `RPOPLPUSH` to move jobs to a worker-specific processing list.

3.  **Fix Critical Security Vulnerabilities:**
    *   **Problem:** You have a Command Injection vulnerability in `securityWrapper.ts` and an SQL Injection vulnerability in `nvdMirror.ts`.
    *   **Action:**
        *   In `securityWrapper.ts`, refactor to use `execFile` and pass arguments as an array, not a single string.
        *   In `nvdMirror.ts`, replace the `sqlite3` shell commands with a proper Node.js library like `better-sqlite3` that uses parameterized queries. This is non-negotiable for security.

---

#### **Step 2: Re-architect the Data Flow for the New Workflow**

This is where we address the new architecture with Shodan and fix the broken integrations.

1.  **Create a `dnsResolver.ts` Module (Crucial Missing Link):**
    *   **Problem:** Your `shodan` module needs IP addresses to query. Your other modules primarily find domains (`dnsTwist`) or URLs (`endpointDiscovery`). You need a dedicated module to resolve these hostnames to IPs.
    *   **Action:** Create a new, fast `dnsResolver.ts` module. Its only job is to:
        1.  Query the database for all `hostname` and `subdomain` artifacts created by other modules.
        2.  For each hostname, perform a DNS `A` and `AAAA` record lookup.
        3.  For each IP found, create a new `ip_address` artifact in the database.
    *   **Impact:** This provides the necessary input for `runShodanScan` to work effectively.

2.  **Fix `trufflehog.ts` Data Sources:**
    *   **Problem:** `trufflehog` is still looking for a non-existent `spiderfoot-links.json` file and is not scanning the assets discovered by your other powerful modules.
    *   **Action:**
        1.  **Remove the File Logic:** Delete the entire `try...catch` block that attempts to read `/tmp/spiderfoot-links-${scanId}.json`.
        2.  **Scan Web Assets:** Implement the logic to query the database for `discovered_web_assets` and `exposed_document` artifacts. For each asset, write its content to a temporary file and run `trufflehog filesystem <temp_file>`. This connects it to `endpointDiscovery` and `documentExposure`.
        3.  **Find and Scan Git Repos:** Create a simple `gitRepoFinder.ts` module (as described in the last response) that uses the GitHub/GitLab APIs to find public repos for the target company. Have it create a `discovered_git_repos` artifact. Then, have `trufflehog` query for that artifact and scan the URLs.

3.  **Fix the `dbPortScan` -> `trufflehog` -> `shodan` Data Flow:**
    *   **Problem:** The old logic was designed for `trufflehog` to feed database credentials to `dbPortScan`. This chain is now broken.
    *   **Action:** The logic in `trufflehog.ts` (`parseSecretIntoTargets`) that creates `db_service_target` artifacts is now obsolete. You can **remove this function**. Shodan handles the service discovery part now. The secret-finding part of `trufflehog` is still highly valuable on its own.

---

#### **Step 3: Enhance Your Modules for Maximum Impact**

Now that the system is functional, here’s how to make it even better.

1.  **Enhance `shodan.ts` to be Smarter:**
    *   **Problem:** The current module creates generic `EXPOSED_SERVICE` findings.
    *   **Action:** Add logic to `persistMatch` in `shodan.ts` to recognize high-risk services.
        *   Check the port against a list of critical ports (e.g., 3389 for RDP, 23 for Telnet, 5900 for VNC).
        *   Check the product name for ICS/OT keywords (`modbus`, `mqtt`, `scada`).
        *   If a high-risk service is found, create a finding with **`CRITICAL`** severity and a specific type like `EXPOSED_RDP_SERVICE` or `CRITICAL_ICS_PROTOCOL_EXPOSED`. This provides immediate, actionable intelligence.

2.  **Enhance `endpointDiscovery.ts` (Your Crown Jewel):**
    *   **You are right, this module is better than SpiderFoot for its task.** Let's make it best-in-class.
    *   **Action 1 (AST Parsing):** Integrate a JavaScript AST parser (like `acorn`) to find API endpoints defined in JS code. This is far more reliable than regex and will give you a huge advantage in mapping modern web apps.
    *   **Action 2 (API Schema Parsing):** When you find an `openapi.json` or `swagger.json` file, parse it. This will give you a complete and accurate map of the API surface, which is invaluable.
    *   **Action 3 (Dynamic Wordlist):** Make your brute-force wordlist dynamic. Scrape keywords from the target's homepage and add them to your brute-force list to find custom, non-obvious endpoints.

---

### **Summary of Actions**

1.  **Fix the Queue & Security:** Address the `FLY_API_TOKEN`, queue reliability, and the Injection vulnerabilities first. **The system is down until you do.**
2.  **Create `dnsResolver.ts`:** This is the new critical link to feed your `shodan` module with IPs.
3.  **Refactor `trufflehog.ts`:** Remove the dependency on the non-existent SpiderFoot file. Make it consume web asset artifacts from your other modules and repo URLs from a new `gitRepoFinder` module.
4.  **Enhance `shodan.ts`:** Add logic to identify and flag high-risk services like RDP and ICS protocols with `CRITICAL` severity.
5.  **Supercharge `endpointDiscovery.ts`:** Implement AST parsing and API schema discovery to make it even more powerful.

By following this plan, you will have a truly robust, fast, and customized scanning engine that leverages the best of your custom modules and works together as a cohesive system.

Of course. My apologies for not providing enough detail on the custom modules. You are correct that your system is designed to be a faster, more tailored alternative to SpiderFoot, and my recommendations should reflect that.

Let's do a deep dive into the `gitRepoFinder.ts` module. This is a critical component that was missing from your workflow, and implementing it correctly is key to making your `trufflehog` scanner effective.

The purpose of this module is to **find public code repositories** associated with your target company. It's a focused OSINT module that replaces the part of SpiderFoot that `trufflehog` was depending on.

---

### **Module Enumeration: `gitRepoFinder.ts`**

This module will be responsible for querying code hosting platforms (initially GitHub) to find relevant repositories.

#### **1. Core Logic and Functionality**

1.  **Input:** It takes the `companyName` and `scanId` as input.
2.  **Authentication:** It uses a GitHub Personal Access Token (PAT) provided via the `GITHUB_TOKEN` environment variable to make authenticated API requests, which provides a much higher rate limit than anonymous requests.
3.  **Search Strategy:** It employs a multi-pronged search strategy to find repositories with high confidence, moving from specific to broad:
    *   **High-Confidence Search:** It first searches for repositories owned by a GitHub organization that exactly matches the company's name (`org:YourCompanyName`). This is the most reliable signal.
    *   **Broad Search:** It then performs a general search for repositories that contain the company name in their name or description. This casts a wider net but may include forks or unrelated projects.
    *   **(Future Enhancement):** It could be extended to search for code that mentions the company's domain, though this is often very noisy.
4.  **Deduplication:** It aggregates the results from all search strategies and removes duplicate repository URLs.
5.  **Output:** Instead of writing to a temporary file (which is fragile), it creates a single, structured artifact of type `discovered_git_repos` in your PostgreSQL database. This artifact contains the list of found repository URLs.

#### **2. Complete Code (`gitRepoFinder.ts`)**

Here is the complete, ready-to-use TypeScript code for the module.

```typescript
// apps/workers/modules/gitRepoFinder.ts

import axios from 'axios';
import { insertArtifact } from '../core/artifactStore.js';
import { log } from '../core/logger.js';

// --- Configuration ---
const GITHUB_API_BASE = 'https://api.github.com';
const MAX_REPOS_PER_QUERY = 20; // Limit results to keep scans fast

interface GitRepoFinderJob {
  companyName: string;
  domain: string;
  scanId: string;
}

interface GitHubRepo {
  html_url: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
}

/**
 * Executes a search query against the GitHub API.
 * @param query - The search query string.
 * @param token - The GitHub API token.
 * @returns A list of repository URLs.
 */
async function searchGitHub(query: string, token: string): Promise<string[]> {
  try {
    const url = `${GITHUB_API_BASE}/search/repositories`;
    log(`[gitRepoFinder] Querying GitHub: ${query}`);
    
    const response = await axios.get(url, {
      params: {
        q: query,
        per_page: MAX_REPOS_PER_QUERY,
        sort: 'stars',
        order: 'desc'
      },
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DealBrief-Scanner-v1.0'
      },
      timeout: 15000 // 15-second timeout
    });

    const repos: GitHubRepo[] = response.data.items || [];
    return repos.map(repo => repo.html_url);

  } catch (error) {
    const axiosError = error as any;
    if (axiosError.response) {
      log(`[gitRepoFinder] GitHub API error (status: ${axiosError.response.status}):`, axiosError.response.data);
    } else {
      log('[gitRepoFinder] GitHub request error:', axiosError.message);
    }
    return [];
  }
}

/**
 * Main function to find Git repositories for a target company.
 * @param job - The scan job containing companyName, domain, and scanId.
 * @returns The number of unique repositories found.
 */
export async function runGitRepoFinder(job: GitRepoFinderJob): Promise<number> {
  const { companyName, scanId } = job;
  log(`[gitRepoFinder] Starting repository discovery for "${companyName}"`);

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    log('[gitRepoFinder] WARNING: GITHUB_TOKEN is not set. Skipping repository discovery.');
    await insertArtifact({
      type: 'scan_warning',
      val_text: 'GitHub repository scan skipped - GITHUB_TOKEN not configured',
      severity: 'LOW',
      meta: { scan_id: scanId, module: 'gitRepoFinder' },
    });
    return 0;
  }

  // Define search queries: from high-confidence to broad
  const queries = [
    `org:"${companyName}"`, // High-confidence: official organization
    `"${companyName}" in:name,description`, // Broad: name or description contains company name
  ];

  // Run all searches in parallel
  const searchPromises = queries.map(query => searchGitHub(query, token));
  const results = await Promise.allSettled(searchPromises);

  // Aggregate and deduplicate results
  const uniqueRepoUrls = new Set<string>();
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      result.value.forEach(url => uniqueRepoUrls.add(url));
    }
  });

  const repoUrls = Array.from(uniqueRepoUrls);
  
  if (repoUrls.length > 0) {
    log(`[gitRepoFinder] Found ${repoUrls.length} unique public repositories.`);
    // Create a single artifact containing all discovered repository URLs
    await insertArtifact({
      type: 'discovered_git_repos',
      val_text: `Found ${repoUrls.length} potential public Git repositories for "${companyName}"`,
      severity: 'INFO',
      meta: {
        scan_id: scanId,
        scan_module: 'gitRepoFinder',
        companyName,
        repos: repoUrls,
      }
    });
  } else {
    log(`[gitRepoFinder] No public repositories found for "${companyName}".`);
  }

  return repoUrls.length;
}
```

#### **3. Configuration and Setup**

1.  **Add to `fly.toml`:** If you want this to run as a separate process (which is not necessary if you orchestrate it in your main worker), you would add it there. For now, it's best to call it from your main worker logic.
2.  **Set `GITHUB_TOKEN` Secret:** This is critical. You need to generate a GitHub Personal Access Token with `public_repo` scope.
    *   Go to GitHub -> Settings -> Developer settings -> Personal access tokens.
    *   Generate a new token.
    *   Set it as a secret in your Fly.io app: `fly secrets set GITHUB_TOKEN="<your-github-pat>"`

#### **4. Integration with `trufflehog.ts`**

This is the most important part. You need to modify `trufflehog.ts` to use the output of this new module.

**File to Edit:** `apps/workers/modules/trufflehog.ts`

**Change this:**

```typescript
// --- OLD, FRAGILE CODE TO REMOVE ---
export async function runTrufflehog(job: { domain: string; scanId?: string }): Promise<number> {
  // ...
  try {
    const linksPath = `/tmp/spiderfoot-links-${job.scanId}.json`;
    log(`[trufflehog] Checking for SpiderFoot links file at: ${linksPath}`);
    // ... entire try/catch block for reading the file ...
    const linksFile = await fs.readFile(linksPath, 'utf8');
    const links = JSON.parse(linksFile) as string[];
    const gitRepos = links.filter(l => GITHUB_RE.test(l)).slice(0, MAX_GIT_REPOS_TO_SCAN);
    
    for (const repo of gitRepos) {
      totalFindings += await scanGit(repo, job.scanId);
    }
  } catch (error) {
    log(`[trufflehog] Unable to process SpiderFoot links file...`);
  }
  // ...
}
```

**To this:**

```typescript
// --- NEW, ROBUST CODE ---
import { pool } from '../core/artifactStore.js'; // Make sure pool is imported

// ... (other functions in trufflehog.ts remain the same) ...

/**
 * Scan discovered Git repositories from the gitRepoFinder module.
 */
async function scanDiscoveredGitRepos(scanId: string): Promise<number> {
  log('[trufflehog] [Git Scan] Querying for discovered Git repositories...');
  let findings = 0;

  try {
    const result = await pool.query(
      `SELECT meta FROM artifacts 
       WHERE type = 'discovered_git_repos' AND meta->>'scan_id' = $1 
       LIMIT 1`,
      [scanId]
    );

    if (result.rows.length === 0) {
      log('[trufflehog] [Git Scan] No discovered_git_repos artifact found.');
      return 0;
    }

    const repoUrls: string[] = result.rows[0].meta?.repos || [];
    log(`[trufflehog] [Git Scan] Found ${repoUrls.length} repositories to scan.`);

    for (const repoUrl of repoUrls) {
      findings += await scanGit(repoUrl, scanId);
    }
  } catch (error) {
    log('[trufflehog] [Git Scan] Database query for repos failed:', (error as Error).message);
  }

  return findings;
}


export async function runTrufflehog(job: { domain: string; scanId?: string }): Promise<number> {
  log('[trufflehog] Starting comprehensive secret scan for domain:', job.domain);
  if (!job.scanId) {
    log('[trufflehog] [ERROR] scanId is required for TruffleHog module.');
    return 0;
  }
  let totalFindings = 0;

  // Scan assets discovered by your custom web crawlers
  totalFindings += await scanDiscoveredWebAssets(job.scanId);
  totalFindings += await scanHighValueTargets(job.domain, job.scanId);

  // Scan Git repositories discovered by your new custom module
  totalFindings += await scanDiscoveredGitRepos(job.scanId);

  log('[trufflehog] Finished comprehensive secret scan for', job.domain, 'Total secrets found:', totalFindings);
  
  await insertArtifact({
    type: 'scan_summary',
    val_text: `TruffleHog scan completed: ${totalFindings} potential secrets found`,
    severity: 'INFO',
    meta: {
      scan_id: job.scanId,
      scan_module: 'trufflehog',
      total_findings: totalFindings,
      timestamp: new Date().toISOString()
    }
  });
  
  return totalFindings;
}
```

With these changes, you have successfully replaced a monolithic dependency with a fast, tailored, and integrated module that fits perfectly into your custom scanning architecture.