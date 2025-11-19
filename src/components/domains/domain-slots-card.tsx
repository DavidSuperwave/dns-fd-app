"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DomainSlotsResponse } from "@/lib/inboxing-api";
import { Loader2, Database, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DomainSlotsCard() {
    const [slots, setSlots] = useState<DomainSlotsResponse['data'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                const response = await fetch('/api/inboxing/domain-slots');
                if (!response.ok) {
                    throw new Error('Failed to fetch domain slots');
                }
                const data = await response.json();
                setSlots(data.data);
            } catch (err: any) {
                console.error("Error fetching domain slots:", err);
                setError(err.message || "Failed to load slot information");
            } finally {
                setLoading(false);
            }
        };

        fetchSlots();
    }, []);

    if (loading) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Domain Slots
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading slots...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Domain Slots
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs ml-2">{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!slots) return null;

    const usagePercent = slots.total_slots > 0
        ? (slots.used_slots / slots.total_slots) * 100
        : 0;

    return (
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Domain Slots
                </CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{slots.available_slots} <span className="text-sm font-normal text-muted-foreground">available</span></div>
                <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Used: {slots.used_slots}</span>
                        <span>Total: {slots.total_slots}</span>
                    </div>
                    <Progress value={usagePercent} className="h-2" />
                </div>
                {slots.pending_slots > 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                        {slots.pending_slots} slots pending setup
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
