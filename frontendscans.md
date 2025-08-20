Bulk:

import { NextRequest, NextResponse } from 'next/server'

interface BulkScanRequest {
  companyName: string
  domain: string
  tags?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { scans } = await request.json() as { scans: BulkScanRequest[] }

    if (!scans || !Array.isArray(scans) || scans.length === 0) {
      return NextResponse.json(
        { error: 'Scans array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate each scan entry
    const validScans = scans.filter(scan => 
      scan.companyName && scan.companyName.trim() && 
      scan.domain && scan.domain.trim()
    )

    if (validScans.length === 0) {
      return NextResponse.json(
        { error: 'No valid scans found. Each scan must have companyName and domain' },
        { status: 400 }
      )
    }

    const results = []
    const errors = []

    // Process each scan sequentially to avoid overwhelming the external API
    for (const scan of validScans) {
      try {
        const response = await fetch('https://dealbrief-scanner.fly.dev/scans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://lfbi.vercel.app'
          },
          body: JSON.stringify({
            companyName: scan.companyName.trim(),
            domain: scan.domain.trim(),
            tags: scan.tags || []
          })
        })

        if (!response.ok) {
          throw new Error(`Scanner API error for ${scan.companyName}: ${response.statusText}`)
        }

        const result = await response.json()
        results.push({
          companyName: scan.companyName,
          domain: scan.domain,
          status: 'success',
          scanId: result.scanId || result.id
        })

        // Add a small delay between requests to be respectful to the external API
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`Failed to start scan for ${scan.companyName}:`, error)
        errors.push({
          companyName: scan.companyName,
          domain: scan.domain,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      total: validScans.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    })

  } catch (error) {
    console.error('Failed to process bulk scans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

Single

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { companyName, domain, tags } = await request.json()

    if (!companyName || !domain) {
      return NextResponse.json(
        { error: 'Company name and domain are required' },
        { status: 400 }
      )
    }

    // Call the external scanner API (keep working scan functionality)
    const response = await fetch('https://dealbrief-scanner.fly.dev/scans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://lfbi.vercel.app'
      },
      body: JSON.stringify({
        companyName,
        domain,
        tags: tags || []
      })
    })

    if (!response.ok) {
      throw new Error(`Scanner API error: ${response.statusText}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to start scan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('scan_status')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch scans' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch scans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}