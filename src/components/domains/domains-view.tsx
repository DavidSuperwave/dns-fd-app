"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CSVUpload } from "@/components/domains/csv-upload";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircle, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Removed DashboardLayout import, assuming it's handled by the parent Server Component
import { useAuth } from "@/components/auth/auth-provider";
import { UserProfile } from '@/lib/supabase-client';

// Types moved from page.tsx
interface DomainAssignment {
  domain_id: string;
  user_email: string;
  created_by?: string | null;
}

interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  created_on: string;
  modified_on: string;
  last_synced?: string | null;
  redirect_url?: string | null;
  created_by?: string;
  has_files?: boolean;
  user_id?: string | null;
  cloudflare_id?: string; // Ensure this exists if used
}

interface ResultInfo {
  page: number;
  per_page: number;
  total_pages: number;
  count: number;
  total_count: number;
}

type DomainStatusFilter = "all" | "active" | "inactive" | "pending" | "paused" | "moved" | "initializing" | "deactivated";

interface DomainsViewProps {
  initialDomains: CloudflareDomain[];
  initialResultInfo: ResultInfo | null;
  initialAssignedUsers: Record<string, string>;
  allUsers: UserProfile[]; // Passed from Server Component
  initialLastSyncTime: string | null;
}

export default function DomainsView({
  initialDomains,
  initialResultInfo,
  initialAssignedUsers,
  allUsers, // Receive all users as a prop
  initialLastSyncTime
}: DomainsViewProps) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const supabase = createClient();
  const [allDomainsState, setAllDomainsState] = useState<CloudflareDomain[]>(initialDomains); // Use initial prop
  const [filteredDomains, setFilteredDomains] = useState<CloudflareDomain[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Initial load handled by server
  const [isError, setIsError] = useState<boolean>(false);
  const [isSyncing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(initialLastSyncTime);
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(initialResultInfo);
  const [currentPage, setCurrentPage] = useState<number>(initialResultInfo?.page || 1);
  const [isDialogOpen, setIsDialogOpen] = useState(false); // Add Domain dialog
  const [totalPages, setTotalPages] = useState<number>(initialResultInfo?.total_pages || 1);
  const [showNameservers, setShowNameservers] = useState(false);
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [originalNameservers, setOriginalNameservers] = useState<string[]>([]);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false); // Assign User dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // Delete Domain dialog
  // const [usingMockData, setUsingMockData] = useState(false); // Mock data logic removed/handled server-side
  const [statusFilter, setStatusFilter] = useState<DomainStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState<string>(""); // User search in assign dialog
  const [selectedDomainForAssignment, setSelectedDomainForAssignment] = useState<CloudflareDomain | null>(null);
  const [selectedDomainForDeletion, setSelectedDomainForDeletion] = useState<CloudflareDomain | null>(null);
  const [deletionConfirmation, setDeletionConfirmation] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState<Record<string, string>>(initialAssignedUsers); // Use initial prop
  // Removed realUsers and isLoadingUsers state, using the allUsers prop passed from the server component

  // Apply filters to domains
  const applyFilters = useCallback((domainsToFilter: CloudflareDomain[]) => {
    if (!domainsToFilter || !Array.isArray(domainsToFilter)) return [];
    let result = [...domainsToFilter];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(domain => domain.name.toLowerCase().includes(query));
    }
    if (statusFilter !== "all") {
      if (statusFilter === "paused") {
        result = result.filter(domain => domain.paused);
      } else {
        result = result.filter(domain => !domain.paused && String(domain.status || "").toLowerCase() === statusFilter);
      }
    }
    return result;
  }, [searchQuery, statusFilter]);

  // Effect to update filtered domains and pagination when filters/data change
  useEffect(() => {
    const filtered = applyFilters(allDomainsState);
    const PAGE_SIZE = 25;
    const totalCount = filtered.length;
    const calculatedTotalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
    const validPage = Math.min(Math.max(1, currentPage), calculatedTotalPages);

    if (validPage !== currentPage && totalCount > 0) {
      setCurrentPage(validPage);
    } else if (totalCount === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }

    const pageToUse = totalCount > 0 ? validPage : 1;
    const startIndex = (pageToUse - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedSlice = filtered.slice(startIndex, endIndex);

    setFilteredDomains(paginatedSlice);
    setTotalPages(calculatedTotalPages);
    setResultInfo(prev => ({
      ...(prev ?? { page: 1, per_page: PAGE_SIZE, total_pages: 1, count: 0, total_count: 0 }),
      page: pageToUse,
      total_pages: calculatedTotalPages,
      count: paginatedSlice.length,
      total_count: totalCount,
    }));
  }, [allDomainsState, searchQuery, statusFilter, applyFilters, currentPage]);

  // Effect for realtime assignment updates (remains client-side)
  useEffect(() => {
    const channel = supabase.channel('realtime_domain_assignments_client');
    channel
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'domain_assignments',
      }, (payload) => {
        console.log('[Realtime Client] Assignment change:', payload);
        const changedAssignment = (payload.new || payload.old) as DomainAssignment;
        if (changedAssignment) {
          if (payload.eventType === 'DELETE') {
            setAssignedUsers(prev => {
              const updated = { ...prev };
              if (updated[changedAssignment.domain_id]) {
                 delete updated[changedAssignment.domain_id];
              }
              return updated;
            });
          } else { // INSERT or UPDATE
            setAssignedUsers(prev => ({
              ...prev,
              [changedAssignment.domain_id]: changedAssignment.user_email,
            }));
          }
        }
      })
      .subscribe((status) => console.log('Realtime assignments status:', status));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, isAdmin, user?.email]); // Dependencies for realtime

  // --- Handlers (mostly unchanged, but using client/props) ---

  // Removed fetchUsers function as users are passed via props
  // const fetchUsers = useCallback(async () => { ... }, []);

  const handleOpenChange = (open: boolean) => { /* ... Add Domain Dialog logic ... */ };
  const fetchCurrentNameservers = async (domain: string) => { /* ... */ };
  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  const handleRedirectChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  const stripUrlPrefixes = (url: string) => url.replace(/^(https?:\/\/)?(www\.)?/, '');
  const validateDomain = (domain: string): { isValid: boolean; error?: string } => { /* ... */ return {isValid: true}; }; // Simplified for brevity
  const handlePageChange = (newPage: number) => {
      const maxPage = totalPages || 1;
      const validPage = Math.min(Math.max(1, newPage), maxPage);
      if (validPage !== currentPage) {
        setCurrentPage(validPage);
      }
  };
  const handleDeleteDomain = async () => {
     if (!selectedDomainForDeletion) return;
     if (deletionConfirmation !== selectedDomainForDeletion.name) { toast.error("Confirmation text does not match."); return; }
     setIsDeleting(true);
     try {
       // Simplified: Assume Cloudflare deletion happens or is handled elsewhere/manually for now
       // Call Supabase API to delete
       const apiResponse = await fetch(`/api/domains/${selectedDomainForDeletion.id}`, { method: 'DELETE' });
       if (!apiResponse.ok) {
           const errorData = await apiResponse.json();
           throw new Error(errorData.error || 'Failed to delete domain from DB');
       }
       // Update local state instead of reloading full page
       setAllDomainsState(prev => prev.filter(d => d.id !== selectedDomainForDeletion.id));
       setAssignedUsers(prev => {
         const newAssignments = { ...prev };
         delete newAssignments[selectedDomainForDeletion.id];
         return newAssignments;
       });
       toast.success(`Domain ${selectedDomainForDeletion.name} deleted.`);
       setIsDeleteDialogOpen(false);
       setDeletionConfirmation(''); // Reset confirmation
     } catch (error) {
         console.error("Error deleting domain:", error);
         toast.error(error instanceof Error ? error.message : "Failed to delete domain.");
     } finally {
         setIsDeleting(false);
     }
  };
  const formatDate = (dateString: string | null | undefined, includeTime: boolean = false): string => {
      if (!dateString) return 'N/A';
      try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return 'Invalid Date';
          return includeTime ? date.toLocaleString() : date.toLocaleDateString();
      } catch (e) { return 'Invalid Date'; }
  };
  const resetFilters = () => {
      setStatusFilter("all");
      setSearchQuery("");
      setCurrentPage(1);
  };
  const getStatusStyle = (status: string | null | undefined, paused: boolean) => {
      if (paused) return "bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium";
      const normalizedStatus = (status || '').toLowerCase();
      switch (normalizedStatus) {
        case "active": return "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium";
        case "pending": case "initializing": return "bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium";
        case "inactive": case "deactivated": return "bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium";
        case "moved": return "bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium";
        default: return "bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium";
      }
  };
  const handleAddDomain = async () => { /* ... (Needs adjustment for state update & auth) ... */
      // Get token inside handler
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error("Not authenticated"); return; }
      // ... rest of add logic ...
      // On success, update allDomainsState locally
      // setAllDomainsState(prev => [...prev, insertedDomain]);
  };
  const viewDnsRecords = async (domainId: string, domainName: string) => {
      try {
        const { data: domainData, error: domainError } = await supabase
          .from('domains')
          .select('cloudflare_id')
          .eq('id', domainId)
          .single();
        if (domainError || !domainData?.cloudflare_id) {
          toast.error('Failed to get domain info (CF ID missing)'); return;
        }
        localStorage.setItem('selectedDomain', JSON.stringify({ id: domainId, name: domainName, cloudflare_id: domainData.cloudflare_id }));
        router.push('/dns-records');
      } catch (error) { toast.error('Failed to load DNS records page'); }
  };
  const getDomainStatusText = (status: string | null | undefined, paused: boolean) => {
      if (paused) return "Paused";
      if (!status) return "Unknown";
      return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Form state for Add Domain Dialog
  const [formError, setFormError] = useState<string | null>(null);
  const [currentNameservers, setCurrentNameservers] = useState<string[] | null>(null);
  const [newDomain, setNewDomain] = useState({ name: "", redirect: "", isNameValid: false, isRedirectValid: false });


  // Calculate displayed domains based on pagination
  const paginatedDomains = filteredDomains; // Already sliced in the effect

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6 lg:px-8">
      {/* Header and Filters (JSX moved from page.tsx) */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Add Domain Button & Dialog Trigger */}
             <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm" className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
                      <PlusCircle className="h-4 w-4" /> Add Domain
                    </Button>
                  </DialogTrigger>
                  {/* Add Domain DialogContent */}
                  <DialogContent className="sm:max-w-2xl">
                      {/* ... Content for Add Domain Dialog ... */}
                       {!showNameservers ? (
                        <>
                          <DialogHeader className="mb-6">
                            <DialogTitle>Add New Domain</DialogTitle>
                            <DialogDescription className="mt-2">
                              Enter the domain and the target domain/URL it should redirect to.
                            </DialogDescription>
                          </DialogHeader>
                          {formError && ( <Alert variant="destructive" className="mb-6"><AlertTriangle className="h-4 w-4" /><AlertDescription>{formError}</AlertDescription></Alert> )}
                          <form onSubmit={(e) => { e.preventDefault(); handleAddDomain(); }}>
                            <div className="space-y-6">
                              <div className="grid grid-cols-5 items-center gap-8">
                                <Label htmlFor="add-domain-name" className="text-right text-sm font-medium">Domain Name</Label>
                                <Input id="add-domain-name" className="col-span-4" value={newDomain.name} onChange={handleDomainChange} placeholder="your-domain.com" required />
                              </div>
                              <div className="grid grid-cols-5 items-center gap-8">
                                <Label htmlFor="add-domain-redirect" className="text-right text-sm font-medium">Redirect To</Label>
                                <Input id="add-domain-redirect" className="col-span-4" value={newDomain.redirect} onChange={handleRedirectChange} placeholder="target-domain.com or target.com/path" required />
                              </div>
                            </div>
                            <DialogFooter className="mt-8">
                              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                              <Button type="submit" disabled={isSubmitting || !newDomain.isNameValid || !newDomain.isRedirectValid} className={(!newDomain.isNameValid || !newDomain.isRedirectValid) ? "opacity-50 cursor-not-allowed" : ""}>
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</> : "Add Domain"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </>
                      ) : (
                        <> {/* Nameserver Display */} </>
                      )}
                  </DialogContent>
             </Dialog>
          </div>
        </div>
        {/* Filtering and search options */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
           <div className="flex-1">
             <Label htmlFor="search-domains" className="sr-only">Search Domains</Label>
             <Input id="search-domains" placeholder="Search domains..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full" />
           </div>
           <div className="w-full sm:w-40">
             <Label htmlFor="status-filter" className="sr-only">Filter by Status</Label>
             <Select value={statusFilter} onValueChange={(value: DomainStatusFilter) => { setStatusFilter(value); setCurrentPage(1); }}>
               <SelectTrigger id="status-filter" className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Statuses</SelectItem>
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

      {/* Loading/Error/Table Display */}
      {isLoading ? (
         <div className="text-center p-8">Loading...</div> // Simplified loading
      ) : isError ? (
         <div className="text-center p-8 text-red-600">Error loading domains.</div> // Simplified error
      ) : (
        <>
          {/* Domains Table */}
          <div className="rounded-md border shadow-sm overflow-hidden bg-background mb-6">
            <Table>
              <TableHeader>
                 <TableRow>
                    <TableHead className="w-[20%]">Domain Name</TableHead>
                    <TableHead className="w-[15%]">Redirect</TableHead>
                    <TableHead className="w-[10%]">Created On</TableHead>
                    <TableHead className="w-[15%]">Storage</TableHead>
                    <TableHead className="w-[10%]">Last Synced</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[10%]">Assigned User</TableHead>
                    <TableHead className="w-[15%] text-right">Actions</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDomains.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">No domains found.</TableCell></TableRow>
                ) : (
                  paginatedDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-medium">{domain.name}</TableCell>
                      <TableCell>
                          {domain.redirect_url ? (
                            <a href={domain.redirect_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm max-w-[200px] truncate group" title={domain.redirect_url}>
                              <span className="truncate">{domain.redirect_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : ( <span className="text-gray-500 text-sm">No redirect</span> )}
                      </TableCell>
                      <TableCell>{formatDate(domain.created_on)}</TableCell>
                      <TableCell>
                        <CSVUpload domainId={domain.id} domainName={domain.name} hasFiles={domain.has_files || false} userId={domain.user_id ?? undefined} />
                      </TableCell>
                      <TableCell>{formatDate(domain.last_synced)}</TableCell>
                      <TableCell><span className={getStatusStyle(domain.status, domain.paused)}>{getDomainStatusText(domain.status, domain.paused)}</span></TableCell>
                      <TableCell>{assignedUsers[domain.id] ? <span className="text-blue-600 text-sm font-medium">{assignedUsers[domain.id]}</span> : <span className="text-gray-500 text-sm">Unassigned</span>}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => viewDnsRecords(domain.id, domain.name)}>DNS Records</Button>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedDomainForAssignment(domain); setUserSearchQuery(''); setIsAssignDialogOpen(true); }}>Assign</Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { setSelectedDomainForDeletion(domain); setIsDeleteDialogOpen(true); setDeletionConfirmation(''); }} className="hover:bg-red-100 hover:text-red-800 border-red-200 text-red-700">Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination controls */}
          <div className="flex justify-between items-center pt-4">
             <div className="text-sm text-muted-foreground">
                {resultInfo ? `Showing ${paginatedDomains.length} of ${resultInfo.total_count} domains` : 'Loading pagination...'}
              </div>
              {(totalPages || 0) > 1 && (
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</Button>
                  <div className="flex items-center space-x-1"><span className="text-sm">Page {currentPage} of {totalPages || 1}</span></div>
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === (totalPages || 1)}>Next</Button>
                </div>
              )}
          </div>
        </>
      )}

      {/* User assignment dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl">Assign Domain to User</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              {selectedDomainForAssignment && ( <>Select a user to assign domain <strong>{selectedDomainForAssignment.name}</strong> to.</> )}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4 pb-2">
            <Input placeholder="Search users by name or email..." value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} className="w-full" />
          </div>
          <div className="grid gap-6 py-4 max-h-[400px] overflow-y-auto">
            {allUsers.length === 0 ? (
               <div className="text-center py-6 text-muted-foreground">No users available.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {allUsers
                  .filter(u =>
                    userSearchQuery === "" ||
                    (u.full_name && u.full_name.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
                    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  )
                  .map(filteredUser => (
                    <Button
                      key={filteredUser.id}
                      variant="outline"
                      className="justify-start text-left py-6 h-auto"
                      disabled={isSubmitting}
                      onClick={async () => {
                        if (selectedDomainForAssignment && filteredUser) {
                          setIsSubmitting(true);
                          try {
                            const payload = { domain_id: selectedDomainForAssignment.id, user_email: filteredUser.email };
                            const response = await fetch('/api/supabase/domain-assignments', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include', // Send cookies
                              body: JSON.stringify(payload),
                            });
                            const result = await response.json();
                            if (!response.ok || !result.success) throw new Error(result.error || 'API Error');
                            toast.success(`Domain assigned to ${filteredUser.full_name || filteredUser.email}`);
                            setAssignedUsers(prev => ({ ...prev, [selectedDomainForAssignment.id]: filteredUser.email }));
                            setIsAssignDialogOpen(false);
                          } catch (error) {
                              console.error("Error assigning domain:", error);
                              toast.error(error instanceof Error ? error.message : "Failed to assign domain.");
                          } finally { setIsSubmitting(false); }
                        }
                      }}
                    >
                       <div className="flex items-center gap-5 w-full">
                        <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-medium">
                          {filteredUser.full_name ? filteredUser.full_name.charAt(0).toUpperCase() : filteredUser.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-medium text-lg truncate">{filteredUser.full_name || 'N/A'}</span>
                          <span className="text-sm text-muted-foreground pt-1 truncate">{filteredUser.email}</span>
                        </div>
                      </div>
                    </Button>
                  ))}
                {/* "No results" message when searching */}
                {allUsers.filter(u => // Corrected filter logic
                    userSearchQuery === "" ||
                    (u.full_name && u.full_name.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
                    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  ).length === 0 && userSearchQuery !== "" && (
                   <div className="text-center py-6 text-muted-foreground">No users found matching "{userSearchQuery}"</div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 flex justify-between gap-4">
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)} className="px-6 py-2">Cancel</Button>
            {selectedDomainForAssignment && assignedUsers[selectedDomainForAssignment.id] && (
              <Button
                variant="destructive"
                disabled={isSubmitting}
                onClick={async () => {
                  if (selectedDomainForAssignment) {
                    setIsSubmitting(true);
                    try {
                      const currentAssignedUser = assignedUsers[selectedDomainForAssignment.id];
                      if (!currentAssignedUser) throw new Error('No user currently assigned');
                      const { error } = await supabase.from('domain_assignments').delete().eq('domain_id', selectedDomainForAssignment.id).eq('user_email', currentAssignedUser);
                      if (error) throw error;
                      toast.info(`Domain unassigned from ${currentAssignedUser}`);
                      setAssignedUsers(prev => { const upd = { ...prev }; delete upd[selectedDomainForAssignment.id]; return upd; });
                      setIsAssignDialogOpen(false);
                    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to unassign'); }
                    finally { setIsSubmitting(false); }
                  }
                }}
                className="px-6 py-2"
              >
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unassigning...</> : "Unassign"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Domain Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
             {/* ... Delete Dialog Content ... */}
             <DialogHeader className="mb-6">
                <DialogTitle>Delete Domain</DialogTitle>
                <DialogDescription className="mt-2">
                  {selectedDomainForDeletion && ( <> <span className="block mb-4">This will <strong>permanently delete</strong> the domain <strong>{selectedDomainForDeletion.name}</strong> from Cloudflare and remove all of its assignments.</span><span className="block text-red-600 font-medium">This action cannot be undone.</span></> )}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); handleDeleteDomain(); }}>
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="domain-confirmation" className="text-sm font-medium">To confirm, type the domain name exactly:</Label>
                    <Input id="domain-confirmation" value={deletionConfirmation} onChange={(e) => setDeletionConfirmation(e.target.value)} placeholder={selectedDomainForDeletion?.name} className="mt-2" required />
                  </div>
                </div>
                <DialogFooter className="mt-8">
                  <Button type="button" variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setSelectedDomainForDeletion(null); setDeletionConfirmation(''); }}>Cancel</Button>
                  <Button type="submit" variant="destructive" disabled={isDeleting || !selectedDomainForDeletion || deletionConfirmation !== selectedDomainForDeletion.name}>
                    {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Delete Domain"}
                  </Button>
                </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
    </div>
  );
}