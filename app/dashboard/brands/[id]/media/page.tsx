'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Download,
  Trash2,
  Upload,
  Sparkles,
  Check,
  X,
  Image as ImageIcon,
  Filter,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Brand, BrandImage } from '@/lib/supabase/types'

type FilterType = 'all' | 'scraped' | 'ai'

export default function MediaPage() {
  const params = useParams()
  const brandId = params.id as string

  const [brand, setBrand] = useState<Brand | null>(null)
  const [images, setImages] = useState<BrandImage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: b }, { data: imgs }] = await Promise.all([
      supabase.from('brands').select('*').eq('id', brandId).single(),
      supabase
        .from('brand_images')
        .select('*')
        .eq('brand_id', brandId)
        .order('display_order', { ascending: true }),
    ])
    if (b) setBrand(b)
    if (imgs) setImages(imgs)
    setLoading(false)
  }, [brandId])

  useEffect(() => { loadData() }, [loadData])

  const filtered = images.filter((img) => {
    if (filter === 'scraped') return !img.is_ai_generated
    if (filter === 'ai') return img.is_ai_generated
    return true
  })

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map((i) => i.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function deleteImage(id: string) {
    setDeleting((prev) => new Set(prev).add(id))
    const supabase = createClient()
    await supabase.from('brand_images').delete().eq('id', id)
    setImages((prev) => prev.filter((i) => i.id !== id))
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    setDeleting((prev) => { const next = new Set(prev); next.delete(id); return next })
  }

  async function deleteSelected() {
    const ids = Array.from(selected)
    ids.forEach((id) => setDeleting((prev) => new Set(prev).add(id)))
    const supabase = createClient()
    await supabase.from('brand_images').delete().in('id', ids)
    setImages((prev) => prev.filter((i) => !ids.includes(i.id)))
    setSelected(new Set())
    setDeleting(new Set())
  }

  function exportImage(url: string, name: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.target = '_blank'
    a.click()
  }

  async function exportSelected() {
    for (const id of selected) {
      const img = images.find((i) => i.id === id)
      if (!img) continue
      const url = img.klaviyo_image_url ?? img.original_url
      exportImage(url, `image-${id.slice(0, 8)}.jpg`)
      await new Promise((r) => setTimeout(r, 120))
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)

    const supabase = createClient()
    for (const file of files) {
      const objectUrl = URL.createObjectURL(file)
      const { data, error } = await supabase.from('brand_images').insert({
        brand_id: brandId,
        original_url: objectUrl,
        image_type: 'other',
        alt_text: file.name,
        is_ai_generated: false,
        display_order: images.length,
      }).select().single()
      if (!error && data) setImages((prev) => [...prev, data])
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <Loader2 style={{ width: 28, height: 28, color: '#9C9B99' }} className="animate-spin" />
      </div>
    )
  }

  if (!brand) return <div style={{ textAlign: 'center', padding: '64px 0', color: '#9C9B99', fontSize: 14 }}>Brand not found</div>

  const hasSelection = selected.size > 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href={`/dashboard/brands/${brandId}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#9C9B99', textDecoration: 'none', marginBottom: 16 }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          {brand.name}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1918', margin: 0 }}>Media</p>
            <p style={{ fontSize: 13, color: '#9C9B99', margin: '2px 0 0' }}>
              {images.length} image{images.length !== 1 ? 's' : ''} · scraped assets and AI-generated
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Upload */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 8, padding: '7px 14px', background: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.5 : 1 }}
            >
              {uploading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Upload style={{ width: 13, height: 13 }} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            {/* Image Studio link */}
            <Link
              href={`/dashboard/brands/${brandId}/studio`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1A1918', backgroundColor: '#43ff47', border: 'none', borderRadius: 8, padding: '7px 14px', textDecoration: 'none' }}
            >
              <Sparkles style={{ width: 13, height: 13 }} />
              Image Studio
            </Link>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter style={{ width: 13, height: 13, color: '#9C9B99' }} />
          {(['all', 'scraped', 'ai'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ fontSize: 12, fontWeight: 500, padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${filter === f ? '#1A1918' : '#E2E4E9'}`, backgroundColor: filter === f ? '#1A1918' : '#fff', color: filter === f ? '#fff' : '#9C9B99', cursor: 'pointer' }}
            >
              {f === 'all' ? 'All' : f === 'scraped' ? 'Scraped' : 'AI generated'}
            </button>
          ))}
        </div>

        {/* Selection actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasSelection ? (
            <>
              <span style={{ fontSize: 12, color: '#9C9B99' }}>{selected.size} selected</span>
              <button
                onClick={exportSelected}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#1A1918', border: '1px solid #E2E4E9', borderRadius: 7, padding: '5px 12px', background: '#fff', cursor: 'pointer' }}
              >
                <Download style={{ width: 12, height: 12 }} />
                Export
              </button>
              <button
                onClick={deleteSelected}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, padding: '5px 12px', background: '#fff', cursor: 'pointer' }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
                Delete
              </button>
              <button
                onClick={clearSelection}
                style={{ padding: 5, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9C9B99' }}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            </>
          ) : (
            filtered.length > 0 && (
              <button
                onClick={selectAll}
                style={{ fontSize: 12, color: '#9C9B99', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Select all
              </button>
            )
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ border: '2px dashed #E2E4E9', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, backgroundColor: '#ECEEF2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <ImageIcon style={{ width: 22, height: 22, color: '#9C9B99' }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1918', margin: '0 0 4px' }}>No images yet</p>
          <p style={{ fontSize: 13, color: '#9C9B99', margin: 0 }}>
            {filter === 'ai' ? 'Generate images in Image Studio.' : 'Scan the brand to pull in scraped assets, or upload your own.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {filtered.map((img) => {
            const isSelected = selected.has(img.id)
            const isDeleting = deleting.has(img.id)
            const url = img.klaviyo_image_url ?? img.original_url

            return (
              <div
                key={img.id}
                className="group"
                style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: `2px solid ${isSelected ? '#43ff47' : '#E2E4E9'}`, backgroundColor: '#ECEEF2', cursor: 'pointer', opacity: isDeleting ? 0.4 : 1, transition: 'border-color 0.1s, opacity 0.15s' }}
                onClick={() => toggleSelect(img.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={img.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

                {/* Selection checkmark */}
                <div style={{ position: 'absolute', top: 6, left: 6, width: 18, height: 18, borderRadius: '50%', backgroundColor: isSelected ? '#43ff47' : 'rgba(255,255,255,0.85)', border: `1.5px solid ${isSelected ? '#43ff47' : '#E2E4E9'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.1s' }}>
                  {isSelected && <Check style={{ width: 10, height: 10, color: '#1A1918' }} />}
                </div>

                {/* AI badge */}
                {img.is_ai_generated && (
                  <div style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Sparkles style={{ width: 9, height: 9, color: '#43ff47' }} />
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>AI</span>
                  </div>
                )}

                {/* Hover actions */}
                <div
                  className="opacity-0 group-hover:opacity-100"
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', transition: 'opacity 0.15s', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 6, gap: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => exportImage(url, `image-${img.id.slice(0, 8)}.jpg`)}
                    title="Export"
                    style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Download style={{ width: 12, height: 12, color: '#1A1918' }} />
                  </button>
                  <button
                    onClick={() => deleteImage(img.id)}
                    title="Delete"
                    style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 style={{ width: 12, height: 12, color: '#dc2626' }} />
                  </button>
                </div>

                {isDeleting && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)' }}>
                    <Loader2 style={{ width: 18, height: 18, color: '#9C9B99' }} className="animate-spin" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
