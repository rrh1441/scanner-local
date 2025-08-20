# Visual Report Templates & Recommendations

## Executive Summary

Based on analysis of the DealBrief security scanner codebase, this document outlines recommendations for implementing HTML-based visual reports with interactive charts and professional styling.

## Current Data Assets

### Financial Impact Data
- **EAL Calculations**: Low/ML/High confidence ranges + daily costs
- **Cost Categories**: Legal liability, cloud abuse, data breach exposure
- **Temporal Modifiers**: One-time vs recurring costs

### Security Findings Data
- **Severity Levels**: CRITICAL, HIGH, MEDIUM, LOW, INFO
- **Finding Types**: 20+ categories including:
  - `DENIAL_OF_WALLET` - Cloud cost amplification
  - `ADA_LEGAL_CONTINGENT_LIABILITY` - Legal compliance
  - `DATA_BREACH_EXPOSURE` - Data exposure risks
  - `CLIENT_SIDE_SECRET_EXPOSURE` - Credential leaks
  - `VERIFIED_CVE` - Known vulnerabilities
  - `MALICIOUS_TYPOSQUAT` - Brand protection

### Asset Coverage Data
- **Domains & Subdomains**: Discovery and enumeration results
- **Infrastructure**: IP addresses, ports, services
- **Timeline**: Scan dates, artifact discovery times

## Recommended HTML Template Architecture

### Template Structure
```
reports/
├── templates/
│   ├── threat_snapshot.html
│   ├── executive_summary.html
│   ├── technical_remediation.html
│   └── shared/
│       ├── header.html
│       ├── charts.js
│       └── styles.css
├── assets/
│   ├── css/
│   │   └── report.css
│   └── js/
│       ├── chart.min.js
│       └── report-charts.js
└── generated/
    └── [scan_id]/
        ├── threat_snapshot.html
        ├── executive_summary.html
        └── technical_remediation.html
```

## Visual Components by Report Type

### 1. Threat Snapshot (Executive Dashboard)

#### Key Visualizations
- **Risk Score Gauge** (0-100)
- **Financial Impact Cards** with trend indicators
- **Severity Distribution** donut chart
- **Category Breakdown** horizontal bar chart
- **Timeline Summary** progress indicator

#### Template Structure
```html
<!DOCTYPE html>
<html>
<head>
    <title>{{company_name}} - Cybersecurity Threat Snapshot</title>
    <link rel="stylesheet" href="../assets/css/report.css">
    <script src="../assets/js/chart.min.js"></script>
</head>
<body>
    <!-- Header Section -->
    <header class="report-header">
        <h1>{{company_name}} — Cybersecurity Threat Snapshot</h1>
        <div class="scan-meta">
            <span>Domain: {{domain}}</span>
            <span>Scan Date: {{scan_date}}</span>
        </div>
    </header>

    <!-- Executive Dashboard -->
    <section class="dashboard">
        <div class="risk-score-card">
            <canvas id="riskGauge"></canvas>
            <h3>Overall Risk Score</h3>
            <span class="score">{{overall_risk_score}}/100</span>
        </div>
        
        <div class="financial-cards">
            <div class="eal-card critical">
                <h4>Annual Loss Exposure</h4>
                <span class="amount">${{eal_ml_total | currency}}</span>
                <span class="range">${{eal_low_total | currency}} - ${{eal_high_total | currency}}</span>
            </div>
            <div class="eal-card daily">
                <h4>Daily Cost Risk</h4>
                <span class="amount">${{eal_daily_total | currency}}</span>
                <span class="label">Per day if exploited</span>
            </div>
        </div>
    </section>

    <!-- Visual Analytics -->
    <section class="analytics">
        <div class="chart-container">
            <canvas id="severityChart"></canvas>
            <h3>Findings by Severity</h3>
        </div>
        <div class="chart-container">
            <canvas id="categoryChart"></canvas>
            <h3>Risk Categories</h3>
        </div>
    </section>

    <!-- Key Findings Table -->
    <section class="findings-summary">
        <h2>Critical & High Priority Actions</h2>
        <table class="findings-table">
            <thead>
                <tr>
                    <th>Severity</th>
                    <th>Finding Type</th>
                    <th>Asset</th>
                    <th>Financial Impact</th>
                    <th>Action Required</th>
                </tr>
            </thead>
            <tbody>
                {{#each critical_findings}}
                <tr class="severity-{{severity}}">
                    <td><span class="severity-badge {{severity}}">{{severity}}</span></td>
                    <td>{{finding_type_display}}</td>
                    <td>{{asset_name}}</td>
                    <td>${{eal_ml | currency}}</td>
                    <td>{{remediation_summary}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>
    </section>

    <script src="../assets/js/report-charts.js"></script>
    <script>
        // Initialize charts with data
        initThreatSnapshot({
            riskScore: {{overall_risk_score}},
            severityData: {
                critical: {{critical_count}},
                high: {{high_count}},
                medium: {{medium_count}},
                low: {{low_count}}
            },
            categoryData: {{category_breakdown | json}},
            financialData: {
                ealLow: {{eal_low_total}},
                ealMl: {{eal_ml_total}},
                ealHigh: {{eal_high_total}},
                ealDaily: {{eal_daily_total}}
            }
        });
    </script>
</body>
</html>
```

