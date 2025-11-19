"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building2, FileText, CheckCircle2, UserCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { parseManusReportPayload, hasManusReportShape } from "@/lib/manus-result-parser";

// Mock company report data (what Manus AI would output)
const mockCompanyReport = {
  companyName: "Acme Corp",
  industry: "B2B SaaS",
  overview: {
    description: "Acme Corp is a leading provider of enterprise software solutions, specializing in workflow automation and business intelligence tools.",
    founded: "2018",
    headquarters: "San Francisco, CA",
    employees: "150-200",
    revenue: "$10M - $50M"
  },
  targetMarket: {
    primary: "Mid-market B2B companies (50-500 employees)",
    secondary: "Enterprise organizations seeking automation solutions",
    industries: ["Technology", "Financial Services", "Healthcare", "Manufacturing"]
  },
  valueProposition: {
    keyPoints: [
      "Reduces manual workflow by 80%",
      "Integrates with 200+ business tools",
      "ROI visible within 90 days",
      "24/7 customer support"
    ]
  },
  pricing: {
    model: "Subscription-based",
    tiers: [
      { name: "Starter", price: "$99/month", features: ["Up to 10 users", "Basic automation", "Email support"] },
      { name: "Professional", price: "$299/month", features: ["Up to 50 users", "Advanced automation", "Priority support"] },
      { name: "Enterprise", price: "Custom", features: ["Unlimited users", "Custom integrations", "Dedicated account manager"] }
    ]
  },
  competitors: [
    {
      name: "WorkflowPro",
      strengths: ["Market leader", "Large customer base"],
      weaknesses: ["Higher pricing", "Complex setup"]
    },
    {
      name: "AutoFlow",
      strengths: ["Lower pricing", "Easy to use"],
      weaknesses: ["Limited integrations", "Smaller team"]
    }
  ],
  recommendations: [
    "Focus on mid-market segment with clear ROI messaging",
    "Emphasize integration capabilities in marketing",
    "Develop case studies highlighting 90-day ROI",
    "Target decision-makers in IT and Operations departments"
  ]
};

