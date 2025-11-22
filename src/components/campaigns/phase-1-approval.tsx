"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2, Edit2, Save, X, Download } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";

interface Phase1ApprovalProps {
    projectId: string;
    companyProfileId: string;
    reportData: any;
    onApprove: () => void;
}

export function Phase1Approval({ projectId, companyProfileId, reportData, onApprove }: Phase1ApprovalProps) {
    const [isApproving, setIsApproving] = useState(false);
    const [localReportData, setLocalReportData] = useState(reportData);
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const router = useRouter();

    const handleApprove = async () => {
        setIsApproving(true);
        try {
            // Call API to approve (but NOT start Phase 2 yet)
            // Send the localReportData which might have been edited
            const response = await fetch(`/api/company-profiles/${companyProfileId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    updatedReportData: localReportData
                })
            });

            if (!response.ok) {
                throw new Error('Failed to approve report');
            }

            toast.success("Report approved! Proceed to workspace setup.");
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

    const startEditing = (section: string, initialValue: string | any) => {
        setEditingSection(section);
        // If it's an object (like value prop), we might need to stringify it or handle it differently
        // For now, let's assume we are editing the "summary" or main text fields
        // If it's a list, we'll join it with newlines
        if (Array.isArray(initialValue)) {
            setEditValue(initialValue.join('\n'));
        } else if (typeof initialValue === 'object') {
            setEditValue(JSON.stringify(initialValue, null, 2));
        } else {
            setEditValue(initialValue || "");
        }
    };

    const saveEdit = (section: string, path: string[]) => {
        // Update local state
        const newData = { ...localReportData };
        let current = newData;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }

        // Handle array conversion if needed (e.g. for key differentiators)
        if (path[path.length - 1] === 'key_differentiators') {
            current[path[path.length - 1]] = editValue.split('\n').filter(line => line.trim() !== '');
        } else {
            current[path[path.length - 1]] = editValue;
        }

        setLocalReportData(newData);
        setEditingSection(null);
        toast.success("Section updated locally. Approve report to save permanently.");
    };

    const cancelEdit = () => {
        setEditingSection(null);
        setEditValue("");
    };

    if (!localReportData) {
        return (
            <Card className="border-yellow-500/50 bg-yellow-500/10">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <CardTitle className="text-yellow-600">Report Generation Failed or Incomplete</CardTitle>
                    </div>
                    <div className="space-y-4">
                        <p className="text-sm text-yellow-700">The Phase 1 report data is missing. This might be due to a webhook failure.</p>
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
                    </div>
                </CardHeader>
            </Card>
        );
    }

    const { client_offer_brief, market_competitive_analysis, core_value_proposition } = localReportData;

    // Helper for editable section
    const EditableSection = ({ title, content, sectionKey, path, isList = false }: { title: string, content: any, sectionKey: string, path: string[], isList?: boolean }) => {
        const isEditing = editingSection === sectionKey;

        return (
            <div className="group relative border-l-2 border-transparent hover:border-primary/20 pl-4 transition-colors py-2">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{title}</h4>
                    {!isEditing && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                            onClick={() => startEditing(sectionKey, content)}
                        >
                            <Edit2 className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-2">
                        <Textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="min-h-[100px] text-sm"
                        />
                        <div className="flex items-center gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 text-xs">
                                <X className="mr-1 h-3 w-3" /> Cancel
                            </Button>
                            <Button size="sm" onClick={() => saveEdit(sectionKey, path)} className="h-7 text-xs">
                                <Save className="mr-1 h-3 w-3" /> Save
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm leading-relaxed text-foreground/90">
                        {isList ? (
                            <ul className="list-disc list-inside space-y-1">
                                {Array.isArray(content) ? content.map((item: string, i: number) => (
                                    <li key={i}>{item}</li>
                                )) : <li>{String(content)}</li>}
                            </ul>
                        ) : (
                            <p className="whitespace-pre-wrap">{String(content || "N/A")}</p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const handleDownload = () => {
        if (!localReportData) return;

        const { client_offer_brief, market_competitive_analysis, core_value_proposition } = localReportData;

        const textContent = `COMPANY STRATEGY REPORT
Generated on ${new Date().toLocaleDateString()}

1. CLIENT & OFFER BRIEF
-----------------------
Company Name: ${client_offer_brief?.company_name || 'N/A'}
Tagline: ${client_offer_brief?.tagline || 'N/A'}

Executive Summary:
${client_offer_brief?.summary || 'N/A'}


2. MARKET ANALYSIS
------------------
Primary Niche: ${market_competitive_analysis?.market_overview?.primary_niche || 'N/A'}
Market Size: ${market_competitive_analysis?.market_overview?.market_size_usd || 'N/A'}

Competitive Landscape:
${market_competitive_analysis?.competitive_landscape?.summary || 'N/A'}


3. CORE VALUE PROPOSITION
-------------------------
Value Summary:
${core_value_proposition?.summary || 'N/A'}

Key Differentiators:
${Array.isArray(core_value_proposition?.key_differentiators)
                ? core_value_proposition.key_differentiators.map((d: string) => `- ${d}`).join('\n')
                : (core_value_proposition?.key_differentiators || 'N/A')}
`;

        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${client_offer_brief?.company_name || 'company'}_strategy_report.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Company Strategy Report</h2>
                    <p className="text-muted-foreground mt-1">
                        Review and refine your generated company strategy before proceeding.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Report
                    </Button>
                    <Button onClick={handleApprove} disabled={isApproving} size="lg" className="shadow-lg">
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
            </div>

            {/* Document Content */}
            <div className="bg-card rounded-xl shadow-sm border p-8 space-y-12">

                {/* Section 1: Client & Offer Brief */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b pb-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">1</div>
                        <h3 className="text-xl font-semibold">Client & Offer Brief</h3>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <EditableSection
                            title="Company Name"
                            content={client_offer_brief?.company_name}
                            sectionKey="company_name"
                            path={['client_offer_brief', 'company_name']}
                        />
                        <EditableSection
                            title="Tagline"
                            content={client_offer_brief?.tagline}
                            sectionKey="tagline"
                            path={['client_offer_brief', 'tagline']}
                        />
                    </div>
                    <EditableSection
                        title="Executive Summary"
                        content={client_offer_brief?.summary}
                        sectionKey="brief_summary"
                        path={['client_offer_brief', 'summary']}
                    />
                </section>

                {/* Section 2: Market Analysis */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b pb-2">
                        <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">2</div>
                        <h3 className="text-xl font-semibold">Market Analysis</h3>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <EditableSection
                            title="Primary Niche"
                            content={market_competitive_analysis?.market_overview?.primary_niche}
                            sectionKey="primary_niche"
                            path={['market_competitive_analysis', 'market_overview', 'primary_niche']}
                        />
                        <EditableSection
                            title="Market Size"
                            content={market_competitive_analysis?.market_overview?.market_size_usd}
                            sectionKey="market_size"
                            path={['market_competitive_analysis', 'market_overview', 'market_size_usd']}
                        />
                    </div>
                    <EditableSection
                        title="Competitive Landscape"
                        content={market_competitive_analysis?.competitive_landscape?.summary}
                        sectionKey="comp_landscape"
                        path={['market_competitive_analysis', 'competitive_landscape', 'summary']}
                    />
                </section>

                {/* Section 3: Value Proposition */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b pb-2">
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold">3</div>
                        <h3 className="text-xl font-semibold">Core Value Proposition</h3>
                    </div>

                    <EditableSection
                        title="Value Summary"
                        content={core_value_proposition?.summary}
                        sectionKey="value_summary"
                        path={['core_value_proposition', 'summary']}
                    />

                    <EditableSection
                        title="Key Differentiators"
                        content={core_value_proposition?.key_differentiators}
                        sectionKey="key_diffs"
                        path={['core_value_proposition', 'key_differentiators']}
                        isList={true}
                    />
                </section>
            </div>
        </div>
    );
}
