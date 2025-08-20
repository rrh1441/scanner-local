# Frontend Report Viewing Implementation Instructions

## Overview
You need to build a complete report viewing system for the dealbrief-scanner frontend. Currently, users can trigger scans, review findings, and generate reports, but they cannot view the generated reports without manually copying content from Supabase cells.

## Current State Analysis
- ✅ Reports page exists at `/src/app/(dashboard)/reports/page.tsx` with report generation and listing
- ✅ Report generation works and saves to database
- ❌ **Critical Gap**: Clicking "View" button on reports leads to 404 (links to `/reports/${report.id}` but no page exists)
- ❌ No API endpoint to fetch individual reports by ID
- ❌ No proper viewing interface for the three report types

## Three Report Types to Support
Based on `report_templates_rows.csv`, you need to support viewing these report types:

1. **threat_snapshot** - Executive dashboard (≤650 words, financial focus)
2. **executive_summary** - Executive briefing (≤2500 words, strategic focus) 
3. **technical_remediation** - Technical guide (≤4500 words, detailed remediation)

## Required Implementation Steps

### 1. Create Individual Report API Endpoint
**File**: `/src/app/api/reports/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error fetching report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 2. Create Report Detail Page
**File**: `/src/app/(dashboard)/reports/[id]/page.tsx`

This should be a comprehensive report viewer that:
- Fetches the individual report by ID
- Displays different UI layouts based on report type
- Shows report metadata (company, domain, findings count, date)
- Renders markdown content with proper styling
- Includes export and share functionality
- Has back navigation to reports list

Key features to implement:
- Use `useQuery` to fetch report data from `/api/reports/[id]`
- Detect report type from `report.report_type` field
- Use different icons/colors for each report type:
  - `threat_snapshot`: Red AlertTriangle icon, financial focus
  - `executive_summary`: Blue Building icon, strategic focus  
  - `technical_remediation`: Green Shield icon, technical focus
- Render markdown content using `react-markdown` with `remark-gfm`
- Style tables, code blocks, and other markdown elements appropriately
- Add export functionality to download as .md file
- Add share functionality (native share API + clipboard fallback)

### 3. Enhanced Report Type Support
Update the database schema to track report types if not already present:
- Ensure `reports` table has `report_type` column
- Update report generation to set appropriate report type

### 4. Improved Reports List Page
**File**: `/src/app/(dashboard)/reports/page.tsx` (modify existing)

Enhance the existing reports page to:
- Show report type badges in the reports table
- Add report type filtering/sorting
- Show different icons for different report types
- Ensure "View" button properly links to `/reports/${report.id}`

### 5. Report Content Styling
Create proper CSS/Tailwind classes for rendering report content:
- Executive reports should look professional and clean
- Technical reports need code syntax highlighting
- Financial data should be prominently displayed
- Tables should be responsive and well-formatted

### 6. Error Handling & Loading States
Implement proper error handling for:
- Report not found (404)
- Network errors
- Permission errors
- Loading states with skeleton UI

### 7. Mobile Responsiveness
Ensure all report viewing components work well on mobile:
- Responsive tables
- Proper text sizing
- Touch-friendly buttons
- Collapsible sections for long reports

## Technical Requirements

### Dependencies to Install
```bash
npm install react-markdown remark-gfm
```

### UI Components to Use
- `@/components/ui/card` - For report sections
- `@/components/ui/button` - For actions
- `@/components/ui/badge` - For report types and status
- `@/components/ui/tabs` - If implementing tabbed view
- Lucide icons: `ArrowLeft`, `Download`, `Share2`, `FileText`, `AlertTriangle`, `Building`, `Shield`, `Globe`, `Calendar`, `CheckCircle`

### Database Schema Assumptions
The `reports` table should contain:
- `id` (primary key)
- `scan_id` (foreign key)
- `company_name` (string)
- `domain` (string)
- `content` (text - markdown content)
- `report_type` (string - one of: threat_snapshot, executive_summary, technical_remediation)
- `findings_count` (integer)
- `status` (string)
- `created_at` (timestamp)

## Expected User Flow After Implementation
1. User goes to `/reports` page
2. User sees list of generated reports with type badges
3. User clicks "View" button on any report
4. User is taken to `/reports/{id}` page showing formatted report
5. User can read the full report content with proper styling
6. User can export report as markdown file
7. User can share report link
8. User can navigate back to reports list

## Testing Requirements
After implementation, verify:
- All three report types display correctly
- Markdown rendering works properly (tables, code blocks, etc.)
- Export functionality downloads correct file
- Share functionality works on both mobile and desktop
- Error states display properly
- Loading states work correctly
- Mobile layout is usable

## Success Criteria
✅ Users can view any generated report without accessing Supabase directly
✅ Each report type has appropriate styling and layout
✅ Reports are fully readable and professional-looking
✅ Export and share functionality works
✅ No 404 errors when clicking "View" buttons
✅ Mobile users can read reports comfortably