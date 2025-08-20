# Next Steps for Production Deployment

## Current Status ✅
- **Scan Performance:** 35-43 seconds (excellent)
- **Module Success Rate:** 15/15 modules completing
- **Shodan:** Fixed and working (1.4s)
- **Infrastructure:** IPv6 fixes applied, nuclei installed

## Immediate Testing Required

### 1. Firestore/Firebase Connection Test
```bash
# First, set your service account credentials
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account.json

# Run the Firestore test
node test-firestore-findings.js
```

**What to check:**
- Are scans being written to Firestore?
- Are findings being saved for each scan?
- Are artifacts being tracked?

**If no findings are found:**
- Check that `insertFinding()` is being called in modules
- Verify Firestore permissions for the service account
- Check Cloud Run logs for Firestore errors

### 2. GCS Artifacts Test
```bash
# List recent artifacts
gsutil ls -l gs://precise-victory-467219-s4-scan-artifacts/ | head -20

# Check specific scan artifacts (use a recent scan_id)
gsutil ls -r "gs://precise-victory-467219-s4-scan-artifacts/[SCAN_ID]/"
```

**Expected artifacts:**
- Tech stack reports (JSON)
- TLS scan results
- Endpoint discovery data
- Vulnerability findings

### 3. Report Generation Implementation

**Current Status:** ❌ Not implemented

**Required Implementation:**

#### A. Create Report Endpoint
Add to `apps/workers/server.ts`:
```typescript
app.post<{ Body: { scan_id: string } }>('/reports/generate', async (req, reply) => {
  const { scan_id } = req.body;
  
  // 1. Fetch scan data from Firestore
  const scanDoc = await db.collection('scans').doc(scan_id).get();
  if (!scanDoc.exists) {
    return reply.code(404).send({ error: 'Scan not found' });
  }
  
  // 2. Fetch all findings for this scan
  const findings = await db.collection('findings')
    .where('scan_id', '==', scan_id)
    .orderBy('severity_score', 'desc')
    .get();
  
  // 3. Generate HTML report
  const html = generateHTMLReport(scanDoc.data(), findings);
  
  // 4. Convert to PDF (using puppeteer)
  const pdf = await htmlToPdf(html);
  
  // 5. Upload to GCS
  const bucket = storage.bucket('precise-victory-467219-s4-scan-artifacts');
  const file = bucket.file(`reports/${scan_id}/report.pdf`);
  await file.save(pdf);
  
  // 6. Generate signed URL (24-hour expiry)
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 24 * 60 * 60 * 1000
  });
  
  return { 
    report_url: signedUrl,
    scan_id,
    generated_at: new Date().toISOString()
  };
});
```

#### B. HTML Report Template
Create `apps/workers/templates/report.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Security Scan Report - {{domain}}</title>
  <style>
    /* Professional report styling */
  </style>
</head>
<body>
  <h1>Security Assessment Report</h1>
  <h2>{{domain}}</h2>
  <p>Scan Date: {{scan_date}}</p>
  
  <section id="executive-summary">
    <h2>Executive Summary</h2>
    <p>Total Findings: {{findings_count}}</p>
    <p>Critical: {{critical_count}}, High: {{high_count}}</p>
  </section>
  
  <section id="findings">
    {{#each findings}}
    <div class="finding {{severity}}">
      <h3>{{title}}</h3>
      <p>{{description}}</p>
      <p>Recommendation: {{recommendation}}</p>
    </div>
    {{/each}}
  </section>
</body>
</html>
```

#### C. PDF Generation
Install dependencies:
```bash
npm install puppeteer handlebars
```

#### D. Severity Scoring Algorithm
```typescript
function calculateSeverityScore(finding: any): number {
  const baseScores = {
    CRITICAL: 100,
    HIGH: 75,
    MEDIUM: 50,
    LOW: 25,
    INFO: 10
  };
  
  let score = baseScores[finding.severity] || 0;
  
  // Adjust based on exploitability
  if (finding.actively_exploited) score *= 1.5;
  if (finding.public_exploit) score *= 1.3;
  if (finding.cvss_score > 9) score *= 1.2;
  
  return Math.min(score, 100);
}
```

## Testing Workflow

### Run Full End-to-End Test
```bash
# 1. Run a complete scan with all checks
./test-report-generation.sh

# 2. Manually verify each component
# - Check scan completed (35-45s expected)
# - Verify Firestore has scan record
# - Confirm GCS has artifacts
# - Test report generation (when implemented)
```

## Production Checklist

- [ ] Firestore findings being written correctly
- [ ] GCS artifacts being uploaded
- [ ] Report generation endpoint implemented
- [ ] PDF generation working
- [ ] Signed URLs being generated
- [ ] Executive summary logic implemented
- [ ] Severity scoring algorithm tuned
- [ ] Report template finalized
- [ ] Error handling for missing data
- [ ] Rate limiting on report endpoint
- [ ] Monitoring/alerting configured
- [ ] Daily summary reports scheduled

## Known Issues to Address

1. **httpx binary** - Still failing, using fallback (17s penalty)
   - Consider replacing with Node.js alternative
   - Or debug with strace in container

2. **Report Generation** - Not implemented
   - Priority #1 for production
   - Need design approval for template

3. **Findings Persistence** - Need to verify
   - Run test-firestore-findings.js
   - Check if modules call insertFinding()

4. **Cost Optimization**
   - Shodan: Now optimized (1-2 credits per scan)
   - Consider caching for repeated domains
   - Implement scan deduplication

## Support Contacts

- Project: precise-victory-467219-s4
- Service: scanner-service
- Region: us-central1
- Latest revision: scanner-service-00057-zv7

_Generated: 2025-08-18 12:00 PM PST_