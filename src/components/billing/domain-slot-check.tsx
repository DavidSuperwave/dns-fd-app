"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CreditCard, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface DomainSlotInfo {
  available_slots: number;
  total_slots: number;
  used_slots: number;
  plan_name: string;
  status: string;
  billing_plan_id?: string;
  next_billing_amount?: number;
  upgrade_needed?: boolean;
}

interface DomainSlotCheckProps {
  onSlotAvailable: () => void;
  onUpgradeNeeded: () => void;
  children?: React.ReactNode;
}

export function DomainSlotCheck({ onSlotAvailable, onUpgradeNeeded, children }: DomainSlotCheckProps) {
  const [slotInfo, setSlotInfo] = useState<DomainSlotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlotInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/billing/check-slots');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check domain slots');
      }

      setSlotInfo(data);
      setError(null);
    } catch (err) {
      console.error('Error checking domain slots:', err);
      setError(err instanceof Error ? err.message : 'Failed to check domain slots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlotInfo();
  }, []);

  const handleProceed = async () => {
    if (!slotInfo) return;

    if (slotInfo.available_slots <= 0) {
      onUpgradeNeeded();
    } else {
      onSlotAvailable();
    }
  };

  const usagePercentage = slotInfo ? (slotInfo.used_slots / slotInfo.total_slots) * 100 : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2">Checking domain slots...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={fetchSlotInfo}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!slotInfo) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Domain Slots Usage
        </CardTitle>
        <CardDescription>
          Current plan: {slotInfo.plan_name} • Status: {slotInfo.status}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Used: {slotInfo.used_slots} / {slotInfo.total_slots} domains</span>
            <span>{slotInfo.available_slots} available</span>
          </div>
          <Progress 
            value={usagePercentage} 
            className={`h-2 ${usagePercentage >= 90 ? 'bg-red-100' : usagePercentage >= 70 ? 'bg-yellow-100' : 'bg-green-100'}`}
          />
        </div>

        {/* Status Messages */}
        {slotInfo.available_slots <= 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You've reached your domain limit. Upgrade your plan to add more domains.
            </AlertDescription>
          </Alert>
        )}

        {slotInfo.available_slots > 0 && slotInfo.available_slots <= 2 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You're running low on domain slots. Consider upgrading your plan.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {slotInfo.available_slots > 0 ? (
            <Button onClick={handleProceed} className="flex-1">
              Continue Adding Domain
            </Button>
          ) : (
            <Button onClick={onUpgradeNeeded} className="flex-1">
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          )}
          
          <Button variant="outline" onClick={fetchSlotInfo}>
            Refresh
          </Button>
        </div>

        {/* Additional Content */}
        {children}
      </CardContent>
    </Card>
  );
}

// Hook for using domain slots
export function useDomainSlots() {
  const [slotInfo, setSlotInfo] = useState<DomainSlotInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const checkSlots = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/check-slots');
      const data = await response.json();
      
      if (response.ok) {
        setSlotInfo(data);
        return data;
      } else {
        throw new Error(data.error || 'Failed to check slots');
      }
    } catch (error) {
      console.error('Error checking slots:', error);
      toast.error('Failed to check domain slots');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const useSlot = async (domainId: string, domainName: string) => {
    try {
      const response = await fetch('/api/billing/use-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: domainId,
          domain_name: domainName,
          action: 'assign'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSlotInfo(prev => prev ? {
          ...prev,
          used_slots: data.used_slots,
          available_slots: data.available_slots
        } : null);
        return data;
      } else {
        if (data.upgrade_needed) {
          toast.error('No available domain slots. Please upgrade your plan.');
          return { upgrade_needed: true };
        }
        throw new Error(data.error || 'Failed to use domain slot');
      }
    } catch (error) {
      console.error('Error using domain slot:', error);
      toast.error('Failed to allocate domain slot');
      return null;
    }
  };

  const releaseSlot = async (domainId: string, domainName: string) => {
    try {
      const response = await fetch('/api/billing/use-slot', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: domainId,
          domain_name: domainName,
          action: 'remove'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSlotInfo(prev => prev ? {
          ...prev,
          used_slots: data.used_slots,
          available_slots: data.available_slots
        } : null);
        return data;
      } else {
        throw new Error(data.error || 'Failed to release domain slot');
      }
    } catch (error) {
      console.error('Error releasing domain slot:', error);
      toast.error('Failed to release domain slot');
      return null;
    }
  };

  return {
    slotInfo,
    loading,
    checkSlots,
    useSlot,
    releaseSlot
  };
}
