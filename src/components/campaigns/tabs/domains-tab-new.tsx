"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";

export function DomainsTab({ projectId }: { projectId: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Domains</CardTitle>
                <CardDescription>Configure and monitor your sending domains</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Domain management coming soon</p>
                </div>
            </CardContent>
        </Card>
    );
}
