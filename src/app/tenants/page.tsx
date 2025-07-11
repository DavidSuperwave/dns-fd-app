"use client";

import { useState, useEffect, useMemo, useCallback } from 'react'; // Import useMemo
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User, UploadCloud, PlusCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { createClient } from '@/lib/supabase-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Replace your existing Tenant interface
interface Tenant {
    id: string;
    admin_email: string;
    max_domains: number;
    owner_email: string | null; // The owner's email is now a direct property
}

export default function ManageTenantsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [adminEmail, setAdminEmail] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [maxDomains, setMaxDomains] = useState(10);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // --- FIX: Create a single, stable Supabase client instance ---
  const supabase = useMemo(() => createClient(), []);

  // Replace your existing fetchTenants function with this one
  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      // Call your secure API route instead of Supabase directly
      const response = await fetch('/api/admin/tenants/get');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch tenants.");
      }
      
      setTenants(data || []);
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    }
    setIsLoading(false);
  }, []); // Empty dependency array as it doesn't depend on component props/state // Add supabase as a dependency

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]); // fetchTenants is now stable due to useCallback

  const handleAddSingleTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !ownerEmail || !maxDomains) {
        toast.error("All fields are required for a single entry.");
        return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading("Adding new tenant...");

    try {
        const response = await fetch('/api/admin/tenants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: adminEmail, owner_email: ownerEmail, max_domains: maxDomains })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        
        toast.success("Tenant added successfully!", { id: toastId });
        setAdminEmail('');
        setOwnerEmail('');
        fetchTenants();
    } catch (error: any) {
        toast.error(error.message, { id: toastId });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!csvFile) {
        toast.error("Please select a CSV file to upload.");
        return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading("Uploading and processing CSV...");

    const formData = new FormData();
    formData.append('tenantsCsv', csvFile);

    try {
        const response = await fetch('/api/admin/tenants', {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        toast.success(result.message, { id: toastId, duration: 10000 });
        setCsvFile(null); // Clear the file input after successful upload
        fetchTenants();
    } catch (error: any) {
        toast.error(error.message, { id: toastId });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-4xl mx-auto px-4 py-6 md:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight">Manage Tenants</h1>
        <p className="text-muted-foreground mt-2">
          Add new tenants individually or upload a CSV for bulk creation.
        </p>

        <Tabs defaultValue="single" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">Add Single Tenant</TabsTrigger>
                <TabsTrigger value="bulk">Bulk Upload CSV</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="p-6 border rounded-b-lg">
                <form onSubmit={handleAddSingleTenant} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="admin-email">Tenant Admin Email</Label>
                            <Input id="admin-email" type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@tenant.onmicrosoft.com" required />
                        </div>
                        <div>
                            <Label htmlFor="owner-email">Owner's Email</Label>
                            <Input id="owner-email" type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="user@your-app.com" required />
                        </div>
                         <div>
                            <Label htmlFor="max-domains">Max Domains</Label>
                            <Input id="max-domains" type="number" value={maxDomains} onChange={e => setMaxDomains(parseInt(e.target.value, 10))} required />
                        </div>
                    </div>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Add Tenant
                    </Button>
                </form>
            </TabsContent>
            <TabsContent value="bulk" className="p-6 border rounded-b-lg">
                 <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Upload a CSV file with the required columns: <strong>owner_email</strong>, <strong>admin_email</strong>, <strong>max_domains</strong>.
                    </p>
                    <div className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg">
                        <UploadCloud className="w-10 h-10 mb-2 text-gray-400" />
                        <Label htmlFor="csv-upload" className="font-semibold text-blue-600 cursor-pointer">
                            {csvFile ? csvFile.name : "Choose a CSV file"}
                        </Label>
                        <Input id="csv-upload" type="file" className="sr-only" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                    </div>
                    <Button onClick={handleBulkUpload} disabled={!csvFile || isSubmitting} className="w-full">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                        Upload and Process CSV
                    </Button>
                 </div>
            </TabsContent>
        </Tabs>

        <div className="mt-12">
            <h2 className="text-2xl font-bold">Existing Tenants</h2>
            <div className="mt-4 border rounded-lg">
                <div className="grid grid-cols-3 font-semibold p-4 border-b bg-gray-50">
                    <div>Tenant Admin</div>
                    <div>Owner Email</div>
                    <div className="text-right">Max Domains</div>
                </div>
                {isLoading ? (
                    <div className="p-4 text-center"> <Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                ) : (
                    tenants.map(tenant => (
                        <div key={tenant.id} className="grid grid-cols-3 p-4 border-b last:border-b-0">
                            <div className="font-medium truncate" title={tenant.admin_email}>{tenant.admin_email}</div>
                            <div className="text-muted-foreground truncate" title={tenant.owner_email || 'N/A'}>
                                {tenant.owner_email || 'No Owner'}
                            </div>
                            <div className="text-right">{tenant.max_domains}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}