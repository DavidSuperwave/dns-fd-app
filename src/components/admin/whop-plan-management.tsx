"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  RefreshCw, 
  ExternalLink, 
  CreditCard, 
  Globe,
  RotateCw,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { SetupWhopPlansButton } from './setup-whop-plans-button';

interface WhopPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_period: string;
  domain_slots: number;
  created_at: string;
}

interface DatabasePlan {
  id: string;
  name: string;
  whop_plan_id: string;
  included_domain_slots: number;
  base_price: number;
  last_synced_from_whop?: string;
  is_active: boolean;
}

interface SyncStatus {
  whop_count: number;
  database_count: number;
  needs_sync: boolean;
}

interface PlanData {
  whop_plans: WhopPlan[];
  database_plans: DatabasePlan[];
  sync_status: SyncStatus;
}

export function WhopPlanManagement() {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedPlanForUser, setSelectedPlanForUser] = useState<string>('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const fetchPlanData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/billing/sync-whop-plans');
      const data = await response.json();

      if (response.ok) {
        setPlanData(data);
      } else {
        throw new Error(data.error || 'Failed to fetch plan data');
      }
    } catch (error) {
      console.error('Error fetching plan data:', error);
      toast.error('Failed to fetch Whop plans');
    } finally {
      setLoading(false);
    }
  };

  const syncPlans = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/billing/sync-whop-plans', {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchPlanData(); // Refresh data
      } else {
        throw new Error(data.error || 'Failed to sync plans');
      }
    } catch (error) {
      console.error('Error syncing plans:', error);
      toast.error('Failed to sync Whop plans');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchPlanData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2">Loading Whop plans...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!planData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load Whop plan data. Please check your Whop API configuration.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Sync Status */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Whop Plan Management
              </CardTitle>
              <CardDescription>
                Manage billing plans from Whop and assign them to users
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <SetupWhopPlansButton />
              <Button variant="outline" onClick={fetchPlanData} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={syncPlans} disabled={syncing || loading}>
                <RotateCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync from Whop'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{planData.sync_status.whop_count}</div>
              <div className="text-sm text-blue-600">Whop Plans</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{planData.sync_status.database_count}</div>
              <div className="text-sm text-green-600">Synced Plans</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-center">
                {planData.sync_status.needs_sync ? (
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {planData.sync_status.needs_sync ? 'Needs Sync' : 'In Sync'}
              </div>
            </div>
          </div>

          {planData.sync_status.needs_sync && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your Whop plans are out of sync with the database. Click "Sync from Whop" to update.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Whop Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Whop Plans</CardTitle>
          <CardDescription>
            Plans fetched directly from your Whop dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {planData.whop_plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No plans found in Whop.</p>
              <p className="text-sm">Create plans in your Whop dashboard first.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Domain Slots</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Sync Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planData.whop_plans.map((plan) => {
                  const isSynced = planData.database_plans.some(db => db.whop_plan_id === plan.id);
                  const syncedPlan = planData.database_plans.find(db => db.whop_plan_id === plan.id);
                  
                  return (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{plan.name}</div>
                          <div className="text-sm text-muted-foreground">{plan.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          ${(plan.price / 100).toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {plan.currency.toUpperCase()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {plan.domain_slots}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {plan.billing_period}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isSynced ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">Synced</span>
                            {syncedPlan?.last_synced_from_whop && (
                              <div className="text-xs text-muted-foreground">
                                {new Date(syncedPlan.last_synced_from_whop).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-orange-600">Not Synced</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://whop.com/dashboard/plans/${plan.id}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          {isSynced && (
                            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm"
                                  onClick={() => setSelectedPlanForUser(plan.id)}
                                >
                                  Assign
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Assign Plan to User</DialogTitle>
                                  <DialogDescription>
                                    Select a user to assign the {plan.name} plan to
                                  </DialogDescription>
                                </DialogHeader>
                                {/* User selection will be implemented later */}
                                <div className="py-4">
                                  <p className="text-sm text-muted-foreground">
                                    User assignment interface coming soon...
                                  </p>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p><strong>1. Create Plans in Whop:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Go to your Whop dashboard and create billing plans</li>
              <li>Set the plan name, price, and billing period</li>
              <li>Add <code>domain_slots</code> to the plan metadata (e.g., 5, 10, 25)</li>
            </ul>
            
            <p><strong>2. Sync Plans:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Click "Sync from Whop" to import your plans</li>
              <li>Plans will be available for assignment to users</li>
            </ul>

            <p><strong>3. Assign to Users:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Use the "View Info" button on users to assign plans</li>
              <li>Domain slots will be automatically managed based on plan limits</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
