"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox"; 
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { createDnsRecord, deleteDnsRecord } from "../../lib/cloudflare-api";

// Cloudflare DNS record interface
interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  locked?: boolean;
  zone_id: string;
  zone_name: string;
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

// Selected domain interface
interface SelectedDomain {
  cloudflare_id: string;
  name: string;
}

// Mock DNS records for demonstration
const mockDnsRecords: CloudflareDnsRecord[] = [
  {
    id: "1",
    type: "A",
    name: "example.com",
    content: "192.0.2.1",
    proxied: true,
    ttl: 1,
    zone_id: "1",
    zone_name: "example.com",
    created_on: "2023-01-15T12:00:00Z",
    modified_on: "2023-01-15T12:00:00Z"
  },
  {
    id: "2",
    type: "CNAME",
    name: "www.example.com",
    content: "example.com",
    proxied: true,
    ttl: 1,
    zone_id: "1",
    zone_name: "example.com",
    created_on: "2023-01-15T12:30:00Z",
    modified_on: "2023-01-15T12:30:00Z"
  },
  {
    id: "3",
    type: "MX",
    name: "example.com",
    content: "mail.example.com",
    proxied: false,
    ttl: 3600,
    zone_id: "1",
    zone_name: "example.com",
    created_on: "2023-01-16T09:00:00Z",
    modified_on: "2023-01-16T09:00:00Z"
  },
  {
    id: "4",
    type: "TXT",
    name: "_dmarc.example.com",
    content: "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s;",
    proxied: false,
    ttl: 3600,
    zone_id: "1",
    zone_name: "example.com",
    created_on: "2023-01-17T14:20:00Z",
    modified_on: "2023-01-17T14:20:00Z"
  },
  {
    id: "5",
    type: "AAAA",
    name: "example.com",
    content: "2001:db8::1",
    proxied: true,
    ttl: 1,
    zone_id: "1",
    zone_name: "example.com",
    created_on: "2023-01-18T11:15:00Z",
    modified_on: "2023-01-18T11:15:00Z"
  }
];

// Mock pagination info
const mockResultInfo: ResultInfo = {
  page: 1,
  per_page: 50,
  total_pages: 1,
  count: 5,
  total_count: 5
};