### 2. Executive Summary (Strategic Overview)

#### Key Visualizations
- **Security Posture Timeline** (historical if available)
- **Risk Heat Map** by category and severity
- **Cost-Benefit Analysis** charts for remediation
- **Industry Benchmark** comparison
- **Threat Landscape** visualization

#### Enhanced Features
- **Interactive Risk Matrix** - Click to drill down
- **ROI Calculator** for remediation investments
- **Compliance Dashboard** (GDPR, PCI, ADA status)

### 3. Technical Remediation (Implementation Guide)

#### Key Visualizations
- **Remediation Timeline** Gantt chart
- **Vulnerability Details** expandable cards
- **Asset Dependency Map** network visualization
- **Progress Tracker** for implemented fixes
- **Technical Metrics** dashboard

#### Interactive Elements
- **Filterable Finding List** by severity/type/asset
- **Remediation Checklist** with progress tracking
- **Code Example Viewer** with syntax highlighting

## Chart Library Recommendations

### Primary Choice: Chart.js
**Pros**: Simple, lightweight, good documentation, responsive
**Best for**: Basic charts (pie, bar, line, gauge)

```javascript
// Example Risk Gauge Implementation
const riskGaugeConfig = {
    type: 'doughnut',
    data: {
        datasets: [{
            data: [riskScore, 100 - riskScore],
            backgroundColor: ['#dc2626', '#f3f4f6'],
            borderWidth: 0
        }]
    },
    options: {
        circumference: 180,
        rotation: 270,
        cutout: '75%',
        plugins: {
            legend: { display: false }
        }
    }
};
```

### Secondary Choice: D3.js
**Pros**: Highly customizable, advanced visualizations
**Best for**: Complex network diagrams, custom interactions

### Tertiary Choice: Plotly.js
**Pros**: Professional appearance, built-in interactivity
**Best for**: Scientific/financial charts, 3D visualizations

## CSS Framework & Styling

### Recommended: Tailwind CSS
- **Utility-first** approach for rapid development
- **Responsive** design out of the box
- **Customizable** color schemes for severity levels

### Color Scheme
```css
:root {
    --critical: #dc2626;    /* Red 600 */
    --high: #ea580c;        /* Orange 600 */
    --medium: #d97706;      /* Amber 600 */
    --low: #16a34a;         /* Green 600 */
    --info: #2563eb;        /* Blue 600 */
    
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --text-primary: #1e293b;
    --text-secondary: #64748b;
}

.severity-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.severity-badge.CRITICAL { background: var(--critical); color: white; }
.severity-badge.HIGH { background: var(--high); color: white; }
.severity-badge.MEDIUM { background: var(--medium); color: white; }
.severity-badge.LOW { background: var(--low); color: white; }
```

## Template Engine Integration

### Recommended: Handlebars.js
```javascript
// Example helper functions
Handlebars.registerHelper('currency', function(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    }).format(value);
});

Handlebars.registerHelper('severity_class', function(severity) {
    return severity.toLowerCase();
});

Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});
```

## Implementation Roadmap

### Phase 1: Basic HTML Templates (1-2 weeks)
1. Create base HTML templates for each report type
2. Implement Chart.js for basic visualizations
3. Add Tailwind CSS for styling
4. Set up template rendering pipeline

### Phase 2: Interactive Features (2-3 weeks)
1. Add filtering and sorting to tables
2. Implement drill-down navigation
3. Create responsive design for mobile
4. Add print-friendly CSS

### Phase 3: Advanced Visualizations (2-4 weeks)
1. Asset network diagrams with D3.js
2. Interactive timeline for remediation tracking
3. Real-time data updates (if applicable)
4. Custom dashboard builder

### Phase 4: Export & Integration (1-2 weeks)
1. PDF generation with Puppeteer
2. Email delivery with embedded images
3. API endpoints for external integration
4. White-label customization options

## Template Data Model

