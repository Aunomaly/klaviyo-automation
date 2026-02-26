import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/image-providers'
import type { AspectRatio, ImageSize, ImageType } from '@/lib/image-providers/types'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/images/generate
 *
 * Generates an image using the configured provider/model and optionally
 * persists it to Supabase Storage + brand_images.
 *
 * Body:
 *   provider        string   — 'gemini' (required)
 *   model           string   — e.g. 'gemini-2.5-flash-image' (required)
 *   prompt          string   — generation prompt (required)
 *   negativePrompt  string   — what to avoid (optional)
 *   aspectRatio     string   — '1:1' | '16:9' | '4:3' | '3:4' | '9:16'
 *   imageSize       string   — '1K' | '2K' | '4K' (Pro only)
 *   temperature     number   — 0–1
 *   imageType       string   — 'hero' | 'product' | 'lifestyle' | 'ad' | 'content'
 *   brandId         string   — if provided, saves result to brand_images
 *   brandName       string
 *   productName     string
 *   referenceImageIds string[] — IDs of brand_images rows to use as references
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      provider: providerId = 'gemini',
      model: modelId = 'gemini-2.5-flash-image',
      prompt,
      negativePrompt,
      aspectRatio,
      imageSize,
      temperature,
      imageType = 'hero',
      brandId,
      brandName,
      productName,
      referenceImageIds,
    } = body

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    // ── Resolve reference images from brand_images if IDs provided ──────────
    let referenceImages: { url: string; mimeType?: string }[] = []

    if (brandId && referenceImageIds && referenceImageIds.length > 0) {
      const supabase = await createServiceRoleClient()
      const { data: refRows } = await supabase
        .from('brand_images')
        .select('id, original_url, klaviyo_image_url')
        .in('id', referenceImageIds)
        .eq('brand_id', brandId)

      if (refRows) {
        referenceImages = (refRows as Array<{ id: string; original_url: string; klaviyo_image_url: string | null }>).map((r) => ({
          url: r.klaviyo_image_url ?? r.original_url,
        }))
      }
    }

    // ── Generate ─────────────────────────────────────────────────────────────
    const provider = getProvider(providerId)
    const result = await provider.generate(modelId, {
      prompt,
      negativePrompt,
      aspectRatio: aspectRatio as AspectRatio | undefined,
      imageSize: imageSize as ImageSize | undefined,
      temperature,
      imageType: imageType as ImageType,
      brandName,
      productName,
      referenceImages,
    })

    // ── Persist to Supabase Storage + brand_images (if brandId provided) ─────
    let savedImage: Record<string, unknown> | null = null
    let publicUrl: string | null = null

    if (brandId) {
      try {
        const supabase = await createServiceRoleClient()

        // Upload to Supabase Storage
        const imageBuffer = Buffer.from(result.base64, 'base64')
        const ext = result.mimeType.includes('png') ? 'png' : 'jpg'
        const filename = `${Date.now()}.${ext}`
        const storagePath = `generated-images/${brandId}/${filename}`

        const { error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(storagePath, imageBuffer, {
            contentType: result.mimeType,
            upsert: false,
          })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('brand-assets')
            .getPublicUrl(storagePath)
          publicUrl = urlData.publicUrl
        }

        // Save record to brand_images
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: imageRow } = await (supabase as any)
          .from('brand_images')
          .insert({
            brand_id: brandId,
            original_url: publicUrl ?? '',
            image_type: imageType,
            is_ai_generated: true,
            generation_prompt: prompt,
            reference_image_ids: referenceImageIds ?? null,
            model: result.model,
            provider: result.provider,
            storage_path: publicUrl ? storagePath : null,
            uploaded_to_klaviyo: false,
            display_order: 0,
          })
          .select()
          .single()

        savedImage = imageRow
      } catch (persistErr) {
        // Non-fatal — still return the generated image even if persistence fails
        console.error('Failed to persist generated image:', persistErr)
      }
    }

    // Return data URL for immediate use in UI, plus the saved record if available
    const dataUrl = `data:${result.mimeType};base64,${result.base64}`

    return NextResponse.json({
      success: true,
      dataUrl,
      publicUrl,
      model: result.model,
      provider: result.provider,
      savedImage,
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: 'Image generation failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/images/generate/models
 * Returns the list of available models for the UI picker.
 */
export async function GET() {
  const { ALL_MODELS } = await import('@/lib/image-providers')
  return NextResponse.json({ models: ALL_MODELS })
}
