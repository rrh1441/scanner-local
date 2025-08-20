# Backend Changes for Auto-Generating All Three Report Types

## Overview
The backend has been modified to support generating all three report types (threat_snapshot, executive_summary, technical_remediation) automatically for testing purposes, with a fallback to only snapshots in production.

## Changes Made to Backend

### 1. Updated `/src/app/api/reports/generate/route.ts`

**COMPLETELY REPLACE** the existing file with this new implementation:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
})

// Report type configurations based on report_templates_rows.csv
const REPORT_TYPES = [
  {
    type: 'threat_snapshot',
    system_prompt: `You are DealBrief-AI, a senior cybersecurity analyst.
Return ONLY GitHub-flavoured Markdown **starting with** a YAML front-matter block delimited by three dashes (---).
Required fields: company, domain, scan_date, eal_low, eal_ml, eal_high,
legal_liability_total, daily_cost_amplification, overall_risk_score.
After the closing --- provide a body **≤ 650 words** (≈ 2 pages).  
No external links. Format all numbers like $123,456 or 12 %. Never invent data; derive only from user input.
Omit a bullet or table column when the value is zero or absent.`,
    user_prompt_template: `INPUT:
  {scan_data}
  {risk_totals}
  company_name: {company_name}
  domain: {domain}
  scan_date: {scan_date}

TASK: Produce an executive Threat Snapshot.

EXECUTIVE DASHBOARD  
– Header: **{company_name} — Cybersecurity Threat Snapshot ({scan_date})**  
– Financial Impact bullets:  
  • Annual Loss Exposure  
  • One-time Legal/Compliance Exposure  
  • Per-day Cloud-Cost Abuse Risk  
– Overall Risk Score: X / 100 (brief 1-sentence method)  
– Threat Landscape table: columns Critical / High / Medium / Low / Primary Concern per category (External, Infrastructure, Legal, Cloud)

KEY FINDINGS & NEXT STEPS  
If critical or high findings exist → list top 3 critical + top 5 high actions (1 line each).  
Else → give 3 preventive recommendations.

STYLE: plain English, board-level. Explain technical terms in parentheses. Highlight financial impact and business continuity.`,
    max_tokens: 2000
  },
  {
    type: 'executive_summary',
    system_prompt: `You are DealBrief-AI, a principal cybersecurity consultant.
Return ONLY Markdown starting with a YAML front-matter block delimited by ---.
Fields: company, domain, scan_date, overall_posture, eal_total, eal_range, benchmarks_used.
Body **≤ 2 500 words** (≤ 6 pages), ≤ 6 H2 headings. Omit any heading without content.`,
    user_prompt_template: `INPUT:
  scan_data: {scan_data}
  risk_calculations: {risk_calculations}
  company_profile: {company_profile}

TASK: Create an **Executive Security Briefing** with sections:

1 Executive Summary  
  – Overall security posture (Excellent / Good / Needs Improvement / Critical)  
  – Top 3 business risks (1 line each)  
  – Annual Loss Exposure with 90 % confidence range  
  – Three-line strategic recommendation block  

2 Threat Landscape Analysis  
  Frame findings against industry-standard attack patterns; cite public trends, no external links.

3 Business Impact Assessment  
  For each major category present likelihood × impact scenario (≤ 150 words).

4 Strategic Recommendations  
  Immediate (0-30 d), Short-Term (30-90 d), Long-Term (> 90 d).  
  Include rough cost brackets and qualitative ROI.

STYLE: CEO-friendly, forward-looking, quantify everything.  
Use at most 2 real-world breach analogies.  
Skip the Threat Landscape section if scan_data has no Critical or High findings.`,
    max_tokens: 4500
  },
  {
    type: 'technical_remediation',
    system_prompt: `You are DealBrief-AI, a senior penetration tester.
Return ONLY Markdown starting with a YAML front-matter block delimited by ---.
Fields: company, domain, scan_date, findings_total, critical_ct, high_ct,
medium_ct, low_ct.
Body **≤ 4 500 words** (≤ 12 pages).  
Use code fences for all commands/configs.  
Use call-out blocks (\`> Risk:\`) to emphasise danger points.`,
    user_prompt_template: `INPUT:
  detailed_findings: {detailed_findings}
  remediation_data: {detailed_findings[].remediation}
  scan_artifacts: {scan_artifacts}

TASK: Produce a **Technical Analysis & Remediation Guide**

1 Methodology Snapshot (~½ page) – tools, coverage, validation steps, confidence.

2 Key Technical Findings (table) – ID, Severity, Asset, CVE/OWASP, Proof-of-Concept link.

3 Detailed Vulnerability Analysis (for Critical, High, Medium)  
  For each finding include:  
  – Lay Explanation (2-3 sentences, non-technical)  
  – Technical Details (ports, payload, logs)  
  – Risk Assessment (likelihood, impact, attacker effort)  
  – Reproduction (commands or nuclei template ID, screenshot path placeholder)  
  – **Remediation** – render \`remediation_data.summary\`, then bullet \`remediation_data.steps\`, show \`code_example\` in a fenced block, and end with \`verification_command\`.

  Summarise Low severity items in one table.

4 Domain & Infrastructure Security – TLS, DNS, email auth, cloud IAM.

5 Comprehensive Remediation Roadmap – Fix Immediately / 30-Day / 90-Day; owner + effort hours.

STYLE: precise, practitioner-level.  
Reference standards in footnote style \`[NIST SP 800-53]\`.  
No base64 screenshots—use path placeholders only.`,
    max_tokens: 6000
  }
]

