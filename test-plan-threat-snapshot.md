# Threat Snapshot Test Plan

## Overview
Comprehensive testing strategy for the ThreatSnapshot component, covering data flow from scan completion through report generation, display, and distribution.

## Test Data Setup

### 1. Supabase Test Scan Data
Create test scans with various scenarios to validate report generation:

```sql
-- Test Scan 1: High-risk scenario with multiple critical findings
INSERT INTO scan_status (scan_id, company_name, domain, status, progress, max_severity, total_findings_count, completed_at)
VALUES ('test_scan_001', 'TechCorp Solutions', 'techcorp.com', 'completed', 100, 'CRITICAL', 45, NOW());

-- Test Scan 2: Low-risk scenario
INSERT INTO scan_status (scan_id, company_name, domain, status, progress, max_severity, total_findings_count, completed_at)
VALUES ('test_scan_002', 'SafeCorp Inc', 'safecorp.com', 'completed', 100, 'MEDIUM', 12, NOW());

-- Test Scan 3: Edge case - No findings
INSERT INTO scan_status (scan_id, company_name, domain, status, progress, max_severity, total_findings_count, completed_at)
VALUES ('test_scan_003', 'SecureCorp Ltd', 'securecorp.com', 'completed', 100, 'INFO', 0, NOW());

-- Test Scan 4: In-progress scan
INSERT INTO scan_status (scan_id, company_name, domain, status, progress, current_module, total_findings_count)
VALUES ('test_scan_004', 'PendingCorp', 'pending.com', 'running', 65, 'nuclei', 8);
```

### 2. Test Artifacts & Findings
```sql
-- High-value critical findings for test_scan_001
INSERT INTO artifacts (type, val_text, severity, src_url, meta) VALUES
('vuln', 'Critical RCE vulnerability in WordPress plugin', 'CRITICAL', 'https://blog.techcorp.com', '{"cve_id": "CVE-2024-1234", "cvss_score": 9.8}'),
('secret', 'AWS access key exposed in JavaScript', 'CRITICAL', 'https://app.techcorp.com/js/config.js', '{"key_type": "aws_access_key"}'),
('crm_exposure', 'Customer database backup publicly accessible', 'HIGH', 'https://backup.techcorp.com/customers.sql', '{"file_size": "2.3GB", "records": 50000}');

-- Create corresponding findings with EAL calculations
INSERT INTO findings (artifact_id, finding_type, severity, description, scan_id, eal_low, eal_ml, eal_high, eal_daily, remediation) VALUES
(1, 'VERIFIED_CVE', 'CRITICAL', 'WordPress plugin vulnerable to remote code execution allowing full server compromise', 'test_scan_001', 95000, 250000, 500000, 5000, '{"summary": "Update plugin to version 2.1.4", "steps": ["Update WordPress plugin", "Review access logs"]}'),
(2, 'CLIENT_SIDE_SECRET_EXPOSURE', 'CRITICAL', 'AWS access key with full S3 permissions exposed in client-side JavaScript', 'test_scan_001', 120000, 300000, 750000, 8000, '{"summary": "Rotate AWS keys immediately", "steps": ["Revoke exposed key", "Generate new key", "Update application"]}'),
(3, 'DATA_BREACH_EXPOSURE', 'HIGH', 'Customer database containing PII accessible without authentication', 'test_scan_001', 200000, 400000, 1000000, 2000, '{"summary": "Secure database access", "steps": ["Enable authentication", "Implement IP restrictions"]}');

-- Medium/Low findings to test severity distribution
INSERT INTO artifacts (type, val_text, severity, src_url) VALUES
('tls_weak', 'TLS 1.0 still enabled on mail server', 'MEDIUM', 'mail.techcorp.com'),
('spf_missing', 'No SPF record configured for domain', 'LOW', 'techcorp.com'),
('subdomain', 'Development subdomain exposed', 'INFO', 'dev.techcorp.com');

INSERT INTO findings (artifact_id, finding_type, severity, description, scan_id, eal_low, eal_ml, eal_high, eal_daily) VALUES
(4, 'TLS_CONFIGURATION_ISSUE', 'MEDIUM', 'Mail server accepts weak TLS 1.0 connections', 'test_scan_001', 5000, 15000, 35000, 50),
(5, 'EMAIL_SECURITY_GAP', 'LOW', 'Missing SPF record allows email spoofing', 'test_scan_001', 2000, 8000, 20000, 25),
(6, 'EXPOSED_SERVICE', 'INFO', 'Development environment accessible from internet', 'test_scan_001', 0, 1000, 5000, 10);
```

