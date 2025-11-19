"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, Mail, Sparkles } from "lucide-react";
import { EmailCampaignsTable } from "../email-campaigns-table";
import { toast } from "sonner";

interface EmailCopyTabProps {
    projectId: string;
    workspaceType: "standard" | "custom";
}

export function EmailCopyTab({ projectId, workspaceType }: EmailCopyTabProps) {
    const [icps, setIcps] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [selectedIcp, setSelectedIcp] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const supabase = createClientComponentClient();

    useEffect(() => {
        fetchIcps();
        fetchCampaigns();
    }, [projectId]);

    async function fetchIcps() {
        try {
            // Fetch ICPs from company_profiles
            const { data: profile, error } = await supabase
                .from("company_profiles")
                .select("company_report")
                .eq("id", projectId)
                .single();

            if (error) throw error;

            const phaseData = profile?.company_report?.phase_data || {};
            const icpPhase = phaseData["phase_2_icp_report"] || phaseData["phase_2_icp_creation"] || phaseData["phase_2"];

            if (icpPhase?.icp_reports) {
                setIcps(icpPhase.icp_reports);
            } else if (Array.isArray(icpPhase)) {
                setIcps(icpPhase);
            } else if (icpPhase) {
                // Handle single object legacy format by wrapping in array
                setIcps([icpPhase]);
            }
        } catch (error) {
            console.error("Error fetching ICPs:", error);
        } finally {
            setLoading(false);
        }
    }

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
        } catch (error) {
            console.error("Error fetching campaigns:", error);
        }
    }

    async function handleGenerateEmailCopy() {
        if (!selectedIcp) {
            toast.error("Please select an ICP first");
            return;
        }

        setGenerating(true);
        try {
            // TODO: Trigger Manus Phase 3 or create campaign directly
            toast.success("Email copy generation started");
            // Refresh campaigns after generation
            await fetchCampaigns();
        } catch (error) {
            toast.error("Failed to generate email copy");
        } finally {
            setGenerating(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* ICP Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Generate Email Copy</CardTitle>
                    <CardDescription>
                        Select an ICP to generate personalized email sequences
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : icps.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No ICPs available yet.</p>
                            <p className="text-sm mt-2">Complete Phase 2 (ICP Creation) to generate email copy.</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <h4 className="text-sm font-medium mb-3">Select Target Audience</h4>
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    {icps.map((icp, index) => {
                                        // Handle both new schema (icp_reports array) and potential old schema
                                        const icpId = icp.icp_id || `icp_${index}`;
                                        const icpName = icp.icp_name || icp.role || "Untitled ICP";

                                        // Extract pain points from sub-niches or direct property
                                        let painPoints: string[] = [];
                                        if (icp.sub_niches && Array.isArray(icp.sub_niches)) {
                                            icp.sub_niches.forEach((niche: any) => {
                                                if (niche.pain_points_and_challenges) {
                                                    painPoints.push(...niche.pain_points_and_challenges);
                                                }
                                            });
                                        } else if (icp.pain_points) {
                                            painPoints = icp.pain_points;
                                        }

                                        // Deduplicate and limit pain points
                                        painPoints = Array.from(new Set(painPoints)).slice(0, 3);

                                        return (
                                            <Card
                                                key={index}
                                                className={`cursor-pointer transition-all h-full flex flex-col ${selectedIcp === icpId
                                                    ? "border-primary ring-2 ring-primary bg-primary/5"
                                                    : "hover:border-primary/50"
                                                    }`}
                                                onClick={() => setSelectedIcp(icpId)}
                                            >
                                                <CardHeader className="pb-2 p-4">
                                                    <CardTitle className="text-sm font-bold leading-tight">{icpName}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0 flex-1">
                                                    {painPoints.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Top Pain Points</p>
                                                            <ul className="space-y-1">
                                                                {painPoints.map((point, i) => (
                                                                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                                                        <span className="mt-0.5 block h-1 w-1 rounded-full bg-red-400 shrink-0" />
                                                                        <span className="line-clamp-2">{point}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground italic">No specific pain points listed.</p>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>

                            <Button
                                onClick={handleGenerateEmailCopy}
                                disabled={!selectedIcp || generating}
                                size="lg"
                                className="w-full"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Generate Email Copy for Selected ICP
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Email Campaigns */}
            <Card>
                <CardHeader>
                    <CardTitle>Your Email Campaigns</CardTitle>
                    <CardDescription>Manage and edit your email sequences</CardDescription>
                </CardHeader>
                <CardContent>
                    {campaigns.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No email campaigns yet.</p>
                            <p className="text-sm mt-2">Generate your first campaign using the button above.</p>
                        </div>
                    ) : (
                        <EmailCampaignsTable campaigns={campaigns} onRefresh={fetchCampaigns} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
