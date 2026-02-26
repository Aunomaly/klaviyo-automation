import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { KlaviyoClient, createTemplate, prepareTemplateHtml } from '@/lib/klaviyo'
import { processTemplate, BrandCustomizations } from '@/lib/templates'

interface TemplateOverride {
  subjectLine?: string
  preheaderText?: string
}

interface DeployRequest {
  brandId: string
  apiKey: string
  templates: string[]
  templateOverrides?: Record<string, TemplateOverride>
  // Per-template product mapping: templateId → productId
  templateProductMap?: Record<string, string>
  // AI-generated slots: `templateId::productId` → slot map
  generatedSlotsMap?: Record<string, Record<string, string>>
  // Legacy single-product field (kept for backwards compat)
  productId?: string
  brand: {
    name: string
    primaryColor: string
    secondaryColor: string
    accentColor: string
    fontPrimary: string
    logoUrl?: string
  }
  // Per-template section spacing multiplier
  sectionSpacingMap?: Record<string, number>
}

interface DeployResult {
  templateId: string
  success: boolean
  klaviyoId?: string
  error?: string
}

type ProductRow = {
  name: string
  product_url: string
  primary_image_url: string | null
  price: string | null
}

// Template file mapping
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

export async function POST(request: NextRequest) {
  try {
    const body: DeployRequest = await request.json()
    const {
      apiKey,
      templates,
      templateOverrides = {},
      templateProductMap = {},
      generatedSlotsMap = {},
      sectionSpacingMap = {},
      productId,
      brand,
    } = body

    if (!apiKey) {
      return NextResponse.json({ error: 'Klaviyo API key is required' }, { status: 400 })
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json({ error: 'At least one template must be selected' }, { status: 400 })
    }

    // Build a product cache: productId → ProductRow
    const productIdSet = new Set<string>()
    for (const tId of templates) {
      const pid = templateProductMap[tId] ?? productId
      if (pid) productIdSet.add(pid)
    }

    const productCache: Record<string, ProductRow & { images?: unknown }> = {}
    if (productIdSet.size > 0) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: rows } = await supabase
        .from('products')
        .select('id, name, product_url, primary_image_url, images, price')
        .in('id', Array.from(productIdSet))
      for (const row of rows ?? []) {
        productCache[row.id] = row
      }
    }

    const client = new KlaviyoClient(apiKey)
    const results: DeployResult[] = []

    // Base brand customizations (no product — applied per-template below)
    const baseBrandCustomizations: BrandCustomizations = {
      brandName: brand.name,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      accentColor: brand.accentColor,
      fontPrimary: brand.fontPrimary,
      logoUrl: brand.logoUrl,
    }

    for (const templateId of templates) {
      try {
        const relativePath = templateFiles[templateId]
        if (!relativePath) {
          results.push({ templateId, success: false, error: `Unknown template: ${templateId}` })
          continue
        }

        const templatePath = path.join(process.cwd(), 'Templates', relativePath)
        const html = await fs.promises.readFile(templatePath, 'utf-8')

        // Resolve product for this specific template
        const resolvedProductId = templateProductMap[templateId] ?? productId
        const product = resolvedProductId ? productCache[resolvedProductId] ?? null : null

        // Parse additional product images for feature slots
        const productImages: string[] = (() => {
          if (!product?.images) return []
          try {
            const imgs = typeof product.images === 'string' ? JSON.parse(product.images as string) : product.images
            return Array.isArray(imgs) ? (imgs as unknown[]).filter((u): u is string => typeof u === 'string') : []
          } catch { return [] }
        })()

        // Resolve AI-generated slots for this template+product combo
        const slotsKey = `${templateId}::${resolvedProductId ?? ''}`
        const generatedSlots = generatedSlotsMap[slotsKey] ?? undefined

        // Merge: brand + product + per-template overrides + generated slots
        const override = templateOverrides[templateId]
        const customizations: BrandCustomizations = {
          ...baseBrandCustomizations,
          // Product-specific
          productName: product?.name ?? undefined,
          productUrl: product?.product_url ?? undefined,
          productImageUrl: product?.primary_image_url ?? undefined,
          productImages: productImages.length > 0 ? productImages : undefined,
          productPrice: product?.price ?? undefined,
          // Per-template text overrides
          ...(override?.subjectLine && { subjectLine: override.subjectLine }),
          ...(override?.preheaderText && { preheaderText: override.preheaderText }),
          // AI-generated copy
          generatedSlots,
          // Section spacing
          sectionSpacing: sectionSpacingMap[templateId] ?? undefined,
        }

        const processed = processTemplate(html, customizations)

        const preparedHtml = prepareTemplateHtml(processed.html, {
          addEditableRegions: true,
          stripKlaviyoBranding: true,
        })

        // Name includes product if available
        const productLabel = product ? ` (${product.name})` : ''
        const templateLabel = templateId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

        const klaviyoTemplate = await createTemplate(client, {
          name: `${brand.name} - ${templateLabel}${productLabel}`,
          html: preparedHtml,
          editorType: 'HYBRID',
        })

        results.push({ templateId, success: true, klaviyoId: klaviyoTemplate.id })
      } catch (error) {
        console.error(`Error deploying template ${templateId}:`, error)
        results.push({
          templateId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: results.every((r) => r.success),
      results,
    })
  } catch (error) {
    console.error('Deploy error:', error)
    return NextResponse.json(
      { error: 'Deployment failed', details: String(error) },
      { status: 500 }
    )
  }
}
