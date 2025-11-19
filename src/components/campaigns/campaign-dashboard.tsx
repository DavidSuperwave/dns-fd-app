"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw, ExternalLink } from "lucide-react";
import { CampaignSyncStatusBadge } from "@/components/plusvibe/sync-status";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Placeholder imports for tabs - we will create these next
import { PerformanceTab } from "./tabs/performance-tab";
import { IcpTab } from "./tabs/icp-tab";
import { CopyTab } from "./tabs/copy-tab";
import { LeadsTab } from "./tabs/leads-tab";
import { DomainsTab } from "./tabs/domains-tab";

interface CampaignDashboardProps {
    projectId: string;
    campaign: any; // Type this properly later
    onRefresh: () => void;
}

export function CampaignDashboard({ projectId, campaign, onRefresh }: CampaignDashboardProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // Call refresh API or just reload page
            await onRefresh();
            toast.success("Campaign data refreshed");
        } catch (error) {
            toast.error("Failed to refresh data");
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
                        <CampaignSyncStatusBadge campaign={campaign} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {campaign.description || "Campaign Dashboard"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                    </Button>
                    <Button size="sm" asChild>
                        <a href={`https://app.plusvibe.ai/campaigns/${campaign.plusvibe_campaign_id}`} target="_blank" rel="noopener noreferrer">
                            Open in PlusVibe
                            <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                    </Button>
                </div>
            </div>

            {/* Stats Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{campaign.stats?.total_leads || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            +0% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{campaign.stats?.emails_sent || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            {campaign.email_sent_today || 0} sent today
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Replies</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{campaign.stats?.replies || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            {campaign.stats?.reply_rate || 0}% reply rate
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground">
                            Pipeline value: $0
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="performance" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="icp">ICP Analysis</TabsTrigger>
                    <TabsTrigger value="copy">Email Copy</TabsTrigger>
                    <TabsTrigger value="leads">Leads</TabsTrigger>
                    <TabsTrigger value="domains">Domains</TabsTrigger>
                </TabsList>

                <TabsContent value="performance" className="space-y-4">
                    <PerformanceTab campaign={campaign} />
                </TabsContent>

                <TabsContent value="icp" className="space-y-4">
                    <IcpTab campaign={campaign} />
                </TabsContent>

                <TabsContent value="copy" className="space-y-4">
                    <CopyTab campaign={campaign} />
                </TabsContent>

                <TabsContent value="leads" className="space-y-4">
                    <LeadsTab campaign={campaign} />
                </TabsContent>

                <TabsContent value="domains" className="space-y-4">
                    <DomainsTab campaign={campaign} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
