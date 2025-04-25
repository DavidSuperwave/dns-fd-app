"use client";

import React from 'react';
import { Button } from "../ui/button";
import { RefreshCw } from "lucide-react";
import { useBackgroundScan } from "../../hooks/useBackgroundScan";
import { toast } from "sonner";

export function ScanDomainsButton() {
  const { 
    scanInProgress,
    progressPercentage,
    startScan 
  } = useBackgroundScan();

  const handleScan = async () => {
    try {
      toast.info('Starting domain scan...');
      await startScan(50); // Scan 50 domains per page
    } catch (error) {
      console.error('Failed to start scan:', error);
      toast.error('Failed to start scan');
    }
  };

  if (scanInProgress) {
    return (
      <div className="bg-primary/10 text-primary px-4 py-2 rounded-md flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Scanning {progressPercentage}%</span>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      onClick={handleScan}
      className="flex items-center gap-2"
    >
      <RefreshCw className="h-4 w-4" />
      Scan Domains
    </Button>
  );
}