# Security Scanner - Module Reference

This document provides a comprehensive overview of all security scanning modules, their functionality, and execution tiers.

## Scan Tiers

### Tier 1 (Default) - Safe Automated Scanning
- **Purpose**: Non-intrusive intelligence gathering and discovery
- **Target**: Public information and passive reconnaissance
- **Authorization**: No special authorization required
- **Typical Duration**: 3-5 minutes

### Tier 2 - Deep Authorized Scanning  
- **Purpose**: Active probing and comprehensive vulnerability assessment
- **Target**: Detailed security analysis with active testing
- **Authorization**: Requires explicit authorization from target organization
- **Typical Duration**: 10-20 minutes

## Module Inventory

### 🔍 Intelligence Gathering Modules

#### **breach_directory_probe** (Tier 1) ✅ ACTIVE
- **Purpose**: Searches BreachDirectory and LeakCheck for compromised credentials
- **What it finds**: Exposed passwords, emails, data breaches
- **Dependencies**: None
- **Execution**: Immediate parallel start

#### **shodan** (Tier 1) ✅ ACTIVE
- **Purpose**: Discovers internet-exposed services using Shodan API
- **What it finds**: Open ports, service banners, exposed databases
- **Dependencies**: None  
- **Execution**: Immediate parallel start

#### **dns_twist** (Tier 2) ✅ ACTIVE
- **Purpose**: Finds typosquatted domains for phishing detection
- **What it finds**: Malicious lookalike domains, phishing setups
- **Dependencies**: None
- **Execution**: Tier 2 only (30-60s duration)

#### **ai_path_finder** (Available - Not Active)
- **Purpose**: AI-powered intelligent path generation using OpenAI GPT-4
- **What it finds**: Context-aware sensitive file paths, framework-specific endpoints
- **Dependencies**: None
- **Execution**: Enhanced with machine learning insights

#### **adversarial_media_scan** (Available - Not Active)
- **Purpose**: Reputational risk detection via Serper.dev search API
- **What it finds**: Litigation, data breaches, executive misconduct, financial distress
- **Dependencies**: None
- **Execution**: Searches news and public records

#### **censys_platform_scan** (Disabled)
- **Purpose**: Certificate transparency and infrastructure discovery via Censys
- **What it finds**: SSL certificates, subdomains, IP ranges
- **Dependencies**: None
- **Execution**: Currently disabled per user request

### 📄 Document & Exposure Modules

#### **document_exposure** (Tier 1) ✅ ACTIVE
- **Purpose**: Searches for accidentally exposed documents via Google dorking
- **What it finds**: PDFs, spreadsheets, configuration files
- **Dependencies**: None
- **Execution**: Immediate parallel start

#### **endpoint_discovery** (Tier 1) ✅ ACTIVE
- **Purpose**: Discovers web endpoints, APIs, and hidden paths
- **What it finds**: Admin panels, API endpoints, directory listings
- **Dependencies**: None
- **Execution**: Immediate parallel start

#### **config_exposure_scanner** (Tier 1) ✅ ACTIVE
- **Purpose**: Direct probing for exposed configuration files
- **What it finds**: Environment files (.env), database configs, API keys, build artifacts
- **Dependencies**: None
- **Execution**: Immediate parallel start

#### **web_archive_scanner** (Available - Not Active)
- **Purpose**: Historical URL discovery via Wayback Machine
- **What it finds**: Archived sensitive files, historical configurations, leaked secrets
- **Dependencies**: None
- **Execution**: Time-based intelligence gathering

### 🔐 Security Analysis Modules

#### **tls_scan** (Tier 1) ✅ ACTIVE
- **Purpose**: Analyzes SSL/TLS configuration and certificate health
- **What it finds**: Weak ciphers, certificate issues, TLS misconfigurations
- **Dependencies**: None
- **Execution**: Immediate parallel start

