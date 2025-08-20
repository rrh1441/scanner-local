import { config } from 'dotenv';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';
import { PubSub } from '@google-cloud/pubsub';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import express from 'express';
import { readFileSync } from 'fs';
import { nanoid } from 'nanoid';

config();

// Initialize Firebase, GCS, and Pub/Sub
const app = initializeApp();
const db = getFirestore(app);
const storage = new Storage();
const pubsub = new PubSub();
const reportsBucket = storage.bucket(process.env.GCS_REPORTS_BUCKET || 'dealbrief-reports');

function log(...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [report-gen]`, ...args);
}

interface ReportRequest {
  scanId: string;
  reportType?: 'summary' | 'standard' | 'detailed';
  format?: 'html' | 'pdf' | 'both';
  timestamp?: string;
}

interface ScanData {
  scan_id: string;
  company_name: string;
  domain: string;
  status: string;
  created_at: Date;
  completed_at: Date;
  total_findings: number;
  max_severity: string;
}

interface Finding {
  finding_type: string;
  description: string;
  recommendation: string;
  severity: string;
  eal_estimate: number;
  attack_type_code: string;
  src_url?: string;
  created_at: Date;
}

// Cost attribution aggregation
function aggregateFinancialImpact(findings: Finding[]) {
  const totals = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total_annual_loss: 0,
    by_attack_type: {} as Record<string, number>
  };
  
  findings.forEach(finding => {
    const eal = finding.eal_estimate || 0;
    totals.total_annual_loss += eal;
    
    // Group by severity
    switch (finding.severity) {
      case 'CRITICAL': totals.critical += eal; break;
      case 'HIGH': totals.high += eal; break;
      case 'MEDIUM': totals.medium += eal; break;
      case 'LOW': totals.low += eal; break;
    }
    
    // Group by attack type
    const attackType = finding.attack_type_code || 'OTHER';
    totals.by_attack_type[attackType] = (totals.by_attack_type[attackType] || 0) + eal;
  });
  
  return totals;
}

// Load HTML template
const REPORT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Assessment Report - {{company_name}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .executive-summary { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .findings-section { margin: 30px 0; }
        .finding { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .finding.critical { border-left: 5px solid #dc3545; }
        .finding.high { border-left: 5px solid #fd7e14; }
        .finding.medium { border-left: 5px solid #ffc107; }
        .finding.low { border-left: 5px solid #28a745; }
        .financial-impact { background: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .eal-amount { font-weight: bold; color: #d32f2f; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Assessment Report</h1>
        <h2>{{company_name}}</h2>
        <p><strong>Domain:</strong> {{domain}}</p>
        <p><strong>Scan Date:</strong> {{scan_date}}</p>
        <p><strong>Report Type:</strong> {{report_type}}</p>
    </div>

    <div class="executive-summary">
        <h2>Executive Summary</h2>
        <p><strong>Total Findings:</strong> {{total_findings}}</p>
        <p><strong>Risk Level:</strong> {{max_severity}}</p>
        <p><strong>Estimated Annual Loss:</strong> <span class="eal-amount">\${{total_eal}}</span></p>
        <p>This security assessment identified {{total_findings}} potential vulnerabilities across your digital infrastructure.</p>
    </div>

    <div class="financial-impact">
        <h2>Financial Impact Analysis</h2>
        <table>
            <tr><th>Risk Category</th><th>Estimated Annual Loss</th><th>Percentage</th></tr>
            {{#each financial_breakdown}}
            <tr>
                <td>{{category}}</td>
                <td>\${{amount}}</td>
                <td>{{percentage}}%</td>
            </tr>
            {{/each}}
        </table>
    </div>

    <div class="findings-section">
        <h2>Security Findings</h2>
        {{#each findings}}
        <div class="finding {{severity_class}}">
            <h3>{{finding_type}} <span class="eal-amount">(\${{eal_estimate}})</span></h3>
            <p><strong>Severity:</strong> {{severity}}</p>
            <p><strong>Description:</strong> {{description}}</p>
            <p><strong>Recommendation:</strong> {{recommendation}}</p>
            {{#if src_url}}<p><strong>Source:</strong> {{src_url}}</p>{{/if}}
        </div>
        {{/each}}
    </div>

    <div class="footer">
        <p><small>Report generated on {{generated_at}} by DealBrief Security Scanner</small></p>
    </div>
</body>
</html>
`;

async function fetchScanData(scanId: string): Promise<{ scan: ScanData; findings: Finding[] }> {
  // Get scan metadata
  const scanDoc = await db.collection('scans').doc(scanId).get();
  if (!scanDoc.exists) {
    throw new Error(`Scan ${scanId} not found`);
  }
  
  const scan = scanDoc.data() as ScanData;
  
  // Get findings
  const findingsSnapshot = await db
    .collection('scans')
    .doc(scanId)
    .collection('findings')
    .orderBy('severity', 'desc')
    .orderBy('eal_estimate', 'desc')
    .get();
    
  const findings = findingsSnapshot.docs.map(doc => doc.data() as Finding);
  
  return { scan, findings };
}

async function generateHTMLReport(scanId: string, reportType: string): Promise<string> {
  log(`📄 Generating ${reportType} HTML report for scan ${scanId}`);
  
  const { scan, findings } = await fetchScanData(scanId);
  const financialImpact = aggregateFinancialImpact(findings);
  
  // Filter findings based on report type
  let filteredFindings = findings;
  if (reportType === 'summary') {
    filteredFindings = findings.filter(f => ['CRITICAL', 'HIGH'].includes(f.severity)).slice(0, 5);
  } else if (reportType === 'standard') {
    filteredFindings = findings.filter(f => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(f.severity));
  }
  
  // Prepare template data
  const templateData = {
    company_name: scan.company_name,
    domain: scan.domain,
    scan_date: scan.completed_at.toLocaleDateString(),
    report_type: reportType.toUpperCase(),
    total_findings: filteredFindings.length,
    max_severity: scan.max_severity,
    total_eal: financialImpact.total_annual_loss.toLocaleString(),
    generated_at: new Date().toLocaleString(),
    financial_breakdown: Object.entries(financialImpact.by_attack_type).map(([category, amount]) => ({
      category: category.replace(/_/g, ' '),
      amount: amount.toLocaleString(),
      percentage: Math.round((amount / financialImpact.total_annual_loss) * 100)
    })),
    findings: filteredFindings.map(f => ({
      ...f,
      severity_class: f.severity.toLowerCase(),
      eal_estimate: f.eal_estimate?.toLocaleString() || '0'
    }))
  };
  
  // Compile and render template
  const template = Handlebars.compile(REPORT_TEMPLATE);
  const htmlContent = template(templateData);
  
  return htmlContent;
}

async function generatePDFFromHTML(htmlContent: string): Promise<Buffer> {
  log('🔄 Converting HTML to PDF with optimized Chromium');
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
    });
    
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

