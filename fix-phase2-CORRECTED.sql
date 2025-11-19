-- Fix Phase 2 ICP Data - CORRECTED VERSION
-- This properly formats the JSON for PostgreSQL

UPDATE company_profiles
SET 
  company_report = jsonb_set(
    company_report,
    '{phase_data,phase_2_icp_report}',
    '{"icp_reports":[{"icp_id":"ICP-001","icp_name":"B2B Lead Generation Agencies","icp_summary":"Specialized agencies that provide lead generation services to B2B clients across various industries. These agencies typically manage multiple client accounts simultaneously and require scalable, cost-effective cold email infrastructure with white-labeling capabilities.","firmographics":{"industries":["Lead Generation Services","B2B Marketing Services"],"company_size_employees":[5,150],"annual_revenue_usd_millions":[0.5,15],"geography":["United States","Canada","United Kingdom"]},"sub_niches":[{"sub_niche_id":"SN-001-A","sub_niche_name":"SaaS-Focused Lead Generation Agencies"},{"sub_niche_id":"SN-001-B","sub_niche_name":"Enterprise B2B Lead Generation Agencies"}]},{"icp_id":"ICP-002","icp_name":"Marketing Agencies Offering Outbound Services","icp_summary":"Full-service digital marketing agencies, growth marketing agencies, and performance marketing agencies.","firmographics":{"industries":["Digital Marketing Agencies","Growth Marketing Agencies"],"company_size_employees":[10,100],"annual_revenue_usd_millions":[1,25],"geography":["United States","Canada","United Kingdom"]},"sub_niches":[{"sub_niche_id":"SN-002-A","sub_niche_name":"Growth Marketing Agencies Adding Cold Outreach"},{"sub_niche_id":"SN-002-B","sub_niche_name":"Full-Service B2B Marketing Agencies"}]},{"icp_id":"ICP-003","icp_name":"In-House B2B Sales Teams (Mid-Market to Enterprise)","icp_summary":"Internal sales development and outbound sales teams within mid-market to enterprise B2B companies.","firmographics":{"industries":["B2B SaaS","Enterprise Software","Professional Services"],"company_size_employees":[100,5000],"annual_revenue_usd_millions":[10,500],"geography":["United States","Canada","United Kingdom"]},"sub_niches":[{"sub_niche_id":"SN-003-A","sub_niche_name":"Mid-Market B2B SaaS Companies"},{"sub_niche_id":"SN-003-B","sub_niche_name":"Professional Services Firms"}]}]}'::jsonb
  ),
  workflow_status = 'icp_ready'
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';

-- Verify
SELECT 
  jsonb_array_length(company_report->'phase_data'->'phase_2_icp_report'->'icp_reports') as icp_count,
  company_report->'phase_data'->'phase_2_icp_report'->'icp_reports' as all_icps
FROM company_profiles
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';
