import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { processTemplate, type BrandCustomizations } from '@/lib/templates'

const templateFiles: Record<string, string> = {
  welcome_1: 'welcome-series/welcome-email1b.html',
  welcome_2: 'welcome-series/welcome-email2.html',
  welcome_3: 'welcome-series/welcome-email3.html',
  abandoned_cart_1: 'abandoned-checkout/abandoned-checkout-email1.html',
  abandoned_cart_2: 'abandoned-checkout/abandoned-checkout-email3.html',
  abandoned_cart_3: 'abandoned-checkout/abandoned-checkout-email4.html',
  browse_abandonment_1: 'browse-abandonment/browse-abandonment-email1.html',
  browse_abandonment_2: 'browse-abandonment/browse-abandonment-email3.html',
  winback_1: 'winback/winback-email1.html',
  winback_2: 'winback/winback-email2.html',
}

/**
 * GET /api/templates/preview?brandId=xxx&templateId=welcome_1[&productId=yyy]
 * Returns processed HTML for the template with brand (and optional product) customizations applied.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    const templateId = searchParams.get('templateId')
    const productId = searchParams.get('productId')
    const slotsParam = searchParams.get('slots')
    // Style + link overrides from editor (session-only, not saved to brand)
    const primaryColorOverride = searchParams.get('primaryColor') ?? undefined
    const secondaryColorOverride = searchParams.get('secondaryColor') ?? undefined
    const accentColorOverride = searchParams.get('accentColor') ?? undefined
    const fontPrimaryOverride = searchParams.get('fontPrimary') ?? undefined
    const fontSecondaryOverride = searchParams.get('fontSecondary') ?? undefined
    const productUrlOverride = searchParams.get('productUrlOverride') ?? undefined
    const brandUrlOverride = searchParams.get('brandUrlOverride') ?? undefined
    const slotStylesParam = searchParams.get('slotStyles') ?? undefined
    const sectionSpacingParam = searchParams.get('sectionSpacing') ?? undefined

    if (!brandId || !templateId) {
      return NextResponse.json(
        { error: 'brandId and templateId are required' },
        { status: 400 }
      )
    }

    const relativePath = templateFiles[templateId]
    if (!relativePath) {
      return NextResponse.json(
        { error: `Unknown template: ${templateId}` },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const [{ data: brand, error: brandError }, { data: product }] = await Promise.all([
      supabase.from('brands').select('*').eq('id', brandId).single(),
      productId
        ? supabase.from('products').select('*').eq('id', productId).single()
        : Promise.resolve({ data: null }),
    ])

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const templatePath = path.join(process.cwd(), 'Templates', relativePath)
    const html = await fs.promises.readFile(templatePath, 'utf-8')

    // Parse additional product images for feature slots
    const productImages: string[] = (() => {
      if (!product?.images) return []
      try {
        const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images
        return Array.isArray(imgs) ? imgs.filter((u: unknown) => typeof u === 'string') : []
      } catch { return [] }
    })()

    // Parse AI-generated slots if provided
    const generatedSlots: Record<string, string> | undefined = (() => {
      if (!slotsParam) return undefined
      try { return JSON.parse(slotsParam) } catch { return undefined }
    })()

    // Parse per-slot typography overrides if provided
    const slotStyles: Record<string, { fontFamily?: string; fontSize?: string }> | undefined = (() => {
      if (!slotStylesParam) return undefined
      try { return JSON.parse(slotStylesParam) } catch { return undefined }
    })()

    const customizations: BrandCustomizations = {
      brandName: brand.name,
      primaryColor: primaryColorOverride ?? brand.primary_color ?? '#000000',
      secondaryColor: secondaryColorOverride ?? brand.secondary_color ?? '#ffffff',
      accentColor: accentColorOverride ?? brand.accent_color ?? '#000000',
      fontPrimary: fontPrimaryOverride ?? brand.font_primary ?? 'Helvetica, Arial, sans-serif',
      fontSecondary: fontSecondaryOverride ?? brand.font_secondary ?? undefined,
      logoUrl: brand.logo_url ?? undefined,
      brandUrl: brandUrlOverride ?? brand.website_url ?? undefined,
      // Product-specific
      productName: product?.name ?? undefined,
      productUrl: productUrlOverride ?? product?.product_url ?? undefined,
      productImageUrl: product?.primary_image_url ?? undefined,
      productImages: productImages.length > 0 ? productImages : undefined,
      productPrice: product?.price ?? undefined,
      // AI-generated copy
      generatedSlots,
      // Per-slot typography overrides
      slotStyles,
      // Section spacing multiplier
      sectionSpacing: sectionSpacingParam ? parseFloat(sectionSpacingParam) : undefined,
    }

    const processed = processTemplate(html, customizations)

    return NextResponse.json({ html: processed.html })
  } catch (error) {
    console.error('Template preview error:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview', details: String(error) },
      { status: 500 }
    )
  }
}
