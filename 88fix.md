Of course. Here are the precise, actionable instructions for your agent to implement all three fixes.

Agent Instructions: Scanner Enhancements
Here are three distinct tasks to improve the scanner's performance, scalability, and risk-scoring accuracy.

Task 1: Implement "Warm Instance" for Consistent Performance
Objective: Configure the scanner-job Cloud Run Job to keep one instance warm at all times.

Reasoning: This will eliminate the 15-30 second cold start penalty for the first user after a period of inactivity and for the first user in a concurrent wave. It ensures the Tier 1 scan consistently meets its sub-60-second target, providing a reliable user experience.

Implementation Steps:

Execute the following gcloud command in your GCP Cloud Shell or any environment authenticated with the gcloud CLI for your project (precise-victory-467219-s4):
code
Bash

download

content_copy

expand_less
gcloud run jobs update scanner-job \
    --region=us-central1 \
    --min-instances=1
Validation:

After executing the command, verify the configuration by running:
code
Bash

download

content_copy

expand_less
gcloud run jobs describe scanner-job --region=us-central1 --format="yaml(spec.template.scaling.minInstanceCount)"
Confirm that the output is minInstanceCount: 1.
Task 2: Refactor assetCorrelator.ts for Scalability
Objective: Rework the assetCorrelator.ts module to process artifacts in batches from Firestore instead of loading the entire set into an in-memory buffer.

Reasoning: The current in-memory approach will cause the Cloud Run Job to crash with out-of-memory errors on scans of large targets that generate thousands of artifacts. This change is critical to ensure the reliability and scalability of the scanner.

Implementation Steps:

Modify assetCorrelator.ts: Open the file apps/workers/modules/assetCorrelator.ts.
Locate the correlateAssets function: This is the target for the refactor.
Remove In-Memory Buffering: Delete the artifactBuffer array and the initial database query that populates it.
Implement Batched Processing: Rewrite the function to query Firestore in a loop, processing one batch of artifacts at a time. Use Firestore's startAfter cursor for efficient pagination.
Code Blueprint for correlateAssets function:

code
TypeScript

download

content_copy

expand_less
// PSEUDO-CODE BLUEPRINT - ADAPT WITH YOUR FIRESTORE SDK
import { getFirestore } from 'firebase-admin/firestore';

async function correlateAssets(scanId: string, domain: string): Promise<void> {
    const db = getFirestore();
    const dnsCache = new DNSCache();
    const assets = new Map<string, CorrelatedAsset>();
    const BATCH_SIZE = 500; // Process 500 artifacts at a time

    let lastVisible: FirebaseFirestore.DocumentSnapshot | null = null;
    let totalProcessed = 0;

    log(`[assetCorrelator] Starting batched processing for scanId: ${scanId}`);

    while (true) {
        // 1. Build the batched query
        let query = db.collection('artifacts')
            .where('meta.scan_id', '==', scanId)
            .orderBy('created_at')
            .limit(BATCH_SIZE);

        if (lastVisible) {
            query = query.startAfter(lastVisible);
        }

        // 2. Fetch a batch of artifacts
        const snapshot = await query.get();
        if (snapshot.empty) {
            break; // No more artifacts to process
        }

        const batchArtifacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RawArtifact[];
        totalProcessed += batchArtifacts.length;
        log(`[assetCorrelator] Processing batch of ${batchArtifacts.length} artifacts (total: ${totalProcessed})`);

        // 3. Collect hostnames for this batch
        const batchHostnames = new Set<string>();
        for (const artifact of batchArtifacts) {
            // (Your existing logic to extract hostnames from an artifact)
            if (artifact.host) batchHostnames.add(artifact.host);
            if (artifact.type === 'hostname' || artifact.type === 'subdomain') batchHostnames.add(artifact.val_text);
        }

        // 4. Batch DNS resolution for this batch
        const hostnameToIps = await dnsCache.resolveBatch(batchHostnames);

        // 5. Process the batch of artifacts (your existing logic goes here)
        for (const artifact of batchArtifacts) {
            // (Your existing logic to extract IPs, update asset map, etc.)
            // This part of your code remains largely the same, but operates on
            // the `batchArtifacts` array instead of a single large buffer.
        }

        // 6. Set the cursor for the next iteration
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
    }

    // (Your existing logic for generating the summary artifact from the `assets` map goes here)
    // This part remains unchanged.
    log(`[assetCorrelator] Finished processing ${totalProcessed} artifacts.`);
}
Validation:

