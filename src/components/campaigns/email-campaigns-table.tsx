"use client";

import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, Mail, Eye, MessageSquare, MousePointerClick, ExternalLink, TrendingUp, Users, Globe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface EmailCampaignsTableProps {
    campaigns: any[];
    onRefresh: () => void;
}

export function EmailCampaignsTable({ campaigns, onRefresh }: EmailCampaignsTableProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [showPercentage, setShowPercentage] = useState(true);

    const filteredCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    function getStatusColor(status: string) {
        switch (status?.toLowerCase()) {
            case "active":
                return "bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200";
            case "paused":
                return "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200";
            case "completed":
                return "bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200";
            case "draft":
                return "bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200";
            default:
                return "bg-gray-100 text-gray-700 hover:bg-gray-100/80 border-gray-200";
        }
    }

    function formatPercentage(value: number | null | undefined) {
        if (!value) return "0%";
        return `${value.toFixed(1)}%`;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by Email name or campaign name (Press enter)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-9"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg text-sm">
                        <button
                            className={`px-3 py-1 rounded-md transition-all ${!showPercentage ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                            onClick={() => setShowPercentage(false)}
                        >
                            Show Count
                        </button>
                        <button
                            className={`px-3 py-1 rounded-md transition-all ${showPercentage ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                            onClick={() => setShowPercentage(true)}
                        >
                            Show %
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Campaigns per page</span>
                        <div className="border rounded px-2 py-1 bg-background">50</div>
                    </div>
                </div>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[50px]">
                                <Checkbox />
                            </TableHead>
                            <TableHead className="w-[400px]">Campaign Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Timezone</TableHead>
                            <TableHead className="text-right"><Users className="h-4 w-4 inline mr-1" /></TableHead>
                            <TableHead className="text-right"><Mail className="h-4 w-4 inline mr-1" /></TableHead>
                            <TableHead className="text-right"><Eye className="h-4 w-4 inline mr-1" /></TableHead>
                            <TableHead className="text-right"><MessageSquare className="h-4 w-4 inline mr-1" /></TableHead>
                            <TableHead className="text-right"><MousePointerClick className="h-4 w-4 inline mr-1" /></TableHead>
                            <TableHead className="text-right"><TrendingUp className="h-4 w-4 inline mr-1" /></TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCampaigns.map((campaign) => (
                            <TableRow key={campaign.id} className="group">
                                <TableCell>
                                    <Checkbox />
                                </TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span className="truncate max-w-[350px]" title={campaign.name}>{campaign.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={campaign.status === 'active'} />
                                        <Badge variant="outline" className={`border-0 ${getStatusColor(campaign.status)}`}>
                                            {campaign.status || "Draft"}
                                        </Badge>
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    <div className="flex items-center gap-1">
                                        <Globe className="h-3 w-3" />
                                        <span>Outside of timezone</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {campaign.total_leads || 0}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {showPercentage ? '100%' : (campaign.total_sent || 0)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {showPercentage ? formatPercentage(campaign.open_rate) : (campaign.total_opens || 0)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {showPercentage ? formatPercentage(campaign.reply_rate) : (campaign.total_replies || 0)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {showPercentage ? formatPercentage(campaign.click_rate) : (campaign.total_clicks || 0)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="font-medium text-green-600">
                                            {campaign.positive_reply_rate ? formatPercentage(campaign.positive_reply_rate) : '0%'}
                                        </span>
                                        {campaign.positive_reply_rate > 0 && (
                                            <div className="h-1 w-12 bg-green-100 rounded-full mt-1 overflow-hidden">
                                                <div className="h-full bg-green-500" style={{ width: `${campaign.positive_reply_rate}%` }} />
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                            <TrendingUp className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredCampaigns.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                                    No campaigns found matching your search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
