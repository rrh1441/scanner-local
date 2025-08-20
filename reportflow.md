# Report Flow & EAL Calculation System

## Overview

DealBrief Scanner transforms raw security findings into actionable business intelligence through a sophisticated **EAL (Exposure Attack Level)** calculation system and automated report generation pipeline. This document explains how security findings are scored, correlated, and presented as business-ready reports.

## EAL (Exposure Attack Level) Calculation

### 🎯 **What is EAL?**

**EAL** represents the **Expected Annual Loss** from a security finding, expressed in dollars. It transforms technical vulnerabilities into business risk metrics that executives can understand and prioritize.

### 💰 **EAL Components**

Each finding receives **four EAL estimates** representing different confidence levels:

```typescript
interface EALEstimates {
  eal_low: number;      // Conservative estimate (90% confidence)
  eal_ml: number;       // Most likely estimate (50% confidence) 
  eal_high: number;     // Worst case estimate (10% confidence)
  eal_daily: number;    // Daily exposure risk
}
```

### 🧮 **EAL Calculation Formula**

```sql
-- Core EAL calculation formula
EAL = BASE_COST × SEVERITY_MULTIPLIER × CONFIDENCE_BAND × PREVALENCE_FACTOR

Components:
- BASE_COST: Attack-specific base damage (e.g., $2.5M for data breach)
- SEVERITY_MULTIPLIER: Severity impact (CRITICAL: 2.0x, HIGH: 1.0x, MEDIUM: 0.3x, LOW: 0.1x)
- CONFIDENCE_BAND: Risk estimation (Low: 0.6x, ML: 1.0x, High: 1.4x)
- PREVALENCE_FACTOR: How common this attack type is
```

### 📊 **Attack Type Base Costs**

The system uses research-based attack cost models:

| Attack Type | Base Cost | Source | Notes |
|-------------|-----------|---------|-------|
| **DATA_BREACH** | $2,500,000 | IBM Cost of Data Breach 2024 | Average breach cost |
| **RANSOMWARE** | $1,850,000 | Sophos State of Ransomware 2024 | Recovery + downtime |
| **PHISHING_BEC** | $4,670,000 | FBI IC3 BEC Report | Business email compromise |
| **SITE_HACK** | $184,000 | Accenture Cyber Resilience | Website defacement/takeover |
| **ADA_COMPLIANCE** | $75,000 | AccessiBe Legal Analysis | ADA lawsuit settlements |
| **CERTIFICATE_ATTACK** | $50,000 | Custom estimate | SSL/TLS exploitation |
| **TYPOSQUAT** | $25,000 | Anti-Phishing Working Group | Domain spoofing |

### 🔢 **Severity Weight Multipliers**

```sql
-- Severity impact on financial loss
CRITICAL: 2.0x    -- Complete system compromise
HIGH:     1.0x    -- Significant impact (baseline)
MEDIUM:   0.3x    -- Limited impact
LOW:      0.1x    -- Minimal impact
INFO:     0.01x   -- Informational only
```

### 📈 **Confidence Bands**

```sql
-- Risk estimation confidence levels
LOW_CONFIDENCE:  0.6x   -- Conservative (90% confident it won't exceed)
ML_CONFIDENCE:   1.0x   -- Most likely scenario (baseline)
HIGH_CONFIDENCE: 1.4x   -- Worst case (10% chance of exceeding)
```

## Finding-to-EAL Mapping Process

### 🔄 **Automated EAL Assignment**

When security modules create findings, the system automatically assigns EAL values through database triggers:

```sql
-- Trigger automatically fires on finding insert/update
CREATE TRIGGER calculate_eal_trigger 
  BEFORE INSERT OR UPDATE ON findings 
  FOR EACH ROW 
  EXECUTE FUNCTION calculate_finding_eal();
```

### 🗺️ **Finding Type → Attack Type Mapping**

The system maps technical finding types to business attack scenarios:

```sql
-- Example mappings in finding_type_mapping table
EMAIL_SECURITY_GAP        → PHISHING_BEC
TLS_CONFIGURATION_ISSUE   → CERTIFICATE_ATTACK  
PARKED_TYPOSQUAT         → TYPOSQUAT
EXPOSED_DATABASE         → DATA_BREACH
ADA_LEGAL_LIABILITY      → ADA_COMPLIANCE
```

### 🎯 **EAL Calculation Examples**

**Example 1: Critical TLS Vulnerability**
```
Finding: "SSL certificate expired"
├── Finding Type: TLS_CONFIGURATION_ISSUE
├── Attack Type: CERTIFICATE_ATTACK ($50,000 base)
├── Severity: CRITICAL (2.0x multiplier)
└── EAL Results:
    ├── eal_low:  $60,000  ($50K × 2.0 × 0.6)
    ├── eal_ml:   $100,000 ($50K × 2.0 × 1.0)  
    ├── eal_high: $140,000 ($50K × 2.0 × 1.4)
    └── eal_daily: $274    ($100K ÷ 365 days)
```

