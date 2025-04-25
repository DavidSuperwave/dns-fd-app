"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useLatestScan } from "../../hooks/useLatestScan";

export function DashboardScanStatus() {
  const { 
    loading, 
    latestScan, 
    scanAge, 
    isRecent,
    hasData,
    error 
  } = useLatestScan();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Domain Scan Status
          {loading && (
            <Badge variant="secondary" className="ml-2">
              Loading...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : hasData && latestScan ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className={`mr-2 h-5 w-5 ${isRecent ? 'text-green-500' : 'text-amber-500'}`} />
                <span className="font-medium">Last scan:</span>
              </div>
              <span className="text-sm">{scanAge}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <div className="text-xs font-medium">Total Domains</div>
                <div className="text-2xl font-bold">{latestScan.total_domains}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs font-medium">Needs Attention</div>
                <div className="text-2xl font-bold">{latestScan.domains_needing_attention}</div>
              </div>
            </div>
            
            {latestScan.scan_duration_ms && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="mr-1 h-3 w-3" />
                Completed in {(latestScan.scan_duration_ms / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <p className="text-sm text-muted-foreground">No scan data available</p>
            <p className="text-xs text-muted-foreground mt-1">Run a scan to check domain status</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}