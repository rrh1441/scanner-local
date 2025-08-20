# V0 Prompt for Cybersecurity Report Templates

## Project Overview
Create interactive HTML report templates for a cybersecurity scanning platform. These reports will display security findings, financial risk assessments, and remediation guidance for businesses. Use dummy data for design purposes - we'll replace with Supabase calls later.

## Data Structure & Context

### Report Types
1. **Threat Snapshot** - Executive dashboard (2-page summary)
2. **Executive Summary** - Strategic overview (6-page detailed analysis)
3. **Technical Remediation** - Implementation guide (12-page technical details)

### Key Data Points to Display

#### Company Information
```javascript
// Use dummy data like:
const companyInfo = {
  company_name: "TechCorp Solutions",
  domain: "techcorp.com",
  scan_date: "2024-01-15",
  scan_id: "scan_abc123"
}
```

#### Financial Risk Data (EAL = Expected Annual Loss)
```javascript
// Show financial impact with confidence ranges
const financialData = {
  eal_low_total: 150000,      // Conservative estimate
  eal_ml_total: 425000,       // Most likely estimate  
  eal_high_total: 850000,     // Worst case estimate
  eal_daily_total: 2500,      // Daily cost if exploited
  overall_risk_score: 72      // 0-100 risk score
}
```

#### Security Findings by Severity
```javascript
// Severity distribution counts
const severityCounts = {
  critical_count: 3,
  high_count: 8,
  medium_count: 15,
  low_count: 22,
  info_count: 12
}
```

#### Finding Categories (Use realistic dummy data)
```javascript
const findingTypes = [
  {
    type: "DENIAL_OF_WALLET",
    display_name: "Cloud Cost Amplification",
    count: 2,
    max_severity: "CRITICAL",
    description: "Vulnerabilities that could lead to massive cloud bills"
  },
  {
    type: "DATA_BREACH_EXPOSURE", 
    display_name: "Data Exposure Risk",
    count: 5,
    max_severity: "HIGH",
    description: "Customer data potentially accessible without authorization"
  },
  {
    type: "ADA_LEGAL_CONTINGENT_LIABILITY",
    display_name: "ADA Compliance Gap",
    count: 1,
    max_severity: "MEDIUM", 
    description: "Website accessibility issues creating legal liability"
  },
  {
    type: "CLIENT_SIDE_SECRET_EXPOSURE",
    display_name: "Exposed API Keys",
    count: 3,
    max_severity: "HIGH",
    description: "API keys or credentials exposed in client-side code"
  },
  {
    type: "VERIFIED_CVE",
    display_name: "Known Vulnerabilities", 
    count: 7,
    max_severity: "CRITICAL",
    description: "Confirmed security vulnerabilities with CVE identifiers"
  }
]
```

#### Individual Findings (For detailed tables)
```javascript
const criticalFindings = [
  {
    id: 1,
    finding_type: "DENIAL_OF_WALLET",
    finding_type_display: "Cloud Cost Amplification",
    severity: "CRITICAL",
    asset_name: "api.techcorp.com",
    description: "Rate limiting bypass allows unlimited API calls",
    eal_ml: 180000,
    remediation_summary: "Implement request throttling and API quotas",
    cve_id: null,
    cvss_score: null
  },
  {
    id: 2, 
    finding_type: "VERIFIED_CVE",
    finding_type_display: "WordPress RCE",
    severity: "CRITICAL", 
    asset_name: "blog.techcorp.com",
    description: "WordPress plugin vulnerable to remote code execution",
    eal_ml: 95000,
    remediation_summary: "Update to plugin version 2.1.4 immediately",
    cve_id: "CVE-2024-1234",
    cvss_score: 9.8
  },
  {
    id: 3,
    finding_type: "DATA_BREACH_EXPOSURE",
    finding_type_display: "Database Exposure", 
    severity: "HIGH",
    asset_name: "admin.techcorp.com",
    description: "Customer database accessible without authentication",
    eal_ml: 150000,
    remediation_summary: "Enable database authentication and IP restrictions",
    cve_id: null,
    cvss_score: null
  }
]
```