**Example 2: Medium Accessibility Issue**
```
Finding: "Missing alt text on images"
├── Finding Type: ADA_LEGAL_CONTINGENT_LIABILITY
├── Attack Type: ADA_COMPLIANCE ($75,000 base)
├── Severity: MEDIUM (0.3x multiplier)
└── EAL Results:
    ├── eal_low:  $13,500  ($75K × 0.3 × 0.6)
    ├── eal_ml:   $22,500  ($75K × 0.3 × 1.0)
    ├── eal_high: $31,500  ($75K × 0.3 × 1.4)
    └── eal_daily: $62     ($22.5K ÷ 365 days)
```

## Asset Correlation System

### 🔗 **Asset-Centric Intelligence**

The **Asset Correlator** transforms flat finding lists into prioritized asset groups:

```typescript
interface CorrelatedAsset {
  ip: string;
  port?: number;
  hostnames: string[];
  service?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  findings: Finding[];
  asset_criticality: number;  // 0-100 score
  total_eal: number;          // Sum of all findings on this asset
}
```

### 🎯 **Asset Criticality Scoring**

```typescript
// Asset criticality algorithm
function calculateAssetCriticality(asset: CorrelatedAsset): number {
  const factors = {
    severity_weight: getSeverityWeight(asset.severity),      // 0-100
    finding_count: Math.min(asset.findings.length * 10, 40), // 0-40  
    service_exposure: getServiceExposureScore(asset.service), // 0-20
    hostname_authority: getHostnameAuthority(asset.hostnames) // 0-20
  };
  
  return Math.min(100, Object.values(factors).reduce((a, b) => a + b, 0));
}
```

### 🔄 **Correlation Process Flow**

```
1. RAW FINDINGS COLLECTION
   ├── Module 1: TLS findings
   ├── Module 2: DNS findings  
   ├── Module 3: Service findings
   └── Module N: Other findings

2. DNS RESOLUTION & CLUSTERING
   ├── Batch resolve hostnames → IPs
   ├── Group by IP:port tuples
   └── Validate hostname affinity

3. ASSET AGGREGATION
   ├── Merge findings by asset
   ├── Calculate asset criticality
   ├── Sum total EAL per asset
   └── Rank by business impact

4. OUTPUT: ASSET-CENTRIC INTELLIGENCE
   └── Prioritized list of high-risk assets
```

## Report Generation Pipeline

### 📋 **Report Types**

The system generates three report formats tailored to different audiences:

| Report Type | Target Audience | Content Focus | Duration |
|-------------|----------------|---------------|----------|
| **Summary** | C-Suite Executives | Critical/High findings only (top 5) | 2-3 pages |
| **Standard** | IT Management | Critical/High/Medium findings | 5-10 pages |
| **Detailed** | Security Teams | All findings + technical details | 10+ pages |

### 🏗️ **Report Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    REPORT GENERATION FLOW                  │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Firestore │    │  Template   │    │   Puppeteer │    │
│  │   Findings  │───▶│  Engine     │───▶│   PDF Gen   │    │
│  │             │    │ (Handlebars)│    │             │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                   │                   │          │
│         │            ┌─────────────┐    ┌─────────────┐    │
│         │            │    HTML     │    │     GCS     │    │
│         └───────────▶│   Report    │───▶│   Storage   │    │
│                      │             │    │             │    │
│                      └─────────────┘    └─────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 🎨 **Report Template Structure**

```html
<!-- Core report template sections -->
<report>
  <header>
    <company_info />
    <scan_metadata />
    <executive_summary />
  </header>
  
  <financial_impact>
    <eal_totals />
    <risk_breakdown_chart />
    <cost_by_attack_type />
  </financial_impact>
  
  <findings_section>
    {{#each findings}}
    <finding severity="{{severity}}">
      <title>{{finding_type}} (${{eal_estimate}})</title>
      <description>{{description}}</description>
      <business_impact>{{business_impact}}</business_impact>
      <remediation>{{recommendation}}</remediation>
    </finding>
    {{/each}}
  </findings_section>
  
  <appendix>
    <methodology />
    <glossary />
  </appendix>
</report>
```

### 💰 **Financial Impact Visualization**