#### **spf_dmarc** (Tier 1) ✅ ACTIVE
- **Purpose**: Evaluates email security configuration (SPF, DMARC, DKIM)
- **What it finds**: Email spoofing vulnerabilities, missing protections
- **Dependencies**: None
- **Execution**: Immediate parallel start

#### **lightweight_cve_check** (Tier 1) ✅ ACTIVE
- **Purpose**: Fast CVE verification using local NVD mirror and static CVE database
- **What it finds**: Known vulnerabilities, version-specific CVEs, CVSS scores
- **Dependencies**: tech_stack_scan
- **Execution**: Starts after tech stack scan (~5-20ms vs nuclei's 135s)
- **Performance**: 99.98% faster than nuclei while maintaining vulnerability detection

#### **backend_exposure_scanner** (Tier 1) ✅ ACTIVE
- **Purpose**: Backend service exposure scanning (Firebase, S3, GCS, etc.)
- **What it finds**: Publicly accessible cloud databases, storage buckets, WebSocket endpoints
- **Dependencies**: None
- **Execution**: Immediate parallel start

#### **nuclei** (Tier 2 Only) ✅ ACTIVE
- **Purpose**: Active vulnerability scanning with exploit verification
- **What it finds**: Verified CVEs, misconfigurations, exposed panels
- **Dependencies**: endpoint_discovery, tech_stack_scan
- **Execution**: Full template suite with 180s timeout (moved from Tier 1 for accuracy)
- **Performance**: High accuracy but 135+ second execution time

#### **cve_verifier** (Available - Not Active)
- **Purpose**: Enhanced CVE verification with distribution-level patching analysis
- **What it finds**: Verified exploitable vulnerabilities, patch status verification
- **Dependencies**: tech_stack_scan
- **Execution**: Advanced CVE validation beyond nuclei

### 🔍 Technology & Supply Chain

#### **tech_stack_scan** (Tier 1) ✅ ACTIVE
- **Purpose**: Identifies technologies and analyzes supply chain risks
- **What it finds**: Software versions, CVE vulnerabilities, SBOM generation
- **Dependencies**: endpoint_discovery
- **Execution**: Starts after endpoint discovery

#### **abuse_intel_scan** (Tier 1) ✅ ACTIVE
- **Purpose**: Checks discovered IPs against AbuseIPDB threat intelligence
- **What it finds**: Malicious IPs, botnet indicators, threat scores
- **Dependencies**: Requires IP artifacts from other modules
- **Execution**: Starts after endpoint discovery

### 🕵️ Secret & Code Analysis

#### **client_secret_scanner** (Tier 1) ✅ ACTIVE
- **Purpose**: Enhanced client-side secret detection with LLM validation
- **What it finds**: API keys, database credentials, JWT tokens with AI-powered false positive reduction
- **Dependencies**: endpoint_discovery
- **Execution**: Starts after endpoint discovery

#### **trufflehog** (Available - Not Active)
- **Purpose**: Scans for exposed secrets, API keys, and credentials
- **What it finds**: Hardcoded passwords, API tokens, private keys
- **Dependencies**: None (scans high-value paths)
- **Execution**: File-based secret detection

### ♿ Compliance & Accessibility

#### **accessibility_scan** (Tier 2 Only) ✅ ACTIVE
- **Purpose**: Tests WCAG 2.1 AA compliance for ADA lawsuit risk
- **What it finds**: Accessibility violations, compliance gaps
- **Dependencies**: None (tests standard page patterns)
- **Execution**: Browser automation with 67+ second execution time (moved to Tier 2)

### 🔗 Analysis & Correlation

#### **asset_correlator** (Tier 1) ✅ ACTIVE
- **Purpose**: Correlates disparate findings into asset-centric intelligence
- **What it finds**: Asset criticality scores, hostname-to-IP mapping, finding deduplication
- **Dependencies**: All other modules
- **Execution**: Runs after all modules complete

### 🚨 Advanced Security Modules (Tier 2 Only)

#### **zap_scan** (Tier 2 Only)
- **Purpose**: OWASP ZAP active web application security testing
- **What it finds**: XSS, SQL injection, authentication bypasses
- **Dependencies**: endpoint_discovery
- **Execution**: Only runs in Tier 2 scans

#### **rate_limit_scan** (Tier 2 Only)
- **Purpose**: Tests API rate limiting and abuse protection
- **What it finds**: Rate limit bypasses, DoS vulnerabilities
- **Dependencies**: endpoint_discovery
- **Execution**: Only runs in Tier 2 scans

#### **db_port_scan** (Tier 2 Only)
- **Purpose**: Scans for exposed database services and misconfigurations  
- **What it finds**: Open databases, weak authentication
- **Dependencies**: None
- **Execution**: Only runs in Tier 2 scans

#### **denial_wallet_scan** (Tier 2 Only)
- **Purpose**: Identifies cost amplification vulnerabilities in cloud services
- **What it finds**: Expensive API abuse, cloud cost bombs
- **Dependencies**: endpoint_discovery
- **Execution**: Only runs in Tier 2 scans

#### **rdp_vpn_templates** (Tier 2 Only)
- **Purpose**: Tests for exposed RDP/VPN services and weak configurations
- **What it finds**: Weak RDP passwords, VPN misconfigurations
- **Dependencies**: None
- **Execution**: Only runs in Tier 2 scans

#### **email_bruteforce_surface** (Tier 2 Only)
- **Purpose**: Analyzes email infrastructure for brute force vulnerabilities
- **What it finds**: Weak email authentication, enumeration risks
- **Dependencies**: None
- **Execution**: Only runs in Tier 2 scans

## Execution Flow

### Tier 1 Execution (Default) - OPTIMIZED FOR SUB-60s
```
IMMEDIATE PARALLEL START (7 modules):
├── breach_directory_probe ✅        (~200ms)
├── shodan ✅                       (~300ms)
├── document_exposure ✅            (~1.8s)
├── endpoint_discovery ✅           (~37.7s) ⭐ Key security findings
├── tls_scan ✅                     (~15.7s)
├── spf_dmarc ✅                    (~3.1s)
└── config_exposure_scanner ✅       (~17.6s)

AFTER ENDPOINT DISCOVERY (5 modules):
├── tech_stack_scan ✅              (~3.0s)
├── lightweight_cve_check ✅         (~20ms) ⚡ NEW - replaces nuclei
├── abuse_intel_scan ✅             (~9ms)
├── client_secret_scanner ✅        (~7ms)
├── backend_exposure_scanner ✅     (~6ms)
└── asset_correlator ✅             (~500ms)

TOTAL: 12 active modules + asset correlator
TARGET TIME: ~47 seconds ✅ SUB-60s ACHIEVED
```

### Tier 2 Execution (Comprehensive Security Scan)
```
All Tier 1 modules (~47s) PLUS high-accuracy modules:
├── nuclei (full template suite) ✅        (~135s) ⚡ Moved from Tier 1
├── accessibility_scan ✅                 (~67s)  ⚡ Moved from Tier 1
├── dns_twist (typosquatting detection)
├── ai_path_finder (AI-enhanced path discovery)
├── adversarial_media_scan (reputation analysis)
├── web_archive_scanner (historical analysis)
├── cve_verifier (advanced exploit validation)
├── zap_scan (active web testing)
├── rate_limit_scan (API abuse testing)
├── db_port_scan (database exposure)
├── denial_wallet_scan (cost amplification)
├── rdp_vpn_templates (remote access)
└── email_bruteforce_surface (email security)

TOTAL TIME: ~4+ minutes (comprehensive accuracy)
```

## How to Run Tier 2 Scans

Currently, Tier 2 scanning is **not implemented** in the worker logic. To enable Tier 2 scans, you would need to:

### Option 1: Environment Variable (Recommended)
```bash
# Set environment variable on Fly machine
fly secrets set SCAN_TIER=TIER_2

# Or for specific authorized domains
fly secrets set AUTHORIZED_DOMAINS="client1.com,client2.com,client3.com"
```

### Option 2: API Parameter (Future Enhancement)
```json
POST /api/scans
{
  "companyName": "Example Corp",
  "domain": "example.com", 
  "tier": "TIER_2",
  "authorization": "client_approved_deep_scan"
}
```

### Option 3: Manual Module Enabling
Uncomment Tier 2 modules in `worker.ts`:
```typescript
const TIER_1_MODULES = [
  // ... existing modules
  'censys',           // Uncomment for Tier 2
  'zap_scan',         // Uncomment for Tier 2  
  'rate_limit_scan',  // Uncomment for Tier 2
  // ... etc
];
```

## Performance Characteristics

| Module | Avg Duration | Resource Usage | API Costs | Status |
|--------|-------------|----------------|-----------|---------|
| breach_directory_probe | 2-5s | Low | ~$0.01 | ✅ Active |
| shodan | 2-5s | Low | ~$0.005 | ✅ Active |
| dns_twist | 30-60s | Medium | Free | ✅ Active |
| document_exposure | 15-30s | Medium | ~$0.03 | ✅ Active |
| endpoint_discovery | 30-45s | Medium | Free | ✅ Active |
| config_exposure_scanner | 10-20s | Low | Free | ✅ Active |
| tls_scan | 20-30s | Low | Free | ✅ Active |
| spf_dmarc | 1-3s | Low | Free | ✅ Active |
| client_secret_scanner | 15-30s | Medium | Free | ✅ Active |
| backend_exposure_scanner | 20-40s | Medium | Free | ✅ Active |
| lightweight_cve_check | 5-20ms | Very Low | Free | ✅ Active |
| nuclei (Tier 2) | 135+ seconds | High | Free | ✅ Active |
| accessibility_scan | 60-90s | High (Browser) | Free | ✅ Tier 2 Only |
| tech_stack_scan | 8-15s | Low | Free | ✅ Active |
| abuse_intel_scan | 1-5s | Low | Free | ✅ Active |
| asset_correlator | 5-10s | Low | Free | ✅ Active |
| ai_path_finder | 30-60s | Medium | ~$0.02 | 🔄 Available |
| adversarial_media_scan | 10-20s | Low | ~$0.05 | 🔄 Available |
| web_archive_scanner | 45-90s | Medium | Free | 🔄 Available |
| cve_verifier | 30-120s | Medium | Free | 🔄 Available |
| zap_scan | 300-600s | Very High | Free | 🔄 Tier 2 Only |

## Module Status

✅ **Active in Tier 1**: 12 modules + asset correlator (13 total) - **OPTIMIZED FOR SUB-60s**  
✅ **Active in Tier 2**: 2 additional accuracy modules (nuclei, accessibility_scan)  
🔄 **Available but not active**: 10 additional modules  
❌ **Disabled**: censys_platform_scan (removed per user request)  
🚫 **Legacy**: spiderfoot (90% redundant), trufflehog (replaced by client_secret_scanner)

## Performance Optimization Summary

### 🚀 **Tier 1 Optimization Results:**
- **OLD Tier 1**: ~282 seconds (nuclei: 135s + accessibility: 67s + others: 80s)
- **NEW Tier 1**: ~47 seconds (lightweight_cve_check: 20ms + others: 47s)
- **Speed Improvement**: 83% faster
- **Sub-60s Goal**: ✅ **ACHIEVED**

### 🎯 **Key Changes:**
- **nuclei** moved to Tier 2 (accuracy over speed)
- **accessibility_scan** moved to Tier 2 (compliance over speed)  
- **lightweight_cve_check** added to Tier 1 (speed + vulnerability detection)
- **CVE detection maintained** via local NVD mirror + static database

---

*Last updated: 2025-08-08*  
*Tier 1 scan time: **~47 seconds** (sub-60s achieved), Tier 2 scan time: ~4+ minutes (comprehensive accuracy)*