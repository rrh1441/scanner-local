/**
 * LOCAL SQLITE ONLY - NO GCP FIRESTORE
 * Artifact store with exact GCP function signatures but LOCAL SQLite backend
 */

import { LocalStore } from './localStore.js';

// Global store instance
let store: LocalStore | null = null;

function getStore(): LocalStore {
  if (!store) {
    store = new LocalStore();
  }
  return store;
}

// Stub pool for backward compatibility
export const pool = {
  query: async () => ({ rows: [] }),
  connect: async () => ({ release: () => {} }),
  end: async () => {}
};

export interface ArtifactInput {
  type: string;
  val_text: string;
  severity: string;
  src_url?: string;
  sha256?: string;
  mime?: string;
  meta?: any;
  description?: string;
  repro_command?: string;
}

// EXACT SAME FUNCTION SIGNATURES AS GCP VERSION
// But uses SQLite instead of Firestore

// Function overloads for insertArtifact backward compatibility
export function insertArtifact(artifact: ArtifactInput): Promise<number>;
export function insertArtifact(
  type: string,
  val_text: string,
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
  meta?: any
): Promise<number>;
export function insertArtifact(
  type: string,
  val_text: string,
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
  meta: any,
  unused?: any
): Promise<number>;
export async function insertArtifact(
  artifactOrType: ArtifactInput | string,
  val_text?: string,
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
  meta?: any,
  unused?: any
): Promise<number> {
  // Handle legacy 4 or 5 parameter calls
  if (typeof artifactOrType === 'string') {
    const artifact: ArtifactInput = {
      type: artifactOrType,
      val_text: val_text || '',
      severity: severity || 'INFO',
      meta: meta || {}
    };
    return insertArtifactInternal(artifact);
  }
  
  // Handle new single-parameter calls
  return insertArtifactInternal(artifactOrType as ArtifactInput);
}

async function insertArtifactInternal(artifact: ArtifactInput): Promise<number> {
  try {
    console.log('[LocalStore] Inserting artifact:', {
      type: artifact.type,
      severity: artifact.severity,
      scan_id: artifact.meta?.scan_id || 'unknown'
    });
    
    const artifactData = {
      id: `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scan_id: artifact.meta?.scan_id || 'unknown',
      type: artifact.type,
      file_path: `${artifact.type}_${Date.now()}.txt`,
      size_bytes: Buffer.byteLength(artifact.val_text || '', 'utf8'),
      created_at: new Date()
    };
    
    await getStore().insertArtifact(artifactData);
    console.log(`[LocalStore] Successfully inserted artifact: ${artifact.type}`);
    
    // Return a fake numeric ID for compatibility
    return Date.now();
  } catch (error: any) {
    console.error('[LocalStore] Failed to insert artifact:', {
      error: error.message,
      artifact_type: artifact?.type
    });
    // Don't throw - log and continue to prevent scan failure
    return -1;
  }
}

// Stub for compatibility
export async function initializeDatabase(): Promise<void> {
  console.log('Using SQLite - initialization handled by LocalStore');
}

// Function overloads for insertFinding backward compatibility
export function insertFinding(finding: any): Promise<number>;
export function insertFinding(
  artifactId: number,
  findingType: string,
  recommendation: string,
  description?: string,
  reproCommand?: string
): Promise<number>;
export async function insertFinding(
  findingOrArtifactId: any | number,
  findingType?: string,
  recommendation?: string,
  description?: string,
  reproCommand?: string
): Promise<number> {
  // Handle legacy 4 or 5 parameter calls
  if (typeof findingOrArtifactId === 'number' && findingType) {
    const finding = {
      artifact_id: findingOrArtifactId,
      finding_type: findingType,
      recommendation: recommendation || '',
      description: description || '',
      repro_command: reproCommand || null,
      scan_id: 'unknown', // Will be filled in if possible
      severity: 'MEDIUM',
      type: findingType
    };
    return insertFindingInternal(finding);
  }
  
  // Handle new single-parameter calls
  return insertFindingInternal(findingOrArtifactId);
}

async function insertFindingInternal(finding: any): Promise<number> {
  try {
    console.log('[LocalStore] Inserting finding:', {
      type: finding.type,
      severity: finding.severity,
      scan_id: finding.scan_id
    });
    
    const findingData = {
      id: `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scan_id: finding.scan_id || 'unknown',
      type: finding.type || finding.finding_type,
      severity: finding.severity || 'MEDIUM',
      title: finding.title || finding.recommendation || '',
      description: finding.description || '',
      data: finding.data,
      created_at: new Date()
    };
    
    await getStore().insertFinding(findingData);
    console.log(`[LocalStore] Successfully inserted finding: ${finding.type}`);
    
    // Return a fake numeric ID for compatibility
    return Date.now();
  } catch (error: any) {
    console.error('[LocalStore] Failed to insert finding:', {
      error: error.message,
      finding_type: finding?.type
    });
    // Don't throw - log and continue to prevent scan failure
    return -1;
  }
}