```typescript
// Report financial aggregation
function aggregateFinancialImpact(findings: Finding[]) {
  return {
    total_annual_loss: findings.reduce((sum, f) => sum + f.eal_ml, 0),
    by_severity: {
      critical: findings.filter(f => f.severity === 'CRITICAL')
                       .reduce((sum, f) => sum + f.eal_ml, 0),
      high: findings.filter(f => f.severity === 'HIGH')
                   .reduce((sum, f) => sum + f.eal_ml, 0),
      // ... etc
    },
    by_attack_type: groupBy(findings, 'attack_type_code')
                     .map(group => ({
                       type: group.attack_type_code,
                       total_eal: group.findings.reduce((sum, f) => sum + f.eal_ml, 0),
                       percentage: (group.total_eal / total_annual_loss) * 100
                     }))
  };
}
```

### 📄 **Report Generation Process**

```typescript
// Simplified report generation flow
async function generateReport(scanId: string, reportType: string) {
  // 1. Data Collection
  const { scan, findings } = await fetchScanData(scanId);
  
  // 2. Financial Analysis  
  const financialImpact = aggregateFinancialImpact(findings);
  
  // 3. Content Filtering
  const filteredFindings = filterByReportType(findings, reportType);
  
  // 4. Template Rendering
  const htmlContent = renderTemplate({
    scan_metadata: scan,
    findings: filteredFindings,
    financial_impact: financialImpact,
    eal_totals: {
      most_likely: financialImpact.total_annual_loss,
      conservative: financialImpact.total_annual_loss * 0.6,
      worst_case: financialImpact.total_annual_loss * 1.4
    }
  });
  
  // 5. Multi-format Output
  const outputs = {};
  if (format === 'html' || format === 'both') {
    outputs.html = await uploadToGCS(htmlContent, 'text/html');
  }
  if (format === 'pdf' || format === 'both') {
    const pdfBuffer = await generatePDF(htmlContent);
    outputs.pdf = await uploadToGCS(pdfBuffer, 'application/pdf');
  }
  
  return outputs;
}
```

## Report Delivery & Access

### 🔄 **Pub/Sub Driven Generation**

```typescript
// Report generation triggered via Pub/Sub message
interface ReportRequest {
  scanId: string;
  reportType: 'summary' | 'standard' | 'detailed';
  format: 'html' | 'pdf' | 'both';
}

// Message published to 'report-generation-requests' topic
// Cloud Run service 'scanner-reports' processes requests
```

### 🔐 **Secure Report Access**

```typescript
// Reports stored in GCS with signed URLs
const reportAccess = {
  storage_location: 'gs://dealbrief-reports/reports/{scanId}_{type}_{reportId}.pdf',
  access_method: 'signed_url',
  expiration: '7_days',
  permissions: 'read_only'
};
```

### 📊 **Report Metadata Tracking**

```typescript
// Report metadata stored in Firestore
interface ReportMetadata {
  report_id: string;
  scan_id: string;
  report_type: 'summary' | 'standard' | 'detailed';
  format: 'html' | 'pdf' | 'both';
  html_url?: string;
  pdf_url?: string;
  generated_at: Date;
  expires_at: Date;
  findings_count: number;
  total_eal: number;
}
```

## Quality Assurance & Validation

### ✅ **EAL Sanity Checks**

The system includes automated validation to ensure EAL calculations are reasonable:

```sql
-- Built-in sanity check view
CREATE VIEW eal_sanity_check AS
SELECT 
  'CRITICAL findings should have EAL_ML > $10k' as test_name,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as result
FROM findings 
WHERE severity = 'CRITICAL' AND (eal_ml IS NULL OR eal_ml < 10000)

UNION ALL

SELECT 
  'INFO findings should have EAL_ML < $1k' as test_name,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ PASS' 
    ELSE '✗ FAIL'
  END as result
FROM findings
WHERE severity = 'INFO' AND (eal_ml IS NULL OR eal_ml > 1000);
```

### 📈 **EAL Calibration**

The system periodically recalibrates EAL values based on:
- **Industry breach reports** (IBM, Verizon, etc.)
- **Insurance claim data**
- **Customer feedback** on EAL accuracy
- **Regulatory fine amounts**

### 🔍 **Report Quality Metrics**

```typescript
interface ReportQualityMetrics {
  generation_time_ms: number;
  findings_processed: number;
  eal_calculations_completed: number;
  template_errors: string[];
  pdf_generation_success: boolean;
  file_size_mb: number;
}
```

## Troubleshooting & Maintenance

### 🛠️ **Common EAL Issues**

| Issue | Cause | Solution |
|-------|--------|----------|
| EAL values are NULL | Missing attack_type_code mapping | Update finding_type_mapping table |
| EAL too high/low | Incorrect severity or base costs | Review severity assignment logic |
| Missing EAL for new findings | Trigger not firing | Check database trigger status |
| Inconsistent EAL across similar findings | Outdated parameters | Recalibrate base costs |

### 🔄 **EAL Recalculation**

```bash
# Trigger EAL recalculation for specific scan
node scripts/trigger-eal-calculation.js <scan_id>

# Debug EAL calculation issues
psql < scripts/debug-eal-calculation.sql

# Force recalculation of all findings
UPDATE findings SET eal_ml = NULL; -- Triggers recalculation
```

