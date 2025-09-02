"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { CSVUpload } from "@/components/domains/csv-upload";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { PlusCircle, ExternalLink, Loader2, AlertTriangle, Edit3, Link as LinkIcon, UploadCloud, Rocket, Download } from "lucide-react";
import { createClient, supabaseAdmin } from "@/lib/supabase-client";
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
import { createDnsRecord } from "../../lib/cloudflare-api";
// Add this new line to import the Tabs components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";


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
  has_files?: boolean;
  user_id?: string | null;
  cloudflare_id?: string | null;
  deployment_status?: string | null;
  inboxing_job_id?: number | null;
  inboxing_job_status?: string | null;
}

interface JobDetails {
  id: number;
  status: string;
  result_data?: any;
  created_at: string;
  updated_at: string;
}

// Result info interface from Cloudflare
interface ResultInfo {
  page: number;
  per_page: number;
  total_pages: number;
  count: number;
  total_count: number;
}

interface CloudflareDnsRecordMinimal {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}
interface CloudflareRuleActionParametersUri {
  path?: { value?: string; expression?: string };
  query?: { value?: string; expression?: string };
  // Add other potential properties like 'origin' if needed for redirects
}

interface CloudflareRuleActionParameters {
  uri?: CloudflareRuleActionParametersUri;
  status_code?: number; // For redirects
  // Add other action-specific parameters if necessary
}

interface CloudflareRule {
  id: string; // Rule ID
  action: string; // e.g., "redirect", "rewrite", "set_config", etc.
  expression: string; // The expression that triggers the rule
  description?: string; // User-friendly description of the rule
  enabled: boolean; // Whether the rule is active
  action_parameters?: CloudflareRuleActionParameters;
  version?: string; // Individual rule version, if applicable
  // Potentially other fields like 'ref' for logging
}

interface CloudflareRuleset {
  id: string; // Ruleset ID
  name: string;
  description: string;
  kind: string; // e.g., "zone"
  version: string; // Current version of the ruleset (CRITICAL for updates)
  rules: CloudflareRule[]; // Array of rules in this ruleset
  phase: string; // e.g., "http_request_dynamic_redirect"
  last_updated: string; // ISO 8601 timestamp
  // Potentially other fields
}

// For the API response when fetching ruleset from your backend
interface FetchRulesetApiResponse {
  success: boolean;
  ruleset?: CloudflareRuleset;
  error?: string;
  message?: string;
}

