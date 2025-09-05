"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  CheckCircle, 
  AlertTriangle,
  Zap,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';

interface PredefinedPlan {
  name: string;
  description: string;
  included_domain_slots: number;
  base_price: number;
  whop_plan_id: string;
}

export function SetupWhopPlansButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<{
    predefined_plans: PredefinedPlan[];
    database_plans: any[];
    setup_needed: boolean;
  } | null>(null);

  const fetchSetupData = async () => {
    try {
      const response = await fetch('/api/admin/billing/setup-whop-plans');
      const data = await response.json();
      
      if (response.ok) {
        setSetupData(data);
      } else {
        throw new Error(data.error || 'Failed to fetch setup data');
      }
    } catch (error) {
      console.error('Error fetching setup data:', error);
      toast.error('Failed to load plan setup data');
    }
  };

  const handleSetupPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/billing/setup-whop-plans', {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchSetupData(); // Refresh data
      } else {
        throw new Error(data.error || 'Failed to setup plans');
      }
    } catch (error) {
      console.error('Error setting up plans:', error);
      toast.error('Failed to setup Whop plans');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpen = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      fetchSetupData();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Setup Whop Plans
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Setup Whop Billing Plans
          </DialogTitle>
          <DialogDescription>
            Configure your predefined Whop plans with domain slot allocations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {setupData && (
            <>
              {/* Current Status */}
              <Alert variant={setupData.setup_needed ? "default" : "default"}>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {setupData.setup_needed 
                    ? `Found ${setupData.predefined_plans.length} predefined plans ready to setup`
                    : `${setupData.database_plans.length} Whop plans already configured in database`
                  }
                </AlertDescription>
              </Alert>

              {/* Predefined Plans Preview */}
              <div>
                <h4 className="font-medium mb-3">Predefined Plans</h4>
                <div className="space-y-2">
                  {setupData.predefined_plans.map((plan, index) => (
                    <div key={plan.whop_plan_id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{index + 1}</Badge>
                        <div>
                          <div className="font-medium">{plan.name}</div>
                          <div className="text-sm text-muted-foreground">{plan.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4" />
                          <span className="font-medium">{plan.included_domain_slots} slots</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${plan.base_price}/month
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan IDs */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h5 className="font-medium text-sm mb-2">Whop Plan IDs</h5>
                <div className="grid grid-cols-1 gap-1 text-xs font-mono">
                  {setupData.predefined_plans.map((plan) => (
                    <div key={plan.whop_plan_id} className="flex justify-between">
                      <span>{plan.name}:</span>
                      <span className="text-blue-600">{plan.whop_plan_id}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Setup Button */}
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleSetupPlans}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Setting up...' : 'Setup All Plans'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
              </div>

              {setupData.database_plans.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Setting up plans will update existing plans with the same Whop plan IDs.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {!setupData && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="ml-2">Loading setup data...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
