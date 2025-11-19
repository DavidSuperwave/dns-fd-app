"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Key, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceSelectionProps {
    projectId: string;
    projectName: string;
    onSelectStandard: () => void;
    onSelectCustom: () => void;
}

export function WorkspaceSelection({
    projectId,
    projectName,
    onSelectStandard,
    onSelectCustom,
}: WorkspaceSelectionProps) {
    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="text-center mb-12">
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                    Choose Your Workspace Type
                </h1>
                <p className="text-muted-foreground">
                    Select how you want to manage email campaigns for {projectName}
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Standard Workspace */}
                <Card
                    className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg relative"
                    onClick={onSelectStandard}
                >
                    <div className="absolute top-4 right-4">
                        <Badge variant="secondary">Recommended</Badge>
                    </div>
                    <CardHeader>
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle>Standard Workspace</CardTitle>
                        <CardDescription>
                            Use our managed infrastructure to create and send email campaigns
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                No configuration needed
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Shared deliverability infrastructure
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Create unlimited email campaigns
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Start immediately
                            </li>
                        </ul>
                        <Button className="w-full" size="lg">
                            Get Started <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>

                {/* Custom Workspace */}
                <Card
                    className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
                    onClick={onSelectCustom}
                >
                    <CardHeader>
                        <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                            <Key className="h-6 w-6 text-purple-500" />
                        </div>
                        <CardTitle>Custom Workspace</CardTitle>
                        <CardDescription>
                            Connect your own PlusVibe account and import existing campaigns
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Use your PlusVibe account
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Import existing email campaigns
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Full control over settings
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Sync campaign data
                            </li>
                        </ul>
                        <Button className="w-full" variant="outline" size="lg">
                            Connect Account <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
