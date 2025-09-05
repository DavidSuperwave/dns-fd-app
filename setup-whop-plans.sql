-- Setup Whop Plans in Database
-- Run this in your Supabase SQL Editor to add the Whop plans

INSERT INTO public.billing_plan_templates (
    name, 
    description, 
    included_domain_slots, 
    base_price, 
    price_per_additional_slot, 
    max_domain_slots, 
    billing_cycle, 
    is_custom, 
    is_active, 
    whop_plan_id
) VALUES 
    (
        'Premium Domain Slot', 
        '$50 per domain slot - Premium tier', 
        1, 
        50.00, 
        50.00, 
        null, 
        'per_domain', 
        true, 
        true, 
        'plan_KmHruy3fDVOtP'
    ),
    (
        'Professional Domain Slot', 
        '$40 per domain slot - Professional tier', 
        1, 
        40.00, 
        40.00, 
        null, 
        'per_domain', 
        true, 
        true, 
        'plan_6U0rRsvDL9VvM'
    ),
    (
        'Business Domain Slot', 
        '$30 per domain slot - Business tier', 
        1, 
        30.00, 
        30.00, 
        null, 
        'per_domain', 
        true, 
        true, 
        'plan_4uR7cOFf9Ruxl'
    ),
    (
        'Growth Domain Slot', 
        '$25 per domain slot - Growth tier', 
        1, 
        25.00, 
        25.00, 
        null, 
        'per_domain', 
        true, 
        true, 
        'plan_QRc2RVkLKgK5l'
    ),
    (
        'Starter Domain Slot', 
        '$20 per domain slot - Starter tier', 
        1, 
        20.00, 
        20.00, 
        null, 
        'per_domain', 
        true, 
        true, 
        'plan_xj1hzkSUCPewx'
    ),
    (
        'Basic Domain Slot', 
        '$15 per domain slot - Basic tier', 
        1, 
        15.00, 
        15.00, 
        null, 
        'per_domain', 
        true, 
        true, 
        'plan_ktRtPxomsvkPt'
    )
ON CONFLICT (whop_plan_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    included_domain_slots = EXCLUDED.included_domain_slots,
    base_price = EXCLUDED.base_price,
    price_per_additional_slot = EXCLUDED.price_per_additional_slot,
    max_domain_slots = EXCLUDED.max_domain_slots,
    updated_at = NOW();

-- Verify the plans were added
SELECT 
    name,
    included_domain_slots,
    base_price,
    whop_plan_id,
    is_active
FROM public.billing_plan_templates 
WHERE whop_plan_id IS NOT NULL 
ORDER BY included_domain_slots DESC;
