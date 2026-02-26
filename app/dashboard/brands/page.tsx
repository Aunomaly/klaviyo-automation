'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brand } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBrands()
  }, [])

  async function loadBrands() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setBrands(data || [])
    } catch (error) {
      console.error('Error loading brands:', error)
    } finally {
      setLoading(false)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Brands</h1>
          <p className="text-muted-foreground mt-1">
            Manage your client brands and their styling
          </p>
        </div>
        <Link href="/dashboard/brands/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Brand
          </Button>
        </Link>
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground text-center mb-4">
              <p className="text-lg font-medium">No brands yet</p>
              <p className="text-sm">Add your first brand to get started</p>
            </div>
            <Link href="/dashboard/brands/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Brand
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <Link key={brand.id} href={`/dashboard/brands/${brand.id}`}>
              <Card className="hover:shadow-lg transition cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-lg border flex-shrink-0"
                      style={{ backgroundColor: brand.primary_color || '#000000' }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{brand.name}</h3>
                      {brand.website_url && (
                        <p className="text-sm text-muted-foreground truncate">
                          {brand.website_url.replace(/^https?:\/\//, '')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 mb-3">
                    <div
                      className="flex-1 h-8 rounded border"
                      style={{ backgroundColor: brand.primary_color }}
                    />
                    <div
                      className="flex-1 h-8 rounded border"
                      style={{ backgroundColor: brand.secondary_color }}
                    />
                    <div
                      className="flex-1 h-8 rounded border"
                      style={{ backgroundColor: brand.accent_color }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Type className="h-3 w-3" />
                      {brand.font_primary?.split(',')[0] || 'Default'}
                    </span>
                    {brand.klaviyo_api_key ? (
                      <span className="text-green-600 font-medium">✓ Connected</span>
                    ) : (
                      <span className="text-yellow-600">No API key</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
