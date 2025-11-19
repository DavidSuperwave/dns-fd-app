"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, Globe, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DomainsTab({ campaign }: { campaign: any }) {
    const [domains, setDomains] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClientComponentClient();

    useEffect(() => {
        async function fetchDomains() {
            try {
                // Fetch domains linked to this campaign
                // Assuming campaigns have domain_id or we fetch from domains table
                // If campaign.domain_id is set, fetch that specific domain
                // Or fetch all domains for the project if we want to show available ones

                let query = supabase.from("domains").select("*");

                if (campaign.domain_id) {
                    query = query.eq("id", campaign.domain_id);
                } else {
                    // Fallback: fetch all domains for the user/project
                    // query = query.eq("project_id", campaign.project_id); 
                    // Assuming domains might not be strictly linked to project yet, just fetch user's domains
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        query = query.eq("user_id", user.id);
                    }
                }

                const { data, error } = await query;

                if (error) throw error;
                setDomains(data || []);
            } catch (error) {
                console.error("Error fetching domains:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchDomains();
    }, [campaign, supabase]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sending Domains</CardTitle>
                <CardDescription>Domains configured for this campaign</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : domains.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                        No domains found. Configure a domain to start sending.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {domains.map((domain) => (
                            <div key={domain.id} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Globe className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium">{domain.domain_name}</h4>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className={domain.status === 'active' ? "text-green-600 flex items-center gap-1" : "text-yellow-600 flex items-center gap-1"}>
                                                {domain.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                {domain.status || 'Unknown'}
                                            </span>
                                            <span>•</span>
                                            <span>Reputation: {domain.reputation || 'Good'}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">Configure</Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