export default function ProjectReportPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [project, setProject] = useState<any>(null);
  const [companyReport, setCompanyReport] = useState<any>(null);
  const [rawPhase1Report, setRawPhase1Report] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const normalizePhaseReport = async (report: any) => {
    if (!report) {
      return { raw: null, normalized: null };
    }

    let rawReport = report;

    if (typeof rawReport === 'string') {
      try {
        rawReport = JSON.parse(rawReport);
      } catch (error) {
        console.warn('[Report Page] Failed to parse report string:', error);
      }
    }

    try {
      const parsedReport = await parseManusReportPayload(rawReport);
      if (parsedReport) {
        return { raw: rawReport, normalized: parsedReport };
      }
    } catch (error) {
      console.warn('[Report Page] Failed to normalize Manus report payload:', error);
    }

    return { raw: rawReport, normalized: rawReport };
  };

  // Fetch project and company profile data
  useEffect(() => {
    let isMounted = true; // Track if component is still mounted
    
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[Report Page] Fetched data:', data);
          
          if (!isMounted) return; // Don't update state if component unmounted
          
          setProject(data.project);
          if (data.project?.companyProfile?.workflow_status === 'completed') {
            setIsApproved(true);
          }
          if (data.project?.companyProfile) {
            const reportData = data.project.companyProfile.company_report;
            console.log('[Report Page] Full company profile:', data.project.companyProfile);
            console.log('[Report Page] Company report data:', reportData);
            console.log('[Report Page] Workflow status:', data.project.companyProfile.workflow_status);
            
            // Handle case where company_report might be a string (JSONB from Supabase)
            let parsedReportData = reportData;
            if (typeof reportData === 'string') {
              try {
                parsedReportData = JSON.parse(reportData);
                console.log('[Report Page] Parsed company_report from string');
              } catch (e) {
                console.warn('[Report Page] Failed to parse company_report:', e);
              }
            }
            
            console.log('[Report Page] Parsed report data:', parsedReportData);
            console.log('[Report Page] Phase data:', parsedReportData?.phase_data);
            console.log('[Report Page] Phase 1 data exists:', !!parsedReportData?.phase_data?.phase_1_company_report);
            
            // Check for Phase 1 report in phase_data
            if (parsedReportData?.phase_data?.phase_1_company_report) {
              let phase1Report = parsedReportData.phase_data.phase_1_company_report;
              
              // If it's a string, try to parse it as JSON
              if (typeof phase1Report === 'string') {
                try {
                  phase1Report = JSON.parse(phase1Report);
                } catch (e) {
                  console.warn('[Report Page] Failed to parse phase_1_company_report as JSON:', e);
                }
              }
              
              // Extract report from Manus message format: { id, role, type, status, content: [{ text }] }
              if (phase1Report && typeof phase1Report === 'object' && !Array.isArray(phase1Report)) {
                // Check if it's a Manus message object with content array
                if (Array.isArray(phase1Report.content) && phase1Report.content.length > 0) {
                  const firstContent = phase1Report.content[0];
                  
                  // Extract text from content
                  if (firstContent && firstContent.text) {
                    const text = firstContent.text;
                    
                    // Try to parse as JSON directly
                    try {
                      const parsed = JSON.parse(text);
                      if (parsed && typeof parsed === 'object' && parsed.company_overview) {
                        phase1Report = parsed;
                      }
                    } catch (e) {
                      // If not JSON, look for JSON in markdown code blocks
                      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                                       text.match(/```\s*([\s\S]*?)\s*```/);
                      if (jsonMatch && jsonMatch[1]) {
                        try {
                          const parsed = JSON.parse(jsonMatch[1]);
                          if (parsed && typeof parsed === 'object' && parsed.company_overview) {
                            phase1Report = parsed;
                          }
                        } catch (parseError) {
                          console.warn('[Report Page] Failed to parse JSON from code block');
                        }
                      }
                    }
                  } else if (firstContent && typeof firstContent === 'object' && firstContent.company_overview) {
                    // Content item itself is the report
                    phase1Report = firstContent;
                  }
                }
              }
              
              // If it's an array, find the report object
              if (Array.isArray(phase1Report)) {
                const reportObject = phase1Report.find((item: any) => 
                  item && typeof item === 'object' && !Array.isArray(item) && item.company_overview
                );
                if (reportObject) {
                  phase1Report = reportObject;
                } else if (phase1Report.length > 0 && typeof phase1Report[0] === 'object') {
                  phase1Report = phase1Report[0];
                }
              }
              
              const { raw, normalized } = await normalizePhaseReport(phase1Report);
              if (isMounted) {
                setRawPhase1Report(raw);
                setCompanyReport(normalized);
              }
            } else {
              console.warn('[Report Page] No phase_1_company_report found');
              console.warn('[Report Page] Available keys in phase_data:', parsedReportData?.phase_data ? Object.keys(parsedReportData.phase_data) : 'no phase_data');
              if (isMounted) {
                setRawPhase1Report(null);
                setCompanyReport(null);
              }
            }
          } else {
            console.warn('[Report Page] No company profile found');
            if (isMounted) {
              setRawPhase1Report(null);
              setCompanyReport(null);
            }
          }
        } else {
          console.error('[Report Page] API error:', response.status);
          if (isMounted) {
            toast.error('Failed to load project data');
            setRawPhase1Report(null);
            setCompanyReport(null);
          }
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        if (isMounted) {
          toast.error('Failed to load project data');
          setRawPhase1Report(null);
          setCompanyReport(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (projectId) {
      fetchData();
    }
    
    return () => {
      isMounted = false; // Cleanup
    };
  }, [projectId]);

  const handleApprove = async () => {
    if (!project?.companyProfile?.id) {
      toast.error('Company profile not found');
      return;
    }

    setIsApproving(true);
    try {
      const response = await fetch(`/api/company-profiles/${project.companyProfile.id}/approve-report`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark report as completed');
      }

      setIsApproved(true);
      setProject((prev: any) => {
        if (!prev?.companyProfile) return prev;
        return {
          ...prev,
          companyProfile: {
            ...prev.companyProfile,
            workflow_status: data.workflow_status || 'completed',
            company_report: {
              ...prev.companyProfile.company_report,
              phase_1_approved_at: data.approved_at || new Date().toISOString(),
            },
          },
        };
      });
      toast.success('Company report marked as completed. Redirecting to campaign workspace...');
      setTimeout(() => {
        router.push(`/projects/${projectId}/campaign`);
      }, 600);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve report');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!project?.companyProfile?.id || !feedback.trim()) {
      toast.error('Please provide feedback for regeneration');
      return;
    }

    setIsRegenerating(true);
    try {
      // TODO: Implement regenerate report API
      // For now, just show a message
      toast.info('Regenerate functionality coming soon');
    } catch (error) {
      toast.error('Failed to regenerate report');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Use real data or fallback to mock (only if we're not loading and have no real data)
  // Don't use mock data - only show real data or empty state
  const structuredReport = companyReport && hasManusReportShape(companyReport) ? companyReport : null;
  const reportData = structuredReport;
  const rawContentItems = Array.isArray(rawPhase1Report?.content) ? rawPhase1Report.content : [];
  const hasRawContent = rawContentItems.length > 0;
  const projectName = project?.name || project?.companyProfile?.client_name || 'Loading...';

  const renderRawReportPreview = () => {
    if (!hasRawContent) return null;

    return (
      <div className="text-left mt-6 space-y-4 rounded-lg border border-dashed border-muted-foreground/40 p-4 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Raw Manus output</p>
        {rawContentItems.map((item: any, idx: number) => {
          if (item?.type === 'output_text' && item.text) {
            return (
              <div key={`raw_text_${idx}`} className="bg-background/80 rounded-md p-3 border">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                  {item.text}
                </pre>
              </div>
            );
          }

          if (item?.type === 'output_file' && (item.fileUrl || item.file_url || item.url)) {
            return (
              <div key={`raw_file_${idx}`} className="rounded-md border bg-background/60 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Structured JSON attachment detected</p>
                <p className="text-xs text-muted-foreground">
                  Superwave will automatically pull this data shortly. If you need it immediately, sync via the backend tools.
                </p>
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  };

  // Debug: Log what we're trying to render
  useEffect(() => {
    console.log('[Report Page] Report state snapshot:', {
      hasStructuredReport: !!structuredReport,
      structuredKeys: structuredReport ? Object.keys(structuredReport) : null,
      hasCompanyOverview: !!structuredReport?.company_overview,
      rawPhaseReportType: rawPhase1Report ? typeof rawPhase1Report : null,
      rawPhaseHasContent: Array.isArray(rawPhase1Report?.content),
    });
  }, [structuredReport, rawPhase1Report]);

  // Debug logging
  useEffect(() => {
    console.log('[Report Page] State update:', {
      hasCompanyReport: !!companyReport,
      companyReportType: typeof companyReport,
      companyReportKeys: companyReport ? Object.keys(companyReport) : null,
      companyReport,
      hasProject: !!project,
      projectCompanyProfile: project?.companyProfile,
      loading,
      reportData: !!reportData,
    });
  }, [companyReport, project, loading, reportData]);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/projects")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{projectName}</h1>
                <p className="text-sm text-muted-foreground">Company Report & Analysis</p>
              </div>
            </div>
          </div>
          {isApproved && (
            <Badge variant="default" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Approved
            </Badge>
          )}
        </div>

        {/* Main Content Area - Side by Side Layout */}
        <div className="flex-1 grid grid-cols-[1fr_400px] gap-4 overflow-hidden pt-4">
          {/* Left Side - Report Content */}
          <div className="overflow-y-auto pr-2">

            {/* Company Report */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <CardTitle className="text-lg">Company Report</CardTitle>
                    <Badge variant="outline" className="text-xs">Generated by Superwave AI</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : !reportData || (typeof reportData === 'object' && Object.keys(reportData).length === 0) ? (
                  <div className="text-center py-8 space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {hasRawContent ? 'Report data received – finishing parsing...' : 'Report is still being generated...'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {hasRawContent
                          ? 'We have raw Manus output available below. You can download it or try refreshing in a moment.'
                          : 'Please check back in a few moments.'}
                      </p>
                    </div>
                    {renderRawReportPreview()}
                    {reportData && (
                      <p className="text-xs text-red-500 mt-2">
                        Debug: reportData exists but is empty. Keys: {Object.keys(reportData).join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Overview Section - Manus Format */}
                    {reportData.company_overview && (
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold">Company Overview</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Company Name</p>
                            <p className="text-sm font-medium">{reportData.company_overview.company_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Industry</p>
                            <p className="text-sm font-medium">{reportData.company_overview.industry || 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Offering</p>
                          <p className="text-sm font-medium">{reportData.company_overview.offering || 'N/A'}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {reportData.company_overview.description || 'No description available'}
                        </p>
                        {reportData.company_overview.business_model && (
                          <div>
                            <p className="text-xs text-muted-foreground">Business Model</p>
                            <p className="text-sm">{reportData.company_overview.business_model}</p>
                          </div>
                        )}
                        {reportData.company_overview.value_proposition && (
                          <div>
                            <p className="text-xs text-muted-foreground">Value Proposition</p>
                            <p className="text-sm">{reportData.company_overview.value_proposition}</p>
                          </div>
                        )}
                        {reportData.company_overview.key_differentiators && reportData.company_overview.key_differentiators.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Key Differentiators</p>
                            <ul className="space-y-1">
                              {reportData.company_overview.key_differentiators.map((diff: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2 text-xs">
                                  <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                                  <span>{diff}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fallback to old format if company_overview doesn't exist */}
                    {!reportData.company_overview && (
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">Company Overview</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Industry</p>
                            <p className="text-sm font-medium">{reportData.industry || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Founded</p>
                            <p className="text-sm font-medium">{reportData.overview?.founded || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Employees</p>
                            <p className="text-sm font-medium">{reportData.overview?.employees || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                            <p className="text-sm font-medium">{reportData.overview?.revenue || 'N/A'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                          {reportData.overview?.description || reportData.description || 'No description available'}
                  </p>
                </div>
                    )}

                {/* Target Market Analysis - Manus Format */}
                {reportData.target_market_analysis && (
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">Target Market Analysis</h3>
                    {reportData.target_market_analysis.ideal_customer_profile && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Ideal Customer Profile</p>
                        <p className="text-sm">{reportData.target_market_analysis.ideal_customer_profile}</p>
                      </div>
                    )}
                    {reportData.target_market_analysis.market_size_and_opportunity && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Market Size & Opportunity</p>
                        <div className="space-y-1 text-xs">
                          {reportData.target_market_analysis.market_size_and_opportunity.global_market_size && (
                            <p><span className="font-medium">Global Market:</span> {reportData.target_market_analysis.market_size_and_opportunity.global_market_size}</p>
                          )}
                          {reportData.target_market_analysis.market_size_and_opportunity.sme_opportunity && (
                            <p><span className="font-medium">SME Opportunity:</span> {reportData.target_market_analysis.market_size_and_opportunity.sme_opportunity}</p>
                          )}
                          {reportData.target_market_analysis.market_size_and_opportunity.regional_opportunity && (
                            <p><span className="font-medium">Regional:</span> {reportData.target_market_analysis.market_size_and_opportunity.regional_opportunity}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {reportData.target_market_analysis.customer_pain_points_and_needs && reportData.target_market_analysis.customer_pain_points_and_needs.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Customer Pain Points</p>
                        <ul className="space-y-1">
                          {reportData.target_market_analysis.customer_pain_points_and_needs.map((pain: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-xs">
                              <span className="mt-0.5">•</span>
                              <span>{pain}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {reportData.target_market_analysis.buying_behavior_and_decision_making_process && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Buying Behavior</p>
                        <p className="text-sm">{reportData.target_market_analysis.buying_behavior_and_decision_making_process}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback to old format */}
                {!reportData.target_market_analysis && reportData.targetMarket && (
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">Target Market</h3>
                  <div className="space-y-1">
                      <p className="text-sm font-medium">Primary: {reportData.targetMarket.primary || reportData.targetMarket}</p>
                      {reportData.targetMarket.secondary && (
                        <p className="text-xs text-muted-foreground">Secondary: {reportData.targetMarket.secondary}</p>
                      )}
                      {reportData.targetMarket.industries && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                          {reportData.targetMarket.industries.map((industry: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{industry}</Badge>
                      ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Competitive Landscape - Manus Format */}
                {reportData.competitive_landscape && (
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">Competitive Landscape</h3>
                    {reportData.competitive_landscape.main_competitors && reportData.competitive_landscape.main_competitors.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Main Competitors</p>
                        <div className="space-y-2">
                          {reportData.competitive_landscape.main_competitors.map((competitor: any, idx: number) => (
                            <Card key={idx}>
                              <CardHeader className="pb-2 pt-3">
                                <CardTitle className="text-sm">{competitor.name}</CardTitle>
                                <CardDescription className="text-xs">{competitor.offering}</CardDescription>
                                {competitor.pricing && (
                                  <p className="text-xs font-medium text-foreground mt-1">{competitor.pricing}</p>
                                )}
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    {reportData.competitive_landscape.competitive_advantages && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Competitive Advantages</p>
                        {reportData.competitive_landscape.competitive_advantages.superwave && (
                          <div className="mb-2">
                            <p className="text-xs font-medium mb-1">Superwave:</p>
                            <ul className="space-y-0.5">
                              {reportData.competitive_landscape.competitive_advantages.superwave.map((adv: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-1 text-xs">
                                  <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                                  <span>{adv}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {reportData.competitive_landscape.market_positioning && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Market Positioning</p>
                        <p className="text-sm">{reportData.competitive_landscape.market_positioning}</p>
                      </div>
                    )}
                </div>
                )}

                {/* Fallback to old value proposition format */}
                {!reportData.competitive_landscape && reportData.valueProposition && (
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">Value Proposition</h3>
                  <ul className="space-y-1">
                      {(reportData.valueProposition.keyPoints || []).map((point: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-xs">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                )}

                {/* Marketing & Sales Recommendations - Manus Format */}
                {reportData.marketing_and_sales_recommendations && (
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">Marketing & Sales Recommendations</h3>
                    {reportData.marketing_and_sales_recommendations.messaging_and_positioning && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Messaging & Positioning</p>
                        <p className="text-sm">{reportData.marketing_and_sales_recommendations.messaging_and_positioning}</p>
                      </div>
                    )}
                    {reportData.marketing_and_sales_recommendations.channel_recommendations && reportData.marketing_and_sales_recommendations.channel_recommendations.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Channel Recommendations</p>
                        <ul className="space-y-1">
                          {reportData.marketing_and_sales_recommendations.channel_recommendations.map((channel: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-xs">
                              <UserCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <span>{channel}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {reportData.marketing_and_sales_recommendations.campaign_ideas && reportData.marketing_and_sales_recommendations.campaign_ideas.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Campaign Ideas</p>
                        <div className="space-y-2">
                          {reportData.marketing_and_sales_recommendations.campaign_ideas.map((campaign: any, idx: number) => (
                            <Card key={idx}>
                              <CardHeader className="pb-2 pt-3">
                                <CardTitle className="text-sm">{campaign.name}</CardTitle>
                                <CardDescription className="text-xs">{campaign.description}</CardDescription>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Strategic Recommendations - Manus Format */}
                {reportData.strategic_recommendations && (
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">Strategic Recommendations</h3>
                    {reportData.strategic_recommendations.actionable_insights_for_growth && reportData.strategic_recommendations.actionable_insights_for_growth.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Actionable Insights for Growth</p>
                        <ul className="space-y-1">
                          {reportData.strategic_recommendations.actionable_insights_for_growth.map((insight: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 p-2 bg-muted rounded text-xs">
                              <UserCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {reportData.strategic_recommendations.risk_factors_and_mitigation_strategies && reportData.strategic_recommendations.risk_factors_and_mitigation_strategies.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Risk Factors & Mitigation</p>
                        <div className="space-y-2">
                          {reportData.strategic_recommendations.risk_factors_and_mitigation_strategies.map((risk: any, idx: number) => (
                            <Card key={idx}>
                              <CardHeader className="pb-2 pt-3">
                                <CardTitle className="text-sm">Risk: {risk.risk}</CardTitle>
                                <CardDescription className="text-xs">Mitigation: {risk.mitigation}</CardDescription>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback to old pricing format */}
                {!reportData.marketing_and_sales_recommendations && reportData.pricing && (
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">Pricing Model</h3>
                    <p className="text-xs text-muted-foreground mb-2">{reportData.pricing.model || reportData.pricing}</p>
                    {reportData.pricing.tiers && (
                  <div className="grid grid-cols-3 gap-2">
                        {reportData.pricing.tiers.map((tier: any, idx: number) => (
                      <Card key={idx} className="border">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm">{tier.name}</CardTitle>
                          <CardDescription className="text-sm font-semibold text-foreground">
                            {tier.price}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul className="space-y-0.5 text-xs">
                                {(tier.features || []).map((feature: string, fIdx: number) => (
                              <li key={fIdx} className="flex items-start gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                    )}
                </div>
                )}

                {/* Fallback to old competitors format */}
                {!reportData.competitive_landscape && reportData.competitors && reportData.competitors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">Competitive Analysis</h3>
                  <div className="space-y-2">
                      {reportData.competitors.map((competitor: any, idx: number) => (
                      <Card key={idx}>
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm">{competitor.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 pt-0">
                            {competitor.strengths && (
                          <div>
                            <p className="text-xs font-medium text-green-600 mb-0.5">Strengths:</p>
                            <ul className="space-y-0.5">
                                  {competitor.strengths.map((strength: string, sIdx: number) => (
                                <li key={sIdx} className="text-xs text-muted-foreground flex items-start gap-1">
                                  <span className="mt-0.5">•</span>
                                  <span>{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                            )}
                            {competitor.weaknesses && (
                          <div>
                            <p className="text-xs font-medium text-orange-600 mb-0.5">Weaknesses:</p>
                            <ul className="space-y-0.5">
                                  {competitor.weaknesses.map((weakness: string, wIdx: number) => (
                                <li key={wIdx} className="text-xs text-muted-foreground flex items-start gap-1">
                                  <span className="mt-0.5">•</span>
                                  <span>{weakness}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                            )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                )}

                {/* Fallback to old recommendations format */}
                {!reportData.strategic_recommendations && reportData.recommendations && reportData.recommendations.length > 0 && (
                <div className="space-y-2 pb-4">
                  <h3 className="text-base font-semibold">Recommendations</h3>
                  <ul className="space-y-1.5">
                      {reportData.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 p-2 bg-muted rounded text-xs">
                        <UserCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                )}

                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Approval Section */}
          <div className="overflow-y-auto">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">Confirm Report</CardTitle>
                <CardDescription className="text-xs">
                  Review the deliverable. Approving marks Phase 1 as completed. ICP (Phase 2) will start later from the campaign workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Feedback Text Box */}
                <div className="space-y-2">
                  <Label htmlFor="feedback" className="text-sm">
                    Changes or concerns about this report?
                  </Label>
                  <Textarea
                    id="feedback"
                    placeholder="Enter any changes, corrections, or concerns about the report..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="min-h-[120px] text-sm"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                  {/* Regenerate button - shows when typing feedback */}
                  {feedback.trim().length > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="w-full"
                      size="default"
                    >
                      {isRegenerating ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate Report
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    onClick={handleApprove}
                    disabled={isApproving || isApproved || loading}
                    className="w-full"
                    size="default"
                  >
                    {isApproving ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Approving...
                      </>
                    ) : isApproved ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approved
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve Report
                      </>
                    )}
                  </Button>
                  
                  {!isApproved && (
                    <p className="text-xs text-muted-foreground text-center">
                      Approve the report to start Phase 2 (ICP Report)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

