'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Download,
  BookmarkCheck,
  Check,
  Paperclip,
  Settings2,
  X,
  ChevronDown,
  ExternalLink,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Brand, BrandImage } from '@/lib/supabase/types'
import { ALL_MODELS } from '@/lib/image-providers'
import type { ModelDescriptor } from '@/lib/image-providers/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type AspectRatio = '1:1' | '16:9' | '4:3' | '3:4' | '9:16'
type ImageType = 'hero' | 'product' | 'lifestyle' | 'ad' | 'content'

interface GeneratedImage {
  dataUrl: string
  publicUrl: string | null
  savedImage: BrandImage | null
  prompt: string
  model: string
  aspectRatio: AspectRatio
}

const ASPECT_RATIOS: { value: AspectRatio; label: string; desc: string }[] = [
  { value: '16:9', label: '16:9', desc: 'Email hero, ads' },
  { value: '1:1',  label: '1:1',  desc: 'Square, social' },
  { value: '4:3',  label: '4:3',  desc: 'Feature tile' },
  { value: '3:4',  label: '3:4',  desc: 'Portrait' },
  { value: '9:16', label: '9:16', desc: 'Stories, mobile' },
]

const IMAGE_TYPES: { value: ImageType; label: string }[] = [
  { value: 'hero',      label: 'Hero' },
  { value: 'product',   label: 'Product' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'ad',        label: 'Ad static' },
  { value: 'content',   label: 'Content' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImageStudioPage() {
  const params = useParams()
  const brandId = params.id as string

  const [brand, setBrand] = useState<Brand | null>(null)
  const [brandImages, setBrandImages] = useState<BrandImage[]>([])
  const [loading, setLoading] = useState(true)

  // Generation state
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [imageType, setImageType] = useState<ImageType>('hero')
  const [selectedModel, setSelectedModel] = useState<ModelDescriptor>(ALL_MODELS[0])
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([])
  const [temperature, setTemperature] = useState(0.8)

  // Modal / dropdown state
  const [showRefModal, setShowRefModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)

  // Uploaded images (local, not yet in Supabase)
  const [uploadedImages, setUploadedImages] = useState<{ id: string; url: string; name: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Output state
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<GeneratedImage[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: b }, { data: imgs }] = await Promise.all([
      supabase.from('brands').select('*').eq('id', brandId).single(),
      supabase
        .from('brand_images')
        .select('*')
        .eq('brand_id', brandId)
        .eq('is_ai_generated', false)
        .order('display_order', { ascending: true })
        .limit(24),
    ])
    if (b) setBrand(b)
    if (imgs) setBrandImages(imgs)
    setLoading(false)
  }, [brandId])

  useEffect(() => { loadData() }, [loadData])

  function toggleRef(id: string) {
    const max = selectedModel.maxReferenceImages
    setSelectedRefIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= max) return prev
      return [...prev, id]
    })
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const url = ev.target?.result as string
        const id = `upload-${Date.now()}-${Math.random()}`
        setUploadedImages((prev) => [...prev, { id, url, name: file.name }])
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedModel.provider,
          model: selectedModel.id,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          aspectRatio,
          imageSize: selectedModel.supportedSizes.includes('1K') ? undefined : '1K',
          temperature,
          imageType,
          brandId,
          brandName: brand?.name,
          referenceImageIds: selectedRefIds.length > 0 ? selectedRefIds : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error ?? 'Generation failed'); return }

      const newResult: GeneratedImage = {
        dataUrl: data.dataUrl,
        publicUrl: data.publicUrl,
        savedImage: data.savedImage,
        prompt: prompt.trim(),
        model: data.model,
        aspectRatio,
      }

      setResults((prev) => [newResult, ...prev])
      if (data.savedImage?.id) {
        setSavedIds((prev) => { const next = new Set(prev); next.add(data.savedImage.id); return next })
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  function downloadImage(dataUrl: string, index: number) {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `generated-${index + 1}.png`
    a.click()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <Loader2 style={{ width: 28, height: 28, color: '#9C9B99' }} className="animate-spin" />
      </div>
    )
  }

  if (!brand) return <div style={{ textAlign: 'center', padding: '64px 0', color: '#9C9B99', fontSize: 14 }}>Brand not found</div>

  const allRefImages = [
    ...brandImages.map((img) => ({ id: img.id, url: img.klaviyo_image_url ?? img.original_url, label: img.alt_text ?? 'Brand asset', isUpload: false })),
    ...uploadedImages.map((img) => ({ id: img.id, url: img.url, label: img.name, isUpload: true })),
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href={`/dashboard/brands/${brandId}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#9C9B99', textDecoration: 'none', marginBottom: 16 }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          {brand.name}
        </Link>
        <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1918', margin: 0 }}>Image Studio</p>
        <p style={{ fontSize: 13, color: '#9C9B99', margin: '2px 0 0' }}>
          Generate images using {brand.name}&apos;s scraped assets as references
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>

        {/* ── Left: canvas / results ── */}
        <div>
          {results.length === 0 ? (
            <div style={{ border: '2px dashed #E2E4E9', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 24px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, backgroundColor: '#ECEEF2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <ImageIcon style={{ width: 24, height: 24, color: '#9C9B99' }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1918', margin: '0 0 4px' }}>No images yet</p>
              <p style={{ fontSize: 13, color: '#9C9B99', maxWidth: 280, lineHeight: 1.5, margin: 0 }}>
                Write a prompt, attach reference images, then hit Generate.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {results.map((img, i) => (
                <div key={i} className="group" style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E4E9', backgroundColor: '#ECEEF2' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.dataUrl} alt={img.prompt} style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
                  <div className="opacity-0 group-hover:opacity-100" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', transition: 'opacity 0.15s', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: 12 }}>
                    <button
                      onClick={() => downloadImage(img.dataUrl, i)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, backgroundColor: '#fff', color: '#1A1918', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
                    >
                      <Download style={{ width: 13, height: 13 }} />
                      Export
                    </button>
                    {img.savedImage?.id && savedIds.has(img.savedImage.id) && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, backgroundColor: '#43ff47', color: '#1A1918', fontWeight: 600, borderRadius: 8, padding: '5px 10px' }}>
                        <BookmarkCheck style={{ width: 12, height: 12 }} />
                        Saved
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #E2E4E9', backgroundColor: '#fff' }}>
                    <p style={{ fontSize: 12, color: '#1A1918', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{img.prompt}</p>
                    <p style={{ fontSize: 11, color: '#9C9B99', margin: '2px 0 0' }}>{img.aspectRatio} · {img.model.split('-').slice(0, 3).join('-')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: unified command bar ── */}
        <div>
          <div style={{ backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 14, overflow: 'visible' }}>

            {/* Prompt textarea */}
            <div style={{ padding: '14px 16px 10px' }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
                placeholder="A lifestyle photo of the product on a clean marble surface, soft natural light, editorial style…"
                rows={5}
                style={{ width: '100%', fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none', border: 'none', color: '#1A1918', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            {/* Reference image chips */}
            {selectedRefIds.length > 0 && (
              <div style={{ padding: '6px 12px', borderTop: '1px solid #F4F5F7', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedRefIds.map((id) => {
                  const img = allRefImages.find((r) => r.id === id)
                  if (!img) return null
                  return (
                    <div key={id} style={{ position: 'relative', width: 40, height: 40, borderRadius: 6, overflow: 'hidden', border: '1.5px solid #43ff47', flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => toggleRef(id)}
                        style={{ position: 'absolute', top: 1, right: 1, width: 14, height: 14, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      >
                        <X style={{ width: 8, height: 8, color: '#fff' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Bottom toolbar */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid #E2E4E9', display: 'flex', alignItems: 'center', gap: 8 }}>

              {/* Attachment button */}
              <button
                onClick={() => setShowRefModal(true)}
                title="Attach reference images"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E4E9', background: '#fff', cursor: 'pointer', color: selectedRefIds.length > 0 ? '#1A1918' : '#9C9B99', flexShrink: 0 }}
              >
                <Paperclip style={{ width: 14, height: 14 }} />
                {selectedRefIds.length > 0 && (
                  <span style={{ position: 'absolute', top: -5, right: -5, width: 15, height: 15, borderRadius: '50%', backgroundColor: '#43ff47', fontSize: 9, fontWeight: 700, color: '#1A1918', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    {selectedRefIds.length}
                  </span>
                )}
              </button>

              {/* Model pill */}
              <div style={{ position: 'relative', flex: 1 }}>
                <button
                  onClick={() => setShowModelDropdown((v) => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#1A1918', backgroundColor: '#ECEEF2', border: 'none', borderRadius: 20, padding: '5px 10px 5px 8px', cursor: 'pointer', maxWidth: '100%' }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#43ff47', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedModel.label}</span>
                  <ChevronDown style={{ width: 12, height: 12, color: '#9C9B99', flexShrink: 0 }} />
                </button>
                {showModelDropdown && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, backgroundColor: '#fff', border: '1px solid #E2E4E9', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 50, minWidth: 220, overflow: 'hidden' }}>
                    {ALL_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedModel(m); setSelectedRefIds((prev) => prev.slice(0, m.maxReferenceImages)); setShowModelDropdown(false) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #F4F5F7', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: selectedModel.id === m.id ? '#43ff47' : '#E2E4E9', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1918' }}>{m.label}</div>
                          <div style={{ fontSize: 11, color: '#9C9B99', fontFamily: 'monospace' }}>{m.id}</div>
                        </div>
                        {selectedModel.id === m.id && <Check style={{ width: 13, height: 13, color: '#1A1918', flexShrink: 0 }} />}
                      </button>
                    ))}
                    <a
                      href="https://ai.google.dev/gemini-api/docs/image-generation"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', fontSize: 11, color: '#9C9B99', textDecoration: 'none' }}
                    >
                      <ExternalLink style={{ width: 11, height: 11 }} />
                      API docs
                    </a>
                  </div>
                )}
              </div>

              {/* Settings button */}
              <button
                onClick={() => setShowSettingsModal(true)}
                title="Generation settings"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E4E9', background: '#fff', cursor: 'pointer', color: '#9C9B99', flexShrink: 0 }}
              >
                <Settings2 style={{ width: 14, height: 14 }} />
              </button>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                title="Generate (⌘↵)"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, backgroundColor: generating || !prompt.trim() ? '#ECEEF2' : '#43ff47', border: 'none', cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer', flexShrink: 0 }}
              >
                {generating
                  ? <Loader2 style={{ width: 14, height: 14, color: '#9C9B99' }} className="animate-spin" />
                  : <Sparkles style={{ width: 14, height: 14, color: generating || !prompt.trim() ? '#9C9B99' : '#1A1918' }} />}
              </button>
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{error}</p>}

          {results.some((r) => r.savedImage) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#166534', backgroundColor: '#f0fff0', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
              <BookmarkCheck style={{ width: 13, height: 13, flexShrink: 0 }} />
              Generated images are saved to this brand&apos;s asset library.
            </div>
          )}
        </div>
      </div>

      {/* ── Reference image modal ── */}
      {showRefModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRefModal(false) }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E2E4E9' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1918', margin: 0 }}>Reference images</p>
                <p style={{ fontSize: 12, color: '#9C9B99', margin: '2px 0 0' }}>
                  {selectedRefIds.length}/{selectedModel.maxReferenceImages} selected · max {selectedModel.maxReferenceImages} for {selectedModel.label}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 8, padding: '6px 12px', background: '#fff', cursor: 'pointer' }}
                >
                  <Upload style={{ width: 13, height: 13 }} />
                  Upload
                </button>
                <button onClick={() => setShowRefModal(false)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9C9B99' }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
              {allRefImages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#9C9B99' }}>
                  <ImageIcon style={{ width: 32, height: 32, margin: '0 auto 10px', opacity: 0.3 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No brand images yet.</p>
                  <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                    <Link href={`/dashboard/brands/${brandId}`} style={{ color: '#1A1918' }}>Scan the brand</Link> to pull in assets, or upload your own above.
                  </p>
                </div>
              ) : (
                <>
                  {uploadedImages.length > 0 && (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#9C9B99', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, marginTop: 0 }}>Uploaded</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
                        {uploadedImages.map((img) => {
                          const isSelected = selectedRefIds.includes(img.id)
                          const isDisabled = !isSelected && selectedRefIds.length >= selectedModel.maxReferenceImages
                          return (
                            <button
                              key={img.id}
                              onClick={() => !isDisabled && toggleRef(img.id)}
                              disabled={isDisabled}
                              style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: `2px solid ${isSelected ? '#43ff47' : '#E2E4E9'}`, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.4 : 1, background: 'none', padding: 0 }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              {isSelected && (
                                <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#43ff47', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Check style={{ width: 9, height: 9, color: '#1A1918' }} />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {brandImages.length > 0 && (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#9C9B99', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, marginTop: 0 }}>Brand assets</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        {brandImages.map((img) => {
                          const isSelected = selectedRefIds.includes(img.id)
                          const isDisabled = !isSelected && selectedRefIds.length >= selectedModel.maxReferenceImages
                          return (
                            <button
                              key={img.id}
                              onClick={() => !isDisabled && toggleRef(img.id)}
                              disabled={isDisabled}
                              style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: `2px solid ${isSelected ? '#43ff47' : '#E2E4E9'}`, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.4 : 1, background: 'none', padding: 0 }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.klaviyo_image_url ?? img.original_url} alt={img.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              {isSelected && (
                                <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#43ff47', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Check style={{ width: 9, height: 9, color: '#1A1918' }} />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E4E9', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRefModal(false)}
                style={{ fontSize: 13, fontWeight: 600, color: '#1A1918', backgroundColor: '#43ff47', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ── */}
      {showSettingsModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false) }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, overflow: 'hidden' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E2E4E9' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1918', margin: 0 }}>Generation settings</p>
              <button onClick={() => setShowSettingsModal(false)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9C9B99' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Aspect ratio */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1918', display: 'block', marginBottom: 10 }}>Aspect Ratio</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ASPECT_RATIOS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setAspectRatio(r.value)}
                      title={r.desc}
                      style={{ fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${aspectRatio === r.value ? '#1A1918' : '#E2E4E9'}`, backgroundColor: aspectRatio === r.value ? '#1A1918' : '#fff', color: aspectRatio === r.value ? '#fff' : '#1A1918', cursor: 'pointer' }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image type */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1918', display: 'block', marginBottom: 10 }}>Image Type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {IMAGE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setImageType(t.value)}
                      style={{ fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${imageType === t.value ? '#1A1918' : '#E2E4E9'}`, backgroundColor: imageType === t.value ? '#1A1918' : '#fff', color: imageType === t.value ? '#fff' : '#1A1918', cursor: 'pointer' }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Temperature */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1918' }}>Temperature</label>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#1A1918' }}>{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#43ff47' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9C9B99', marginTop: 4 }}>
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* Negative prompt */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1918', display: 'block', marginBottom: 8 }}>Negative prompt</label>
                <input
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="blurry, text, watermark…"
                  style={{ width: '100%', fontSize: 13, border: '1px solid #E2E4E9', borderRadius: 8, padding: '8px 12px', outline: 'none', color: '#1A1918', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E4E9', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{ fontSize: 13, fontWeight: 600, color: '#1A1918', backgroundColor: '#43ff47', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