### 3. EAL Calculation Test Data
```sql
-- Verify EAL totals for test_scan_001
-- Expected totals: eal_low: 422000, eal_ml: 974000, eal_high: 2310000, eal_daily: 15085

-- Test edge cases
INSERT INTO findings (artifact_id, finding_type, severity, description, scan_id, eal_low, eal_ml, eal_high, eal_daily) VALUES
(NULL, 'DENIAL_OF_WALLET', 'CRITICAL', 'API rate limiting bypass allows unlimited calls. Estimated daily cost: $25000', 'test_scan_001', 750000, 2250000, 9125000, 25000);
```

## Component Testing

### 1. Data Fetching Tests

#### Test Case 1.1: Valid Scan ID
```javascript
describe('ThreatSnapshot Data Fetching', () => {
  test('should fetch report data for valid scan ID', async () => {
    const scanId = 'test_scan_001';
    render(<ThreatSnapshot scanId={scanId} />);
    
    await waitFor(() => {
      expect(screen.getByText('TechCorp Solutions')).toBeInTheDocument();
      expect(screen.getByText('techcorp.com')).toBeInTheDocument();
    });
  });
});
```

#### Test Case 1.2: Invalid Scan ID
```javascript
test('should handle invalid scan ID gracefully', async () => {
  const scanId = 'invalid_scan_999';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('Error Loading Report')).toBeInTheDocument();
  });
});
```

#### Test Case 1.3: Missing Scan ID
```javascript
test('should handle missing scan ID', async () => {
  render(<ThreatSnapshot scanId={null} />);
  
  await waitFor(() => {
    expect(screen.getByText('No scan ID provided')).toBeInTheDocument();
  });
});
```

### 2. Financial Impact Display Tests

#### Test Case 2.1: EAL Values Formatting
```javascript
test('should format large EAL values correctly', async () => {
  const scanId = 'test_scan_001';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('$974,000')).toBeInTheDocument(); // eal_ml_total
    expect(screen.getByText('$422,000 - $2,310,000')).toBeInTheDocument(); // range
    expect(screen.getByText('$15,085')).toBeInTheDocument(); // daily
  });
});
```

#### Test Case 2.2: Zero/Null EAL Values
```javascript
test('should handle zero EAL values', async () => {
  const scanId = 'test_scan_003'; // No findings scan
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('$0')).toBeInTheDocument();
  });
});
```

### 3. Risk Score Tests

#### Test Case 3.1: High Risk Score Display
```javascript
test('should display high risk score with correct styling', async () => {
  // Assuming test_scan_001 has risk score of 85
  const scanId = 'test_scan_001';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Critical Risk')).toBeInTheDocument();
  });
});
```

#### Test Case 3.2: Low Risk Score Display
```javascript
test('should display low risk score with correct styling', async () => {
  const scanId = 'test_scan_002'; // Low risk scan
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('Low Risk')).toBeInTheDocument();
  });
});
```

### 4. Severity Distribution Tests

#### Test Case 4.1: Correct Severity Counts
```javascript
test('should display correct severity distribution', async () => {
  const scanId = 'test_scan_001';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('3')).toBeInTheDocument(); // Critical count
    expect(screen.getByText('1')).toBeInTheDocument(); // High count
    expect(screen.getByText('1')).toBeInTheDocument(); // Medium count
    expect(screen.getByText('1')).toBeInTheDocument(); // Low count
    expect(screen.getByText('1')).toBeInTheDocument(); // Info count
  });
});
```

