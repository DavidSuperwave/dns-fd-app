import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking latest project...');

    const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id, name, company_profile_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

    if (projectError) {
        console.error('Error fetching projects:', projectError);
        return;
    }

    if (!projects || projects.length === 0) {
        console.log('No projects found.');
        return;
    }

    const project = projects[0];
    console.log('Latest Project:', project);

    if (!project.company_profile_id) {
        console.error('CRITICAL: company_profile_id is NULL for this project!');
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from('company_profiles')
        .select('id, client_name, workflow_status')
        .eq('id', project.company_profile_id)
        .single();

    if (profileError) {
        console.error('Error fetching linked profile:', profileError);
    } else {
        console.log('Linked Profile:', profile);
    }
}

checkData();
