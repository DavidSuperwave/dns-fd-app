"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
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
  Settings, 
  Plus, 
  Minus, 
  Search, 
  User, 
  Crown,
  Globe,
  Calendar,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface BillingPlan {
  id: string;
  domain_slots_total: number;
  domain_slots_used: number;
  domain_slots_available: number;
  status: string;
  payment_provider: string;
  admin_notes?: string;
  created_at: string;
  user_profiles: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
  billing_plan_templates?: {
    name: string;
    description: string;
  };
}

export function UserSlotManagement() {
  const [searchEmail, setSearchEmail] = useState('');
  const [userBillingPlans, setUserBillingPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  
  // Adjustment form state
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const searchUserPlans = async () => {
    if (!searchEmail.trim()) {
      toast.error('Please enter a user email');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/billing/adjust-slots?email=${encodeURIComponent(searchEmail)}`);
      const data = await response.json();

      if (response.ok) {
        setUserBillingPlans(data.billing_plans);
        if (data.billing_plans.length === 0) {
          toast.info('No billing plans found for this user');
        }
      } else {
        throw new Error(data.error || 'Failed to fetch user plans');
      }
    } catch (error) {
      console.error('Error searching user plans:', error);
      toast.error('Failed to fetch user billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSlots = async () => {
    if (!selectedPlan || !adjustmentAmount || isNaN(Number(adjustmentAmount))) {
      toast.error('Please provide a valid adjustment amount');
      return;
    }

    const amount = Number(adjustmentAmount);
    const slotsAdjustment = adjustmentType === 'add' ? amount : -amount;

    if (adjustmentType === 'remove' && amount > selectedPlan.domain_slots_total) {
      toast.error('Cannot remove more slots than the user currently has');
      return;
    }

    setAdjusting(true);
    try {
      const response = await fetch('/api/admin/billing/adjust-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedPlan.user_profiles.id,
          slots_adjustment: slotsAdjustment,
          reason: adjustmentReason || `Admin ${adjustmentType === 'add' ? 'granted' : 'removed'} ${amount} domain slots`,
          is_free: true, // Admin adjustments are free by default
          admin_notes: adminNotes
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        
        // Update the local state
        setUserBillingPlans(prev => prev.map(plan => 
          plan.id === selectedPlan.id 
            ? { ...plan, domain_slots_total: data.slots_after, domain_slots_available: data.available_slots }
            : plan
        ));

        // Reset form
        setAdjustmentAmount('');
        setAdjustmentReason('');
        setAdminNotes('');
        setIsDialogOpen(false);
      } else {
        throw new Error(data.error || 'Failed to adjust slots');
      }
    } catch (error) {
      console.error('Error adjusting slots:', error);
      toast.error('Failed to adjust domain slots');
    } finally {
      setAdjusting(false);
    }
  };

  const openAdjustmentDialog = (plan: BillingPlan) => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            User Domain Slot Management
          </CardTitle>
          <CardDescription>
            Search and manage domain slots for users. You can give users free slots or adjust their limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="search-email">User Email</Label>
              <Input
                id="search-email"
                placeholder="user@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUserPlans()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={searchUserPlans} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {userBillingPlans.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">User Billing Plans</h3>
          
          {userBillingPlans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {plan.user_profiles.name || plan.user_profiles.email}
                    </CardTitle>
                    <CardDescription>
                      {plan.user_profiles.email} • Role: {plan.user_profiles.role}
                    </CardDescription>
                  </div>
                  <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Slot Usage */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <Globe className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <div className="text-2xl font-bold text-blue-700">{plan.domain_slots_total}</div>
                    <div className="text-sm text-blue-600">Total Slots</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <Crown className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                    <div className="text-2xl font-bold text-orange-700">{plan.domain_slots_used}</div>
                    <div className="text-sm text-orange-600">Used Slots</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
                    <div className="text-2xl font-bold text-green-700">{plan.domain_slots_available}</div>
                    <div className="text-sm text-green-600">Available</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Calendar className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                    <div className="text-sm font-medium text-gray-700">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-600">Created</div>
                  </div>
                </div>

                {/* Plan Info */}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Plan: {plan.billing_plan_templates?.name || 'Custom'} • 
                      Provider: {plan.payment_provider}
                    </p>
                    {plan.admin_notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Notes: {plan.admin_notes}
                      </p>
                    )}
                  </div>
                  <Button 
                    onClick={() => openAdjustmentDialog(plan)}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Adjust Slots
                  </Button>
                </div>

                {/* Usage Alert */}
                {plan.domain_slots_available <= 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      User has no available domain slots. They cannot add more domains.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Adjustment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Domain Slots</DialogTitle>
            <DialogDescription>
              Modify domain slots for {selectedPlan?.user_profiles.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Status */}
            {selectedPlan && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Current: {selectedPlan.domain_slots_used}/{selectedPlan.domain_slots_total} slots used
                  ({selectedPlan.domain_slots_available} available)
                </AlertDescription>
              </Alert>
            )}

            {/* Adjustment Type */}
            <div>
              <Label>Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={(value: 'add' | 'remove') => setAdjustmentType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Slots
                    </div>
                  </SelectItem>
                  <SelectItem value="remove">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4" />
                      Remove Slots
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="adjustment-amount">Number of Slots</Label>
              <Input
                id="adjustment-amount"
                type="number"
                min="1"
                placeholder="5"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
              />
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="adjustment-reason">Reason (Optional)</Label>
              <Input
                id="adjustment-reason"
                placeholder="Free slots for new customer"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
              />
            </div>

            {/* Admin Notes */}
            <div>
              <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
              <Textarea
                id="admin-notes"
                placeholder="Additional notes about this adjustment..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdjustSlots} 
              disabled={adjusting || !adjustmentAmount}
              className="flex items-center gap-2"
            >
              {adjusting ? 'Adjusting...' : (
                <>
                  {adjustmentType === 'add' ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  {adjustmentType === 'add' ? 'Add Slots' : 'Remove Slots'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
