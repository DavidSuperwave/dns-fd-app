"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CopyTab({ campaign }: { campaign: any }) {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClientComponentClient();

    useEffect(() => {
        async function fetchTemplates() {
            try {
                const { data, error } = await supabase
                    .from("email_templates")
                    .select("*")
                    .eq("campaign_id", campaign.id)
                    .order("sequence_position", { ascending: true });

                if (error) throw error;
                setTemplates(data || []);
            } catch (error) {
                console.error("Error fetching templates:", error);
            } finally {
                setLoading(false);
            }
        }

        if (campaign?.id) {
            fetchTemplates();
        }
    }, [campaign?.id, supabase]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Email Copy</CardTitle>
                <CardDescription>Campaign sequences and templates</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                        No email templates found for this campaign.
                    </div>
                ) : (
                    <Tabs defaultValue={templates[0]?.id} className="w-full">
                        <TabsList className="w-full justify-start overflow-x-auto">
                            {templates.map((template, index) => (
                                <TabsTrigger key={template.id} value={template.id}>
                                    Step {template.sequence_position || index + 1}: {template.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {templates.map((template) => (
                            <TabsContent key={template.id} value={template.id} className="mt-4">
                                <div className="space-y-4 border rounded-md p-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Subject</h4>
                                        <p className="font-medium">{template.subject}</p>
                                    </div>
                                    <div className="border-t pt-4">
                                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Body</h4>
                                        <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                                            {template.body_text}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </CardContent>
        </Card>
    );
}
