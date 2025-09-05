"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart, CreditCard, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface PurchaseDomainSlotProps {
  currentSlots: number;
  availableSlots: number;
  planName: string;
  onSlotPurchased: () => void;
}

export function PurchaseDomainSlot({ 
  currentSlots, 
  availableSlots, 
  planName, 
  onSlotPurchased 
}: PurchaseDomainSlotProps) {
  const [loading, setLoading] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState<{
    session_id: string;
    checkout_url: string;
    price: number;
    plan_name: string;
  } | null>(null);

  const handlePurchaseClick = async () => {
    try {
      setLoading(true);
      
      // Create Whop session
      const response = await fetch('/api/billing/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      setPurchaseInfo(data);
      
      // Open checkout in new tab
      window.open(data.checkout_url, '_blank');
      
      toast.success('Checkout opened in new tab');

    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!purchaseInfo) return;

    try {
      setLoading(true);

      // Prompt user for receipt confirmation
      const confirmed = confirm(
        'Have you completed the payment? Click OK if you have successfully paid, or Cancel to return to checkout.'
      );

      if (!confirmed) {
        // Reopen checkout
        window.open(purchaseInfo.checkout_url, '_blank');
        return;
      }

      // Simulate receipt ID (in real implementation, this would come from Whop callback)
      const mockReceiptId = `receipt_${Date.now()}`;

      // Add domain slot
      const response = await fetch('/api/billing/add-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_id: mockReceiptId,
          session_id: purchaseInfo.session_id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add domain slot');
      }

      toast.success(`Domain slot added! You now have ${data.new_total_slots} total slots.`);
      setPurchaseInfo(null);
      onSlotPurchased();

    } catch (error) {
      console.error('Error adding domain slot:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add domain slot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Purchase Domain Slot
        </CardTitle>
        <CardDescription>
          Current Plan: {planName} • {currentSlots} total slots • {availableSlots} available
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableSlots > 0 && (
          <Alert>
            <AlertDescription>
              You still have {availableSlots} available slots. You only need to purchase more if you want to add more than {availableSlots} additional domains.
            </AlertDescription>
          </Alert>
        )}

        {!purchaseInfo ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Each purchase adds 1 domain slot to your account at your assigned tier pricing.
            </div>
            
            <Button 
              onClick={handlePurchaseClick}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {loading ? 'Creating Checkout...' : 'Purchase 1 Domain Slot'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <ExternalLink className="h-4 w-4" />
              <AlertDescription>
                Checkout opened in new tab for {purchaseInfo.plan_name} (${purchaseInfo.price})
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                onClick={handleConfirmPayment}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Adding Slot...' : 'I Completed Payment'}
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => window.open(purchaseInfo.checkout_url, '_blank')}
              >
                Reopen Checkout
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setPurchaseInfo(null)}
              className="w-full"
            >
              Cancel Purchase
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
