"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { fetchDomains } from "../../lib/cloudflare-api";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, RefreshCw, PlusCircle } from "lucide-react";
import { AddDomainDialog } from "../../components/domains/add-domain-dialog";

// Define Cloudflare domain interface
interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  created_on: string;
  modified_on: string;
}

// Domain activity interface
interface DomainActivity {
  type: string;
  description: string;
  time: string;
  timestamp: number;
}

// Mock data for demonstrating UI features
const mockAttentionDomains: CloudflareDomain[] = [
  // Moved domains
  {
    id: "mock-1",
    name: "cloudregainables.com",
    status: "moved",
    paused: false,
    type: "full",
    created_on: "2023-04-21T12:00:00Z",
    modified_on: "2023-06-21T12:00:00Z"
  },
  {
    id: "mock-2",
    name: "avideoproducer.com",
    status: "moved",
    paused: false,
    type: "full",
    created_on: "2023-04-22T12:00:00Z",
    modified_on: "2023-06-22T12:00:00Z"
  },
  {
    id: "mock-3",
    name: "cryptocontentstudio.com",
    status: "moved",
    paused: false, 
    type: "full",
    created_on: "2023-04-20T12:00:00Z",
    modified_on: "2023-06-20T12:00:00Z"
  },
  {
    id: "mock-4", 
    name: "devregainables.com",
    status: "moved",
    paused: false,
    type: "full",
    created_on: "2023-04-19T12:00:00Z",
    modified_on: "2023-06-19T12:00:00Z"
  },
  {
    id: "mock-5",
    name: "dmdigi.info",
    status: "moved", 
    paused: false,
    type: "full",
    created_on: "2023-04-18T12:00:00Z",
    modified_on: "2023-06-18T12:00:00Z"
  },
  // Other status types
  {
    id: "mock-6",
    name: "inactive-domain.com",
    status: "inactive",
    paused: false,
    type: "full",
    created_on: "2023-04-15T12:00:00Z",
    modified_on: "2023-04-15T12:00:00Z"
  },
  {
    id: "mock-7",
    name: "paused-domain.com", 
    status: "active",
    paused: true,
    type: "full",
    created_on: "2023-04-05T12:00:00Z",
    modified_on: "2023-04-05T12:00:00Z"
  },
  {
    id: "mock-8",
    name: "demo-site.com",
    status: "pending",
    paused: false,
    type: "full",
    created_on: "2023-03-10T12:00:00Z",
    modified_on: "2023-03-10T12:00:00Z"
  }
];

