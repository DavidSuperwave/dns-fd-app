"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface CustomWorkspaceSetupProps {
    projectId: string;
    onComplete: () => void;
}

export function CustomWorkspaceSetup({ projectId, onComplete }: CustomWorkspaceSetupProps) {
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
    const supabase = createClientComponentClient();

    useEffect(() => {
        loadConnections();
    }, []);

    async function loadConnections() {
        try {
            const response = await fetch("/api/plusvibe/connections");
            const data = await response.json();
            setConnections(data.connections || []);
        } catch (error) {
            toast.error("Failed to load connections");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddConnection(formData: any) {
        try {
            const response = await fetch("/api/plusvibe/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error("Failed to create connection");

            toast.success("Connection added successfully");
            setShowAddForm(false);
            loadConnections();
        } catch (error) {
            toast.error("Failed to add connection");
        }
    }

    async function handleImportCampaigns() {
        if (selectedCampaigns.size === 0) {
            toast.error("Please select at least one campaign to import");
            return;
        }

        try {
            // Import each selected campaign
            for (const campaignId of selectedCampaigns) {
                const [connectionId, pvCampaignId] = campaignId.split("::");

                await fetch("/api/plusvibe/campaigns/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        connectionId,
                        plusvibeCampaignId: pvCampaignId,
                        projectId,
                    }),
                });
            }

            // Ensure workspace type is set to custom
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from("projects")
                    .update({
                        workspace_type: "custom",
                        workspace_configured_at: new Date().toISOString(),
                    })
                    .eq("id", projectId)
                    .eq("user_id", user.id);
            }

            toast.success(`Imported ${selectedCampaigns.size} campaigns`);

            // Small delay to ensure database update completes
            await new Promise(resolve => setTimeout(resolve, 500));

            onComplete();
        } catch (error) {
            console.error("Import error:", error);
            toast.error("Failed to import campaigns");
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-2">Custom Workspace Setup</h2>
                <p className="text-muted-foreground">
                    Connect your PlusVibe account and import existing email campaigns
                </p>
            </div>

            {/* Connections Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Your Connections</h3>
                    <Button onClick={() => setShowAddForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Connection
                    </Button>
                </div>

                {showAddForm && (
                    <AddConnectionForm
                        onSubmit={handleAddConnection}
                        onCancel={() => setShowAddForm(false)}
                    />
                )}

                {connections.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground mb-4">
                                No connections yet. Add your first PlusVibe connection to get started.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6">
                        {connections.map((connection) => (
                            <ConnectionWithCampaigns
                                key={connection.id}
                                connection={connection}
                                selectedCampaigns={selectedCampaigns}
                                onToggleCampaign={(campaignId: string) => {
                                    const newSelected = new Set(selectedCampaigns);
                                    if (newSelected.has(campaignId)) {
                                        newSelected.delete(campaignId);
                                    } else {
                                        newSelected.add(campaignId);
                                    }
                                    setSelectedCampaigns(newSelected);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Import Button */}
            {selectedCampaigns.size > 0 && (
                <div className="sticky bottom-4 bg-background border rounded-lg p-4 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold">{selectedCampaigns.size} campaigns selected</p>
                            <p className="text-sm text-muted-foreground">Ready to import</p>
                        </div>
                        <Button onClick={handleImportCampaigns} size="lg">
                            <Download className="h-4 w-4 mr-2" />
                            Import Campaigns
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function AddConnectionForm({ onSubmit, onCancel }: any) {
    const [formData, setFormData] = useState({
        workspace_id: "",
        api_key: "",
        connection_name: "",
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Add PlusVibe Connection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>Connection Name</Label>
                    <Input
                        placeholder="My PlusVibe Account"
                        value={formData.connection_name}
                        onChange={(e) => setFormData({ ...formData, connection_name: e.target.value })}
                    />
                </div>
                <div>
                    <Label>Workspace ID</Label>
                    <Input
                        placeholder="678eb62a071ff7544034bcde"
                        value={formData.workspace_id}
                        onChange={(e) => setFormData({ ...formData, workspace_id: e.target.value })}
                    />
                </div>
                <div>
                    <Label>API Key</Label>
                    <Input
                        type="password"
                        placeholder="7332bc56-e2769fd4-9f1a00b6-ebb7ce28"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    />
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => onSubmit(formData)} className="flex-1">
                        Add Connection
                    </Button>
                    <Button onClick={onCancel} variant="outline">
                        Cancel
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ConnectionWithCampaigns({ connection, selectedCampaigns, onToggleCampaign }: any) {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchCampaigns() {
            try {
                const response = await fetch(`/api/plusvibe/connections/${connection.id}/campaigns`);
                const data = await response.json();
                const campaigns = data.campaigns || [];
                setCampaigns(campaigns);

                // Log first campaign to see structure
                if (campaigns.length > 0) {
                    console.log("Sample PlusVibe campaign data:", campaigns[0]);
                }
            } catch (error) {
                console.error("Failed to fetch campaigns:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchCampaigns();
    }, [connection.id]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>{connection.connection_name}</CardTitle>
                        <CardDescription>Workspace: {connection.workspace_id}</CardDescription>
                    </div>
                    <Badge variant={connection.is_active ? "default" : "secondary"}>
                        {connection.is_active ? "Active" : "Inactive"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : campaigns.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No campaigns found</p>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm font-medium mb-3">Available Campaigns ({campaigns.length})</p>
                        {campaigns.map((campaign) => {
                            const campaignId = `${connection.id}::${campaign.id}`;
                            const isSelected = selectedCampaigns.has(campaignId);

                            // PlusVibe might use different field names for lead count
                            const leadCount = campaign.total_leads ||
                                campaign.leads_count ||
                                campaign.stats?.total_leads ||
                                campaign.stats?.leads ||
                                campaign.leadsCount ||
                                0;

                            return (
                                <div
                                    key={campaign.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
                                        }`}
                                    onClick={() => onToggleCampaign(campaignId)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`h-5 w-5 rounded border-2 flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                                                }`}
                                        >
                                            {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                        </div>
                                        <div>
                                            <p className="font-medium">{campaign.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Status: {campaign.status} • Leads: {leadCount}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
