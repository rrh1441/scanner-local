# Security Scanner Documentation

## Overview

The DealBrief scanner uses a hybrid approach for secret detection to balance comprehensive coverage with memory efficiency:

- **ggshield**: Primary scanner for web assets and local files (lightweight, <5MB memory)
- **TruffleHog**: Git repository scanning only (memory-controlled, sequential processing)

## Architecture

### Phase 1: Web Asset Scanning (ggshield)
- Scans JavaScript, JSON, and other web assets discovered by `endpointDiscovery`
- Memory-optimized with configurable concurrency limits
- Processes assets in batches to prevent OOM issues
- Converts ggshield output to TruffleHog-compatible format

### Phase 2: High-Value Target Scanning (ggshield)
- Scans common secret locations (/.env, /config.json, etc.)
- Lightweight scanning for specific endpoints
- Maintains compatibility with existing artifact schema

### Phase 3: Git Repository Scanning (TruffleHog)
- Uses TruffleHog v3.83.7 for comprehensive Git history analysis
- Sequential processing to control memory usage
- Configurable depth limit (default: 3 commits)

### Phase 4: Local File Scanning (TruffleHog)
- Scans SpiderFoot output files when available
- Minimal memory footprint for file-based scanning

## Tool Versions

### TruffleHog v3.83.7
- **Use case**: Git repository scanning only
- **Memory**: ~150MB per process (managed with sequential execution)
- **Compatibility**: Last stable version before filesystem regression (GitHub issue #3968)
- **Installation**: Binary download from GitHub releases

### ggshield v1.26.0
- **Use case**: Web assets and local files
- **Memory**: ~5MB per process
- **Compatibility**: Stable, maintained by GitGuardian
- **Installation**: pip install

## Memory Management

### Configuration
- `GG_MAX_WORKERS`: Maximum concurrent ggshield processes (default: 4)
- `TRUFFLEHOG_GIT_DEPTH`: Git history depth limit (default: 3)
- `MAX_CONCURRENT_SCANS`: Overall scan concurrency limit (default: 2)

### Memory Limits
- **Web Asset Scanning**: 4 concurrent ggshield processes × 5MB = 20MB
- **Git Repository Scanning**: 1 TruffleHog process × 150MB = 150MB
- **Total Peak Memory**: ~200MB for secret scanning (within 4GB VM limit)

## Detector Coverage

### ggshield Detectors
- 350+ built-in detectors
- Real-time updates from GitGuardian
- Covers: AWS, Azure, GCP, Supabase, Stripe, GitHub, JWT, etc.
- Validity checking for many secret types

### TruffleHog Detectors
- 700+ built-in detectors
- Entropy-based detection
- Custom regex patterns
- Verification for 200+ secret types

## Artifact Schema

All scanners produce artifacts with consistent schema:

```json
{
  "type": "secret",
  "val_text": "DetectorName: secretprefix...",
  "severity": "CRITICAL|HIGH",
  "src_url": "https://example.com/asset.js",
  "meta": {
    "detector": "Supabase",
    "verified": true,
    "source_type": "web_asset|git|file",
    "extraction_method": "endpoint_discovery|direct_probe",
    "scan_id": "abc123"
  }
}
```

## Performance Metrics

### Target Performance (100 JS files, <150MB total)
- **Scanning Time**: <6 seconds
- **Memory Usage**: <200MB peak
- **Expected Findings**: ≥5 secrets (when seeded with test data)

### Optimization Strategies
1. **Batched Processing**: Process assets in small batches to prevent memory buildup
2. **Sequential Git Scanning**: Avoid parallel TruffleHog processes
3. **Early Termination**: Stop scanning if memory limits approached
4. **Intelligent Filtering**: Skip binary content and large files

## Upgrading Versions

### Safe Upgrade Process
1. Update version constants in `Dockerfile`
2. Run `scripts/version-check.sh` to verify compatibility
3. Test with known secret samples
4. Deploy to staging environment
5. Monitor memory usage and scan performance

### Version Compatibility
- **TruffleHog**: Pinned to v3.83.7 until filesystem regression fixed
- **ggshield**: Can be upgraded to latest stable versions
- **Breaking Changes**: Test artifact schema compatibility

## Troubleshooting

### Common Issues

#### OOM Killer
- **Symptoms**: Process killed with exit code 137
- **Solution**: Reduce `GG_MAX_WORKERS` or increase VM memory
- **Prevention**: Monitor memory usage in logs

#### Missing Secrets
- **Symptoms**: Known secrets not detected
- **Solution**: Check detector coverage and test with sample data
- **Debug**: Enable verbose logging for scanner output

#### Slow Performance
- **Symptoms**: Scanning takes >10 seconds
- **Solution**: Optimize batch sizes and concurrency limits
- **Debug**: Profile individual asset scanning times

### Debugging Commands
```bash
# Test ggshield functionality
echo "fake_secret_key" | ggshield secret scan stdin --json --no-banner

# Test TruffleHog functionality
echo "fake_secret_key" > /tmp/test.txt
trufflehog filesystem /tmp/test.txt --json --no-verification

# Check memory usage
ps aux | grep -E "(ggshield|trufflehog)"
```

## Security Considerations

### Secret Handling
- Secrets are logged with truncated previews only
- Full secrets stored in database with proper access controls
- Temporary files cleaned up immediately after scanning

### Network Security
- No external API calls during scanning
- All tools run in isolated containers
- Secrets never transmitted over network

### Compliance
- GDPR compliant (no personal data in secrets)
- SOC 2 Type II controls for secret storage
- Audit logging for all secret detection events