# DealBrief Scanner - Complete API Keys & Credentials List

This document provides the **comprehensive list of all API keys and credentials** required for full testing coverage of the DealBrief security scanner.

## 🔑 **Core Infrastructure APIs** (Required for Basic Operation)

### **Database & Storage**
```bash
# PostgreSQL Database (Fly.io/Local)
export DATABASE_URL="postgresql://user:password@host:5432/database"
export DB_URL="postgresql://user:password@host:5432/database"  # Alternative

# Supabase Integration
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Redis Queue (Upstash)
export REDIS_URL="redis://username:password@host:port"
export UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="your-token"
```

### **AI/ML Services**
```bash
# OpenAI (Report Generation, Analysis)
export OPENAI_API_KEY="sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGH"

# Anthropic Claude (Alternative AI)
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Google AI (Alternative)
export GOOGLE_AI_API_KEY="AIzaSyBdVl-cTICSwYKrZ95SuvNw7dbMuDt1KG0"
```

## 🔍 **Security Scanning APIs** (High Priority)

### **Network Reconnaissance**
```bash
# Shodan (Network/Device Discovery)
export SHODAN_API_KEY="your-shodan-api-key"

# Censys (Certificate/Network Intel) 
export CENSYS_API_ID="your-censys-api-id"
export CENSYS_SECRET="your-censys-secret"

# Binary Edge (Alternative to Shodan)
export BINARYEDGE_API_KEY="your-binaryedge-key"
```

### **DNS & Domain Intelligence**
```bash
# WhoisXML API (WHOIS Data)
export WHOISXML_API_KEY="your-whoisxml-api-key"

# Whoxy (Alternative WHOIS - 87% cost savings)
export WHOXY_API_KEY="your-whoxy-api-key"

# SecurityTrails (DNS History)
export SECURITYTRAILS_API_KEY="your-securitytrails-key"

# VirusTotal (Domain/URL Analysis)
export VIRUSTOTAL_API_KEY="your-virustotal-api-key"
```

### **Vulnerability Intelligence** 
```bash
# GitHub (Repository Scanning)
export GITHUB_TOKEN="ghp_1234567890abcdefghijklmnopqrstuvwx"
export GITHUB_API_TOKEN="ghp_1234567890abcdefghijklmnopqrstuvwx"

# GitLab (Alternative Repository Access)
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxxxxxxxxx"

# National Vulnerability Database (NVD)
export NVD_API_KEY="your-nvd-api-key"  # Optional but recommended

# CVE Details / MITRE
# No API key required - public access
```

### **Web Application Security**
```bash
# SSL Labs (Certificate Analysis)
# No API key required - public API with rate limits

# Have I Been Pwned (Breach Data)
export HIBP_API_KEY="your-hibp-api-key"

# URLVoid (URL Reputation)
export URLVOID_API_KEY="your-urlvoid-key"
```

### **Threat Intelligence**
```bash
# AbuseIPDB (IP Reputation)
export ABUSEIPDB_API_KEY="your-abuseipdb-key"

# AlienVault OTX (Open Threat Exchange)
export OTX_API_KEY="your-otx-api-key"

# ThreatCrowd (Threat Intel)
# No API key required - public service

# IPQualityScore (IP/Domain Reputation)
export IPQUALITYSCORE_API_KEY="your-ipqs-key"
```

## 🔧 **Tool-Specific APIs** (Medium Priority)

### **Social Media & Public Data**
```bash
# Twitter/X API (Social Media Intel)
export TWITTER_BEARER_TOKEN="AAAAAAAAAAAAAAAAAAAAAA..."
export TWITTER_API_KEY="your-twitter-api-key"
export TWITTER_API_SECRET="your-twitter-api-secret"

# LinkedIn (Professional Intel)
export LINKEDIN_ACCESS_TOKEN="your-linkedin-token"

# Facebook Graph API
export FACEBOOK_ACCESS_TOKEN="your-facebook-token"
```

### **Email & Communication**
```bash
# Hunter.io (Email Discovery)
export HUNTER_API_KEY="your-hunter-api-key"

# EmailRep (Email Reputation)
export EMAILREP_API_KEY="your-emailrep-key"

# Clearbit (Company/Email Intel)
export CLEARBIT_API_KEY="your-clearbit-key"
```

### **Cloud & Infrastructure**
```bash
# AWS (Cloud Asset Discovery)
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_DEFAULT_REGION="us-east-1"

# Google Cloud Platform
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export GCP_PROJECT_ID="your-project-id"

# Azure
export AZURE_CLIENT_ID="your-azure-client-id"
export AZURE_CLIENT_SECRET="your-azure-client-secret"
export AZURE_TENANT_ID="your-azure-tenant-id"
```

### **Certificate Transparency**
```bash
# Certificate Transparency Logs
# No API keys required - public CT logs

# crt.sh (Certificate Search)
# No API key required - public PostgreSQL interface

# Google CT API
# No API key required - public access
```

## 🌐 **External Tool Integrations** (Optional but Recommended)

