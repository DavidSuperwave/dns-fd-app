"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { useInterval } from "../../hooks/useInterval";
import { Button } from "../../components/ui/button";
import { AlertCircle, CheckCircle, Clock, Plus } from "lucide-react"; // Removed RefreshCw, Database
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { supabase } from "../../lib/supabase-client";
import { toast } from "sonner";
import { useAuth } from "../../components/auth/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { ScanProgressCard } from "../../components/scan/ScanProgressCard";

interface SyncRecord {
  id: number;
  timestamp: string;
  domains_count: number;
  success: boolean;
  error_message?: string;
  duration_ms?: number;
  status: string; // Add missing status property
}

export default function CronMonitorPage() {
  const { session, isAdmin } = useAuth();
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  // const [isRefreshing, setIsRefreshing] = useState(false); // Unused state
  const [nextScheduledTime, setNextScheduledTime] = useState<Date | null>(null);
  const [tablesExist, setTablesExist] = useState<boolean | null>(null);

  // Setup Supabase client

  // Calculate the next scheduled sync time (top of the next hour)
  useEffect(() => {
    const calculateNextSyncTime = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1);
      nextHour.setMinutes(0);
      nextHour.setSeconds(0);
      nextHour.setMilliseconds(0);
      setNextScheduledTime(nextHour);
    };

    calculateNextSyncTime();
    const interval = setInterval(calculateNextSyncTime, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  // Fetch sync history
  const fetchSyncHistory = useCallback(async () => {
    try {
      // setIsLoading(true); // Avoid resetting loading state on refresh

      // First check if the tables exist
      const { error: domainsError } = await supabase
        .from('domains')
        .select('id')
        .limit(1);
      
      const domainsTableExists = !domainsError || domainsError.code !== '42P01';

      const { error: syncError } = await supabase
        .from('sync_history')
        .select('id', { count: 'exact', head: true });

      const syncTableExists = !syncError || syncError.code !== '42P01';
      
      // Set the tables exist state
      const bothTablesExist = domainsTableExists && syncTableExists;
      setTablesExist(bothTablesExist);
      
      if (!bothTablesExist) {
        setIsLoading(false);
        setSyncHistory([]);
        return;
      }
      
      // Get sync history from Supabase
      const { data, error } = await supabase
        .from('sync_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Error fetching sync history:', error);
        toast.error('Failed to load sync history');
        return;
      }
      
      setSyncHistory(data || []);
    } catch (error) {
      console.error('Error fetching sync history:', error);
      toast.error('Failed to load sync history');
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed supabase dependency

  // Trigger manual full sync
  const triggerFullSync = async () => {
    if (!session) {
      toast.error('You must be logged in to trigger a sync');
      return;
    }

    try {
      setIsTriggeringSync(true);
      toast.info('Starting full domain synchronization...');
      
      // Create a key for the API call
      const cronSecret = 'dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3';
      
      const response = await fetch('/api/cron/sync?debug=true&full=true', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start full sync');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Full sync started successfully!');
        
        // Wait a moment before refreshing the history
        setTimeout(() => {
          fetchSyncHistory();
        }, 1000);
      } else {
        throw new Error(result.error || 'Unknown error starting sync');
      }
    } catch (error) {
      console.error('Error triggering full sync:', error);
      toast.error(`Full sync failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTriggeringSync(false);
    }
  };

  // Legacy manual sync (for backward compatibility) - Removed as unused
  /* const triggerManualSync = async () => {
    if (!session) {
      toast.error('You must be logged in to trigger a sync');
      return;
    }

    try {
      setIsTriggeringSync(true);
      toast.info('Triggering manual sync...');
      
      const response = await fetch('/api/cron/manual-sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger sync');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Sync completed successfully! ${result.message}`);
        
        // Wait a moment before refreshing the history to allow the database to update
        setTimeout(() => {
          fetchSyncHistory();
        }, 1000);
      } else {
        throw new Error(result.error || 'Unknown error during sync');
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTriggeringSync(false);
    }
  }; */

  // Initiate Vercel cron simulator
  // Memoize fetchSyncHistory to use with useInterval
  const fetchSyncHistoryCallback = useCallback(fetchSyncHistory, [fetchSyncHistory, supabase]); // Add supabase dependency

  // Auto-refresh every 5 seconds while a sync is in progress
  useInterval(
    fetchSyncHistoryCallback,
    isTriggeringSync ? 5000 : null
  );

  const simulateVercelCron = async () => {
    if (!isAdmin) {
      toast.error('Only administrators can simulate cron jobs');
      return;
    }

    try {
      setIsTriggeringSync(true);
      toast.info('Simulating Vercel cron job...');
      
      // Ensure scan_progress table exists
      const setupResponse = await fetch('/api/supabase/setup-tables', {
        method: 'POST'
      });
      
      if (!setupResponse.ok) {
        const errorData = await setupResponse.json();
        throw new Error(errorData.error || 'Failed to set up scan_progress table');
      }
      
      // Create a key for the API call
      const cronSecret = 'dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3';
      
      const response = await fetch('/api/cron/sync?debug=true', {
        method: 'GET',
        headers: {
          'user-agent': 'vercel-cron/1.0',
          'x-vercel-cron': 'true',
          'Authorization': `Bearer ${cronSecret}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to simulate cron');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Cron simulation started successfully! ${result.message}`);
        
        // Start auto-refresh by keeping isTriggeringSync true
        // It will be set to false when we detect the sync is complete
        await fetchSyncHistory();
      } else {
        throw new Error(result.error || 'Unknown error during cron simulation');
      }
    } catch (error) {
      console.error('Error simulating cron:', error);
      toast.error(`Cron simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsTriggeringSync(false);
    }
  };

  // Setup tables if necessary
  const setupTables = async () => {
    if (!isAdmin) {
      toast.error('Only administrators can set up tables');
      return;
    }
    
    try {
      setIsTriggeringSync(true);
      toast.info('Setting up tables...');
      
      // First set up scan_progress table
      const setupResponse = await fetch('/api/supabase/setup-tables', {
        method: 'POST'
      });
      
      if (!setupResponse.ok) {
        const errorData = await setupResponse.json();
        throw new Error(errorData.error || 'Failed to set up scan_progress table');
      }

      // Then run the cron setup
      const cronSecret = 'dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3';
      const response = await fetch('/api/cron/sync?debug=true&setup=true', {
        method: 'GET',
        headers: {
          'user-agent': 'vercel-cron/1.0',
          'x-vercel-cron': 'true',
          'Authorization': `Bearer ${cronSecret}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set up tables');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Tables set up successfully!');
        setTablesExist(true);
        fetchSyncHistory();
      } else {
        throw new Error(result.error || 'Unknown error during table setup');
      }
    } catch (error) {
      console.error('Error setting up tables:', error);
      toast.error(`Table setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTriggeringSync(false);
    }
  };

  // Load sync history on page load
  // Initial load and setup auto-refresh
  useEffect(() => {
    fetchSyncHistory();

    // Check for active scan
    const checkForActiveScan = async () => {
      const { data } = await supabase
        .from('scan_results')
        .select('status')
        .eq('status', 'running')
        .limit(1);

      if (data && data.length > 0) {
        setIsTriggeringSync(true);
      }
    };

    checkForActiveScan();
  }, [fetchSyncHistory, setIsTriggeringSync]); // Removed supabase dependency, added setIsTriggeringSync

  // Stop auto-refresh when no running scans are found
  useEffect(() => {
    if (syncHistory.length > 0) {
      const latestSync = syncHistory[0];
      if (latestSync.status !== 'running' && isTriggeringSync) {
        setIsTriggeringSync(false);
        fetchSyncHistory(); // One final refresh
      }
    }
  }, [syncHistory, isTriggeringSync, fetchSyncHistory, setIsTriggeringSync]); // Add setIsTriggeringSync dependency

  // Format timestamp to local date and time
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  // Format duration in milliseconds to seconds with 2 decimal places
  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-full px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Cron Monitor</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={simulateVercelCron}
                  disabled={isTriggeringSync}
                  className="flex items-center gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <Clock className="h-4 w-4" />
                  Simulate Cron
                </Button>
                
                {tablesExist === false && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={setupTables}
                    disabled={isTriggeringSync}
                    className="flex items-center gap-1 border-green-200 text-green-700 hover:bg-green-50"
                  >
                    <Plus className="h-4 w-4" />
                    Setup Tables
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {tablesExist === false && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Tables not found</AlertTitle>
            <AlertDescription className="text-amber-700">
              The required database tables for sync monitoring don&apos;t exist yet. Click &quot;Setup Tables&quot; to create them automatically, or run a cron sync job which will create them on demand.
            </AlertDescription>
          </Alert>
        )}

        {/* Scan Progress Card - New Component */}
        <div className="mb-6">
          <ScanProgressCard onManualSyncClick={triggerFullSync} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Next Scheduled Sync</CardTitle>
              <CardDescription>Based on Vercel cron configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xl font-semibold">
                <Clock className="h-5 w-5 text-blue-500" />
                {nextScheduledTime ? nextScheduledTime.toLocaleTimeString() : 'Calculating...'}
              </div>
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground pt-0">
              Runs hourly at minute 0
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Last Successful Sync</CardTitle>
              <CardDescription>Latest successful synchronization</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse h-7 bg-gray-200 rounded w-3/4"></div>
              ) : (
                <div>
                  {tablesExist === false ? (
                    <div className="text-gray-500">No tables created yet</div>
                  ) : syncHistory.find(record => record.success) ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-xl font-semibold text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        {formatTimestamp(syncHistory.find(record => record.success)?.timestamp || '')}
                      </div>
                      <div className="text-sm mt-1">
                        Domains: {syncHistory.find(record => record.success)?.domains_count || 0}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500">No successful syncs yet</div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground pt-0">
              {syncHistory.find(record => record.success) ? 
                `Duration: ${formatDuration(syncHistory.find(record => record.success)?.duration_ms)}` : 
                ''}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Sync Statistics</CardTitle>
              <CardDescription>Overview of sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse h-7 bg-gray-200 rounded w-3/4"></div>
              ) : (
                <div className="flex flex-col">
                  {tablesExist === false ? (
                    <div className="text-gray-500">No sync history available</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-xl font-semibold">
                        <span className="text-blue-600">{syncHistory.length}</span> total syncs
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100">
                          {syncHistory.filter(record => record.success).length} successful
                        </Badge>
                        <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-100">
                          {syncHistory.filter(record => !record.success).length} failed
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground pt-0">
              {syncHistory.length > 0 ? 
                `Avg. duration: ${formatDuration(
                  syncHistory
                    .filter(record => record.duration_ms)
                    .reduce((sum, record) => sum + (record.duration_ms || 0), 0) / 
                    syncHistory.filter(record => record.duration_ms).length
                )}` : 
                ''}
            </CardFooter>
          </Card>
        </div>

        <div className="rounded-md border shadow-sm bg-background mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Timestamp</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[15%]">Domains</TableHead>
                <TableHead className="w-[15%]">Duration</TableHead>
                <TableHead className="w-[40%]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-3/4"></div>
                    </TableCell>
                    <TableCell>
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
                    </TableCell>
                    <TableCell>
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-1/4"></div>
                    </TableCell>
                    <TableCell>
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-1/4"></div>
                    </TableCell>
                    <TableCell>
                      <div className="animate-pulse h-4 bg-gray-200 rounded w-4/5"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : tablesExist === false ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-8 w-8 text-amber-500" />
                      <p className="text-lg font-medium">No sync history tables exist</p>
                      <p className="text-sm text-muted-foreground">
                        Run a sync job or click &quot;Setup Tables&quot; to create the necessary database structure
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : syncHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No sync history found
                  </TableCell>
                </TableRow>
              ) : (
                syncHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{formatTimestamp(record.timestamp)}</TableCell>
                    <TableCell>
                      {record.success ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{record.domains_count}</TableCell>
                    <TableCell>{formatDuration(record.duration_ms)}</TableCell>
                    <TableCell>
                      {record.success ? (
                        <span className="text-sm text-muted-foreground">
                          Successfully synchronized {record.domains_count} domains
                        </span>
                      ) : (
                        <div className="flex items-start gap-1">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-red-600">
                            {record.error_message || 'Unknown error'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

      </div>
    </DashboardLayout>
  );
}