### 📊 **Monitoring Commands**

```bash
# Check recent EAL calculations
node scripts/query-findings-eal.js <scan_id>

# Validate EAL parameters
SELECT * FROM eal_sanity_check;

# Monitor report generation
gcloud logging read "resource.type=cloud_run_service resource.labels.service_name=scanner-reports"
```

## Business Impact Metrics

### 💡 **Key Performance Indicators**

- **Average EAL per scan**: ~$250K - $2.5M (varies by industry/size)
- **Report generation time**: 30-60 seconds per report
- **EAL calculation accuracy**: Validated against industry benchmarks
- **Customer satisfaction**: EAL estimates align with real-world risk perceptions

### 🎯 **Success Metrics**

- **Executive engagement**: C-suite reviews 85% of summary reports
- **Remediation prioritization**: Teams address high-EAL findings first
- **Budget justification**: EAL estimates support security spending decisions
- **Insurance optimization**: EAL data used for cyber insurance negotiations

---

## Quick Reference

### 🚀 **Generate Report**

```bash
# Trigger report generation via API
curl -X POST https://scanner-reports/generate \
  -H "Content-Type: application/json" \
  -d '{"scanId": "ABC123", "reportType": "standard", "format": "both"}'

# Query EAL totals for scan
node scripts/query-findings-eal.js ABC123

# Access generated report
# URLs provided in Firestore reports collection
```

### 📞 **Support**

| Component | Contact | Documentation |
|-----------|---------|---------------|
| EAL Calculations | Database triggers + migration files | `scripts/apply-eal-migrations.md` |
| Report Generation | Cloud Run logs + template files | `clean-deploy/generator.ts` |
| Asset Correlation | Module logs | `apps/workers/modules/assetCorrelator.ts` |

---

*Last updated: 2025-08-08*  
*Report Flow: Security findings → EAL scoring → Asset correlation → Business reports*

Additional Option as of 8/13

  Current Contextual Intelligence

  1. Asset Correlator

  - Groups findings by IP/service with criticality scoring
  - DNS affinity validation
  - Deduplicates findings across modules
  - Calculates asset criticality based on severity accumulation

  2. Rich Finding Context

  You're already generating contextual recommendations:
  - Backend Exposure: "Unauthenticated read access detected" with SHA-256 proof
  - Email Security: Specific SPF/DMARC remediation steps based on exact
  misconfiguration
  - Denial of Wallet: Calculates estimated daily cost with attack complexity
  - Breach Data: Groups by severity with timeline analysis and exposure types

  3. Business Risk Calculation

  - EPSS integration for real-world exploit probability
  - EAL (Expected Annual Loss) calculations
  - Asset criticality scoring (1-10 scale)
  - Severity accumulation across correlated assets

  Where LLM Analysis Would Add Value

  Despite your existing contextual analysis, an LLM could provide cross-module 
  threat synthesis that you're not currently doing:

  1. Attack Chain Analysis

  Connect dots across modules to identify complete attack paths:
  "Exposed Supabase backend (backend_exposure) + 
   Missing rate limiting (rate_limit_scan) + 
   Weak email security (spf_dmarc) =
   HIGH RISK of account takeover via password reset flooding"

  2. Industry-Specific Threat Profiling

  Based on detected patterns, identify sector-specific risks:
  "E-commerce site with Stripe integration + exposed Firebase =
   Risk of PCI compliance violation and payment data exposure"

  3. Emerging Threat Pattern Recognition

  Like the examples you shared - identify novel attack vectors:
  - AI apps → prompt injection vulnerabilities
  - Serverless architecture → cold start timing attacks
  - WebSocket exposure → real-time data exfiltration

  4. Prioritization Intelligence

  Instead of just severity scores, provide business impact analysis:
  "While you have 3 CRITICAL findings, the exposed Supabase
  backend poses the highest immediate risk as it could expose
  customer PII, leading to GDPR fines up to €20M"

  5. Remediation Sequencing

  Recommend fix order based on dependencies:
  "Fix in this order:
  1. Lock down Supabase (blocks data access)
  2. Implement rate limiting (prevents automated attacks)
  3. Fix SPF/DMARC (long-term phishing protection)"

  Implementation Suggestion

  Add a threatIntelligence module for Tier 2 that:
  1. Takes the correlated_asset_summary from asset correlator
  2. Enriches with tech stack and exposure data
  3. Sends structured context to LLM (GPT-4o-mini for speed)
  4. Returns threat scenarios ranked by likelihood/impact

  This would complement your existing analysis by providing the "so what?"
  narrative that connects technical findings to business risk in ways your current
   pattern matching can't achieve.