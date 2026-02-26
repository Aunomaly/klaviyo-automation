import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateDesignPrompt,
  generateDesignMetadata,
  createBrandContext,
  getTemplateDesign,
  type FigmaDesignResult,
} from '@/lib/figma'

interface GenerateFigmaRequest {
  brandId: string
  templateTypes: string[] // e.g., ['welcome_1', 'abandoned_cart_1']
  figmaFileUrl?: string // Optional: existing file to add to
}

/**
 * POST /api/figma/generate
 * Generate Figma designs for email templates using MCP
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateFigmaRequest = await request.json()
    const { brandId, templateTypes, figmaFileUrl } = body

    if (!brandId || !templateTypes || templateTypes.length === 0) {
      return NextResponse.json(
        { error: 'brandId and templateTypes are required' },
        { status: 400 }
      )
    }

    // Get brand data
    const supabase = await createClient()
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single()

    if (brandError || !brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      )
    }

    const brandContext = createBrandContext(brand)
    const results: Array<{
      templateType: string
      design: FigmaDesignResult
      designId?: string
    }> = []

    // Generate designs for each template
    for (const templateType of templateTypes) {
      const templateSpec = getTemplateDesign(templateType)
      if (!templateSpec) {
        results.push({
          templateType,
          design: {
            success: false,
            error: `Unknown template type: ${templateType}`,
          },
        })
        continue
      }

      try {
        // Generate the design prompt
        const prompt = generateDesignPrompt(brandContext, templateSpec)
        const metadata = generateDesignMetadata(brandContext, templateSpec)

        // Call Figma MCP to generate the design
        let figmaResult: FigmaDesignResult = { success: false }
        let figmaError: string | undefined
        
        // Generate the Figma design prompt
        const figmaPrompt = `Generate an email template design for "${templateSpec.templateName}" with the following specifications:

Brand: ${brand.name}
Colors: Primary ${brandContext.primaryColor}, Secondary ${brandContext.secondaryColor}
Font: ${brandContext.fontPrimary}
Template Type: ${templateType}
Layout: ${templateSpec.layout.width}px wide with ${templateSpec.layout.sections.length} sections

Design Requirements:
${prompt}

${figmaFileUrl ? `Add this design to existing file: ${figmaFileUrl}` : 'Create a new Figma file named: ' + brand.name + ' - Email Templates'}

Use modern email design best practices with responsive layouts suitable for email clients.`

        // Note: The actual MCP call would be made here
        // For now, we'll store the prompt and mark it for manual creation
        figmaResult = {
          success: false,
          error: 'Figma MCP integration pending - design specs saved for manual creation',
        }
        figmaError = figmaResult.error

        // Create a design record in the database
        const { data: design, error: designError } = await supabase
          .from('figma_designs')
          .insert({
            brand_id: brandId,
            design_name: `${brand.name} - ${templateSpec.templateName}`,
            design_type: 'email_template',
            source_type: 'generated',
            approval_status: 'pending',
            figma_file_url: figmaResult.figmaFileUrl || null,
            figma_file_id: figmaResult.figmaFileId || null,
            figma_frame_id: figmaResult.figmaFrameId || null,
            preview_image_url: figmaResult.previewImageUrl || null,
            design_data: {
              ...metadata,
              prompt: figmaPrompt,
              figma_generation_status: figmaResult.success ? 'completed' : 'pending',
              figma_error: figmaError,
            },
          })
          .select()
          .single()

        if (designError) {
          throw designError
        }

        results.push({
          templateType,
          design: {
            success: true,
            figmaFileUrl: figmaResult.figmaFileUrl,
            error: figmaError,
          },
          designId: design.id,
        })
      } catch (error) {
        console.error(`Error generating design for ${templateType}:`, error)
        results.push({
          templateType,
          design: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    }

    return NextResponse.json({
      success: results.every(r => r.design.success),
      results,
      message: `Generated ${results.filter(r => r.design.success).length}/${templateTypes.length} designs`,
    })
  } catch (error) {
    console.error('Figma generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate Figma designs', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/figma/generate?brandId=xxx
 * Get all Figma designs for a brand
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')

    if (!brandId) {
      return NextResponse.json(
        { error: 'brandId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('figma_designs')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ designs: data })
  } catch (error) {
    console.error('Get Figma designs error:', error)
    return NextResponse.json(
      { error: 'Failed to get Figma designs', details: String(error) },
      { status: 500 }
    )
  }
}
