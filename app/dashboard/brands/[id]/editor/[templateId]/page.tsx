'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Wand2,
  ChevronDown,
  ChevronUp,
  Layers,
  Type,
  Palette,
  Monitor,
  Smartphone,
  PanelRightClose,
  PanelRightOpen,
  Link as LinkIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { TEMPLATE_REGISTRY } from '@/lib/templates/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'image'
  multiline?: boolean
}

interface SlotStyle {
  fontFamily: string
  fontSize: string
}

interface EditorState {
  slots: Record<string, string>
  colors: { primaryColor: string; secondaryColor: string; accentColor: string }
  fonts: { fontPrimary: string; fontSecondary: string }
  // Per-slot typography overrides
  slotStyles: Record<string, SlotStyle>
  subjectLine: string
  preheader: string
  // Link overrides
  productUrl: string
  brandUrl: string
  // Section spacing multiplier: 0.5 = tighter, 1 = default, 1.5 = looser
  sectionSpacing: number
}

type PreviewMode = 'desktop' | 'mobile'
type ActivePanel = 'text' | 'images' | 'style' | 'links'

// ─── Slot definitions per template ───────────────────────────────────────────

const TEMPLATE_SLOTS: Record<string, SlotDef[]> = {
  welcome_1: [
    { key: 'hero_headline', label: 'Hero Headline', type: 'text' },
    { key: 'hero_body', label: 'Hero Body', type: 'textarea', multiline: true },
    { key: 'cta_button', label: 'CTA Button 1', type: 'text' },
    { key: 'feature_1_title', label: 'Feature 1 Title', type: 'text' },
    { key: 'feature_1_body', label: 'Feature 1 Body', type: 'textarea', multiline: true },
    { key: 'feature_2_title', label: 'Feature 2 Title', type: 'text' },
    { key: 'feature_2_body', label: 'Feature 2 Body', type: 'textarea', multiline: true },
    { key: 'feature_3_title', label: 'Feature 3 Title', type: 'text' },
    { key: 'feature_3_body', label: 'Feature 3 Body', type: 'textarea', multiline: true },
    { key: 'closing_copy', label: 'Closing Copy', type: 'textarea', multiline: true },
    { key: 'cta_button_2', label: 'CTA Button 2', type: 'text' },
    { key: 'img_hero', label: 'Hero Image', type: 'image' },
    { key: 'img_feature_1', label: 'Feature 1 Image', type: 'image' },
    { key: 'img_feature_2', label: 'Feature 2 Image', type: 'image' },
    { key: 'img_feature_3', label: 'Feature 3 Image', type: 'image' },
  ],
  welcome_2: [
    { key: 'hero_headline', label: 'Hero Headline', type: 'text' },
    { key: 'hero_subheadline', label: 'Hero Subheadline', type: 'text' },
    { key: 'hero_body', label: 'Hero Body', type: 'textarea', multiline: true },
    { key: 'cta_button', label: 'CTA Button', type: 'text' },
    { key: 'testimonial_1', label: 'Testimonial 1', type: 'textarea', multiline: true },
    { key: 'testimonial_1_author', label: 'Testimonial 1 Author', type: 'text' },
    { key: 'testimonial_2', label: 'Testimonial 2', type: 'textarea', multiline: true },
    { key: 'testimonial_2_author', label: 'Testimonial 2 Author', type: 'text' },
    { key: 'img_hero', label: 'Hero Image', type: 'image' },
  ],
  welcome_3: [
    { key: 'urgency_headline', label: 'Urgency Headline', type: 'textarea', multiline: true },
    { key: 'urgency_subheadline', label: 'Urgency Subheadline', type: 'text' },
    { key: 'hero_headline', label: 'Section Headline', type: 'text' },
    { key: 'body_copy', label: 'Body Copy', type: 'textarea', multiline: true },
    { key: 'cta_button', label: 'CTA Button 1', type: 'text' },
    { key: 'cta_button_2', label: 'CTA Button 2', type: 'text' },
  ],
  abandoned_cart_1: [
    { key: 'hero_headline', label: 'Headline', type: 'text' },
    { key: 'body_copy', label: 'Body Copy', type: 'textarea', multiline: true },
    { key: 'cta_button', label: 'CTA Button 1', type: 'text' },
    { key: 'cta_button_2', label: 'CTA Button 2', type: 'text' },
  ],
  abandoned_cart_2: [
    { key: 'hero_headline', label: 'Headline', type: 'text' },
    { key: 'urgency_body', label: 'Urgency Copy', type: 'textarea', multiline: true },
    { key: 'cta_button', label: 'CTA Button 1', type: 'text' },
    { key: 'cta_button_2', label: 'CTA Button 2', type: 'text' },
  ],
  abandoned_cart_3: [
    { key: 'hero_headline', label: 'Headline', type: 'text' },
    { key: 'hero_subheadline', label: 'Subheadline', type: 'text' },
    { key: 'cta_button', label: 'CTA Button 1', type: 'text' },
    { key: 'cta_button_2', label: 'CTA Button 2', type: 'text' },
  ],
  browse_abandonment_1: [
    { key: 'cta_button', label: 'CTA Button', type: 'text' },
  ],
  browse_abandonment_2: [
    { key: 'hero_headline', label: 'Headline', type: 'text' },
    { key: 'cta_button', label: 'CTA Button', type: 'text' },
  ],
  winback_1: [
    { key: 'winback_eyebrow', label: 'Eyebrow Text', type: 'text' },
    { key: 'winback_headline', label: 'Main Headline', type: 'text' },
    { key: 'winback_body_1', label: 'Body Copy', type: 'textarea', multiline: true },
    { key: 'cta_button', label: 'CTA Button', type: 'text' },
    { key: 'img_hero', label: 'Hero Image', type: 'image' },
  ],
  winback_2: [
    { key: 'cta_button', label: 'CTA Button', type: 'text' },
  ],
}

