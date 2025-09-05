"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';

export function SetupInvitationsButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/setup/create-invitations-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === 'invitations table does not exist') {
          toast.error('Database setup required', {
            description: 'Please run the SQL script in Supabase SQL editor. Check console for details.',
          });
          console.log('SQL Script to run in Supabase:', result.sql);
        } else {
          throw new Error(result.error || 'Setup failed');
        }
        return;
      }

      toast.success('Invitations table setup completed!');
    } catch (error) {
      console.error('Setup error:', error);
      toast.error(error instanceof Error ? error.message : 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheck = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/setup/create-invitations-table');
      const result = await response.json();

      if (result.exists) {
        toast.success('Invitations table exists and is ready!');
      } else {
        toast.warning('Invitations table does not exist. Click Setup to create it.');
      }
    } catch (error) {
      console.error('Check error:', error);
      toast.error('Failed to check table status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleCheck}
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        <Settings className="h-4 w-4 mr-2" />
        Check Invitations Table
      </Button>
      <Button
        onClick={handleSetup}
        disabled={isLoading}
        variant="default"
        size="sm"
      >
        <Settings className="h-4 w-4 mr-2" />
        {isLoading ? 'Setting up...' : 'Setup Invitations Table'}
      </Button>
    </div>
  );
}
