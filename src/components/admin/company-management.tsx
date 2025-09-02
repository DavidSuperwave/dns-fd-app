"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Trash2, Users, Mail } from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  description: string | null;
  admin_email: string;
  max_domains: number;
  active: boolean;
  domain_count: number;
  user_count: number;
}

export function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const supabase = createClient();
  
  const fetchCompanies = async () => {
    setLoading(true);
    
    try {
      // Fetch all tenants (companies)
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select(`
          id, 
          name, 
          description, 
          admin_email, 
          max_domains, 
          active
        `);
        
      if (tenantsError) throw tenantsError;
      
      // For each tenant, get domain count and user count
      const companiesWithCounts = await Promise.all(
        tenantsData.map(async (tenant) => {
          // Get domain count
          const { count: domainCount, error: domainError } = await supabase
            .from('domains')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);
            
          if (domainError) throw domainError;
          
          // Get user count
          const { count: userCount, error: userError } = await supabase
            .from('tenant_user_roles')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);
            
          if (userError) throw userError;
          
          return {
            ...tenant,
            domain_count: domainCount || 0,
            user_count: userCount || 0,
          };
        })
      );
      
      setCompanies(companiesWithCounts);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch companies on component mount
  useEffect(() => {
    fetchCompanies();
  }, []);
  
  // Filter companies based on search query
  const filteredCompanies = companies.filter(company => 
    company.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    company.admin_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Invite user to company
  const inviteUserToCompany = async (companyId: string) => {
    // This would open a dialog to invite users - implement in future
    toast.info("User invitation feature coming soon");
  };
  
  // Manage company users
  const manageCompanyUsers = async (companyId: string) => {
    // This would navigate to company user management - implement in future
    toast.info("Company user management feature coming soon");
  };
  
  // Delete company
  const deleteCompany = async (companyId: string) => {
    if (!confirm("Are you sure you want to delete this company? This will remove all associated users and domains.")) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', companyId);
        
      if (error) throw error;
      
      toast.success("Company deleted successfully");
      fetchCompanies(); // Refresh the list
    } catch (error: any) {
      console.error("Error deleting company:", error);
      toast.error("Failed to delete company");
    }
  };
  
  if (loading) {
    return <div className="flex justify-center py-8">Loading companies...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search companies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={() => fetchCompanies()}>
          Refresh
        </Button>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="text-center py-8">
          No companies found. Use the "Add Company" button to create one.
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Admin Email</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name || 'Unnamed Company'}</TableCell>
                  <TableCell>{company.admin_email}</TableCell>
                  <TableCell>{company.description || '-'}</TableCell>
                  <TableCell>{company.domain_count} / {company.max_domains}</TableCell>
                  <TableCell>{company.user_count}</TableCell>
                  <TableCell>
                    <Badge variant={company.active ? "success" : "destructive"}>
                      {company.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => inviteUserToCompany(company.id)}
                        title="Invite User"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => manageCompanyUsers(company.id)}
                        title="Manage Users"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteCompany(company.id)}
                        title="Delete Company"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