// Web-safe + Google Fonts (loaded via @import in the preview)
const FONT_OPTIONS = [
  // Web-safe
  'Helvetica, Arial, sans-serif',
  'Arial, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Verdana, sans-serif',
  'Trebuchet MS, sans-serif',
  'Courier New, monospace',
  // Google Fonts
  'Montserrat, sans-serif',
  'Playfair Display, serif',
  'Lato, sans-serif',
  'Raleway, sans-serif',
  'Oswald, sans-serif',
  'Merriweather, serif',
  'Poppins, sans-serif',
  'Inter, sans-serif',
  'Open Sans, sans-serif',
  'Roboto, sans-serif',
  'Nunito, sans-serif',
  'Source Sans 3, sans-serif',
  'Work Sans, sans-serif',
  'DM Sans, sans-serif',
  'Barlow, sans-serif',
  'Outfit, sans-serif',
  'Plus Jakarta Sans, sans-serif',
  'Manrope, sans-serif',
  'Sora, sans-serif',
  'Lexend, sans-serif',
  'Figtree, sans-serif',
  'Space Grotesk, sans-serif',
  'Rubik, sans-serif',
  'Quicksand, sans-serif',
  'Cormorant Garamond, serif',
  'Libre Baskerville, serif',
  'DM Serif Display, serif',
  'Bebas Neue, sans-serif',
]

// ─── Main editor page ─────────────────────────────────────────────────────────

// ─── ScaledEmailPreview ───────────────────────────────────────────────────────
// Renders the email iframe at its native width, then scales it down via CSS
// transform so it always fits the available container width without clipping.

