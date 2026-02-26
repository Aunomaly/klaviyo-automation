'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  X,
  Rocket,
  Loader2,
  Check,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Mail,
  AlertCircle,
  Image as ImageIcon,
  ScanLine,
  ChevronRight,
  Sparkles,
  Pencil,
  ArrowLeft,
  Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Brand, BrandImage } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { TEMPLATE_REGISTRY } from '@/lib/templates/types'
import { TemplatePreviewIframe } from '@/components/TemplatePreviewIframe'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  product_url: string
  primary_image_url: string | null
  price: string | null
  description: string | null
}

interface FlowDef {
  id: string
  name: string
  description: string
  timing: string[]
  templateIds: string[]
}

interface SelectedItem {
  type: 'flow' | 'template'
  id: string
  name: string
  templateIds: string[]
  productId: string
  productName: string
}

// ─── Flow definitions ─────────────────────────────────────────────────────────

const FLOWS: FlowDef[] = [
  {
    id: 'welcome',
    name: 'Welcome Series',
    description: 'Sent when someone joins your list',
    timing: ['Immediately', '1 day later', '3 days later'],
    templateIds: ['welcome_1', 'welcome_2', 'welcome_3'],
  },
  {
    id: 'abandoned_cart',
    name: 'Abandoned Cart',
    description: 'Sent when someone leaves items in their cart',
    timing: ['4 hours later', '24 hours later', '72 hours later'],
    templateIds: ['abandoned_cart_1', 'abandoned_cart_2', 'abandoned_cart_3'],
  },
  {
    id: 'browse_abandonment',
    name: 'Browse Abandonment',
    description: "Sent when someone views a product but doesn't buy",
    timing: ['2 hours later', '24 hours later'],
    templateIds: ['browse_abandonment_1', 'browse_abandonment_2'],
  },
  {
    id: 'winback',
    name: 'Winback',
    description: "Re-engages customers who haven't bought in 60 days",
    timing: ['Immediately', '7 days later'],
    templateIds: ['winback_1', 'winback_2'],
  },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BrandPage() {
  const params = useParams()
  const router = useRouter()
  const brandId = params.id as string

  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null)
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null)

  const [generatedSlotsMap, setGeneratedSlotsMap] = useState<Record<string, Record<string, string>>>({})
  const [generating, setGenerating] = useState(false)
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(new Set())
  const [generateResult, setGenerateResult] = useState<{ success: boolean; message: string } | null>(null)
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [brandImages, setBrandImages] = useState<BrandImage[]>([])

  const [lists, setLists] = useState<any[]>([])
  const [forms, setForms] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [resourceStatus, setResourceStatus] = useState<string | null>(null)

  const loadBrand = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (data) {
      setBrand(data)
      setApiKeyInput(data.klaviyo_api_key || '')
    }
    setLoading(false)
  }, [brandId])

  const loadResources = useCallback(async () => {
    const supabase = createClient()
    const [{ data: l }, { data: f }, { data: c }, { data: p }, { data: imgs }] = await Promise.all([
      supabase.from('brand_lists').select('*').eq('brand_id', brandId),
      supabase.from('brand_forms').select('*').eq('brand_id', brandId),
      supabase.from('brand_coupons').select('*').eq('brand_id', brandId),
      supabase.from('products').select('*').eq('brand_id', brandId).eq('is_active', true).order('name', { ascending: true }),
      supabase.from('brand_images').select('*').eq('brand_id', brandId).eq('is_ai_generated', false).order('display_order', { ascending: true }).limit(15),
    ])
    setLists(l || [])
    setForms(f || [])
    setCoupons(c || [])
    setProducts(p || [])
    setBrandImages(imgs || [])
  }, [brandId])

  useEffect(() => {
    loadBrand()
    loadResources()
  }, [loadBrand, loadResources])

  function itemKey(id: string, productId: string) { return `${id}::${productId}` }

  function addItem(item: SelectedItem) {
    const key = itemKey(item.id, item.productId)
    if (selectedItems.some((i) => itemKey(i.id, i.productId) === key)) return
    setSelectedItems((prev) => [...prev, item])
  }

  function removeItem(key: string) {
    setSelectedItems((prev) => prev.filter((i) => itemKey(i.id, i.productId) !== key))
  }

  async function saveApiKey() {
    if (!brand) return
    setSavingApiKey(true)
    const supabase = createClient()
    await supabase.from('brands').update({ klaviyo_api_key: apiKeyInput }).eq('id', brand.id)
    await loadBrand()
    setSavingApiKey(false)
  }

  async function handleDeploy() {
    if (!brand?.klaviyo_api_key || selectedItems.length === 0) return
    setDeploying(true)
    setDeployResult(null)
    const templateProductMap: Record<string, string> = {}
    for (const item of selectedItems) {
      for (const tId of item.templateIds) { templateProductMap[tId] = item.productId }
    }
    const allTemplateIds = Object.keys(templateProductMap)
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId, apiKey: brand.klaviyo_api_key, templates: allTemplateIds, templateProductMap, generatedSlotsMap,
          brand: { name: brand.name, primaryColor: brand.primary_color ?? '#000000', secondaryColor: brand.secondary_color ?? '#ffffff', accentColor: brand.accent_color ?? '#000000', fontPrimary: brand.font_primary ?? 'Helvetica, Arial, sans-serif', logoUrl: brand.logo_url },
        }),
      })
      const data = await res.json()
      setDeployResult({ success: data.success, message: data.success ? `${allTemplateIds.length} template${allTemplateIds.length !== 1 ? 's' : ''} deployed to Klaviyo` : data.error ?? 'Deployment failed' })
    } catch {
      setDeployResult({ success: false, message: 'Deployment failed — check your API key' })
    } finally { setDeploying(false) }
  }

  async function generateOne(templateId: string, productId: string) {
    if (!brand) return
    const key = `${templateId}::${productId}`
    setGeneratingKeys((prev) => new Set(prev).add(key))
    try {
      const supabase = createClient()
      const { data: product } = await supabase.from('products').select('*').eq('id', productId).single()
      if (!product) return
      const res = await fetch('/api/templates/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, brand: { name: brand.name, primaryColor: brand.primary_color ?? '#000000', tagline: brand.tagline ?? undefined }, product: { name: product.name, description: product.description ?? undefined, price: product.price ?? undefined, productUrl: product.product_url } }),
      })
      const data = await res.json()
      if (data.success && data.slots) setGeneratedSlotsMap((prev) => ({ ...prev, [key]: data.slots }))
    } catch { /* ignore */ } finally {
      setGeneratingKeys((prev) => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  async function handleGenerate() {
    if (!brand || selectedItems.length === 0) return
    setGenerating(true)
    setGenerateResult(null)
    const pairs: { templateId: string; productId: string }[] = []
    for (const item of selectedItems) {
      for (const tId of item.templateIds) {
        const key = `${tId}::${item.productId}`
        if (!pairs.find((p) => `${p.templateId}::${p.productId}` === key)) pairs.push({ templateId: tId, productId: item.productId })
      }
    }
    const supabase = createClient()
    let successCount = 0, failCount = 0
    await Promise.all(pairs.map(async ({ templateId, productId }) => {
      try {
        const { data: product } = await supabase.from('products').select('*').eq('id', productId).single()
        if (!product) { failCount++; return }
        const res = await fetch('/api/templates/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId, brand: { name: brand.name, primaryColor: brand.primary_color ?? '#000000', tagline: brand.tagline ?? undefined }, product: { name: product.name, description: product.description ?? undefined, price: product.price ?? undefined, productUrl: product.product_url } }),
        })
        const data = await res.json()
        if (data.success && data.slots) { setGeneratedSlotsMap((prev) => ({ ...prev, [`${templateId}::${productId}`]: data.slots })); successCount++ }
        else failCount++
      } catch { failCount++ }
    }))
    setGenerating(false)
    setGenerateResult({ success: failCount === 0, message: failCount === 0 ? `Generated copy for ${successCount} template${successCount !== 1 ? 's' : ''}` : `${successCount} succeeded, ${failCount} failed` })
  }

  function openEditor(templateId: string, productId: string) {
    const key = `${templateId}::${productId}`
    const existingSlots = generatedSlotsMap[key]
    const p = new URLSearchParams({ productId })
    // URLSearchParams already percent-encodes values — do NOT double-encode
    if (existingSlots) p.set('slots', JSON.stringify(existingSlots))
    router.push(`/dashboard/brands/${brandId}/editor/${templateId}?${p.toString()}`)
  }

  useEffect(() => {
    const updates: Record<string, Record<string, string>> = {}
    for (const item of selectedItems) {
      for (const tId of item.templateIds) {
        const saved = localStorage.getItem(`editor_slots_${tId}_${item.productId}`)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (parsed.slots && Object.keys(parsed.slots).length > 0) updates[`${tId}::${item.productId}`] = parsed.slots
          } catch { /* ignore */ }
        }
      }
    }
    if (Object.keys(updates).length > 0) setGeneratedSlotsMap((prev) => ({ ...prev, ...updates }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems])

  async function handleCreateLists() {
    if (!brand?.klaviyo_api_key) return
    setResourceStatus('Creating lists…')
    const res = await fetch('/api/lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId, apiKey: brand.klaviyo_api_key }) })
    const data = await res.json()
    setResourceStatus(data.success ? null : 'Failed to create lists')
    if (data.success) await loadResources()
  }

  async function handleCreateForm() {
    if (!brand?.klaviyo_api_key) return
    const emailList = lists.find((l) => l.list_type === 'email')
    const smsList = lists.find((l) => l.list_type === 'sms')
    if (!emailList || !smsList) return
    setResourceStatus('Creating form…')
    const res = await fetch('/api/forms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId, apiKey: brand.klaviyo_api_key, emailListId: emailList.id, smsListId: smsList.id }) })
    const data = await res.json()
    setResourceStatus(data.success ? null : 'Failed to create form')
    if (data.success) await loadResources()
  }

  async function handleCreateCoupon(code: string) {
    if (!brand?.klaviyo_api_key) return
    setResourceStatus('Creating coupon…')
    const res = await fetch('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId, apiKey: brand.klaviyo_api_key, couponCode: code, description: `${brand.name} Welcome Discount`, discountType: 'percentage', discountValue: 10 }) })
    const data = await res.json()
    setResourceStatus(data.success ? null : 'Failed to create coupon')
    if (data.success) await loadResources()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#9C9B99' }} />
      </div>
    )
  }

  if (!brand) {
    return <div className="text-center py-16" style={{ color: '#9C9B99' }}>Brand not found</div>
  }

  const hasApiKey = !!brand.klaviyo_api_key
  const totalTemplates = new Set(selectedItems.flatMap((i) => i.templateIds)).size
  const canDeploy = hasApiKey && totalTemplates > 0 && !deploying
  const canGenerate = totalTemplates > 0 && !generating && !deploying

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Top breadcrumb bar ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2" style={{ fontSize: 14 }}>
          <Link href="/dashboard/brands" style={{ color: '#9C9B99', textDecoration: 'none' }}>
            Brands
          </Link>
          <ChevronRight style={{ width: 14, height: 14, color: '#9C9B99' }} />
          <span style={{ color: '#1A1918', fontWeight: 600 }}>{brand.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/brands/${brandId}/rescan`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 8, padding: '6px 12px', background: '#fff', cursor: 'pointer', textDecoration: 'none' }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
            Rescan
          </Link>
          <button
            onClick={handleDeploy}
            disabled={!canDeploy}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1A1918', backgroundColor: '#43ff47', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: canDeploy ? 'pointer' : 'not-allowed', opacity: canDeploy ? 1 : 0.5 }}
          >
            {deploying ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Rocket style={{ width: 14, height: 14 }} />}
            {deploying ? 'Deploying…' : 'Deploy to Klaviyo'}
          </button>
        </div>
      </div>

      {/* ── Brand header ── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: brand.primary_color || '#1A1918', flexShrink: 0 }} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1918', margin: 0 }}>{brand.name}</h1>
            {brand.website_url && (
              <a href={brand.website_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#9C9B99', textDecoration: 'none', marginTop: 2 }}>
                {brand.website_url.replace(/^https?:\/\//, '')}
                <ExternalLink style={{ width: 12, height: 12 }} />
              </a>
            )}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex gap-1">
                {[brand.primary_color, brand.secondary_color, brand.accent_color].filter(Boolean).map((color, i) => (
                  <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: color!, border: '1.5px solid #E2E4E9' }} />
                ))}
              </div>
              {brand.font_primary && (
                <span style={{ fontSize: 12, color: '#9C9B99' }}>{brand.font_primary.split(',')[0]}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status banners ── */}
      {!hasApiKey && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#d97706', marginBottom: 12 }}>
          <AlertCircle style={{ width: 13, height: 13 }} />
          Add Klaviyo API key to deploy
        </div>
      )}
      {generateResult && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12, backgroundColor: generateResult.success ? '#f0fff0' : '#fffbeb', border: `1px solid ${generateResult.success ? '#bbf7d0' : '#fde68a'}`, color: generateResult.success ? '#166534' : '#92400e' }}>
          <Sparkles style={{ width: 14, height: 14, flexShrink: 0 }} />
          {generateResult.message}
        </div>
      )}
      {deployResult && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12, backgroundColor: deployResult.success ? '#f0fff0' : '#fef2f2', border: `1px solid ${deployResult.success ? '#bbf7d0' : '#fecaca'}`, color: deployResult.success ? '#166534' : '#991b1b' }}>
          {deployResult.success ? <Check style={{ width: 14, height: 14, flexShrink: 0 }} /> : <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />}
          {deployResult.message}
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>

        {/* ── Left: workspace + scraped images ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Workspace / empty state */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 12, overflow: 'hidden' }}>
            {selectedItems.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setShowModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 8, padding: '9px 16px', background: '#fff', cursor: 'pointer' }}
                  >
                    <Mail style={{ width: 14, height: 14 }} />
                    Generate Emails
                  </button>
                  <Link
                    href={`/dashboard/brands/${brandId}/studio`}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 8, padding: '9px 16px', background: '#fff', cursor: 'pointer', textDecoration: 'none' }}
                  >
                    <ImageIcon style={{ width: 14, height: 14 }} />
                    Image Studio
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ padding: 0 }}>
                {selectedItems.map((item) =>
                  item.templateIds.map((templateId) => {
                    const template = TEMPLATE_REGISTRY.find((t) => t.id === templateId)
                    const previewKey = `${templateId}::${item.productId}`
                    const isOpen = openPreviewId === previewKey
                    const slots = generatedSlotsMap[previewKey]
                    return (
                      <div key={previewKey} style={{ borderBottom: '1px solid #E2E4E9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                          <button
                            onClick={() => setOpenPreviewId(isOpen ? null : previewKey)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', minWidth: 0 }}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#43ff47', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1918', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template?.name ?? templateId}</span>
                            <span style={{ fontSize: 12, color: '#9C9B99', whiteSpace: 'nowrap' }}>{item.productName}</span>
                            {!!slots && <span style={{ fontSize: 11, color: '#1A1918', backgroundColor: '#f0fff0', padding: '2px 7px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}><Sparkles style={{ width: 10, height: 10 }} />AI</span>}
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                            <button
                              onClick={() => generateOne(templateId, item.productId)}
                              disabled={generatingKeys.has(previewKey)}
                              title="Generate AI copy"
                              style={{ padding: 6, borderRadius: 6, background: 'none', border: 'none', cursor: generatingKeys.has(previewKey) ? 'not-allowed' : 'pointer', color: slots ? '#43ff47' : '#9C9B99' }}
                            >
                              {generatingKeys.has(previewKey)
                                ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                                : <Sparkles style={{ width: 13, height: 13 }} />}
                            </button>
                            <button onClick={() => openEditor(templateId, item.productId)} style={{ padding: 6, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9C9B99' }}>
                              <Pencil style={{ width: 13, height: 13 }} />
                            </button>
                            <button onClick={() => setOpenPreviewId(isOpen ? null : previewKey)} style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9C9B99', display: 'flex', alignItems: 'center' }}>
                              {isOpen ? <ChevronUp style={{ width: 15, height: 15 }} /> : <ChevronDown style={{ width: 15, height: 15 }} />}
                            </button>
                          </div>
                        </div>
                        {isOpen && (
                          <TemplatePreviewIframe brandId={brandId} templateId={templateId} productId={item.productId} generatedSlots={slots} className="w-full" style={{ height: 520, borderTop: '1px solid #E2E4E9' }} />
                        )}
                      </div>
                    )
                  })
                )}

                {/* Generate all footer */}
                <div style={{ padding: '10px 16px', borderTop: '1px solid #E2E4E9', display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1A1918', backgroundColor: generating ? '#ECEEF2' : '#43ff47', border: 'none', borderRadius: 8, padding: '7px 18px', cursor: generating ? 'not-allowed' : 'pointer' }}
                  >
                    {generating
                      ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                      : <Sparkles style={{ width: 13, height: 13 }} />}
                    {generating ? 'Generating…' : 'Generate all'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scraped Images section */}
          {brandImages.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ImageIcon style={{ width: 14, height: 14, color: '#9C9B99' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1918' }}>Images</span>
                  <span style={{ fontSize: 12, color: '#9C9B99', backgroundColor: '#ECEEF2', borderRadius: 20, padding: '1px 8px' }}>{brandImages.length}</span>
                </div>
                <Link href={`/dashboard/brands/${brandId}/media`} style={{ fontSize: 12, color: '#9C9B99', textDecoration: 'none' }}>
                  View all
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {brandImages.slice(0, 9).map((img, i) => {
                  const isLast = i === 8 && brandImages.length > 9
                  return (
                    <div key={img.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', backgroundColor: '#ECEEF2' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.klaviyo_image_url ?? img.original_url} alt={img.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {isLast && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(26,25,24,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>+{brandImages.length - 9} more</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Products card */}
          <ScanCard brandId={brandId} websiteUrl={brand.website_url ?? null} products={products} onScanComplete={loadResources} />

          {/* Selected items */}
          {selectedItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9C9B99', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Workspace</p>
              {selectedItems.map((item) => {
                const key = itemKey(item.id, item.productId)
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E4E9', backgroundColor: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {item.type === 'flow' ? <Zap style={{ width: 13, height: 13, color: '#43ff47', flexShrink: 0 }} /> : <Mail style={{ width: 13, height: 13, color: '#9C9B99', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1918', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#9C9B99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName} · {item.templateIds.length} email{item.templateIds.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <button onClick={() => removeItem(key)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9C9B99', flexShrink: 0, padding: 2 }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Klaviyo setup (API key + resources combined) */}
          <KlaviyoSetupCard
            brand={brand}
            apiKeyInput={apiKeyInput}
            apiKeyVisible={apiKeyVisible}
            saving={savingApiKey}
            onInputChange={setApiKeyInput}
            onToggleVisible={() => setApiKeyVisible((v) => !v)}
            onSave={saveApiKey}
            lists={lists}
            forms={forms}
            coupons={coupons}
            status={resourceStatus}
            onCreateLists={handleCreateLists}
            onCreateForm={handleCreateForm}
            onCreateCoupon={handleCreateCoupon}
          />

        </div>
      </div>

      {/* ── Create modal ── */}
      {showModal && (
        <CreateModal products={products} brandId={brandId} onAdd={addItem} onClose={() => setShowModal(false)} onProductsRefresh={loadResources} />
      )}
    </div>
  )
}

// ─── ScanCard ─────────────────────────────────────────────────────────────────

function ScanCard({ brandId, websiteUrl, products, onScanComplete }: { brandId: string; websiteUrl: string | null; products: Product[]; onScanComplete: () => void }) {
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  async function handleScan() {
    setScanning(true); setScanResult(null); setScanError(null)
    try {
      const res = await fetch(`/api/brands/${brandId}/scan-products`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setScanError(data.error ?? 'Scan failed')
      else { setScanResult(`Found ${data.count} product${data.count !== 1 ? 's' : ''}`); onScanComplete() }
    } catch (e) { setScanError(String(e)) } finally { setScanning(false) }
  }

  const filtered = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: products.length > 0 && open ? 10 : 0 }}>
        <button
          onClick={() => products.length > 0 && setOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: products.length > 0 ? 'pointer' : 'default' }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1918' }}>Products</span>
          {products.length > 0 && (
            <span style={{ fontSize: 11, color: '#9C9B99', backgroundColor: '#ECEEF2', borderRadius: 20, padding: '1px 7px' }}>{products.length}</span>
          )}
          {products.length > 0 && (
            open
              ? <ChevronUp style={{ width: 13, height: 13, color: '#9C9B99' }} />
              : <ChevronDown style={{ width: 13, height: 13, color: '#9C9B99' }} />
          )}
        </button>
        <button
          onClick={handleScan}
          disabled={scanning || !websiteUrl}
          title={!websiteUrl ? 'No website URL saved for this brand' : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 6, padding: '4px 10px', background: '#fff', cursor: scanning || !websiteUrl ? 'not-allowed' : 'pointer', opacity: !websiteUrl ? 0.4 : 1 }}
        >
          {scanning ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <ScanLine style={{ width: 12, height: 12 }} />}
          {scanning ? 'Scanning…' : products.length > 0 ? 'Re-scan' : 'Scan store'}
        </button>
      </div>

      {products.length === 0 ? (
        <p style={{ fontSize: 12, color: '#9C9B99', lineHeight: 1.5, margin: 0 }}>
          Scan the store to automatically discover all products. Uses Shopify&apos;s public product catalog — no API key needed.
        </p>
      ) : open ? (
        <>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9C9B99', pointerEvents: 'none' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              style={{ width: '100%', paddingLeft: 26, paddingRight: 8, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: '1px solid #E2E4E9', borderRadius: 6, outline: 'none', color: '#1A1918', backgroundColor: '#FAFAFA', boxSizing: 'border-box' }}
            />
          </div>

          {/* Scrollable list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9C9B99', margin: 0, padding: '6px 0' }}>No products match &ldquo;{query}&rdquo;</p>
            ) : filtered.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                {p.primary_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.primary_image_url} alt={p.name} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E4E9' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: '#ECEEF2', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1918', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  {p.price && <div style={{ fontSize: 11, color: '#9C9B99' }}>{p.price}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {scanResult && <p style={{ fontSize: 12, color: '#16a34a', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Check style={{ width: 12, height: 12 }} />{scanResult}</p>}
      {scanError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{scanError}</p>}
    </div>
  )
}

// ─── CreateModal ──────────────────────────────────────────────────────────────

type ModalStep = 'product' | 'selection' | 'confirm'
type SelectionTab = 'flows' | 'messages'

function CreateModal({ products, brandId, onAdd, onClose, onProductsRefresh }: { products: Product[]; brandId: string; onAdd: (item: SelectedItem) => void; onClose: () => void; onProductsRefresh: () => void }) {
  const [step, setStep] = useState<ModalStep>('product')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [tab, setTab] = useState<SelectionTab>('flows')
  const [pendingItem, setPendingItem] = useState<SelectedItem | null>(null)
  const [addingUrl, setAddingUrl] = useState('')
  const [addingLoading, setAddingLoading] = useState(false)
  const [addingError, setAddingError] = useState<string | null>(null)

  async function handleAddProductUrl() {
    if (!addingUrl.trim()) return
    setAddingLoading(true); setAddingError(null)
    try {
      const res = await fetch('/api/products/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId, productUrl: addingUrl.trim() }) })
      const data = await res.json()
      if (!res.ok) setAddingError(data.error ?? 'Failed to add product')
      else { setAddingUrl(''); await onProductsRefresh(); if (data.product) setSelectedProduct(data.product) }
    } catch (e) { setAddingError(String(e)) } finally { setAddingLoading(false) }
  }

  function selectFlow(flow: FlowDef) {
    if (!selectedProduct) return
    setPendingItem({ type: 'flow', id: `${flow.id}::${selectedProduct.id}`, name: flow.name, templateIds: flow.templateIds, productId: selectedProduct.id, productName: selectedProduct.name })
    setStep('confirm')
  }

  function selectMessage(flow: FlowDef, templateId: string, emailIndex: number) {
    if (!selectedProduct) return
    setPendingItem({ type: 'template', id: `${templateId}::${selectedProduct.id}`, name: `${flow.name} › Email ${emailIndex + 1}`, templateIds: [templateId], productId: selectedProduct.id, productName: selectedProduct.name })
    setStep('confirm')
  }

  function handleConfirm() { if (pendingItem) onAdd(pendingItem); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E2E4E9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step !== 'product' && (
              <button onClick={() => setStep(step === 'confirm' ? 'selection' : 'product')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9C9B99', marginRight: 4, padding: 0 }}>
                <ArrowLeft style={{ width: 16, height: 16 }} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ fontWeight: step === 'product' ? 600 : 400, color: step === 'product' ? '#1A1918' : '#9C9B99' }}>Product</span>
              <ChevronRight style={{ width: 13, height: 13, color: '#9C9B99' }} />
              <span style={{ fontWeight: step === 'selection' ? 600 : 400, color: step === 'selection' ? '#1A1918' : '#9C9B99' }}>Flow / Message</span>
              <ChevronRight style={{ width: 13, height: 13, color: '#9C9B99' }} />
              <span style={{ fontWeight: step === 'confirm' ? 600 : 400, color: step === 'confirm' ? '#1A1918' : '#9C9B99' }}>Confirm</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9C9B99', padding: 0 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {step === 'product' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1918', margin: 0 }}>Which product is this for?</p>
              {products.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {products.map((p) => (
                    <button key={p.id} onClick={() => { setSelectedProduct(p); setStep('selection') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, border: '1px solid #E2E4E9', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                      {p.primary_image_url
                        ? <img src={p.primary_image_url} alt={p.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#ECEEF2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ImageIcon style={{ width: 18, height: 18, color: '#9C9B99' }} /></div>}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1918', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        {p.price && <p style={{ fontSize: 12, color: '#9C9B99', margin: 0 }}>{p.price}</p>}
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, color: '#9C9B99', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9C9B99', fontSize: 13 }}>
                  <p style={{ margin: '0 0 4px' }}>No products yet.</p>
                  <p style={{ margin: 0, fontSize: 12 }}>Scan the store or add a product URL below.</p>
                </div>
              )}
              <div style={{ borderTop: '1px solid #E2E4E9', paddingTop: 12 }}>
                <p style={{ fontSize: 12, color: '#9C9B99', margin: '0 0 8px' }}>Or add a specific product URL:</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Input placeholder="store.com/products/slug" value={addingUrl} onChange={(e) => setAddingUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddProductUrl()} className="text-xs h-8" />
                  <button onClick={handleAddProductUrl} disabled={addingLoading || !addingUrl.trim()}
                    style={{ padding: '0 10px', border: '1px solid #E2E4E9', borderRadius: 6, background: '#fff', cursor: 'pointer', flexShrink: 0, opacity: addingLoading || !addingUrl.trim() ? 0.4 : 1 }}>
                    {addingLoading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Plus style={{ width: 12, height: 12 }} />}
                  </button>
                </div>
                {addingError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{addingError}</p>}
              </div>
            </div>
          )}

          {step === 'selection' && selectedProduct && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#ECEEF2', borderRadius: 8 }}>
                {selectedProduct.primary_image_url
                  ? <img src={selectedProduct.primary_image_url} alt={selectedProduct.name} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: '#E2E4E9', flexShrink: 0 }} />}
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1918' }}>{selectedProduct.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, backgroundColor: '#ECEEF2', borderRadius: 8, padding: 4 }}>
                {(['flows', 'messages'] as SelectionTab[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', backgroundColor: tab === t ? '#fff' : 'transparent', color: tab === t ? '#1A1918' : '#9C9B99', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                    {t === 'flows' ? 'Entire flows' : 'Individual messages'}
                  </button>
                ))}
              </div>
              {tab === 'flows' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FLOWS.map((flow) => (
                    <button key={flow.id} onClick={() => selectFlow(flow)}
                      style={{ textAlign: 'left', padding: 14, borderRadius: 10, border: '1px solid #E2E4E9', background: '#fff', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Zap style={{ width: 14, height: 14, color: '#43ff47' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1918' }}>{flow.name}</span>
                        <span style={{ fontSize: 12, color: '#9C9B99' }}>{flow.templateIds.length} emails</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#9C9B99', margin: '0 0 8px' }}>{flow.description}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {flow.timing.map((t, i) => (
                          <span key={i} style={{ fontSize: 11, backgroundColor: '#ECEEF2', color: '#9C9B99', padding: '2px 8px', borderRadius: 20 }}>{i + 1}: {t}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {tab === 'messages' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {FLOWS.map((flow) => (
                    <div key={flow.id}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#9C9B99', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Zap style={{ width: 11, height: 11 }} />{flow.name}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {flow.templateIds.map((templateId, idx) => {
                          const template = TEMPLATE_REGISTRY.find((t) => t.id === templateId)
                          return (
                            <button key={templateId} onClick={() => selectMessage(flow, templateId, idx)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E4E9', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Mail style={{ width: 13, height: 13, color: '#9C9B99' }} />
                                <span style={{ fontSize: 13, color: '#1A1918' }}>{template?.name ?? templateId}</span>
                                <span style={{ fontSize: 12, color: '#9C9B99' }}>{flow.timing[idx]}</span>
                              </div>
                              <ChevronRight style={{ width: 13, height: 13, color: '#9C9B99' }} />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'confirm' && pendingItem && selectedProduct && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: '#f0fff0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  {pendingItem.type === 'flow' ? <Zap style={{ width: 24, height: 24, color: '#43ff47' }} /> : <Mail style={{ width: 24, height: 24, color: '#43ff47' }} />}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1A1918', margin: '0 0 4px' }}>{pendingItem.name}</h3>
                <p style={{ fontSize: 13, color: '#9C9B99', margin: 0 }}>for {selectedProduct.name}</p>
              </div>
              <div style={{ backgroundColor: '#ECEEF2', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['Product', selectedProduct.name], ['Templates', `${pendingItem.templateIds.length} email${pendingItem.templateIds.length !== 1 ? 's' : ''}`]].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#9C9B99' }}>{label}</span>
                    <span style={{ fontWeight: 500, color: '#1A1918' }}>{value}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleConfirm}
                style={{ width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 600, color: '#1A1918', backgroundColor: '#43ff47', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Check style={{ width: 15, height: 15 }} />
                Add to workspace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Klaviyo setup card (API key + resources combined) ────────────────────────

function KlaviyoSetupCard({
  brand, apiKeyInput, apiKeyVisible, saving,
  onInputChange, onToggleVisible, onSave,
  lists, forms, coupons, status,
  onCreateLists, onCreateForm, onCreateCoupon,
}: {
  brand: Brand
  apiKeyInput: string
  apiKeyVisible: boolean
  saving: boolean
  onInputChange: (v: string) => void
  onToggleVisible: () => void
  onSave: () => void
  lists: any[]
  forms: any[]
  coupons: any[]
  status: string | null
  onCreateLists: () => void
  onCreateForm: () => void
  onCreateCoupon: (code: string) => void
}) {
  const [couponCode, setCouponCode] = useState('WELCOME10')
  const hasKey = !!brand.klaviyo_api_key
  const changed = apiKeyInput !== (brand.klaviyo_api_key ?? '')

  const emailList = lists.find((l) => l.list_type === 'email')
  const smsList = lists.find((l) => l.list_type === 'sms')
  const hasLists = !!emailList && !!smsList
  const hasForm = forms.length > 0
  const hasCoupon = coupons.length > 0
  const doneCount = [hasLists, hasForm, hasCoupon].filter(Boolean).length

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* API key section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1918' }}>Klaviyo API key</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, backgroundColor: hasKey ? '#f0fff0' : '#fef3c7', color: hasKey ? '#166534' : '#92400e' }}>
            {hasKey ? 'Connected' : 'Not set'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Input type={apiKeyVisible ? 'text' : 'password'} value={apiKeyInput} onChange={(e) => onInputChange(e.target.value)} placeholder="pk_..." className="font-mono text-xs h-8" style={{ flex: 1 }} />
          <button onClick={onToggleVisible} style={{ fontSize: 12, border: '1px solid #E2E4E9', borderRadius: 6, padding: '0 10px', background: '#fff', cursor: 'pointer', flexShrink: 0, color: '#1A1918' }}>
            {apiKeyVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        {changed && (
          <button onClick={onSave} disabled={saving}
            style={{ width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 600, color: '#1A1918', backgroundColor: '#43ff47', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save key'}
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #E2E4E9' }} />

      {/* Resources section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1918' }}>Klaviyo resources</span>
          <span style={{ fontSize: 12, color: '#9C9B99' }}>{doneCount}/3 set up</span>
        </div>

        {status && <p style={{ fontSize: 12, color: '#9C9B99', display: 'flex', alignItems: 'center', gap: 5, margin: 0 }}><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />{status}</p>}

        {/* Lists */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: hasLists ? '#43ff47' : '#E2E4E9' }} />
            <span style={{ fontSize: 13, color: '#1A1918' }}>Lists (email + SMS)</span>
          </div>
          {hasLists ? (
            <div style={{ display: 'flex', gap: 4 }}>
              {[emailList, smsList].map((l) => l?.klaviyo_list_url ? (
                <a key={l.id} href={l.klaviyo_list_url} target="_blank" rel="noopener noreferrer" style={{ padding: '3px 6px', border: '1px solid #E2E4E9', borderRadius: 4, color: '#9C9B99', display: 'flex', alignItems: 'center' }}>
                  <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              ) : null)}
            </div>
          ) : (
            <button onClick={onCreateLists} disabled={!hasKey || !!status}
              style={{ fontSize: 12, border: '1px solid #E2E4E9', borderRadius: 6, padding: '3px 10px', background: '#fff', cursor: !hasKey || !!status ? 'not-allowed' : 'pointer', color: '#1A1918', opacity: !hasKey || !!status ? 0.4 : 1 }}>
              Create
            </button>
          )}
        </div>

        {/* Form */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: hasForm ? '#43ff47' : '#E2E4E9' }} />
            <span style={{ fontSize: 13, color: '#1A1918' }}>Signup form</span>
          </div>
          {hasForm ? (
            forms[0]?.klaviyo_form_url ? (
              <a href={forms[0].klaviyo_form_url} target="_blank" rel="noopener noreferrer" style={{ padding: '3px 6px', border: '1px solid #E2E4E9', borderRadius: 4, color: '#9C9B99', display: 'flex', alignItems: 'center' }}>
                <ExternalLink style={{ width: 11, height: 11 }} />
              </a>
            ) : null
          ) : (
            <button onClick={onCreateForm} disabled={!hasKey || !hasLists || !!status}
              style={{ fontSize: 12, border: '1px solid #E2E4E9', borderRadius: 6, padding: '3px 10px', background: '#fff', cursor: !hasKey || !hasLists || !!status ? 'not-allowed' : 'pointer', color: '#1A1918', opacity: !hasKey || !hasLists || !!status ? 0.4 : 1 }}>
              Create
            </button>
          )}
        </div>

        {/* Coupon */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: hasCoupon ? '#43ff47' : '#E2E4E9' }} />
            <span style={{ fontSize: 13, color: '#1A1918' }}>Welcome coupon</span>
          </div>
          {hasCoupon ? (
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#9C9B99' }}>{coupons[0]?.coupon_name}</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="h-7 font-mono text-xs" style={{ width: 90 }} placeholder="WELCOME10" />
              <button onClick={() => onCreateCoupon(couponCode)} disabled={!hasKey || !couponCode || !!status}
                style={{ fontSize: 12, border: '1px solid #E2E4E9', borderRadius: 6, padding: '3px 10px', background: '#fff', cursor: !hasKey || !couponCode || !!status ? 'not-allowed' : 'pointer', color: '#1A1918', opacity: !hasKey || !couponCode || !!status ? 0.4 : 1 }}>
                Create
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
