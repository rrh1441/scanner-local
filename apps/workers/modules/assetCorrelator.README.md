# Asset Correlator Module

## Overview
The `assetCorrelator` module transforms disparate security findings into asset-centric intelligence. It runs after all scanning modules complete, correlating findings by IP addresses and services to provide a unified view of the attack surface.

## Key Features

### 1. **Smart Correlation**
- Groups findings by IP:port tuples for service-level accuracy
- Validates hostname affinity to prevent CDN/load balancer confusion
- Deduplicates findings to avoid inflated severity counts

### 2. **Performance Optimizations**
- Batch DNS resolution with caching (10 concurrent lookups max)
- Stream processing for large datasets
- 30-second timeout budget with graceful degradation
- Database indexes for O(scan_size) query performance

### 3. **Non-Invasive Design**
- Never forces correlations where none exist
- Preserves non-correlatable findings (SPF/DMARC, breach data, etc.)
- Fails gracefully without impacting scan completion

## Output Schema

```json
{
  "type": "correlated_asset_summary",
  "severity": "HIGH",
  "meta": {
    "correlation_summary": {
      "total_artifacts": 150,
      "correlated_artifacts": 120,
      "uncorrelated_artifacts": 30,
      "total_assets": 15,
      "critical_assets": 3,
      "assets": [
        {
          "ip": "192.168.1.1",
          "port": 443,
          "hostnames": ["www.example.com", "api.example.com"],
          "service": "nginx",
          "severity": "HIGH",
          "findings": [
            {
              "artifact_id": 105,
              "type": "vuln_cve",
              "id": "CVE-2021-41773",
              "cvss": 9.8,
              "description": "Apache HTTP Server path traversal"
            }
          ],
          "asset_criticality": 8
        }
      ]
    }
  }
}
```

## Database Requirements

Run the migration to add required indexes:
```bash
psql $DATABASE_URL < migrations/add_correlation_indexes.sql
```

## Integration

The module is automatically invoked at the end of each scan in `worker.ts`:
```typescript
await runAssetCorrelator({ scanId, domain, tier });
```

## Performance Characteristics

- **Runtime**: <1 second for ~5k artifacts
- **Memory**: Streaming prevents loading entire scans into RAM
- **Concurrency**: 10 DNS lookups, configurable via pLimit
- **Timeout**: 30 seconds total, partial results on timeout

## Testing

```bash
npm test -- assetCorrelator.test.ts
```

Tests cover:
- IP-based correlation
- Service separation by port
- DNS batch resolution
- Finding deduplication
- Timeout handling
- Non-correlatable artifact handling