"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, TrendingUp, Mail, Reply, Target } from "lucide-react";
import { EmailCampaignsTable } from "../email-campaigns-table";

interface PerformanceTabProps {
    projectId: string;
    workspaceType: "standard" | "custom";
}

export function PerformanceTab({ projectId, workspaceType }: PerformanceTabProps) {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalLeads: 0,
        emailsSent: 0,
        totalReplies: 0,
        avgReplyRate: 0,
    });
    const supabase = createClientComponentClient();

    useEffect(() => {
        fetchCampaigns();
    }, [projectId]);

    async function fetchCampaigns() {
        try {
            const { data, error } = await supabase
                .from("campaigns")
                .select("*")
                .eq("project_id", projectId)
                .not("plusvibe_campaign_id", "is", null)
                .order("created_at", { ascending: false });

            if (error) throw error;

            setCampaigns(data || []);

            // Calculate aggregate stats
            const totalLeads = data?.reduce((sum, c) => sum + (c.total_leads || 0), 0) || 0;
            const emailsSent = data?.reduce((sum, c) => sum + (c.total_sent || 0), 0) || 0;
            const totalReplies = data?.reduce((sum, c) => sum + (c.total_replies || 0), 0) || 0;
            const avgReplyRate = emailsSent > 0 ? ((totalReplies / emailsSent) * 100).toFixed(1) : 0;

            setStats({ totalLeads, emailsSent, totalReplies, avgReplyRate: Number(avgReplyRate) });
        } catch (error) {
            console.error("Error fetching campaigns:", error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalLeads.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Across all campaigns</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.emailsSent.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total outreach</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Replies</CardTitle>
                        <Reply className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalReplies.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{stats.avgReplyRate}% reply rate</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground">Qualified leads</p>
                    </CardContent>
                </Card>
            </div>

            {/* Email Campaigns Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Email Campaigns</CardTitle>
                    <CardDescription>
                        {workspaceType === "standard"
                            ? "Campaigns created using standard workspace"
                            : "Imported and created campaigns"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No email campaigns yet.</p>
                            <p className="text-sm mt-2">
                                {workspaceType === "standard"
                                    ? "Go to Email Copy tab to generate your first campaign"
                                    : "Import campaigns or create new ones in Email Copy tab"}
                            </p>
                        </div>
                    ) : (
                        <EmailCampaignsTable campaigns={campaigns} onRefresh={fetchCampaigns} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