#### Test Case 4.2: Empty Severity Distribution
```javascript
test('should handle empty severity distribution', async () => {
  const scanId = 'test_scan_003';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('Total Findings')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
```

### 5. Finding Display Tests

#### Test Case 5.1: Critical Findings Display
```javascript
test('should display critical findings without remediation details', async () => {
  const scanId = 'test_scan_001';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('WordPress RCE')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('blog.techcorp.com')).toBeInTheDocument();
    expect(screen.getByText('$250,000')).toBeInTheDocument();
    
    // Should NOT show remediation details
    expect(screen.queryByText('Update to plugin version 2.1.4')).not.toBeInTheDocument();
  });
});
```

#### Test Case 5.2: CVE Information Display
```javascript
test('should display CVE information when available', async () => {
  const scanId = 'test_scan_001';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    expect(screen.getByText('CVE-2024-1234')).toBeInTheDocument();
  });
});
```

### 6. Share Functionality Tests

#### Test Case 6.1: Share Button Click
```javascript
test('should handle share button click', async () => {
  const mockShare = jest.fn();
  Object.defineProperty(navigator, 'share', {
    writable: true,
    value: mockShare
  });
  
  const scanId = 'test_scan_001';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    const shareButton = screen.getByText('Share Your Snapshot');
    fireEvent.click(shareButton);
    expect(mockShare).toHaveBeenCalled();
  });
});
```

#### Test Case 6.2: Download PDF Click
```javascript
test('should handle PDF download', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      blob: () => Promise.resolve(new Blob(['PDF content'], { type: 'application/pdf' }))
    })
  );
  
  const scanId = 'test_scan_001';
  render(<ThreatSnapshot scanId={scanId} />);
  
  await waitFor(() => {
    const downloadButton = screen.getByText('Download PDF');
    fireEvent.click(downloadButton);
    expect(fetch).toHaveBeenCalledWith('/api/reports/test_scan_001/pdf', { method: 'POST' });
  });
});
```

## Backend API Testing

### 1. Report Data Endpoint Tests

#### Test Case 7.1: GET /api/reports/threat-snapshot/:scanId
```javascript
describe('Report Data API', () => {
  test('should return correct report structure', async () => {
    const response = await request(app)
      .get('/api/reports/threat-snapshot/test_scan_001')
      .expect(200);
    
    expect(response.body).toHaveProperty('company_name', 'TechCorp Solutions');
    expect(response.body).toHaveProperty('eal_ml_total', 974000);
    expect(response.body).toHaveProperty('critical_count', 3);
    expect(response.body.critical_findings).toHaveLength(3);
  });
});
```

#### Test Case 7.2: Scan Not Found
```javascript
test('should return 404 for non-existent scan', async () => {
  await request(app)
    .get('/api/reports/threat-snapshot/invalid_scan')
    .expect(404)
    .expect(res => {
      expect(res.body.error).toBe('Scan not found');
    });
});
```

### 2. PDF Generation Tests

#### Test Case 8.1: PDF Generation Success
```javascript
test('should generate PDF successfully', async () => {
  const response = await request(app)
    .post('/api/reports/test_scan_001/pdf')
    .expect(200)
    .expect('Content-Type', 'application/pdf');
  
  expect(response.body.length).toBeGreaterThan(0);
});
```

### 3. Email Delivery Tests

#### Test Case 9.1: Email Sending
```javascript
test('should send email successfully', async () => {
  const emailData = {
    reportType: 'threat_snapshot',
    recipientEmail: 'test@techcorp.com'
  };
  
  await request(app)
    .post('/api/reports/test_scan_001/email')
    .send(emailData)
    .expect(200)
    .expect(res => {
      expect(res.body.success).toBe(true);
    });
});
```

## Integration Testing

