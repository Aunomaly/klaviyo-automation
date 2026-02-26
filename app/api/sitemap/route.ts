import { NextRequest, NextResponse } from 'next/server'

interface SitemapURL {
  url: string
  category: 'product' | 'collection' | 'page' | 'other'
  title?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
    const baseUrl = new URL(normalizedUrl)
    
    // Check if Shopify
    const isShopify = await detectShopify(normalizedUrl)
    
    if (!isShopify) {
      return NextResponse.json({
        isShopify: false,
        urls: [],
        message: 'Not a Shopify site - will scrape homepage only'
      })
    }

    // Fetch sitemap
    const sitemapUrl = `${baseUrl.origin}/sitemap.xml`
    const urls = await parseSitemap(sitemapUrl, baseUrl.origin)

    return NextResponse.json({
      isShopify: true,
      urls,
    })
  } catch (error) {
    console.error('Sitemap error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sitemap', details: String(error) },
      { status: 500 }
    )
  }
}

async function detectShopify(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'follow',
    })
    
    const html = await response.text()
    
    // Check for Shopify indicators
    return html.includes('Shopify.') || 
           html.includes('cdn.shopify.com') ||
           html.includes('shopify-features') ||
           response.headers.get('x-shopify-stage') !== null
  } catch {
    return false
  }
}

async function parseSitemap(sitemapUrl: string, baseUrl: string): Promise<SitemapURL[]> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error('Sitemap not found')
    }

    const xml = await response.text()
    
    // Check if this is a sitemap index (Shopify uses this)
    const isSitemapIndex = xml.includes('<sitemapindex') || xml.includes('<sitemap>')
    
    let allUrls: SitemapURL[] = []
    
    if (isSitemapIndex) {
      // This is a sitemap index - fetch all child sitemaps
      const sitemapMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g)
      const childSitemaps: string[] = []
      
      for (const match of sitemapMatches) {
        const childUrl = match[1].trim()
        // Only include product and collection sitemaps
        if (childUrl.includes('sitemap_products') || 
            childUrl.includes('sitemap_collections') || 
            childUrl.includes('sitemap_pages')) {
          childSitemaps.push(childUrl)
        }
      }
      
      // Fetch all child sitemaps in parallel
      const childResults = await Promise.all(
        childSitemaps.map(childUrl => parseUrlsFromSitemap(childUrl, baseUrl))
      )
      
      // Combine all results
      allUrls = childResults.flat()
    } else {
      // Single sitemap - parse directly
      allUrls = await parseUrlsFromSitemap(sitemapUrl, baseUrl)
    }

    // Remove duplicates
    const uniqueUrls = Array.from(
      new Map(allUrls.map(item => [item.url, item])).values()
    )

    // Sort by category priority, then alphabetically
    return uniqueUrls.sort((a, b) => {
      const order = { collection: 1, product: 2, page: 3, other: 4 }
      if (order[a.category] !== order[b.category]) {
        return order[a.category] - order[b.category]
      }
      return a.title.localeCompare(b.title)
    })
  } catch (error) {
    console.error('Sitemap parse error:', error)
    return []
  }
}

async function parseUrlsFromSitemap(sitemapUrl: string, baseUrl: string): Promise<SitemapURL[]> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return []
    }

    const xml = await response.text()
    const urls: SitemapURL[] = []

    // Parse XML - look for <loc> tags
    const locMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g)
    
    for (const match of locMatches) {
      let url = match[1].trim()
      
      // Skip if not from same domain
      if (!url.startsWith(baseUrl)) continue
      
      // Remove query parameters and anchors
      const cleanUrl = url.split('?')[0].split('#')[0]
      
      // Skip system/account pages
      if (
        cleanUrl.includes('/account') ||
        cleanUrl.includes('/cart') ||
        cleanUrl.includes('/checkout') ||
        cleanUrl.includes('/search') ||
        cleanUrl.includes('/password') ||
        cleanUrl.includes('/challenge') ||
        cleanUrl.includes('/apps/') ||
        cleanUrl.includes('/tools/')
      ) {
        continue
      }
      
      // Skip localized versions
      const localizedPrefixes = ['/es/', '/es-', '/fr/', '/fr-', '/de/', '/de-', '/it/', '/it-', '/pt/', '/pt-', '/ja/', '/ja-', '/zh/', '/zh-', '/ko/', '/ko-', '/ar/', '/ar-']
      if (localizedPrefixes.some(prefix => cleanUrl.includes(prefix))) {
        continue
      }
      
      // Categorize URL
      let category: SitemapURL['category'] = 'other'
      
      // Product pages: /products/
      if (cleanUrl.includes('/products/')) {
        category = 'product'
      } 
      // Collection pages: /collections/
      else if (cleanUrl.includes('/collections/')) {
        category = 'collection'
      } 
      // Regular pages: /pages/
      else if (cleanUrl.includes('/pages/')) {
        category = 'page'
      }
      // Homepage
      else if (cleanUrl === baseUrl || cleanUrl === baseUrl + '/') {
        category = 'page'
      }
      // Skip other URLs
      else {
        continue
      }
      
      // Extract title from URL path
      const pathParts = cleanUrl.split('/').filter(Boolean)
      const lastPart = pathParts[pathParts.length - 1] || 'Home'
      const title = lastPart
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/\.[^/.]+$/, '')

      urls.push({
        url: cleanUrl,
        category,
        title: title || 'Homepage',
      })
    }

    return urls
  } catch (error) {
    console.error('Error parsing sitemap:', error)
    return []
  }
}
