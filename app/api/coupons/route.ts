import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KlaviyoClient, createWelcomeDiscount } from '@/lib/klaviyo'

interface CreateCouponRequest {
  brandId: string
  apiKey: string
  couponCode: string
  description?: string
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping'
  discountValue: number
  expiresAt?: string
}

/**
 * POST /api/coupons
 * Create a discount coupon for a brand in Klaviyo
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateCouponRequest = await request.json()
    const {
      brandId,
      apiKey,
      couponCode,
      description,
      discountType,
      discountValue,
      expiresAt,
    } = body

    if (!brandId || !apiKey || !couponCode || !discountType || !discountValue) {
      return NextResponse.json(
        {
          error:
            'brandId, apiKey, couponCode, discountType, and discountValue are required',
        },
        { status: 400 }
      )
    }

    // Get brand data
    const supabase = await createClient()
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single()

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    // Create coupon in Klaviyo
    const client = new KlaviyoClient(apiKey)
    const { coupon, code } = await createWelcomeDiscount(
      client,
      brand.name,
      couponCode,
      {
        description,
        expiresAt,
      }
    )

    // Save to database
    const { data: couponRecord, error: couponError } = await supabase
      .from('brand_coupons')
      .insert({
        brand_id: brandId,
        coupon_name: description || `${brand.name} Welcome Discount`,
        external_id: coupon.attributes.external_id,
        description: description || `${brand.name} Welcome Discount - ${discountValue}% Off`,
        klaviyo_coupon_id: coupon.id,
        klaviyo_coupon_url: `https://www.klaviyo.com/coupon/${coupon.id}`,
        discount_type: discountType,
        discount_value: discountValue,
        usage_type: 'multi_use',
        expires_at: expiresAt,
        status: 'active',
        deployed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (couponError) {
      throw couponError
    }

    // Save coupon code
    const { data: codeRecord, error: codeError } = await supabase
      .from('coupon_codes')
      .insert({
        coupon_id: couponRecord.id,
        code: couponCode,
        klaviyo_code_id: code.id,
        status: 'unassigned',
      })
      .select()
      .single()

    if (codeError) {
      throw codeError
    }

    return NextResponse.json({
      success: true,
      coupon: couponRecord,
      code: codeRecord,
      message: 'Coupon created successfully',
    })
  } catch (error) {
    console.error('Coupon creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create coupon', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/coupons?brandId=xxx
 * Get all coupons for a brand
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
      .from('brand_coupons')
      .select('*, coupon_codes(*)')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ coupons: data })
  } catch (error) {
    console.error('Get coupons error:', error)
    return NextResponse.json(
      { error: 'Failed to get coupons', details: String(error) },
      { status: 500 }
    )
  }
}