Run a scan on a small target and confirm it completes successfully.
Check the logs for the [assetCorrelator] Processing batch... messages.
To stress-test, manually create thousands of artifact documents in Firestore for a test scanId and run the scan. The job should complete successfully without exceeding the 6GiB memory limit.
Task 3: Enhance EAL Model with Dynamic EPSS Data
Objective: Integrate EPSS (Exploit Prediction Scoring System) data into the EAL calculation to make the PREVALENCE_FACTOR dynamic based on real-world exploitability.

Reasoning: This provides a more accurate and timely risk score by increasing the financial impact (EAL) of vulnerabilities that are actively being exploited in the wild.

Implementation Steps:

Create an EPSS Utility:
Create a new utility file, e.g., apps/workers/util/epss.ts.
This utility will have a function getEpssScores(cveIds: string[]): Promise<Map<string, number>>.
The function will query the EPSS API: https://api.first.org/data/v1/epss?cve=${cveIds.join(',')}.
Crucially, it must use your existing caching system (techCache/lruCache.ts) to avoid redundant API calls. The cache key should be { type: 'epss', cveId: cveId }.
Modify the Database Schema:
Add a nullable float column named epss_score to your findings table in the database.
Integrate EPSS into Finding Creation:
Modify the modules that generate CVE-based findings (lightweightCveCheck.ts and nuclei.ts).
After discovering CVEs, these modules should call your new getEpssScores utility.
When creating a finding with insertFinding, include the epss_score in the metadata to be saved to the new database column.
Update the EAL Calculation Logic:
Locate the PostgreSQL trigger function calculate_finding_eal().
Modify the function to use the epss_score to adjust the PREVALENCE_FACTOR.
SQL Blueprint for calculate_finding_eal():

code
SQL

download

content_copy

expand_less
-- Inside your BEGIN...END; block for the trigger function:

DECLARE
    -- ... other variables
    prevalence_factor NUMERIC := 1.0; -- Default prevalence
BEGIN
    -- ... your existing logic to get base_cost, severity_multiplier, etc.

    -- DYNAMIC PREVALENCE FACTOR LOGIC
    IF NEW.epss_score IS NOT NULL THEN
        -- Apply a multiplier based on EPSS score.
        -- A score > 0.9 (90%) indicates very high exploit activity.
        -- A score > 0.1 (10%) is already significant.
        IF NEW.epss_score > 0.9 THEN
            prevalence_factor := 10.0; -- 10x multiplier for highly exploited vulns
        ELSIF NEW.epss_score > 0.5 THEN
            prevalence_factor := 5.0;  -- 5x multiplier
        ELSIF NEW.epss_score > 0.1 THEN
            prevalence_factor := 2.0;  -- 2x multiplier
        END IF;
    END IF;

    -- Update the final EAL calculation to use the dynamic factor
    NEW.eal_ml := base_cost * severity_multiplier * 1.0 * prevalence_factor;
    NEW.eal_low := base_cost * severity_multiplier * 0.6 * prevalence_factor;
    NEW.eal_high := base_cost * severity_multiplier * 1.4 * prevalence_factor;
    NEW.eal_daily := NEW.eal_ml / 365;

    RETURN NEW;
END;
Validation:

Find a CVE with a known high EPSS score (e.g., from the CISA KEV catalog).
Run a scan on a target where this CVE is detected.
Verify in the database that the resulting finding has its epss_score field populated.
Check the calculated eal_ml for that finding. Confirm that it is significantly higher (e.g., 2x to 10x) than a similar finding that has no EPSS score, demonstrating the prevalence_factor logic is working.
