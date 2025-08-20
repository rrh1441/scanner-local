#!/bin/bash

# Deploy Report Generation Service for DealBrief Scanner

set -e

echo "========================================="
echo "📄 Deploying Report Generation Service"
echo "========================================="
echo ""

PROJECT_ID="precise-victory-467219-s4"
REGION="us-central1"
SERVICE_NAME="scanner-reports"

# Step 1: Create the report generation service
echo "📋 Creating report generation Cloud Run service..."
echo "----------------------------------------"

# First, we need to create the report generation code
mkdir -p report-service

cat > report-service/package.json <<'EOF'
{
  "name": "scanner-reports",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@google-cloud/firestore": "^7.1.0",
    "@google-cloud/storage": "^7.7.0",
    "handlebars": "^4.7.8",
    "puppeteer": "^21.6.0"
  }
}
EOF

cat > report-service/index.js <<'EOF'
const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const firestore = new Firestore();
const storage = new Storage();
const BUCKET_NAME = 'dealbrief-reports';

// EAL calculation function
function calculateEAL(finding) {
  const baseCosts = {
    'CRITICAL': 250000,
    'HIGH': 50000,
    'MEDIUM': 10000,
    'LOW': 2500,
    'INFO': 500
  };
  
  const base = baseCosts[finding.severity] || 0;
  const epssMultiplier = finding.epss_score > 0.9 ? 10 :
                         finding.epss_score > 0.5 ? 5 :
                         finding.epss_score > 0.1 ? 2 :
                         finding.epss_score > 0.01 ? 1.2 : 1;
  
  return {
    eal_low: base * 0.6 * epssMultiplier,
    eal_ml: base * epssMultiplier,
    eal_high: base * 1.4 * epssMultiplier,
    eal_daily: (base * epssMultiplier) / 365
  };
}

