"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase-client";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface DomainData {
  id: string;
  name: string;
  status: string;
  created_on: string;
  user_id: string | null;
  user_email: string;
  last_synced?: string | null;
  deployment_status?: string | null;
}

interface RawDomainData {
  id: string;
  name: string;
  status: string;
  created_on: string;
  user_id: string | null;
  last_synced?: string | null;
  deployment_status?: string | null;
  user_profiles?: {
    email: string;
  } | null;
}

export function ActiveDomainsList() {
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        // Get active domains with their associated user emails
        const { data, error } = await supabase
          .from('domains')
          .select(`
            id,
            name,
            status,
            created_on,
            last_synced,
            deployment_status,
            user_id,
            user_profiles (
              email
            )
          `)
          .eq('status', 'active')
          .order('created_on', { ascending: false })
          .returns<RawDomainData[]>();

        if (error) throw error;

        // Transform the data to include user email
        const transformedData = (data || []).map(domain => {
          const { user_profiles, ...rest } = domain;
          return {
            ...rest,
            user_email: user_profiles?.email || 'No user assigned'
          };
        }) satisfies DomainData[];

        setDomains(transformedData);
      } catch (error) {
        console.error('Error fetching active domains:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to fetch active domains');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDomains();
  }, [supabase]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Domains</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Domains ({domains.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain Name</TableHead>
                <TableHead>Created On</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead>Deployment Status</TableHead>
                <TableHead>Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">{domain.name}</TableCell>
                  <TableCell>
                    {format(new Date(domain.created_on), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {domain.last_synced
                      ? format(new Date(domain.last_synced), 'MMM d, yyyy HH:mm')
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    {domain.deployment_status || 'Not deployed'}
                  </TableCell>
                  <TableCell>{domain.user_email}</TableCell>
                </TableRow>
              ))}
              {domains.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    No active domains found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
