"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, Users, Target, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ICPsTabProps {
    projectId: string;
    companyProfileId?: string;
    icpData?: any;
}

export function ICPsTab({ projectId, companyProfileId, icpData }: ICPsTabProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedIcps, setSelectedIcps] = useState<string[]>([]);

    const handleGenerateICPs = async () => {
        if (!companyProfileId) {
            toast.error("Company profile not found");
            return;
        }

        setIsGenerating(true);
        try {
            // This endpoint triggers the next phase (Phase 2: ICPs)
            const response = await fetch(`/api/company-profiles/${companyProfileId}/advance-phase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetPhase: 'phase_2_icp_report'
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start ICP generation');
            }

            toast.success("ICP generation started. This may take a few minutes.");
            // In a real app, we'd poll for status or use a subscription
        } catch (error) {
            console.error("Error generating ICPs:", error);
            toast.error("Failed to start ICP generation");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateCampaigns = async () => {
        if (!companyProfileId) {
            toast.error("Company profile not found");
            return;
        }

        if (selectedIcps.length === 0) {
            toast.error("Please select at least one ICP");
            return;
        }

        setIsGenerating(true);
        try {
            // Trigger Phase 3 with selected ICPs
            const response = await fetch(`/api/company-profiles/${companyProfileId}/advance-phase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetPhase: 'phase_3_campaigns',
                    additionalData: {
                        selectedIcpIds: selectedIcps
                    }
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start campaign generation');
            }

            toast.success(`Campaign generation started for ${selectedIcps.length} ICPs.`);
        } catch (error) {
            console.error("Error generating campaigns:", error);
            toast.error("Failed to start campaign generation");
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleIcpSelection = (icpId: string) => {
        setSelectedIcps(prev =>
            prev.includes(icpId)
                ? prev.filter(id => id !== icpId)
                : [...prev, icpId]
        );
    };

    const handleSelectAll = () => {
        if (icpData?.icp_reports) {
            if (selectedIcps.length === icpData.icp_reports.length) {
                setSelectedIcps([]);
            } else {
                setSelectedIcps(icpData.icp_reports.map((icp: any) => icp.icp_id));
            }
        }
    };

    // Check if we have valid ICP data
    // Handle both old schema (single object) and new schema (array of reports)
    console.log('[ICPsTab] Received icpData:', icpData);
    const icpReports = icpData?.icp_reports || (icpData ? [icpData] : []);
    console.log('[ICPsTab] Parsed icpReports:', icpReports);
    const hasICPs = icpReports.length > 0;

    if (!hasICPs) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center border-2 border-dashed rounded-lg bg-muted/10">
                <div className="p-4 rounded-full bg-primary/10">
                    <Users className="h-8 w-8 text-primary" />
                </div>
                <div className="max-w-md space-y-2">
                    <h3 className="text-lg font-semibold">No Ideal Customer Profiles Yet</h3>
                    <p className="text-sm text-muted-foreground">
                        Generate detailed Ideal Customer Profiles (ICPs) based on your company report to target the right audience.
                    </p>
                </div>
                <Button onClick={handleGenerateICPs} disabled={isGenerating}>
                    {isGenerating ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating ICPs...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Generate ICPs
                        </>
                    )}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Ideal Customer Profiles</h2>
                    <p className="text-sm text-muted-foreground">
                        Select ICPs to target in your campaigns ({selectedIcps.length} selected)
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                        {selectedIcps.length === icpReports.length ? "Deselect All" : "Select All"}
                    </Button>
                    <Button disabled={selectedIcps.length === 0 || isGenerating} onClick={handleGenerateCampaigns}>
                        {isGenerating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                Generate Campaigns for Selected
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {icpReports.map((icp: any, index: number) => {
                    const icpId = icp.icp_id || `icp_${index}`;
                    const isSelected = selectedIcps.includes(icpId);

                    return (
                        <Card key={icpId} className={`flex flex-col h-full transition-all border-2 ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted'}`}>
                            <CardHeader className="relative pb-2">
                                <div className="absolute top-4 right-4">
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleIcpSelection(icpId)}
                                    />
                                </div>
                                <div className="flex items-start justify-between pr-8">
                                    <Badge variant={isSelected ? "default" : "secondary"} className="mb-2">
                                        ICP {index + 1}
                                    </Badge>
                                </div>
                                <CardTitle className="text-lg leading-tight">{icp.icp_name || icp.role || "Untitled ICP"}</CardTitle>
                                <CardDescription className="line-clamp-3 text-xs mt-1">
                                    {icp.icp_summary || icp.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-4 pt-2">
                                {icp.firmographics && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Firmographics</p>
                                        <div className="flex flex-wrap gap-1">
                                            {icp.firmographics.industries?.slice(0, 3).map((ind: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-5">{ind}</Badge>
                                            ))}
                                            {icp.firmographics.company_size_employees && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                                    {Array.isArray(icp.firmographics.company_size_employees)
                                                        ? icp.firmographics.company_size_employees.join('-')
                                                        : icp.firmographics.company_size_employees} emps
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {icp.sub_niches && icp.sub_niches.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sub-Niches</p>
                                        <ul className="space-y-2">
                                            {icp.sub_niches.map((niche: any, i: number) => (
                                                <li key={i} className="text-sm bg-background p-2 rounded border shadow-sm">
                                                    <div className="font-medium flex items-center gap-2 text-xs">
                                                        <Target className="h-3 w-3 text-primary shrink-0" />
                                                        {niche.sub_niche_name}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Fallback for old schema or if sub_niches missing but pain points exist */}
                                {!icp.sub_niches && icp.pain_points && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pain Points</p>
                                        <ul className="list-disc list-inside text-xs text-muted-foreground">
                                            {icp.pain_points.slice(0, 3).map((pp: string, i: number) => (
                                                <li key={i} className="line-clamp-1">{pp}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
