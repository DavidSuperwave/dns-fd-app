"use client";

import React, { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface UploadLeadsTabProps {
    projectId: string;
}

interface ParsedLead {
    email: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    title?: string;
    phone?: string;
    website?: string;
    [key: string]: any;
}

export function UploadLeadsTab({ projectId }: UploadLeadsTabProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadStats, setUploadStats] = useState<{ successful: number; failed: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
                toast.error("Please upload a CSV file");
                return;
            }
            setFile(selectedFile);
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.warn("CSV parsing errors:", results.errors);
                    toast.warning(`Found ${results.errors.length} parsing errors, some rows may be missing`);
                }

                const leads = results.data.map((row: any) => {
                    // Normalize keys to lowercase
                    const normalized: any = {};
                    Object.keys(row).forEach(key => {
                        normalized[key.toLowerCase().trim()] = row[key];
                    });

                    return {
                        email: normalized.email || normalized['e-mail'] || normalized['email address'],
                        first_name: normalized.first_name || normalized.firstname || normalized['first name'],
                        last_name: normalized.last_name || normalized.lastname || normalized['last name'],
                        company: normalized.company || normalized['company name'],
                        title: normalized.title || normalized['job title'],
                        phone: normalized.phone || normalized['phone number'],
                        website: normalized.website || normalized.url,
                        ...normalized
                    };
                }).filter((lead: any) => lead.email); // Filter out rows without email

                setParsedLeads(leads);

                if (leads.length === 0) {
                    toast.error("No valid leads found. Make sure your CSV has an 'email' column.");
                } else {
                    toast.success(`Found ${leads.length} leads`);
                }
            },
            error: (error) => {
                toast.error("Failed to parse CSV file");
                console.error(error);
            }
        });
    };

    const handleUpload = async () => {
        if (parsedLeads.length === 0) {
            toast.error("No leads to upload");
            return;
        }

        setUploading(true);
        setUploadStats(null);

        try {
            const response = await fetch(`/api/plusvibe/campaigns/${projectId}/leads`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leads: parsedLeads }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to upload leads");
            }

            const result = await response.json();
            setUploadStats({
                successful: result.successful,
                failed: result.failed
            });

            toast.success(`Successfully uploaded ${result.successful} leads`);

            // Reset file input
            setFile(null);
            setParsedLeads([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to upload leads");
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload Leads via CSV</CardTitle>
                    <CardDescription>
                        Upload a CSV file containing leads. Required column: <strong>email</strong>.
                        Optional: first_name, last_name, company, title, phone, website.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="csv-upload">CSV File</Label>
                        <Input
                            id="csv-upload"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            disabled={uploading}
                        />
                    </div>

                    {file && (
                        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                            <FileSpreadsheet className="h-8 w-8 text-green-600" />
                            <div className="flex-1">
                                <p className="font-medium">{file.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {parsedLeads.length} leads found
                                </p>
                            </div>
                            <Button onClick={handleUpload} disabled={uploading || parsedLeads.length === 0}>
                                {uploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload Leads
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {uploadStats && (
                        <div className="p-4 border rounded-lg bg-muted/50">
                            <h4 className="font-medium mb-2 flex items-center">
                                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                Upload Complete
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Successful:</span>
                                    <span className="ml-2 font-medium text-green-600">{uploadStats.successful}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Failed:</span>
                                    <span className="ml-2 font-medium text-red-600">{uploadStats.failed}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
