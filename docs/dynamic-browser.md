# Dynamic Browser System

The Dynamic Browser system provides a singleton Puppeteer browser instance with semaphore-controlled page pooling to eliminate resource waste from multiple Chrome spawns across scan modules.

## Features

- **Singleton Browser**: Single Chrome instance shared across all scan modules
- **Page Pool Management**: Semaphore-controlled concurrent page limits
- **Memory Monitoring**: Automatic browser restart at memory thresholds
- **Crash Recovery**: Automatic retry on browser/page errors
- **Graceful Shutdown**: Proper cleanup on process termination
- **Development Mode**: Enhanced debugging support

## Environment Variables

### Required Configuration

- **`ENABLE_PUPPETEER`**: Controls browser availability
  - `1` (default): Enable Puppeteer browser
  - `0`: Disable browser (modules will skip browser-dependent operations)

### Optional Configuration

- **`PUPPETEER_MAX_PAGES`**: Maximum concurrent pages
  - Default: `min(3, os.cpus().length)`
  - Minimum: `1`
  - Controls semaphore size for page pool

- **`DEBUG_PUPPETEER`**: Debug mode
  - `true`: Enable dumpio and DevTools in development
  - `false` (default): Normal operation

- **`NODE_ENV`**: Environment mode
  - `development`: Headful browser with DevTools support
  - `production`: Headless operation

## Usage

### Basic Page Operations

```typescript
import { withPage } from '../util/dynamicBrowser.js';

// Execute function with managed page
const result = await withPage(async (page) => {
  await page.goto('https://example.com');
  return await page.title();
});
```

### Custom Browser Options

```typescript
import { getBrowser } from '../util/dynamicBrowser.js';

// Get browser with custom launch options
const browser = await getBrowser({
  args: ['--custom-flag'],
  timeout: 90000
});
```

### Memory Monitoring

```typescript
import { getBrowserMemoryStats } from '../util/dynamicBrowser.js';

const stats = getBrowserMemoryStats();
console.log(`RSS: ${stats.rss}MB, Active Pages: ${stats.activePagesCount}`);
```

## Resource Management

### Memory Limits

- **Target RSS**: ≤ 3 GB
- **Restart Threshold**: 3.5 GB
- **Monitoring Interval**: 15 seconds
- **Page Leak Warning**: 5 minutes

### Concurrency Control

```typescript
// Default semaphore size
const maxPages = Math.min(3, os.cpus().length);

// Override with environment variable
PUPPETEER_MAX_PAGES=5
```

### Performance Metrics

- **Browser RSS/Heap**: Logged every 30 seconds
- **Active Page Count**: Real-time monitoring
- **Page Operation Duration**: Per-navigation timing
- **Cache Hit Rates**: Various intelligence caches

## Fly.io Scaling

Scale up for memory-intensive operations:

```bash
# Scale up to 4GB for browser operations
fly machines update $MACH --size shared-cpu-2x

# Run your scans...

# Scale back down to save costs
fly machines update $MACH --size shared-cpu-1x
```

### Memory Expectations

| Configuration | Expected Usage |
|---------------|----------------|
| 1 page (baseline) | ~500MB |
| 3 pages (default) | ~800MB |
| 5 pages (max recommended) | ~1.2GB |
| + Node.js heap | ~200-400MB |
| **Total (3 pages)** | **~1.2GB** |

## Error Handling

### Automatic Recovery

- **Browser Crashes**: Automatic restart and retry (1 attempt)
- **Page Errors**: Graceful cleanup and error propagation
- **Memory Exhaustion**: Automatic browser restart at threshold
- **Timeout Handling**: Configurable timeouts with fallback

### Graceful Degradation

When `ENABLE_PUPPETEER=0`:

```typescript
// techStackScan behavior
{
  dynamic_browser_skipped: true,
  thirdPartyOrigins: 0  // Skip discovery
}

// accessibilityScan behavior
{
  type: 'accessibility_scan_unavailable',
  severity: 'INFO',
  reason: 'puppeteer_disabled'
}
```

## Development

### Local Development

```bash
# Enable debug mode
export DEBUG_PUPPETEER=true
export NODE_ENV=development

# Run with visible browser
npm run dev
```

### Testing

```bash
# Unit tests (mocked browser)
npm run test

# E2E tests (real Chromium)
npm run test:e2e

# With coverage
npm run test -- --coverage
```

### Debugging

- **Headful Mode**: Set `NODE_ENV=development`
- **DevTools**: Set `DEBUG_PUPPETEER=true`
- **Verbose Logging**: Browser events logged at INFO/WARN levels
- **Memory Tracking**: Regular memory usage reports

## Integration Examples

### TechStack Scan

```typescript
// Before: Module-specific browser
browser = await puppeteer.launch({ ... });
const page = await browser.newPage();
// ... page operations
await browser.close();

// After: Shared browser
return await withPage(async (page) => {
  // ... same page operations
  return results;
});
```

### Accessibility Scan

```typescript
// Graceful fallback
if (process.env.ENABLE_PUPPETEER === '0') {
  return { tested: false, error: 'Puppeteer disabled' };
}

return await withPage(async (page) => {
  await page.addScriptTag({ url: AXE_CORE_CDN });
  const results = await page.evaluate(() => axe.run());
  return processResults(results);
});
```

## Best Practices

### Resource Efficiency

1. **Minimize Page Operations**: Batch related tasks in single `withPage()` call
2. **Handle Errors Gracefully**: Don't let page errors crash entire scans
3. **Respect Semaphore**: Don't spawn additional browsers outside the system
4. **Monitor Memory**: Use `getBrowserMemoryStats()` for capacity planning

### Error Resilience

1. **Timeout Configuration**: Set appropriate page timeouts for your use case
2. **Retry Logic**: Handle recoverable errors (network, target closed)
3. **Fallback Modes**: Provide functionality when browser unavailable
4. **Cleanup Guarantees**: Always use `withPage()` for automatic cleanup

### Production Deployment

1. **Memory Monitoring**: Alert on high RSS usage
2. **Scale Appropriately**: Use `shared-cpu-2x` for browser workloads
3. **Environment Variables**: Configure `PUPPETEER_MAX_PAGES` based on workload
4. **Health Checks**: Monitor browser connectivity and page success rates

## Troubleshooting

### Common Issues

**Browser Won't Start**
```bash
# Check environment
echo $ENABLE_PUPPETEER

# Verify dependencies
npm list puppeteer async-mutex
```

**Memory Issues**
```bash
# Monitor usage
fly logs --app your-app | grep browser_rss_mb

# Scale up temporarily
fly machines update $MACH --size shared-cpu-2x
```

**Semaphore Deadlock**
```bash
# Check active pages
# Look for "pages_open" in metrics logs
# Reduce PUPPETEER_MAX_PAGES if needed
```

### Support

For issues with the Dynamic Browser system:

1. Check logs for browser startup/memory warnings
2. Verify environment variable configuration
3. Test with simplified page operations
4. Monitor memory usage patterns
5. Consider scaling Fly.io instance size

The system is designed to be resilient and self-healing, but proper configuration and monitoring ensure optimal performance.