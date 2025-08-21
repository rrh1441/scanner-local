import { config } from 'dotenv';
config(); // Load .env file

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { executeScan, ScanJob } from './scan/executeScan.js';
import { LocalStore } from './core/localStore.js';
import handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';

const app = express();
const store = new LocalStore();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Static file serving for reports and artifacts
app.use('/reports', express.static('./scan-reports'));
app.use('/artifacts', express.static('./scan-artifacts'));

// Handlebars helpers
handlebars.registerHelper('toLowerCase', (str: string) => str.toLowerCase());
handlebars.registerHelper('eq', (a: any, b: any) => a === b);

// Report generation functions
async function loadTemplate(): Promise<handlebars.TemplateDelegate> {
  try {
    const templatePath = join(process.cwd(), 'templates', 'report.hbs');
    const templateContent = await readFile(templatePath, 'utf-8');
    return handlebars.compile(templateContent);
  } catch (error) {
    console.error('[Report] Failed to load template:', error);
    throw new Error('Report template not found');
  }
}

async function generatePDF(html: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'Letter',
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      },
      printBackground: true
    });
    
    return pdf;
  } finally {
    await browser.close();
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0-local'
  });
});

// Scan endpoint
app.post('/scan', async (req, res) => {
  const { domain, scan_id = `scan-${nanoid()}`, companyName } = req.body;
  
  console.log(`🚨 SCAN ENDPOINT HIT - NEW LOGIC ACTIVE - scan_id: ${scan_id}`);
  
  if (!domain) {
    return res.status(400).json({ error: 'domain is required' });
  }

  // Basic domain validation
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    return res.status(400).json({ error: 'Invalid domain format' });
  }

  const startTime = Date.now();
  
  console.log(`[Scan] Starting scan for domain: ${domain}, scan_id: ${scan_id}`);
  
  try {
    // Store initial scan record
    await store.insertScan({
      id: scan_id,
      domain: domain.toLowerCase(),
      status: 'running',
      created_at: new Date(),
      findings_count: 0,
      artifacts_count: 0
    });

    // Execute scan (same logic as GCP version)
    console.log(`[Scan] About to call executeScan for ${scan_id}`);
    const result = await executeScan({ scan_id, domain: domain.toLowerCase(), companyName });
    console.log(`[Scan] executeScan completed for ${scan_id}`);
    
    const duration = Date.now() - startTime;
    
    // Count findings and artifacts from database (accurate counts)
    console.log(`[Scan] 🔍 Starting count for scan_id: ${scan_id}`);
    const actualFindings = await store.getFindingsByScanId(scan_id);
    const totalFindings = actualFindings.length;
    console.log(`[Scan] 📊 Database query returned ${totalFindings} findings`);
    let totalArtifacts = 0;
    const moduleStatus: Record<string, any> = {};
    
    // Count artifacts from database  
    try {
      totalArtifacts = await store.getArtifactCount(scan_id);
      console.log(`[Scan] 📦 Database query returned ${totalArtifacts} artifacts`);
    } catch (error) {
      console.error('[Scan] ❌ Failed to count artifacts:', error);
    }
    
    for (const [moduleName, moduleResult] of Object.entries(result.results)) {
      const res = moduleResult as any;
      moduleStatus[moduleName] = {
        status: res.status || 'completed',
        findings: res.findings_count || 0,
        artifacts: res.artifacts_count || 0,
        duration_ms: res.duration_ms || 0
      };
    }
    
    console.log(`[Scan] ✅ FINAL COUNTS for ${scan_id}: ${totalFindings} findings, ${totalArtifacts} artifacts`);

    // Update scan record with completion data
    await store.insertScan({
      id: scan_id,
      domain: domain.toLowerCase(),
      status: 'completed',
      created_at: new Date(startTime),
      completed_at: new Date(),
      findings_count: totalFindings,
      artifacts_count: totalArtifacts,
      duration_ms: duration,
      metadata: {
        ...result.metadata,
        module_status: moduleStatus
      }
    });
    
    console.log(`[Scan] Completed scan ${scan_id} in ${duration}ms with ${totalFindings} findings`);
    
    res.json({ 
      scan_id, 
      status: 'completed',
      domain: domain.toLowerCase(),
      duration_ms: duration,
      findings_count: totalFindings,
      artifacts_count: totalArtifacts,
      modules_completed: Object.keys(result.results).length,
      report_url: `/reports/${scan_id}/report.pdf`,
      results_summary: moduleStatus
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error(`[Scan] Failed scan ${scan_id}:`, error.message);
    
    // Store failed scan record
    await store.insertScan({
      id: scan_id,
      domain: domain.toLowerCase(),
      status: 'failed',
      created_at: new Date(startTime),
      completed_at: new Date(),
      findings_count: 0,
      artifacts_count: 0,
      duration_ms: duration,
      metadata: {
        error_message: error.message,
        error_stack: error.stack
      }
    });
    
    res.status(500).json({ 
      error: 'Scan failed', 
      message: error.message,
      scan_id,
      duration_ms: duration
    });
  }
});

// List scans endpoint
app.get('/scans', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const scans = await store.getRecentScans(limit);
    res.json(scans);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch scans', message: error.message });
  }
});

