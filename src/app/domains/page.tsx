"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { PlusCircle, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { fetchDomains } from "../../lib/cloudflare-api";

// Cloudflare domain interface
interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  created_on: string;
  modified_on: string;
}

// Result info interface from Cloudflare
interface ResultInfo {
  page: number;
  per_page: number;
  total_pages: number;
  count: number;
  total_count: number;
}

// Domain status type
type DomainStatusFilter = "all" | "active" | "inactive" | "pending" | "paused" | "moved" | "initializing" | "deactivated";

// Mock domains data
const mockDomains: CloudflareDomain[] = [
  {
    id: "1",
    name: "example.com",
    status: "active",
    paused: false,
    type: "full",
    created_on: "2023-01-15T12:00:00Z",
    modified_on: "2023-01-15T12:00:00Z"
  },
  {
    id: "2",
    name: "test-domain.com",
    status: "active",
    paused: false,
    type: "full",
    created_on: "2023-02-20T12:00:00Z",
    modified_on: "2023-02-20T12:00:00Z"
  },
  {
    id: "3",
    name: "demo-site.com",
    status: "pending",
    paused: false,
    type: "full",
    created_on: "2023-03-10T12:00:00Z",
    modified_on: "2023-03-10T12:00:00Z"
  },
  {
    id: "4",
    name: "paused-domain.com",
    status: "active",
    paused: true,
    type: "full",
    created_on: "2023-04-05T12:00:00Z",
    modified_on: "2023-04-05T12:00:00Z"
  },
  {
    id: "5",
    name: "inactive-domain.com",
    status: "inactive",
    paused: false,
    type: "full",
    created_on: "2023-04-15T12:00:00Z",
    modified_on: "2023-04-15T12:00:00Z"
  },
  {
    id: "6",
    name: "moved-domain.com",
    status: "moved",
    paused: false,
    type: "full",
    created_on: "2023-04-20T12:00:00Z",
    modified_on: "2023-04-20T12:00:00Z"
  }
];

// Mock pagination info
const mockResultInfo: ResultInfo = {
  page: 1,
  per_page: 25,
  total_pages: 1,
  count: 6,
  total_count: 6
};

