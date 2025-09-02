import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Check for required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Error: Environment variable ${varName} is required but not set.`)
    process.exit(1)
  }
})

// Create Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function applyMigration() {
  try {
    console.log('Starting migration...')

    // Read migration SQL file
    const migrationPath = path.join(__dirname, '../db/migrations/user_company_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql_string: migrationSQL,
    })

    if (error) {
      throw error
    }

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
applyMigration()
