import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ApproveDesignRequest {
  designId: string
  approved: boolean
  rejectionReason?: string
  approvedBy?: string
}

/**
 * POST /api/figma/approve
 * Approve or reject a Figma design
 */
export async function POST(request: NextRequest) {
  try {
    const body: ApproveDesignRequest = await request.json()
    const { designId, approved, rejectionReason, approvedBy } = body

    if (!designId) {
      return NextResponse.json(
        { error: 'designId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update the design approval status
    const { data, error } = await supabase
      .from('figma_designs')
      .update({
        approval_status: approved ? 'approved' : 'rejected',
        approved_by: approvedBy || 'user',
        approved_at: approved ? new Date().toISOString() : null,
        rejection_reason: rejectionReason || null,
      })
      .eq('id', designId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      design: data,
      message: approved
        ? 'Design approved successfully'
        : 'Design rejected',
    })
  } catch (error) {
    console.error('Design approval error:', error)
    return NextResponse.json(
      { error: 'Failed to update design approval', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/figma/approve
 * Update design with Figma file information after creation
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { designId, figmaFileUrl, figmaFileId, figmaFrameId, previewImageUrl } = body

    if (!designId) {
      return NextResponse.json(
        { error: 'designId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('figma_designs')
      .update({
        figma_file_url: figmaFileUrl,
        figma_file_id: figmaFileId,
        figma_frame_id: figmaFrameId,
        preview_image_url: previewImageUrl,
      })
      .eq('id', designId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      design: data,
    })
  } catch (error) {
    console.error('Update Figma design error:', error)
    return NextResponse.json(
      { error: 'Failed to update Figma design', details: String(error) },
      { status: 500 }
    )
  }
}
