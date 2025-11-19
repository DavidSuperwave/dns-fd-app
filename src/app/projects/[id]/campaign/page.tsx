"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { WorkspaceSelection } from "@/components/campaigns/workspace-selection";
import { CustomWorkspaceSetup } from "@/components/campaigns/custom-workspace-setup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Settings, BarChart3, Mail, Upload, MessageSquare, Globe } from "lucide-react";
import { toast } from "sonner";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Import tab components
import { PerformanceTab } from "@/components/campaigns/tabs/performance-tab-new";
import { EmailCopyTab } from "@/components/campaigns/tabs/email-copy-tab";
import { UploadLeadsTab } from "@/components/campaigns/tabs/upload-leads-tab";
import { RepliesTab } from "@/components/campaigns/tabs/replies-tab";
import { DomainsTab } from "@/components/campaigns/tabs/domains-tab-new";
import { Phase1Approval } from "@/components/campaigns/phase-1-approval";
import { CompanyLoadingStates } from "@/components/company/company-loading-states";

type WorkspaceType = "standard" | "custom" | null;

export default function CampaignPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>(null);
  const [showCustomSetup, setShowCustomSetup] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  // Auto-fetch Manus result if project is stuck in generating state
  useEffect(() => {
    if (!project || !project.company_profiles) return;

    const workflowStatus = project.company_profiles.workflow_status;
    const companyProfileId = project.company_profiles.id;

    // If stuck in generating/pending, try to fetch the result from Manus
    if ((workflowStatus === 'generating' || workflowStatus === 'pending') && companyProfileId) {
      console.log('[Campaign Page] Detected stuck project, attempting to fetch Manus result...');

      // Wait 2 seconds before attempting fetch to avoid race conditions
      const timer = setTimeout(() => {
        attemptManusDataFetch(companyProfileId);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [project]);

  async function attemptManusDataFetch(companyProfileId: string) {
    try {
      console.log('[Campaign Page] Fetching Manus result for company profile:', companyProfileId);

      const response = await fetch(`/api/company-profiles/${companyProfileId}/fetch-manus-result`, {
        method: 'POST',
      });

      if (response.ok) {
        console.log('[Campaign Page] Successfully fetched Manus result, refreshing project...');
        toast.success("Report data retrieved successfully");
        // Refresh the project to get updated status
        await fetchProject();
      } else {
        const error = await response.json();
        console.warn('[Campaign Page] Failed to fetch Manus result:', error);
        // Don't show error toast - the user can still use the manual button
      }
    } catch (error) {
      console.error('[Campaign Page] Error fetching Manus result:', error);
      // Silent fail - user can still use manual button
    }
  }

  async function fetchProject() {
    try {
      setLoading(true);

      // Step 1: Fetch Project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      console.log("Fetched project:", projectData);

      let fullProject = { ...projectData, company_profiles: null };

      // Step 2: Fetch Company Profile if linked
      if (projectData.company_profile_id) {
        const { data: profileData, error: profileError } = await supabase
          .from("company_profiles")
          .select("*")
          .eq("id", projectData.company_profile_id)
          .single();

        if (profileError) {
          console.error("Error fetching linked profile (likely RLS):", profileError);
          // Don't throw, just leave it null so we can show the error state
        } else {
          console.log("Fetched linked profile:", profileData);
          fullProject.company_profiles = profileData;
        }
      }

      setProject(fullProject);
      setWorkspaceType(fullProject.workspace_type || null);

    } catch (error) {
      console.error("Error fetching project:", error);
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectStandard() {
    try {
      const response = await fetch(`/api/projects/${projectId}/workspace-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'standard' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to configure workspace');
      }

      toast.success("Standard workspace configured");

      // Delay to ensure database update completes
      await new Promise(resolve => setTimeout(resolve, 500));

      setWorkspaceType("standard");
    } catch (error) {
      console.error("Error setting standard workspace:", error);
      toast.error("Failed to configure workspace");
    }
  }

  async function handleSelectCustom() {
    try {
      const response = await fetch(`/api/projects/${projectId}/workspace-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'custom' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to configure workspace');
      }

      // Delay to ensure database update completes
      await new Promise(resolve => setTimeout(resolve, 500));

      setWorkspaceType("custom");
      setShowCustomSetup(true);
    } catch (error) {
      console.error("Error setting custom workspace:", error);
      toast.error("Failed to configure workspace");
    }
  }

  async function handleCustomSetupComplete() {
    setShowCustomSetup(false);
    // Delay to ensure database update completes
    await new Promise(resolve => setTimeout(resolve, 1000));
    await fetchProject();
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <p className="text-muted-foreground">Project not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const workflowStatus = project.company_profiles?.workflow_status;
  const companyProfileId = project.company_profiles?.id;
  const companyReport = project.company_profiles?.company_report;
  const phase1Data = companyReport?.phase_data?.phase_1_company_report;

  // 1. Show loading state if generating
  if (workflowStatus === 'generating' || workflowStatus === 'pending') {
    return (
      <DashboardLayout>
        <CompanyLoadingStates
          companyName={project.company_profiles?.client_name || project.name}
          workflowStatus={workflowStatus}
          companyProfileId={companyProfileId}
        />
      </DashboardLayout>
    );
  }

  // 2. Show approval UI if reviewing
  // CRITICAL: This must block workspace setup until approved
  if (workflowStatus === 'reviewing') {
    return (
      <DashboardLayout>
        <Phase1Approval
          projectId={projectId}
          companyProfileId={companyProfileId}
          reportData={phase1Data}
          onApprove={() => {
            // Refresh project to update status
            fetchProject();
          }}
        />
      </DashboardLayout>
    );
  }

  // 3. Safety check: If no company profile, show error with retry button
  if (!project.company_profiles) {
    return (
      <DashboardLayout>
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Company profile data missing.</p>
          {project.company_profile_id && (
            <Button
              variant="outline"
              onClick={() => attemptManusDataFetch(project.company_profile_id)}
            >
              Retry Fetching Data
            </Button>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // 4. Show workspace selection if not configured (only if past Phase 1)
  if (!workspaceType) {
    return (
      <DashboardLayout>
        <WorkspaceSelection
          projectId={projectId}
          projectName={project.name}
          onSelectStandard={handleSelectStandard}
          onSelectCustom={handleSelectCustom}
        />
      </DashboardLayout>
    );
  }

  // 5. Show custom workspace setup if selected and not complete
  if (workspaceType === "custom" && showCustomSetup) {
    return (
      <DashboardLayout>
        <CustomWorkspaceSetup
          projectId={projectId}
          onComplete={handleCustomSetupComplete}
        />
      </DashboardLayout>
    );
  }

  // 6. Main campaign interface (Phases 2+)
  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name} Campaign</h1>
            <p className="text-muted-foreground">
              Manage campaigns, leads, and email outreach
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="performance">
              <BarChart3 className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="email-copy">
              <Mail className="h-4 w-4 mr-2" />
              Email Copy
            </TabsTrigger>
            <TabsTrigger value="upload-leads">
              <Upload className="h-4 w-4 mr-2" />
              Upload Leads
            </TabsTrigger>
            <TabsTrigger value="replies">
              <MessageSquare className="h-4 w-4 mr-2" />
              Replies
            </TabsTrigger>
            <TabsTrigger value="domains">
              <Globe className="h-4 w-4 mr-2" />
              Domains
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceTab projectId={projectId} workspaceType={workspaceType!} />
          </TabsContent>

          <TabsContent value="email-copy" className="space-y-4">
            <EmailCopyTab projectId={projectId} workspaceType={workspaceType!} />
          </TabsContent>

          <TabsContent value="upload-leads" className="space-y-4">
            <UploadLeadsTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="replies" className="space-y-4">
            <RepliesTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="domains" className="space-y-4">
            <DomainsTab projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
