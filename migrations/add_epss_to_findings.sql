-- ============================================================================
-- Migration: Add EPSS Score Support to Findings and EAL Calculation
-- ============================================================================
-- This migration adds EPSS (Exploit Prediction Scoring System) support to
-- dynamically adjust the prevalence factor in EAL calculations based on
-- real-world exploit likelihood.
-- ============================================================================

-- Step 1: Add epss_score column to findings table (if using PostgreSQL)
-- For Firestore, this would be added as a field in the document
ALTER TABLE findings ADD COLUMN IF NOT EXISTS epss_score NUMERIC(5,4);

-- Add index for faster queries on high-risk findings
CREATE INDEX IF NOT EXISTS idx_findings_epss_score ON findings(epss_score) WHERE epss_score > 0.1;

-- Step 2: Update the EAL calculation function to use dynamic EPSS-based prevalence
CREATE OR REPLACE FUNCTION calculate_finding_eal()
RETURNS TRIGGER AS $$
DECLARE
    base_cost NUMERIC;
    severity_multiplier NUMERIC;
    type_multiplier NUMERIC;
    prevalence_factor NUMERIC := 1.0; -- Default prevalence
    extracted_cost NUMERIC;
BEGIN
    -- Base cost by severity
    CASE NEW.severity
        WHEN 'CRITICAL' THEN 
            base_cost := 250000;
            severity_multiplier := 4.0;
        WHEN 'HIGH' THEN 
            base_cost := 50000;
            severity_multiplier := 2.0;
        WHEN 'MEDIUM' THEN 
            base_cost := 10000;
            severity_multiplier := 1.0;
        WHEN 'LOW' THEN 
            base_cost := 2500;
            severity_multiplier := 0.5;
        ELSE 
            base_cost := 0;
            severity_multiplier := 0;
    END CASE;

    -- Finding type multipliers (existing logic)
    CASE NEW.finding_type
        WHEN 'DENIAL_OF_WALLET' THEN
            -- Extract cost from description if available
            extracted_cost := COALESCE(
                (regexp_match(NEW.description, '\$([0-9,]+(?:\.[0-9]+)?)'))[1]::NUMERIC,
                0
            );
            IF extracted_cost > 0 THEN
                NEW.eal_daily := extracted_cost;
                NEW.eal_low := extracted_cost * 30;
                NEW.eal_ml := extracted_cost * 90;
                NEW.eal_high := extracted_cost * 365;
                RETURN NEW;
            END IF;
            type_multiplier := 10.0;
        WHEN 'CLOUD_COST_AMPLIFICATION' THEN
            type_multiplier := 10.0;
        WHEN 'ADA_LEGAL_CONTINGENT_LIABILITY' THEN
            NEW.eal_low := 25000;
            NEW.eal_ml := 75000;
            NEW.eal_high := 500000;
            NEW.eal_daily := 0;
            RETURN NEW;
        WHEN 'GDPR_VIOLATION' THEN
            type_multiplier := 5.0;
        WHEN 'PCI_COMPLIANCE_FAILURE' THEN
            type_multiplier := 4.0;
        WHEN 'EXPOSED_DATABASE' THEN
            type_multiplier := 8.0;
        WHEN 'DATA_BREACH_EXPOSURE' THEN
            type_multiplier := 6.0;
        WHEN 'CLIENT_SIDE_SECRET_EXPOSURE' THEN
            type_multiplier := 3.0;
        WHEN 'VERIFIED_CVE' THEN
            type_multiplier := 2.5;
        WHEN 'MALICIOUS_TYPOSQUAT' THEN
            type_multiplier := 3.0;
        WHEN 'PHISHING_INFRASTRUCTURE' THEN
            type_multiplier := 4.0;
        ELSE
            type_multiplier := 1.0;
    END CASE;

    -- NEW: Dynamic prevalence factor based on EPSS score
    -- EPSS scores indicate the probability of exploitation in the next 30 days
    IF NEW.epss_score IS NOT NULL THEN
        IF NEW.epss_score > 0.9 THEN
            -- 90%+ probability of exploitation (critical risk)
            prevalence_factor := 10.0;
        ELSIF NEW.epss_score > 0.5 THEN
            -- 50-90% probability (high risk)
            prevalence_factor := 5.0;
        ELSIF NEW.epss_score > 0.1 THEN
            -- 10-50% probability (medium risk)
            prevalence_factor := 2.0;
        ELSIF NEW.epss_score > 0.01 THEN
            -- 1-10% probability (low but present risk)
            prevalence_factor := 1.2;
        ELSE
            -- Under 1% probability (minimal additional risk)
            prevalence_factor := 1.0;
        END IF;
    END IF;

    -- Calculate final EAL with all factors including EPSS-based prevalence
    NEW.eal_ml := base_cost * severity_multiplier * type_multiplier * prevalence_factor;
    NEW.eal_low := NEW.eal_ml * 0.6;
    NEW.eal_high := NEW.eal_ml * 1.4;
    NEW.eal_daily := NEW.eal_ml / 365;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create or replace the triggers (they'll use the updated function)
DROP TRIGGER IF EXISTS calculate_eal_on_insert ON findings;
CREATE TRIGGER calculate_eal_on_insert
    BEFORE INSERT ON findings
    FOR EACH ROW
    EXECUTE FUNCTION calculate_finding_eal();

DROP TRIGGER IF EXISTS calculate_eal_on_update ON findings;
CREATE TRIGGER calculate_eal_on_update
    BEFORE UPDATE OF severity, finding_type, description, epss_score ON findings
    FOR EACH ROW
    WHEN (OLD.severity IS DISTINCT FROM NEW.severity 
       OR OLD.finding_type IS DISTINCT FROM NEW.finding_type 
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.epss_score IS DISTINCT FROM NEW.epss_score)
    EXECUTE FUNCTION calculate_finding_eal();

-- Step 4: Create an enhanced summary view that includes EPSS statistics
CREATE OR REPLACE VIEW scan_eal_summary_with_epss AS
SELECT 
    scan_id,
    COUNT(*) as total_findings,
    COUNT(CASE WHEN epss_score > 0.9 THEN 1 END) as critical_exploit_risk_count,
    COUNT(CASE WHEN epss_score > 0.5 THEN 1 END) as high_exploit_risk_count,
    AVG(epss_score) as avg_epss_score,
    MAX(epss_score) as max_epss_score,
    SUM(eal_low) as total_eal_low,
    SUM(eal_ml) as total_eal_ml,
    SUM(eal_high) as total_eal_high,
    SUM(eal_daily) as total_eal_daily,
    MAX(created_at) as last_finding
FROM findings
WHERE scan_id IS NOT NULL
GROUP BY scan_id;

-- Step 5: Backfill trigger for any existing findings without EAL values
-- This will recalculate EAL for all findings to apply the new EPSS logic
UPDATE findings 
SET eal_ml = eal_ml 
WHERE eal_ml IS NULL OR epss_score IS NOT NULL;

-- Step 6: Add helper function to get EPSS risk level
CREATE OR REPLACE FUNCTION get_epss_risk_level(score NUMERIC)
RETURNS TEXT AS $$
BEGIN
    IF score IS NULL THEN
        RETURN 'UNKNOWN';
    ELSIF score > 0.9 THEN
        RETURN 'CRITICAL';
    ELSIF score > 0.5 THEN
        RETURN 'HIGH';
    ELSIF score > 0.1 THEN
        RETURN 'MEDIUM';
    ELSIF score > 0.01 THEN
        RETURN 'LOW';
    ELSE
        RETURN 'MINIMAL';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 7: Create index for efficient EPSS-based queries
CREATE INDEX IF NOT EXISTS idx_findings_high_epss 
ON findings(scan_id, epss_score DESC) 
WHERE epss_score > 0.5;

-- ============================================================================
-- Migration Complete!
-- 
-- What this migration does:
-- 1. Adds epss_score column to findings table
-- 2. Updates EAL calculation to use dynamic EPSS-based prevalence factors
-- 3. Creates enhanced summary view with EPSS statistics
-- 4. Adds helper function for EPSS risk categorization
-- 5. Creates indexes for efficient querying
--
-- EPSS Prevalence Multipliers:
-- - > 90% exploitation probability: 10x multiplier (critical)
-- - > 50% exploitation probability: 5x multiplier (high)
-- - > 10% exploitation probability: 2x multiplier (medium)
-- - > 1% exploitation probability: 1.2x multiplier (low)
-- - <= 1% exploitation probability: 1x multiplier (minimal)
-- ============================================================================