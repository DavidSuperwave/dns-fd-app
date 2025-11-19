"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Phase1ApprovalProps {
    projectId: string;
    companyProfileId: string;
    reportData: any;
    onApprove: () => void;
}

export function Phase1Approval({ projectId, companyProfileId, reportData, onApprove }: Phase1ApprovalProps) {
    const [isApproving, setIsApproving] = useState(false);
    const router = useRouter();

    const handleApprove = async () => {
        setIsApproving(true);
        try {
            // Call API to advance phase
            const response = await fetch(`/api/company-profiles/${companyProfileId}/advance-phase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phaseData: reportData // Pass current data to next phase
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to approve report');
            }

            toast.success("Report approved! Starting Phase 2...");
            onApprove();

        } catch (error) {
            console.error("Error approving report:", error);
            toast.error("Failed to approve report");
        } finally {
            setIsApproving(false);
        }
    };

    const handleRetryFetch = async () => {
        setIsApproving(true); // Reuse loading state
        try {
            const response = await fetch(`/api/company-profiles/${companyProfileId}/fetch-manus-result`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch result');
            }

            toast.success("Result fetched successfully!");
            onApprove(); // Refresh parent
        } catch (error) {
            console.error("Error fetching result:", error);
            toast.error("Failed to fetch result. Please check logs.");
        } finally {
            setIsApproving(false);
        }
    };

    if (!reportData) {
        return (
            <Card className="border-yellow-500/50 bg-yellow-500/10">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <CardTitle className="text-yellow-600">Report Generation Failed or Incomplete</CardTitle>
                    </div>
                    <CardDescription className="space-y-4">
                        <p>The Phase 1 report data is missing. This might be due to a webhook failure.</p>
                        <Button onClick={handleRetryFetch} disabled={isApproving} variant="outline" className="bg-white/50 hover:bg-white/80">
                            {isApproving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Fetching...
                                </>
                            ) : (
                                "Retry Fetching Result"
                            )}
                        </Button>
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const { client_offer_brief, market_competitive_analysis, core_value_proposition } = reportData;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Review Company Report</h2>
                    <p className="text-muted-foreground">
                        Please review the generated strategy before proceeding to ICP generation.
                    </p>
                </div>
                <Button onClick={handleApprove} disabled={isApproving} size="lg">
                    {isApproving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Approving...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve & Continue
                        </>
                    )}
                </Button>
            </div>

            {/* Client & Offer Brief */}
            <Card>
                <CardHeader>
                    <CardTitle>Client & Offer Brief</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-sm text-muted-foreground">Company Name</h4>
                            <p>{client_offer_brief?.company_name || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-muted-foreground">Tagline</h4>
                            <p>{client_offer_brief?.tagline || "N/A"}</p>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Summary</h4>
                        <p className="text-sm mt-1">{client_offer_brief?.summary || "N/A"}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Market Analysis */}
            <Card>
                <CardHeader>
                    <CardTitle>Market Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-sm text-muted-foreground">Primary Niche</h4>
                            <p>{market_competitive_analysis?.market_overview?.primary_niche || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-muted-foreground">Market Size</h4>
                            <p>{market_competitive_analysis?.market_overview?.market_size_usd || "N/A"}</p>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Competitive Landscape</h4>
                        <p className="text-sm mt-1">{market_competitive_analysis?.competitive_landscape?.summary || "N/A"}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Value Proposition */}
            <Card>
                <CardHeader>
                    <CardTitle>Core Value Proposition</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-sm text-muted-foreground">Summary</h4>
                            <p className="text-sm mt-1">{core_value_proposition?.summary || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Key Differentiators</h4>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                {core_value_proposition?.key_differentiators?.map((diff: string, i: number) => (
                                    <li key={i}>{diff}</li>
                                )) || <li>N/A</li>}
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