// Generate report HTML
async function generateReportHTML(scanId, reportType) {
  // Fetch scan data
  const scanDoc = await firestore.collection('scans').doc(scanId).get();
  const scanData = scanDoc.data();
  
  // Fetch findings
  const findingsSnapshot = await firestore.collection('findings')
    .where('scan_id', '==', scanId)
    .get();
  
  const findings = [];
  let totalEAL = 0;
  
  findingsSnapshot.forEach(doc => {
    const finding = doc.data();
    const eal = calculateEAL(finding);
    finding.eal = eal;
    totalEAL += eal.eal_ml;
    findings.push(finding);
  });
  
  // Sort by severity and EAL
  findings.sort((a, b) => {
    const severityOrder = {'CRITICAL': 5, 'HIGH': 4, 'MEDIUM': 3, 'LOW': 2, 'INFO': 1};
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.eal.eal_ml - a.eal.eal_ml;
  });
  
  // Filter based on report type
  let filteredFindings = findings;
  if (reportType === 'summary') {
    filteredFindings = findings.filter(f => ['CRITICAL', 'HIGH'].includes(f.severity)).slice(0, 5);
  } else if (reportType === 'standard') {
    filteredFindings = findings.filter(f => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(f.severity));
  }
  
  // Generate HTML
  const template = \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Security Assessment Report - {{company_name}}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; margin: -40px -40px 40px -40px; }
    .summary-box { background: #f8f9fa; padding: 20px; border-left: 4px solid #3498db; margin: 20px 0; }
    .critical { color: #e74c3c; font-weight: bold; }
    .high { color: #e67e22; font-weight: bold; }
    .medium { color: #f39c12; }
    .low { color: #95a5a6; }
    .finding { background: white; border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .eal-badge { background: #e74c3c; color: white; padding: 5px 10px; border-radius: 3px; display: inline-block; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: bold; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security Assessment Report</h1>
    <div style="font-size: 1.2em; margin-top: 10px;">{{company_name}} - {{domain}}</div>
    <div style="margin-top: 10px;">Scan Date: {{scan_date}}</div>
  </div>
  
  <div class="summary-box">
    <h2>Executive Summary</h2>
    <p><strong>Total Annual Loss Exposure:</strong> <span class="eal-badge">\${{total_eal}}</span></p>
    <p><strong>Critical Findings:</strong> {{critical_count}} | <strong>High:</strong> {{high_count}} | <strong>Medium:</strong> {{medium_count}}</p>
    <p><strong>Overall Risk Score:</strong> {{risk_score}}/100</p>
  </div>
  
  <h2>Key Findings</h2>
  {{#each findings}}
  <div class="finding">
    <h3><span class="{{severity_class}}">{{severity}}</span> - {{finding_type}}</h3>
    <p><strong>Expected Annual Loss:</strong> \${{eal.eal_ml}}</p>
    <p>{{description}}</p>
    <p><strong>Recommendation:</strong> {{recommendation}}</p>
  </div>
  {{/each}}
  
  <div class="footer">
    <p>Generated by DealBrief Scanner | Confidential</p>
  </div>
</body>
</html>
\`;
  
  const compiledTemplate = Handlebars.compile(template);
  
  return compiledTemplate({
    company_name: scanData.company_name || 'Unknown Company',
    domain: scanData.domain || scanData.target,
    scan_date: new Date(scanData.created_at).toLocaleDateString(),
    total_eal: totalEAL.toLocaleString(),
    critical_count: findings.filter(f => f.severity === 'CRITICAL').length,
    high_count: findings.filter(f => f.severity === 'HIGH').length,
    medium_count: findings.filter(f => f.severity === 'MEDIUM').length,
    risk_score: Math.min(100, Math.round(totalEAL / 10000)),
    findings: filteredFindings.map(f => ({
      ...f,
      severity_class: f.severity.toLowerCase(),
      eal: {
        eal_ml: f.eal.eal_ml.toLocaleString()
      }
    }))
  });
}

// Generate PDF from HTML
async function generatePDF(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
  });
  
  await browser.close();
  return pdf;
}

// API endpoint to generate report
app.post('/generate', async (req, res) => {
  try {
    const { scanId, reportType = 'standard', format = 'both' } = req.body;
    
    if (!scanId) {
      return res.status(400).json({ error: 'scanId is required' });
    }
    
    console.log(\`Generating \${reportType} report for scan \${scanId}\`);
    
    // Generate HTML
    const html = await generateReportHTML(scanId, reportType);
    
    const outputs = {};
    const timestamp = Date.now();
    
    // Save HTML
    if (format === 'html' || format === 'both') {
      const htmlFileName = \`reports/\${scanId}_\${reportType}_\${timestamp}.html\`;
      const htmlFile = storage.bucket(BUCKET_NAME).file(htmlFileName);
      await htmlFile.save(html, { contentType: 'text/html' });
      
      const [htmlUrl] = await htmlFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      outputs.html_url = htmlUrl;
    }
    
    // Generate and save PDF
    if (format === 'pdf' || format === 'both') {
      const pdf = await generatePDF(html);
      const pdfFileName = \`reports/\${scanId}_\${reportType}_\${timestamp}.pdf\`;
      const pdfFile = storage.bucket(BUCKET_NAME).file(pdfFileName);
      await pdfFile.save(pdf, { contentType: 'application/pdf' });
      
      const [pdfUrl] = await pdfFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      outputs.pdf_url = pdfUrl;
    }
    
    // Save report metadata
    await firestore.collection('reports').add({
      scan_id: scanId,
      report_type: reportType,
      format: format,
      ...outputs,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    
    res.json({
      success: true,
      ...outputs
    });
    
  } catch (error) {
    console.error('Report generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'scanner-reports' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(\`Report service listening on port \${PORT}\`);
});
EOF

cat > report-service/Dockerfile <<'EOF'
FROM node:18-slim

# Install Chromium for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 8080
CMD ["npm", "start"]
EOF

echo "📋 Building and deploying report service..."
echo "----------------------------------------"

cd report-service

# Build and deploy
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --project=$PROJECT_ID

gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --max-instances=10 \
  --project=$PROJECT_ID

# Create reports bucket if it doesn't exist
echo ""
echo "📋 Creating storage bucket for reports..."
echo "----------------------------------------"

gsutil mb -p $PROJECT_ID -l $REGION gs://dealbrief-reports 2>/dev/null || echo "Bucket already exists"

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)")

echo ""
echo "========================================="
echo "✅ Report Service Deployed Successfully!"
echo "========================================="
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "To generate a report, use:"
echo "curl -X POST $SERVICE_URL/generate \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"scanId\": \"YOUR_SCAN_ID\", \"reportType\": \"standard\", \"format\": \"both\"}'"
echo ""

cd ..