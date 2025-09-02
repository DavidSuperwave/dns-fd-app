"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  description?: string;
  website?: string;
  logo_url?: string;
}

interface CompanySelectProps {
  selectedCompanyId?: string;
  onCompanyChange: (companyId: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CompanySelect({
  selectedCompanyId,
  onCompanyChange,
  disabled = false,
  placeholder = "Select a company"
}: CompanySelectProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCompanies() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, description, website, logo_url')
          .order('name');

        if (error) throw error;
        setCompanies(data || []);
      } catch (error: any) {
        console.error("Error fetching companies:", error);
        toast.error("Failed to load companies");
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, []);

  const handleValueChange = (value: string) => {
    onCompanyChange(value || undefined);
  };

  return (
    <div>
      {loading ? (
        <div className="flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>Loading companies...</span>
        </div>
      ) : (
        <Select
          value={selectedCompanyId}
          onValueChange={handleValueChange}
          disabled={disabled || companies.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No Company</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
