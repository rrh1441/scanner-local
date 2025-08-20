# EAL (Expected Annual Loss) Calculation System

## Overview

The EAL calculation system automatically computes financial risk values for every security finding. It runs completely automatically - no manual intervention needed.

## How It Works

### Automatic Calculation (Preferred)

When findings are inserted into Supabase, a database trigger automatically calculates:
- **eal_low**: Conservative estimate (90% confidence)
- **eal_ml**: Most likely annual loss
- **eal_high**: Worst case scenario
- **eal_daily**: Daily exposure/cost

### Manual Calculation (Backup)

If needed, you can manually trigger EAL calculation for a scan:
```bash
node scripts/trigger-eal-calculation.js <scan_id>
```

## EAL Calculation Logic

### Base Values by Severity

| Severity | Low | Most Likely | High | Daily |
|----------|-----|-------------|------|-------|
| CRITICAL | $50,000 | $250,000 | $1,000,000 | $10,000 |
| HIGH | $10,000 | $50,000 | $250,000 | $2,500 |
| MEDIUM | $2,500 | $10,000 | $50,000 | $500 |
| LOW | $500 | $2,500 | $10,000 | $100 |
| INFO | $0 | $0 | $0 | $0 |

### Finding Type Multipliers

Different finding types have different financial impact multipliers:

**Critical Financial Impact (10x daily cost)**
- DENIAL_OF_WALLET
- CLOUD_COST_AMPLIFICATION

**Legal/Compliance (Fixed amounts or high multipliers)**
- ADA_LEGAL_CONTINGENT_LIABILITY: Fixed $25k-$500k
- GDPR_VIOLATION: 3-10x multiplier
- PCI_COMPLIANCE_FAILURE: 2-8x multiplier

**Data Exposure (High risk)**
- EXPOSED_DATABASE: 4-15x multiplier
- DATA_BREACH_EXPOSURE: 3-10x multiplier
- CLIENT_SIDE_SECRET_EXPOSURE: 2-5x multiplier

**Brand Damage**
- MALICIOUS_TYPOSQUAT: 1.5-6x multiplier
- PHISHING_INFRASTRUCTURE: 2-8x multiplier

## Special Cases

### DENIAL_OF_WALLET
If the finding description contains "Estimated daily cost: $X", the system extracts that value and calculates:
- Daily = Extracted amount
- Low = 30 days
- Most Likely = 90 days  
- High = 365 days

### ADA Compliance
Fixed legal liability amounts:
- Low: $25,000 (minimum settlement)
- Most Likely: $75,000 (average settlement)
- High: $500,000 (major lawsuit)
- Daily: $0 (not a recurring cost)

## Database Components

### Trigger Function
`calculate_finding_eal()` - Automatically runs on insert/update

### Database Triggers
- `calculate_eal_on_insert` - Calculates EAL for new findings
- `calculate_eal_on_update` - Recalculates if severity/type changes

### Summary View
`scan_eal_summary` - Aggregated EAL totals by scan

### Edge Function (Backup)
`eal-calculator` - Manual calculation endpoint

## Viewing EAL Data

### Get scan summary:
```sql
SELECT * FROM scan_eal_summary WHERE scan_id = 'YOUR_SCAN_ID';
```

### Get detailed findings with EAL:
```sql
SELECT finding_type, severity, eal_low, eal_ml, eal_high, eal_daily 
FROM findings 
WHERE scan_id = 'YOUR_SCAN_ID'
ORDER BY eal_ml DESC;
```

## Migration

To enable automatic EAL calculation:

1. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/cssqcaieeixukjxqpynp/sql
2. Copy contents of `supabase/migrations/20250111_eal_trigger.sql`
3. Run in SQL editor

This creates all necessary functions, triggers, and views.