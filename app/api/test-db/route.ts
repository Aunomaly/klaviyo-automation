import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: 'Missing Supabase configuration',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test connection and check tables
    const results: any = {
      connection: 'unknown',
      tables: {},
      errors: []
    }

    // Test 1: Try to query brands table
    try {
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .limit(1)
      
      if (brandsError) {
        results.tables.brands = { exists: false, error: brandsError.message }
        results.errors.push(`brands table: ${brandsError.message}`)
      } else {
        results.tables.brands = { 
          exists: true, 
          count: brands?.length || 0,
          sample: brands?.[0] || null 
        }
        results.connection = 'success'
      }
    } catch (err) {
      results.tables.brands = { exists: false, error: String(err) }
      results.errors.push(`brands table error: ${err}`)
    }

    // Test 2: Check brand_images table
    try {
      const { data: images, error: imagesError } = await supabase
        .from('brand_images')
        .select('*')
        .limit(1)
      
      if (imagesError) {
        results.tables.brand_images = { exists: false, error: imagesError.message }
        results.errors.push(`brand_images table: ${imagesError.message}`)
      } else {
        results.tables.brand_images = { exists: true, count: images?.length || 0 }
      }
    } catch (err) {
      results.tables.brand_images = { exists: false, error: String(err) }
    }

    // Test 3: Check template_configs table
    try {
      const { data: templates, error: templatesError } = await supabase
        .from('template_configs')
        .select('*')
        .limit(1)
      
      if (templatesError) {
        results.tables.template_configs = { exists: false, error: templatesError.message }
      } else {
        results.tables.template_configs = { exists: true, count: templates?.length || 0 }
      }
    } catch (err) {
      results.tables.template_configs = { exists: false, error: String(err) }
    }

    // Test 4: Check flow_configs table
    try {
      const { data: flows, error: flowsError } = await supabase
        .from('flow_configs')
        .select('*')
        .limit(1)
      
      if (flowsError) {
        results.tables.flow_configs = { exists: false, error: flowsError.message }
      } else {
        results.tables.flow_configs = { exists: true, count: flows?.length || 0 }
      }
    } catch (err) {
      results.tables.flow_configs = { exists: false, error: String(err) }
    }

    // Test 5: Check brand_lists table
    try {
      const { data: lists, error: listsError } = await supabase
        .from('brand_lists')
        .select('*')
        .limit(1)
      
      if (listsError) {
        results.tables.brand_lists = { exists: false, error: listsError.message }
      } else {
        results.tables.brand_lists = { exists: true, count: lists?.length || 0 }
      }
    } catch (err) {
      results.tables.brand_lists = { exists: false, error: String(err) }
    }

    // Test 6: Check brand_forms table
    try {
      const { data: forms, error: formsError } = await supabase
        .from('brand_forms')
        .select('*')
        .limit(1)
      
      if (formsError) {
        results.tables.brand_forms = { exists: false, error: formsError.message }
      } else {
        results.tables.brand_forms = { exists: true, count: forms?.length || 0 }
      }
    } catch (err) {
      results.tables.brand_forms = { exists: false, error: String(err) }
    }

    // Test 7: Check brand_coupons table
    try {
      const { data: coupons, error: couponsError } = await supabase
        .from('brand_coupons')
        .select('*')
        .limit(1)
      
      if (couponsError) {
        results.tables.brand_coupons = { exists: false, error: couponsError.message }
      } else {
        results.tables.brand_coupons = { exists: true, count: coupons?.length || 0 }
      }
    } catch (err) {
      results.tables.brand_coupons = { exists: false, error: String(err) }
    }

    // Test 8: Check figma_designs table
    try {
      const { data: designs, error: designsError } = await supabase
        .from('figma_designs')
        .select('*')
        .limit(1)
      
      if (designsError) {
        results.tables.figma_designs = { exists: false, error: designsError.message }
      } else {
        results.tables.figma_designs = { exists: true, count: designs?.length || 0 }
      }
    } catch (err) {
      results.tables.figma_designs = { exists: false, error: String(err) }
    }

    // Summary
    const existingTables = Object.entries(results.tables)
      .filter(([_, info]: any) => info.exists)
      .map(([name]) => name)
    
    const missingTables = Object.entries(results.tables)
      .filter(([_, info]: any) => !info.exists)
      .map(([name]) => name)

    return NextResponse.json({
      status: results.connection,
      summary: {
        totalTables: Object.keys(results.tables).length,
        existingTables: existingTables.length,
        missingTables: missingTables.length
      },
      existingTables,
      missingTables,
      details: results.tables,
      errors: results.errors,
      config: {
        supabaseUrl: supabaseUrl.substring(0, 30) + '...',
        hasKey: !!supabaseKey
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Database test failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
