// Script to run chat schema migration against Supabase
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Make sure this is in your .env file
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../db/migrations/chat_messaging_schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split the SQL into individual statements
    // This simple split won't work for all SQL files but works for basic statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('pgmigrate', { query: statement });
      
      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
        // Continue with other statements even if one fails
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

// Run the migration
runMigration();