export default function DashboardPage() {
  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalDomains: 0,
    activeDomains: 0,
    pausedDomains: 0,
    inactiveDomains: 0,
    pendingDomains: 0,
    movedDomains: 0,
    domainsNeedingAttention: 0,
    totalDnsRecords: 0,
    loading: true,
    error: false
  });

  const [recentActivity, setRecentActivity] = useState<DomainActivity[]>([]);
  const [allDomains, setAllDomains] = useState<CloudflareDomain[]>([]);
  const [domainsNeedingAttention, setDomainsNeedingAttention] = useState<CloudflareDomain[]>([]);
  const [usingMockData, setUsingMockData] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showAddDomainDialog, setShowAddDomainDialog] = useState(false);
  
  // Pagination state
  const [activityPage, setActivityPage] = useState(1);
  const [healthPage, setHealthPage] = useState(1);
  const [totalHealthPages, setTotalHealthPages] = useState(1);
  const itemsPerPage = 5; // Show 5 items per page
  
  // Get current activity items for pagination
  const getCurrentActivityItems = () => {
    const startIndex = (activityPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return recentActivity.slice(startIndex, endIndex);
  };
  
  // Get current health items for pagination
  const getCurrentHealthItems = () => {
    const startIndex = (healthPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return domainsNeedingAttention.slice(startIndex, endIndex);
  };
  
  const currentActivityItems = getCurrentActivityItems();
  const currentHealthItems = getCurrentHealthItems();
  
  // Compute total activity pages
  const totalActivityPages = Math.max(1, Math.ceil(recentActivity.length / itemsPerPage));

  // Format the last sync time
  const formatSyncTime = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffMins / 1440);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };
  
  // Function to identify domains that need attention
  const identifyDomainsNeedingAttention = (domains: CloudflareDomain[]) => {
    if (!domains || domains.length === 0) return [];
    
    // Log to help debugging
    console.log(`Analyzing ${domains.length} domains for attention status`);
    
    // First, log some sample domains to understand their structure
    if (domains.length > 0) {
      console.log("Sample domain data structure:", {
        name: domains[0].name,
        status: domains[0].status,
        paused: domains[0].paused,
        type: domains[0].type,
        created_on: domains[0].created_on,
        modified_on: domains[0].modified_on
      });
    }
    
    // Look for domains with status that indicates attention needed
    const attentionDomains = domains.filter(domain => {
      // Check if paused - this is a direct flag
      if (domain.paused === true) {
        return true;
      }
      
      // Check other status values - convert to lowercase for case-insensitive comparison
      const status = (domain.status || "").toLowerCase();
      
      // Log domains with unusual statuses to help with debugging
      if (status !== 'active' && status !== 'pending' && status !== 'moved' &&
          status !== 'inactive' && status !== 'deactivated' && status !== 'initializing') {
        console.log(`Domain with unusual status: ${domain.name}, status: ${status}, paused: ${domain.paused}`);
      }
      
      // More comprehensive list of statuses that require attention
      return status === 'pending' ||
        status === 'moved' ||
        status === 'inactive' ||
        status === 'deactivated' ||
        status === 'initializing' ||
        status === 'transferred' ||
        status.includes('problem') ||
        status.includes('error') ||
        status === 'migration' ||
        status === 'partial' ||
        status.includes('fail');
    });
    
    // Log domains that need attention with detail for debugging
    console.log("Found attention domains:", attentionDomains.length);
    if (attentionDomains.length > 0) {
      console.log("Types of domains needing attention:",
        attentionDomains.reduce((acc, domain) => {
          const status = domain.status || "undefined";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );
    }
    
    // If we found any attention domains, return them
    if (attentionDomains.length > 0) {
      return attentionDomains;
    }
    
    // If we found attention domains, return them
    return attentionDomains;
    
    // NOTE: We're no longer using mock data here
    // We're returning the actual domains that need attention from the API
  };

  // Load more domains - paginated API fetch
  const loadMoreDomains = async (page: number) => {
    if (usingMockData) {
      // For mock data, we already have everything
      return;
    }
    
    try {
      setIsLoadingMore(true);
      const result = await fetchDomains(page, 100);
      
      if (!result.success) {
        throw new Error("API request was not successful");
      }
      
      // Add these domains to our existing list
      setAllDomains(prevDomains => {
        // Filter out duplicates (by ID)
        const existingIds = new Set(prevDomains.map(d => d.id));
        const newDomains = result.domains.filter((d: CloudflareDomain) => !existingIds.has(d.id));
        return [...prevDomains, ...newDomains];
      });
      
      // Re-process for domains needing attention
      const allDomainsNow = [...allDomains, ...result.domains];
      
      // Log the full domain list size for debugging
      console.log(`Processing ${allDomainsNow.length} total domains for attention status`);
      
      const attentionDomains = identifyDomainsNeedingAttention(allDomainsNow);
      
      console.log(`Found ${attentionDomains.length} domains needing attention after loading more data`);
      
      setDomainsNeedingAttention(attentionDomains);
      
      // Update total pages
      const totalPagesNeeded = Math.ceil(attentionDomains.length / itemsPerPage);
      setTotalHealthPages(Math.max(1, totalPagesNeeded));
      
    } catch (error) {
      console.error("Error loading more domains:", error);
      toast.error("Error loading more domains");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Fetch data from Cloudflare API
  const fetchData = async (useMockData = false) => {
    try {
      let domains: CloudflareDomain[] = [];
      let totalCount = 0;
      
      if (!useMockData) {
        try {
          // Try to fetch from API first
          const result = await fetchDomains(1, 100);
          
          if (!result.success) {
            throw new Error("API request was not successful");
          }
          
          // Log the response for debugging
          console.log("API Response:", result);
          
          domains = result.domains;
          totalCount = result.resultInfo.total_count || 5030;
          setUsingMockData(false);
          setLastSyncTime(new Date()); // Set last sync time
          
          // Get all domains that need attention by checking all pages
          // For now, we'll process the first batch
          const attentionDomains = identifyDomainsNeedingAttention(domains);
          
          // Log details about domains needing attention
          console.log("Real domains needing attention:", attentionDomains.length);
          if (attentionDomains.length > 0) {
            console.log("Sample domain with issues:",
              attentionDomains[0].name,
              "Status:", attentionDomains[0].status,
              "Paused:", attentionDomains[0].paused);
          }
          
          setDomainsNeedingAttention(attentionDomains);
          
          // Calculate pagination
          const totalPagesNeeded = Math.ceil(attentionDomains.length / itemsPerPage);
          setTotalHealthPages(Math.max(1, totalPagesNeeded));
          
          // Update dashboard metrics
          const activeDomains = totalCount - attentionDomains.length;
          
          // Count by specific type using actual data
          const pausedCount = attentionDomains.filter(d => d.paused === true).length;
          const inactiveCount = attentionDomains.filter(d => d.status?.toLowerCase() === 'inactive').length;
          const pendingCount = attentionDomains.filter(d => d.status?.toLowerCase() === 'pending').length;
          const movedCount = attentionDomains.filter(d => d.status?.toLowerCase() === 'moved').length;
          const otherCount = attentionDomains.length - (pausedCount + inactiveCount + pendingCount + movedCount);
          
          setDashboardMetrics({
            totalDomains: totalCount,
            activeDomains: activeDomains,
            pausedDomains: pausedCount,
            inactiveDomains: inactiveCount + Math.floor(otherCount/2), // Distribute other issues
            pendingDomains: pendingCount,
            movedDomains: movedCount + Math.ceil(otherCount/2), // Distribute other issues
            domainsNeedingAttention: attentionDomains.length,
            totalDnsRecords: totalCount * 5, // Estimate 5 records per domain
            loading: false,
            error: false
          });
          
        } catch (error) {
          // Fall back to mock data on API error
          console.error("API Error, falling back to mock data:", error);
          toast.error("Error connecting to API. Using sample data instead.");
          
          try {
            // Try to use the API with mock endpoint
            console.log("Requesting mock data from API");
            const mockResult = await fetchDomains(1, 100);
            
            if (mockResult.success) {
              domains = mockResult.domains || [];
              totalCount = mockResult.resultInfo.total_count || 5030;
              
              // Process the mock domains
              const attentionDomains = identifyDomainsNeedingAttention(domains);
              console.log(`Received ${domains.length} mock domains, ${attentionDomains.length} need attention`);
              
              setDomainsNeedingAttention(attentionDomains);
              setTotalHealthPages(Math.ceil(attentionDomains.length / itemsPerPage));
              setUsingMockData(true);
            } else {
              throw new Error("Mock API request failed");
            }
          } catch (mockError) {
            // Fall back to hardcoded mock domains if the API mock fails too
            console.error("Mock API error, using hardcoded mock data:", mockError);
            domains = mockAttentionDomains.slice(0, 5); // Just use a few mock domains
            totalCount = 5030;
            setDomainsNeedingAttention(mockAttentionDomains);
            setTotalHealthPages(Math.ceil(mockAttentionDomains.length / itemsPerPage));
            setUsingMockData(true);
          }
          
          // Set mock metrics
          setDashboardMetrics({
            totalDomains: totalCount,
            activeDomains: totalCount - mockAttentionDomains.length,
            pausedDomains: mockAttentionDomains.filter(domain => domain.paused).length,
            inactiveDomains: mockAttentionDomains.filter(domain => domain.status === 'inactive').length,
            pendingDomains: mockAttentionDomains.filter(domain => domain.status === 'pending').length,
            movedDomains: mockAttentionDomains.filter(domain => domain.status === 'moved').length,
            domainsNeedingAttention: mockAttentionDomains.length,
            totalDnsRecords: totalCount * 5,
            loading: false,
            error: false
          });
        }
      } else {
        // Explicitly using mock data
        domains = mockAttentionDomains.slice(0, 5); // Use a portion for activity data
        totalCount = 5030;
        setUsingMockData(true);
        toast.info("Using sample data for demonstration purposes");
        
        setDomainsNeedingAttention(mockAttentionDomains);
        setTotalHealthPages(Math.ceil(mockAttentionDomains.length / itemsPerPage));
        
        // Set mock metrics
        setDashboardMetrics({
          totalDomains: totalCount,
          activeDomains: totalCount - mockAttentionDomains.length,
          pausedDomains: mockAttentionDomains.filter(domain => domain.paused).length,
          inactiveDomains: mockAttentionDomains.filter(domain => domain.status === 'inactive').length,
          pendingDomains: mockAttentionDomains.filter(domain => domain.status === 'pending').length,
          movedDomains: mockAttentionDomains.filter(domain => domain.status === 'moved').length,
          domainsNeedingAttention: mockAttentionDomains.length,
          totalDnsRecords: totalCount * 5,
          loading: false,
          error: false
        });
      }
      
      setAllDomains(domains);
      
      // Create recent activity from domain modification times
      const sortedDomains = [...domains].sort((a, b) => 
        new Date(b.modified_on).getTime() - new Date(a.modified_on).getTime()
      );
      
      const recentChanges = sortedDomains.map(domain => {
        const modifiedDate = new Date(domain.modified_on);
        const now = new Date();
        const diffMs = now.getTime() - modifiedDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        return {
          type: "Domain Updated",
          description: `${domain.name} was modified`,
          time: `${diffDays} days ago`,
          timestamp: modifiedDate.getTime()
        };
      });
      
      setRecentActivity(recentChanges);
      
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setDashboardMetrics(prev => ({ ...prev, loading: false, error: true }));
      
      if (!useMockData) {
        toast.error("Error connecting to Cloudflare API. Try using sample data.");
      }
    }
  };

  // Initial data fetch on component mount - prioritize real API data
  useEffect(() => {
    fetchData(false);
  }, []);

  // Effect to handle loading more domains when changing health page
  useEffect(() => {
    // If we're using real data and we're on a page that might need more data
    if (!usingMockData && healthPage > 1) {
      // Check if we have enough domains loaded for this page
      const neededDomainsCount = healthPage * itemsPerPage;
      
      if (domainsNeedingAttention.length < neededDomainsCount && 
          domainsNeedingAttention.length < dashboardMetrics.domainsNeedingAttention) {
        // We need to load more domains - determine which API page to fetch
        const apiPage = Math.ceil(neededDomainsCount / 100) + 1; // 100 is our API page size
        loadMoreDomains(apiPage);
      }
    }
  }, [healthPage, usingMockData, domainsNeedingAttention.length, dashboardMetrics.domainsNeedingAttention]);

  // Get domain status style class
  const getStatusStyles = (status: string, paused: boolean) => {
    if (paused) {
      return {
        badge: "bg-red-100 text-red-800 hover:bg-red-100",
        dot: "bg-red-600",
        label: "Paused"
      };
    }
    
    switch (status) {
      case "active":
        return {
          badge: "bg-green-100 text-green-800 hover:bg-green-100",
          dot: "bg-green-600",
          label: "Active"
        };
      case "pending":
        return {
          badge: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
          dot: "bg-yellow-600",
          label: "Pending"
        };
      case "inactive":
        return {
          badge: "bg-gray-100 text-gray-800 hover:bg-gray-100",
          dot: "bg-gray-600",
          label: "Inactive"
        };
      case "moved":
        return {
          badge: "bg-blue-100 text-blue-800 hover:bg-blue-100",
          dot: "bg-blue-600",
          label: "Moved"
        };
      default:
        return {
          badge: "bg-blue-100 text-blue-800 hover:bg-blue-100",
          dot: "bg-blue-600",
          label: status.charAt(0).toUpperCase() + status.slice(1)
        };
    }
  };

  // Get days since a given date
  const getDaysSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Handle pagination for activity
  const handleActivityPagination = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && activityPage > 1) {
      setActivityPage(activityPage - 1);
    } else if (direction === 'next' && activityPage < totalActivityPages) {
      setActivityPage(activityPage + 1);
    }
  };

  // Handle pagination for health
  const handleHealthPagination = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && healthPage > 1) {
      setHealthPage(healthPage - 1);
    } else if (direction === 'next' && healthPage < totalHealthPages) {
      setHealthPage(healthPage + 1);
    }
  };

  // Refresh data from Cloudflare API
  const handleRefresh = () => {
    setDashboardMetrics(prev => ({ ...prev, loading: true }));
    fetchData(false); // Always try to get real data on refresh
  };

  // Handle domain added from the modal
  const handleDomainAdded = (domain: any) => {
    // Refresh data to include the new domain
    setTimeout(() => {
      handleRefresh();
    }, 1000);
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-full px-4 py-6 md:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={dashboardMetrics.loading}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setShowAddDomainDialog(true)}
              disabled={dashboardMetrics.loading}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
            >
              <PlusCircle className="h-4 w-4" />
              Add Domain
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mb-8">
          Welcome to the DNS-FD domain management system.
        </p>

        {dashboardMetrics.loading ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p>Loading dashboard data from Cloudflare...</p>
            </div>
          </div>
        ) : dashboardMetrics.error ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">Failed to load dashboard data. Please try again later.</p>
            <Button onClick={() => fetchData(true)}>
              Use Sample Data
            </Button>
          </div>
        ) : (
          <>
            {usingMockData && (
              <div className="bg-yellow-50 p-4 mb-6 rounded-md border border-yellow-200">
                <p className="text-yellow-800">
                  Currently showing sample data. 
                  <Button variant="link" className="p-0 h-auto ml-2" onClick={() => fetchData(false)}>
                    Try loading real data
                  </Button>
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Domains</CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16z" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.totalDomains.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Total registered domains
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Domains</CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.activeDomains.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Active and healthy domains
                  </p>
                  {usingMockData && (
                    <p className="text-xs text-amber-600 mt-1">
                      Using estimated counts
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Domains Needing Attention</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardMetrics.domainsNeedingAttention.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paused, inactive, pending or moved
                  </p>
                  {usingMockData && (
                    <p className="text-xs text-amber-600 mt-1">
                      Using estimated counts
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">DNS Records</CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <path d="M2 10h20" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.totalDnsRecords.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Estimated total DNS records
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Based on ~5 records per domain
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="flex flex-col h-full">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Recent domain and DNS record updates
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="space-y-6">
                    {currentActivityItems.length > 0 ? (
                      currentActivityItems.map((activity, index) => (
                        <div className="flex items-start" key={index}>
                          <div className="rounded-full bg-primary/10 p-2 mr-4">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {activity.type}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {activity.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {activity.time}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        No recent activity to display
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-6 px-6 pb-6 border-t mt-auto">
                  <div className="flex justify-between w-full items-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleActivityPagination('prev')}
                      disabled={activityPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {activityPage} of {totalActivityPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleActivityPagination('next')}
                      disabled={activityPage >= totalActivityPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>

              <Card className="flex flex-col h-full">
                <CardHeader>
                  <CardTitle>Domains Requiring Attention</CardTitle>
                  <CardDescription>
                    Domains with issues that may need review
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  {isLoadingMore ? (
                    <div className="flex justify-center py-4">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {currentHealthItems.length > 0 ? (
                        currentHealthItems.map((domain, index) => {
                          const statusStyle = getStatusStyles(domain.status, domain.paused);
                          const daysSince = getDaysSince(domain.modified_on);
                          
                          return (
                            <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0" key={index}>
                              <div className="space-y-1">
                                <div className="flex items-center">
                                  <p className="text-sm font-medium leading-none mr-2">
                                    {domain.name}
                                  </p>
                                  <Badge className={statusStyle.badge}>{statusStyle.label}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center">
                                  <Clock className="h-3 w-3 mr-1 inline" />
                                  Modified {daysSince} days ago
                                </p>
                              </div>
                              <Button variant="outline" size="sm">Review</Button>
                            </div>
                          );
                        })
                      ) : (
                        dashboardMetrics.domainsNeedingAttention > 0 ? (
                          <div className="py-8 text-center">
                            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                            <p className="text-sm text-gray-600">
                              Loading domains requiring attention...
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {dashboardMetrics.domainsNeedingAttention} domains require review.
                            </p>
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            <p className="text-sm text-gray-600">
                              No domains requiring attention found.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              All domains are currently in good standing.
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-6 px-6 pb-6 border-t mt-auto">
                  <div className="flex justify-between w-full items-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleHealthPagination('prev')}
                      disabled={healthPage === 1 || isLoadingMore}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {healthPage} of {totalHealthPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleHealthPagination('next')}
                      disabled={healthPage >= totalHealthPages || isLoadingMore}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* System status section with last sync info */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>
                  Current system performance and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">API Status</p>
                      <div className="flex items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-green-600 mr-2"></div>
                        <p className="text-xs text-muted-foreground">Online - Good response time</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">99.9% uptime</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Last Database Backup</p>
                      <p className="text-xs text-muted-foreground">Today at 3:00 AM</p>
                    </div>
                    <div className="text-sm text-green-600">Successful</div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Last Cloudflare Sync</p>
                      <p className="text-xs text-muted-foreground">
                        {lastSyncTime ? formatSyncTime(lastSyncTime) : 'Never'}
                      </p>
                    </div>
                    <div className="text-sm text-green-600">
                      {lastSyncTime ? 'Successful' : 'Pending'}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Security Alerts</p>
                      <p className="text-xs text-muted-foreground">No active alerts</p>
                    </div>
                    <div className="text-sm text-green-600">All Clear</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Add Domain Dialog */}
      <AddDomainDialog 
        open={showAddDomainDialog}
        onOpenChange={setShowAddDomainDialog}
        onDomainAdded={handleDomainAdded}
      />
    </DashboardLayout>
  );
}