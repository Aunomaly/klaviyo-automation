import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ShopifyProduct {
  id: number
  title: string
  handle: string
  body_html: string
  images: { src: string; alt: string | null }[]
  variants: { price: string }[]
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[]
}

/**
 * POST /api/brands/[id]/scan-products
 * Scans a Shopify store's full product catalog using the public /products.json endpoint.
 * No Shopify API key required — this endpoint is publicly accessible on all Shopify stores.
 * Paginates up to 500 products. Upserts all discovered products into the products table.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const brandId = params.id

  try {
    const supabase = await createClient()

    // Load brand to get website_url
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, website_url')
      .eq('id', brandId)
      .single()

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    if (!brand.website_url) {
      return NextResponse.json(
        { error: 'Brand has no website URL. Add one before scanning.' },
        { status: 400 }
      )
    }

    // Always use just the origin (scheme + hostname) — strip any path the user may have pasted
    const baseUrl = (() => {
      try {
        const parsed = new URL(brand.website_url.startsWith('http') ? brand.website_url : `https://${brand.website_url}`)
        return parsed.origin
      } catch {
        return brand.website_url.replace(/\/$/, '')
      }
    })()
    const allProducts = await fetchAllShopifyProducts(baseUrl)

    if (allProducts === null) {
      return NextResponse.json(
        {
          error: 'Could not reach the Shopify products endpoint. Make sure the website URL is a Shopify store.',
          products: [],
          count: 0,
        },
        { status: 422 }
      )
    }

    // Upsert all products — match on brand_id + shopify_product_id
    const upserted: string[] = []

    for (const p of allProducts) {
      const productUrl = `${baseUrl}/products/${p.handle}`
      const primaryImage = p.images?.[0]?.src ?? null
      const allImages = (p.images ?? []).map((img) => img.src)
      const price = p.variants?.[0]?.price
        ? `$${parseFloat(p.variants[0].price).toFixed(2)}`
        : null
      const description = p.body_html
        ? stripHtml(p.body_html).slice(0, 500)
        : null
      const shopifyId = String(p.id)

      // Check for existing record by shopify_product_id
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('brand_id', brandId)
        .eq('shopify_product_id', shopifyId)
        .single()

      if (existing) {
        await supabase
          .from('products')
          .update({
            name: p.title,
            product_url: productUrl,
            primary_image_url: primaryImage,
            images: allImages,
            price,
            description,
          })
          .eq('id', existing.id)
        upserted.push(existing.id)
      } else {
        const { data: inserted } = await supabase
          .from('products')
          .insert({
            brand_id: brandId,
            name: p.title,
            product_url: productUrl,
            shopify_product_id: shopifyId,
            primary_image_url: primaryImage,
            images: allImages,
            price,
            description,
          })
          .select('id')
          .single()
        if (inserted) upserted.push(inserted.id)
      }
    }

    // Return all active products for this brand after upsert
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    return NextResponse.json({
      success: true,
      count: allProducts.length,
      products: products ?? [],
    })
  } catch (error) {
    console.error('Scan products error:', error)
    return NextResponse.json(
      { error: 'Scan failed', details: String(error) },
      { status: 500 }
    )
  }
}

// ─── Shopify fetcher ──────────────────────────────────────────────────────────

async function fetchAllShopifyProducts(baseUrl: string): Promise<ShopifyProduct[] | null> {
  const all: ShopifyProduct[] = []

  // Fetch up to 2 pages (500 products) — enough for any dropshipper store
  for (let page = 1; page <= 2; page++) {
    const url = `${baseUrl}/products.json?limit=250&page=${page}`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      })

      if (!res.ok) {
        // Non-Shopify store or private store
        if (page === 1) return null
        break
      }

      const data: ShopifyProductsResponse = await res.json()
      const products = data.products ?? []
      all.push(...products)

      // Stop paginating if we got fewer than 250 (last page)
      if (products.length < 250) break
    } catch {
      if (page === 1) return null
      break
    }
  }

  return all
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
