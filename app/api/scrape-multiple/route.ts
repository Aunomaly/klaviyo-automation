import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

interface ExtractedImage {
  url: string
  type: string
  width: number | null
  height: number | null
  alt: string | null
  context: string | null
  source_page?: string
  page_title?: string
  product_name?: string
  tags?: string[]
}

interface PageScrapeResult {
  url: string
  name: string
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  font_primary: string
  font_secondary: string
  logo_url: string | null
  images: ExtractedImage[]
}

interface CombinedResult {
  name: string
  website_url: string
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  font_primary: string
  font_secondary: string
  logo_url: string | null
  favicon_url: string | null
  images: ExtractedImage[]
  extraction_success: boolean
  extraction_errors: string[]
  pages_scraped: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { urls } = body

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'URLs array is required' }, { status: 400 })
    }

    // Limit to 10 pages max
    const urlsToScrape = urls.slice(0, 10)
    
    // Scrape all pages
    const results = await Promise.all(
      urlsToScrape.map(url => scrapeSinglePage(url))
    )

    // Combine results
    const combined = combineResults(results, urlsToScrape[0])

    return NextResponse.json(combined)
  } catch (error) {
    console.error('Multi-scrape error:', error)
    return NextResponse.json(
      { error: 'Failed to scrape pages', details: String(error) },
      { status: 500 }
    )
  }
}

async function scrapeSinglePage(url: string): Promise<PageScrapeResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'lib', 'scraper', 'scraper.py')
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python')
    const python = spawn(venvPython, [scriptPath, url])

    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    python.on('close', (code) => {
      if (code !== 0) {
        resolve({
          url,
          name: extractDomainName(url),
          primary_color: null,
          secondary_color: null,
          accent_color: null,
          font_primary: 'Helvetica, Arial, sans-serif',
          font_secondary: 'Georgia, serif',
          logo_url: null,
          images: [],
        })
        return
      }

      try {
        const jsonMatch = stdout.match(/--- Results ---\n([\s\S]*?)\n--- Summary ---/)
        const result = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(stdout)
        
        // Extract product name and page info from URL
        const pageTitle = result.name || extractPageTitle(url)
        const productName = extractProductName(url)
        const tags = generateTags(url, result.name, productName)
        
        // Add metadata to all images
        const enrichedImages = result.images.map((img: ExtractedImage) => ({
          ...img,
          source_page: url,
          page_title: pageTitle,
          product_name: productName,
          tags: tags,
        }))

        resolve({
          url,
          name: result.name,
          primary_color: result.primary_color,
          secondary_color: result.secondary_color,
          accent_color: result.accent_color,
          font_primary: result.font_primary,
          font_secondary: result.font_secondary,
          logo_url: result.logo_url,
          images: enrichedImages,
        })
      } catch (parseError) {
        resolve({
          url,
          name: extractDomainName(url),
          primary_color: null,
          secondary_color: null,
          accent_color: null,
          font_primary: 'Helvetica, Arial, sans-serif',
          font_secondary: 'Georgia, serif',
          logo_url: null,
          images: [],
        })
      }
    })

    // Timeout after 60 seconds
    setTimeout(() => {
      python.kill()
      resolve({
        url,
        name: extractDomainName(url),
        primary_color: null,
        secondary_color: null,
        accent_color: null,
        font_primary: 'Helvetica, Arial, sans-serif',
        font_secondary: 'Georgia, serif',
        logo_url: null,
        images: [],
      })
    }, 60000)
  })
}

function combineResults(results: PageScrapeResult[], baseUrl: string): CombinedResult {
  // Use first page for basic info
  const firstPage = results[0]

  // Combine all images, removing duplicates
  const allImages: ExtractedImage[] = []
  const seenUrls = new Set<string>()

  results.forEach((result) => {
    result.images.forEach((img) => {
      if (!seenUrls.has(img.url)) {
        seenUrls.add(img.url)
        allImages.push(img)
      }
    })
  })

  // Pick best logo (first non-null logo)
  const logo = results.find(r => r.logo_url)?.logo_url || null

  // Pick most common colors (simple: use first page)
  const primaryColor = firstPage.primary_color
  const secondaryColor = firstPage.secondary_color
  const accentColor = firstPage.accent_color

  return {
    name: firstPage.name,
    website_url: baseUrl,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    accent_color: accentColor,
    font_primary: firstPage.font_primary,
    font_secondary: firstPage.font_secondary,
    logo_url: logo,
    favicon_url: `${baseUrl}/favicon.ico`,
    images: allImages,
    extraction_success: true,
    extraction_errors: [],
    pages_scraped: results.length,
  }
}

function extractDomainName(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const hostname = parsed.hostname.replace('www.', '')
    const name = hostname.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return 'Unknown Brand'
  }
}

function extractPageTitle(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const path = parsed.pathname.split('/').filter(p => p)
    if (path.length === 0) return 'Home'
    
    // Get the last segment and convert slug to title
    const lastSegment = path[path.length - 1]
    return slugToTitle(lastSegment)
  } catch {
    return 'Unknown'
  }
}

function extractProductName(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const path = parsed.pathname
    
    // Check if it's a product page
    if (path.includes('/products/')) {
      const productSlug = path.split('/products/')[1]?.split('/')[0]?.split('?')[0]
      if (productSlug) {
        return slugToTitle(productSlug)
      }
    }
    
    return null
  } catch {
    return null
  }
}

function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function generateTags(url: string, pageName: string | null, productName: string | null): string[] {
  const tags: string[] = []
  
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const path = parsed.pathname
    
    // Add category tags based on URL structure
    if (path.includes('/products/')) {
      tags.push('product')
      if (productName) tags.push(productName)
    } else if (path.includes('/collections/')) {
      tags.push('collection')
      const collectionName = path.split('/collections/')[1]?.split('/')[0]
      if (collectionName) tags.push(slugToTitle(collectionName))
    } else if (path.includes('/pages/')) {
      tags.push('page')
    } else if (path === '/' || path === '') {
      tags.push('homepage')
    }
    
    // Add page name as tag if available
    if (pageName && !tags.includes(pageName)) {
      tags.push(pageName)
    }
  } catch {
    // Ignore errors
  }
  
  return tags
}
