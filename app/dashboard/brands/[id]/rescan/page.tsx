'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Globe, Loader2, Check, RefreshCw } from 'lucide-react'
import { Brand } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

type SitemapPage = {
  url: string
  category: 'product' | 'collection' | 'page' | 'other'
  selected: boolean
}

type ExtractedImage = {
  url: string
  type: 'hero' | 'product' | 'logo' | 'other'
  alt: string
  width?: number
  height?: number
  source_page?: string
}

type ScrapeResult = {
  primary_color: string
  secondary_color: string
  accent_color: string
  font_primary: string
  font_secondary: string
  logo_url: string
  images: ExtractedImage[]
}

type Step = 'select-pages' | 'reviewing' | 'review' | 'saving'

export default function RescanBrandPage() {
  const params = useParams()
  const router = useRouter()
  const brandId = params.id as string

  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('select-pages')
  const [error, setError] = useState<string | null>(null)

  // Sitemap detection
  const [baseUrl, setBaseUrl] = useState<string>('')
  const [isShopify, setIsShopify] = useState(false)
  const [pages, setPages] = useState<SitemapPage[]>([])
  const [loadingSitemap, setLoadingSitemap] = useState(false)

  // Scrape results
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadBrand()
  }, [brandId])

  async function loadBrand() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('brands').select('*').eq('id', brandId).single()

      if (error) throw error
      setBrand(data)
      
      // Automatically check sitemap when page loads
      if (data.website_url) {
        // Extract base domain from the stored URL
        const extractedBaseUrl = extractBaseDomain(data.website_url)
        setBaseUrl(extractedBaseUrl)
        handleCheckSitemap(extractedBaseUrl)
      }
    } catch (error) {
      console.error('Error loading brand:', error)
      setError('Failed to load brand')
    } finally {
      setLoading(false)
    }
  }

  function extractBaseDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      return `${urlObj.protocol}//${urlObj.hostname}`
    } catch {
      // If URL parsing fails, return as-is
      return url
    }
  }

  async function handleCheckSitemap(url: string) {
    setLoadingSitemap(true)
    setError(null)

    console.log('Checking sitemap for:', url)

    try {
      const response = await fetch('/api/sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      const data = await response.json()
      console.log('Sitemap response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check sitemap')
      }

      setIsShopify(data.isShopify)
      
      // The API returns 'urls' not 'pages'
      if (data.urls && data.urls.length > 0) {
        console.log(`Found ${data.urls.length} pages from sitemap`)
        setPages(data.urls.map((p: any) => ({ ...p, selected: true })))
      } else {
        console.warn('No pages found in sitemap, using homepage only')
        // No sitemap found, just add homepage
        setPages([{ url, category: 'other' as const, selected: true }])
      }
    } catch (err) {
      console.error('Sitemap check error:', err)
      setError(`Failed to fetch sitemap: ${err instanceof Error ? err.message : 'Unknown error'}. Using homepage only.`)
      // On error, still add homepage as option
      setPages([{ url, category: 'other' as const, selected: true }])
    } finally {
      setLoadingSitemap(false)
    }
  }

  async function handleScrapePages() {
    const selectedUrls = pages.filter(p => p.selected).map(p => p.url)
    
    if (selectedUrls.length === 0) {
      setError('Please select at least one page to scrape')
      return
    }

    setStep('reviewing')
    setError(null)

    try {
      const response = await fetch('/api/scrape-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: selectedUrls })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Scraping failed')
      }

      setScrapeResult(data)
      
      // Pre-select all images
      const allImageUrls = data.images.map((img: ExtractedImage) => img.url)
      setSelectedImages(new Set(allImageUrls))
      
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape pages')
      setStep('select-pages')
    }
  }

  async function handleUpdate() {
    if (!scrapeResult || !brand) return

    setStep('saving')
    setError(null)

    try {
      const supabase = createClient()

      // Update brand with new scraped data
      const { error: brandError } = await supabase
        .from('brands')
        .update({
          primary_color: scrapeResult.primary_color,
          secondary_color: scrapeResult.secondary_color,
          accent_color: scrapeResult.accent_color,
          font_primary: scrapeResult.font_primary,
          font_secondary: scrapeResult.font_secondary,
          logo_url: scrapeResult.logo_url || brand.logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', brandId)

      if (brandError) {
        console.error('Brand update error:', brandError)
        throw new Error(brandError.message || 'Failed to update brand')
      }

      // Delete old images and add new ones
      await supabase.from('brand_images').delete().eq('brand_id', brandId)

      const selectedImagesList = scrapeResult.images.filter(img => selectedImages.has(img.url))

      if (selectedImagesList.length > 0) {
        const { error: imagesError } = await supabase.from('brand_images').insert(
          selectedImagesList.map((img, i) => ({
            brand_id: brandId,
            original_url: img.url,
            image_type: img.type,
            alt_text: img.alt,
            width: img.width,
            height: img.height,
            source_page: img.source_page,
            page_title: img.page_title,
            product_name: img.product_name,
            tags: img.tags || [],
            uploaded_to_klaviyo: false,
            is_primary: i === 0 && img.type === 'logo',
            display_order: i,
          }))
        )

        if (imagesError) throw imagesError
      }

      router.push(`/dashboard/brands/${brandId}`)
    } catch (err) {
      console.error('Error updating brand:', err)
      const errorMessage = err instanceof Error 
        ? `Failed to update brand: ${err.message}` 
        : 'Failed to update brand. Please check your Supabase connection.'
      setError(errorMessage)
      setStep('review')
    }
  }

  const togglePage = (url: string) => {
    setPages(pages.map(p => p.url === url ? { ...p, selected: !p.selected } : p))
  }

  const toggleAllInCategory = (category: string) => {
    const categoryPages = pages.filter(p => p.category === category)
    const allSelected = categoryPages.every(p => p.selected)
    setPages(pages.map(p => 
      p.category === category ? { ...p, selected: !allSelected } : p
    ))
  }

  const toggleImage = (url: string) => {
    const newSelected = new Set(selectedImages)
    if (newSelected.has(url)) {
      newSelected.delete(url)
    } else {
      newSelected.add(url)
    }
    setSelectedImages(newSelected)
  }

  const imagesByType = scrapeResult?.images.reduce((acc, img) => {
    if (!acc[img.type]) acc[img.type] = []
    acc[img.type].push(img)
    return acc
  }, {} as Record<string, ExtractedImage[]>) || {}

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-muted-foreground">Brand not found</p>
      </div>
    )
  }

  const totalSelected = pages.filter(p => p.selected).length

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 24 }}>
        <Link href={`/dashboard/brands/${brandId}`} style={{ color: '#9C9B99', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft style={{ width: 14, height: 14 }} />
          {brand.name}
        </Link>
        <span style={{ color: '#9C9B99' }}>/</span>
        <span style={{ color: '#1A1918', fontWeight: 600 }}>Rescan</span>
      </div>

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1918', margin: '0 0 4px' }}>Re-scan brand website</p>
        <p style={{ fontSize: 13, color: '#9C9B99', margin: 0 }}>
          {step === 'select-pages' && `Select pages to scrape from ${baseUrl || brand.website_url || ''}`}
          {step === 'reviewing' && 'Scanning selected pages…'}
          {step === 'review' && 'Review scraped images and select which to keep'}
          {step === 'saving' && 'Saving updated brand data…'}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ fontSize: 13, color: '#991b1b', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── Step 1: Select Pages ── */}
      {step === 'select-pages' && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 12, padding: 20 }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe style={{ width: 14, height: 14, color: '#9C9B99' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1918' }}>
                {loadingSitemap ? 'Checking sitemap…' : `${pages.length} page${pages.length !== 1 ? 's' : ''} found`}
              </span>
              {isShopify && !loadingSitemap && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', backgroundColor: '#f0fff0', borderRadius: 20, padding: '2px 8px' }}>Shopify</span>
              )}
            </div>
            {!loadingSitemap && pages.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9C9B99' }}>{totalSelected} selected</span>
                <button
                  onClick={() => setPages(pages.map(p => ({ ...p, selected: true })))}
                  style={{ fontSize: 12, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 6, padding: '3px 10px', background: '#fff', cursor: 'pointer' }}
                >
                  Select all
                </button>
                <button
                  onClick={() => setPages(pages.map(p => ({ ...p, selected: false })))}
                  style={{ fontSize: 12, color: '#9C9B99', border: '1px solid #E2E4E9', borderRadius: 6, padding: '3px 10px', background: '#fff', cursor: 'pointer' }}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {loadingSitemap ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <Loader2 style={{ width: 24, height: 24, color: '#9C9B99' }} className="animate-spin" />
            </div>
          ) : (
            <>
              {/* All categories rendered together — freely check across any */}
              {(['collection', 'product', 'page', 'other'] as const).map((category) => {
                const categoryPages = pages.filter(p => p.category === category)
                if (categoryPages.length === 0) return null
                const selCount = categoryPages.filter(p => p.selected).length
                const label = category === 'other' ? 'Other' : category.charAt(0).toUpperCase() + category.slice(1)

                return (
                  <div key={category} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1918' }}>{label} pages</span>
                        <span style={{ fontSize: 11, color: '#9C9B99', backgroundColor: '#ECEEF2', borderRadius: 20, padding: '1px 7px' }}>{selCount}/{categoryPages.length}</span>
                      </div>
                      <button
                        onClick={() => toggleAllInCategory(category)}
                        style={{ fontSize: 12, color: '#9C9B99', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {selCount === categoryPages.length ? 'Clear' : 'Select all'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid #E2E4E9', borderRadius: 8, padding: '8px 10px' }}>
                      {categoryPages.slice(0, 50).map((page) => (
                        <label key={page.url} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 0' }}>
                          <input
                            type="checkbox"
                            checked={page.selected}
                            onChange={() => togglePage(page.url)}
                            style={{ width: 14, height: 14, accentColor: '#43ff47', cursor: 'pointer', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 12, color: '#1A1918', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.url}</span>
                        </label>
                      ))}
                      {categoryPages.length > 50 && (
                        <span style={{ fontSize: 11, color: '#9C9B99', padding: '2px 0' }}>…and {categoryPages.length - 50} more</span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 16, borderTop: '1px solid #E2E4E9' }}>
                <button
                  onClick={() => router.push(`/dashboard/brands/${brandId}`)}
                  style={{ fontSize: 13, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 8, padding: '8px 16px', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleScrapePages}
                  disabled={totalSelected === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1A1918', backgroundColor: '#43ff47', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: totalSelected === 0 ? 'not-allowed' : 'pointer', opacity: totalSelected === 0 ? 0.4 : 1 }}
                >
                  <RefreshCw style={{ width: 13, height: 13 }} />
                  Scrape {totalSelected} page{totalSelected !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Scanning ── */}
      {step === 'reviewing' && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 12, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 style={{ width: 28, height: 28, color: '#9C9B99' }} className="animate-spin" />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1918', margin: 0 }}>Scanning pages…</p>
          <p style={{ fontSize: 13, color: '#9C9B99', margin: 0 }}>This may take a minute</p>
        </div>
      )}

      {/* ── Step 3: Review images ── */}
      {step === 'review' && scrapeResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Brand guidelines summary */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 12, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1918', margin: '0 0 14px' }}>Updated brand guidelines</p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Primary', value: scrapeResult.primary_color },
                { label: 'Secondary', value: scrapeResult.secondary_color },
                { label: 'Accent', value: scrapeResult.accent_color },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: value, border: '1px solid #E2E4E9', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#9C9B99' }}>{label}</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#1A1918' }}>{value}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9C9B99' }}>Font</div>
                  <div style={{ fontSize: 12, color: '#1A1918' }}>{scrapeResult.font_primary}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Image selection */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1918', margin: 0 }}>Select images to keep</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9C9B99' }}>{selectedImages.size} selected</span>
                <button
                  onClick={() => setSelectedImages(new Set(scrapeResult.images.map(i => i.url)))}
                  style={{ fontSize: 12, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 6, padding: '3px 10px', background: '#fff', cursor: 'pointer' }}
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedImages(new Set())}
                  style={{ fontSize: 12, color: '#9C9B99', border: '1px solid #E2E4E9', borderRadius: 6, padding: '3px 10px', background: '#fff', cursor: 'pointer' }}
                >
                  Clear all
                </button>
              </div>
            </div>
            {Object.entries(imagesByType).map(([type, images]) => (
              <div key={type} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1918', textTransform: 'capitalize' }}>{type}</span>
                  <span style={{ fontSize: 11, color: '#9C9B99', backgroundColor: '#ECEEF2', borderRadius: 20, padding: '1px 7px' }}>
                    {images.filter(img => selectedImages.has(img.url)).length}/{images.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {images.map((image) => {
                    const selected = selectedImages.has(image.url)
                    return (
                      <div
                        key={image.url}
                        onClick={() => toggleImage(image.url)}
                        style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${selected ? '#43ff47' : '#E2E4E9'}`, opacity: selected ? 1 : 0.55, transition: 'opacity 0.15s, border-color 0.15s' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt={image.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {selected && (
                          <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#43ff47', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check style={{ width: 10, height: 10, color: '#1A1918' }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setStep('select-pages')}
              style={{ fontSize: 13, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 8, padding: '8px 16px', background: '#fff', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={handleUpdate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1A1918', backgroundColor: '#43ff47', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
            >
              <Check style={{ width: 13, height: 13 }} />
              Update brand
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Saving ── */}
      {step === 'saving' && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 12, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 style={{ width: 28, height: 28, color: '#9C9B99' }} className="animate-spin" />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1918', margin: 0 }}>Updating brand…</p>
        </div>
      )}
    </div>
  )
}
