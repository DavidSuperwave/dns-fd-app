"use client";

import React, { useState, useEffect, useCallback, useRef} from "react";
import { CSVUpload } from "@/components/domains/csv-upload";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { PlusCircle, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { createClient,supabaseAdmin } from "@/lib/supabase-client";
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
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { useAuth } from "../../components/auth/auth-provider";

// Domain assignment interface
interface DomainAssignment {
  domain_id: string;
  user_email: string;
  created_by?: string | null;
}

// Cloudflare domain interface
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
  has_files?: boolean; // Add this property
  user_id?: string | null; // Add this property
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
const mockDomains: CloudflareDomain[] = Array.from({ length: 6 }, (_, i) => ({
  id: String(i + 1),
  name: `example-${i + 1}.com`,
  status: i === 2 ? "pending" : i === 4 ? "inactive" : i === 5 ? "moved" : "active",
  paused: i === 3,
  type: "full",
  created_on: new Date(2023, 0, 15 + i * 30).toISOString(),
  modified_on: new Date(2023, 0, 15 + i * 30).toISOString(),
  last_synced: i === 5 ? null : new Date(2023, 0, 16 + i * 30).toISOString(),
  redirect_url: i % 2 === 0 ? `https://target-${i + 1}.com` : null,
  created_by: "admin@example.com"
}));

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
  const { user, isAdmin } = useAuth();
  const supabase = createClient(); // Create client instance
  // const [allDomains, setAllDomains] = useState<CloudflareDomain[]>([]);
  const [domains, setDomains] = useState<CloudflareDomain[]>([]);
  // const [filteredDomains, setFilteredDomains] = useState<CloudflareDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [isSyncing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [showNameservers, setShowNameservers] = useState(false);
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [originalNameservers, setOriginalNameservers] = useState<string[]>([]);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DomainStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [selectedDomainForAssignment, setSelectedDomainForAssignment] = useState<CloudflareDomain | null>(null);
  const [selectedDomainForDeletion, setSelectedDomainForDeletion] = useState<CloudflareDomain | null>(null);
  const [deletionConfirmation, setDeletionConfirmation] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Array<{ id: string; email: string; name?: string }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/supabase/get-all-users');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUsers(json.users || []);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);
  
  
  useEffect(() => {
    if (isAssignDialogOpen) {
      loadUsers();
    }
  }, [isAssignDialogOpen, loadUsers]);
  // Apply filters to domains - wrapped in useCallback
   // Added dependencies for applyFilters


  // Load domains from latest scan
  const loadDomains = useCallback(
    async ({ useMockData = false, signal }: { useMockData?: boolean; signal?: AbortSignal }) => {
      setIsLoading(true);
      setIsError(false);
  
      try {
        if (useMockData) {
          // Mock data loading
          const mockWithSync = mockDomains.map(domain => ({
            ...domain,
            last_synced: lastSyncTime || domain.last_synced,
          }));
          // setAllDomains(mockWithSync);
          setDomains(mockWithSync);
          // setFilteredDomains(mockWithSync);
          setResultInfo(mockResultInfo);
          setTotalPages(mockResultInfo.total_pages);
          setUsingMockData(true);
          toast.info("Using sample data for demonstration");
          return;
        }
  
        const isAuthReady = isAdmin !== undefined && (isAdmin || user?.email);
        if (!isAuthReady) {
          console.warn('[loadDomains] Auth not ready or missing user email. Waiting for auth state.');
          return;
        }
  
        const PAGE_SIZE = 25;
  
        // Get last sync time
        const { data: scanData } = await supabase
          .from('scan_results')
          .select('completed_at, updated_at')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
  
        const timestamp = scanData?.completed_at || scanData?.updated_at;
        setLastSyncTime(timestamp ? new Date(timestamp as string).toISOString() : null);
  
        // Build base query
        let baseQuery = supabase.from('domains').select('*', { count: 'exact' });
  
        // For non-admin users, restrict domains by assigned IDs
        if (!isAdmin && user?.email) {
          const { data: assignments, error: assignmentError } = await supabase
            .from('domain_assignments')
            .select('domain_id')
            .eq('user_email', user.email)
            .abortSignal(signal ?? new AbortController().signal);
  
          if (assignmentError) {
            console.error(`Error fetching domain assignments for ${user.email}:`, assignmentError);
            // setAllDomains([]);
            setDomains([]);
            // setFilteredDomains([]);
            setResultInfo(null);
            setTotalPages(1);
            return;
          }
  
          if (!assignments || assignments.length === 0) {
            // setAllDomains([]);
            setDomains([]);
            // setFilteredDomains([]);
            setResultInfo(null);
            setTotalPages(1);
            return;
          }
  
          const assignedDomainIds = assignments.map(a => a.domain_id);
          baseQuery = baseQuery.in('id', assignedDomainIds);
        }
  
        // Apply search filter
        if (searchQuery.trim()) {
          baseQuery = baseQuery.ilike('name', `%${searchQuery.trim()}%`);
        }
  
        // Apply status filter
        if (statusFilter !== "all") {
          if (statusFilter === "paused") {
            baseQuery = baseQuery.eq('paused', true);
          } else {
            baseQuery = baseQuery.eq('paused', false).eq('status', statusFilter);
          }
        }
  
        // Order and paginate
        baseQuery = baseQuery.order('modified_on', { ascending: false });
  
        // Calculate range for page
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE - 1;
        baseQuery = baseQuery.range(startIndex, endIndex);
  
        // Fetch data and count in one request
        const { data: pageData, count, error: pageError, status, statusText } = await baseQuery.abortSignal(signal ?? new AbortController().signal);

if (pageError) {
  console.error('Page fetch error:', {
    pageError,
    pageData,
    status,
    statusText,
  });
  throw pageError;
}

// Defensive: treat null as empty array
const typedPageData = (pageData as CloudflareDomain[]) || [];
        const totalCount = count ?? 0;
        const calculatedTotalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
        setDomains(typedPageData);
        // setFilteredDomains(typedPageData);
        setTotalPages(calculatedTotalPages);
        setResultInfo({
          page: currentPage,
          per_page: PAGE_SIZE,
          total_pages: calculatedTotalPages,
          count: typedPageData.length,
          total_count: totalCount,
        });
  
      } catch (error) {
        console.error("Error loading domains:", error);
        setIsError(true);
        if (!useMockData) {
          toast.error("Error loading domain data. Try using sample data.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isAdmin, user?.email, searchQuery, statusFilter, currentPage, lastSyncTime]
  );
  // ...existing code...

  // Load domains only when auth state (isAdmin and user.email for non-admins) is confirmed, or page changes
  useEffect(() => {
    const controller = new AbortController();
  
    const load = async () => {
      const isAuthReady = isAdmin !== undefined && (isAdmin || (!isAdmin && user?.email));
      if (!isAuthReady) {
        console.log('[Effect] Auth state not fully ready, deferring loadDomains call.', { isAdmin, userEmail: user?.email });
        return;
      }
  
      try {
        await loadDomains({ useMockData: false, signal: controller.signal });
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Load aborted');
        } else {
          console.error('Error loading domains:', error);
          setIsError(true);
          toast.error("Error loading domains");
        }
      }
    };
  
    load();
  
    return () => controller.abort();
  }, [isAdmin, user?.email,searchQuery, statusFilter, currentPage]);
   // Make sure currentPage is a dependenc
  
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

  // Load assigned users for domains
  const loadAssignedUsers = useCallback(async () => {
    try {
      const { data: assignments } = await supabase
        .from('domain_assignments')
        .select('domain_id, user_email');
      
      if (assignments) {
        const assignmentMap: Record<string, string> = {};
        const typedAssignments = assignments as DomainAssignment[];
        
        typedAssignments.forEach(assignment => {
          if (isAdmin) {
            assignmentMap[assignment.domain_id] = assignment.user_email;
          } else if (assignment.user_email === user?.email) {
            assignmentMap[assignment.domain_id] = assignment.user_email;
          }
        });
        
        setAssignedUsers(assignmentMap);
      }
    } catch (error) {
      console.error('Error loading assigned users:', error);
    }
  }, [isAdmin, user?.email]);
  
  useEffect(() => {
    const controller = new AbortController();
    
    const load = async () => {
      await loadAssignedUsers();
    };
    
    load();
  
    const channel = supabase.channel('realtime_changes');
    
    // Subscribe to domain assignments changes
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'domain_assignments',
      }, async (payload) => {
        const assignment = payload.new;
        if (isAdmin || (user?.email && (assignment as DomainAssignment)?.user_email === user.email)) {
          await loadAssignedUsers();
        }
      })
      // Subscribe to domains changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'domains',
      }, async (payload) => {
        const domain = payload.new;
        if (isAdmin ||
            (user?.email &&
             ((domain as CloudflareDomain)?.created_by === user.email ||
              (assignedUsers && (domain as CloudflareDomain)?.id && assignedUsers[(domain as CloudflareDomain).id] === user.email)))) {
          console.log('[Realtime] Domain change detected, reloading domain data');
          if (!isLoading) {
            await loadDomains({ useMockData: false, signal: controller.signal });
          }
        }
      })
      .subscribe();
  
    return () => {
      controller.abort();
      channel.unsubscribe();
    };
  }, [isAdmin, user?.email, loadAssignedUsers, isLoading]); // Don't depend on assignedUsers here
   // Add dependencies

  // Handle dialog state
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setNewDomain({
        name: '',
        redirect: '',
        isNameValid: false,
        isRedirectValid: false
      });
      setShowNameservers(false);
      setNameservers([]);
      setOriginalNameservers([]);
      setFormError(null);
      setCurrentNameservers(null);
    }
    setIsDialogOpen(open);
  };

  // Form state
  const [formError, setFormError] = useState<string | null>(null);
  const [currentNameservers, setCurrentNameservers] = useState<string[] | null>(null);
  const [newDomain, setNewDomain] = useState({
    name: "",
    redirect: "",
    isNameValid: false,
    isRedirectValid: false
  });

  // Fetch current nameservers when domain name changes
  const fetchCurrentNameservers = async (domain: string) => {
    try {
      const response = await fetch(`/api/cloudflare/nameservers?domain=${domain}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setCurrentNameservers(data.nameservers);
      } else {
        setCurrentNameservers(null);
      }
    } catch (error) {
      console.error('Error fetching nameservers:', error);
      setCurrentNameservers(null);
    }
  };

  // Handle domain name change
  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    const validation = validateDomain(value);
    setNewDomain({
      ...newDomain,
      name: value,
      isNameValid: validation.isValid
    });
    
    // Only fetch nameservers if domain is valid
    if (validation.isValid) {
      fetchCurrentNameservers(value);
    } else {
      setCurrentNameservers(null);
    }
  };

  const handleRedirectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    const validation = validateDomain(stripUrlPrefixes(value));
    setNewDomain({
      ...newDomain,
      redirect: value,
      isRedirectValid: validation.isValid
    });
  };

  // Function to strip http://, https://, and www.
  const stripUrlPrefixes = (url: string) => {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '');
  };

  // Function to validate domain
  const validateDomain = (domain: string): { isValid: boolean; error?: string } => {
    // Check for dashes in domain part (before first dot)
    const domainPart = domain.split('.')[0];
    if (domainPart.includes('-')) {
      return {
        isValid: false,
        error: "We do not support dashed domains yet"
      };
    }

    // Basic domain validation
    const domainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9](\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return {
        isValid: false,
        error: "Please enter a valid domain name (e.g., example.com)"
      };
    }

    return { isValid: true };
  };

  // Trigger full sync with Cloudflare


  // Handle page change
  const handlePageChange = (newPage: number) => {
    console.log('Page change requested:', {
      from: currentPage,
      to: newPage,
      totalPages: resultInfo?.total_pages,
      totalData: domains.length // Using filtered domains from domains state
    });

    // Validate page number using totalPages state (which is now based on totalCount)
    const maxPage = totalPages || 1;
    const validPage = Math.min(Math.max(1, newPage), maxPage);

    if (validPage !== currentPage) {
      // Simply update the currentPage state.
      // The useEffect hook watching currentPage will trigger loadDomains to fetch the new page.
      setCurrentPage(validPage);
      console.log(`Page change requested to ${validPage}, loadDomains will fetch.`);
    }
  };
  
  // Handle domain deletion
  const handleDeleteDomain = async () => {
    if (!selectedDomainForDeletion) return;
    
    // Check confirmation text matches domain name
    if (deletionConfirmation !== selectedDomainForDeletion.name) {
      toast.error("Confirmation text does not match domain name");
      return;
    }
    
    setIsDeleting(true);
    
    try {
      let cloudflareDeletionAttempted = false;
      let cloudflareDeletionSuccessful = false;
      let cloudflareErrorMessage = '';

      try {
        // Get the domain from Supabase first to get the Cloudflare ID
        const { data: domainData, error: domainError } = await supabase
          .from('domains')
          .select('cloudflare_id')
          .eq('id', selectedDomainForDeletion.id)
          .single();

        if (domainError || !domainData?.cloudflare_id) {
          throw new Error('Failed to get Cloudflare ID for domain from Supabase');
        }

        const cfId = domainData.cloudflare_id;
        console.log(`[handleDeleteDomain] Attempting to delete domain with internal ID: ${selectedDomainForDeletion.id}, Cloudflare ID: ${cfId}`);
        cloudflareDeletionAttempted = true;

        // Delete from Cloudflare using the Cloudflare ID
        const response = await fetch(`/api/cloudflare/domains/${cfId}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        console.log('Cloudflare delete response:', data);

        if (!response.ok || !data.success) {
          cloudflareErrorMessage = data.error ||
                                 data.errors?.[0]?.message ||
                                 data.messages?.[0]?.message ||
                                 `Cloudflare API request failed with status ${response.status}`;
          console.error('Cloudflare delete error:', { status: response.status, error: cloudflareErrorMessage, data });
          // DO NOT throw here if it's an invalid ID error, let Supabase deletion proceed
          if (!cloudflareErrorMessage.toLowerCase().includes('invalid object identifier') && !cloudflareErrorMessage.toLowerCase().includes('could not route')) {
             throw new Error(cloudflareErrorMessage); // Throw for other Cloudflare errors
          }
        } else {
          cloudflareDeletionSuccessful = true;
          console.log(`Successfully deleted domain ${cfId} from Cloudflare.`);
          // Wait only if Cloudflare deletion was successful
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (cfError) {
         // Catch errors during the Cloudflare fetch/check itself (e.g., network error, failed to get ID)
         console.error('Error during Cloudflare deletion attempt:', cfError);
         // If we didn't even get a specific message from CF API, use the caught error's message
         if (!cloudflareErrorMessage) {
           cloudflareErrorMessage = cfError instanceof Error ? cfError.message : 'Error during Cloudflare interaction';
         }
         // Re-throw unless it's the specific invalid ID error we want to ignore for CF part
         if (!cloudflareErrorMessage.toLowerCase().includes('invalid object identifier') && !cloudflareErrorMessage.toLowerCase().includes('could not route')) {
            throw cfError;
         }
      }

      // --- Call Server-Side API for Supabase Deletion ---
      console.log(`[handleDeleteDomain] Calling API to delete domain ID ${selectedDomainForDeletion?.id} from Supabase.`);
      const apiResponse = await fetch(`/api/domains/${selectedDomainForDeletion.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const apiResult = await apiResponse.json();

      if (!apiResponse.ok) {
        console.error(`[handleDeleteDomain] API deletion failed for ${selectedDomainForDeletion?.id}:`, apiResult.error);
        // Throw this error as it's critical for DB consistency
        throw new Error(`Failed to delete domain from database via API: ${apiResult.error || `Status ${apiResponse.status}`}`);
      }
      console.log(`[handleDeleteDomain] Successfully deleted domain ID ${selectedDomainForDeletion?.id} via API.`);

      // After successful deletion (or skipped deletion), reload the current page data
      // This will naturally handle pagination adjustments if the current page becomes empty
      console.log(`[handleDeleteDomain] Domain deletion process continuing, reloading current page data.`);
      await loadDomains({ useMockData: false });


      // Remove domain assignments (using the regular client, assuming RLS allows it or it's handled by triggers/API)
      console.log(`[handleDeleteDomain] Deleting assignments for domain ID ${selectedDomainForDeletion?.id}.`);
      const { error: assignmentError } = await supabase
        .from('domain_assignments')
        .delete()
        .eq('domain_id', selectedDomainForDeletion?.id); // Delete assignments by internal ID

      if (assignmentError) {
        // Log but don't necessarily fail the whole operation
        console.error('Failed to delete domain assignments:', assignmentError);
        toast.warning(`Domain removed, but failed to clear assignments: ${assignmentError.message}`);
      } else {
         console.log(`Successfully deleted assignments for domain ID ${selectedDomainForDeletion?.id}.`);
      }

      // Refresh assignments in UI state
      await loadAssignedUsers();

      // Show appropriate success/warning message
      if (cloudflareDeletionAttempted && !cloudflareDeletionSuccessful) {
         toast.warning(`Removed stale domain ${selectedDomainForDeletion?.name} from the platform. It did not exist or was invalid in Cloudflare.`, {
            description: `Cloudflare error: ${cloudflareErrorMessage}`
         });
      } else {
         // Adjust success message to reflect API deletion
         toast.success(`Domain ${selectedDomainForDeletion?.name} deleted successfully from Cloudflare and the platform. Assignments removed.`);
      }

      // Close the dialog and reset
      setIsDeleteDialogOpen(false);
      setSelectedDomainForDeletion(null);
      setDeletionConfirmation('');

    } catch (error) { // This catch block now correctly corresponds to the try block starting at 641
      // Catch errors from Cloudflare deletion or unexpected errors during the process
      console.error('Error during the deletion process:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during deletion';
      toast.error(`Failed to complete deletion: ${errorMessage}`, {
        description: 'The domain might be partially deleted. Please check Supabase and Cloudflare.'
      });
    } finally { // This finally block now correctly corresponds to the try block starting at 641
      setIsDeleting(false);
    }
  }; // End of handleDeleteDomain

  // Format date from Cloudflare timestamp
  const formatDate = (dateString: string, includeTime: boolean = false) => {
    const date = new Date(dateString);
    return includeTime ?
      date.toLocaleString() :
      date.toLocaleDateString();
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
  const handleAddDomain = async () => {
    try {
      setIsSubmitting(true);

      // Clean up domain and redirect
      const cleanDomain = stripUrlPrefixes(newDomain.name);
      const cleanRedirect = newDomain.redirect ? stripUrlPrefixes(newDomain.redirect) : '';

      // Both fields are required
      if (!cleanDomain || !cleanRedirect) {
        toast.error("Both domain and redirect are required");
        return;
      }

      // Validate domain
      const domainValidation = validateDomain(cleanDomain);
      if (!domainValidation.isValid) {
        toast.error(domainValidation.error || "Invalid domain name");
        return;
      }

      // Validate redirect
      if (!cleanRedirect.match(/^[a-z0-9][a-z0-9-]*[a-z0-9](\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) {
        toast.error("Please enter a valid redirect domain");
        return;
      }

      // Check if domain already exists
      const existingDomain = domains.find(d =>
        stripUrlPrefixes(d.name).toLowerCase() === cleanDomain.toLowerCase()
      );
      if (existingDomain) {
        toast.error("This domain has already been added");
        return;
      }

      // Call Cloudflare API to add domain
      const response = await fetch('/api/cloudflare/zone-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cleanDomain,
          redirect_url: `https://${cleanRedirect}`
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const error = result.error?.toLowerCase() || '';
        if (error.includes('already exists')) {
          setFormError("This domain already exists");
          return;
        }
        throw new Error(result.error || 'Failed to add domain');
      }

      if (result.success) {
        // Add domain to Supabase through API
        const supabaseResponse = await fetch('/api/supabase/domains', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cloudflare_id: result.domain.id,
            name: result.domain.name,
            status: result.domain.status,
            paused: result.domain.paused,
            type: result.domain.type,
            created_on: result.domain.created_on,
            modified_on: result.domain.modified_on,
            last_synced: new Date().toISOString(),
            redirect_url: result.domain.redirect_url,
            created_by: user?.email || null
          })
        });

        if (!supabaseResponse.ok) {
          const errorData = await supabaseResponse.json();
          console.error('Failed to add domain to Supabase:', errorData);
          throw new Error(errorData.error || 'Failed to add domain to database');
        }

        const insertedData = await supabaseResponse.json();
        console.log('Successfully inserted domain:', insertedData);

        // Assign domain to the user who created it
        if (user?.email) {
          try {
            // Use the ID returned from the Supabase domain insertion
            const supabaseDomainId = insertedData.data?.id;
            if (!supabaseDomainId) { // Check specifically for the ID
              console.error('Supabase domain insertion response missing data.id:', insertedData);
              toast.error('Failed to get internal domain ID after creation. Cannot assign domain.');
              // Potentially close the dialog or handle UI state appropriately here
              setIsSubmitting(false); // Ensure submit button is re-enabled
              return; // Stop the assignment process
            }

            const assignmentPayload = {
              domain_id: supabaseDomainId,
              user_email: user.email
            };

            console.log('Preparing to call assignment API:', {
              url: '/api/supabase/domain-assignments',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(assignmentPayload)
            });

            // Use a dedicated API endpoint to create the assignment with admin privileges
            const assignResponse = await fetch('/api/supabase/domain-assignments', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(assignmentPayload)
            });

            // --- Enhanced Error Handling for Assignment API Response ---
            if (!assignResponse.ok) {
              const responseStatus = assignResponse.status;
              const responseHeaders: Record<string, string> = {};
              assignResponse.headers.forEach((value, key) => {
                responseHeaders[key] = value;
              });

              let errorBodyText = 'Could not read error response body.';
              let parsedErrorJson: Record<string, unknown> | null = null;
              try {
                // Attempt to read the body as text first
                errorBodyText = await assignResponse.text();
                console.log('Raw error response text from assignment API:', errorBodyText);
                // Then try to parse it as JSON
                try {
                  parsedErrorJson = JSON.parse(errorBodyText);
                } catch {
                  console.warn('Assignment API error response was not valid JSON.');
                }
              } catch (readError) {
                console.error('Failed to read error response body:', readError);
              }

              // Determine the best error message to show
              const errorMessage = parsedErrorJson?.error // Use JSON error if available
                                   || (errorBodyText.length < 200 ? errorBodyText : null) // Use short text body if available
                                   || `API request failed with status ${responseStatus}`; // Fallback

              console.error('Domain assignment API error details:', {
                status: responseStatus,
                headers: responseHeaders,
                bodyText: errorBodyText,
                parsedJsonError: parsedErrorJson?.error,
                finalMessage: errorMessage
              });

              toast.warning(`Domain created but assignment failed: ${errorMessage}`);

            } else {
              // Success case
              const assignResult = await assignResponse.json(); // Assume success response is JSON
              console.log('Domain assignment API succeeded:', assignResult);
              
              // Update assignments in memory
              setAssignedUsers(prev => ({
                ...prev,
                [supabaseDomainId]: user.email // Use Supabase ID for local state update
              }));
              
              // Force refresh the domain list to update with assignments
              setTimeout(() => {
                loadDomains({ useMockData: false }) // Reload current page
              }, 1000);
            }
          } catch (assignError) {
            console.error('Exception in domain assignment:', assignError);
            toast.warning('Domain created but assignment failed');
          }
        }

        // Add domain to local state

        // Show nameservers if available
        if (result.nameservers?.length) {
          setNameservers(result.nameservers);
          setOriginalNameservers(result.originalNameservers || []);
          setShowNameservers(true);
        } else {
          setIsDialogOpen(false);
          toast.success('Domain added successfully');
          
          // Reload domains to ensure proper filtering
          loadDomains({ useMockData: false }); // Reload current page
        }

        // Show nameservers
        if (result.nameservers?.length) {
          setNameservers(result.nameservers);
          setOriginalNameservers(result.originalNameservers || []);
          setShowNameservers(true);
        } else {
          setIsDialogOpen(false);
          toast.success('Domain added successfully');
        }
      } else {
        throw new Error(result.error || 'Failed to add domain');
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add domain');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View DNS records for a domain
  const viewDnsRecords = async (domainId: string, domainName: string) => {
    try {
      // Get the Cloudflare ID from Supabase
      const { data: domainData, error: domainError } = await supabase
        .from('domains')
        .select('cloudflare_id')
        .eq('id', domainId)
        .single();

      if (domainError || !domainData?.cloudflare_id) {
        toast.error('Failed to get domain information');
        return;
      }

      // Store domain info in localStorage to use in DNS records page
      localStorage.setItem('selectedDomain', JSON.stringify({
        id: domainId,
        name: domainName,
        cloudflare_id: domainData.cloudflare_id
      }));
      
      router.push('/dns-records');
    } catch (error) {
      console.error('Error viewing DNS records:', error);
      toast.error('Failed to load DNS records');
    }
  };

  // Get domain status display text
  const getDomainStatusText = (status: string, paused: boolean) => {
    if (paused) return "Paused";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  if (searchTimeout.current) clearTimeout(searchTimeout.current);
  searchTimeout.current = setTimeout(() => {
    setSearchQuery(value);
  }, 400); // 400ms debounce
};

  return (
    <DashboardLayout>
      <div className="w-full max-w-full px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            
            <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
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
                  <DialogContent className="sm:max-w-2xl">
                {!showNameservers ? (
                  <>
                    <DialogHeader className="mb-6">
                      <DialogTitle>Add New Domain</DialogTitle>
                      <DialogDescription className="mt-2">
                        Enter the domain details. Both domain and redirect are required. The system will automatically strip http://, https://, and www. prefixes.
                      </DialogDescription>
                    </DialogHeader>
                    {formError && (
                      <Alert variant="destructive" className="mb-6">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{formError}</AlertDescription>
                      </Alert>
                    )}
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      handleAddDomain();
                    }}>
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="grid grid-cols-5 items-center gap-8">
                            <Label htmlFor="name" className="text-right text-sm font-medium">
                              Domain Name
                            </Label>
                            <Input
                              id="name"
                              className="col-span-4"
                              value={newDomain.name}
                              onChange={handleDomainChange}
                              placeholder="example.com (without http:// or www.)"
                            />
                          </div>
                          {/* Current nameservers will be shown in success dialog */}
                        </div>
                        <div className="grid grid-cols-5 items-center gap-8">
                          <Label htmlFor="redirect" className="text-right text-sm font-medium">
                            Redirect To
                          </Label>
                          <Input
                            id="redirect"
                            className="col-span-4"
                            value={newDomain.redirect}
                            onChange={handleRedirectChange}
                            placeholder="target-domain.com or target-domain.com/path (required)"
                          />
                        </div>
                      </div>
                      <DialogFooter className="mt-8">
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting || !newDomain.isNameValid || !newDomain.isRedirectValid}
                          className={!newDomain.isNameValid || !newDomain.isRedirectValid ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Adding Domain...
                            </>
                          ) : (
                            "Add Domain"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Domain Added Successfully</DialogTitle>
                      <DialogDescription>
                        Update your domain&apos;s nameservers at your registrar to complete the setup.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 my-6">
                      <div>
                        <h3 className="text-sm font-medium mb-2">Current Nameservers</h3>
                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                          {currentNameservers && currentNameservers.length > 0 ? (
                            <ul className="space-y-1">
                              {currentNameservers.map((ns, i) => (
                                <li key={i} className="font-mono text-sm text-slate-600">{ns}</li>
                              ))}
                            </ul>
                          ) : originalNameservers?.length ? (
                            <ul className="space-y-1">
                              {originalNameservers.map((ns, i) => (
                                <li key={i} className="font-mono text-sm text-slate-600">{ns}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-500">N/A</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium mb-2">New Cloudflare Nameservers</h3>
                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                          <ul className="space-y-1">
                            {nameservers.map((ns, i) => (
                              <li key={i} className="font-mono text-sm text-emerald-600">{ns}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    <Alert className="border-yellow-500 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <AlertDescription className="ml-2 text-yellow-700">
                        DNS propagation may take up to 24-48 hours to complete after updating nameservers.
                      </AlertDescription>
                    </Alert>
                    <DialogFooter>
                      <Button onClick={() => handleOpenChange(false)}>
                        Close
                      </Button>
                    </DialogFooter>
                  </>
                )}
                  </DialogContent>
                </Dialog>
          </div>
        </div>


        {usingMockData && (
          <div className="bg-yellow-50 p-4 mb-6 rounded-md border border-yellow-200">
            <p className="text-yellow-800">
              Currently showing sample data. 
              <Button variant="link" className="p-0 h-auto ml-2" onClick={() => loadDomains({ useMockData: false })}>
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
              onChange={handleSearchChange}
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

        {isLoading ? (
          <div className="flex justify-center items-center h-64 bg-background/40 rounded-lg border shadow-sm">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-lg text-muted-foreground">Loading domains...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center h-64 bg-background/40 rounded-lg border shadow-sm">
            <div className="text-center">
              <p className="text-lg text-red-600 mb-2">Failed to load domains</p>
              <p className="text-sm text-muted-foreground mb-4">There was an error fetching the domain data</p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => loadDomains({ useMockData: false})}
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => {
                    console.log("Loading sample data");
                    setDomains([...mockDomains]);
                    setResultInfo({...mockResultInfo});
                    setTotalPages(mockResultInfo.total_pages);
                    setUsingMockData(true);
                    setIsError(false);
                    toast.info("Using sample data for demonstration");
                  }}
                >
                  Use Sample Data
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md border shadow-sm overflow-hidden bg-background mb-6">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[14%]">Domain Name</TableHead>
                    <TableHead className="w-[14%]">Redirect</TableHead>
                    <TableHead className="w-[7%]">Created On</TableHead>
                    <TableHead className="w-[9%]">Storage</TableHead>
                    <TableHead className="w-[7%]">Last Synced</TableHead>
                    <TableHead className="w-[7%]">Status</TableHead>
                    <TableHead className="w-[20%]">Assigned User</TableHead>
                    <TableHead className="w-[15%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!domains || domains.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        {statusFilter !== "all" ? (
                          <div>
                            <p className="mb-2">No domains found with status: <strong>{statusFilter}</strong></p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setStatusFilter("all");
                                toast.info("Showing all domains");
                              }}
                            >
                              Show All Domains
                            </Button>
                          </div>
                        ) : (
                          searchQuery.trim() ? (
                            <p>No domains found matching search: <strong>{searchQuery}</strong></p>
                          ) : (
                            !isAdmin && resultInfo?.total_count === 0 ? (
                              <div className="text-center">
                                <p className="mb-4">Try adding some domains!</p>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => setIsDialogOpen(true)}
                                >
                                  <PlusCircle className="h-4 w-4 mr-2" />
                                  Add Domain
                                </Button>
                              </div>
                            ) : (
                              <p>No domains found matching your criteria</p>
                            )
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    domains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell className="font-medium">{domain.name}</TableCell>
                        <TableCell>
                          {domain.redirect_url ? (
                            <a
                              href={domain.redirect_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm max-w-[200px] truncate group"
                              title={domain.redirect_url}
                            >
                              <span className="truncate">
                                {domain.redirect_url.replace(/^https?:\/\/(www\.)?/, '')}
                              </span>
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : domain.last_synced ? (
                            <span className="text-gray-500 text-sm">No redirect</span>
                          ) : (
                            <span className="text-gray-500 text-sm">Loading...</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(domain.created_on)}</TableCell>
                        <TableCell>
                          <CSVUpload
                            domainId={domain.id}
                            domainName={domain.name}
                            hasFiles={domain.has_files || false}
                            userId={domain.user_id ?? undefined}
                          />
                        </TableCell>
                        <TableCell>
                          {isSyncing ? (
                            <span className="text-gray-500 text-sm flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Syncing...
                            </span>
                          ) : domain.last_synced ? (
                            <span title={formatDate(domain.last_synced, true)}>
                              {formatDate(domain.last_synced)}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">Not synced</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={getStatusStyle(domain.status, domain.paused)}>
                            {getDomainStatusText(domain.status, domain.paused)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {assignedUsers[domain.id] ? (
                            <span className="text-blue-600 text-sm font-medium">
                              {assignedUsers[domain.id]}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsLoading(true);
                                viewDnsRecords(domain.id, domain.name)
                                  .finally(() => setIsLoading(false));
                              }}
                            >
                              DNS Records
                            </Button>
                            {isAdmin && !assignedUsers[domain.id] && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-24 justify-center text-center"
                                onClick={() => {
                                  setSelectedDomainForAssignment(domain);
                                  setIsAssignDialogOpen(true);
                                }}
                              >
                                Assign
                              </Button>
                            )}
                            {isAdmin && assignedUsers[domain.id] && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-24 justify-center text-center border-red-300 text-red-700 hover:bg-red-50"
                                onClick={async () => {
                                  try {
                                    const currentAssignedUser = assignedUsers[domain.id];
                                    if (!currentAssignedUser) {
                                      throw new Error('No user assigned to this domain');
                                    }
                                    const { error } = await supabase
                                      .from('domain_assignments')
                                      .delete()
                                      .eq('domain_id', domain.id)
                                      .eq('user_email', currentAssignedUser);

                                    if (error) throw error;

                                    toast.info(`${domain.name} unassigned from ${currentAssignedUser}`);

                                    setAssignedUsers(prev => {
                                      const newAssignments = { ...prev };
                                      delete newAssignments[domain.id];
                                      return newAssignments;
                                    });

                                    await loadDomains({ useMockData: false });
                                  } catch (error) {
                                    console.error('Error unassigning domain:', error);
                                    toast.error('Failed to unassign domain');
                                  }
                                }}
                              >
                                Unassign
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDomainForDeletion(domain);
                                setIsDeleteDialogOpen(true);
                                setDeletionConfirmation('');
                              }}
                              className="hover:bg-red-100 hover:text-red-800 border-red-200 text-red-700"
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination controls */}
            {/* console.log('Rendering pagination:', {
              filteredLength: filteredDomains.length,
              totalCount: resultInfo?.total_count,
              totalPages: totalPages, // Use the state variable
              currentPage
            }) */}
            <div className="flex justify-between items-center pt-4">
              <div className="text-sm text-muted-foreground">
                {`Showing ${domains.length} of ${resultInfo?.total_count || 0} domains`}
              </div>
              {(resultInfo?.total_pages || 0) > 1 && (
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
                      Page {currentPage} of {resultInfo?.total_pages || 1}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === (resultInfo?.total_pages || 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
              </div>
            
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
              {/* Loading state */}
              {isLoadingUsers && (
                <div className="text-center py-6">
                  <span className="loading loading-spinner"></span>
                  <span className="ml-2">Loading users...</span>
                </div>
              )}

              {/* No users loaded */}
              {!isLoadingUsers && users.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  No users available
                </div>
              )}

              {/* Filter and display users */}
              {!isLoadingUsers && users.length > 0 && (
                <>
                  {users
                    .filter(user =>
                      userSearchQuery === "" ||
                      user.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                    )
                    .map(user => (
                      <Button
                        key={user.id}
                        variant="outline"
                        className="justify-start text-left py-6 h-auto"
                        onClick={async () => {
                          if (selectedDomainForAssignment) {
                            try {
                              const { error } = await supabase
                                .from('domain_assignments')
                                .insert({
                                  domain_id: selectedDomainForAssignment.id,
                                  user_email: user.email,
                                  created_by: user?.email || null
                                });
                              if (error) throw error;
                              toast.success(`${selectedDomainForAssignment.name} assigned to ${user.name || user.email}`);
                              setIsAssignDialogOpen(false);
                              await loadDomains({ useMockData: false });
                              await loadAssignedUsers();
                            } catch (error) {
                              console.error('Error assigning domain:', error);
                              toast.error('Failed to assign domain');
                            }
                          }
                        }}
                      >
                        <div className="flex items-center gap-5">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-medium">
                            {(user.name || user.email).charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-lg">{user.name || user.email.split('@')[0]}</span>
                            <span className="text-sm text-muted-foreground pt-1">{user.email}</span>
                          </div>
                        </div>
                      </Button>
                    ))}

                  {/* No results after filtering */}
                  {users.filter(user =>
                    userSearchQuery !== "" &&
                    !user.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) &&
                    !user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  ).length === users.length && (
                    <div className="text-center py-6 text-muted-foreground">
                      No users found matching "{userSearchQuery}"
                    </div>
                  )}
                </>
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
            {selectedDomainForAssignment && assignedUsers[selectedDomainForAssignment.id] && (
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    const currentAssignedUser = assignedUsers[selectedDomainForAssignment.id];
                    if (!currentAssignedUser) {
                      throw new Error('No user assigned to this domain');
                    }
                    // Delete assignment from domain_assignments table
                    const { error } = await supabase
                      .from('domain_assignments')
                      .delete()
                      .eq('domain_id', selectedDomainForAssignment.id)
                      .eq('user_email', currentAssignedUser);

                    if (error) throw error;

                    toast.info(`${selectedDomainForAssignment.name} unassigned from ${currentAssignedUser}`);

                    // Update local state
                    setAssignedUsers(prev => {
                      const newAssignments = { ...prev };
                      delete newAssignments[selectedDomainForAssignment.id];
                      return newAssignments;
                    });

                    // Reload domains to reflect changes
                    await loadDomains({ useMockData: false }); // Reload current page
                  } catch (error) {
                    console.error('Error unassigning domain:', error);
                    toast.error('Failed to unassign domain');
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

      {/* Domain deletion confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle>Delete Domain</DialogTitle>
            <DialogDescription className="mt-2">
              {selectedDomainForDeletion && (
                <>
                  <span className="block mb-4">
                    This will <strong>permanently delete</strong> the domain <strong>{selectedDomainForDeletion.name}</strong> from Cloudflare and remove all of its assignments.
                  </span>
                  <span className="block text-red-600 font-medium">
                    This action cannot be undone.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            handleDeleteDomain();
          }}>
            <div className="space-y-6">
              <div>
                <Label htmlFor="domain-confirmation" className="text-sm font-medium">
                  To confirm, type the domain name exactly:
                </Label>
                <Input
                  id="domain-confirmation"
                  value={deletionConfirmation}
                  onChange={(e) => setDeletionConfirmation(e.target.value)}
                  placeholder={selectedDomainForDeletion?.name}
                  className="mt-2"
                />
              </div>
            </div>

            <DialogFooter className="mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setSelectedDomainForDeletion(null);
                  setDeletionConfirmation('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isDeleting || !selectedDomainForDeletion || deletionConfirmation !== selectedDomainForDeletion.name}
              >
                {isDeleting ? "Deleting..." : "Delete Domain"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}