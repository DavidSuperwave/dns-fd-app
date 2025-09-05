-- Domain Billing System Schema
-- This creates the complete billing backend for domain slot management
-- Whop integration will be handled separately for payment processing

BEGIN;

-- 1. Billing Plan Templates (Admin-defined pricing tiers)
CREATE TABLE IF NOT EXISTS public.billing_plan_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- "Starter", "Pro", "Enterprise", "Custom-ClientA"
    description TEXT,
    
    -- Domain & Pricing Structure
    included_domain_slots INTEGER DEFAULT 0, -- Free domains included in base price
    base_price DECIMAL(10,2) NOT NULL, -- Monthly base fee
    price_per_additional_slot DECIMAL(10,2) DEFAULT 0.00, -- Cost per extra domain
    max_domain_slots INTEGER, -- NULL = unlimited
    
    -- Plan Settings
    billing_cycle TEXT DEFAULT 'monthly', -- monthly, yearly, custom
    is_custom BOOLEAN DEFAULT FALSE, -- True for client-specific plans
    is_active BOOLEAN DEFAULT TRUE,
    
    -- External Integration
    whop_plan_id TEXT, -- Whop's plan_XXXXXXXXX ID for payments
    stripe_price_id TEXT, -- Stripe price ID (for future use)
    
    -- Admin Controls
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Billing Plans (Current user subscriptions)
CREATE TABLE IF NOT EXISTS public.billing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    company_id UUID REFERENCES public.companies(id), -- NULL for individual plans
    plan_template_id UUID REFERENCES public.billing_plan_templates(id),
    
    -- Domain Slot Management
    domain_slots_total INTEGER DEFAULT 5,
    domain_slots_used INTEGER DEFAULT 0,
    domain_slots_available INTEGER GENERATED ALWAYS AS (domain_slots_total - domain_slots_used) STORED,
    
    -- Custom Pricing Overrides (admin can override template prices)
    custom_base_price DECIMAL(10,2), -- NULL = use template price
    custom_price_per_slot DECIMAL(10,2), -- NULL = use template price
    custom_domain_limit INTEGER, -- NULL = use template limit
    custom_billing_cycle TEXT, -- NULL = use template cycle
    
    -- Effective Pricing (computed from template + overrides)
    effective_base_price DECIMAL(10,2),
    effective_price_per_slot DECIMAL(10,2),
    effective_domain_limit INTEGER,
    
    -- Payment Provider Integration
    payment_provider TEXT DEFAULT 'manual', -- 'whop', 'stripe', 'manual'
    external_customer_id TEXT, -- Provider's customer ID
    external_subscription_id TEXT, -- Provider's subscription ID
    external_plan_id TEXT, -- Provider's plan/product ID
    
    -- Billing Status & Periods
    status TEXT DEFAULT 'active', -- active, suspended, cancelled, trial
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    next_billing_amount DECIMAL(10,2),
    last_payment_date TIMESTAMP WITH TIME ZONE,
    
    -- Provider-specific metadata
    provider_metadata JSONB DEFAULT '{}',
    
    -- Admin Notes & Tracking
    admin_notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Domain Slot Transactions (Track all slot changes)
CREATE TABLE IF NOT EXISTS public.domain_slot_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_plan_id UUID REFERENCES public.billing_plans(id),
    transaction_type TEXT NOT NULL, -- 'purchase', 'usage', 'release', 'admin_adjustment', 'refund'
    
    -- Slot Changes
    slots_before INTEGER,
    slots_after INTEGER,
    slots_changed INTEGER, -- +5 for purchase, -1 for domain assignment, +1 for domain removal
    
    -- Transaction Details
    amount DECIMAL(10,2), -- Cost for purchases
    currency TEXT DEFAULT 'usd',
    reason TEXT,
    domain_id INTEGER REFERENCES public.domains(id), -- For usage transactions
    
    -- External References
    external_transaction_id TEXT, -- Whop receipt ID, Stripe payment intent, etc.
    payment_provider TEXT,
    
    -- Admin & Tracking
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Billing History (Payment records)
CREATE TABLE IF NOT EXISTS public.billing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_plan_id UUID REFERENCES public.billing_plans(id),
    
    -- Payment Details
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'usd',
    payment_status TEXT NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    payment_method TEXT, -- 'card', 'paypal', 'crypto', 'manual'
    
    -- External Provider Details
    payment_provider TEXT NOT NULL,
    external_transaction_id TEXT,
    external_invoice_id TEXT,
    external_receipt_url TEXT,
    
    -- Billing Period
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    description TEXT,
    provider_response JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Pricing History (Track all pricing changes for audit)
