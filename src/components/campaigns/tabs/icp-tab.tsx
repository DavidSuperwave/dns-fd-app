"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, Target, Users, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function IcpTab({ campaign }: { campaign: any }) {
    const [icpData, setIcpData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClientComponentClient();

    useEffect(() => {
        async function fetchIcpData() {
            try {
                // Assuming campaign.project_id links to company_profiles.id or similar
                // Or we fetch company_profiles where id = campaign.project_id
                if (!campaign?.project_id) return;

                const { data: profile, error } = await supabase
                    .from("company_profiles")
                    .select("company_report")
                    .eq("id", campaign.project_id)
                    .single();

                if (error) {
                    // If not found by ID, maybe try user_id logic or just log error
                    console.error("Error fetching company profile:", error);
                }

                if (profile?.company_report?.phase_data) {
                    // Look for ICP data in phase_data
                    // Common keys: phase_2_icp_creation, phase_2, etc.
                    const phaseData = profile.company_report.phase_data;
                    const icpPhase = phaseData["phase_2_icp_creation"] || phaseData["phase_2"];

                    if (icpPhase) {
                        setIcpData(icpPhase);
                    }
                }
            } catch (error) {
                console.error("Error fetching ICP data:", error);
            } finally {
                setLoading(false);
            }
        }

        if (campaign?.project_id) {
            fetchIcpData();
        } else {
            setLoading(false);
        }
    }, [campaign?.project_id, supabase]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Ideal Customer Profile</CardTitle>
                    <CardDescription>Target audience definition for this campaign</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !icpData ? (
                        <div className="text-center p-8 text-muted-foreground">
                            No ICP data found linked to this project.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {icpData.icp_reports && Array.isArray(icpData.icp_reports) ? (
                                <div className="grid gap-6 md:grid-cols-2">
                                    {icpData.icp_reports.map((icp: any, index: number) => (
                                        <Card key={index} className="border-muted">
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start">
                                                    <CardTitle className="text-lg">{icp.role || icp.title || `ICP #${index + 1}`}</CardTitle>
                                                    <Badge variant="outline">{icp.industry || "General"}</Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4 text-sm">
                                                <div>
                                                    <span className="font-semibold text-muted-foreground">Pain Points:</span>
                                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                                        {Array.isArray(icp.pain_points) && icp.pain_points.slice(0, 3).map((point: string, i: number) => (
                                                            <li key={i}>{point}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-muted-foreground">Value Prop:</span>
                                                    <p className="mt-1">{icp.value_proposition || icp.value_prop}</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="prose prose-sm max-w-none">
                                    <pre className="bg-muted p-4 rounded-md overflow-auto">
                                        {JSON.stringify(icpData, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
