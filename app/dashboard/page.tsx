'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ArrowRight, Loader2 } from 'lucide-react'
import { Brand } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('brands')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBrands(data || [])
        setLoading(false)
      })
  }, [])

  // Derived stats
  const totalBrands = brands.length
  const deployed = brands.filter((b) => b.klaviyo_api_key).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalBrands > 0 ? `${totalBrands} brand${totalBrands !== 1 ? 's' : ''} in your workspace` : 'Add your first brand to get started'}
          </p>
        </div>
        <Link
          href="/dashboard/brands/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />
          Add Brand
        </Link>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard value={totalBrands} label="Total Brands" />
        <StatCard value={deployed} label="Deployed" highlight />
        <StatCard value={0} label="Email Templates" />
        <StatCard value={0} label="Active Flows" />
      </div>

      {/* ── All Brands ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">All Brands</h2>
        <Link href="/dashboard/brands" className="text-xs text-muted-foreground hover:text-foreground transition">
          View all
        </Link>
      </div>

      {brands.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
          <AddBrandCard />
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-gray-700 mb-1">No brands yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Add a client's website and we'll scrape their brand colors, fonts, and logo automatically.
          </p>
          <Link
            href="/dashboard/brands/new"
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" />
            Add your first brand
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-5 ${highlight ? 'bg-primary text-primary-foreground' : 'bg-white border'}`}>
      <p className={`text-3xl font-bold tracking-tight ${highlight ? 'text-primary-foreground' : 'text-foreground'}`}>
        {value}
      </p>
      <p className={`text-xs mt-1 font-medium ${highlight ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
        {label}
      </p>
    </div>
  )
}

// ─── Brand card ───────────────────────────────────────────────────────────────

function BrandCard({ brand }: { brand: Brand }) {
  const initials = brand.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const status = brand.klaviyo_api_key ? 'Live' : 'Draft'
  const statusStyle = brand.klaviyo_api_key
    ? 'bg-primary/10 text-primary'
    : 'bg-gray-100 text-gray-500'

  return (
    <Link href={`/dashboard/brands/${brand.id}`}>
      <div className="group bg-white border rounded-xl p-4 hover:shadow-sm hover:border-gray-300 transition cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: brand.primary_color || '#18181b' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{brand.name}</p>
              {brand.website_url && (
                <p className="text-xs text-muted-foreground truncate">
                  {brand.website_url.replace(/^https?:\/\//, '')}
                </p>
              )}
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusStyle}`}>
            {status}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[brand.primary_color, brand.secondary_color, brand.accent_color]
              .filter(Boolean)
              .map((color, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: color! }}
                />
              ))}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition" />
        </div>
      </div>
    </Link>
  )
}

function AddBrandCard() {
  return (
    <Link href="/dashboard/brands/new">
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[100px] hover:border-primary/40 hover:bg-gray-50 transition cursor-pointer text-muted-foreground hover:text-foreground">
        <Plus className="h-5 w-5 mb-1.5" />
        <span className="text-sm font-medium">Add brand</span>
      </div>
    </Link>
  )
}