### Report Context Object
```typescript
interface ReportContext {
    // Meta information
    company_name: string;
    domain: string;
    scan_date: string;
    scan_id: string;
    
    // Severity counts
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    info_count: number;
    
    // Financial data
    eal_low_total: number;
    eal_ml_total: number;
    eal_high_total: number;
    eal_daily_total: number;
    
    // Risk assessment
    overall_risk_score: number;
    security_posture: 'Excellent' | 'Good' | 'Needs Improvement' | 'Critical';
    
    // Findings data
    critical_findings: Finding[];
    high_findings: Finding[];
    all_findings: Finding[];
    
    // Category breakdown
    category_breakdown: CategorySummary[];
    
    // Assets
    assets_scanned: Asset[];
    exposed_services: Service[];
}

interface Finding {
    id: number;
    finding_type: string;
    finding_type_display: string;
    severity: string;
    description: string;
    asset_name: string;
    remediation_summary: string;
    eal_ml: number;
    cve_id?: string;
    cvss_score?: number;
}
```

## File Organization

### Recommended Structure
```
apps/workers/templates/
├── layouts/
│   ├── base.html           # Common HTML structure
│   └── print.html          # Print-optimized layout
├── partials/
│   ├── header.html         # Report header component
│   ├── footer.html         # Report footer component
│   ├── severity-badge.html # Reusable severity badge
│   └── finding-card.html   # Finding detail card
├── reports/
│   ├── threat-snapshot.html
│   ├── executive-summary.html
│   └── technical-remediation.html
└── assets/
    ├── css/
    │   ├── report.css      # Main report styles
    │   └── print.css       # Print-specific styles
    ├── js/
    │   ├── charts.js       # Chart initialization
    │   ├── interactions.js # Interactive features
    │   └── vendor/         # Third-party libraries
    └── images/
        ├── logo.png
        └── icons/
```

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Load charts only when visible
2. **Data Pagination**: Limit large finding tables
3. **Image Optimization**: Use SVG for icons and simple graphics
4. **Caching**: Cache generated templates for repeat access
5. **Minification**: Compress CSS/JS for production

### Bundle Size Targets
- **Chart.js**: ~200KB (acceptable for functionality)
- **Tailwind CSS**: ~10KB (purged)
- **Custom JS**: <50KB
- **Total Bundle**: <300KB

## Next Steps

1. **Create base template structure** with placeholder data
2. **Implement Chart.js integration** for basic visualizations
3. **Set up Handlebars rendering** in the report generator function
4. **Design responsive CSS** with Tailwind utilities
5. **Test with real scan data** and iterate on design
6. **Add PDF export capability** using Puppeteer

This approach will transform your current markdown reports into professional, interactive HTML documents that provide much better user experience while maintaining the AI-generated content quality you already have.

### Delivering the **Threat Snapshot** by e-mail — key requirements and concrete implementation plan

---

| Constraint                                                                        | Practical approach                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must render identically in every major mail client (Outlook desktop included)** | 1. **Fully inline CSS** (no `<link>`).<br>2. Layout built from nested tables 600 px wide (the only reliably supported layout primitive in Outlook).<br>3. Use `<img>` (PNG or SVG) for every chart and gauge — never `<canvas>` or `<script>`.                                                                                                                                    |
| **Needs the same “wow factor” as the interactive HTML page**                      | 1. Generate charts **server-side** at report-build time (node-canvas, Chart.js on a headless context, or QuickChart.io).<br>2. Use **CID-embedded images** so they load without external requests; also attach a fallback hosted URL.<br>3. Retain colour palette and typography from the web report (Google Fonts render fine in most modern clients; specify robust fallbacks). |
| **Mobile friendly**                                                               | 1. Constrain main table to `max-width:600px` and add `width:100%`.<br>2. For stacked KPI “cards”, switch each card from a 3-column table row to individual 100 %-width rows under a `@media only screen and (max-width:480px)` block (supported by Gmail, Apple Mail, iOS Mail).                                                                                                  |
| **PDF export still required**                                                     | Use the *same* server-side HTML with inline CSS; generate PDF with Puppeteer **before** inlining the images as CIDs so the PDF shows the hosted URLs.                                                                                                                                                                                                                             |

---

#### Minimal MJML source (safer than writing raw table markup)

