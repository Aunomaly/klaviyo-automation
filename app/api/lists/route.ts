import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KlaviyoClient, createBrandLists } from '@/lib/klaviyo'

interface CreateListsRequest {
  brandId: string
  apiKey: string
}

/**
 * POST /api/lists
 * Create email and SMS lists for a brand in Klaviyo
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateListsRequest = await request.json()
    const { brandId, apiKey } = body

    if (!brandId || !apiKey) {
      return NextResponse.json(
        { error: 'brandId and apiKey are required' },
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
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      )
    }

    // Create lists in Klaviyo
    const client = new KlaviyoClient(apiKey)
    const { emailList, smsList } = await createBrandLists(client, brand.name)

    // Save to database
    const emailListRecord = await supabase
      .from('brand_lists')
      .insert({
        brand_id: brandId,
        list_name: `${brand.name} - Email Subscribers`,
        list_type: 'email',
        klaviyo_list_id: emailList.id,
        klaviyo_list_url: `https://www.klaviyo.com/lists/${emailList.id}`,
        status: 'active',
        deployed_at: new Date().toISOString(),
      })
      .select()
      .single()

    const smsListRecord = await supabase
      .from('brand_lists')
      .insert({
        brand_id: brandId,
        list_name: `${brand.name} - SMS Subscribers`,
        list_type: 'sms',
        klaviyo_list_id: smsList.id,
        klaviyo_list_url: `https://www.klaviyo.com/lists/${smsList.id}`,
        status: 'active',
        deployed_at: new Date().toISOString(),
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      lists: {
        email: emailListRecord.data,
        sms: smsListRecord.data,
      },
      message: 'Lists created successfully',
    })
  } catch (error) {
    console.error('List creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create lists', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/lists?brandId=xxx
 * Get all lists for a brand
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
      .from('brand_lists')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ lists: data })
  } catch (error) {
    console.error('Get lists error:', error)
    return NextResponse.json(
      { error: 'Failed to get lists', details: String(error) },
      { status: 500 }
    )
  }
}
