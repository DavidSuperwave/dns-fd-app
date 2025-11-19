"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export function RepliesTab({ projectId }: { projectId: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Replies</CardTitle>
                <CardDescription>View and manage email replies from your campaigns</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Replies inbox coming soon</p>
                </div>
            </CardContent>
        </Card>
    );
}
