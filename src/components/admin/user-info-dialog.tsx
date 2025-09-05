"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Globe, 
  CreditCard, 
  Settings, 
  RefreshCw,
  Edit,
  Trash2,
  UserX,
  Plus,
  Minus,
  Calendar,
  DollarSign,
  Crown,
  CheckCircle,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  active: boolean;
  status: string;
  created_at: string;
  has_2fa: boolean;
  domain_count?: number;
}

interface BillingPlan {
  id: string;
  domain_slots_total: number;
  domain_slots_used: number;
  domain_slots_available: number;
  status: string;
  payment_provider: string;
  effective_base_price?: number;
  effective_price_per_slot?: number;
  admin_notes?: string;
  created_at: string;
  billing_plan_templates?: {
    name: string;
    description: string;
  };
}

interface Domain {
  id: number;
  name: string;
  status: string;
  created_on: string;
  redirect_url?: string;
}

interface UserInfoDialogProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: UserProfile) => void;
  onUserDelete: (userId: string) => void;
}

export function UserInfoDialog({ user, isOpen, onClose, onUserUpdate, onUserDelete }: UserInfoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [billingPlan, setBillingPlan] = useState<BillingPlan | null>(null);
  const [userDomains, setUserDomains] = useState<Domain[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Billing adjustment state
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [customBasePrice, setCustomBasePrice] = useState('');
  const [customSlotPrice, setCustomSlotPrice] = useState('');

  // Load user data when dialog opens
  useEffect(() => {
    if (isOpen && user.id) {
      fetchUserData();
    }
  }, [isOpen, user.id]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Fetch billing plan
      const billingResponse = await fetch(`/api/admin/billing/adjust-slots?user_id=${user.id}`);
      const billingData = await billingResponse.json();
      
      if (billingResponse.ok && billingData.billing_plans.length > 0) {
        setBillingPlan(billingData.billing_plans[0]);
        setCustomBasePrice(billingData.billing_plans[0].effective_base_price?.toString() || '');
        setCustomSlotPrice(billingData.billing_plans[0].effective_price_per_slot?.toString() || '');
      } else {
        setBillingPlan(null);
      }

      // Fetch user domains
      const domainsResponse = await fetch(`/api/admin/users/${user.id}/domains`);
      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();
        setUserDomains(domainsData.domains || []);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    try {
      const response = await fetch(`/api/users/refresh-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        toast.success('User status refreshed');
        await fetchUserData();
      } else {
        throw new Error('Failed to refresh status');
      }
    } catch (error) {
      toast.error('Failed to refresh user status');
    }
  };

  const handleToggleStatus = async () => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}/toggle-status`, {
        method: 'POST'
      });

      if (response.ok) {
        const updatedUser = { ...user, active: !user.active };
        onUserUpdate(updatedUser);
        toast.success(`User ${user.active ? 'deactivated' : 'activated'}`);
      } else {
        throw new Error('Failed to toggle status');
      }
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleDeleteUser = async () => {
    if (!confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onUserDelete(user.id);
        onClose();
        toast.success('User deleted successfully');
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleAdjustSlots = async () => {
    if (!adjustmentAmount || isNaN(Number(adjustmentAmount))) {
      toast.error('Please provide a valid adjustment amount');
      return;
    }

    const amount = Number(adjustmentAmount);
    const slotsAdjustment = adjustmentType === 'add' ? amount : -amount;

    if (adjustmentType === 'remove' && billingPlan && amount > billingPlan.domain_slots_total) {
      toast.error('Cannot remove more slots than the user currently has');
      return;
    }

    try {
      const response = await fetch('/api/admin/billing/adjust-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          slots_adjustment: slotsAdjustment,
          reason: adjustmentReason || `Admin ${adjustmentType === 'add' ? 'granted' : 'removed'} ${amount} domain slots`,
          is_free: true,
          admin_notes: adminNotes
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchUserData();
        
        // Reset form
        setAdjustmentAmount('');
        setAdjustmentReason('');
        setAdminNotes('');
      } else {
        throw new Error(data.error || 'Failed to adjust slots');
      }
    } catch (error) {
      console.error('Error adjusting slots:', error);
      toast.error('Failed to adjust domain slots');
    }
  };

  const handleUpdateCustomPricing = async () => {
    if (!billingPlan) {
      toast.error('No billing plan found for this user');
      return;
    }

    try {
      const response = await fetch('/api/admin/billing/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          plan_template_id: billingPlan.billing_plan_templates ? billingPlan.id : null,
          custom_base_price: customBasePrice ? Number(customBasePrice) : null,
          custom_price_per_slot: customSlotPrice ? Number(customSlotPrice) : null,
          admin_notes: `Custom pricing updated by admin`
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Custom pricing updated');
        await fetchUserData();
      } else {
        throw new Error(data.error || 'Failed to update pricing');
      }
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast.error('Failed to update custom pricing');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Information: {user.name || user.email}
          </DialogTitle>
          <DialogDescription>
            Manage user account, domains, and billing settings
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="domains">Domains</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Name</Label>
                    <p className="text-sm text-muted-foreground">{user.name || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Role</Label>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={user.active ? 'default' : 'destructive'}>
                      {user.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">2FA Enabled</Label>
                    <Badge variant={user.has_2fa ? 'default' : 'secondary'}>
                      {user.has_2fa ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Created</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Domains</span>
                    <span className="font-medium">{userDomains.length}</span>
                  </div>
                  {billingPlan && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Domain Slots</span>
                        <span className="font-medium">
                          {billingPlan.domain_slots_used}/{billingPlan.domain_slots_total}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Monthly Cost</span>
                        <span className="font-medium">
                          ${billingPlan.effective_base_price || 0}/month
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  User Domains ({userDomains.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userDomains.length > 0 ? (
                  <div className="space-y-2">
                    {userDomains.map((domain) => (
                      <div key={domain.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{domain.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Status: {domain.status} • Created: {new Date(domain.created_on).toLocaleDateString()}
                          </p>
                          {domain.redirect_url && (
                            <p className="text-sm text-muted-foreground">
                              Redirects to: {domain.redirect_url}
                            </p>
                          )}
                        </div>
                        <Badge variant={domain.status === 'active' ? 'default' : 'secondary'}>
                          {domain.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No domains found for this user
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            {billingPlan ? (
              <div className="space-y-4">
                {/* Current Plan Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Current Billing Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-700">{billingPlan.domain_slots_total}</div>
                        <div className="text-sm text-blue-600">Total Slots</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-700">{billingPlan.domain_slots_used}</div>
                        <div className="text-sm text-orange-600">Used Slots</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-700">{billingPlan.domain_slots_available}</div>
                        <div className="text-sm text-green-600">Available</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <Label className="text-sm font-medium">Plan Type</Label>
                        <p className="text-sm text-muted-foreground">
                          {billingPlan.billing_plan_templates?.name || 'Custom Plan'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Payment Provider</Label>
                        <p className="text-sm text-muted-foreground">{billingPlan.payment_provider}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Monthly Base Fee</Label>
                        <p className="text-sm text-muted-foreground">
                          ${billingPlan.effective_base_price || 0}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Price per Extra Slot</Label>
                        <p className="text-sm text-muted-foreground">
                          ${billingPlan.effective_price_per_slot || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Slot Adjustment */}
                <Card>
                  <CardHeader>
                    <CardTitle>Adjust Domain Slots</CardTitle>
                    <CardDescription>
                      Add or remove domain slots for this user
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      
                      <div>
                        <Label>Number of Slots</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="5"
                          value={adjustmentAmount}
                          onChange={(e) => setAdjustmentAmount(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Reason</Label>
                      <Input
                        placeholder="Free slots for new customer"
                        value={adjustmentReason}
                        onChange={(e) => setAdjustmentReason(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Admin Notes</Label>
                      <Textarea
                        placeholder="Additional notes about this adjustment..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                      />
                    </div>

                    <Button 
                      onClick={handleAdjustSlots}
                      disabled={!adjustmentAmount}
                      className="w-full"
                    >
                      {adjustmentType === 'add' ? 'Add Slots' : 'Remove Slots'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Custom Pricing */}
                <Card>
                  <CardHeader>
                    <CardTitle>Custom Pricing</CardTitle>
                    <CardDescription>
                      Set custom pricing for this specific user
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Monthly Base Price ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="25.00"
                          value={customBasePrice}
                          onChange={(e) => setCustomBasePrice(e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <Label>Price per Additional Slot ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="2.00"
                          value={customSlotPrice}
                          onChange={(e) => setCustomSlotPrice(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleUpdateCustomPricing}
                      variant="outline"
                      className="w-full"
                    >
                      Update Custom Pricing
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No billing plan found for this user. Domain slot adjustments will create a new plan.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Actions</CardTitle>
                <CardDescription>
                  Perform administrative actions on this user account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleRefreshStatus}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh Status
                  </Button>

                  <Button 
                    onClick={handleToggleStatus}
                    variant={user.active ? "destructive" : "default"}
                    className="flex items-center gap-2"
                  >
                    <UserX className="h-4 w-4" />
                    {user.active ? 'Deactivate' : 'Activate'} User
                  </Button>

                  <Button 
                    onClick={() => {/* TODO: Implement edit */}}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit User
                  </Button>

                  <Button 
                    onClick={handleDeleteUser}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete User
                  </Button>
                </div>

                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Deactivating or deleting a user will affect their ability to access the system and manage their domains.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
