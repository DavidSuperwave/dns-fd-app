"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2 } from "lucide-react";

export function LeadsTab({ campaign }: { campaign: any }) {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClientComponentClient();

    useEffect(() => {
        async function fetchLeads() {
            try {
                // Fetch leads linked to this campaign
                // Assuming there is a campaign_leads table or leads have campaign_id
                // For now, fetching from 'leads' table where campaign_id matches
                const { data, error } = await supabase
                    .from("leads")
                    .select("*")
                    .eq("campaign_id", campaign.id)
                    .limit(50);

                if (error) throw error;
                setLeads(data || []);
            } catch (error) {
                console.error("Error fetching leads:", error);
            } finally {
                setLoading(false);
            }
        }

        if (campaign?.id) {
            fetchLeads();
        }
    }, [campaign?.id, supabase]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Leads ({leads.length})</CardTitle>
                <CardDescription>Leads assigned to this campaign</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : leads.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                        No leads found for this campaign.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {leads.map((lead) => (
                                <TableRow key={lead.id}>
                                    <TableCell>{lead.first_name} {lead.last_name}</TableCell>
                                    <TableCell>{lead.email}</TableCell>
                                    <TableCell>{lead.company_name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{lead.status || "New"}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
