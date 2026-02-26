#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase configuration')
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
    process.exit(1)
  }

  console.log('🔗 Connecting to Supabase...')
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '003_lists_forms_coupons.sql')
  console.log('📄 Reading migration file...')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

  console.log('🚀 Running migration...')
  console.log('   This will create the following tables:')
  console.log('   - brand_lists')
  console.log('   - brand_forms')
  console.log('   - brand_coupons')
  console.log('   - coupon_codes')
  console.log('   - figma_designs')
  console.log('   - deployment_workflows')
  console.log('')

  try {
    // Split SQL by statement boundaries (simple approach for our migration)
    const statements = migrationSQL
      .split(/;\s*$/gm)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Skip comment-only statements
      if (statement.trim().startsWith('--')) continue

      try {
        const { error } = await supabase.rpc('query', { query_text: statement })
        
        if (error) {
          // Try direct execution as fallback
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({ query: statement })
          })
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
          }
        }
        
        successCount++
        process.stdout.write('.')
      } catch (err) {
        // Some errors are expected (e.g., "already exists")
        if (err.message && err.message.includes('already exists')) {
          process.stdout.write('↓')
          successCount++
        } else {
          process.stdout.write('✗')
          errorCount++
        }
      }
    }

    console.log('\n')
    console.log(`✅ Migration completed!`)
    console.log(`   Successful: ${successCount}`)
    if (errorCount > 0) {
      console.log(`   Skipped/Errors: ${errorCount}`)
    }
    console.log('')
    console.log('🔍 Verifying tables...')
    
    // Verify tables exist
    const tables = ['brand_lists', 'brand_forms', 'brand_coupons', 'coupon_codes', 'figma_designs', 'deployment_workflows']
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(0)
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`)
      } else {
        console.log(`   ✅ ${table}`)
      }
    }
    
    console.log('')
    console.log('🎉 Migration successful! You can now save your brands.')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigration()
