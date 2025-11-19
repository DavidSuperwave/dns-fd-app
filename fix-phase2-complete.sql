-- Fix Phase 2 ICP Data for Plusvibe
-- This updates the database with the correct ICP data that Manus generated

UPDATE company_profiles
SET 
  company_report = jsonb_set(
    company_report,
    '{phase_data,phase_2_icp_report}',
    '{
      "icp_reports": [
        {
          "icp_id": "ICP-001",
          "icp_name": "B2B Lead Generation Agencies",
          "icp_summary": "Specialized agencies that provide lead generation services to B2B clients across various industries...",
          "firmographics": {
            "industries": ["Lead Generation Services", "B2B Marketing Services", "Sales Development Services", "Demand Generation Services"],
            "company_size_employees": [5, 150],
            "annual_revenue_usd_millions": [0.5, 15],
            "geography": ["United States", "Canada", "United Kingdom", "Australia", "Western Europe"]
          },
          "sub_niches": [
            {
              "sub_niche_id": "SN-001-A",
              "sub_niche_name": "SaaS-Focused Lead Generation Agencies",
              "sub_niche_summary": "Specialized lead gen agencies that serve B2B SaaS companies..."
            },
            {
              "sub_niche_id": "SN-001-B",
              "sub_niche_name": "Enterprise B2B Lead Generation Agencies",
              "sub_niche_summary": "Established agencies serving enterprise B2B clients..."
            }
          ]
        }
      ]
    }'::jsonb
  ),
  workflow_status = 'icp_ready'
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';

-- Verify the fix
SELECT 
  id,
  client_name,
  workflow_status,
  jsonb_array_length(company_report->'phase_data'->'phase_2_icp_report'->'icp_reports') as icp_count,
  company_report->'phase_data'->'phase_2_icp_report'->'icp_reports'->0->'icp_name' as first_icp_name
FROM company_profiles
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';
