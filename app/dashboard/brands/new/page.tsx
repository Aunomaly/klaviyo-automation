'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Globe,
  Loader2,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Layers,
  ChevronRight,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface SitemapURL {
  url: string
  category: 'product' | 'collection' | 'page' | 'other'
  title?: string
}

interface ExtractedImage {
  url: string
  type: string
  width: number | null
  height: number | null
  alt: string | null
  context: string | null
  source_page?: string
}

interface ScrapeResult {
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
  pages_scraped?: number
}

export default function NewBrandPage() {
  const router = useRouter()
  const [step, setStep] = useState<'url' | 'select-pages' | 'review' | 'saving'>('url')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sitemap detection
  const [isShopify, setIsShopify] = useState(false)
  const [sitemapUrls, setSitemapUrls] = useState<SitemapURL[]>([])
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())

  // Scrape results
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [brandName, setBrandName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#000000')
  const [secondaryColor, setSecondaryColor] = useState('#FFFFFF')
  const [accentColor, setAccentColor] = useState('#666666')
  const [fontPrimary, setFontPrimary] = useState('Helvetica, Arial, sans-serif')
  const [logoUrl, setLogoUrl] = useState('')
  const [klaviyoApiKey, setKlaviyoApiKey] = useState('')

  // Image selection
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())

  async function handleCheckSitemap(e: React.FormEvent) {
    e.preventDefault()
    if (!url) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check sitemap')
      }

      setIsShopify(data.isShopify)
      
      if (data.isShopify && data.urls.length > 0) {
        // Shopify detected with sitemap
        setSitemapUrls(data.urls)
        // Pre-select homepage and first few pages of each category
        const homepage = url.startsWith('http') ? url : `https://${url}`
        const preSelected = new Set([
          homepage,
          ...data.urls.filter((u: SitemapURL) => u.category === 'collection').slice(0, 2).map((u: SitemapURL) => u.url),
          ...data.urls.filter((u: SitemapURL) => u.category === 'product').slice(0, 3).map((u: SitemapURL) => u.url),
        ])
        setSelectedUrls(preSelected)
        setStep('select-pages')
      } else {
        // Not Shopify or no sitemap - show homepage as only option
        const homepage = url.startsWith('http') ? url : `https://${url}`
        setSitemapUrls([{
          url: homepage,
          category: 'page',
          title: 'Homepage'
        }])
        setSelectedUrls(new Set([homepage]))
        setIsShopify(false)
        setStep('select-pages')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process URL')
    } finally {
      setLoading(false)
    }
  }

  async function handleScrapePages(urls?: string[]) {
    const urlsToScrape = urls || Array.from(selectedUrls)
    
    if (urlsToScrape.length === 0) {
      setError('Please select at least one page to scrape')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/scrape-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlsToScrape }),
      })

      const result: ScrapeResult = await response.json()

      if (!response.ok) {
        throw new Error(result.extraction_errors?.[0] || 'Failed to scrape pages')
      }

      setScrapeResult(result)
      setBrandName(result.name)
      setPrimaryColor(result.primary_color || '#000000')
      setSecondaryColor(result.secondary_color || '#FFFFFF')
      setAccentColor(result.accent_color || '#666666')
      setFontPrimary(result.font_primary || 'Helvetica, Arial, sans-serif')
      setLogoUrl(result.logo_url || '')

      // Pre-select logo images
      const logoImages = result.images.filter(img => img.type === 'logo')
      if (logoImages.length > 0) {
        setSelectedImages(new Set(logoImages.map(img => img.url)))
      }

      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape pages')
    } finally {
      setLoading(false)
    }
  }

  function toggleUrl(url: string) {
    const newSet = new Set(selectedUrls)
    if (newSet.has(url)) {
      newSet.delete(url)
    } else {
      newSet.add(url)
    }
    setSelectedUrls(newSet)
  }

  function toggleImage(imageUrl: string) {
    const newSet = new Set(selectedImages)
    if (newSet.has(imageUrl)) {
      newSet.delete(imageUrl)
    } else {
      newSet.add(imageUrl)
    }
    setSelectedImages(newSet)
  }

  function selectAllImages(type?: string) {
    if (!scrapeResult) return
    const images = type
      ? scrapeResult.images.filter(img => img.type === type)
      : scrapeResult.images
    setSelectedImages(new Set(images.map(img => img.url)))
  }

  async function handleSave() {
    setStep('saving')
    setError(null)

    try {
      // Diagnostic check
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('Supabase URL configured:', !!supabaseUrl, supabaseUrl?.substring(0, 20) + '...')
      console.log('Supabase Key configured:', !!supabaseKey, supabaseKey?.substring(0, 20) + '...')
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing. Please check your .env.local file and restart the dev server.')
      }

      const supabase = createClient()

      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .insert({
          name: brandName,
          website_url: url.startsWith('http') ? url : `https://${url}`,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          font_primary: fontPrimary,
          font_secondary: scrapeResult?.font_secondary || 'Georgia, serif',
          logo_url: logoUrl || null,
          klaviyo_api_key: klaviyoApiKey || null,
        })
        .select()
        .single()

      if (brandError) {
        console.error('Brand save error:', brandError)
        throw new Error(brandError.message || 'Failed to save brand')
      }

      // Save selected images
      if (selectedImages.size > 0 && scrapeResult) {
        const imagesToSave = scrapeResult.images.filter(img => selectedImages.has(img.url))

        for (let i = 0; i < imagesToSave.length; i++) {
          const img = imagesToSave[i]
          await supabase.from('brand_images').insert({
            brand_id: brand.id,
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
          })
        }
      }

      // Auto-scan products immediately after brand creation (fire and forget — don't block redirect)
      fetch(`/api/brands/${brand.id}/scan-products`, { method: 'POST' }).catch(() => {})

      router.push(`/dashboard/brands/${brand.id}`)
    } catch (err) {
      console.error('Error saving brand:', err)
      const errorMessage = err instanceof Error 
        ? `Failed to save brand: ${err.message}` 
        : 'Failed to save brand. Please check your Supabase connection.'
      setError(errorMessage)
      setStep('review')
    }
  }

  const imagesByType = scrapeResult?.images.reduce((acc, img) => {
    if (!acc[img.type]) acc[img.type] = []
    acc[img.type].push(img)
    return acc
  }, {} as Record<string, ExtractedImage[]>) || {}

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/dashboard/brands"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Brands
      </Link>

      <h1 className="text-3xl font-bold mb-2">Add New Brand</h1>
      <p className="text-muted-foreground mb-8">
        {step === 'url' && 'Enter a website URL to detect Shopify and scrape multiple pages'}
        {step === 'select-pages' && 'Select which pages to scrape for brand guidelines and images'}
        {step === 'review' && 'Review extracted brand guidelines and select images to keep'}
      </p>

      {/* Step 1: URL */}
      {step === 'url' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Website URL
            </CardTitle>
            <CardDescription>
              We'll detect if it's Shopify and let you select multiple pages to scrape
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCheckSitemap} className="space-y-4">
              <div>
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  type="text"
                  placeholder="example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mt-1"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button type="submit" disabled={!url || loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking sitemap...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Continue
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Pages (Shopify only) */}
      {step === 'select-pages' && (
        <div className="space-y-6">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-green-800 font-medium">Shopify detected</span>
              </div>
              <p className="text-sm mt-2 text-muted-foreground">
                Found {sitemapUrls.length} pages in sitemap. Select pages to scrape for images and brand guidelines.
              </p>
            </CardContent>
          </Card>

          {/* Select All Button */}
          {sitemapUrls.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedUrls.size} of {sitemapUrls.length} pages selected
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUrls(new Set(sitemapUrls.map(u => u.url)))}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUrls(new Set())}
                >
                  Clear All
                </Button>
              </div>
            </div>
          )}

          {/* Group pages by category */}
          {(['collection', 'product', 'page', 'other'] as const).map((category) => {
            const urls = sitemapUrls.filter((u) => u.category === category)
            if (urls.length === 0) return null

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize flex items-center justify-between">
                    <span>
                      {category === 'other' ? 'Other' : category} Pages ({urls.length})
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {urls.filter((u) => selectedUrls.has(u.url)).length} selected
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {urls.slice(0, 50).map((item) => (
                      <div
                        key={item.url}
                        onClick={() => toggleUrl(item.url)}
                        className={`p-3 rounded-lg border cursor-pointer transition ${
                          selectedUrls.has(item.url)
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{item.url}</div>
                          </div>
                          {selectedUrls.has(item.url) && (
                            <Check className="h-4 w-4 text-primary ml-2 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                    {urls.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Showing first 50 of {urls.length} pages
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep('url')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={() => handleScrapePages()} disabled={selectedUrls.size === 0 || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scraping {selectedUrls.size} pages...
                </>
              ) : (
                <>
                  Scrape {selectedUrls.size} Page{selectedUrls.size !== 1 ? 's' : ''}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review (combined brand info + images) */}
      {step === 'review' && scrapeResult && (
        <div className="space-y-6">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-green-800">
                  Scraped {scrapeResult.pages_scraped || 1} page{(scrapeResult.pages_scraped || 1) !== 1 ? 's' : ''} • Found {scrapeResult.images.length} images
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Brand Details */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Details</CardTitle>
              <CardDescription>Review and adjust the extracted information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="primaryColor">Primary</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      id="primaryColor"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondaryColor">Secondary</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      id="secondaryColor"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="accentColor">Accent</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      id="accentColor"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="fontPrimary">Primary Font</Label>
                <Input
                  id="fontPrimary"
                  value={fontPrimary}
                  onChange={(e) => setFontPrimary(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="klaviyoApiKey">Klaviyo API Key (Optional)</Label>
                <Input
                  id="klaviyoApiKey"
                  type="password"
                  value={klaviyoApiKey}
                  onChange={(e) => setKlaviyoApiKey(e.target.value)}
                  placeholder="pk_..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          {Object.entries(imagesByType).map(([type, images]) => (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between capitalize">
                  <span>
                    <ImageIcon className="h-5 w-5 inline mr-2" />
                    {type} Images ({images.length})
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => selectAllImages(type)}>
                      Select All
                    </Button>
                    <span className="text-sm font-normal text-muted-foreground">
                      {images.filter((img) => selectedImages.has(img.url)).length} selected
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {images.map((img, idx) => (
                    <ImageCard
                      key={`${type}-${idx}`}
                      image={img}
                      selected={selectedImages.has(img.url)}
                      onToggle={() => toggleImage(img.url)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => (isShopify ? setStep('select-pages') : setStep('url'))}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={!brandName}>
              Save Brand ({selectedImages.size} images)
            </Button>
          </div>
        </div>
      )}

      {/* Saving */}
      {step === 'saving' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Saving brand...</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ImageCard({
  image,
  selected,
  onToggle,
}: {
  image: ExtractedImage
  selected: boolean
  onToggle: () => void
}) {
  const [imageError, setImageError] = useState(false)

  if (imageError) return null

  return (
    <div
      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-gray-300'
      }`}
      onClick={onToggle}
    >
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        <img
          src={image.url}
          alt={image.alt || 'Brand image'}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>

      <div
        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${
          selected ? 'bg-primary text-white' : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
        }`}
      >
        {selected ? <Check className="h-4 w-4" /> : <span className="text-xs">+</span>}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <span className="text-xs text-white capitalize">{image.type}</span>
        {image.source_page && (
          <div className="text-xs text-white/70 truncate">
            {(() => {
              try {
                return new URL(image.source_page).pathname
              } catch {
                return image.source_page
              }
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
