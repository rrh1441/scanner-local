# Consolidated EAL (Expected Annual Loss) Methodology

## Overview

This document describes the unified cost calculation methodology that consolidates all risk factors into a single, configurable system aligned with the existing scan totals aggregation.

## Architecture

### Core Tables

1. **attack_meta** - Defines attack categories and base financial impacts
   - `attack_type_code`: Primary key (e.g., PHISHING_BEC, SITE_HACK)
   - `prevalence`: Likelihood factor (0-1)
   - `raw_weight`: Base financial impact in dollars
   - `category`: CYBER, LEGAL, or CLOUD

2. **finding_type_mapping** - Maps finding types to attack categories
   - Links specific findings (e.g., VERIFIED_CVE) to attack types (e.g., SITE_HACK)
   - Allows severity overrides and custom multipliers

3. **severity_weight** - Severity-based multipliers
   - CRITICAL: 5.0x multiplier
   - HIGH: 2.5x multiplier
   - MEDIUM: 1.0x multiplier
   - LOW: 0.3x multiplier

4. **risk_constants** - Configurable system parameters
   - Confidence intervals
   - Time factors
   - Special case values (e.g., ADA settlements)

5. **dow_cost_constants** - Denial of Wallet service costs
   - Cost per request for different cloud services
   - Typical RPS and amplification factors

## Calculation Formula

```
Base Impact = raw_weight × severity_multiplier × custom_multiplier × prevalence

EAL Low = Base Impact × severity_low_confidence × LOW_CONFIDENCE_CONSTANT
EAL ML = Base Impact × severity_ml_confidence × ML_CONFIDENCE_CONSTANT  
EAL High = Base Impact × severity_high_confidence × HIGH_CONFIDENCE_CONSTANT
```

## Attack Categories

### CYBER (Aggregated as cyber_total)
- **PHISHING_BEC**: Business email compromise ($300k base)
- **SITE_HACK**: Website vulnerabilities ($500k base)
- **MALWARE**: Malware infections ($400k base)
- **CLIENT_SIDE_SECRET_EXPOSURE**: Exposed secrets ($600k base)

### LEGAL (Separate line items)
- **ADA_COMPLIANCE**: Fixed $25k-$500k liability
- **GDPR_VIOLATION**: GDPR fines ($500k base)
- **PCI_COMPLIANCE_FAILURE**: PCI violations ($250k base)

### CLOUD (Daily costs)
- **DENIAL_OF_WALLET**: Cloud cost attacks (calculated daily)

## Special Cases

### ADA Compliance
- Fixed settlement amounts regardless of severity
- Low: $25,000 (minimum settlement)
- ML: $75,000 (average settlement)
- High: $500,000 (major lawsuit)

### Denial of Wallet
- Extracts daily cost from finding description if available
- Otherwise calculates based on service type and RPS
- EAL values are multiples of daily cost (30, 90, 365 days)

## Integration with Sync Worker

The sync worker aggregates EAL values by attack_type_code:

```sql
SELECT attack_type_code, 
       SUM(eal_low) as total_eal_low,
       SUM(eal_ml) as total_eal_ml,
       SUM(eal_high) as total_eal_high
FROM findings 
WHERE scan_id = ? 
GROUP BY attack_type_code
```

Then maps to scan_totals_automated columns:
- PHISHING_BEC → phishing_bec_low/ml/high
- SITE_HACK → site_hack_low/ml/high  
- MALWARE → malware_low/ml/high
- ADA_COMPLIANCE → ada_compliance_low/ml/high
- DENIAL_OF_WALLET → dow_daily_low/ml/high

## Configuration

### To adjust financial impacts:
```sql
UPDATE attack_meta 
SET raw_weight = 750000 
WHERE attack_type_code = 'SITE_HACK';
```

### To add new finding types:
```sql
INSERT INTO finding_type_mapping (finding_type, attack_type_code, custom_multiplier)
VALUES ('NEW_FINDING_TYPE', 'SITE_HACK', 1.2);
```

### To modify risk constants:
```sql
UPDATE risk_constants 
SET value = 4.0 
WHERE key = 'HIGH_CONFIDENCE';
```

## Migration

Apply the migration to enable the consolidated system:

1. Go to Supabase SQL Editor
2. Run `supabase/migrations/20250111_consolidated_eal_system.sql`
3. Existing findings will be automatically recalculated

## Benefits

1. **Configurable**: All multipliers and weights in database tables
2. **Aligned**: Matches sync worker's attack_type_code aggregation
3. **Extensible**: Easy to add new finding types and attack categories
4. **Auditable**: Clear calculation path from finding to financial impact
5. **Consistent**: Single source of truth for all cost calculations