async function uploadToGCS(content: string | Buffer, fileName: string, mimeType: string): Promise<string> {
  const file = reportsBucket.file(fileName);
  
  await file.save(content, {
    metadata: { contentType: mimeType },
    public: false // Use signed URLs for access
  });
  
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  return url;
}

async function generateReport(request: ReportRequest): Promise<{ reportId: string; htmlUrl?: string; pdfUrl?: string }> {
  const { scanId, reportType = 'standard', format = 'both' } = request;
  const reportId = nanoid(11);
  
  log(`🎯 Generating ${reportType} report for scan ${scanId} in ${format} format`);
  
  try {
    // Generate HTML content
    const htmlContent = await generateHTMLReport(scanId, reportType);
    
    let htmlUrl: string | undefined;
    let pdfUrl: string | undefined;
    
    // Upload HTML if requested
    if (format === 'html' || format === 'both') {
      const htmlFileName = `reports/${scanId}_${reportType}_${reportId}.html`;
      htmlUrl = await uploadToGCS(htmlContent, htmlFileName, 'text/html');
      log(`📄 HTML report uploaded: ${htmlFileName}`);
    }
    
    // Generate and upload PDF if requested
    if (format === 'pdf' || format === 'both') {
      const pdfBuffer = await generatePDFFromHTML(htmlContent);
      const pdfFileName = `reports/${scanId}_${reportType}_${reportId}.pdf`;
      pdfUrl = await uploadToGCS(pdfBuffer, pdfFileName, 'application/pdf');
      log(`📄 PDF report uploaded: ${pdfFileName}`);
    }
    
    // Store report metadata in Firestore
    await db.collection('reports').doc(reportId).set({
      report_id: reportId,
      scan_id: scanId,
      report_type: reportType,
      format,
      html_url: htmlUrl,
      pdf_url: pdfUrl,
      generated_at: new Date(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    
    log(`✅ Report ${reportId} generated successfully`);
    
    return { reportId, htmlUrl, pdfUrl };
    
  } catch (error) {
    log(`❌ Report generation failed:`, error);
    throw error;
  }
}

// Pub/Sub message handler for report generation requests
async function handleReportMessage(message: any): Promise<void> {
  try {
    const requestData = JSON.parse(message.data.toString()) as ReportRequest;
    log(`📨 Received report request: ${requestData.scanId}`);
    
    // Set defaults for optional fields
    const request: ReportRequest = {
      scanId: requestData.scanId,
      reportType: requestData.reportType || 'standard',
      format: requestData.format || 'both'
    };
    
    const result = await generateReport(request);
    message.ack();
    
    log(`✅ Report ${request.scanId} completed and acknowledged`);
    
  } catch (error) {
    log(`❌ Failed to process report message:`, error);
    message.nack();
  }
}

// Main entry point - listens to Pub/Sub for report generation requests
async function main() {
  try {
    log('🚀 Report generator starting...');
    
    // Set up Express server for health checks
    const app = express();
    const port = parseInt(process.env.PORT || '8080');
    
    app.get('/', (req, res) => {
      res.json({ status: 'healthy', service: 'report-generator', timestamp: new Date().toISOString() });
    });
    
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });
    
    const server = app.listen(port, () => {
      log(`🌐 HTTP server listening on port ${port}`);
    });
    
    const subscription = pubsub.subscription('report-generation-subscription');
    
    // Set up message handler
    subscription.on('message', handleReportMessage);
    subscription.on('error', (error) => {
      log('❌ Subscription error:', error);
    });
    
    log('👂 Listening for report requests on report-generation-subscription...');
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      log('🛑 Received SIGINT, closing subscription and server...');
      server.close();
      await subscription.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      log('🛑 Received SIGTERM, closing subscription and server...');
      server.close();
      await subscription.close();
      process.exit(0);
    });
    
  } catch (error) {
    log('💥 Report generator startup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateReport, generateHTMLReport };