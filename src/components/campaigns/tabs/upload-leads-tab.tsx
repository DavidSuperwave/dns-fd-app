"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

export function UploadLeadsTab({ projectId }: { projectId: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Upload Leads</CardTitle>
                <CardDescription>Import leads from CSV or connect lead sources</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Lead upload coming soon</p>
                </div>
            </CardContent>
        </Card>
    );
}
