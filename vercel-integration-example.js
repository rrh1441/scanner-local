/**
 * Example Vercel API Route for Scanner Integration
 * Save this as: pages/api/scan.js (Pages Router) or app/api/scan/route.js (App Router)
 */

// For Pages Router (pages/api/scan.js)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  // Basic domain validation
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    return res.status(400).json({ error: 'Invalid domain format' });
  }

  try {
    // Replace with your actual ngrok URL or Cloudflare tunnel URL
    const SCANNER_URL = 'https://200e3af44af3.ngrok-free.app'; // Update this URL
    
    const response = await fetch(`${SCANNER_URL}/scan`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // ngrok may require this header to bypass browser warning
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ 
        domain: domain.toLowerCase(),
        scan_id: `web-${Date.now()}`,
        companyName: domain.split('.')[0] // Extract company name from domain
      }),
      // Increase timeout for long-running scans
      timeout: 120000 // 2 minutes
    });

    if (!response.ok) {
      throw new Error(`Scanner returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    res.json({
      success: true,
      scan_id: result.scan_id,
      status: result.status,
      domain: result.domain,
      duration_ms: result.duration_ms,
      findings_count: result.findings_count,
      report_url: `${SCANNER_URL}${result.report_url}`,
      message: 'Security scan completed successfully'
    });

  } catch (error) {
    console.error('Scanner API error:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Scanner service unavailable', 
      message: error.message 
    });
  }
}

// For App Router (app/api/scan/route.js)
export async function POST(request) {
  try {
    const { domain } = await request.json();
    
    if (!domain) {
      return Response.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Basic domain validation
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return Response.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Replace with your actual ngrok URL or Cloudflare tunnel URL
    const SCANNER_URL = 'https://200e3af44af3.ngrok-free.app'; // Update this URL
    
    const response = await fetch(`${SCANNER_URL}/scan`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ 
        domain: domain.toLowerCase(),
        scan_id: `web-${Date.now()}`,
        companyName: domain.split('.')[0]
      })
    });

    if (!response.ok) {
      throw new Error(`Scanner returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    return Response.json({
      success: true,
      scan_id: result.scan_id,
      status: result.status,
      domain: result.domain,
      duration_ms: result.duration_ms,
      findings_count: result.findings_count,
      report_url: `${SCANNER_URL}${result.report_url}`,
      message: 'Security scan completed successfully'
    });

  } catch (error) {
    console.error('Scanner API error:', error);
    
    return Response.json({ 
      success: false,
      error: 'Scanner service unavailable', 
      message: error.message 
    }, { status: 500 });
  }
}

/*
 * Frontend Usage Example:
 * 
 * const handleScan = async (domain) => {
 *   try {
 *     const response = await fetch('/api/scan', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ domain })
 *     });
 *     
 *     const result = await response.json();
 *     
 *     if (result.success) {
 *       console.log(`Scan completed: ${result.findings_count} findings`);
 *       console.log(`Report: ${result.report_url}`);
 *     } else {
 *       console.error('Scan failed:', result.error);
 *     }
 *   } catch (error) {
 *     console.error('Request failed:', error);
 *   }
 * };
 */