"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Loader2, Trash2, Search, PlusCircle, RefreshCw, FileText, Globe, ArrowRight, Settings, User, UserPlus } from "lucide-react";
import { AddDomainDialog } from "@/components/domains/add-domain-dialog";
import { AssignDomainDialog } from "@/components/domains/assign-domain-dialog";
import { DomainSlotsCard } from "@/components/domains/domain-slots-card";
import { CSVUpload } from "@/components/domains/csv-upload";
import { useAuth } from "@/components/auth/auth-provider";
import DashboardLayout from "@/components/layout/dashboard-layout";

type DomainStatusFilter = "all" | "active" | "pending" | "setup" | "deleting";

type InboxingDomainRecord = {
    id: number;
    domain_name: string;
    status: string;
    user_id?: number | null;
    admin_email?: string | null;
    display_name?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    redirect_url?: string | null;
    has_files?: boolean;
};

function DomainsPageContent() {
    const router = useRouter();
    const { user, isAdmin } = useAuth();

    const [domains, setDomains] = useState<InboxingDomainRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isError, setIsError] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [statusFilter, setStatusFilter] = useState<DomainStatusFilter>("all");
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

    // Add domain dialog state
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Delete domain dialog state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [domainToDelete, setDomainToDelete] = useState<InboxingDomainRecord | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // CSV Dialog state
    const [csvDomain, setCsvDomain] = useState<InboxingDomainRecord | null>(null);

    // Assign domain dialog state
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [domainToAssign, setDomainToAssign] = useState<InboxingDomainRecord | null>(null);

    const loadDomains = useCallback(
        async (page = 1) => {
            setIsLoading(true);
            setIsError(false);

            try {
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('per_page', '10');
                if (searchQuery) {
                    params.set('search', searchQuery);
                }
                if (statusFilter !== 'all') {
                    params.set('status', statusFilter);
                }

                const response = await fetch(`/api/inboxing/domains?${params.toString()}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch domains');
                }

                const data = await response.json();

                let fetchedDomains = data.domains || [];

                if (!isAdmin && user?.email) {
                    fetchedDomains = fetchedDomains.filter(
                        (d: InboxingDomainRecord) => d.admin_email?.toLowerCase() === user.email?.toLowerCase()
                    );
                }

                setDomains(fetchedDomains);

                if (data.pagination) {
                    setTotalPages(data.pagination.pages);
                }

                if (data.last_sync) {
                    setLastSyncTime(data.last_sync);
                }
            } catch (error: any) {
                console.error("Error loading domains:", error);
                setIsError(true);
                toast.error("Failed to load domains");
            } finally {
                setIsLoading(false);
            }
        },
        [searchQuery, statusFilter, isAdmin, user]
    );

    useEffect(() => {
        loadDomains(currentPage);
    }, [currentPage, loadDomains]);

    const handleSync = async () => {
        if (!isAdmin) return;

        setIsSyncing(true);
        try {
            const response = await fetch('/api/inboxing/domains/sync', {
                method: 'POST',
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Sync completed! ${data.summary?.upserted || 0} domains updated.`);
                loadDomains(currentPage);
            } else {
                throw new Error(data.error || 'Sync failed');
            }
        } catch (error: any) {
            console.error("Sync error:", error);
            toast.error(error.message || "Failed to sync domains");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(searchInput);
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setSearchInput("");
        setSearchQuery("");
        setStatusFilter("all");
        setCurrentPage(1);
    };

    const handleDeleteDomain = async () => {
        if (!domainToDelete) return;

        setIsDeleting(true);
        try {
            const response = await fetch('/api/inboxing/jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    job_type: 'DOMAIN_DELETE',
                    domain_name: domainToDelete.domain_name,
                }),
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                toast.success(
                    `Domain deletion initiated! Job ID: ${data.data?.job_id}`
                );
                setIsDeleteDialogOpen(false);
                setDomainToDelete(null);
                await loadDomains(currentPage);
            } else {
                throw new Error(data.error || 'Failed to delete domain');
            }
        } catch (error: any) {
            console.error("Error deleting domain:", error);
            toast.error(error.message || "Failed to delete domain");
        } finally {
            setIsDeleting(false);
        }
    };

    const openDeleteDialog = (domain: InboxingDomainRecord) => {
        setDomainToDelete(domain);
        setIsDeleteDialogOpen(true);
    };

    const getStatusBadgeColor = (status: string) => {
        const lowercaseStatus = status?.toLowerCase() || "";
        switch (lowercaseStatus) {
            case "active":
                return "bg-green-100 text-green-800 border-green-200";
            case "pending":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "setup":
                return "bg-blue-100 text-blue-800 border-blue-200";
            case "deleting":
                return "bg-red-100 text-red-800 border-red-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Domain Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your domains
                        {lastSyncTime && (
                            <span className="text-xs ml-2 bg-muted px-2 py-1 rounded-full">
                                Last synced: {new Date(lastSyncTime).toLocaleString()}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <Button
                            variant="outline"
                            onClick={handleSync}
                            disabled={isSyncing}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                    )}
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Domain
                    </Button>
                </div>
            </div>

            {/* Domain Slots Card */}
            <DomainSlotsCard />

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <Label htmlFor="search" className="sr-only">
                                Search
                            </Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="Search domains..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="w-full sm:w-40">
                            <Label htmlFor="status-filter" className="sr-only">
                                Status
                            </Label>
                            <Select
                                value={statusFilter}
                                onValueChange={(value: DomainStatusFilter) => {
                                    setStatusFilter(value);
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger id="status-filter">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="setup">Setup</SelectItem>
                                    <SelectItem value="deleting">Deleting</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" variant="default">
                            Search
                        </Button>
                        <Button type="button" variant="outline" onClick={resetFilters}>
                            Reset
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Domains List */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        Domains {!isLoading && `(${domains.length})`}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : isError ? (
                        <div className="text-center py-12">
                            <p className="text-destructive">Failed to load domains</p>
                            <Button
                                variant="outline"
                                onClick={() => loadDomains(currentPage)}
                                className="mt-4"
                            >
                                Retry
                            </Button>
                        </div>
                    ) : domains.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No domains found</p>
                            <Button
                                variant="outline"
                                onClick={() => setIsAddDialogOpen(true)}
                                className="mt-4"
                            >
                                Add Your First Domain
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {domains.map((domain) => (
                                <div
                                    key={domain.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-4"
                                >
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                                <Globe className="h-4 w-4 text-muted-foreground" />
                                                {domain.domain_name}
                                            </h3>
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                                                    domain.status
                                                )}`}
                                            >
                                                {domain.status || "Unknown"}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            <p className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                <span>Name: </span>
                                                <span className="text-foreground">
                                                    {domain.display_name || "Unassigned"}
                                                </span>
                                            </p>
                                            {domain.redirect_url && (
                                                <div className="flex items-center gap-1 col-span-1 sm:col-span-2">
                                                    <ArrowRight className="h-3 w-3" />
                                                    <span>Redirects to: </span>
                                                    <a
                                                        href={domain.redirect_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline truncate max-w-[300px]"
                                                    >
                                                        {domain.redirect_url}
                                                    </a>
                                                </div>
                                            )}
                                            {domain.created_at && (
                                                <p className="col-span-1 sm:col-span-2 text-xs mt-1">
                                                    Created: {new Date(domain.created_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCsvDomain(domain)}
                                                    className="gap-2"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                    CSV Files
                                                    {domain.has_files && (
                                                        <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                                                    )}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-3xl">
                                                <DialogHeader>
                                                    <DialogTitle>Manage CSV Files</DialogTitle>
                                                    <DialogDescription>
                                                        Upload and manage CSV files for {domain.domain_name}
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="py-4">
                                                    <CSVUpload
                                                        domainId={String(domain.id)}
                                                        domainName={domain.domain_name}
                                                        hasFiles={domain.has_files || false}
                                                    />
                                                </div>
                                            </DialogContent>
                                        </Dialog>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Domain Settings</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {isAdmin && (
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setDomainToAssign(domain);
                                                            setIsAssignDialogOpen(true);
                                                        }}
                                                    >
                                                        <UserPlus className="h-4 w-4 mr-2" />
                                                        Assign User
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => openDeleteDialog(domain)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete Domain
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {!isLoading && !isError && totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-6 border-t">
                            <p className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Domain Dialog */}
            <AddDomainDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onSuccess={() => loadDomains(currentPage)}
            />

            {/* Assign Domain Dialog */}
            {domainToAssign && (
                <AssignDomainDialog
                    isOpen={isAssignDialogOpen}
                    onClose={() => {
                        setIsAssignDialogOpen(false);
                        setDomainToAssign(null);
                    }}
                    domainId={domainToAssign.id}
                    domainName={domainToAssign.domain_name}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Domain</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete{" "}
                            <span className="font-semibold">{domainToDelete?.domain_name}</span>?
                            This action will initiate a domain deletion job.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDeleteDialogOpen(false);
                                setDomainToDelete(null);
                            }}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteDomain}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete Domain"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function DomainsPage() {
    return (
        <DashboardLayout>
            <DomainsPageContent />
        </DashboardLayout>
    );
}
