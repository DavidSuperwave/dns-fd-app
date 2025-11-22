"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Building2, Upload, X, File, ArrowRight } from "lucide-react";
import { CompanyLoadingStates } from "@/components/company/company-loading-states";

const industryOptions = [
  "B2B SaaS",
  "Marketing Agency",
  "Financial Services",
  "Healthcare",
  "E-commerce",
  "Technology",
  "Real Estate",
  "Education",
  "Consulting",
  "Other",
];

export default function CreateCompanyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [companyProfileId, setCompanyProfileId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string>('pending');
  const [formData, setFormData] = useState({
    clientName: "",
    domain: "",
    industry: "",
    offerService: "",
    pricing: "",
    targetMarket: "",
    goals: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Convert files to base64 for upload
      const filesData = await Promise.all(
        uploadedFiles.map(async (file) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: file.name,
                type: file.type,
                data: (reader.result as string).split(',')[1], // Remove data:type;base64, prefix
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );

      // Call API to create company profile with Phase 1 mapping
      const response = await fetch('/api/company-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName: formData.clientName,
          domain: formData.domain,
          industry: formData.industry,
          offerService: formData.offerService,
          pricing: formData.pricing,
          targetMarket: formData.targetMarket,
          goals: formData.goals,
          files: filesData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create company profile');
      }

      const data = await response.json();
      const profileId = data.companyProfile.id;
      const projectId = data.project?.id;

      setCompanyProfileId(profileId);
      setWorkflowStatus(data.companyProfile.workflow_status);

      if (projectId) {
        // Don't redirect automatically - let the user see the animation
        // router.push(`/projects/${projectId}/campaign`);
        setProjectId(projectId); // Save for manual navigation
      } else {
        // Fallback if project creation failed (shouldn't happen with new API)
        console.warn('Project ID missing in response, redirecting to projects list');
        router.push('/projects');
      }

    } catch (error) {
      console.error('Error creating company profile:', error);
      alert(error instanceof Error ? error.message : 'Failed to create company profile');
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create a Company</h1>
            <p className="text-muted-foreground">
              Build your company profile to get started
            </p>
          </div>
        </div>

        {isSubmitting ? (
          <>
            <CompanyLoadingStates
              companyName={formData.clientName}
              workflowStatus={workflowStatus}
              companyProfileId={companyProfileId || undefined}
            />
            {projectId && (
              <div className="flex justify-center mt-8">
                <Button
                  size="lg"
                  onClick={() => router.push(`/projects/${projectId}/campaign`)}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-1000"
                >
                  Continue to Campaign
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Client Information
              </CardTitle>
              <CardDescription>
                Fill in the details about your client to generate a comprehensive company profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Client Name */}
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    name="clientName"
                    placeholder="Enter company name"
                    value={formData.clientName}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Domain */}
                <div className="space-y-2">
                  <Label htmlFor="domain">Company Website/Domain *</Label>
                  <Input
                    id="domain"
                    name="domain"
                    placeholder="e.g., https://acme.com or acme.com"
                    value={formData.domain}
                    onChange={handleInputChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Manus AI will visit this website to analyze positioning and messaging
                  </p>
                </div>

                {/* Industry */}
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry *</Label>
                  <select
                    id="industry"
                    name="industry"
                    value={formData.industry}
                    onChange={handleInputChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  >
                    <option value="">Select an industry...</option>
                    {industryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Offer/Service */}
                <div className="space-y-2">
                  <Label htmlFor="offerService">Offer/Service *</Label>
                  <Textarea
                    id="offerService"
                    name="offerService"
                    placeholder="Brief description of what they sell - 2-3 sentences"
                    rows={4}
                    value={formData.offerService}
                    onChange={handleInputChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe what the company sells or offers
                  </p>
                </div>

                {/* Pricing */}
                <div className="space-y-2">
                  <Label htmlFor="pricing">Pricing *</Label>
                  <Input
                    id="pricing"
                    name="pricing"
                    placeholder="e.g., $99/month, one-time $500, usage-based"
                    value={formData.pricing}
                    onChange={handleInputChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    How is the service/product priced?
                  </p>
                </div>

                {/* Target Market */}
                <div className="space-y-2">
                  <Label htmlFor="targetMarket">Target Market *</Label>
                  <Textarea
                    id="targetMarket"
                    name="targetMarket"
                    placeholder="Who they think their customers are - be specific"
                    rows={4}
                    value={formData.targetMarket}
                    onChange={handleInputChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe the ideal customer profile in detail
                  </p>
                </div>

                {/* Goals */}
                <div className="space-y-2">
                  <Label htmlFor="goals">Goals *</Label>
                  <Textarea
                    id="goals"
                    name="goals"
                    placeholder="What does success look like? e.g., 50 meetings/month, $500K pipeline, 10% reply rate"
                    rows={4}
                    value={formData.goals}
                    onChange={handleInputChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Define what success looks like for this client
                  </p>
                </div>

                {/* Uploaded Files */}
                <div className="space-y-2">
                  <Label>Uploaded Files (Optional)</Label>
                  <div className="border-2 border-dashed rounded-lg p-6">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div className="text-center">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleFileUploadClick}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Files
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          Upload any relevant documents, images, or files
                        </p>
                      </div>
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">Uploaded Files:</p>
                        {uploadedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-muted rounded-md"
                          >
                            <div className="flex items-center gap-2">
                              <File className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({(file.size / 1024).toFixed(2)} KB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!formData.clientName || !formData.industry || !formData.domain}>
                    Create Company Profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
