
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

async function debugIcpData() {
    // ID from the logs
    const projectId = 'c6665de4-454d-40f4-bf3a-f3dd244931ae';
    const companyProfileId = '95224bea-33fb-4bc7-9293-6702d8855cff';

    console.log(`Fetching company profile: ${companyProfileId}`);

    const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('id', companyProfileId)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return;
    }

    console.log('Company Profile Found.');
    console.log('Report Structure Keys:', Object.keys(data.company_report || {}));

    if (data.company_report?.phase_data) {
        console.log('Phase Data Keys:', Object.keys(data.company_report.phase_data));

        const icpReport = data.company_report.phase_data.phase_2_icp_report;
        const icpCreation = data.company_report.phase_data.phase_2_icp_creation;
        const phase2 = data.company_report.phase_data.phase_2;

        console.log('phase_2_icp_report exists?', !!icpReport);
        console.log('phase_2_icp_creation exists?', !!icpCreation);
        console.log('phase_2 exists?', !!phase2);

        if (icpReport) {
            console.log('phase_2_icp_report type:', typeof icpReport);
            console.log('phase_2_icp_report keys:', Object.keys(icpReport));
            if (Array.isArray(icpReport)) {
                console.log('Is Array. Length:', icpReport.length);
            } else if (icpReport.icp_reports) {
                console.log('Has icp_reports array. Length:', icpReport.icp_reports.length);
            }
        }
    } else {
        console.log('No phase_data found in company_report');
    }
}

debugIcpData();
