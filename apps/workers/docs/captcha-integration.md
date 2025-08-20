# 2Captcha Integration Guide

## Overview

DealBrief now includes comprehensive captcha solving capabilities using the 2captcha.com service. This enables automated scanning even when targets are protected by reCAPTCHA, hCaptcha, Cloudflare Turnstile, and other captcha systems.

## Features

### ✅ **Supported Captcha Types**
- **reCAPTCHA v2** (including invisible)
- **reCAPTCHA v3** (basic support)
- **hCaptcha**
- **Cloudflare Turnstile**
- **Normal Image Captchas**
- **Generic captcha detection**

### ✅ **Integration Points**
- **Shared Browser System**: Automatic captcha detection and solving during page navigation
- **Manual Solving**: Direct API access for custom captcha handling
- **Cost Tracking**: Balance monitoring and per-solve cost estimation
- **Error Handling**: Graceful fallbacks when captcha solving fails

## Configuration

### Environment Variables

```bash
# Required: Your 2captcha API key
CAPTCHA_API_KEY=your_api_key_here

# Optional: Enable/disable captcha solving (default: enabled if API key exists)
ENABLE_CAPTCHA_SOLVING=1
```

### GCP Deployment

The API key has been securely deployed to GCP Secret Manager:

```bash
gcloud secrets create captcha-api-key --data-file=- <<< "b06d4f75b730ffe4bae9f6be4caac4c8"
```

## Usage Examples

### 1. Basic reCAPTCHA Solving

```typescript
import { solveRecaptcha } from '../util/captchaSolver.js';

const result = await solveRecaptcha(
  '6Le-wvkSVVABCPBMRTvw0Q4Muexq1bi0DJwx_mJ-', // sitekey
  'https://example.com/login'                     // page URL
);

if (result.success) {
  console.log('Captcha solved:', result.token);
  console.log('Cost:', result.cost, 'Solve time:', result.solveTime);
} else {
  console.error('Captcha failed:', result.error);
}
```

### 2. Browser Navigation with Auto-Captcha Handling

```typescript
import { navigateWithCaptchaHandling } from '../util/browserWithCaptcha.js';

const result = await navigateWithCaptchaHandling('https://protected-site.com', {
  autoSolve: true,
  maxSolveAttempts: 3,
  waitForNavigation: true
});

if (result.success) {
  console.log('Navigation successful, captcha solved:', result.captchaSolved);
} else {
  console.error('Navigation failed:', result.error);
}
```

### 3. Shared Browser Integration

```typescript
import { withPage } from '../util/dynamicBrowser.js';
import { detectCaptchas } from '../util/browserWithCaptcha.js';

await withPage(async (page) => {
  await page.goto('https://example.com');
  
  const detection = await detectCaptchas(page);
  
  if (detection.detected) {
    console.log(`Found ${detection.type} captcha with sitekey: ${detection.sitekey}`);
    // Handle captcha automatically or manually
  }
});
```

### 4. Image Captcha Solving

```typescript
import { solveImageCaptcha } from '../util/captchaSolver.js';

// Convert image to base64 first
const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';

const result = await solveImageCaptcha(imageBase64, {
  caseSensitive: true,
  minLength: 4,
  maxLength: 6,
  textInstructions: 'Enter the text you see'
});

if (result.success) {
  console.log('Image captcha solved:', result.token);
}
```

### 5. Cost Monitoring

```typescript
import { getCaptchaBalance, captchaSolver } from '../util/captchaSolver.js';

// Check account balance
const balance = await getCaptchaBalance();
console.log(`Account balance: $${balance}`);

// Report quality feedback
if (captchaResult.success && captchaResult.taskId) {
  await captchaSolver.reportGood(captchaResult.taskId); // Good solve
  // or
  await captchaSolver.reportBad(captchaResult.taskId);  // Bad solve
}
```

## Integration with Scan Modules

### AccessibilityScan Enhancement

```typescript
// In modules/accessibilityScan.ts
import { navigateWithCaptchaHandling } from '../util/browserWithCaptcha.js';

async function testPageAccessibility(url: string): Promise<AccessibilityPageResult> {
  return withPage(async (page) => {
    // Use captcha-aware navigation instead of basic goto
    const navResult = await navigateWithCaptchaHandling(url, {
      autoSolve: true,
      waitForNavigation: true
    });
    
    if (!navResult.success) {
      return { 
        url, 
        tested: false, 
        violations: [], 
        passes: 0, 
        incomplete: 0, 
        error: navResult.error 
      };
    }
    
    // Continue with accessibility testing...
    const results = await page.evaluate(() => axe.run());
    // ... rest of implementation
  });
}
```

### TechStackScan Enhancement