function ScaledEmailPreview({
  html,
  mode,
  desktopWidth,
  mobileWidth,
  containerRef,
}: {
  html: string
  mode: 'desktop' | 'mobile'
  desktopWidth: number
  mobileWidth: number
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const nativeWidth = mode === 'desktop' ? desktopWidth : mobileWidth
  const [scale, setScale] = useState(1)
  const iframeHeight = 900

  useEffect(() => {
    function measure() {
      if (!containerRef.current) return
      const available = containerRef.current.clientWidth - 32 // 16px padding each side
      const next = Math.min(1, available / nativeWidth)
      setScale(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [containerRef, nativeWidth])

  return (
    <div style={{ width: nativeWidth * scale, flexShrink: 0 }}>
      {mode === 'mobile' && (
        <div className="bg-gray-800 rounded-t-2xl px-4 py-2 flex items-center justify-center">
          <div className="w-20 h-1.5 bg-gray-600 rounded-full" />
        </div>
      )}
      <div
        className={`shadow-lg overflow-hidden ${mode === 'mobile' ? 'rounded-b-2xl' : 'rounded-lg'}`}
        style={{ height: iframeHeight * scale }}
      >
        <iframe
          key={mode}
          title="Email Preview"
          srcDoc={html}
          style={{
            width: nativeWidth,
            height: iframeHeight,
            border: 'none',
            display: 'block',
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
          }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const brandId = params.id as string
  const templateId = params.templateId as string
  const productId = searchParams.get('productId') ?? undefined

  const [brand, setBrand] = useState<Record<string, string> | null>(null)
  const [product, setProduct] = useState<Record<string, string> | null>(null)
  const [loading, setLoading] = useState(true)

  const [state, setState] = useState<EditorState>({
    slots: {},
    colors: { primaryColor: '#000000', secondaryColor: '#ffffff', accentColor: '#000000' },
    fonts: { fontPrimary: 'Helvetica, Arial, sans-serif', fontSecondary: 'Georgia, serif' },
    slotStyles: {},
    subjectLine: '',
    preheader: '',
    productUrl: '',
    brandUrl: '',
    sectionSpacing: 1,
  })

  const [generatingAll, setGeneratingAll] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [regeneratingSlot, setRegeneratingSlot] = useState<string | null>(null)

  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop')
  const [panelOpen, setPanelOpen] = useState(true)

  const [activePanel, setActivePanel] = useState<ActivePanel>('text')

  const template = TEMPLATE_REGISTRY.find((t) => t.id === templateId)
  const slots = TEMPLATE_SLOTS[templateId] ?? []
  const textSlots = slots.filter((s) => s.type !== 'image')
  const imageSlots = slots.filter((s) => s.type === 'image')

  // ── Load brand + product ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from('brands').select('*').eq('id', brandId).single(),
        productId
          ? supabase.from('products').select('*').eq('id', productId).single()
          : Promise.resolve({ data: null }),
      ])
      if (b) setBrand(b)
      if (p) setProduct(p)
      // Single setState so brand/product data never races against the slots
      // useEffect and overwrites already-loaded slot values.
      setState((prev) => ({
        ...prev,
        ...(b ? {
          colors: {
            primaryColor: b.primary_color ?? '#000000',
            secondaryColor: b.secondary_color ?? '#ffffff',
            accentColor: b.accent_color ?? '#000000',
          },
          fonts: {
            fontPrimary: b.font_primary ?? 'Helvetica, Arial, sans-serif',
            fontSecondary: b.font_secondary ?? 'Georgia, serif',
          },
          brandUrl: b.website_url ?? '',
        } : {}),
        ...(p ? { productUrl: p.product_url ?? '' } : {}),
      }))
      setLoading(false)
    }
    load()
  }, [brandId, productId])

  // ── Load initial slots from URL param ────────────────────────────────────
  // URLSearchParams.get() already decodes percent-encoding — do NOT call
  // decodeURIComponent again or it will double-decode and corrupt the JSON.
  useEffect(() => {
    const slotsParam = searchParams.get('slots')
    const subjectParam = searchParams.get('subject')
    const preheaderParam = searchParams.get('preheader')

    const parsedSlots: Record<string, string> | null = (() => {
      if (!slotsParam) return null
      try { return JSON.parse(slotsParam) } catch { return null }
    })()

    if (parsedSlots || subjectParam || preheaderParam) {
      setState((prev) => ({
        ...prev,
        ...(parsedSlots ? { slots: parsedSlots } : {}),
        ...(subjectParam ? { subjectLine: subjectParam } : {}),
        ...(preheaderParam ? { preheader: preheaderParam } : {}),
      }))
    }
  }, [searchParams])

  // ── Fetch preview whenever state changes ──────────────────────────────────
  const fetchPreview = useCallback(async () => {
    if (!brand) return
    setPreviewLoading(true)
    try {
      const allSlots = {
        ...state.slots,
        ...(state.subjectLine ? { subject_line: state.subjectLine } : {}),
        ...(state.preheader ? { preheader: state.preheader } : {}),
      }
      const qp = new URLSearchParams({
        brandId,
        templateId,
        ...(productId ? { productId } : {}),
        slots: JSON.stringify(allSlots),
        primaryColor: state.colors.primaryColor,
        secondaryColor: state.colors.secondaryColor,
        accentColor: state.colors.accentColor,
        fontPrimary: state.fonts.fontPrimary,
        fontSecondary: state.fonts.fontSecondary,
        ...(Object.keys(state.slotStyles).length > 0 ? { slotStyles: JSON.stringify(state.slotStyles) } : {}),
        ...(state.productUrl ? { productUrlOverride: state.productUrl } : {}),
        ...(state.brandUrl ? { brandUrlOverride: state.brandUrl } : {}),
        ...(state.sectionSpacing !== 1 ? { sectionSpacing: String(state.sectionSpacing) } : {}),
      })
      const res = await fetch(`/api/templates/preview?${qp.toString()}`)
      const data = await res.json()
      if (data.html) setPreviewHtml(data.html)
    } catch { /* ignore */ } finally {
      setPreviewLoading(false)
    }
  }, [brand, brandId, templateId, productId, state])

  // Debounce preview refresh
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchPreview, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fetchPreview])

  // ── Generate all slots via Claude ─────────────────────────────────────────
  async function handleGenerateAll() {
    if (!brand || !product) return
    setGeneratingAll(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          brand: { name: brand.name, primaryColor: state.colors.primaryColor, tagline: brand.tagline ?? undefined },
          product: { name: product.name, description: product.description ?? undefined, price: product.price ?? undefined, productUrl: product.product_url },
        }),
      })
      const data = await res.json()
      if (data.success && data.slots) {
        setState((prev) => ({
          ...prev,
          slots: { ...prev.slots, ...data.slots },
          subjectLine: data.slots.subject_line ?? prev.subjectLine,
          preheader: data.slots.preheader ?? prev.preheader,
        }))
      } else {
        setGenerateError(data.error ?? 'Generation failed')
      }
    } catch (e) {
      setGenerateError(String(e))
    } finally {
      setGeneratingAll(false)
    }
  }

  // ── Regenerate a single slot ───────────────────────────────────────────────
  async function handleRegenerateSlot(slotKey: string) {
    if (!brand || !product) return
    setRegeneratingSlot(slotKey)
    try {
      const res = await fetch('/api/templates/generate/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId, slotKey,
          brand: { name: brand.name, primaryColor: state.colors.primaryColor, tagline: brand.tagline ?? undefined },
          product: { name: product.name, description: product.description ?? undefined, price: product.price ?? undefined, productUrl: product.product_url },
          currentSlots: state.slots,
        }),
      })
      const data = await res.json()
      if (data.success && data.value) {
        setState((prev) => ({ ...prev, slots: { ...prev.slots, [slotKey]: data.value } }))
      }
    } catch { /* ignore */ } finally {
      setRegeneratingSlot(null)
    }
  }

  function updateSlot(key: string, value: string) {
    setState((prev) => ({ ...prev, slots: { ...prev.slots, [key]: value } }))
  }

  function updateSlotStyle(key: string, field: keyof SlotStyle, value: string) {
    setState((prev) => ({
      ...prev,
      slotStyles: {
        ...prev.slotStyles,
        [key]: { ...{ fontFamily: '', fontSize: '' }, ...prev.slotStyles[key], [field]: value },
      },
    }))
  }

  function handleSaveBack() {
    const key = `editor_slots_${templateId}_${productId ?? 'none'}`
    localStorage.setItem(key, JSON.stringify({
      slots: state.slots,
      subjectLine: state.subjectLine,
      preheader: state.preheader,
      colors: state.colors,
      fonts: state.fonts,
      slotStyles: state.slotStyles,
      productUrl: state.productUrl,
      brandUrl: state.brandUrl,
      sectionSpacing: state.sectionSpacing,
    }))
    router.back()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!brand) return <div className="text-center py-16">Brand not found</div>

  // Preview iframe dimensions — desktop matches the 600px email table width
  const desktopWidth = 600
  const mobileWidth = 390

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b flex-shrink-0 gap-4">

        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{template?.name ?? templateId}</div>
            {product && (
              <div className="text-xs text-muted-foreground truncate">{brand.name} · {product.name}</div>
            )}
          </div>
        </div>

        {/* Center: viewport toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setPreviewMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              previewMode === 'desktop' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            onClick={() => setPreviewMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              previewMode === 'mobile' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!product && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No product selected
            </p>
          )}
          <button
            onClick={handleGenerateAll}
            disabled={generatingAll || !product}
            className="flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generatingAll ? 'Generating…' : 'Generate All'}
          </button>
          <button
            onClick={handleSaveBack}
            className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:opacity-90 transition"
          >
            <Check className="h-3.5 w-3.5" />
            Save & Back
          </button>
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition ml-1"
            title={panelOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {generateError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-600 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {generateError}
        </div>
      )}

      {/* ── Main split layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: live preview ── */}
        <div className="flex-1 overflow-auto bg-gray-100 flex flex-col items-center py-8 px-4 relative" ref={previewContainerRef}>
          {previewLoading && (
            <div className="absolute top-4 right-4 z-10">
              <div className="bg-white border rounded-full p-1.5 shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Device frame — scaled to fit available width */}
          {previewHtml ? (
            <ScaledEmailPreview
              html={previewHtml}
              mode={previewMode}
              desktopWidth={desktopWidth}
              mobileWidth={mobileWidth}
              containerRef={previewContainerRef}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading preview…
            </div>
          )}
        </div>

        {/* ── Right: editor panel (collapsible) ── */}
        {panelOpen && (
          <div className="w-[360px] flex-shrink-0 bg-white border-l flex flex-col overflow-hidden">

            {/* Panel tabs */}
            <div className="flex border-b flex-shrink-0">
              {([
                { id: 'text' as const, label: 'Copy', icon: Type },
                { id: 'images' as const, label: 'Images', icon: Layers },
                { id: 'style' as const, label: 'Style', icon: Palette },
                { id: 'links' as const, label: 'Links', icon: LinkIcon },
              ] as { id: ActivePanel; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActivePanel(id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium border-b-2 transition ${
                    activePanel === id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* ── Copy panel ── */}
              {activePanel === 'text' && (
                <div className="p-4 space-y-4">
                  <div className="space-y-3 pb-4 border-b">
                    <SectionLabel>Email metadata</SectionLabel>
                    <SlotField
                      label="Subject Line"
                      value={state.subjectLine}
                      onChange={(v) => setState((prev) => ({ ...prev, subjectLine: v }))}
                      onRegenerate={product ? () => handleRegenerateSlot('subject_line') : undefined}
                      regenerating={regeneratingSlot === 'subject_line'}
                    />
                    <SlotField
                      label="Preheader"
                      value={state.preheader}
                      onChange={(v) => setState((prev) => ({ ...prev, preheader: v }))}
                      onRegenerate={product ? () => handleRegenerateSlot('preheader') : undefined}
                      regenerating={regeneratingSlot === 'preheader'}
                    />
                  </div>
                  <div className="space-y-3">
                    <SectionLabel>Email copy</SectionLabel>
                    {textSlots.length === 0 && (
                      <p className="text-sm text-muted-foreground">No editable text slots for this template.</p>
                    )}
                    {textSlots.map((slot) => (
                      <SlotField
                        key={slot.key}
                        label={slot.label}
                        value={state.slots[slot.key] ?? ''}
                        onChange={(v) => updateSlot(slot.key, v)}
                        onRegenerate={product ? () => handleRegenerateSlot(slot.key) : undefined}
                        regenerating={regeneratingSlot === slot.key}
                        multiline={slot.multiline}
                        slotStyle={state.slotStyles[slot.key]}
                        onStyleChange={(field, val) => updateSlotStyle(slot.key, field, val)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Images panel ── */}
              {activePanel === 'images' && (
                <div className="p-4 space-y-4">
                  <SectionLabel>Image slots</SectionLabel>
                  {imageSlots.length === 0 && (
                    <p className="text-sm text-muted-foreground">No image slots for this template.</p>
                  )}
                  {imageSlots.map((slot) => (
                    <ImageSlotField
                      key={slot.key}
                      slotKey={slot.key}
                      label={slot.label}
                      currentUrl={state.slots[slot.key] ?? ''}
                      productImageUrl={product?.primary_image_url ?? undefined}
                      productName={product?.name ?? ''}
                      brandName={brand.name}
                      onUrlChange={(url) => updateSlot(slot.key, url)}
                    />
                  ))}
                </div>
              )}

              {/* ── Style panel (colors + fonts) ── */}
              {activePanel === 'style' && (
                <div className="p-4 space-y-5">
                  <p className="text-xs text-muted-foreground">
                    Overrides apply to this email only — won&apos;t change the brand record.
                  </p>

                  {/* Colors */}
                  <div className="space-y-3">
                    <SectionLabel>Colors</SectionLabel>
                    {([
                      { key: 'primaryColor' as const, label: 'Primary (buttons, accents)' },
                      { key: 'secondaryColor' as const, label: 'Secondary (backgrounds)' },
                      { key: 'accentColor' as const, label: 'Accent' },
                    ]).map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700">{field.label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={state.colors[field.key]}
                            onChange={(e) => setState((prev) => ({
                              ...prev,
                              colors: { ...prev.colors, [field.key]: e.target.value },
                            }))}
                            className="w-9 h-8 rounded border cursor-pointer p-0.5 flex-shrink-0"
                          />
                          <Input
                            value={state.colors[field.key]}
                            onChange={(e) => setState((prev) => ({
                              ...prev,
                              colors: { ...prev.colors, [field.key]: e.target.value },
                            }))}
                            className="font-mono text-sm h-8"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Section Spacing */}
                  <div className="space-y-3 border-t pt-4">
                    <SectionLabel>Section spacing</SectionLabel>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Tighter</span>
                        <span className="text-xs font-medium tabular-nums">
                          {state.sectionSpacing === 1 ? 'Default' : state.sectionSpacing < 1 ? `${Math.round((1 - state.sectionSpacing) * 100)}% tighter` : `${Math.round((state.sectionSpacing - 1) * 100)}% looser`}
                        </span>
                        <span className="text-xs text-muted-foreground">Looser</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={state.sectionSpacing}
                        onChange={(e) => setState((prev) => ({ ...prev, sectionSpacing: parseFloat(e.target.value) }))}
                        className="w-full accent-primary"
                      />
                      {state.sectionSpacing !== 1 && (
                        <button
                          onClick={() => setState((prev) => ({ ...prev, sectionSpacing: 1 }))}
                          className="text-[10px] text-gray-400 hover:text-red-500 transition"
                        >
                          Reset to default
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fonts */}
                  <div className="space-y-3 border-t pt-4">
                    <SectionLabel>Fonts</SectionLabel>
                    {([
                      { key: 'fontPrimary' as const, label: 'Primary font (body, buttons)' },
                      { key: 'fontSecondary' as const, label: 'Secondary font (headings)' },
                    ]).map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700">{field.label}</label>
                        <select
                          value={state.fonts[field.key]}
                          onChange={(e) => setState((prev) => ({
                            ...prev,
                            fonts: { ...prev.fonts, [field.key]: e.target.value },
                          }))}
                          className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                        >
                          {FONT_OPTIONS.map((f) => (
                            <option key={f} value={f} style={{ fontFamily: f.split(',')[0] }}>
                              {f.split(',')[0]}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground" style={{ fontFamily: state.fonts[field.key] }}>
                          The quick brown fox — {state.fonts[field.key].split(',')[0]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Links panel ── */}
              {activePanel === 'links' && (
                <div className="p-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    These override the destination URLs for all buttons and linked images in this email.
                  </p>

                  <div className="space-y-3">
                    <SectionLabel>Product link</SectionLabel>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Applied to all CTA buttons and product image links.
                    </p>
                    <Input
                      value={state.productUrl}
                      onChange={(e) => setState((prev) => ({ ...prev, productUrl: e.target.value }))}
                      placeholder="https://store.com/products/your-product"
                      className="text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <SectionLabel>Brand homepage</SectionLabel>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Applied to the logo link and any brand-level links.
                    </p>
                    <Input
                      value={state.brandUrl}
                      onChange={(e) => setState((prev) => ({ ...prev, brandUrl: e.target.value }))}
                      placeholder="https://store.com"
                      className="text-sm font-mono"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <SectionLabel>About links in this template</SectionLabel>
                    <p className="text-xs text-muted-foreground mt-1">
                      Abandoned cart and browse abandonment emails use Klaviyo dynamic variables
                      (<code className="bg-gray-100 px-1 rounded">{'{{ event.extra.checkout_url }}'}</code>) for their
                      buttons — those are populated by Klaviyo at send time and can&apos;t be overridden here.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</p>
  )
}

// ─── SlotField ────────────────────────────────────────────────────────────────

const SLOT_FONT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Playfair Display', value: 'Playfair Display, serif' },
  { label: 'Lato', value: 'Lato, sans-serif' },
  { label: 'Raleway', value: 'Raleway, sans-serif' },
  { label: 'Oswald', value: 'Oswald, sans-serif' },
  { label: 'Merriweather', value: 'Merriweather, serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Open Sans', value: 'Open Sans, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Nunito', value: 'Nunito, sans-serif' },
  { label: 'Source Sans 3', value: 'Source Sans 3, sans-serif' },
  { label: 'Work Sans', value: 'Work Sans, sans-serif' },
  { label: 'DM Sans', value: 'DM Sans, sans-serif' },
  { label: 'Barlow', value: 'Barlow, sans-serif' },
  { label: 'Outfit', value: 'Outfit, sans-serif' },
  { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans, sans-serif' },
  { label: 'Manrope', value: 'Manrope, sans-serif' },
  { label: 'Sora', value: 'Sora, sans-serif' },
  { label: 'Lexend', value: 'Lexend, sans-serif' },
  { label: 'Figtree', value: 'Figtree, sans-serif' },
  { label: 'Space Grotesk', value: 'Space Grotesk, sans-serif' },
  { label: 'Rubik', value: 'Rubik, sans-serif' },
  { label: 'Quicksand', value: 'Quicksand, sans-serif' },
  { label: 'Cormorant Garamond', value: 'Cormorant Garamond, serif' },
  { label: 'Libre Baskerville', value: 'Libre Baskerville, serif' },
  { label: 'DM Serif Display', value: 'DM Serif Display, serif' },
  { label: 'Bebas Neue', value: 'Bebas Neue, sans-serif' },
]

const SLOT_SIZE_OPTIONS = [
  { label: 'Default', value: '' },
  '10px', '11px', '12px', '13px', '14px', '15px', '16px', '18px',
  '20px', '22px', '24px', '26px', '28px', '30px', '32px', '36px',
  '40px', '48px',
]

function SlotField({
  label,
  value,
  onChange,
  onRegenerate,
  regenerating,
  multiline,
  slotStyle,
  onStyleChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onRegenerate?: () => void
  regenerating?: boolean
  multiline?: boolean
  slotStyle?: { fontFamily: string; fontSize: string }
  onStyleChange?: (field: 'fontFamily' | 'fontSize', val: string) => void
}) {
  const [typographyOpen, setTypographyOpen] = useState(false)
  const hasOverride = !!(slotStyle?.fontFamily || slotStyle?.fontSize)

  return (
    <div className="space-y-1 border rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 pt-2.5">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-1.5">
          {onStyleChange && (
            <button
              onClick={() => setTypographyOpen((v) => !v)}
              className={`flex items-center gap-1 text-xs transition px-1.5 py-0.5 rounded ${
                hasOverride
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Typography"
            >
              <Type className="h-3 w-3" />
              {hasOverride && <span className="font-medium">Aa</span>}
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="text-gray-400 hover:text-purple-600 transition disabled:opacity-50"
              title="Regenerate with AI"
            >
              {regenerating
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Typography controls (collapsible) */}
      {typographyOpen && onStyleChange && (
        <div className="mx-3 mb-2 p-2.5 bg-gray-50 rounded-md border space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Font</p>
              <select
                value={slotStyle?.fontFamily ?? ''}
                onChange={(e) => onStyleChange('fontFamily', e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {SLOT_FONT_OPTIONS.map((opt) => (
                  typeof opt === 'string'
                    ? <option key={opt} value={opt}>{opt}</option>
                    : <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-24 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Size</p>
              <select
                value={slotStyle?.fontSize ?? ''}
                onChange={(e) => onStyleChange('fontSize', e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {SLOT_SIZE_OPTIONS.map((opt) => (
                  typeof opt === 'string'
                    ? <option key={opt} value={opt}>{opt}</option>
                    : <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          {hasOverride && (
            <button
              onClick={() => { onStyleChange('fontFamily', ''); onStyleChange('fontSize', '') }}
              className="text-[10px] text-gray-400 hover:text-red-500 transition"
            >
              Reset to default
            </button>
          )}
        </div>
      )}

      {/* Text input */}
      <div className="px-3 pb-2.5">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full text-sm border rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 font-sans"
            placeholder={`Enter ${label.toLowerCase()}…`}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm h-8"
            placeholder={`Enter ${label.toLowerCase()}…`}
          />
        )}
      </div>
    </div>
  )
}

// ─── ImageSlotField ───────────────────────────────────────────────────────────

function ImageSlotField({
  slotKey,
  label,
  currentUrl,
  productImageUrl,
  productName,
  brandName,
  onUrlChange,
}: {
  slotKey: string
  label: string
  currentUrl: string
  productImageUrl?: string
  productName: string
  brandName: string
  onUrlChange: (url: string) => void
}) {
  const [mode, setMode] = useState<'style_transfer' | 'composite'>('style_transfer')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)

  const displayUrl = currentUrl || productImageUrl

  async function handleGenerate() {
    if (!productImageUrl) { setError('No product image available'); return }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, productImageUrl, prompt: prompt.trim() || undefined, slotContext: slotKey, brandName, productName }),
      })
      const data = await res.json()
      if (data.success && data.dataUrl) {
        onUrlChange(data.dataUrl)
      } else {
        setError(data.error ?? 'Generation failed')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="relative bg-gray-50 aspect-video flex items-center justify-center">
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-30" />
            <span className="text-xs">No image</span>
          </div>
        )}
        {generating && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-1 text-purple-600" />
              <p className="text-xs text-purple-700 font-medium">Generating…</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
          >
            <Wand2 className="h-3 w-3" />
            Generate
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {expanded && (
          <div className="space-y-2.5">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['style_transfer', 'composite'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
                    mode === m ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'style_transfer' ? 'Style Transfer' : 'Composite'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === 'style_transfer'
                ? 'Reinterpret the product in a lifestyle/editorial style.'
                : 'Place the product into a new scene or background.'}
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder={mode === 'style_transfer' ? 'e.g. "clean white studio, soft shadows"' : 'e.g. "outdoor summer market, golden hour"'}
              className="w-full text-xs border rounded-md px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handleGenerate}
              disabled={generating || !productImageUrl}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg py-2 hover:opacity-90 transition disabled:opacity-40"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {generating ? 'Generating…' : 'Generate Image'}
            </button>
            {!productImageUrl && (
              <p className="text-xs text-amber-600">No product image. Scan the store first.</p>
            )}
            <div className="border-t pt-2.5">
              <p className="text-xs text-muted-foreground mb-1.5">Or paste a URL directly:</p>
              <div className="flex gap-1.5">
                <Input ref={urlInputRef} placeholder="https://…" className="text-xs h-7" />
                <Button
                  size="sm" variant="outline" className="h-7 px-2 flex-shrink-0"
                  onClick={() => { if (urlInputRef.current?.value) onUrlChange(urlInputRef.current.value) }}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
