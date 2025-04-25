"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { fetchDomains } from "../../lib/cloudflare-api";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Table2 } from "lucide-react"; // Remove unused RefreshCw and Database

interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  created_on: string;
  modified_on: string;
  redirect_url?: string | null;
}

interface StatusCount {
  status: string;
  count: number;
  isPaused: boolean;
  domains: CloudflareDomain[];
}

export default function DomainStatusTestPage() {
  const [domains, setDomains] = useState<CloudflareDomain[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Remove unused isSyncing state
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [filteredDomains, setFilteredDomains] = useState<CloudflareDomain[]>([]);

  // Memoize loadDomains to prevent unnecessary re-renders
  const memoizedLoadDomains = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchDomains(1, 5000); // Get a large number to capture all statuses
      
      if (result.success) {
        setDomains(result.domains);
        calculateStatusCounts(result.domains);
        setLastSyncTime(new Date());
      } else {
        toast.error("Failed to load domains: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error loading domains:", error);
      toast.error("Error loading domains: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Calculate counts for each status
  const calculateStatusCounts = (domains: CloudflareDomain[]) => {
    const counts: Record<string, StatusCount> = {};
    
    // Add a special "paused" status
    counts["paused"] = {
      status: "paused",
      count: 0,
      isPaused: true,
      domains: []
    };
    
    // Group domains by status
    domains.forEach(domain => {
      if (domain.paused) {
        counts["paused"].count++;
        counts["paused"].domains.push(domain);
        return;
      }
      
      const status = (domain.status || "unknown").toLowerCase().trim();
      
      if (!counts[status]) {
        counts[status] = {
          status,
          count: 0,
          isPaused: false,
          domains: []
        };
      }
      
      counts[status].count++;
      counts[status].domains.push(domain);
    });
    
    // Convert to array and sort by count
    const countsArray = Object.values(counts).sort((a, b) => b.count - a.count);
    setStatusCounts(countsArray);
  };


  // Handle click on a status badge
  const handleStatusClick = (status: string) => {
    setSelectedStatus(status);
    const statusInfo = statusCounts.find(s => s.status === status);
    setFilteredDomains(statusInfo?.domains || []);
  };

  // Get style for status badges
  const getStatusStyle = (status: string, isPaused: boolean) => {
    if (isPaused) {
      return "bg-red-100 text-red-800";
    }
    
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
      case "initializing":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
      case "deactivated":
        return "bg-gray-100 text-gray-800";
      case "moved":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-purple-100 text-purple-800";
    }
  };

  // Load domains on component mount
  useEffect(() => {
    memoizedLoadDomains();
  }, [memoizedLoadDomains]);

  return (
    <DashboardLayout>
      <div className="w-full max-w-full px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Link href="/domains" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Domains
            </Link>
            <h1 className="text-3xl font-bold tracking-tight ml-4">Domain Status Test</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/domains">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Table2 className="h-4 w-4" />
                Domain List
              </Button>
            </Link>
          </div>
        </div>

        {lastSyncTime && (
          <div className="bg-blue-50 p-4 mb-6 rounded-md border border-blue-200">
            <p className="text-blue-800">
              Last data refresh: {lastSyncTime.toLocaleString()} - Found {domains.length} total domains with {statusCounts.length} different statuses
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64 bg-background/40 rounded-lg border shadow-sm">
            <div className="text-center">
              <p className="text-lg mb-2">Loading domain status data...</p>
              <p className="text-sm text-muted-foreground">Please wait while we fetch the latest information</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
          {/* Status Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Domain Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-8">
                {statusCounts.map(status => (
                  <Badge 
                    key={status.status}
                    variant="outline"
                    className={`cursor-pointer px-3 py-1.5 text-sm ${getStatusStyle(status.status, status.isPaused)} ${selectedStatus === status.status ? 'ring-2 ring-offset-1' : ''}`}
                    onClick={() => handleStatusClick(status.status)}
                  >
                    {status.status.charAt(0).toUpperCase() + status.status.slice(1)}: {status.count}
                  </Badge>
                ))}
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Testing Instructions</h3>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Click on any status badge above to see domains with that status</li>
                  <li>Verify these same domains should appear when filtering in the main domains page</li>
                </ol>
              </div>

              {selectedStatus && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">
                    {filteredDomains.length} Domains with Status: {" "}
                    <Badge className={getStatusStyle(selectedStatus, selectedStatus === "paused")}>
                      {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
                    </Badge>
                  </h3>
                  
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domain Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Paused</TableHead>
                          <TableHead>Created On</TableHead>
                          <TableHead>Modified On</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDomains.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4">
                              No domains found with status: {selectedStatus}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDomains.slice(0, 10).map(domain => (
                            <TableRow key={domain.id}>
                              <TableCell className="font-medium">{domain.name}</TableCell>
                              <TableCell>{domain.status}</TableCell>
                              <TableCell>{domain.paused ? "Yes" : "No"}</TableCell>
                              <TableCell>{new Date(domain.created_on).toLocaleDateString()}</TableCell>
                              <TableCell>{new Date(domain.modified_on).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))
                        )}
                        {filteredDomains.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-2 text-sm text-gray-500">
                              Showing 10 of {filteredDomains.length} domains...
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raw Status Data - For Developer Debugging */}
          <Card>
            <CardHeader>
              <CardTitle>Raw Status Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[400px] text-xs">
                {JSON.stringify(statusCounts, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </DashboardLayout>
  );
}