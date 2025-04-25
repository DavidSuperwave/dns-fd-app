import { NextResponse } from 'next/server';

// Enable edge runtime
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * API endpoint to create necessary tables for the Cloudflare sync functionality
 * Uses Supabase's REST API instead of direct PostgreSQL connections
 * 
 * Example usage: 
 * curl -X POST http://localhost:3000/api/setup/create-tables?key=SETUP_SECRET_KEY
 */
export async function POST(request: Request) {
  try {
    // Security check - require a setup key
    const url = new URL(request.url);
    const setupKey = url.searchParams.get('key');
    const validKey = process.env.SETUP_SECRET_KEY || 'dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3';
    
    if (setupKey !== validKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid setup key' },
        { status: 401 }
      );
    }
    
    // Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }
    
    console.log('Connecting to Supabase:', supabaseUrl);
    
    // SQL statements for tables and policies
    const sqlStatements = [
      // Domains table
      `CREATE TABLE IF NOT EXISTS domains (
        id SERIAL PRIMARY KEY,
        cloudflare_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT,
        paused BOOLEAN DEFAULT FALSE,
        type TEXT,
        created_on TIMESTAMP WITH TIME ZONE,
        modified_on TIMESTAMP WITH TIME ZONE,
        last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_id UUID
      );`,
      
      // Index for domains
      `CREATE INDEX IF NOT EXISTS idx_domains_cloudflare_id ON domains(cloudflare_id);`,
      
      // Enable RLS for domains
      `ALTER TABLE domains ENABLE ROW LEVEL SECURITY;`,
      
      // Drop existing policies for domains
      `DROP POLICY IF EXISTS "Enable read access for all users" ON domains;`,
      `DROP POLICY IF EXISTS "Enable write access for service role" ON domains;`,
      
      // Create policies for domains
      `CREATE POLICY "Enable read access for all users" ON domains FOR SELECT USING (true);`,
      `CREATE POLICY "Enable write access for service role" ON domains FOR ALL USING (auth.role() = 'service_role');`,
      
      // Sync history table
      `CREATE TABLE IF NOT EXISTS sync_history (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        domains_count INTEGER DEFAULT 0,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        duration_ms INTEGER
      );`,
      
      // Enable RLS for sync_history
      `ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;`,
      
      // Drop existing policies for sync_history
      `DROP POLICY IF EXISTS "Enable read access for all users" ON sync_history;`,
      `DROP POLICY IF EXISTS "Enable insert for service role" ON sync_history;`,
      
      // Create policies for sync_history
      `CREATE POLICY "Enable read access for all users" ON sync_history FOR SELECT USING (true);`,
      `CREATE POLICY "Enable insert for service role" ON sync_history FOR INSERT WITH CHECK (auth.role() = 'service_role');`,
      
      // Test insertion for domains
      `INSERT INTO domains 
        (cloudflare_id, name, status, paused, type, created_on, modified_on, last_synced)
      VALUES 
        ('api-setup-verification', 'api-test-domain.example.com', 'test', false, 'verification', NOW(), NOW(), NOW())
      ON CONFLICT (cloudflare_id) DO NOTHING;`,
      
      // Test insertion for sync_history
      `INSERT INTO sync_history 
        (timestamp, domains_count, success, error_message, duration_ms)
      VALUES 
        (NOW(), 1, true, 'API endpoint setup verification', 0);`,
      
      // Clean up test data
      `DELETE FROM domains WHERE cloudflare_id = 'api-setup-verification';`,
      
      // Query for table info
      `SELECT 
        table_name,
        COUNT(column_name) AS column_count
      FROM 
        information_schema.columns
      WHERE 
        table_schema = 'public' 
        AND table_name IN ('domains', 'sync_history')
      GROUP BY 
        table_name;`
    ];
    
    // Execute each SQL statement sequentially
    // Define a type for the results array if the structure is known, otherwise use unknown[] or any[]
    const results: unknown[] = [];
    // Define a type for errors
    interface ExecutionError {
      index: number;
      error: string;
      sql: string;
    }
    const errors: ExecutionError[] = [];

    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      console.log(`Executing SQL statement ${i + 1}/${sqlStatements.length}`);
      
      try {
        // Use Supabase's REST API to execute SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql: sql })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Warning: Statement ${i + 1} failed: ${errorText}`);
          errors.push({ index: i, error: errorText, sql: sql });
          
          // Don't stop execution if one statement fails
          continue;
        }
        
        const result = await response.json();
        results.push(result);
        
        // If this is the last statement (table info query), store it specially
        if (i === sqlStatements.length - 1) {
          // Last statement is the table info query
          console.log('Table info retrieved');
        }
      } catch (error) {
        console.warn(`Error executing statement ${i + 1}:`, error);
        errors.push({ index: i, error: error instanceof Error ? error.message : 'Unknown error', sql: sql });
      }
    }
    
    // Try an alternative approach for getting table info if the SQL approach failed
    let tableInfo = null;
    if (results.length < sqlStatements.length) {
      console.log('Using alternative approach to verify tables...');
      
      try {
        // Check domains table
        const domainsResponse = await fetch(`${supabaseUrl}/rest/v1/domains?select=count`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });
        
        // Check sync_history table
        const syncResponse = await fetch(`${supabaseUrl}/rest/v1/sync_history?select=count`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });
        
        tableInfo = {
          domains: domainsResponse.ok ? 'exists' : 'missing',
          sync_history: syncResponse.ok ? 'exists' : 'missing'
        };
      } catch (error) {
        console.warn('Alternative verification failed:', error);
      }
    }
    
    return NextResponse.json({
      success: errors.length === 0,
      message: errors.length === 0 
        ? 'Database tables created and verified successfully' 
        : 'Setup completed with warnings',
      tables: tableInfo || (results[results.length - 1] || 'Unable to verify tables'),
      warnings: errors.length > 0 ? errors : undefined,
      successfulOperations: results.length,
      totalOperations: sqlStatements.length
    });
  } catch (error) {
    console.error('Error creating tables:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}