"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Play, Pause, Edit, Trash2, BarChart } from "lucide-react";

interface EmailCampaignsTableProps {
    campaigns: any[];
    onRefresh: () => void;
}

export function EmailCampaignsTable({ campaigns, onRefresh }: EmailCampaignsTableProps) {
    function getStatusColor(status: string) {
        switch (status?.toLowerCase()) {
            case "active":
                return "default";
            case "paused":
                return "secondary";
            case "completed":
                return "outline";
            case "draft":
                return "secondary";
            default:
                return "outline";
        }
    }

    function formatPercentage(value: number | null | undefined) {
        if (!value) return "0%";
        return `${value.toFixed(1)}%`;
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Campaign Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Opens</TableHead>
                        <TableHead className="text-right">Replies</TableHead>
                        <TableHead className="text-right">Reply Rate</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                            <TableCell className="font-medium">{campaign.name}</TableCell>
                            <TableCell>
                                <Badge variant={getStatusColor(campaign.status)}>
                                    {campaign.status || "draft"}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">{campaign.total_leads || 0}</TableCell>
                            <TableCell className="text-right">{campaign.total_sent || 0}</TableCell>
                            <TableCell className="text-right">
                                {formatPercentage(campaign.open_rate)}
                            </TableCell>
                            <TableCell className="text-right">{campaign.total_replies || 0}</TableCell>
                            <TableCell className="text-right">
                                <span className={campaign.reply_rate > 5 ? "text-green-600 font-semibold" : ""}>
                                    {formatPercentage(campaign.reply_rate)}
                                </span>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem>
                                            <BarChart className="h-4 w-4 mr-2" />
                                            View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit Campaign
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            {campaign.status === "active" ? (
                                                <>
                                                    <Pause className="h-4 w-4 mr-2" />
                                                    Pause
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="h-4 w-4 mr-2" />
                                                    Activate
                                                </>
                                            )}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
