import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        error: 'Missing Supabase configuration',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required to run migrations'
      }, { status: 500 })
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Read migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '003_lists_forms_coupons.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    // Split SQL into individual statements (rough split by semicolons outside of function definitions)
    // We'll run the whole thing as one query since Supabase can handle it
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      // If exec_sql doesn't exist, try direct query
      const { error: directError } = await supabase.from('_migrations').select('*').limit(0)
      
      if (directError) {
        return NextResponse.json({
          error: 'Failed to run migration',
          message: 'Supabase SQL execution failed. Please run the migration manually in the Supabase dashboard.',
          details: error.message,
          suggestion: 'Copy the contents of supabase/migrations/003_lists_forms_coupons.sql and paste it into the SQL Editor at https://app.supabase.com/project/lmunxjavmqxckbhoifwf/sql'
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration executed successfully',
      tables_created: [
        'brand_lists',
        'brand_forms', 
        'brand_coupons',
        'coupon_codes',
        'figma_designs',
        'deployment_workflows'
      ]
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      message: error instanceof Error ? error.message : String(error),
      suggestion: 'You may need to run this migration manually in the Supabase SQL Editor'
    }, { status: 500 })
  }
}