// Get specific scan details
app.get('/scans/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    const scan = store.getScan(scanId);
    
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    const findings = store.getFindingsByScanId(scanId);
    
    res.json({
      ...scan,
      findings
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch scan details', message: error.message });
  }
});

// Generate report endpoint
app.post('/reports/generate', async (req, res) => {
  const { scan_id } = req.body;
  
  if (!scan_id) {
    return res.status(400).json({ error: 'scan_id is required' });
  }
  
  const startTime = Date.now();
  
  try {
    console.log(`[Report] Generating report for scan: ${scan_id}`);
    
    // Fetch scan data
    const scanData = await store.getScan(scan_id);
    if (!scanData) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    // Fetch findings
    const findings = await store.getFindingsByScanId(scan_id);
    
    // Process data for template
    const severityCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0
    };
    
    findings.forEach((finding: any) => {
      const severity = finding.severity || 'INFO';
      if (severity in severityCounts) {
        severityCounts[severity as keyof typeof severityCounts]++;
      }
    });
    
    const templateData = {
      scan_id,
      domain: scanData.domain || 'unknown',
      scan_date: scanData.created_at.toLocaleDateString(),
      report_date: new Date().toLocaleDateString(),
      duration_seconds: Math.round((scanData.duration_ms || 0) / 1000),
      modules_completed: scanData.metadata?.modules_completed || 0,
      total_findings: findings.length,
      findings: findings.slice(0, 50), // Limit to 50 findings for PDF size
      severity_counts: severityCounts,
      has_critical_findings: severityCounts.CRITICAL > 0
    };
    
    // Generate HTML from template
    const template = await loadTemplate();
    const html = template(templateData);
    
    // Generate PDF
    const pdfBuffer = await generatePDF(html);
    
    // Save report locally
    const reportPath = await store.saveReport(scan_id, Buffer.from(pdfBuffer), 'pdf');
    await store.saveReport(scan_id, Buffer.from(html), 'html');
    
    const duration = Date.now() - startTime;
    
    console.log(`[Report] Report generated in ${duration}ms: ${reportPath}`);
    
    res.json({
      report_url: `/reports/${scan_id}/report.pdf`,
      html_url: `/reports/${scan_id}/report.html`,
      scan_id,
      domain: templateData.domain,
      total_findings: templateData.total_findings,
      severity_counts: templateData.severity_counts,
      generated_at: new Date().toISOString(),
      generation_time_ms: duration,
      status: 'Report generated successfully'
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[Report] Report generation failed:', error);
    
    res.status(500).json({
      error: 'Report generation failed',
      message: error.message,
      scan_id,
      duration_ms: duration
    });
  }
});

// Debug endpoint for testing (same as GCP version but simpler)
app.post('/debug/test-endpoints', async (req, res) => {
  const domain = req.body?.domain;
  if (!domain) return res.status(400).json({ error: 'domain required' });
  
  try {
    const result = await executeScan({ scan_id: `debug-${nanoid()}`, domain });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const port = Number(process.env.PORT ?? 8080);
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Local Scanner Server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔍 Start scan: POST http://localhost:${port}/scan`);
  console.log(`📋 List scans: GET http://localhost:${port}/scans`);
  console.log(`📄 Reports: http://localhost:${port}/reports/{scan_id}/report.pdf`);
});

// Add error handlers for debugging
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  store.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  console.error('Stack:', reason instanceof Error ? reason.stack : 'No stack trace');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  store.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  store.close();
  process.exit(0);
});