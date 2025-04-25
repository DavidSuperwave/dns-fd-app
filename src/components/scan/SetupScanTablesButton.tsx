"use client";

import React, { useState } from 'react';
import { Button } from "../ui/button";
import { Database } from "lucide-react";
import { toast } from "sonner";

interface SetupScanTablesButtonProps {
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  fullWidth?: boolean;
}

export const SetupScanTablesButton: React.FC<SetupScanTablesButtonProps> = ({ 
  variant = "default",
  size = "default",
  fullWidth = false
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const setupTables = async () => {
    setIsLoading(true);
    
    try {
      toast.info("Setting up scan tables...");
      
      // Try our dedicated setup endpoint first
      const response = await fetch('/api/supabase/setup-scan-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        toast.success("Scan tables setup complete!");
        window.location.reload(); // Reload the page to see the changes
        return;
      }
      
      // Fall back to direct SQL execution if the first approach fails
      console.warn('Primary setup method failed, trying SQL execution fallback');
      
      const sqlResponse = await fetch('/api/supabase/execute-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: `
            CREATE TABLE IF NOT EXISTS public.scan_results (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              completed_at TIMESTAMP WITH TIME ZONE,
              status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
              error TEXT,
              total_domains INTEGER NOT NULL DEFAULT 0,
              domains_needing_attention INTEGER NOT NULL DEFAULT 0,
              scan_duration_ms INTEGER,
              scan_result JSONB,
              status_breakdown JSONB,
              non_active_domains JSONB
            );
            
            INSERT INTO public.scan_results (status, total_domains, domains_needing_attention, completed_at)
            VALUES ('completed', 0, 0, now())
            ON CONFLICT DO NOTHING;
          `,
          allowTableCreation: true,
          apiKey: 'auto' // This will be replaced server-side
        })
      });
      
      const sqlResult = await sqlResponse.json();
      
      if (sqlResponse.ok && sqlResult.success) {
        toast.success("Scan tables created using SQL fallback!");
        window.location.reload(); // Reload the page to see the changes
      } else {
        toast.error(`Setup failed: ${result.error || sqlResult.error || 'Unknown error'}`);
        console.error('Setup errors:', { mainSetup: result, sqlSetup: sqlResult });
      }
    } catch (error) {
      console.error('Failed to set up scan tables:', error);
      toast.error("Failed to set up scan tables. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={setupTables}
      disabled={isLoading}
      className={fullWidth ? "w-full" : ""}
    >
      {isLoading ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Setting up...
        </>
      ) : (
        <>
          <Database className="mr-2 h-4 w-4" />
          Setup Scan Tables
        </>
      )}
    </Button>
  );
};