export default function DNSRecordsPage() {
  const router = useRouter();
  const [dnsRecords, setDnsRecords] = useState<CloudflareDnsRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedDomain, setSelectedDomain] = useState<SelectedDomain | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  
  // New DNS record form state
  const [newRecord, setNewRecord] = useState({
    type: "A",
    name: "",
    content: "",
    ttl: 3600,
    proxied: false
  });

  // Load selected domain from localStorage on component mount
  useEffect(() => {
    const domainJson = typeof window !== 'undefined' ? localStorage.getItem('selectedDomain') : null;
    
    if (domainJson) {
      try {
        const domain = JSON.parse(domainJson);
        setSelectedDomain(domain);
      } catch (error) {
        console.error("Failed to parse domain from localStorage:", error);
        toast.error("Failed to load selected domain");
      }
    }
  }, []);

  // Fetch DNS records from Cloudflare API or use mock data
  const loadDnsRecords = useCallback(async (zoneId: string, page: number = 1, useMockData: boolean = false) => {
    setIsLoading(true);
    setIsError(false);
    console.log("Loading DNS records for zoneId:", zoneId, "Page:", page, "Use mock data:", useMockData);
    console.log("Selected domain:", selectedDomain);
    try {
      if (useMockData) {
        // Use mock data
        // Update mock records to use the selected domain name if available
        const customizedMockRecords = selectedDomain
          ? mockDnsRecords.map(record => ({
              ...record,
              zone_id: selectedDomain.cloudflare_id,
              zone_name: selectedDomain.name,
              name: record.name.replace('example.com', selectedDomain.name)
            }))
          : mockDnsRecords;
          
        setDnsRecords(customizedMockRecords);
        setResultInfo(mockResultInfo);
        setTotalPages(mockResultInfo.total_pages);
        setUsingMockData(true);
        toast.info("Using sample data for demonstration");
      } else {
        // Get DNS records from Cloudflare API
        const response = await fetch(`/api/cloudflare/dns-records?zone_id=${zoneId}&page=${page}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch DNS records from Cloudflare API");
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || "Failed to fetch DNS records");
        }

        setDnsRecords(data.dnsRecords);
        setResultInfo(data.resultInfo);
        setTotalPages(data.resultInfo.total_pages);
        setUsingMockData(false);
      }
    } catch (error) {
      console.error("Error loading DNS records:", error);
      setIsError(true);
      
      if (!useMockData) {
        toast.error("Error loading DNS records. Try using sample data.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedDomain, setDnsRecords, setResultInfo, setTotalPages, setUsingMockData, setIsLoading, setIsError]);

  // Fetch DNS records from Cloudflare API when selectedDomain changes
  useEffect(() => {
    if (selectedDomain) {
      loadDnsRecords(selectedDomain.cloudflare_id, currentPage);
    }
  }, [selectedDomain, currentPage, loadDnsRecords]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Add new DNS record
  const handleAddRecord = async () => {
    if (!selectedDomain) {
      toast.error("No domain selected");
      return;
    }
    
    if (!newRecord.name || !newRecord.content) {
      toast.error("Name and content are required");
      return;
    }

    setIsLoading(true);
    
    try {
      if (usingMockData) {
        // Simulate adding record with mock data
        const newMockRecord: CloudflareDnsRecord = {
          id: Math.random().toString(36).substring(2, 9),
          type: newRecord.type,
          name: newRecord.name,
          content: newRecord.content,
          ttl: newRecord.ttl,
          proxied: newRecord.proxied,
          zone_id: selectedDomain.cloudflare_id,
          zone_name: selectedDomain.name,
          created_on: new Date().toISOString(),
          modified_on: new Date().toISOString()
        };
        
        setDnsRecords(prev => [newMockRecord, ...prev]);
        toast.success("DNS record added successfully (demo)");
        setIsDialogOpen(false);
        
        // Reset form
        setNewRecord({
          type: "A",
          name: "",
          content: "",
          ttl: 3600,
          proxied: false
        });
      } else {
        // Real API call
        const recordToAdd = {
          type: newRecord.type,
          name: newRecord.name,
          content: newRecord.content,
          ttl: newRecord.ttl,
          proxied: newRecord.proxied
        };
        
        const result = await createDnsRecord(selectedDomain.cloudflare_id, recordToAdd);
        
        if (result) {
          toast.success("DNS record added successfully");
          loadDnsRecords(selectedDomain.cloudflare_id, currentPage);
          setIsDialogOpen(false);
          
          // Reset form
          setNewRecord({
            type: "A",
            name: "",
            content: "",
            ttl: 3600,
            proxied: false
          });
        } else {
          toast.error("Failed to add DNS record");
        }
      }
    } catch (error) {
      console.error("Error adding DNS record:", error);
      toast.error("Error adding DNS record");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete DNS record
  const handleDeleteRecord = async (recordId: string) => {
    if (!selectedDomain) {
      toast.error("No domain selected");
      return;
    }
    
    if (window.confirm("Are you sure you want to delete this DNS record?")) {
      setIsLoading(true);
      
      try {
        if (usingMockData) {
          // Simulate deleting record with mock data
          setDnsRecords(prev => prev.filter(record => record.id !== recordId));
          toast.success("DNS record deleted successfully (demo)");
        } else {
          // Real API call
          const result = await deleteDnsRecord(selectedDomain.cloudflare_id, recordId);
          
          if (result) {
            toast.success("DNS record deleted successfully");
            loadDnsRecords(selectedDomain.cloudflare_id, currentPage);
          } else {
            toast.error("Failed to delete DNS record");
          }
        }
      } catch (error) {
        console.error("Error deleting DNS record:", error);
        toast.error("Error deleting DNS record");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Format TTL display
  const getTtlDisplay = (ttl: number) => {
    if (ttl === 1) return "Automatic";
    if (ttl < 60) return `${ttl} seconds`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)} minutes`;
    if (ttl < 86400) return `${Math.floor(ttl / 3600)} hours`;
    return `${Math.floor(ttl / 86400)} days`;
  };

  // Get record type badge style
  const getRecordTypeStyle = (type: string) => {
    switch (type) {
      case "A":
        return "bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium";
      case "AAAA":
        return "bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium";
      case "CNAME":
        return "bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium";
      case "MX":
        return "bg-pink-100 text-pink-800 px-2 py-1 rounded text-xs font-medium";
      case "TXT":
        return "bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium";
      case "NS":
        return "bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-medium";
      default:
        return "bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">DNS Records</h1>
            {selectedDomain && (
              <p className="text-gray-500">Domain: {selectedDomain.name}</p>
            )}
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedDomain}>Add Record</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add DNS Record</DialogTitle>
                <DialogDescription>
                  Enter the details of the DNS record you want to add.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Record Type
                  </Label>
                  <Select
                    value={newRecord.type}
                    onValueChange={(value) =>
                      setNewRecord({
                        ...newRecord,
                        type: value,
                      })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="AAAA">AAAA</SelectItem>
                      <SelectItem value="CNAME">CNAME</SelectItem>
                      <SelectItem value="MX">MX</SelectItem>
                      <SelectItem value="TXT">TXT</SelectItem>
                      <SelectItem value="NS">NS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    className="col-span-3"
                    value={newRecord.name}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, name: e.target.value })
                    }
                    placeholder="@ or subdomain"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="content" className="text-right">
                    Content
                  </Label>
                  <Input
                    id="content"
                    className="col-span-3"
                    value={newRecord.content}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, content: e.target.value })
                    }
                    placeholder={
                      newRecord.type === "A"
                        ? "192.0.2.1"
                        : newRecord.type === "CNAME"
                        ? "example.com"
                        : "Enter content"
                    }
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="proxied" className="text-right">
                      Proxied
                    </Label>
                    <Checkbox // Or <input type="checkbox" />
                      id="proxied"
                      className="col-span-3" // Adjust styling as needed
                      checked={newRecord.proxied}
                      onCheckedChange={(checked) => // For shadcn/ui Checkbox
                        setNewRecord({
                          ...newRecord,
                          // checked can be boolean or 'indeterminate' for shadcn/ui
                          proxied: checked === true 
                        })
                      }
                      // If using a standard HTML checkbox:
                      // onChange={(e) =>
                      //   setNewRecord({ ...newRecord, proxied: e.target.checked })
                      // }
                    />
                  </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="ttl" className="text-right">
                    TTL
                  </Label>
                  <Select
                    value={newRecord.ttl.toString()}
                    onValueChange={(value) =>
                      setNewRecord({ ...newRecord, ttl: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select TTL" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Automatic</SelectItem>
                      <SelectItem value="120">2 minutes (120)</SelectItem>
                      <SelectItem value="300">5 minutes (300)</SelectItem>
                      <SelectItem value="600">10 minutes (600)</SelectItem>
                      <SelectItem value="1800">30 minutes (1800)</SelectItem>
                      <SelectItem value="3600">1 hour (3600)</SelectItem>
                      <SelectItem value="7200">2 hours (7200)</SelectItem>
                      <SelectItem value="86400">1 day (86400)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddRecord} disabled={isLoading}>
                  {isLoading ? "Adding..." : "Add Record"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {usingMockData && selectedDomain && (
          <div className="bg-yellow-50 p-4 mb-4 rounded-md border border-yellow-200">
            <p className="text-yellow-800">
              Currently showing sample data for demonstration. 
              <Button variant="link" className="p-0 h-auto ml-2" onClick={() => selectedDomain && loadDnsRecords(selectedDomain.cloudflare_id, currentPage, false)}>
                Try loading real data
              </Button>
            </p>
          </div>
        )}

        {!selectedDomain ? (
          <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-md border">
            <p className="text-lg text-gray-600 mb-4">No domain selected</p>
            <Button onClick={() => router.push('/domains')}>
              Select a Domain
            </Button>
          </div>
        ) : isLoading && dnsRecords.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-lg">Loading DNS records...</p>
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-lg text-red-600 mb-4">Failed to load DNS records from Cloudflare API</p>
              <Button onClick={() => selectedDomain && loadDnsRecords(selectedDomain.cloudflare_id, currentPage, true)} className="mr-2">
                Use Sample Data
              </Button>
              <Button variant="outline" onClick={() => selectedDomain && loadDnsRecords(selectedDomain.cloudflare_id, currentPage)}>
                Retry API Connection
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>TTL</TableHead>
                    <TableHead>Proxied</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dnsRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No DNS records found for this domain
                      </TableCell>
                    </TableRow>
                  ) : (
                    dnsRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <span className={getRecordTypeStyle(record.type)}>
                            {record.type}
                          </span>
                        </TableCell>
                        <TableCell>{record.name}</TableCell>
                        <TableCell className="font-mono text-sm max-w-xs truncate" title={record.content}>
                          {record.content}
                        </TableCell>
                        <TableCell>{getTtlDisplay(record.ttl)}</TableCell>
                        <TableCell>
                          {record.proxied ? (
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                              Proxied
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">
                              DNS only
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="mr-2"
                            disabled={record.locked}
                            onClick={() => handleDeleteRecord(record.id)}
                          >
                            Delete
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
                  Showing {resultInfo.count} of {resultInfo.total_count} DNS records
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
    </DashboardLayout>
  );
}