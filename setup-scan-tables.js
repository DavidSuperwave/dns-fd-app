const { createClient } = require('@supabase/supabase-js');

// Supabase connection details
const supabaseUrl = 'https://zfwaqmkqqykfptczwqwo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2FxbWtxcXlrZnB0Y3p3cXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxMjQ0NiwiZXhwIjoyMDYwOTg4NDQ2fQ._b4muH3igc6CwPxTp7uPM54FWSCZkK1maSSbF7dAlQM';

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupScanTables() {
  try {
    console.log('Setting up scan tables...');

    // Insert test data to create table with correct schema
    const { error: insertError } = await supabase
      .from('scan_results')
      .insert([{
        status: 'completed',
        total_domains: 5031,
        domains_needing_attention: 3,
        scan_duration_ms: 1500,
        completed_at: new Date().toISOString(),
        status_breakdown: {
          active: 5028,
          pending: 2,
          moved: 1
        },
        non_active_domains: [
          { id: "test1", name: "example1.com", status: "pending" },
          { id: "test2", name: "example2.com", status: "pending" },
          { id: "test3", name: "example3.com", status: "moved" }
        ],
        scan_result: {
          success: true,
          timestamp: new Date().toISOString(),
          totalDomains: 5031,
          nonActiveDomains: 3
        }
      }]);

    if (insertError) {
      throw new Error(`Failed to create table: ${insertError.message}`);
    }

    console.log('Successfully created table and inserted test data');

    // Verify the table exists and has the test data
    const { data: verifyData, error: verifyError } = await supabase
      .from('scan_results')
      .select('*')
      .limit(1);

    if (verifyError) {
      throw new Error(`Failed to verify table: ${verifyError.message}`);
    }

    if (!verifyData || verifyData.length === 0) {
      throw new Error('Table verification failed: No data found');
    }

    console.log('Successfully verified table setup');
    console.log('Sample data:', verifyData[0]);

  } catch (error) {
    console.error('Error setting up scan tables:', error);
    process.exit(1);
  }
}

// Run the setup
setupScanTables();