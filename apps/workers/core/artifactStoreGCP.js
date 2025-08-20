import { Firestore } from '@google-cloud/firestore';
const firestore = new Firestore();
// Recursively sanitize undefined values to prevent Firestore errors
function deepSanitizeUndefined(obj) {
    if (obj === null || obj === undefined) {
        return null;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitizeUndefined(item));
    }
    if (typeof obj === 'object' && obj !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = deepSanitizeUndefined(value);
        }
        return sanitized;
    }
    return obj;
}
// Export a stub pool for backward compatibility
// This is no longer used in GCP implementation
export const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({ release: () => { } }),
    end: async () => { }
};
export async function insertArtifact(artifactOrType, val_text, severity, meta, unused) {
    // Handle legacy 4 or 5 parameter calls
    if (typeof artifactOrType === 'string') {
        const artifact = {
            type: artifactOrType,
            val_text: val_text || '',
            severity: severity || 'INFO',
            meta: meta || {}
        };
        return insertArtifactInternal(artifact);
    }
    // Handle new single-parameter calls
    return insertArtifactInternal(artifactOrType);
}
async function insertArtifactInternal(artifact) {
    try {
        // Recursively sanitize undefined values to null for Firestore compatibility
        const sanitizedArtifact = deepSanitizeUndefined({ ...artifact });
        const docRef = await firestore.collection('artifacts').add({
            ...sanitizedArtifact,
            created_at: new Date().toISOString(),
            scan_id: artifact.meta?.scan_id || 'unknown'
        });
        // Return a fake ID for compatibility
        return Date.now();
    }
    catch (error) {
        console.error('Failed to insert artifact:', error);
        throw error;
    }
}
// Stub for compatibility
export async function initializeDatabase() {
    console.log('Using Firestore - no initialization needed');
}
export async function insertFinding(findingOrArtifactId, findingType, recommendation, description, reproCommand) {
    // Handle legacy 4 or 5 parameter calls
    if (typeof findingOrArtifactId === 'number' && findingType) {
        const finding = {
            artifact_id: findingOrArtifactId,
            finding_type: findingType,
            recommendation: recommendation || '',
            description: description || '',
            repro_command: reproCommand || null
        };
        return insertFindingInternal(finding);
    }
    // Handle new single-parameter calls
    return insertFindingInternal(findingOrArtifactId);
}
async function insertFindingInternal(finding) {
    try {
        // Recursively sanitize undefined values to null for Firestore compatibility
        const sanitizedFinding = deepSanitizeUndefined({ ...finding });
        const docRef = await firestore.collection('findings').add({
            ...sanitizedFinding,
            created_at: new Date().toISOString()
        });
        // Return a fake ID for compatibility
        return Date.now();
    }
    catch (error) {
        console.error('Failed to insert finding:', error);
        throw error;
    }
}
