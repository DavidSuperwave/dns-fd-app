import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Set dynamic to ensure fresh data on each request
export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

// Handler for GET requests to fetch dashboard metrics
export async function GET(request: NextRequest) {
  try {
    console.log('Dashboard metrics API called');
    
    // Initialize metrics object with default values
    const metrics = {
      totalActiveDomains: 0
      // Note: We're not including openTickets as that comes from the UI component now
    };

    // Get total active domains count using same logic as /metrics endpoint
    try {
      console.log('Attempting to query database for active domains');
      
      // First debug what tables exist
      const tablesResult = await pool.query(`
        SELECT tablename 
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
      `);
      
      console.log('Available tables:', tablesResult.rows.map((r: any) => r.tablename));
      
      // Now get active domains
      const domainsResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM domains
        WHERE status = 'active'
        AND deployment_status IS NULL
      `);
      
      console.log('Domain query result:', domainsResult.rows);
      metrics.totalActiveDomains = parseInt(domainsResult.rows[0]?.total || '0', 10);
    } catch (dbError) {
      console.error('Error fetching domain metrics:', dbError);
      // Continue with default value if this query fails
    }

    // Return the metrics data
    return NextResponse.json(metrics, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard metrics' }, { status: 500 });
  }
}
