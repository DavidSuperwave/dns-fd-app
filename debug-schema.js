const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('STARTING SCHEMA CHECK...');

    try {
        // Try a join query with admin client.
        console.log("Attempting join query...");
        const { data: joinData, error: joinError } = await supabase
            .from('projects')
            .select('id, company_profiles(id)')
            .limit(1);

        if (joinError) {
            console.error("JOIN QUERY FAILED:", JSON.stringify(joinError, null, 2));
            console.log("This likely means the Foreign Key is missing.");
        } else {
            console.log("JOIN QUERY SUCCESS!");
            console.log("Data sample:", JSON.stringify(joinData, null, 2));
            console.log("Foreign Key exists and is working.");
        }
    } catch (e) {
        console.error("UNEXPECTED ERROR:", e);
    }
    console.log('SCHEMA CHECK COMPLETE.');
}

checkSchema();
