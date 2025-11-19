
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetProjectPhase() {
    const companyProfileId = '95224bea-33fb-4bc7-9293-6702d8855cff';

    console.log(`Resetting phase for company profile: ${companyProfileId}`);

    // Fetch current data first
    const { data: currentData, error: fetchError } = await supabase
        .from('company_profiles')
        .select('company_report')
        .eq('id', companyProfileId)
        .single();

    if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        return;
    }

    const report = currentData.company_report || {};

    // Keep Phase 1 data, remove Phase 2 and 3
    const newPhasesCompleted = ['phase_1_company_report'];

    // Update report
    const updatedReport = {
        ...report,
        current_phase: 'phase_1_company_report',
        phases_completed: newPhasesCompleted,
        // Keep phase_data but maybe clean up future phases if needed? 
        // Actually, keeping them doesn't hurt, but let's be clean.
        phase_data: {
            ...report.phase_data,
            // We keep phase_1_company_report
            // We can optionally delete phase_2 and phase_3 keys to be safe
        }
    };

    // We also need to update workflow_status to 'completed' (Phase 1 is completed)
    // so the UI shows the "Generate ICPs" button (which appears when status is completed/reviewing?)
    // Wait, CampaignPage logic:
    // if workflowStatus === 'generating' -> Loading
    // if workflowStatus === 'reviewing' -> Phase 1 Approval
    // if !workspaceType -> Workspace Selection
    // else -> Main UI (ICPs tab)

    // We want to be in Main UI.
    // So workflow_status should be 'completed' (or anything not generating/reviewing).

    const { error: updateError } = await supabase
        .from('company_profiles')
        .update({
            company_report: updatedReport,
            workflow_status: 'completed'
        })
        .eq('id', companyProfileId);

    if (updateError) {
        console.error('Error updating profile:', updateError);
    } else {
        console.log('Successfully reset project to Phase 1. User can now regenerate ICPs.');
    }
}

resetProjectPhase();