### 1. End-to-End Scan to Report Flow

#### Test Case 10.1: Complete Scan Workflow
```javascript
describe('E2E Scan to Report', () => {
  test('should generate threat snapshot after scan completion', async () => {
    // 1. Trigger scan
    const scanResponse = await request(app)
      .post('/scan')
      .send({ domain: 'e2etest.com', company_name: 'E2E Test Corp' });
    
    const scanId = scanResponse.body.scan_id;
    
    // 2. Wait for scan completion (mock or use shorter scan)
    // ...scan processing...
    
    // 3. Verify report data is available
    const reportResponse = await request(app)
      .get(`/api/reports/threat-snapshot/${scanId}`)
      .expect(200);
    
    expect(reportResponse.body.company_name).toBe('E2E Test Corp');
  });
});
```

## Performance Testing

### 1. Load Testing

#### Test Case 11.1: Multiple Concurrent Report Requests
```javascript
test('should handle multiple concurrent report requests', async () => {
  const promises = Array(10).fill().map(() => 
    request(app).get('/api/reports/threat-snapshot/test_scan_001')
  );
  
  const responses = await Promise.all(promises);
  responses.forEach(response => {
    expect(response.status).toBe(200);
  });
});
```

### 2. Large Dataset Testing

#### Test Case 12.1: Scan with Many Findings
```sql
-- Create scan with 1000+ findings
INSERT INTO scan_status (scan_id, company_name, domain, status, total_findings_count)
VALUES ('large_scan_001', 'BigCorp', 'bigcorp.com', 'completed', 1500);

-- Bulk insert findings (use script to generate 1500 findings)
```

## Visual Regression Testing

### 1. Component Snapshots

#### Test Case 13.1: Snapshot Tests
```javascript
test('should match visual snapshot', async () => {
  const { container } = render(<ThreatSnapshot scanId="test_scan_001" />);
  await waitFor(() => {
    expect(screen.getByText('TechCorp Solutions')).toBeInTheDocument();
  });
  expect(container.firstChild).toMatchSnapshot();
});
```

## Mobile/Responsive Testing

### 1. Mobile Layout Tests

#### Test Case 14.1: Mobile Rendering
```javascript
test('should render correctly on mobile', async () => {
  global.innerWidth = 375;
  global.innerHeight = 667;
  global.dispatchEvent(new Event('resize'));
  
  render(<ThreatSnapshot scanId="test_scan_001" />);
  
  await waitFor(() => {
    const financialSection = screen.getByText('Annual Loss Exposure');
    expect(financialSection).toBeVisible();
  });
});
```

## Security Testing

### 1. Input Validation

#### Test Case 15.1: SQL Injection Protection
```javascript
test('should protect against SQL injection in scan ID', async () => {
  const maliciousScanId = "'; DROP TABLE findings; --";
  
  await request(app)
    .get(`/api/reports/threat-snapshot/${maliciousScanId}`)
    .expect(400);
});
```

## Test Execution Plan

### Phase 1: Unit Tests (Week 1)
- Component rendering tests
- Data formatting tests
- User interaction tests

### Phase 2: Integration Tests (Week 2)
- API endpoint tests
- Database integration tests
- PDF generation tests

### Phase 3: E2E Tests (Week 3)
- Complete workflow tests
- Performance tests
- Security tests

### Phase 4: User Acceptance Testing (Week 4)
- Real scan data validation
- Stakeholder review
- Production deployment verification

## Success Criteria

✅ All unit tests pass with >95% code coverage
✅ API endpoints respond within 2 seconds for typical scans
✅ PDF generation completes within 10 seconds
✅ Email delivery succeeds 99.9% of the time
✅ Mobile layout renders correctly on all target devices
✅ No security vulnerabilities in penetration testing
✅ Stakeholder approval on visual design and functionality

This comprehensive test plan ensures the ThreatSnapshot component works reliably with your Supabase backend and provides a great user experience across all scenarios.