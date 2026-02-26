'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Brand } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

export default function EditBrandPage() {
  const params = useParams()
  const router = useRouter()
  const brandId = params.id as string

  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#000000')
  const [secondaryColor, setSecondaryColor] = useState('#FFFFFF')
  const [accentColor, setAccentColor] = useState('#666666')
  const [fontPrimary, setFontPrimary] = useState('Helvetica, Arial, sans-serif')
  const [fontSecondary, setFontSecondary] = useState('Georgia, serif')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    loadBrand()
  }, [brandId])

  async function loadBrand() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('brands').select('*').eq('id', brandId).single()

      if (error) throw error

      setBrand(data)
      setName(data.name)
      setWebsiteUrl(data.website_url || '')
      setPrimaryColor(data.primary_color || '#000000')
      setSecondaryColor(data.secondary_color || '#FFFFFF')
      setAccentColor(data.accent_color || '#666666')
      setFontPrimary(data.font_primary || 'Helvetica, Arial, sans-serif')
      setFontSecondary(data.font_secondary || 'Georgia, serif')
      setLogoUrl(data.logo_url || '')
    } catch (error) {
      console.error('Error loading brand:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('brands')
        .update({
          name,
          website_url: websiteUrl || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          font_primary: fontPrimary,
          font_secondary: fontSecondary,
          logo_url: logoUrl || null,
        })
        .eq('id', brandId)

      if (error) throw error

      router.push(`/dashboard/brands/${brandId}`)
    } catch (error) {
      console.error('Error saving brand:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Brand not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/dashboard/brands/${brandId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to {brand.name}
      </Link>

      <h1 className="text-3xl font-bold mb-8">Edit Brand Settings</h1>

      <div className="space-y-6">
        {/* Brand Details */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Brand Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="websiteUrl">Website URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="websiteUrl"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1"
                />
                {websiteUrl && (
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Colors</CardTitle>
            <CardDescription>These colors will be used in email templates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="primaryColor">Primary</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1"
                  />
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
                    className="w-10 h-10 rounded cursor-pointer border"
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
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Color preview */}
            <div className="mt-4 p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-2">Preview</p>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-12 rounded flex items-center justify-center text-white font-medium"
                  style={{ backgroundColor: primaryColor }}
                >
                  Primary
                </div>
                <div
                  className="flex-1 h-12 rounded flex items-center justify-center font-medium border"
                  style={{ backgroundColor: secondaryColor, color: primaryColor }}
                >
                  Secondary
                </div>
                <div
                  className="flex-1 h-12 rounded flex items-center justify-center text-white font-medium"
                  style={{ backgroundColor: accentColor }}
                >
                  Accent
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="fontPrimary">Primary Font (Headlines)</Label>
              <Input
                id="fontPrimary"
                value={fontPrimary}
                onChange={(e) => setFontPrimary(e.target.value)}
                placeholder="Helvetica, Arial, sans-serif"
                className="mt-1"
              />
              <p className="mt-2 text-2xl font-bold" style={{ fontFamily: fontPrimary }}>
                The quick brown fox
              </p>
            </div>
            <div>
              <Label htmlFor="fontSecondary">Secondary Font (Body)</Label>
              <Input
                id="fontSecondary"
                value={fontSecondary}
                onChange={(e) => setFontSecondary(e.target.value)}
                placeholder="Georgia, serif"
                className="mt-1"
              />
              <p className="mt-2 text-base" style={{ fontFamily: fontSecondary }}>
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            {logoUrl && (
              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="max-h-24 object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-between">
          <Link href={`/dashboard/brands/${brandId}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
