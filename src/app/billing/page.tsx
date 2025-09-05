"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/components/auth/auth-provider';
import { 
  CreditCard, 
  Zap, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  AlertTriangle,
  Crown,
  Globe,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { PurchaseDomainSlot } from '@/components/billing/purchase-domain-slot';

interface BillingInfo {
  available_slots: number;
  total_slots: number;
  used_slots: number;
  plan_name: string;
  status: string;
  billing_plan_id?: string;
  next_billing_amount?: number;
  current_period_end?: string;
}

interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  included_domain_slots: number;
  base_price: number;
  price_per_additional_slot: number;
  max_domain_slots: number | null;
  whop_plan_id?: string;
}

export default function BillingPage() {
  const { user, isAdmin } = useAuth();
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingInfo();
    fetchPlanTemplates();
  }, []);

  const fetchBillingInfo = async () => {
    try {
      const response = await fetch('/api/billing/check-slots');
      const data = await response.json();

      if (response.ok) {
        setBillingInfo(data);
      } else {
        throw new Error(data.error || 'Failed to fetch billing info');
      }
    } catch (err) {
      console.error('Error fetching billing info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch billing info');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanTemplates = async () => {
    try {
      // For now, we'll use static plan data
      // Later, this will fetch from /api/billing/plans/templates
      setPlanTemplates([
        {
          id: 'starter',
          name: 'Starter',
          description: 'Perfect for small businesses',
          included_domain_slots: 5,
          base_price: 10,
          price_per_additional_slot: 2,
          max_domain_slots: 10,
          whop_plan_id: 'plan_starter123'
        },
        {
          id: 'pro',
          name: 'Pro',
          description: 'Great for growing companies',
          included_domain_slots: 15,
          base_price: 25,
          price_per_additional_slot: 2,
          max_domain_slots: 50,
          whop_plan_id: 'plan_pro456'
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'Unlimited domains for large organizations',
          included_domain_slots: 50,
          base_price: 50,
          price_per_additional_slot: 1,
          max_domain_slots: null,
          whop_plan_id: 'plan_enterprise789'
        }
      ]);
    } catch (err) {
      console.error('Error fetching plan templates:', err);
    }
  };

  const handleUpgrade = (planId: string) => {
    // For now, just show a toast
    // Later, this will integrate with Whop checkout
    toast.info(`Upgrade to ${planId} plan - Whop integration coming soon!`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-3">Loading billing information...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2"
                onClick={fetchBillingInfo}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const usagePercentage = billingInfo ? (billingInfo.used_slots / billingInfo.total_slots) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage your domain slots and billing information.
          </p>
        </div>

        {/* Current Plan Overview */}
        {billingInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                <Crown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billingInfo.plan_name}</div>
                <Badge variant={billingInfo.status === 'active' ? 'default' : 'secondary'}>
                  {billingInfo.status}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Domain Slots</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {billingInfo.used_slots} / {billingInfo.total_slots}
                </div>
                <p className="text-xs text-muted-foreground">
                  {billingInfo.available_slots} available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usage</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(usagePercentage)}%</div>
                <Progress value={usagePercentage} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${billingInfo.next_billing_amount || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {billingInfo.current_period_end ? 
                    new Date(billingInfo.current_period_end).toLocaleDateString() : 
                    'Not scheduled'
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Usage Alert */}
        {billingInfo && billingInfo.available_slots <= 2 && (
          <Alert variant={billingInfo.available_slots === 0 ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {billingInfo.available_slots === 0 ? 
                "You've reached your domain limit. Upgrade your plan to add more domains." :
                `You only have ${billingInfo.available_slots} domain slots remaining. Consider upgrading your plan.`
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Purchase Domain Slot */}
        {billingInfo && (
          <PurchaseDomainSlot
            currentSlots={billingInfo.total_slots}
            availableSlots={billingInfo.available_slots}
            planName={billingInfo.plan_name}
            onSlotPurchased={fetchBillingInfo}
          />
        )}

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>
              Your domain slot purchases and billing history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No billing history available yet.</p>
              <p className="text-sm">Your domain slot purchases will appear here.</p>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Billing */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Billing</CardTitle>
            <CardDescription>
              Your next scheduled payments and renewals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming billing scheduled.</p>
              <p className="text-sm">Domain slots are purchased individually as needed.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