export default function DomainsPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<CloudflareDomain[]>([]);
  const [filteredDomains, setFilteredDomains] = useState<CloudflareDomain[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DomainStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [selectedDomainForAssignment, setSelectedDomainForAssignment] = useState<CloudflareDomain | null>(null);
  const [domainAssignments, setDomainAssignments] = useState<Record<string, string>>({});
  
  // Mock users for assignment - in a real app this would come from an API
  const mockUsers = [
    { id: "1", name: "Admin User", email: "admin@example.com" },
    { id: "2", name: "John Smith", email: "john@example.com" },
    { id: "3", name: "Jane Doe", email: "jane@example.com" },
    { id: "4", name: "Alex Johnson", email: "alex@example.com" },
    { id: "5", name: "Sarah Williams", email: "sarah@example.com" },
    { id: "6", name: "Michael Brown", email: "michael@example.com" },
    { id: "7", name: "Emily Davis", email: "emily@example.com" },
    { id: "8", name: "Robert Miller", email: "robert@example.com" },
    { id: "9", name: "Jennifer Wilson", email: "jennifer@example.com" },
    { id: "10", name: "David Moore", email: "david@example.com" },
  ];

  // Load domain assignments from localStorage on component mount
  useEffect(() => {
    try {
      const savedAssignments = localStorage.getItem('domainAssignments');
      if (savedAssignments) {
        setDomainAssignments(JSON.parse(savedAssignments));
      }
    } catch (error) {
      console.error('Failed to load domain assignments from localStorage:', error);
    }
  }, []);

  // Save domain assignments to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('domainAssignments', JSON.stringify(domainAssignments));
    } catch (error) {
      console.error('Failed to save domain assignments to localStorage:', error);
    }
  }, [domainAssignments]);
  
  // Domain to add
  const [newDomain, setNewDomain] = useState({
    name: "",
    registrationDate: new Date().toISOString().split("T")[0],
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      .toISOString()
      .split("T")[0],
  });

  // Apply filters to domains
  const applyFilters = (domains: CloudflareDomain[]) => {
    let result = [...domains];
    
    // Apply status filter
    if (statusFilter !== "all") {
      if (statusFilter === "paused") {
        result = result.filter(domain => domain.paused);
      } else {
        // Case insensitive comparison for status
        result = result.filter(domain => {
          const status = String(domain.status || "").toLowerCase();
          return status === statusFilter.toLowerCase() && !domain.paused;
        });
      }
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(domain => domain.name.toLowerCase().includes(query));
    }
    
    // Log filtered results for debugging
    console.log(`Filtered to ${result.length} domains with status: ${statusFilter}`);
    if (result.length > 0) {
      console.log('Sample filtered domain:', result[0].name, 'Status:', result[0].status);
    }
    
    return result;
  };

  // Fetch domains from Cloudflare API or use mock data
  const loadDomains = async (page: number = 1, useMockData: boolean = false) => {
    setIsLoading(true);
    setIsError(false);
    
    try {
      if (useMockData) {
        // Use mock data
        setDomains(mockDomains);
        setResultInfo(mockResultInfo);
        setTotalPages(mockResultInfo.total_pages);
        setUsingMockData(true);
        toast.info("Using sample data for demonstration");
      } else {
        // Fetch from API
        const result = await fetchDomains(page, 25);
        
        if (result.success) {
          setDomains(result.domains);
          setResultInfo(result.resultInfo);
          setTotalPages(result.resultInfo.total_pages);
          setUsingMockData(false);
        } else {
          throw new Error("API request was not successful");
        }
      }
    } catch (error) {
      console.error("Error loading domains:", error);
      setIsError(true);
      
      if (!useMockData) {
        toast.error("Error connecting to Cloudflare API. Try using sample data.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load domains on component mount
  useEffect(() => {
    loadDomains(currentPage);
  }, [currentPage]);

  // Apply filters when domains or filter conditions change
  useEffect(() => {
    if (domains.length > 0) {
      setFilteredDomains(applyFilters(domains));
    }
  }, [domains, statusFilter, searchQuery]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Format date from Cloudflare timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Reset filters
  const resetFilters = () => {
    setStatusFilter("all");
    setSearchQuery("");
  };

  // Get domain status class
  const getStatusStyle = (status: string, paused: boolean) => {
    if (paused) {
      return "bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium";
    }
    
    // Normalize the status to lowercase for case-insensitive comparison
    const normalizedStatus = status.toLowerCase();
    
    switch (normalizedStatus) {
      case "active":
        return "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium";
      case "pending":
        return "bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium";
      case "initializing":
        return "bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium";
      case "inactive":
        return "bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium";
      case "deactivated":
        return "bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium";
      case "moved":
        return "bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium";
      default:
        return "bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium";
    }
  };

  // Handle domain add (placeholder as we can't actually add domains via API)
  const handleAddDomain = () => {
    if (!newDomain.name) {
      toast.error("Domain name is required");
      return;
    }

    toast.info("Adding domains is not supported via this interface. Please use the Cloudflare dashboard.");
    setIsDialogOpen(false);
  };

  // View DNS records for a domain
  const viewDnsRecords = (domainId: string, domainName: string) => {
    // Store domain info in localStorage to use in DNS records page
    localStorage.setItem('selectedDomain', JSON.stringify({
      id: domainId,
      name: domainName
    }));
    
    router.push('/dns-records');
  };

  // Get domain status display text
  const getDomainStatusText = (status: string, paused: boolean) => {
    if (paused) return "Paused";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-full px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDomains(currentPage, false)}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Domain</DialogTitle>
                  <DialogDescription>
                    Enter the details of the domain you want to add to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Domain Name
                    </Label>
                    <Input
                      id="name"
                      className="col-span-3"
                      value={newDomain.name}
                      onChange={(e) =>
                        setNewDomain({ ...newDomain, name: e.target.value })
                      }
                      placeholder="example.com"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddDomain}>Add Domain</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {usingMockData && (
          <div className="bg-yellow-50 p-4 mb-6 rounded-md border border-yellow-200">
            <p className="text-yellow-800">
              Currently showing sample data. 
              <Button variant="link" className="p-0 h-auto ml-2" onClick={() => loadDomains(currentPage, false)}>
                Try loading real data
              </Button>
            </p>
          </div>
        )}

        {/* Filtering and search options */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Label htmlFor="search" className="sr-only">Search</Label>
            <Input
              id="search"
              placeholder="Search domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="w-full sm:w-40">
            <Label htmlFor="status-filter" className="sr-only">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value: DomainStatusFilter) => setStatusFilter(value)}
            >
              <SelectTrigger id="status-filter" className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="initializing">Initializing</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="moved">Moved</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={resetFilters} className="sm:w-auto">Reset</Button>
        </div>

        {isLoading && domains.length === 0 ? (
          <div className="flex justify-center items-center h-64 bg-background/40 rounded-lg border shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-lg">Loading domains...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center h-64 bg-background/40 rounded-lg border shadow-sm">
            <div className="text-center">
              <p className="text-lg text-red-600 mb-4">Failed to load domains</p>
              <Button onClick={() => loadDomains(currentPage, true)}>Use Sample Data</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md border shadow-sm overflow-hidden bg-background mb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%]">Domain Name</TableHead>
                    <TableHead className="w-[15%]">Created On</TableHead>
                    <TableHead className="w-[15%]">Modified On</TableHead>
                    <TableHead className="w-[13%]">Status</TableHead>
                    <TableHead className="w-[12%]">Assigned User</TableHead>
                    <TableHead className="w-[20%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDomains.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No domains found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDomains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell className="font-medium">{domain.name}</TableCell>
                        <TableCell>{formatDate(domain.created_on)}</TableCell>
                        <TableCell>{formatDate(domain.modified_on)}</TableCell>
                        <TableCell>
                          <span className={getStatusStyle(domain.status, domain.paused)}>
                            {getDomainStatusText(domain.status, domain.paused)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {domainAssignments[domain.id] ? (
                            <span className="text-blue-600 text-sm font-medium">
                              {mockUsers.find(u => u.id === domainAssignments[domain.id])?.name || domainAssignments[domain.id]}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDnsRecords(domain.id, domain.name)}
                          >
                            DNS Records
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedDomainForAssignment(domain);
                              setIsAssignDialogOpen(true);
                            }}
                          >
                            Assign
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {resultInfo && resultInfo.total_pages > 1 && (
              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredDomains.length} of {resultInfo.total_count} domains
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User assignment dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl">Assign Domain to User</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              {selectedDomainForAssignment && (
                <>Select a user to assign domain <strong>{selectedDomainForAssignment.name}</strong> to.</>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {/* User search bar */}
          <div className="pt-4 pb-2">
            <Input
              placeholder="Search users..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="grid gap-6 py-4 max-h-[400px] overflow-y-auto">
            <div className="grid grid-cols-1 gap-4">
              {mockUsers
                .filter(user =>
                  userSearchQuery === "" ||
                  user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                  user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                )
                .map(user => (
                  <Button
                    key={user.id}
                    variant={domainAssignments[selectedDomainForAssignment?.id || ''] === user.id ? "default" : "outline"}
                    className="justify-start text-left py-6 h-auto"
                    onClick={() => {
                      if (selectedDomainForAssignment) {
                        const newAssignments = { ...domainAssignments };
                        newAssignments[selectedDomainForAssignment.id] = user.id;
                        setDomainAssignments(newAssignments);
                        toast.success(`${selectedDomainForAssignment.name} assigned to ${user.name}`);
                        setIsAssignDialogOpen(false);
                      }
                    }}
                  >
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-medium">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-lg">{user.name}</span>
                        <span className="text-sm text-muted-foreground pt-1">{user.email}</span>
                      </div>
                    </div>
                  </Button>
                ))}
                
              {mockUsers.filter(user =>
                userSearchQuery !== "" &&
                !user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) &&
                !user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
              ).length === mockUsers.length && (
                <div className="text-center py-6 text-muted-foreground">
                  No users found matching "{userSearchQuery}"
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="pt-4 flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setIsAssignDialogOpen(false)}
              className="px-6 py-2"
            >
              Cancel
            </Button>
            {selectedDomainForAssignment && domainAssignments[selectedDomainForAssignment.id] && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedDomainForAssignment) {
                    const newAssignments = { ...domainAssignments };
                    delete newAssignments[selectedDomainForAssignment.id];
                    setDomainAssignments(newAssignments);
                    toast.info(`${selectedDomainForAssignment.name} unassigned`);
                    setIsAssignDialogOpen(false);
                  }
                }}
                className="px-6 py-2"
              >
                Unassign
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}