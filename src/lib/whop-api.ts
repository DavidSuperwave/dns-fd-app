// Whop API integration for plan management
// Based on https://docs.whop.com/api

const WHOP_API_BASE = 'https://api.whop.com/api/v2';
const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WHOP_PRODUCT_ID = 'prod_gBkccTFAkZwYi'; // Your DNS service product

export interface WhopPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_period: 'monthly' | 'yearly' | 'lifetime';
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WhopPlanWithSlots extends WhopPlan {
  domain_slots: number; // We'll store this in metadata.domain_slots
}

class WhopAPIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'WhopAPIError';
  }
}

async function whopRequest(endpoint: string, options: RequestInit = {}) {
  if (!WHOP_API_KEY) {
    throw new Error('WHOP_API_KEY environment variable is not set');
  }

  const url = `${WHOP_API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${WHOP_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || 'Unknown Whop API error';
    } catch {
      errorMessage = errorText || `HTTP ${response.status}`;
    }
    
    throw new WhopAPIError(response.status, errorMessage);
  }

  return response.json();
}

// Fetch all plans from Whop using v2 API
export async function getWhopPlans(): Promise<WhopPlanWithSlots[]> {
  try {
    // V2 API: Get all plans with pagination structure
    const response = await whopRequest(`/plans`);
    
    // V2 API returns { pagination: {...}, data: [...] }
    const plans = response.data || [];
    
    // Filter plans by our product and transform
    const productPlans = plans.filter((plan: any) => plan.product === WHOP_PRODUCT_ID);
    
    return productPlans.map((plan: any): WhopPlanWithSlots => ({
      id: plan.id,
      name: plan.description || plan.payment_link_description || `Plan ${plan.id}`,
      description: plan.description,
      price: parseFloat(plan.renewal_price) * 100, // Convert to cents for consistency
      currency: plan.base_currency,
      billing_period: 'monthly', // V2 uses billing_period in days, normalize to monthly
      metadata: plan.metadata || {},
      created_at: new Date(plan.created_at * 1000).toISOString(),
      updated_at: new Date(plan.created_at * 1000).toISOString(),
      domain_slots: 1, // Each plan represents 1 domain slot purchase
    }));
  } catch (error) {
    console.error('Error fetching Whop plans:', error);
    throw error;
  }
}

// Get a specific plan by ID using v2 API
export async function getWhopPlan(planId: string): Promise<WhopPlanWithSlots> {
  try {
    const data = await whopRequest(`/plans/${planId}`);
    
    return {
      id: data.id,
      name: data.description || data.payment_link_description || `Plan ${data.id}`,
      description: data.description,
      price: parseFloat(data.renewal_price) * 100, // Convert to cents
      currency: data.base_currency,
      billing_period: 'monthly',
      metadata: data.metadata || {},
      created_at: new Date(data.created_at * 1000).toISOString(),
      updated_at: new Date(data.created_at * 1000).toISOString(),
      domain_slots: 1, // Each plan represents 1 domain slot purchase
    };
  } catch (error) {
    console.error(`Error fetching Whop plan ${planId}:`, error);
    throw error;
  }
}

// Create a new plan in Whop (for admin use)
export async function createWhopPlan(planData: {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  billing_period: 'monthly' | 'yearly' | 'lifetime';
  domain_slots: number;
}): Promise<WhopPlanWithSlots> {
  try {
    const data = await whopRequest('/plans', {
      method: 'POST',
      body: JSON.stringify({
        name: planData.name,
        description: planData.description,
        price: planData.price,
        currency: planData.currency || 'usd',
        billing_period: planData.billing_period,
        metadata: {
          domain_slots: planData.domain_slots,
        },
      }),
    });

    return {
      ...data.data,
      domain_slots: planData.domain_slots,
    };
  } catch (error) {
    console.error('Error creating Whop plan:', error);
    throw error;
  }
}

// Update plan metadata (like domain slots)
export async function updateWhopPlanMetadata(
  planId: string, 
  metadata: Record<string, any>
): Promise<WhopPlanWithSlots> {
  try {
    const data = await whopRequest(`/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        metadata,
      }),
    });

    return {
      ...data.data,
      domain_slots: data.data.metadata?.domain_slots || 5,
    };
  } catch (error) {
    console.error(`Error updating Whop plan ${planId}:`, error);
    throw error;
  }
}

// Sync Whop plans to our database
export async function syncWhopPlansToDatabase() {
  const { createAdminClient } = await import('./supabase-admin');
  const supabaseAdmin = createAdminClient();
  
  try {
    const whopPlans = await getWhopPlans();
    
    for (const plan of whopPlans) {
      // Upsert plan template
      const { error } = await supabaseAdmin
        .from('billing_plan_templates')
        .upsert({
          whop_plan_id: plan.id,
          name: plan.name,
          description: plan.description || '',
          included_domain_slots: plan.domain_slots,
          base_price: plan.price / 100, // Whop prices are in cents
          price_per_additional_slot: 2.00, // Default additional slot price
          max_domain_slots: plan.domain_slots * 2, // Allow up to 2x base slots
          billing_cycle: plan.billing_period,
          is_active: true,
          is_custom: false,
          whop_plan_data: plan,
          last_synced_from_whop: new Date().toISOString(),
        }, {
          onConflict: 'whop_plan_id',
        });

      if (error) {
        console.error(`Error syncing plan ${plan.id}:`, error);
      }
    }

    return { success: true, synced_plans: whopPlans.length };
  } catch (error) {
    console.error('Error syncing Whop plans:', error);
    throw error;
  }
}

export { WhopAPIError };
