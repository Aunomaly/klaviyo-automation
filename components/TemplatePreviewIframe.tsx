'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Fetches processed HTML from /api/templates/preview and renders in an iframe (brand styling applied).
 */
export function TemplatePreviewIframe({
  brandId,
  templateId,
  productId,
  generatedSlots,
  className,
  style,
}: {
  brandId: string
  templateId: string
  productId?: string
  generatedSlots?: Record<string, string>
  className?: string
  style?: React.CSSProperties
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const slotsKey = generatedSlots ? JSON.stringify(generatedSlots) : ''

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ brandId, templateId })
    if (productId) params.set('productId', productId)
    if (generatedSlots) params.set('slots', JSON.stringify(generatedSlots))
    fetch(`/api/templates/preview?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setHtml(data.html)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, templateId, productId, slotsKey])

  if (loading) {
    return (
      <div
        className={className}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5',
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return (
      <div
        className={className}
        style={{
          ...style,
          padding: 16,
          background: '#fef2f2',
          color: '#b91c1c',
          fontSize: 14,
        }}
      >
        Failed to load preview: {error}
      </div>
    )
  }
  if (!html) return null

  return (
    <iframe
      title={`Preview: ${templateId}`}
      srcDoc={html}
      className={className}
      style={{ ...style, border: 'none' }}
      sandbox="allow-same-origin"
    />
  )
}
