import json
from supabase import create_client, Client

# Your full ICP data
icp_data = {
    "icp_reports": [
        # Paste your full 3 ICPs with all details here from your earlier message
        # The complete JSON you showed me with ICP-001, ICP-002, ICP-003
    ]
}

# Supabase connection
url = "YOUR_SUPABASE_URL"
key = "YOUR_SERVICE_ROLE_KEY"
supabase: Client = create_client(url, key)

# Update the company profile
company_id = "42b581ec-7aa8-4eba-9e48-e94c6bf36afa"

response = supabase.table("company_profiles").update({
    "company_report": {
        "phase_data": {
            "phase_2_icp_report": icp_data
        },
        "workflow_status": "icp_ready"
    }
}).eq("id", company_id).execute()

print(f"Updated! ICP Count: {len(icp_data['icp_reports'])}")
