import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KlaviyoClient, createBrandSignupForm, getFormEmbedCode } from '@/lib/klaviyo'

interface CreateFormRequest {
  brandId: string
  apiKey: string
  emailListId: string
  smsListId: string
}

/**
 * POST /api/forms
 * Create a signup form for a brand in Klaviyo
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateFormRequest = await request.json()
    const { brandId, apiKey, emailListId, smsListId } = body

    if (!brandId || !apiKey || !emailListId || !smsListId) {
      return NextResponse.json(
        { error: 'brandId, apiKey, emailListId, and smsListId are required' },
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

    // Get list records to get Klaviyo IDs
    const { data: emailList } = await supabase
      .from('brand_lists')
      .select('klaviyo_list_id')
      .eq('id', emailListId)
      .single()

    const { data: smsList } = await supabase
      .from('brand_lists')
      .select('klaviyo_list_id')
      .eq('id', smsListId)
      .single()

    if (!emailList?.klaviyo_list_id || !smsList?.klaviyo_list_id) {
      return NextResponse.json(
        { error: 'Lists not found or not deployed to Klaviyo' },
        { status: 404 }
      )
    }

    // Create form in Klaviyo
    const client = new KlaviyoClient(apiKey)
    const form = await createBrandSignupForm(
      client,
      brand.name,
      {
        emailListId: emailList.klaviyo_list_id,
        smsListId: smsList.klaviyo_list_id,
      },
      {
        primaryColor: brand.primary_color,
        secondaryColor: brand.secondary_color,
      }
    )

    // Generate embed code
    const embedCode = getFormEmbedCode(form.id)

    // Save to database
    const { data: formRecord, error: formError } = await supabase
      .from('brand_forms')
      .insert({
        brand_id: brandId,
        form_name: `${brand.name} - Newsletter Signup`,
        form_type: 'embed',
        klaviyo_form_id: form.id,
        klaviyo_form_url: `https://www.klaviyo.com/form/${form.id}/edit`,
        embed_code: embedCode,
        email_list_id: emailListId,
        sms_list_id: smsListId,
        fields: form.attributes.fields,
        settings: form.attributes.settings,
        status: 'active',
        deployed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (formError) {
      throw formError
    }

    return NextResponse.json({
      success: true,
      form: formRecord,
      embedCode,
      message: 'Form created successfully',
    })
  } catch (error) {
    console.error('Form creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create form', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/forms?brandId=xxx
 * Get all forms for a brand
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
      .from('brand_forms')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ forms: data })
  } catch (error) {
    console.error('Get forms error:', error)
    return NextResponse.json(
      { error: 'Failed to get forms', details: String(error) },
      { status: 500 }
    )
  }
}