export async function POST(request: NextRequest) {
  try {
    const { scanId, findings, companyName, domain, reportTypes = ['threat_snapshot'] } = await request.json()

    if (!scanId || !findings || !companyName || !domain) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Prepare findings data in CSV format
    const csvHeader = 'id,created_at,description,scan_id,type,recommendation,severity,attack_type_code,state,eal_low,eal_ml,eal_high,eal_daily'
    const csvRows = findings.map((f: {
      id: string;
      created_at?: string;
      description: string;
      type: string;
      recommendation: string;
      severity: string;
      attack_type_code?: string;
      state: string;
      eal_low?: number | null;
      eal_ml?: number | null;
      eal_high?: number | null;
      eal_daily?: number | null;
    }) => {
      const escapeCsv = (field: string) => field ? `"${field.replace(/"/g, '""')}"` : '""'
      return [
        f.id,
        f.created_at || new Date().toISOString(),
        escapeCsv(f.description),
        scanId,
        f.type,
        escapeCsv(f.recommendation),
        f.severity,
        f.attack_type_code || 'UNKNOWN',
        f.state,
        f.eal_low || '',
        f.eal_ml || '',
        f.eal_high || '',
        f.eal_daily || ''
      ].join(',')
    })
    const csvData = [csvHeader, ...csvRows].join('\n')

    const generatedReports = []

    // Generate reports for each requested type
    for (const reportType of reportTypes) {
      const config = REPORT_TYPES.find(rt => rt.type === reportType)
      if (!config) {
        console.warn(`Unknown report type: ${reportType}`)
        continue
      }

      // Replace template variables in user prompt
      const userPrompt = config.user_prompt_template
        .replace(/{company_name}/g, companyName)
        .replace(/{domain}/g, domain)
        .replace(/{scan_date}/g, new Date().toISOString().split('T')[0])
        .replace(/{scan_data}/g, csvData)
        .replace(/{risk_totals}/g, csvData)
        .replace(/{risk_calculations}/g, csvData)
        .replace(/{company_profile}/g, `Company: ${companyName}, Domain: ${domain}`)
        .replace(/{detailed_findings}/g, csvData)
        .replace(/{scan_artifacts}/g, csvData)

      try {
        // Generate report using OpenAI
        const completion = await openai.chat.completions.create({
          model: 'o3-2025-04-16',
          messages: [
            {
              role: 'system',
              content: config.system_prompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          max_completion_tokens: config.max_tokens
        })

        const reportContent = completion.choices[0].message.content

        if (!reportContent) {
          console.error(`Failed to generate ${reportType} report content`)
          continue
        }

        // Save report to database with unique ID
        const reportId = `${scanId}-${reportType}`
        const { data, error } = await supabase
          .from('reports')
          .insert({
            id: reportId,
            scan_id: scanId,
            company_name: companyName,
            domain,
            content: reportContent,
            report_type: reportType,
            findings_count: findings.length,
            status: 'completed'
          })
          .select()
          .single()

        if (error) {
          console.error(`Database error for ${reportType}:`, error)
          continue
        }

        generatedReports.push({
          reportId: data.id,
          reportType: reportType,
          content: reportContent
        })

      } catch (error) {
        console.error(`Failed to generate ${reportType} report:`, error)
        continue
      }
    }

    if (generatedReports.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate any reports' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      reports: generatedReports,
      primaryReportId: generatedReports[0].reportId
    })

  } catch (error) {
    console.error('Failed to generate reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 2. Updated `/src/app/(dashboard)/reports/page.tsx`

**FIND** this section in the `generateReport` function:
```typescript
        body: JSON.stringify({
          scanId: scan.scan_id,
          findings: verifiedFindings,
          companyName: scan.company_name,
          domain: scan.domain
        }),
```

**REPLACE** with:
```typescript
        body: JSON.stringify({
          scanId: scan.scan_id,
          findings: verifiedFindings,
          companyName: scan.company_name,
          domain: scan.domain,
          reportTypes: process.env.NODE_ENV === 'development' 
            ? ['threat_snapshot', 'executive_summary', 'technical_remediation'] // Generate all three for testing
            : ['threat_snapshot'] // Production default: only snapshots
        }),
```

**FIND** this section:
```typescript
      if (response.ok) {
        const { reportId } = await response.json()
        // Refresh reports list
        window.location.href = `/reports/${reportId}`
      }
```

**REPLACE** with:
```typescript
      if (response.ok) {
        const { reports, primaryReportId } = await response.json()
        // Refresh reports list and navigate to the first generated report
        window.location.href = `/reports/${primaryReportId}`
      }
```

## How This Works

1. **Development Mode** (`NODE_ENV=development`): 
   - Generates all three report types automatically
   - Creates reports with IDs: `${scanId}-threat_snapshot`, `${scanId}-executive_summary`, `${scanId}-technical_remediation`

2. **Production Mode**: 
   - Only generates `threat_snapshot` reports by default
   - Maintains backward compatibility

3. **Database Changes**:
   - Added `report_type` column to track which type each report is
   - Reports now have unique IDs combining scan ID and report type

## Database Schema Update Required

Make sure your `reports` table has a `report_type` column:
```sql
ALTER TABLE reports ADD COLUMN report_type VARCHAR(50) DEFAULT 'threat_snapshot';
```

## Testing Instructions

1. Run in development mode: `npm run dev`
2. Generate a report from any scan
3. Check database - should see 3 reports created per scan
4. Each report will have appropriate content based on its type

## Deployment Notes

- You can deploy this immediately - it won't break existing functionality
- In production, it will only generate snapshots unless manually overridden
- The frontend viewing interface from `instruct.md` will be needed to actually view these reports