```mjml
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-class name="kpi" padding="16px" border-radius="8px" font-size="14px" font-family="Inter, Arial, sans-serif"/>
    </mj-attributes>
    <mj-style inline="inline">
      .risk-badge {font-weight:700;text-transform:uppercase;padding:4px 8px;border-radius:4px;color:#fff}
      .critical {background:#dc2626}
      .high {background:#ea580c}
    </mj-style>
  </mj-head>
  <mj-body background-color="#f8fafc">
    <mj-section background-color="#ffffff" padding="0">
      <mj-column>
        <mj-image width="120px" src="cid:logo@dealbrief"/>
        <mj-text font-size="20px" font-weight="600">Cybersecurity Threat Snapshot</mj-text>
        <mj-text font-size="12px" color="#64748b">{{company_name}} – {{scan_date}}</mj-text>
      </mj-column>
    </mj-section>

    <!-- KPI block -->
    <mj-section>
      <mj-column mj-class="kpi" background-color="#fee2e2">
        <mj-image width="140" src="cid:riskGauge@dealbrief" alt="Risk gauge"/>
        <mj-text align="center" font-size="28px" font-weight="700">{{overall_risk_score}}/100</mj-text>
        <mj-text align="center">Overall Risk</mj-text>
      </mj-column>
      <mj-column mj-class="kpi" background-color="#fef6e8">
        <mj-image width="140" src="cid:ealCard@dealbrief" alt="Annual loss exposure"/>
        <mj-text align="center" font-size="20px" font-weight="700">${{eal_ml_total}}</mj-text>
        <mj-text align="center">Annual Loss (ML)</mj-text>
      </mj-column>
    </mj-section>

    <!-- Severity distribution -->
    <mj-section>
      <mj-column>
        <mj-image src="cid:severityChart@dealbrief" alt="Findings by severity" width="560"/>
      </mj-column>
    </mj-section>

    <!-- Critical findings table -->
    <mj-section background-color="#ffffff" padding="0">
      <mj-column>
        <mj-text font-size="18px" font-weight="600">Top Critical Findings</mj-text>
        <mj-table font-size="12px" cellpadding="6">
          <tr style="background:#f1f5f9">
            <th align="left">Severity</th><th align="left">Finding</th><th align="left">Asset</th><th align="left">Impact</th>
          </tr>
          {{#each critical_findings}}
          <tr>
            <td><span class="risk-badge critical">CRITICAL</span></td>
            <td>{{finding_type_display}}</td>
            <td>{{asset_name}}</td>
            <td>${{eal_ml}}</td>
          </tr>
          {{/each}}
        </mj-table>
      </mj-column>
    </mj-section>

    <!-- CTA -->
    <mj-section background-color="#ffffff">
      <mj-column>
        <mj-button href="{{full_report_url}}" background-color="#2563eb" color="#ffffff" font-size="14px" padding="16px">
          View Full Interactive Report
        </mj-button>
      </mj-column>
    </mj-section>

    <mj-section>
      <mj-column>
        <mj-text font-size="11px" color="#94a3b8">© {{year}} DealBrief | This snapshot is confidential…</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

**Why MJML?**

* It compiles to bulletproof table-based HTML with inline styles and VML fallbacks for Outlook.
* You can keep “semantic” markup during authoring; your build step (`mjml-cli` or the JS API) runs immediately before the Handlebars rendering that injects data and CID hashes.

---

#### Server-side generation workflow

1. **Render data → Handlebars → raw MJML.**
2. **`mjml-cli` → e-mail-safe HTML (all styles inlined).**
3. For each chart:

   * Use Chart.js on a headless canvas → PNG → save to disk.
   * Attach as `attachments: [{filename:'riskGauge.png', cid:'riskGauge@dealbrief', path:'...'}]` via Nodemailer (or similar).
4. Send the compiled HTML with the CID attachments.

> **Testing**: run the output through Litmus or Email on Acid; validate Outlook 2016/2019, Gmail web/mobile, Apple Mail, Yahoo, and older Android clients.

---

#### Outlook-specific caveats

* Use `width` and `height` attributes on every `<img>` to prevent squashing.
* Avoid CSS shorthand like `padding:16px 24px`; expand to four-value form.
* No `border-radius` on `<img>`; wrap the image in a `<table>` cell with `background` colour if you need rounded KPI cards.

---

#### Keeping the “wow factor”

* **High DPI charts**: render at 2× the displayed width (e.g. 1120×), then set `width="560"` in `<img>` — crisp on retina screens.
* **Consistent brand colours**: define them once in MJML `<mj-style inline>` (automatically inlined).
* **Optional micro-animation**: animated GIF progress bar is acceptable (still renders everywhere), but keep under 200 KB.

---

### Summary checklist

1. **MJML template built around 600 px table layout.**
2. **Server-side Chart.js → PNG → CID images.**
3. **Inline CSS only; no JS.**
4. **Litmus pass on Outlook, Gmail, iOS, Android.**
5. **Link to full interactive report for deeper drill-down.**

Implementing the above guarantees the threat snapshot looks identical in every mail client while preserving the polished visuals that make it a compelling lead magnet.
