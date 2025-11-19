"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Key, ArrowRight, Download, Rocket, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlusVibeConnectionSettings } from "@/components/plusvibe/connection-settings";
import { CampaignImportDialog } from "@/components/plusvibe/campaign-import-dialog";
import { CampaignLaunchDialog } from "@/components/plusvibe/campaign-launch-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CampaignSetupWizardProps {
    projectId: string;
    projectName: string;
    onSuccess: () => void;
}

type SetupStep = "workspace" | "action";
type WorkspaceType = "standard" | "custom";

export function CampaignSetupWizard({ projectId, projectName, onSuccess }: CampaignSetupWizardProps) {
    const router = useRouter();
    const [step, setStep] = useState<SetupStep>("workspace");
    const [workspaceType, setWorkspaceType] = useState<WorkspaceType | null>(null);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showLaunchDialog, setShowLaunchDialog] = useState(false);

    const handleWorkspaceSelect = (type: WorkspaceType) => {
        setWorkspaceType(type);
        setStep("action");
    };

    const handleImportSuccess = (campaignId: string) => {
        toast.success("Campaign imported successfully!");
        setShowImportDialog(false);
        onSuccess();
        router.refresh();
    };

    const handleLaunchSuccess = () => {
        toast.success("Campaign launched successfully!");
        setShowLaunchDialog(false);
        onSuccess();
        router.refresh();
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="text-center mb-12">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Set up your campaign</h1>
                <p className="text-muted-foreground">
                    Connect to PlusVibe to start sending emails and tracking performance.
                </p>
            </div>

            {step === "workspace" && (
                <div className="grid md:grid-cols-2 gap-6">
                    <Card
                        className={cn(
                            "cursor-pointer transition-all hover:border-primary/50 hover:shadow-md",
                            workspaceType === "standard" && "border-primary ring-1 ring-primary"
                        )}
                        onClick={() => handleWorkspaceSelect("standard")}
                    >
                        <CardHeader>
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <Building2 className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Standard Workspace</CardTitle>
                            <CardDescription>
                                Use our managed PlusVibe infrastructure. Best for getting started quickly.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    No API keys required
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Managed deliverability
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Instant setup
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card
                        className={cn(
                            "cursor-pointer transition-all hover:border-primary/50 hover:shadow-md",
                            workspaceType === "custom" && "border-primary ring-1 ring-primary"
                        )}
                        onClick={() => handleWorkspaceSelect("custom")}
                    >
                        <CardHeader>
                            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                                <Key className="h-6 w-6 text-purple-500" />
                            </div>
                            <CardTitle>Custom Workspace</CardTitle>
                            <CardDescription>
                                Connect your own PlusVibe workspace. Best for existing users with data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Use your own API keys
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Import existing campaigns
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Full control over settings
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            )}

            {step === "action" && (
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" onClick={() => setStep("workspace")}>
                            ← Back to selection
                        </Button>
                        <Badge variant="outline" className="text-base px-4 py-1">
                            {workspaceType === "standard" ? "Standard Workspace" : "Custom Workspace"}
                        </Badge>
                    </div>

                    {workspaceType === "custom" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Connection Settings</CardTitle>
                                <CardDescription>Manage your PlusVibe API keys</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <PlusVibeConnectionSettings companyProfileId={projectId} />
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-dashed">
                            <CardHeader>
                                <CardTitle>Launch New Campaign</CardTitle>
                                <CardDescription>
                                    Create a fresh campaign for {projectName}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full"
                                    onClick={() => setShowLaunchDialog(true)}
                                >
                                    <Rocket className="mr-2 h-4 w-4" />
                                    Launch Campaign
                                </Button>
                            </CardContent>
                        </Card>

                        {workspaceType === "custom" && (
                            <Card className="border-dashed">
                                <CardHeader>
                                    <CardTitle>Import Existing</CardTitle>
                                    <CardDescription>
                                        Link an existing campaign from your workspace
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => setShowImportDialog(true)}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Import from PlusVibe
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            <CampaignImportDialog
                projectId={projectId}
                open={showImportDialog}
                onOpenChange={setShowImportDialog}
                onSuccess={handleImportSuccess}
            />

            <CampaignLaunchDialog
                campaignId=""
                campaignName={projectName + " Campaign"}
                open={showLaunchDialog}
                onOpenChange={setShowLaunchDialog}
                onSuccess={handleLaunchSuccess}
                useStandardWorkspace={workspaceType === "standard"}
            />
        </div>
    );
}
