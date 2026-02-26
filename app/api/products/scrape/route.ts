import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ShopifyProduct {
  id: number
  title: string
  body_html: string
  handle: string
  images: { src: string; alt: string | null }[]
  variants: { price: string }[]
}

/**
 * POST /api/products/scrape
 * Scrapes a Shopify product page using the public .json endpoint.
 * No API key required — Shopify exposes this on all stores.
 */
export async function POST(request: NextRequest) {
  try {
    const { brandId, productUrl } = await request.json()

    if (!brandId || !productUrl) {
      return NextResponse.json(
        { error: 'brandId and productUrl are required' },
        { status: 400 }
      )
    }

    // Normalise URL and build the Shopify .json endpoint
    const url = productUrl.trim().replace(/\/$/, '')
    const jsonUrl = url.includes('.json') ? url : `${url}.json`

    let product: ShopifyProduct | null = null
    let fetchError: string | null = null

    try {
      const res = await fetch(jsonUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        // 10s timeout
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) {
        fetchError = `HTTP ${res.status} from ${jsonUrl}`
      } else {
        const data = await res.json()
        product = data.product ?? null
      }
    } catch (err) {
      fetchError = String(err)
    }

    // If Shopify .json failed, fall back to URL-parsing only
    const name = product?.title ?? urlToProductName(url)
    const primaryImage = product?.images?.[0]?.src ?? null
    const allImages = (product?.images ?? []).map((img) => img.src)
    const price = product?.variants?.[0]?.price
      ? `$${parseFloat(product.variants[0].price).toFixed(2)}`
      : null
    const description = product?.body_html
      ? stripHtml(product.body_html).slice(0, 500)
      : null
    const shopifyId = product?.id ? String(product.id) : null

    // Upsert into products table (match on brand_id + product_url)
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('brand_id', brandId)
      .eq('product_url', url)
      .single()

    let savedProduct
    if (existing) {
      const { data } = await supabase
        .from('products')
        .update({
          name,
          primary_image_url: primaryImage,
          images: allImages,
          price,
          description,
          shopify_product_id: shopifyId,
        })
        .eq('id', existing.id)
        .select()
        .single()
      savedProduct = data
    } else {
      const { data } = await supabase
        .from('products')
        .insert({
          brand_id: brandId,
          name,
          product_url: url,
          primary_image_url: primaryImage,
          images: allImages,
          price,
          description,
          shopify_product_id: shopifyId,
        })
        .select()
        .single()
      savedProduct = data
    }

    return NextResponse.json({
      success: true,
      product: savedProduct,
      scraped: !fetchError,
      warning: fetchError ?? undefined,
    })
  } catch (error) {
    console.error('Product scrape error:', error)
    return NextResponse.json(
      { error: 'Failed to scrape product', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/products/scrape?brandId=xxx
 * Returns all products for a brand.
 */
export async function GET(request: NextRequest) {
  const brandId = new URL(request.url).searchParams.get('brandId')
  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ products: data })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlToProductName(url: string): string {
  try {
    const path = new URL(url).pathname
    const slug = path.split('/products/')?.[1]?.split('/')?.[0] ?? path.split('/').pop() ?? ''
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  } catch {
    return 'Unknown Product'
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
