"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { 
  Globe, 
  Send, 
  CreditCard, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { PurchaseDomainSlot } from "../billing/purchase-domain-slot";

interface DomainStats {
  totalDomains: number;
  usedSlots: number;
  totalSlots: number;
  availableSlots: number;
  sendCapacity: number;
  planName: string;
  status: string;
}

export function DashboardStats() {
  const [stats, setStats] = useState<DomainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch domain count
      const domainsResponse = await fetch('/api/cloudflare/domains');
      const domainsData = await domainsResponse.json();
      
      // Fetch billing info for slots
      const billingResponse = await fetch('/api/billing/check-slots');
      const billingData = await billingResponse.json();

      if (domainsResponse.ok && billingResponse.ok) {
        const totalDomains = domainsData.domains?.length || 0;
        const sendCapacity = totalDomains * 500; // 500 sends per domain
        
        setStats({
          totalDomains,
          usedSlots: billingData.used_slots || 0,
          totalSlots: billingData.total_slots || 0,
          availableSlots: billingData.available_slots || 0,
          sendCapacity,
          planName: billingData.plan_name || 'Free',
          status: billingData.status || 'active'
        });
      } else {
        const domainError = !domainsResponse.ok ? `Domains API: ${domainsData.error || domainsResponse.statusText}` : '';
        const billingError = !billingResponse.ok ? `Billing API: ${billingData.error || billingResponse.statusText}` : '';
        throw new Error(`Failed to fetch stats. ${domainError} ${billingError}`.trim());
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseComplete = () => {
    fetchStats(); // Refresh stats after purchase
    toast.success("Domain slot purchased successfully!");
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center text-destructive">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span>Error loading dashboard stats: {error}</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4"
              onClick={fetchStats}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const usagePercentage = (stats.usedSlots / stats.totalSlots) * 100;
  const isNearLimit = stats.availableSlots <= 2;

  return (
    <div className="space-y-6 mb-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Domain Count & Slots */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Domain Slots</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.usedSlots} / {stats.totalSlots}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {stats.availableSlots} available
              </p>
              <Badge 
                variant={stats.status === 'active' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {stats.planName}
              </Badge>
            </div>
            <Progress value={usagePercentage} className="mt-3" />
            {isNearLimit && (
              <div className="flex items-center mt-2 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {stats.availableSlots === 0 ? 'Limit reached' : 'Nearly full'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send Capacity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Send Capacity</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.sendCapacity.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalDomains} domains × 500 sends each
            </p>
            <div className="flex items-center mt-3 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ready to send
            </div>
          </CardContent>
        </Card>

        {/* Purchase More */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expand Capacity</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              +500
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              sends per new domain slot
            </p>
            <Button 
              className="w-full mt-3" 
              size="sm"
              onClick={() => setShowPurchaseDialog(!showPurchaseDialog)}
              disabled={loading}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {showPurchaseDialog ? 'Hide' : 'Purchase Slot'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Warning Alert */}
      {isNearLimit && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-amber-600 mr-2" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  {stats.availableSlots === 0 
                    ? "You've reached your domain limit" 
                    : `Only ${stats.availableSlots} domain slots remaining`}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Purchase additional slots to add more domains and increase your send capacity.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPurchaseDialog(!showPurchaseDialog)}
                className="ml-4"
              >
                {showPurchaseDialog ? 'Hide' : 'Upgrade'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase Component */}
      {showPurchaseDialog && (
        <PurchaseDomainSlot
          currentSlots={stats.totalSlots}
          availableSlots={stats.availableSlots}
          planName={stats.planName}
          onSlotPurchased={handlePurchaseComplete}
        />
      )}
    </div>
  );
}
