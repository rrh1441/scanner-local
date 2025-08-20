# Frontend Improvement Instructions

The frontend is not showing recent scans and lacks proper job tracking. This document provides instructions to fix the frontend's real-time monitoring capabilities.

## Current Issues

1. **No Recent Scans Visible**: Frontend not displaying created scans
2. **No Real-time Updates**: Status changes not reflected in UI
3. **Poor Job Tracking**: No progress indicators or detailed status
4. **Manual CLI Required**: User forced to use command line for monitoring

## Required Improvements

### 1. Fix Scan List Display

#### 1.1 Verify API Integration
**Location**: `apps/apps/frontend/src/components/scan-list.tsx`

**Issues to Check:**
- API endpoint connectivity to scanner-api service
- CORS configuration allowing frontend domain
- Authentication/authorization if required
- Error handling for API failures

**API Endpoints to Test:**
```typescript
// Get all scans
GET https://scanner-api-242181373909.us-central1.run.app/api/scans

// Get specific scan
GET https://scanner-api-242181373909.us-central1.run.app/api/scans/{scanId}
```

#### 1.2 Add Error Logging
```typescript
// Add to scan-list component
useEffect(() => {
  const fetchScans = async () => {
    try {
      console.log('Fetching scans from API...');
      const response = await fetch('/api/scans');
      console.log('API Response:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Scans data:', data);
      setScans(data);
    } catch (error) {
      console.error('Failed to fetch scans:', error);
      setError(error.message);
    }
  };
  
  fetchScans();
}, []);
```

### 2. Implement Real-time Status Updates

#### 2.1 Add Polling Mechanism
**Location**: `apps/apps/frontend/src/components/scan-list.tsx`

```typescript
import { useEffect, useState } from 'react';

export function ScanList() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Poll for updates every 5 seconds
  useEffect(() => {
    const pollScans = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SCANNER_API_URL}/api/scans`);
        if (response.ok) {
          const data = await response.json();
          setScans(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        setError(err.message);
      }
    };

    // Initial load
    pollScans();

    // Set up polling interval
    const interval = setInterval(pollScans, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {loading && <div>Loading scans...</div>}
      {error && <div className="text-red-500">Error: {error}</div>}
      {scans.map(scan => (
        <ScanItem key={scan.scanId} scan={scan} />
      ))}
    </div>
  );
}
```

#### 2.2 Add Status Indicators
```typescript
function ScanStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    'queued': { color: 'bg-yellow-100 text-yellow-800', text: 'Queued' },
    'processing': { color: 'bg-blue-100 text-blue-800', text: 'Processing' },
    'completed': { color: 'bg-green-100 text-green-800', text: 'Completed' },
    'failed': { color: 'bg-red-100 text-red-800', text: 'Failed' }
  };

  const config = statusConfig[status] || statusConfig['queued'];
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.text}
    </span>
  );
}
```

### 3. Add Progress Tracking

#### 3.1 Create Progress Component
**Location**: `apps/apps/frontend/src/components/scan-progress.tsx`

```typescript
import { useEffect, useState } from 'react';

interface ScanProgressProps {
  scanId: string;
  status: string;
}