### **Specialized Security Tools**
```bash
# OpenVAS/Greenbone (Vulnerability Scanner)
export OPENVAS_HOST="localhost"
export OPENVAS_PORT="9390"
export OPENVAS_USER="admin"
export OPENVAS_PASSWORD="your-openvas-password"

# Nessus (Alternative Vulnerability Scanner)
export NESSUS_URL="https://localhost:8834"
export NESSUS_ACCESS_KEY="your-nessus-access-key"
export NESSUS_SECRET_KEY="your-nessus-secret-key"

# Qualys (Cloud Vulnerability Scanner)
export QUALYS_USERNAME="your-qualys-username"
export QUALYS_PASSWORD="your-qualys-password"
export QUALYS_URL="https://qualysapi.qualys.com"
```

### **Blockchain & Cryptocurrency**
```bash
# Etherscan (Ethereum Analysis)
export ETHERSCAN_API_KEY="your-etherscan-api-key"

# Blockchain.info (Bitcoin Analysis)
# No API key required for basic queries

# CoinGecko (Crypto Intelligence)
export COINGECKO_API_KEY="your-coingecko-key"
```

### **Geolocation & Infrastructure**
```bash
# MaxMind GeoIP (Location Intelligence)
export MAXMIND_LICENSE_KEY="your-maxmind-license"
export MAXMIND_USER_ID="your-maxmind-user-id"

# IPStack (Alternative GeoIP)
export IPSTACK_API_KEY="your-ipstack-key"

# IPInfo (IP Intelligence)
export IPINFO_TOKEN="your-ipinfo-token"
```

## 🧪 **Testing & Development APIs**

### **Captcha Services** 
```bash
# 2captcha (Captcha Solving)
export TWOCAPTCHA_API_KEY="your-2captcha-key"

# Anti-Captcha
export ANTICAPTCHA_API_KEY="your-anticaptcha-key"

# CapMonster
export CAPMONSTER_API_KEY="your-capmonster-key"
```

### **Proxy & Anonymization**
```bash
# ProxyMesh (Rotating Proxies)
export PROXYMESH_USERNAME="your-proxymesh-username"
export PROXYMESH_PASSWORD="your-proxymesh-password"

# Bright Data (formerly Luminati)
export BRIGHTDATA_USERNAME="your-brightdata-username"
export BRIGHTDATA_PASSWORD="your-brightdata-password"
```

## 🎯 **API Priority Classification**

### **🚨 CRITICAL (Required for Core Functionality)**
1. `SHODAN_API_KEY` - Network reconnaissance
2. `OPENAI_API_KEY` - Report generation
3. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` - Database
4. `REDIS_URL` - Job queue
5. `DATABASE_URL` - Primary database

### **🔥 HIGH (Required for Full Security Coverage)**
6. `GITHUB_TOKEN` - Repository scanning
7. `VIRUSTOTAL_API_KEY` - Malware/URL analysis  
8. `WHOISXML_API_KEY` - Domain intelligence
9. `CENSYS_API_ID` + `CENSYS_SECRET` - Certificate intel
10. `NVD_API_KEY` - Vulnerability data

### **⚡ MEDIUM (Enhanced Capabilities)**
11. `SECURITYTRAILS_API_KEY` - DNS history
12. `ABUSEIPDB_API_KEY` - IP reputation
13. `HUNTER_API_KEY` - Email discovery
14. `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` - Cloud scanning
15. `HIBP_API_KEY` - Breach data

### **💡 LOW (Optional Enhancements)**
- Social media APIs (Twitter, LinkedIn)
- Additional threat intel sources
- Cloud provider credentials
- Captcha solving services

## 📋 **Quick Setup Commands**

### **Minimal Testing Setup** (Core functionality only)
```bash
export SHODAN_API_KEY="your-shodan-key"
export OPENAI_API_KEY="sk-your-openai-key"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-supabase-key"
export REDIS_URL="your-redis-url"
export DATABASE_URL="your-postgres-url"
```

### **Full Testing Setup** (All capabilities)
```bash
# Copy from sections above based on required functionality
# Recommended: Start with CRITICAL and HIGH priority APIs
# Add MEDIUM and LOW priority as needed for specific tests
```

## 🔒 **Security Best Practices**

### **Environment Management**
- Store in `.env.test` file (gitignored)
- Use different keys for testing vs production
- Rotate keys regularly
- Use minimal permissions for test accounts

### **Key Rotation Schedule**
- **Daily**: Development/testing keys
- **Weekly**: Staging environment keys  
- **Monthly**: Production keys (if used in testing)
- **Immediately**: Upon any suspected compromise

### **Access Control**
- Separate API keys for each team member
- Use read-only keys where possible
- Monitor API usage and set quotas
- Enable 2FA for all API accounts

---

**Total API Keys Required for Full Coverage: ~40-50 keys across 25+ services**

**Minimum for Core Testing: 6 critical keys**

**Recommended for Security Scanning: 15-20 keys**

This comprehensive list ensures your DealBrief security scanner can perform real-world testing against actual APIs and services, providing maximum validation confidence! 🛡️