CREATE TABLE IF NOT EXISTS public.pricing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_plan_id UUID REFERENCES public.billing_plans(id),
    change_type TEXT NOT NULL, -- 'plan_change', 'custom_override', 'admin_adjustment', 'slot_purchase'
    
    -- Before/After Values
    old_base_price DECIMAL(10,2),
    new_base_price DECIMAL(10,2),
    old_price_per_slot DECIMAL(10,2),
    new_price_per_slot DECIMAL(10,2),
    old_domain_slots INTEGER,
    new_domain_slots INTEGER,
    old_plan_template_id UUID,
    new_plan_template_id UUID,
    
    -- Change Details
    reason TEXT,
    external_reference TEXT, -- Whop receipt, admin ticket number, etc.
    changed_by UUID REFERENCES auth.users(id),
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_plans_user_id ON public.billing_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_plans_company_id ON public.billing_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_plans_status ON public.billing_plans(status);
CREATE INDEX IF NOT EXISTS idx_billing_plans_payment_provider ON public.billing_plans(payment_provider);

CREATE INDEX IF NOT EXISTS idx_domain_slot_transactions_billing_plan ON public.domain_slot_transactions(billing_plan_id);
CREATE INDEX IF NOT EXISTS idx_domain_slot_transactions_type ON public.domain_slot_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_domain_slot_transactions_created ON public.domain_slot_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_billing_history_billing_plan ON public.billing_history(billing_plan_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_status ON public.billing_history(payment_status);
CREATE INDEX IF NOT EXISTS idx_billing_history_provider ON public.billing_history(payment_provider);

-- 7. Enable Row Level Security
ALTER TABLE public.billing_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_slot_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- Billing Plan Templates - Admins can manage, users can read active ones
CREATE POLICY "Allow admins to manage plan templates" ON public.billing_plan_templates
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Allow users to read active plan templates" ON public.billing_plan_templates
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Billing Plans - Users see their own, admins see all
CREATE POLICY "Allow users to read own billing plans" ON public.billing_plans
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Allow admins to manage billing plans" ON public.billing_plans
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Domain Slot Transactions - Users see their own, admins see all
CREATE POLICY "Allow users to read own slot transactions" ON public.domain_slot_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM billing_plans
            WHERE id = billing_plan_id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Billing History - Users see their own, admins see all
CREATE POLICY "Allow users to read own billing history" ON public.billing_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM billing_plans
            WHERE id = billing_plan_id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Service role policies for API operations
CREATE POLICY "Allow service role full access" ON public.billing_plan_templates
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service role full access" ON public.billing_plans
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service role full access" ON public.domain_slot_transactions
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service role full access" ON public.billing_history
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service role full access" ON public.pricing_history
    FOR ALL TO service_role USING (true);

-- 9. Add unique constraint to name column for conflict resolution
ALTER TABLE public.billing_plan_templates ADD CONSTRAINT billing_plan_templates_name_unique UNIQUE (name);

COMMIT;

-- Insert default plan templates
INSERT INTO public.billing_plan_templates (name, description, included_domain_slots, base_price, price_per_additional_slot, max_domain_slots, is_active)
VALUES 
    ('Starter', 'Perfect for small businesses', 5, 10.00, 2.00, 10, true),
    ('Pro', 'Great for growing companies', 15, 25.00, 2.00, 50, true),
    ('Enterprise', 'Unlimited domains for large organizations', 50, 50.00, 1.00, null, true),
    ('Free Trial', 'Free trial plan', 3, 0.00, 0.00, 3, true)
ON CONFLICT (name) DO NOTHING;