## Design Requirements

### Visual Components Needed

#### 1. Risk Score Gauge
- Circular gauge showing 0-100 risk score
- Color coding: 0-30 (green), 31-60 (yellow), 61-80 (orange), 81-100 (red)
- Large, prominent display for executive audience

#### 2. Financial Impact Cards  
- 3 card layout showing EAL ranges
- Annual Loss Exposure (with confidence range)
- Daily Cost Risk (per-day if exploited)
- Clean, professional financial formatting

#### 3. Severity Distribution Chart
- Donut or pie chart showing finding counts by severity
- Colors: Critical (red), High (orange), Medium (yellow), Low (green), Info (blue)
- Legend with counts and percentages

#### 4. Category Breakdown Chart
- Horizontal bar chart showing finding types
- Bars colored by max severity of findings in that category
- Sort by severity or count

#### 5. Findings Table
- Sortable/filterable table of security findings
- Columns: Severity badge, Finding Type, Asset, Financial Impact, Action Required
- Expandable rows for detailed descriptions

### Styling Guidelines

#### Color Palette
```css
/* Severity Colors */
--critical: #dc2626;    /* Red 600 */
--high: #ea580c;        /* Orange 600 */  
--medium: #d97706;      /* Amber 600 */
--low: #16a34a;         /* Green 600 */
--info: #2563eb;        /* Blue 600 */

/* UI Colors */
--bg-primary: #ffffff;
--bg-secondary: #f8fafc;
--text-primary: #1e293b;
--text-secondary: #64748b;
--border: #e2e8f0;
```

#### Typography
- Headers: Inter or similar modern sans-serif
- Body: System font stack for readability
- Monospace: For technical details, CVE IDs, domains

#### Layout Principles
- Clean, professional business aesthetic
- Mobile-responsive design
- Sufficient whitespace for readability
- Executive-friendly (not overly technical)

### Technical Specifications

#### Chart Library
Use Chart.js for all visualizations:
- Risk gauge: Doughnut chart with custom center text
- Severity chart: Doughnut chart with legend
- Category chart: Horizontal bar chart
- Responsive and accessible

#### Framework
- Use React components
- Tailwind CSS for styling
- TypeScript for type safety
- Make components reusable across report types

#### Responsive Breakpoints
- Mobile: 320px - 767px (stacked layout)
- Tablet: 768px - 1023px (adjusted spacing)
- Desktop: 1024px+ (full layout)

## Component Structure Needed

### 1. Threat Snapshot Template
```jsx
// Main dashboard view with:
<ReportHeader company="TechCorp" domain="techcorp.com" date="2024-01-15" />
<RiskScoreGauge score={72} />
<FinancialImpactCards data={financialData} />
<SeverityChart data={severityCounts} />
<CategoryChart data={findingTypes} />
<CriticalFindingsTable findings={criticalFindings} />
```

### 2. Reusable Components
```jsx
<SeverityBadge severity="CRITICAL" />
<CurrencyDisplay value={425000} />
<ChartContainer title="Findings by Severity">
  <Chart.js config />
</ChartContainer>
<FindingCard finding={findingData} expandable />
```

## Implementation Notes

### Dummy Data Usage
- Create realistic but obviously fake company names
- Use placeholder domains (example.com, test.com)
- Include variety in finding types and severities
- Make financial numbers realistic for mid-size businesses
- Add enough data to test edge cases (empty states, large numbers)

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios
- Alt text for charts and visual elements

### Performance
- Lazy load charts when visible
- Optimize for fast initial render
- Keep bundle size reasonable
- Progressive enhancement approach

## Future Integration Notes
Once templates are designed, we'll:
1. Replace dummy data with Supabase queries
2. Add real-time data updates
3. Implement PDF export functionality
4. Add email template variants
5. Create white-label customization options

The goal is professional, executive-ready cybersecurity reports that clearly communicate business risk and required actions. Focus on clarity, visual impact, and actionable insights rather than technical complexity.