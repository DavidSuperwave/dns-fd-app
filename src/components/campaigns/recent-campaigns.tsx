"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Mail,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { CampaignSyncStatusBadge } from "@/components/plusvibe/sync-status";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  project_id: string;
  project_name?: string;
  total_leads?: number;
  total_sent?: number;
  total_replies?: number;
  updated_at: string;
  sync_with_plusvibe?: boolean;
  plusvibe_sync_status?: string;
  plusvibe_sync_error?: string;
  last_plusvibe_sync?: string;
  auto_sync_enabled?: boolean;
}

interface RecentCampaignsProps {
  projectId?: string;
  limit?: number;
}

export function RecentCampaigns({ projectId, limit = 10 }: RecentCampaignsProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = limit;

  useEffect(() => {
    async function loadCampaigns() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: String(limit * 2), // Fetch more for pagination
        });

        if (projectId) {
          params.set('project_id', projectId);
        }

        const response = await fetch(`/api/campaigns?${params}`);

        if (!response.ok) {
          throw new Error('Failed to load campaigns');
        }

        const data = await response.json();
        setCampaigns(data.campaigns || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaigns');
        console.error('Error loading campaigns:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, [projectId, limit]);

  const totalPages = Math.ceil(campaigns.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedCampaigns = campaigns.slice(startIndex, endIndex);

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case "active":
      case "ready":
        return (
          <Badge className="bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/20">
            Active
          </Badge>
        );
      case "paused":
      case "in-progress":
        return (
          <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20 hover:bg-orange-500/20">
            Paused
          </Badge>
        );
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "completed":
        return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Campaigns</CardTitle>
          <CardDescription>Loading campaigns...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Campaigns</CardTitle>
          <CardDescription>Overview of active campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Campaigns</CardTitle>
          <CardDescription>No campaigns yet</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {projectId ? 'No campaigns in this project yet.' : 'You haven\'t created any campaigns yet.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl font-bold">Campaigns</CardTitle>
          <CardDescription>
            {projectId ? 'Project campaigns' : 'All your campaigns'}
          </CardDescription>
        </div>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {!projectId && <TableHead>Project</TableHead>}
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Metrics</TableHead>
                <TableHead className="text-center">Sync</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedCampaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        href={`/projects/${campaign.project_id}/campaign`}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.description && (
                        <span className="text-sm text-muted-foreground line-clamp-1">
                          {campaign.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {!projectId && (
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.project_name || 'Unknown project'}
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    {getStatusBadge(campaign.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1 text-xs">
                      <div className="flex gap-3">
                        <span>{campaign.total_leads || 0} leads</span>
                        <span>{campaign.total_replies || 0} replies</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <CampaignSyncStatusBadge campaign={campaign} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${campaign.project_id}/campaign`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, campaigns.length)} of {campaigns.length} results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
