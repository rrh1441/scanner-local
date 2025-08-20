DealBrief is a security assessment platform designed for M&A due diligence. It uses a
  two-tier scanning system:
  - Tier 1: Quick scan (3-5 minutes) - passive/safe reconnaissance only
  - Tier 2: Deep scan (10-15 minutes) - includes active probing (requires authorization)

  Module Categories:

  1. Domain & Brand Protection

  - dnsTwist: Detects typosquatted domains that could be used for phishing
  - spfDmarc: Analyzes email security (SPF/DMARC/DKIM/BIMI) to assess phishing vulnerability
  - documentExposure: Finds exposed corporate documents (PDF/DOCX/XLSX) via Google dorking

  2. Infrastructure Discovery

  - shodan: Passive reconnaissance for exposed services and known vulnerabilities
  - censysPlatformScan: Infrastructure discovery using Censys platform
  - endpointDiscovery: Maps web endpoints via robots.txt, sitemaps, crawling, and JS
  analysis
  - aiPathFinder: Uses AI to predict likely sensitive endpoints based on tech stack

  3. Vulnerability Scanning

  - nuclei: Comprehensive vulnerability detection using curated templates
  - zapScan: OWASP ZAP integration for web application security testing (Tier 2)
  - openvasScan: Enterprise vulnerability scanning with OpenVAS (Tier 2)
  - cveVerifier: Validates specific CVEs against detected services

  4. Secrets & Configuration

  - clientSecretScanner: Detects exposed API keys, tokens, and credentials in web assets
  - configExposureScanner: Finds exposed config files (.env, .git, backups)
  - trufflehog/scanGitRepos: Deep secret scanning in git repositories

  5. Service-Specific Security

  - dbPortScan: Checks for exposed databases and default credentials (Tier 2)
  - rdpVpnTemplates: Detects exposed RDP/VPN services
  - emailBruteforceSurface: Identifies email services vulnerable to bruteforce
  - tlsScan: Analyzes SSL/TLS configuration and cipher strength

  6. Business Risk Assessment

  - accessibilityScan: WCAG compliance for ADA lawsuit risk
  - abuseIntelScan: IP reputation check for abuse/malicious activity
  - breachDirectoryProbe: Searches for historical breaches and leaked credentials
  - adversarialMediaScan: Finds negative press coverage (reputational risk)

  7. Advanced Threats

  - denialWalletScan: Identifies endpoints vulnerable to cost-explosion attacks
  - rateLimitScan: Tests rate limiting with various bypass techniques (Tier 2)
  - webArchiveScanner: Historical analysis via Wayback Machine

  8. Intelligence & Correlation

  - assetCorrelator: Groups findings by asset for prioritized remediation
  - techStackScan: Identifies technologies with vulnerability mapping and SBOM generation
  - whoisWrapper: Domain ownership and registration intelligence
  - spiderFoot: OSINT gathering (90% redundant with other modules)

  9. Support Infrastructure

  - targetDiscovery: URL parsing and asset classification
  - techCache: Caching layer for technology detection
  - tierConfig: Configuration management for scan tiers

  Key Features:

  - All modules output standardized "artifacts" with severity ratings
  (CRITICAL/HIGH/MEDIUM/LOW/INFO)
  - Financial impact calculation (EAL - Expected Annual Loss) for each finding
  - Designed for non-intrusive assessment suitable for third-party targets
  - Generates executive-friendly reports with remediation recommendations

  The platform transforms technical vulnerabilities into business risk metrics suitable for
  M&A decision-making.