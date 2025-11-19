-- Append ICP-002 and ICP-003 to existing ICP-001
-- This adds the missing ICPs without replacing ICP-001

UPDATE company_profiles
SET company_report = jsonb_set(
  company_report,
  '{phase_data,phase_2_icp_report,icp_reports}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      -- Keep existing ICP-001
      SELECT elem FROM jsonb_array_elements(company_report->'phase_data'->'phase_2_icp_report'->'icp_reports') elem
      UNION ALL
      -- Add ICP-002
      SELECT '{"icp_id":"ICP-002","icp_name":"Marketing Agencies Offering Outbound Services","icp_summary":"Full-service digital marketing agencies, growth marketing agencies, and performance marketing agencies that are expanding their service offerings to include cold email outreach or already offer it as part of their integrated marketing mix.","firmographics":{"industries":["Digital Marketing Agencies","Growth Marketing Agencies","Performance Marketing Agencies"],"company_size_employees":[10,100],"annual_revenue_usd_millions":[1,25],"geography":["United States","Canada","United Kingdom","Australia"]},"sub_niches":[{"sub_niche_id":"SN-002-A","sub_niche_name":"Growth Marketing Agencies Adding Cold Outreach"},{"sub_niche_id":"SN-002-B","sub_niche_name":"Full-Service B2B Marketing Agencies"}]}'::jsonb
      UNION ALL
      -- Add ICP-003
      SELECT '{"icp_id":"ICP-003","icp_name":"In-House B2B Sales Teams (Mid-Market to Enterprise)","icp_summary":"Internal sales development and outbound sales teams within mid-market to enterprise B2B companies across technology, SaaS, professional services, and financial services industries.","firmographics":{"industries":["B2B SaaS","Enterprise Software","Professional Services","Financial Services"],"company_size_employees":[100,5000],"annual_revenue_usd_millions":[10,500],"geography":["United States","Canada","United Kingdom","Germany"]},"sub_niches":[{"sub_niche_id":"SN-003-A","sub_niche_name":"Mid-Market B2B SaaS Companies"},{"sub_niche_id":"SN-003-B","sub_niche_name":"Professional Services Firms"}]}'::jsonb
    ) combined
  )
)
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';

-- Verify all 3 ICPs are there
SELECT 
  jsonb_array_length(company_report->'phase_data'->'phase_2_icp_report'->'icp_reports') as total_icps,
  company_report->'phase_data'->'phase_2_icp_report'->'icp_reports'->0->>'icp_name' as icp_1,
  company_report->'phase_data'->'phase_2_icp_report'->'icp_reports'->1->>'icp_name' as icp_2,
  company_report->'phase_data'->'phase_2_icp_report'->'icp_reports'->2->>'icp_name' as icp_3
FROM company_profiles
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';
