import { NextRequest, NextResponse } from 'next/server'
import { uploadImageFromUrl, uploadMultipleImages } from '@/lib/klaviyo/images'
import { createClient } from '@/lib/supabase/server'

interface UploadImageRequest {
  brandId: string
  apiKey: string
  images: Array<{
    url: string
    type: string
    alt?: string
    width?: number
    height?: number
  }>
}

interface UploadSingleImageRequest {
  apiKey: string
  imageUrl: string
  name?: string
}

/**
 * POST /api/images
 * Upload images to Klaviyo and save to database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if this is a single image upload or batch
    if ('imageUrl' in body) {
      return handleSingleUpload(body as UploadSingleImageRequest)
    } else {
      return handleBatchUpload(body as UploadImageRequest)
    }
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload images', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Handle single image upload (for testing or individual uploads)
 */
async function handleSingleUpload(body: UploadSingleImageRequest) {
  const { apiKey, imageUrl, name } = body
  
  if (!apiKey || !imageUrl) {
    return NextResponse.json(
      { error: 'apiKey and imageUrl are required' },
      { status: 400 }
    )
  }
  
  try {
    const result = await uploadImageFromUrl({
      imageUrl,
      name,
      apiKey,
    })
    
    return NextResponse.json({
      success: true,
      image: result,
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to upload image to Klaviyo', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}

/**
 * Handle batch image upload with database persistence
 */
async function handleBatchUpload(body: UploadImageRequest) {
  const { brandId, apiKey, images } = body
  
  if (!brandId || !apiKey || !images || images.length === 0) {
    return NextResponse.json(
      { error: 'brandId, apiKey, and images are required' },
      { status: 400 }
    )
  }
  
  // Upload images to Klaviyo
  const uploadResults = await uploadMultipleImages(
    images.map(img => ({
      url: img.url,
      type: img.type,
      name: img.alt || undefined,
    })),
    apiKey
  )
  
  // Save results to database
  const supabase = await createClient()
  const savedImages = []
  const errors = []
  
  for (let i = 0; i < uploadResults.length; i++) {
    const uploadResult = uploadResults[i]
    const originalImage = images[i]
    
    if (uploadResult.success && uploadResult.result) {
      // Save successful upload to database
      const { data, error } = await supabase
        .from('brand_images')
        .insert({
          brand_id: brandId,
          original_url: uploadResult.originalUrl,
          image_type: uploadResult.type,
          alt_text: originalImage.alt || null,
          width: originalImage.width || null,
          height: originalImage.height || null,
          klaviyo_image_id: uploadResult.result.id,
          klaviyo_image_url: uploadResult.result.url,
          uploaded_to_klaviyo: true,
          uploaded_at: new Date().toISOString(),
          is_primary: i === 0 && uploadResult.type === 'logo', // First logo is primary
          display_order: i,
        })
        .select()
        .single()
      
      if (error) {
        errors.push({
          url: uploadResult.originalUrl,
          error: `Database error: ${error.message}`,
        })
      } else {
        savedImages.push(data)
      }
    } else {
      // Save failed upload with original URL only
      const { data, error } = await supabase
        .from('brand_images')
        .insert({
          brand_id: brandId,
          original_url: uploadResult.originalUrl,
          image_type: uploadResult.type,
          alt_text: originalImage.alt || null,
          width: originalImage.width || null,
          height: originalImage.height || null,
          uploaded_to_klaviyo: false,
          display_order: i,
        })
        .select()
        .single()
      
      if (error) {
        errors.push({
          url: uploadResult.originalUrl,
          error: `Upload failed: ${uploadResult.error}; DB error: ${error.message}`,
        })
      } else {
        savedImages.push(data)
        errors.push({
          url: uploadResult.originalUrl,
          error: `Klaviyo upload failed: ${uploadResult.error}`,
        })
      }
    }
  }
  
  const successCount = uploadResults.filter(r => r.success).length
  
  return NextResponse.json({
    success: errors.length === 0,
    message: `Uploaded ${successCount}/${images.length} images to Klaviyo`,
    images: savedImages,
    errors: errors.length > 0 ? errors : undefined,
  })
}

/**
 * GET /api/images?brandId=xxx
 * Get all images for a brand
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    
    if (!brandId) {
      return NextResponse.json(
        { error: 'brandId is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('brand_images')
      .select('*')
      .eq('brand_id', brandId)
      .order('display_order', { ascending: true })
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ images: data })
  } catch (error) {
    console.error('Get images error:', error)
    return NextResponse.json(
      { error: 'Failed to get images', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/images?id=xxx
 * Delete a brand image
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('id')
    
    if (!imageId) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    const { error } = await supabase
      .from('brand_images')
      .delete()
      .eq('id', imageId)
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete image error:', error)
    return NextResponse.json(
      { error: 'Failed to delete image', details: String(error) },
      { status: 500 }
    )
  }
}