export function ScanProgress({ scanId, status }: ScanProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentModule, setCurrentModule] = useState('');
  const [completedModules, setCompletedModules] = useState<string[]>([]);

  useEffect(() => {
    if (status !== 'processing') return;

    const pollProgress = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SCANNER_API_URL}/api/scans/${scanId}/progress`);
        if (response.ok) {
          const data = await response.json();
          setProgress(data.progress || 0);
          setCurrentModule(data.currentModule || '');
          setCompletedModules(data.completedModules || []);
        }
      } catch (err) {
        console.error('Progress polling error:', err);
      }
    };

    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [scanId, status]);

  if (status !== 'processing') return null;

  return (
    <div className="mt-2">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>Progress: {progress}%</span>
        <span>{currentModule && `Running: ${currentModule}`}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {completedModules.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Completed: {completedModules.join(', ')}
        </div>
      )}
    </div>
  );
}
```

### 4. Add Detailed Job Monitoring

#### 4.1 Create Job Details Modal
**Location**: `apps/apps/frontend/src/components/job-details-modal.tsx`

```typescript
import { useEffect, useState } from 'react';

interface JobDetailsModalProps {
  scanId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function JobDetailsModal({ scanId, isOpen, onClose }: JobDetailsModalProps) {
  const [jobDetails, setJobDetails] = useState(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || !scanId) return;

    const fetchJobDetails = async () => {
      try {
        // Fetch job execution details
        const response = await fetch(`${process.env.NEXT_PUBLIC_SCANNER_API_URL}/api/scans/${scanId}/job`);
        if (response.ok) {
          const data = await response.json();
          setJobDetails(data);
        }

        // Fetch recent logs
        const logsResponse = await fetch(`${process.env.NEXT_PUBLIC_SCANNER_API_URL}/api/scans/${scanId}/logs`);
        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          setLogs(logsData.logs || []);
        }
      } catch (err) {
        console.error('Failed to fetch job details:', err);
      }
    };

    fetchJobDetails();
    const interval = setInterval(fetchJobDetails, 5000);
    
    return () => clearInterval(interval);
  }, [scanId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Job Details: {scanId}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        
        {jobDetails && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Execution Status</h3>
            <div className="bg-gray-100 p-3 rounded">
              <p><strong>Status:</strong> {jobDetails.status}</p>
              <p><strong>Started:</strong> {jobDetails.startTime}</p>
              <p><strong>Duration:</strong> {jobDetails.duration}</p>
              <p><strong>Tasks:</strong> {jobDetails.completedTasks}/{jobDetails.totalTasks}</p>
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-2">Recent Logs</h3>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-auto">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))
            ) : (
              <div>No logs available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 5. Environment Configuration

#### 5.1 Update Environment Variables
**Location**: `apps/apps/frontend/.env.local`

```bash
NEXT_PUBLIC_SCANNER_API_URL=https://scanner-api-242181373909.us-central1.run.app
```

#### 5.2 Update Next.js Config
**Location**: `apps/apps/frontend/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SCANNER_API_URL: process.env.NEXT_PUBLIC_SCANNER_API_URL,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_SCANNER_API_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
```

### 6. API Enhancements Required

The frontend improvements require the following API endpoints to be implemented:

#### 6.1 Progress Tracking Endpoint
```typescript
// GET /api/scans/:scanId/progress
{
  "progress": 65,
  "currentModule": "nuclei",
  "completedModules": ["shodan", "dns_twist", "endpoint_discovery"],
  "totalModules": 15,
  "estimatedTimeRemaining": "45 seconds"
}
```

#### 6.2 Job Details Endpoint
```typescript
// GET /api/scans/:scanId/job
{
  "executionId": "scanner-job-zbvj4",
  "status": "running",
  "startTime": "2025-08-04T16:11:50.661Z",
  "duration": "3m 45s",
  "completedTasks": 0,
  "totalTasks": 1,
  "gcpJobUrl": "https://console.cloud.google.com/run/jobs/executions/..."
}
```

#### 6.3 Logs Endpoint
```typescript
// GET /api/scans/:scanId/logs
{
  "logs": [
    "[2025-08-04T16:12:09.657Z] [endpointDiscovery] +backend supabase:ltiuuauafphpwewqktdv",
    "[2025-08-04T16:12:09.506Z] [Shodan] Done — 0 services found",
    "[2025-08-04T16:12:09.582Z] [spfDmarc] Performing recursive SPF check..."
  ]
}
```

## Implementation Priority

### Phase 1 (High Priority)
1. Fix scan list API connectivity
2. Add error logging and display
3. Implement status polling

### Phase 2 (Medium Priority)  
4. Add progress indicators
5. Create job details modal
6. Implement real-time updates

### Phase 3 (Nice to Have)
7. Add log streaming
8. Performance metrics display
9. Historical scan analytics

## Testing Instructions

1. **Verify API Connectivity**: Test all API endpoints from browser console
2. **Check Real-time Updates**: Create scan and verify status changes appear
3. **Test Error Handling**: Simulate API failures and verify error messages
4. **Monitor Performance**: Ensure polling doesn't impact page performance
5. **Cross-browser Testing**: Verify functionality in Chrome, Firefox, Safari

---

**Goal**: Eliminate need for command line monitoring by providing comprehensive frontend visibility into scan execution and results.

**Success Criteria**: User can create scan, monitor progress, view results, and debug issues entirely through the web interface.