// For the API response when disabling a rule via your backend
interface UpdateRulesetApiResponse {
  success: boolean;
  ruleset?: CloudflareRuleset; // The updated ruleset
  error?: string;
  message?: string;
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
  // --- State for Edit Redirect Dialog ---
  const [isEditRedirectDialogOpen, setIsEditRedirectDialogOpen] = useState(false);
  const [selectedDomainForEditRedirect, setSelectedDomainForEditRedirect] = useState<CloudflareDomain | null>(null);
  const [currentRedirectUrlForDialog, setCurrentRedirectUrlForDialog] = useState<string>("");
  const [newRedirectUrl, setNewRedirectUrl] = useState<string>("");
  const [isUpdatingRedirect, setIsUpdatingRedirect] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // ---
  const assignedUsersRef = useRef(assignedUsers); // Add this ref
  const [searchInput, setSearchInput] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [selectedDomainForDeploy, setSelectedDomainForDeploy] = useState<CloudflareDomain | null>(null);
  const [deployMode, setDeployMode] = useState<'multiple_names' | 'csv_upload'>('csv_upload');
  const [namePairs, setNamePairs] = useState([{ first_name: '', last_name: '' }]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [passwordBaseWord, setPasswordBaseWord] = useState<string>("");
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedJobDetails, setSelectedJobDetails] = useState<JobDetails | null>(null);
  // Update the ref whenever assignedUsers state changes
  useEffect(() => {
    assignedUsersRef.current = assignedUsers;
  }, [assignedUsers]);

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
  useEffect(() => {
    // Fetch the list of users for the filter dropdown when the component mounts for an admin
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

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
        } else if (isAdmin && selectedUserId) {
          // NEW: Admin is filtering by a specific user
          const { data: assignments, error: assignmentError } = await supabase
            .from('domain_assignments')
            .select('domain_id')
            .eq('user_email', selectedUserId) // Filter assignments by the selected user's email
            .abortSignal(signal ?? new AbortController().signal);

          if (assignmentError) {
            console.error(`Error fetching domain assignments for ${selectedUserId}:`, assignmentError);
            setDomains([]);
            setTotalPages(1);
            return;
          }

          if (!assignments || assignments.length === 0) {
            // No domains assigned to this user, show empty list
            setDomains([]);
            setResultInfo({ page: 1, per_page: 25, total_pages: 1, count: 0, total_count: 0 });
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
        // if (statusFilter !== "all") {
        //   if (statusFilter === "paused") {
        //     baseQuery = baseQuery.eq('paused', true);
        //   } else {
        //     baseQuery = baseQuery.eq('paused', false).eq('status', statusFilter);
        //   }
        // }
        // Apply status filter
        if (statusFilter === "all") {
          // When "all" is selected (which is the default initial state),
          // filter for domains that are either 'active' OR 'pending' AND are not paused.
          baseQuery = baseQuery.in('status', ['active', 'pending']).eq('paused', false);
        } else if (statusFilter === "paused") {
          // If "paused" is specifically selected, filter for domains where paused is true.
          baseQuery = baseQuery.eq('paused', true);
        } else {
          // For any other specific status filter (e.g., "active", "pending", "inactive", etc.),
          // filter by that status AND ensure the domain is not paused.
          // This correctly handles cases where the user explicitly selects "active" or "pending".
          baseQuery = baseQuery.eq('status', statusFilter).eq('paused', false);
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
    [supabase, isAdmin, user?.email, searchQuery, statusFilter, currentPage, selectedUserId]
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
  }, [isAdmin, user?.email, searchQuery, statusFilter, currentPage, loadDomains]);
  // Make sure currentPage is a dependency
  useEffect(() => {
    const domainsToPoll = domains.filter(d =>
      d.inboxing_job_id &&
      ['Deploying', 'PENDING', 'PROCESSING'].includes(d.deployment_status || '')
    );

    if (domainsToPoll.length === 0) {
      return; // No domains to poll, do nothing
    }

    const intervalId = setInterval(() => {
      console.log(`Polling status for ${domainsToPoll.length} domains...`);
      // We create a fresh copy of the domains from state to avoid closure issues
      setDomains(currentDomains => {
        const newDomains = [...currentDomains];

        domainsToPoll.forEach(async (domainToPoll) => {
          try {
            const res = await fetch(`/api/inboxing/status/${domainToPoll.inboxing_job_id}`);
            if (res.ok) {
              const data = await res.json();
              const newStatus = data.data.status;

              // Find the index of the domain to update
              const indexToUpdate = newDomains.findIndex(d => d.id === domainToPoll.id);
              if (indexToUpdate !== -1) {
                newDomains[indexToUpdate].deployment_status = newStatus;
                newDomains[indexToUpdate].inboxing_job_status = newStatus;
              }
            }
          } catch (e) {
            console.error("Polling failed for domain:", domainToPoll.name, e);
          }
        });

        return newDomains;
      });
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [domains]);

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
  const BATCH_SIZE_ASSIGNMENTS = 1000; // Standard Supabase limit, adjust if needed

  const loadAssignedUsers = useCallback(async (signal?: AbortSignal) => {
    // Create a controller that will be used if no signal is provided
    const controller = signal ? undefined : new AbortController();
    const abortSignal = signal || controller?.signal;

    try {
      let allAssignments: DomainAssignment[] = [];
      let offset = 0;
      let hasMore = true;

      console.log('[loadAssignedUsers] Starting to fetch all domain assignments...');

      while (hasMore) {
        // Check if the operation was aborted before making the request
        if (abortSignal?.aborted) {
          throw new Error('AbortError');
        }

        const { data: batch, error: batchError } = await supabase
          .from('domain_assignments')
          .select('domain_id, user_email')
          .range(offset, offset + BATCH_SIZE_ASSIGNMENTS - 1)
          .abortSignal(abortSignal as AbortSignal);

        if (batchError) {
          console.error(`[loadAssignedUsers] Error fetching batch of assignments (offset: ${offset}):`, batchError);
          throw batchError;
        }

        if (batch && batch.length > 0) {
          console.log(`[loadAssignedUsers] Fetched batch of ${batch.length} assignments (offset: ${offset}).`);
          allAssignments = allAssignments.concat(batch as DomainAssignment[]);
          offset += batch.length;
          if (batch.length < BATCH_SIZE_ASSIGNMENTS) {
            hasMore = false; // Last batch fetched
          }
        } else {
          hasMore = false; // No data in batch or empty batch, stop.
        }
      }

      console.log(`[loadAssignedUsers] Total assignments fetched: ${allAssignments.length}`);

      const assignmentMap: Record<string, string> = {};
      if (allAssignments.length > 0) {
        allAssignments.forEach(assignment => {
          if (isAdmin) {
            assignmentMap[assignment.domain_id] = assignment.user_email;
          } else if (user?.email && assignment.user_email === user.email) {
            // For non-admins, only map assignments relevant to them
            assignmentMap[assignment.domain_id] = assignment.user_email;
          }
        });
      }
      setAssignedUsers(assignmentMap);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[loadAssignedUsers] Fetch aborted.');
      } else {
        console.error('[loadAssignedUsers] Error loading assigned users:', error);
        // toast.error('Failed to load user assignments for domains.');
      }
    }
  }, [isAdmin, user?.email, supabase]); // Added supabase to dependency array

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      // This initial load is now primarily triggered by changes in its dependencies
      // (isAdmin, user?.email, loadAssignedUsers function itself, supabase, loadDomains)
      await loadAssignedUsers(controller.signal);
    };

    load(); // Call the initial load

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
          // This call is fine, it's in response to an external event.
          // It will update assignedUsers state, which in turn updates assignedUsersRef.
          await loadAssignedUsers(controller.signal);
        }
      })
      // Subscribe to domains changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'domains',
      }, async (payload) => {
        const domain = payload.new as CloudflareDomain;
        // Use assignedUsersRef.current here to get the latest assignments
        // without making assignedUsers state a direct dependency that causes the loop.
        const currentAssignedUsers = assignedUsersRef.current;
        if (isAdmin ||
          (user?.email &&
            ((domain?.created_by === user.email ||
              (currentAssignedUsers && domain?.id && currentAssignedUsers[domain.id] === user.email))))) {
          console.log('[Realtime] Domain change detected, reloading domain data');
          if (!isLoading) { // isLoading state is still a valid dependency if its change should re-setup subscriptions or its logic
            await loadDomains({ useMockData: false, signal: controller.signal });
          }
        }
      })
      .subscribe();

    return () => {
      controller.abort();
      // It's good practice to explicitly remove the channel on cleanup
      supabase.removeChannel(channel);
    };
    // Remove 'assignedUsers' from this dependency array to break the loop.
    // Keep 'isLoading' if its changes genuinely need to re-trigger subscription setup
    // or if callbacks rely on its fresh closure.
  }, [isAdmin, user?.email, loadAssignedUsers, isLoading,]);// Add dependencies

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
    const userInput = e.target.value;
    const trimmedUserInput = userInput.trim();
    let newRedirectValue = userInput; // Default to what user typed

    if (trimmedUserInput && !trimmedUserInput.startsWith('http://') && !trimmedUserInput.startsWith('https://')) {
      // If there's content and no protocol, prepend https to the trimmed content
      newRedirectValue = 'https://' + trimmedUserInput;
    }
    // Else, if there is a protocol, or if the input is empty/whitespace,
    // newRedirectValue remains userInput, preserving original spacing for display if desired.

    // For validation, always use a trimmed version of the URL that's effectively in newRedirectValue.
    const valueForValidation = newRedirectValue.trim();
    const validationResult = isValidRedirectUrl(valueForValidation);

    setNewDomain(prev => ({
      ...prev,
      redirect: newRedirectValue, // This is what the input field will display
      isRedirectValid: validationResult.isValid,
    }));
  };
  const handleEditDialogRedirectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const userInput = e.target.value;
    const trimmedUserInput = userInput.trim();
    let newRedirectValueForState = userInput; // Default to what user typed

    if (trimmedUserInput && !trimmedUserInput.startsWith('http://') && !trimmedUserInput.startsWith('https://')) {
      // If there's content and no protocol, prepend https to the trimmed content
      newRedirectValueForState = 'https://' + trimmedUserInput;
    }
    // Else, (protocol exists or input is empty/whitespace) newRedirectValueForState remains userInput.

    setNewRedirectUrl(newRedirectValueForState);
  };
  // Function to strip http://, https://, and www.
  const stripUrlPrefixes = (url: string) => {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '');
  };

  // Helper function to validate a full redirect URL
  const isValidRedirectUrl = (url: string): { isValid: boolean; error?: string } => {
    if (!url) {
      // This error applies if the redirect URL field cannot be empty.
      // If empty is allowed (e.g., to remove a redirect), this check might need adjustment based on context.
      return { isValid: false, error: 'Redirect URL cannot be empty.' };
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { isValid: false, error: 'Redirect URL must start with http:// or https://.' };
    }
    try {
      const parsedUrl = new URL(url); // This checks if the URL string is well-formed

      // Your existing 'validateDomain' function (I'm assuming it's defined elsewhere in your code)
      // can be used to check if the domain part of the URL is valid.
      const domainValidation = validateDomain(parsedUrl.hostname);
      if (!domainValidation.isValid) {
        return { isValid: false, error: `The domain part of the redirect URL is invalid: ${domainValidation.error || 'Invalid domain structure'}` };
      }

      if (url.includes(' ')) { // URLs generally should not contain unencoded spaces
        return { isValid: false, error: 'Redirect URL cannot contain spaces. Use %20 if needed.' };
      }
      return { isValid: true }; // If all checks pass
    } catch (_) {
      // This catches errors if 'new URL(url)' fails, meaning the URL string is badly malformed.
      return { isValid: false, error: 'Invalid redirect URL format. Please enter a complete URL (e.g., https://example.com/path).' };
    }
  };
  // Function to validate domain
  const validateDomain = (domain: string): { isValid: boolean; error?: string } => {
    // Check for dashes in domain part (before first dot)
    // const domainPart = domain.split('.')[0];
    // if (domainPart.includes('-')) {
    //   return {
    //     isValid: false,
    //     error: "We do not support dashed domains yet"
    //   };
    // }

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

    setIsDeleting(true); // Show loading state

    try {
      console.log(`[handleDeleteDomain] Calling API to delete domain ID ${selectedDomainForDeletion.id}`);

      // --- Call Server-Side API for ALL Deletion Logic ---
      const apiResponse = await fetch(`/api/domains/${selectedDomainForDeletion.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // Authorization header might be needed if your API expects it beyond cookies
          // 'Authorization': `Bearer ${session?.access_token}` // Example if using JWT
        },
      });

      const apiResult = await apiResponse.json();

      if (!apiResponse.ok) {
        // API returned an error (e.g., 4xx, 5xx)
        console.error(`[handleDeleteDomain] API deletion failed for ${selectedDomainForDeletion.id}:`, apiResult.error);
        throw new Error(apiResult.error || `Deletion request failed with status ${apiResponse.status}`);
      }

      // --- Success Handling ---
      console.log(`[handleDeleteDomain] Successfully initiated deletion for domain ID ${selectedDomainForDeletion.id} via API.`);
      toast.success(apiResult.message || `Domain ${selectedDomainForDeletion.name} deleted successfully.`);

      // Reload data after successful deletion
      await loadDomains({ useMockData: false }); // Reload domain list
      await loadAssignedUsers(); // Reload assignments (API should have deleted them)

      // Close the dialog and reset state
      setIsDeleteDialogOpen(false);
      setSelectedDomainForDeletion(null);
      setDeletionConfirmation('');

    } catch (error) {
      // Catch errors from the API call or unexpected issues
      console.error('Error during the deletion process:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during deletion';
      toast.error(`Failed to delete domain: ${errorMessage}`, {
        description: 'Please check the console or server logs for more details.'
      });
    } finally {
      setIsDeleting(false); // Hide loading state
    }
  };
  // End of handleDeleteDomain

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
    setSearchQuery(""); // Clear the active search query
    setSearchInput(""); // Clear the displayed value in the input box
    setCurrentPage(1); // Reset to first page
    setSelectedUserId(null);
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
      const enteredRedirectUrl = newDomain.redirect.trim();
      // const cleanRedirect = newDomain.redirect ? stripUrlPrefixes(newDomain.redirect) : '';

      // Both fields are required
      if (!cleanDomain || !enteredRedirectUrl) {
        toast.error("Both domain and redirect are required");
        setIsSubmitting(false);
        return;
      }

      // Validate domain
      const domainValidation = validateDomain(cleanDomain);
      if (!domainValidation.isValid) {
        toast.error(domainValidation.error || "Invalid domain name");
        setIsSubmitting(false);
        return;
      }

      // Validate redirect
      // if (!cleanRedirect.match(/^[a-z0-9][a-z0-9-]*[a-z0-9](\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) {
      //   toast.error("Please enter a valid redirect domain");
      //   return;
      // }
      const redirectValidationResultOnSubmit = isValidRedirectUrl(enteredRedirectUrl);
      if (!redirectValidationResultOnSubmit.isValid) {
        toast.error(redirectValidationResultOnSubmit.error || "Invalid redirect URL.");
        setIsSubmitting(false); // Make sure to reset loading state
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
          redirect_url: enteredRedirectUrl,
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
        const cloudflareZoneId = result.domain.id;
        const cloudflareDomainName = result.domain.name;
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
            redirect_url: enteredRedirectUrl,
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
        // **NEW: Add DNS Records**
        try {
          toast.info(`Adding DNS records for ${cloudflareDomainName}...`);
          // Record 1: Root domain (e.g., revihq.com)
          const dnsRecord1 = {
            type: "A",
            name: cloudflareDomainName, // Use the actual domain name
            content: "192.0.2.1",
            proxied: true,
            ttl: 1, // 1 for Automatic
          };
          const record1Result = await createDnsRecord(cloudflareZoneId, dnsRecord1);
          if (record1Result) { // createDnsRecord should return the created record or null/throw error
            toast.success(`A record for ${cloudflareDomainName} added.`);
          } else {
            toast.error(`Failed to add A record for ${cloudflareDomainName}.`);
          }

          // Record 2: www subdomain (e.g., www.revihq.com)
          const dnsRecord2 = {
            type: "A",
            name: `www.${cloudflareDomainName}`, // Add www prefix
            content: "192.0.2.2",
            proxied: true,
            ttl: 1, // 1 for Automatic
          };
          const record2Result = await createDnsRecord(cloudflareZoneId, dnsRecord2);
          if (record2Result) {
            toast.success(`A record for www.${cloudflareDomainName} added.`);
          } else {
            toast.error(`Failed to add A record for www.${cloudflareDomainName}.`);
          }
          const dmarcRecord = {
            type: "TXT",
            name: `_dmarc.${cloudflareDomainName}`,
            content: `v=DMARC1; p=none; rua=mailto:dmarc@${cloudflareDomainName}`,
            ttl: 1, // 1 for Automatic
          };
          const dmarcRecordResult = await createDnsRecord(cloudflareZoneId, dmarcRecord);
          if (dmarcRecordResult) {
            toast.success(`DMARC record for ${cloudflareDomainName} added.`);
          } else {
            toast.error(`Failed to add DMARC record for ${cloudflareDomainName}.`);
          }
        } catch (dnsError) {
          console.error('Error adding DNS records:', dnsError);
          toast.error(`Failed to add DNS records for ${cloudflareDomainName}: ${dnsError instanceof Error ? dnsError.message : 'Unknown DNS error'}`);
        }
        // **END NEW DNS Record Addition**

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
  // const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   if (searchTimeout.current) clearTimeout(searchTimeout.current);
  //   searchTimeout.current = setTimeout(() => {
  //     setSearchQuery(value);
  //   }, 400); // 400ms debounce
  // };
  // --- Edit Redirect Dialog Handlers ---
  const handleOpenEditRedirectDialog = async (domain: CloudflareDomain) => { // Make it async
    setSelectedDomainForEditRedirect(domain);
    setCurrentRedirectUrlForDialog(domain.redirect_url || "");
    setNewRedirectUrl(domain.redirect_url || ""); // Pre-fill with current or empty
    setIsEditRedirectDialogOpen(true); // Open the dialog immediately

    // Check and potentially disable existing dynamic redirect rule *before* user edits
    if (domain.cloudflare_id) {
      try {
        const disableResult = await checkAndDisableExistingDynamicRedirect(domain.cloudflare_id);

        if (disableResult.error) {
          // Error toast is already shown by checkAndDisableExistingDynamicRedirect
          console.warn(`[EditRedirect] Problem checking/disabling dynamic redirect: ${disableResult.error}`);
        } else if (disableResult.disabled) {
          console.log(`[EditRedirect] Dynamic redirect rule ${disableResult.ruleId} was disabled for domain: ${domain.name}`);
          // Optionally, you might want to refresh the domain data or redirect_url state here
          // if the disabled rule was the source of the current redirect_url.
          // For now, we assume the user will set a new redirect or remove it via the dialog.
        } else {
          console.log(`[EditRedirect] Dynamic redirect check completed: ${disableResult.message}`);
        }
      } catch (e) {
        console.error("[EditRedirect] Unexpected error calling checkAndDisableExistingDynamicRedirect:", e);
        toast.error("An unexpected error occurred while preparing the redirect editor.");
      }
    } else {
      toast.error("Cannot check for dynamic redirects: Cloudflare Zone ID is missing for this domain.", { duration: 7000 });
    }
  };

  const handleCloseEditRedirectDialog = () => {
    setIsEditRedirectDialogOpen(false);
    setSelectedDomainForEditRedirect(null);
    setCurrentRedirectUrlForDialog("");
    setNewRedirectUrl("");
    setIsUpdatingRedirect(false);
  };

  const handleUpdateRedirect = async () => {
    if (!selectedDomainForEditRedirect || !selectedDomainForEditRedirect.id) {
      toast.error("No domain selected or domain ID is missing.");
      return;
    }
    console.log(selectedDomainForEditRedirect);
    const targetRedirectUrl = newRedirectUrl.trim();
    const zoneId = selectedDomainForEditRedirect.cloudflare_id; // This is the Cloudflare Zone ID
    const domainName = selectedDomainForEditRedirect.name;

    // Basic validation for the new redirect URL (similar to add domain)
    // if (targetRedirectUrl && !targetRedirectUrl.startsWith('http://') && !targetRedirectUrl.startsWith('https://')) {
    //   toast.error("New redirect URL must start with http:// or https://");
    //   return;
    // }
    // if (targetRedirectUrl && stripUrlPrefixes(targetRedirectUrl).length > 0) {
    //   const validation = validateDomain(stripUrlPrefixes(targetRedirectUrl));
    //   if (!validation.isValid) {
    //     toast.error(validation.error || "Invalid new redirect URL format.");
    //     return;
    //   }
    // }
    if (targetRedirectUrl) { // Only validate if a URL is provided
      const redirectValidationResult = isValidRedirectUrl(targetRedirectUrl);
      if (!redirectValidationResult.isValid) {
        toast.error(redirectValidationResult.error || "Invalid new redirect URL format.");
        setIsUpdatingRedirect(false); // This will be handled by the finally block
        return; // Stop if validation fails
      }
    }

    setIsUpdatingRedirect(true);
    toast.info(`Updating redirect for ${selectedDomainForEditRedirect.name}...`);

    try {
      const response = await fetch(`/api/cloudflare/domains/${selectedDomainForEditRedirect.id}/redirect`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRedirectUrl: targetRedirectUrl || null }), // Send null to remove redirect
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to update redirect (Status: ${response.status})`);
      }

      toast.success(result.message || `Redirect for ${selectedDomainForEditRedirect.name} updated successfully.`);
      if (targetRedirectUrl) {
        toast.info(`Ensuring A records are in place for ${domainName}...`);
        let existingDnsRecords: CloudflareDnsRecordMinimal[] = [];

        // Fetch existing DNS records
        try {
          const dnsResponse = await fetch(`/api/cloudflare/dns-records?zone_id=${zoneId}&per_page=200`); // Fetch a good number of records
          const dnsData = await dnsResponse.json();
          if (dnsResponse.ok && dnsData.success) {
            existingDnsRecords = dnsData.dnsRecords;
          } else {
            console.warn("Could not fetch existing DNS records:", dnsData.error);
            // toast.warn(`Could not verify existing DNS records for ${domainName}. Proceeding to create if necessary.`);
          }
        } catch (fetchDnsError: any) {
          console.warn("Error fetching existing DNS records:", fetchDnsError);
          // toast.warn(`Error fetching DNS records for ${domainName}: ${fetchDnsError.message}. Proceeding to create if necessary.`);
        }

        // A Record 1: Root domain (e.g., revihq.com -> 192.0.2.1)
        const rootRecordContent = "192.0.2.1";
        const rootRecordExists = existingDnsRecords.some(
          (record) =>
            record.type === "A" &&
            record.name === domainName &&
            record.content === rootRecordContent
        );

        if (!rootRecordExists) {
          try {
            const record1Result = await createDnsRecord(zoneId ?? '', {
              type: "A",
              name: domainName,
              content: rootRecordContent,
              proxied: true,
              ttl: 1, // Automatic
            });
            if (record1Result) {
              toast.success(`A record for ${domainName} created.`);
            } else {
              toast.warning(`Failed to create A record for ${domainName}. Please check/add manually.`);
            }
          } catch (e: any) {
            console.error(`Error creating A record for ${domainName}:`, e);
            toast.warning(`Error creating A record for ${domainName}: ${e.message}. Please check/add manually.`);
          }
        } else {
          console.log(`A record for ${domainName} (to ${rootRecordContent}) already exists.`);
        }

        // A Record 2: www subdomain (e.g., www.revihq.com -> 192.0.2.2)
        const wwwRecordName = `www.${domainName}`;
        const wwwRecordContent = "192.0.2.2";
        const wwwRecordExists = existingDnsRecords.some(
          (record) =>
            record.type === "A" &&
            record.name === wwwRecordName &&
            record.content === wwwRecordContent
        );

        if (!wwwRecordExists) {
          try {
            const record2Result = await createDnsRecord(zoneId ?? '', {
              type: "A",
              name: wwwRecordName,
              content: wwwRecordContent,
              proxied: true,
              ttl: 1, // Automatic
            });
            if (record2Result) {
              toast.success(`A record for ${wwwRecordName} created.`);
            } else {
              toast.warning(`Failed to create A record for ${wwwRecordName}. Please check/add manually.`);
            }
          } catch (e: any) {
            console.error(`Error creating A record for ${wwwRecordName}:`, e);
            toast.warning(`Error creating A record for ${wwwRecordName}: ${e.message}. Please check/add manually.`);
          }
        } else {
          console.log(`A record for ${wwwRecordName} (to ${wwwRecordContent}) already exists.`);
        }
      } else {
        // Redirect was removed, A records are not touched.
        toast.info(`Redirect for ${domainName} was removed. A records were not modified automatically.`);
      }
      handleCloseEditRedirectDialog();
      await loadDomains({ useMockData: usingMockData }); // Refresh domain list
      await loadAssignedUsers(); // Refresh assignments as last_synced might change

    } catch (error) {
      console.error("Error updating redirect:", error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
      setIsUpdatingRedirect(false);
    }
  };
  // ---
  const checkAndDisableExistingDynamicRedirect = useCallback(
    async (zoneId: string): Promise<{ disabled: boolean; ruleId?: string; message?: string; error?: string }> => {
      if (!zoneId) {
        const msg = '[DynamicRedirectCheck] Zone ID is missing.';
        console.warn(msg);
        return { disabled: false, error: 'Zone ID is missing for check.' };
      }

      const checkingToastId = toast.loading(`Checking for existing dynamic redirect rule...`);

      try {
        // --- Step 1: Fetch existing ruleset for the http_request_dynamic_redirect phase ---
        const fetchResponse = await fetch(`/api/cloudflare/rulesets/dynamic-redirect?zoneId=${zoneId}`);
        const fetchData: FetchRulesetApiResponse = await fetchResponse.json();

        if (!fetchResponse.ok) {
          toast.dismiss(checkingToastId);
          throw new Error(fetchData.error || `Failed to fetch redirect rules (status: ${fetchResponse.status})`);
        }

        if (!fetchData.success || !fetchData.ruleset) {
          toast.dismiss(checkingToastId);
          const msg = fetchData.message || 'No dynamic redirect ruleset found or API error.';
          console.log('[DynamicRedirectCheck]', msg, fetchData);
          // toast.info(msg);
          return { disabled: false, message: msg };
        }

        const ruleset: CloudflareRuleset = fetchData.ruleset;
        const dynamicRedirectRules = ruleset.rules.filter(
          (rule) => rule.action === 'redirect' // Adjust if your dynamic redirects have a more specific identifier
        );

        if (dynamicRedirectRules.length === 0) {
          toast.dismiss(checkingToastId);
          toast.success('No existing dynamic redirect rule found to disable.');
          return { disabled: false, message: 'No dynamic redirect rule found.' };
        }

        if (dynamicRedirectRules.length > 1) {
          toast.dismiss(checkingToastId);
          const message = `Multiple (${dynamicRedirectRules.length}) dynamic redirect rules found. Automatic disabling is not supported. Please review manually in Cloudflare.`;
          toast.error(message, { duration: 10000 });
          console.warn('[DynamicRedirectCheck]', message, dynamicRedirectRules);
          return { disabled: false, message };
        }

        const ruleToUpdate = dynamicRedirectRules[0];

        if (!ruleToUpdate.enabled) {
          toast.dismiss(checkingToastId);
          toast.success(`The existing dynamic redirect rule ('${ruleToUpdate.description || ruleToUpdate.id}') is already disabled.`);
          return { disabled: false, ruleId: ruleToUpdate.id, message: 'Rule already disabled.' };
        }

        // --- Step 2: Request to disable the rule ---
        toast.loading(`Found active rule ('${ruleToUpdate.description || ruleToUpdate.id}'). Attempting to disable...`, { id: checkingToastId });

        // Create the payload for updating the ruleset: disable the specific rule
        const updatedRules = ruleset.rules.map(rule =>
          rule.id === ruleToUpdate.id ? { ...rule, enabled: false } : rule
        );

        // The payload for the PUT request to your backend
        // The backend will then send this to Cloudflare
        const rulesetUpdatePayload = { ...ruleset, rules: updatedRules }; // Includes the crucial 'version' from the fetched ruleset

        const disableResponse = await fetch(`/api/cloudflare/rulesets/dynamic-redirect`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zoneId: zoneId,
            ruleset: rulesetUpdatePayload, // Send the entire modified ruleset object
          }),
        });

        const disableData: UpdateRulesetApiResponse = await disableResponse.json();
        toast.dismiss(checkingToastId);

        if (!disableResponse.ok || !disableData.success) {
          throw new Error(disableData.error || `Failed to disable redirect rule (status: ${disableResponse.status})`);
        }

        toast.success(`Successfully disabled dynamic redirect rule ('${ruleToUpdate.description || ruleToUpdate.id}').`);
        return { disabled: true, ruleId: ruleToUpdate.id, message: 'Dynamic redirect rule disabled.' };

      } catch (error: any) {
        toast.dismiss(checkingToastId);
        console.error('[DynamicRedirectCheck] Error:', error);
        const errorMessage = error.message || 'An unknown error occurred while managing dynamic redirect rule.';
        toast.error(errorMessage, { duration: 10000 });
        return { disabled: false, error: errorMessage };
      }
    }, [] // Dependencies: add any external state/props used, e.g., `supabase` if it were used here.
  );

  const handleOpenDeployDialog = (domain: CloudflareDomain) => {
    setSelectedDomainForDeploy(domain);
    setIsDeployDialogOpen(true);
    // Reset form state when opening
    setNamePairs([{ first_name: '', last_name: '' }]);
    setCsvFile(null);
    setDeployMode('csv_upload');
    setPasswordBaseWord("");
  };

  const handleNamePairChange = (index: number, field: 'first_name' | 'last_name', value: string) => {
    const updatedPairs = [...namePairs];
    updatedPairs[index][field] = value;
    setNamePairs(updatedPairs);
  };

  const addNamePair = () => {
    if (namePairs.length < 5) {
      setNamePairs([...namePairs, { first_name: '', last_name: '' }]);
    }
  };

  const removeNamePair = (index: number) => {
    if (namePairs.length > 1) {
      const updatedPairs = namePairs.filter((_, i) => i !== index);
      setNamePairs(updatedPairs);
    }
  };

  // Find your existing handleFileChange function and update it
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setCsvFile(null);
      setCsvContent(null);
      return;
    }

    if (file.size > 1024 * 1024) { // 1MB limit
      toast.error("File is too large. Maximum size is 1MB.");
      return;
    }
    if (file.type !== 'text/csv') {
      toast.error("Invalid file type. Please upload a CSV file.");
      return;
    }

    // --- KEY CHANGE: Read the file content into state ---
    try {
      const content = await file.text();
      setCsvFile(file); // Keep the file object for the UI
      setCsvContent(content); // Store the actual string content
      toast.success(`${file.name} is selected and ready.`);
    } catch (error) {
      toast.error("Could not read the selected file.");
      console.error("Error reading file:", error);
    }
  };

  // REPLACE your existing handleDeployDomain function with this simplified version
  const handleDeployDomain = async () => {
    if (!selectedDomainForDeploy) return;

    // --- Validation ---
    if (deployMode === 'csv_upload' && !csvContent) {
      toast.error("Please select a valid CSV file to deploy.");
      return;
    }
    // ... (other validations for userCount, passwordBaseWord, etc. remain the same) ...

    setIsDeploying(true);
    toast.info(`Starting deployment for ${selectedDomainForDeploy.name}...`);

    try {
      // The body is NOW ALWAYS a JSON object
      const body: any = {
        domainId: selectedDomainForDeploy.id,
        parameters: {
          domain_name: selectedDomainForDeploy.name,
          redirect_url: selectedDomainForDeploy.redirect_url || "",
          user_count: 99,
          password_base_word: passwordBaseWord,
        }
      };

      // Conditionally add the correct properties based on the mode
      if (deployMode === 'multiple_names') {
        body.parameters.first_name = namePairs[0]?.first_name || '';
        body.parameters.last_name = namePairs[0]?.last_name || '';
      } else if (deployMode === 'csv_upload') {
        body.csvContent = csvContent; // Add the CSV string to the payload
      }

      // The fetch call is now always the same, with a JSON content type
      const response = await fetch('/api/inboxing/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Deployment failed to start.");
      }

      toast.success(result.message || `Deployment for ${selectedDomainForDeploy.name} has started!`);
      setIsDeployDialogOpen(false);

      // Update local UI state immediately
      setDomains(currentDomains =>
        currentDomains.map(d =>
          d.id === selectedDomainForDeploy!.id ? { ...d, deployment_status: 'Deploying' } : d
        )
      );

    } catch (error: any) {
      console.error("Deployment failed:", error);
      toast.error(error.message || "An unknown error occurred during deployment.");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleOpenStatusDialog = async (jobId: number) => {
    toast.loading("Fetching job details...");
    try {
      const res = await fetch(`/api/inboxing/status/${jobId}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setSelectedJobDetails(result.data);
      setIsStatusDialogOpen(true);
      toast.dismiss();
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch job details.");
    }
  };

  const handleDownloadResults = async (jobId: number) => {
    toast.info("Preparing your download...");
    try {
      const response = await fetch(`/api/inboxing/download/${jobId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job_${jobId}_results.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || "Could not download the file.");
    }
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
              placeholder="Search domains and press Enter..."
              value={searchInput} // Use the new state for display
              onChange={(e) => setSearchInput(e.target.value)} // Update live input state
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // Prevent any default form submission
                  setSearchQuery(searchInput.trim()); // Set the actual search query on Enter
                  setCurrentPage(1); // Reset to first page on new search
                }
              }}
              className="w-full"
            />
          </div>
          {isAdmin && (
            <div className="w-full sm:w-48">
              <Label htmlFor="user-filter" className="sr-only">User</Label>
              <Select
                value={selectedUserId || "all"}
                onValueChange={(value) => {
                  setSelectedUserId(value === "all" ? null : value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
              >
                <SelectTrigger id="user-filter" className="w-full">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.email}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                  onClick={() => loadDomains({ useMockData: false })}
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => {
                    console.log("Loading sample data");
                    setDomains([...mockDomains]);
                    setResultInfo({ ...mockResultInfo });
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[14%]">Domain Name</TableHead>
                    <TableHead className="w-[14%]">Redirect</TableHead>
                    {/* <TableHead className="w-[7%]">Created On</TableHead> */}
                    {/* <TableHead className="w-[9%]">Storage</TableHead> */}
                    {/* <TableHead className="w-[7%]">Last Synced</TableHead> */}
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
                        {/* <TableCell>{formatDate(domain.created_on)}</TableCell> */}
                        {/* <TableCell>
                          <CSVUpload
                            domainId={domain.id}
                            domainName={domain.name}
                            hasFiles={domain.has_files || false}
                            userId={domain.user_id ?? undefined}
                          />
                        </TableCell> */}
                        {/* <TableCell>
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
                        </TableCell> */}
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
                            {!domain.deployment_status && domain.status === 'active' && (
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleOpenDeployDialog(domain)}
                              >
                                <Rocket className="h-4 w-4 mr-2" />
                                Deploy
                              </Button>
                            )}

                            {domain.deployment_status && domain.deployment_status !='Deployed_old' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => domain.inboxing_job_id && handleOpenStatusDialog(domain.inboxing_job_id)}
                                disabled={!domain.inboxing_job_id}
                              >
                                {/* {['Deploying', 'PENDING', 'PROCESSING'].includes(domain.deployment_status) && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )} */}
                                {domain.deployment_status}
                              </Button>
                            )}
                            {/* --- Edit Redirect Button --- */}
                            <Button variant="outline" size="sm" className="px-2 sm:px-3 py-1 text-xs sm:text-sm" onClick={() => handleOpenEditRedirectDialog(domain)}>
                              <Edit3 className="h-3 w-3 sm:mr-1" /> <span className="hidden sm:inline">Edit Redirect</span>
                            </Button>
                            {/* --- End Edit Redirect Button --- */}
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
      {/* --- Edit Redirect Dialog --- */}
      <Dialog open={isEditRedirectDialogOpen} onOpenChange={handleCloseEditRedirectDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Redirect URL</DialogTitle>
            <DialogDescription>
              Update the redirect target for <strong>{selectedDomainForEditRedirect?.name}</strong>.
              Leave the "New Redirect URL" blank to remove the redirect.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="current-redirect" className="text-right col-span-1">
                Domain
              </Label>
              <Input
                id="current-domain"
                value={selectedDomainForEditRedirect?.name || ""}
                disabled
                className="col-span-3 bg-slate-50"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="current-redirect" className="text-right col-span-1">
                Current Redirect
              </Label>
              <Input
                id="current-redirect"
                value={currentRedirectUrlForDialog || "Not set"}
                disabled
                className="col-span-3 bg-slate-50"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-redirect" className="text-right col-span-1">
                New Redirect
              </Label>
              <Input
                id="new-redirect"
                value={newRedirectUrl}
                onChange={handleEditDialogRedirectInputChange}
                placeholder="https://new-target.com (or leave blank to remove)"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditRedirectDialog} disabled={isUpdatingRedirect}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRedirect} disabled={isUpdatingRedirect}>
              {isUpdatingRedirect ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* --- End Edit Redirect Dialog --- */}
      <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Deploy Domain to Tenant</DialogTitle>
            <DialogDescription>
              Deploy <strong>{selectedDomainForDeploy?.name}</strong> to an available Microsoft Tenant.
              Choose how to create the initial user mailboxes.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={deployMode} onValueChange={(value) => setDeployMode(value as any)} className="pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv_upload">Upload CSV</TabsTrigger>
              <TabsTrigger value="multiple_names">Auto-Generate Users</TabsTrigger>
            </TabsList>
              <TabsContent value="csv_upload" className="pt-4">
              <div className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg">
                <UploadCloud className="w-10 h-10 mb-2 text-gray-400" />
                <Label htmlFor="csv-upload" className="font-semibold text-blue-600 cursor-pointer">
                  {csvFile ? `${csvFile.name} selected` : "Choose a CSV file"}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">Max 1MB. Required columns: DisplayName, EmailAddress, Password</p>
                <Input id="csv-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
              </div>
            </TabsContent>
            <TabsContent value="multiple_names" className="pt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Provide 1-5 name pairs to automatically create mailboxes.
              </p>
              {namePairs.map((pair, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="First Name"
                    value={pair.first_name}
                    onChange={(e) => handleNamePairChange(index, 'first_name', e.target.value)}
                  />
                  <Input
                    placeholder="Last Name"
                    value={pair.last_name}
                    onChange={(e) => handleNamePairChange(index, 'last_name', e.target.value)}
                  />
                  {namePairs.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeNamePair(index)}>✕</Button>
                  )}
                </div>
              ))}
              {namePairs.length < 5 && (
                <Button variant="outline" size="sm" onClick={addNamePair}>
                  <PlusCircle className="h-4 w-4 mr-2" /> Add Name
                </Button>
              )}
              <div className="pt-4 space-y-4 border-t">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="password-base-word">Password Base Word</Label>
                    <Input
                      id="password-base-word"
                      type="text"
                      value={passwordBaseWord}
                      onChange={(e) => setPasswordBaseWord(e.target.value)}
                      placeholder="e.g., Super"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            
          </Tabs>

          <DialogFooter className="pt-6">
            <Button variant="outline" onClick={() => setIsDeployDialogOpen(false)} disabled={isDeploying}>
              Cancel
            </Button>
            <Button onClick={handleDeployDomain} disabled={isDeploying}>
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Deployment...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Start Deployment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Job Status Details (ID: {selectedJobDetails?.id})</DialogTitle>
                <DialogDescription>
                    Current status and results for your deployment job.
                </DialogDescription>
            </DialogHeader>
            {selectedJobDetails && (
                <div className="space-y-4 py-4">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold">Current Status:</span>
                        <span className="font-bold text-blue-600">{selectedJobDetails.status}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="font-semibold">Created:</span>
                        <span className="text-sm text-gray-500">{formatDate(selectedJobDetails.created_at, true)}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="font-semibold">Last Updated:</span>
                        <span className="text-sm text-gray-500">{formatDate(selectedJobDetails.updated_at, true)}</span>
                    </div>
                    {selectedJobDetails.status === 'COMPLETED_SUCCESS' && (
                         <div className="border-t pt-4">
                            <p className="text-sm text-center pb-2 text-green-700 font-semibold">Deployment was successful!</p>
                            <Button className="w-full" onClick={() => handleDownloadResults(selectedJobDetails.id)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Results CSV
                            </Button>
                         </div>
                    )}
                    {selectedJobDetails.status.includes('FAILURE') && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                The job failed. Details: {JSON.stringify(selectedJobDetails.result_data)}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </DashboardLayout>
  );
}