```typescript
// In modules/techStackScan.ts
import { pageHasCaptcha, getCaptchaStats } from '../util/browserWithCaptcha.js';

async function discoverThirdPartyOrigins(domain: string): Promise<string[]> {
  // Check if domain has captcha protection first
  const captchaStats = await getCaptchaStats(domain);
  
  if (captchaStats.hasCaptcha) {
    log(`thirdParty=captcha_detected domain=${domain} type=${captchaStats.captchaType} cost=${captchaStats.cost}`);
  }
  
  return withPage(async (page) => {
    const navResult = await navigateWithCaptchaHandling(`https://${domain}`, {
      autoSolve: captchaStats.hasCaptcha,
      maxSolveAttempts: 2
    });
    
    if (!navResult.success) {
      log(`thirdParty=captcha_failed domain=${domain} error="${navResult.error}"`);
      return [];
    }
    
    // Continue with third-party discovery...
  });
}
```

## Cost Structure

### 2Captcha Pricing (as of 2024)
- **reCAPTCHA v2**: $0.002 per solve
- **reCAPTCHA v3**: $0.002 per solve  
- **hCaptcha**: $0.002 per solve
- **Cloudflare Turnstile**: $0.003 per solve
- **Normal Captcha**: $0.001 per solve

### Cost Optimization
- **Smart Detection**: Only solve when captcha is actually present
- **Caching**: Remember which domains have captchas to avoid repeated detection
- **Fallback**: Graceful degradation when captcha solving fails
- **Quality Feedback**: Report good/bad solves to maintain account standing

## Error Handling

```typescript
const result = await solveRecaptcha(sitekey, pageUrl);

switch (result.error) {
  case 'Captcha solver not configured':
    // API key missing - disable captcha-protected scanning
    break;
    
  case 'ERROR_ZERO_BALANCE':
    // Account out of funds - alert administrators
    break;
    
  case 'ERROR_WRONG_GOOGLEKEY':
    // Invalid sitekey - log for debugging
    break;
    
  case 'Polling timeout exceeded':
    // Captcha took too long - retry or skip
    break;
    
  default:
    // Other errors - log and continue
    break;
}
```

## Testing

### Unit Tests
```bash
npm run test -- captchaSolver.test.ts
```

### Integration Tests
```bash
# Test with real captcha (requires API key)
CAPTCHA_API_KEY=your_key npm run test:e2e
```

### Manual Testing
```bash
# Check balance
node -e "
import('./util/captchaSolver.js').then(m => 
  m.getCaptchaBalance().then(b => console.log('Balance:', b))
);
"
```

## Monitoring & Metrics

### Logging
All captcha operations are logged with structured data:

```
[captchaSolver] recaptcha=start sitekey="6Le-..." url="https://example.com"
[captchaSolver] submit=success taskId="123456789"
[captchaSolver] poll=waiting taskId="123456789" attempt=1/24
[captchaSolver] recaptcha=solved taskId="123456789" time=15423ms
```

### Metrics Collection
Consider adding these metrics to scan summaries:

```typescript
interface ScanMetrics {
  captchas_detected: number;
  captchas_solved: number;
  captcha_cost_usd: number;
  captcha_solve_time_ms: number;
  captcha_types: string[];
}
```

## Security Considerations

### API Key Protection
- ✅ **Environment Variables**: Never hard-code API keys
- ✅ **Secret Manager**: Secure deployment-time injection
- ✅ **Runtime Checks**: Graceful handling when key is missing

### Rate Limiting
- ✅ **2Captcha Limits**: Built-in API request limiting
- ✅ **Cost Controls**: Balance monitoring prevents runaway costs
- ✅ **Timeout Handling**: Prevents indefinite waiting

### Privacy
- ✅ **No Data Storage**: Captcha tokens are not logged or stored
- ✅ **Minimal Context**: Only necessary page data sent to 2captcha
- ✅ **HTTPS Only**: All API communication encrypted

## Troubleshooting

### Common Issues

1. **"Captcha solver not configured"**
   - Check `CAPTCHA_API_KEY` environment variable
   - Verify secret deployment: `gcloud secrets versions list captcha-api-key`

2. **"ERROR_ZERO_BALANCE"**
   - Add funds to 2captcha account
   - Check balance: `await getCaptchaBalance()`

3. **"Polling timeout exceeded"**
   - Captcha is too difficult or service is slow
   - Increase `MAX_POLLING_ATTEMPTS` in config
   - Try different captcha type detection

4. **"Failed to inject captcha token"**
   - Page structure doesn't match expected reCAPTCHA format
   - Try manual token injection
   - Check for custom callback functions

### Debug Mode

Enable detailed logging:

```typescript
// Set environment variable
DEBUG_CAPTCHA=1

// Or check raw API responses
const axios = require('axios');
// Make direct API calls to debug
```

This comprehensive captcha integration enables DealBrief to scan previously inaccessible targets while maintaining cost efficiency and operational reliability.