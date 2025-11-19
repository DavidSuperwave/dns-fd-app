"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Plus,
    Mail,
    ArrowLeft,
    Save,
    MoreHorizontal,
    Pencil,
    Trash2,
    Send,
    Sparkles,
    Play,
    ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types for Campaign Data
interface CampaignStep {
    step_number: number;
    wait_days: number;
    step_summary: string;
    variations: {
        variation_id: string;
        subject: string;
        body: string;
    }[];
}

interface Campaign {
    id: string;
    name: string; // Angle name or manual name
    summary: string;
    target_profile?: string; // ICP/Sub-niche name
    status: 'draft' | 'active' | 'completed';
    sequence: CampaignStep[];
    is_generated: boolean;
    created_at: string;
}

interface CampaignsTabProps {
    projectId: string;
    companyProfileId?: string;
    campaignData?: any; // Phase 3 data from Manus
    workflowStatus?: string;
    onUpdate?: () => void;
}

export function CampaignsTab({ projectId, companyProfileId, campaignData, workflowStatus, onUpdate }: CampaignsTabProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
    const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

    // Initialize campaigns from props and fetch from API
    useEffect(() => {
        console.log('[CampaignsTab] Received campaignData:', campaignData);

        const loadCampaigns = async () => {
            let loadedCampaigns: Campaign[] = [];

            // Case 1: Fresh from Manus (has campaign_blueprints) - Keep as draft in UI until saved
            if (campaignData?.campaign_blueprints) {
                console.log('[CampaignsTab] Loading from Manus blueprints');
                const blueprints = campaignData.campaign_blueprints.map((bp: any, index: number) => ({
                    id: bp.angle_id || `generated_${index}`,
                    name: bp.angle_name || `Campaign ${index + 1}`,
                    summary: bp.angle_summary || "AI Generated Campaign",
                    target_profile: campaignData.target_profile?.sub_niche_name || "Target Audience",
                    status: 'draft',
                    sequence: bp.sequence || [],
                    is_generated: true,
                    created_at: new Date().toISOString()
                }));
                loadedCampaigns = [...loadedCampaigns, ...blueprints];
            }

            // Case 2: Fetch existing campaigns from DB
            if (projectId) {
                try {
                    const response = await fetch(`/api/campaigns?project_id=${projectId}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.campaigns) {
                            console.log('[CampaignsTab] Loaded campaigns from DB:', data.campaigns);
                            loadedCampaigns = [...loadedCampaigns, ...data.campaigns];
                        }
                    }
                } catch (error) {
                    console.error("Error fetching campaigns:", error);
                }
            }

            setCampaigns(loadedCampaigns);
        };

        loadCampaigns();
    }, [campaignData, projectId]);

    const handleCreateCampaign = () => {
        const newCampaign: Campaign = {
            id: `manual_${Date.now()}`,
            name: "New Campaign",
            summary: "Manually created campaign",
            status: 'draft',
            sequence: [
                {
                    step_number: 1,
                    wait_days: 0,
                    step_summary: "Initial Outreach",
                    variations: [
                        {
                            variation_id: `var_${Date.now()}`,
                            subject: "",
                            body: ""
                        }
                    ]
                }
            ],
            is_generated: false,
            created_at: new Date().toISOString()
        };

        setCampaigns(prev => [...prev, newCampaign]);
        setEditingCampaignId(newCampaign.id);
        setActiveStepIndex(0);
    };

    const handleDeleteCampaign = (id: string) => {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        toast.success("Campaign deleted");
    };

    const handleSaveCampaign = async () => {
        if (!projectId) {
            toast.error("Project ID missing");
            return;
        }

        const campaignToSave = campaigns.find(c => c.id === editingCampaignId);
        if (!campaignToSave) return;

        try {
            // Get current user from Supabase auth
            const { supabase } = await import('@/lib/supabase');
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                toast.error("Authentication required");
                console.error("Auth error:", authError);
                return;
            }

            // Use the new POST endpoint
            const response = await fetch(`/api/campaigns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    project_id: projectId,
                    user_id: user.id,
                    name: campaignToSave.name,
                    description: campaignToSave.summary,
                    status: 'active',
                    sequence: campaignToSave.sequence,
                    icp_id: null
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save campaign');
            }

            const result = await response.json();
            console.log("Save result:", result);

            toast.success("Campaign saved successfully");
            setEditingCampaignId(null);

            // Refresh parent data
            if (onUpdate) {
                onUpdate();
            }

        } catch (error) {
            console.error("Error saving campaign:", error);
            toast.error("Failed to save campaign");
        }
    };

    const activeCampaign = campaigns.find(c => c.id === editingCampaignId);

    // --- RENDER: EDITOR VIEW ---
    if (activeCampaign) {
        return (
            <div className="flex flex-col h-[calc(10vh-200px)] min-h-[600px] border rounded-lg overflow-hidden bg-background shadow-sm">
                {/* Editor Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => setEditingCampaignId(null)}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <div>
                            <Input
                                value={activeCampaign.name}
                                onChange={(e) => {
                                    setCampaigns(prev => prev.map(c => c.id === activeCampaign.id ? { ...c, name: e.target.value } : c));
                                }}
                                className="h-8 font-semibold text-lg border-transparent hover:border-input focus:border-input px-2 -ml-2 w-[300px]"
                            />
                            <p className="text-xs text-muted-foreground px-0.5">
                                {activeCampaign.is_generated ? "AI Generated" : "Manual Campaign"} • {activeCampaign.status}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingCampaignId(null)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveCampaign}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Campaign
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Steps */}
                    <div className="w-64 border-r bg-muted/10 flex flex-col">
                        <div className="p-4 border-b">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sequence Steps</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {activeCampaign.sequence.map((step, index) => (
                                <button
                                    key={index}
                                    onClick={() => setActiveStepIndex(index)}
                                    className={`w-full text-left p-3 rounded-md text-sm transition-colors flex items-start gap-3 ${activeStepIndex === index
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "hover:bg-muted text-foreground"
                                        }`}
                                >
                                    <div className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0 ${activeStepIndex === index ? "bg-primary-foreground text-primary" : "bg-muted-foreground/20"
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">Step {step.step_number}</p>
                                        <p className={`text-xs truncate ${activeStepIndex === index ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                            {step.wait_days === 0 ? "Immediate" : `Wait ${step.wait_days} days`}
                                        </p>
                                    </div>
                                    {activeStepIndex === index && <ChevronRight className="h-4 w-4 opacity-50" />}
                                </button>
                            ))}

                            <Button
                                variant="ghost"
                                className="w-full justify-start text-muted-foreground hover:text-primary mt-2"
                                onClick={() => {
                                    const newStep: CampaignStep = {
                                        step_number: activeCampaign.sequence.length + 1,
                                        wait_days: 2,
                                        step_summary: "Follow-up",
                                        variations: [{ variation_id: `var_${Date.now()}`, subject: "", body: "" }]
                                    };
                                    setCampaigns(prev => prev.map(c => c.id === activeCampaign.id ? { ...c, sequence: [...c.sequence, newStep] } : c));
                                    setActiveStepIndex(activeCampaign.sequence.length);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Step
                            </Button>
                        </div>
                    </div>

                    {/* Main Content: Email Editor */}
                    <div className="flex-1 overflow-y-auto bg-background p-8">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {activeCampaign.sequence[activeStepIndex] && (
                                <>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-base font-medium">Step Settings</Label>
                                            <div className="flex items-center gap-2">
                                                <Label className="text-sm text-muted-foreground">Wait Days:</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    className="w-20 h-8"
                                                    value={activeCampaign.sequence[activeStepIndex].wait_days}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setCampaigns(prev => prev.map(c => {
                                                            if (c.id !== activeCampaign.id) return c;
                                                            const newSeq = [...c.sequence];
                                                            newSeq[activeStepIndex] = { ...newSeq[activeStepIndex], wait_days: val };
                                                            return { ...c, sequence: newSeq };
                                                        }));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="subject">Subject Line</Label>
                                        <Input
                                            id="subject"
                                            placeholder="Enter email subject..."
                                            className="text-lg font-medium"
                                            value={activeCampaign.sequence[activeStepIndex].variations[0].subject}
                                            onChange={(e) => {
                                                setCampaigns(prev => prev.map(c => {
                                                    if (c.id !== activeCampaign.id) return c;
                                                    const newSeq = [...c.sequence];
                                                    const newVars = [...newSeq[activeStepIndex].variations];
                                                    newVars[0] = { ...newVars[0], subject: e.target.value };
                                                    newSeq[activeStepIndex] = { ...newSeq[activeStepIndex], variations: newVars };
                                                    return { ...c, sequence: newSeq };
                                                }));
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="body">Email Body</Label>
                                        <div className="border rounded-md shadow-sm focus-within:ring-1 focus-within:ring-ring">
                                            {/* Simple Toolbar Placeholder */}
                                            <div className="flex items-center gap-1 p-2 border-b bg-muted/20 text-muted-foreground">
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><span className="font-bold">B</span></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><span className="italic">I</span></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><span className="underline">U</span></Button>
                                                <div className="w-px h-4 bg-border mx-1" />
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-xs">{"{ }"}</Button>
                                            </div>
                                            <Textarea
                                                id="body"
                                                placeholder="Hi {{first_name}}, ..."
                                                className="min-h-[400px] border-0 focus-visible:ring-0 resize-none p-4 font-mono text-sm leading-relaxed"
                                                value={activeCampaign.sequence[activeStepIndex].variations[0].body}
                                                onChange={(e) => {
                                                    setCampaigns(prev => prev.map(c => {
                                                        if (c.id !== activeCampaign.id) return c;
                                                        const newSeq = [...c.sequence];
                                                        const newVars = [...newSeq[activeStepIndex].variations];
                                                        newVars[0] = { ...newVars[0], body: e.target.value };
                                                        newSeq[activeStepIndex] = { ...newSeq[activeStepIndex], variations: newVars };
                                                        return { ...c, sequence: newSeq };
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground text-right">
                                            Supports liquid syntax variables like {"{{first_name}}"}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: LIST VIEW ---

    // Check for loading state (Phase 3 generation)
    const isGenerating = workflowStatus === 'validating_report' || workflowStatus === 'creating_campaigns';

    if (isGenerating) {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
                <div className="relative flex items-center justify-center">
                    <div className="absolute h-24 w-24 rounded-full border-4 border-primary opacity-75 animate-ping"></div>
                    <div className="relative h-24 w-24 rounded-full border-4 border-primary animate-pulse">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/50"></div>
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold">Generating Campaign Blueprints</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Our AI is crafting high-converting email sequences based on your selected ICPs. This typically takes 2-3 minutes.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Campaigns</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage your outreach campaigns and sequences
                    </p>
                </div>
                <Button onClick={handleCreateCampaign}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Campaign
                </Button>
            </div>

            {campaigns.length === 0 ? (
                // Empty State
                <div className="flex flex-col items-center justify-center py-16 space-y-6 border-2 border-dashed rounded-xl bg-muted/5">
                    <div className="p-6 rounded-full bg-primary/5">
                        <Mail className="h-10 w-10 text-primary/60" />
                    </div>
                    <div className="text-center max-w-md space-y-2">
                        <h3 className="text-lg font-semibold">No campaigns yet</h3>
                        <p className="text-sm text-muted-foreground">
                            Create a new campaign manually or generate one from your ICPs to get started.
                        </p>
                    </div>
                    <Button onClick={handleCreateCampaign} size="lg">
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Campaign
                    </Button>
                </div>
            ) : (
                // Campaign Table
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="w-[50px]">
                                    <Checkbox />
                                </TableHead>
                                <TableHead className="w-[300px]">NAME</TableHead>
                                <TableHead>STATUS</TableHead>
                                <TableHead>PROGRESS</TableHead>
                                <TableHead className="text-right">SENT</TableHead>
                                <TableHead className="text-right">CLICK</TableHead>
                                <TableHead className="text-right">REPLIED</TableHead>
                                <TableHead className="text-right">OPPORTUNITIES</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {campaigns.map((campaign) => (
                                <TableRow key={campaign.id} className="group">
                                    <TableCell>
                                        <Checkbox />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium truncate max-w-[250px]" title={campaign.name}>
                                                {campaign.name}
                                            </span>
                                            {campaign.target_profile && (
                                                <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                                    {campaign.target_profile}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={campaign.status === 'active' ? 'default' : 'secondary'}
                                            className="capitalize font-normal"
                                        >
                                            {campaign.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-primary w-[0%]"></div>
                                            </div>
                                            <span className="text-xs text-muted-foreground">0%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">0</TableCell>
                                    <TableCell className="text-right font-mono text-sm">0</TableCell>
                                    <TableCell className="text-right font-mono text-sm">0</TableCell>
                                    <TableCell className="text-right font-mono text-sm">-</TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50">
                                                <Play className="h-4 w-4" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setEditingCampaignId(campaign.id)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit Sequence
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCampaign(campaign.id)}>
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
