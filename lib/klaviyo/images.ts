/**
 * Klaviyo Images API
 * 
 * Upload and manage images in Klaviyo's image library
 */

import { klaviyoRequest } from './client'

const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api'
const KLAVIYO_API_VERSION = '2024-02-15'

interface KlaviyoImageAttributes {
  name: string
  image_url: string
  format: string
  size: number
  hidden: boolean
  updated_at: string
}

interface KlaviyoImageResponse {
  data: {
    type: 'image'
    id: string
    attributes: KlaviyoImageAttributes
    links: {
      self: string
    }
  }
}

interface KlaviyoImagesListResponse {
  data: Array<{
    type: 'image'
    id: string
    attributes: KlaviyoImageAttributes
    links: {
      self: string
    }
  }>
  links?: {
    self: string
    next?: string
    prev?: string
  }
}

export interface UploadImageFromUrlParams {
  imageUrl: string
  name?: string
  apiKey: string
}

export interface UploadImageResult {
  id: string
  url: string
  name: string
  format: string
  size: number
}

/**
 * Upload an image to Klaviyo from a URL
 * 
 * Klaviyo will fetch the image from the provided URL and store it in their image library.
 * The returned URL is a Klaviyo-hosted URL that can be used in templates.
 */
export async function uploadImageFromUrl({
  imageUrl,
  name,
  apiKey,
}: UploadImageFromUrlParams): Promise<UploadImageResult> {
  // Derive name from URL if not provided
  const imageName = name || extractNameFromUrl(imageUrl)
  
  const response = await klaviyoRequest<KlaviyoImageResponse>({
    method: 'POST',
    endpoint: '/images',
    apiKey,
    body: {
      data: {
        type: 'image',
        attributes: {
          import_from_url: imageUrl,
          name: imageName,
          hidden: false,
        },
      },
    },
  })

  return {
    id: response.data.id,
    url: response.data.attributes.image_url,
    name: response.data.attributes.name,
    format: response.data.attributes.format,
    size: response.data.attributes.size,
  }
}

/**
 * Upload multiple images to Klaviyo
 * 
 * Uses sequential requests with small delays to avoid rate limiting.
 * Returns results for each image, including any failures.
 */
export async function uploadMultipleImages(
  images: Array<{ url: string; name?: string; type: string }>,
  apiKey: string,
  onProgress?: (completed: number, total: number) => void
): Promise<Array<{
  originalUrl: string
  type: string
  success: boolean
  result?: UploadImageResult
  error?: string
}>> {
  const results: Array<{
    originalUrl: string
    type: string
    success: boolean
    result?: UploadImageResult
    error?: string
  }> = []

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    
    try {
      const result = await uploadImageFromUrl({
        imageUrl: image.url,
        name: image.name,
        apiKey,
      })
      
      results.push({
        originalUrl: image.url,
        type: image.type,
        success: true,
        result,
      })
    } catch (error) {
      results.push({
        originalUrl: image.url,
        type: image.type,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    
    // Report progress
    if (onProgress) {
      onProgress(i + 1, images.length)
    }
    
    // Small delay between requests to avoid rate limiting
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return results
}

/**
 * Get an image by ID from Klaviyo
 */
export async function getImage(
  imageId: string,
  apiKey: string
): Promise<UploadImageResult> {
  const response = await klaviyoRequest<KlaviyoImageResponse>({
    method: 'GET',
    endpoint: `/images/${imageId}`,
    apiKey,
  })

  return {
    id: response.data.id,
    url: response.data.attributes.image_url,
    name: response.data.attributes.name,
    format: response.data.attributes.format,
    size: response.data.attributes.size,
  }
}

/**
 * List images from Klaviyo's image library
 */
export async function listImages(
  apiKey: string,
  options?: { pageSize?: number; cursor?: string }
): Promise<{
  images: UploadImageResult[]
  nextCursor?: string
}> {
  let endpoint = '/images'
  const params = new URLSearchParams()
  
  if (options?.pageSize) {
    params.set('page[size]', String(options.pageSize))
  }
  if (options?.cursor) {
    params.set('page[cursor]', options.cursor)
  }
  
  if (params.toString()) {
    endpoint += `?${params.toString()}`
  }

  const response = await klaviyoRequest<KlaviyoImagesListResponse>({
    method: 'GET',
    endpoint,
    apiKey,
  })

  const images = response.data.map(item => ({
    id: item.id,
    url: item.attributes.image_url,
    name: item.attributes.name,
    format: item.attributes.format,
    size: item.attributes.size,
  }))

  // Extract cursor from next link if present
  let nextCursor: string | undefined
  if (response.links?.next) {
    const url = new URL(response.links.next)
    nextCursor = url.searchParams.get('page[cursor]') || undefined
  }

  return { images, nextCursor }
}

/**
 * Extract a reasonable name from a URL
 */
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''
    
    // Remove query parameters and extension
    const name = filename.split('?')[0].replace(/\.[^.]+$/, '')
    
    // Clean up the name
    const cleanName = name
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    return cleanName || 'Untitled Image'
  } catch {
    return 'Untitled Image'
  }
}
