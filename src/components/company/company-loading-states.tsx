"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2 } from "lucide-react";

const loadingStates = [
  "Doing company research",
  "Checking LinkedIn",
  "Analyzing market data",
  "Drafting strategy",
];

interface CompanyProjectCardProps {
  companyName: string;
  logo?: string;
  status?: string;
}

function CompanyProjectCard({ companyName, logo, status = "active" }: CompanyProjectCardProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {logo ? (
              <img
                src={logo}
                alt={`${companyName} logo`}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>

          {/* Name and Status */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{companyName}</h3>
            <div className="mt-2">
              <Badge variant={status === "active" ? "default" : "outline"}>
                {status === "active" ? "Active" : status}
              </Badge>
            </div>
          </div>

          {/* Success Icon */}
          <div className="flex-shrink-0">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CompanyLoadingStatesProps {
  companyName?: string;
  logo?: string;
  onComplete?: () => void;
  workflowStatus?: string; // Real workflow status from API
  companyProfileId?: string; // For polling status
}

export function CompanyLoadingStates({
  companyName = "Company",
  logo,
  onComplete,
  workflowStatus = 'pending',
  companyProfileId
}: CompanyLoadingStatesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isComplete, setIsComplete] = useState(workflowStatus === 'completed');
  const [currentStatus, setCurrentStatus] = useState(workflowStatus);

  useEffect(() => {
    // If workflow is completed, show completion state
    if (currentStatus === 'completed') {
      setIsComplete(true);
      if (onComplete) {
        onComplete();
      }
      return;
    }

    // Cycle through states every 3 seconds with fade transition
    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);

      // After fade out, change state and fade in
      setTimeout(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          return nextIndex < loadingStates.length ? nextIndex : 0; // Loop back to start
        });
        setIsVisible(true);
      }, 300); // Half of transition duration
    }, 3000);

    return () => clearInterval(interval);
  }, [currentStatus, onComplete]);

  // Update status when prop changes
  useEffect(() => {
    setCurrentStatus(workflowStatus);
    if (workflowStatus === 'completed') {
      setIsComplete(true);
    }
  }, [workflowStatus]);

  // Show completion state with project card
  if (isComplete) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Company Profile Created!</h2>
          <p className="text-muted-foreground">
            Your company profile has been successfully created and a new project has been generated.
          </p>
        </div>
        <CompanyProjectCard companyName={companyName} logo={logo} status="active" />
      </div>
    );
  }

  // Manual Input State
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const handleManualSubmit = async () => {
    if (!manualJson || !companyProfileId) return;

    try {
      setIsSubmittingManual(true);
      const parsed = JSON.parse(manualJson); // Validate JSON

      const response = await fetch(`/api/company-profiles/${companyProfileId}/manual-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseData: parsed }),
      });

      if (!response.ok) throw new Error('Failed to save manual data');

      // Force complete
      if (onComplete) onComplete();

    } catch (error) {
      console.error("Manual input error:", error);
      alert("Invalid JSON or save failed");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleFetchManusData = async () => {
    if (!companyProfileId) return;

    try {
      setIsSubmittingManual(true); // Reuse loading state
      const response = await fetch(`/api/company-profiles/${companyProfileId}/fetch-manus-result`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch result');
      }

      // Force complete/refresh
      if (onComplete) onComplete();

    } catch (error) {
      console.error("Fetch error:", error);
      alert("Failed to fetch data from Manus. Task might still be running.");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="pt-6 flex-1 flex flex-col justify-center">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
          {/* Title */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Building Your Company Profile</h2>
            <p className="text-muted-foreground">
              Our AI is working hard to create a comprehensive profile for your company
            </p>
          </div>

          {/* Pulsing Circle and Text */}
          <div className="flex flex-col items-center gap-8">
            {/* Blue Pulsing Circle - Outline Style */}
            <div className="relative flex items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="absolute h-32 w-32 rounded-full border-4 border-blue-500 opacity-75 animate-ping"></div>
              {/* Main circle with pulsing effect */}
              <div className="relative h-32 w-32 rounded-full border-4 border-blue-500 animate-pulse">
                {/* Inner gradient effect for watercolor-like appearance */}
                <div className="absolute inset-0 rounded-full border-2 border-blue-400/50"></div>
              </div>
            </div>

            {/* Fading Text */}
            <div
              className={`text-center transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"
                }`}
            >
              <p className="text-xl font-medium text-blue-900 dark:text-blue-100">
                {loadingStates[currentIndex]}
              </p>
            </div>
          </div>

          {/* Bottom Message & Manual Override */}
          <div className="text-center pt-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              This might take a minute. Check back in a few minutes to get your report.
            </p>

            {/* Debug Buttons - Hidden for production but kept for dev */}
            {/* 
            <div className="pt-4 border-t flex flex-col gap-3 items-center">
              <button
                onClick={handleFetchManusData}
                disabled={isSubmittingManual}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                {isSubmittingManual ? "Fetching..." : "Check Manus Status & Fetch Data"}
              </button>

              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-xs text-muted-foreground hover:text-primary underline"
              >
                {showManualInput ? "Hide Manual Input" : "Enter JSON Manually (Dev)"}
              </button>

              {showManualInput && (
                <div className="mt-4 space-y-2 max-w-lg mx-auto text-left w-full">
                  <textarea
                    className="w-full h-32 p-2 text-xs font-mono border rounded bg-muted"
                    placeholder='Paste JSON here: { "client_offer_brief": ... }'
                    value={manualJson}
                    onChange={(e) => setManualJson(e.target.value)}
                  />
                  <button
                    onClick={handleManualSubmit}
                    disabled={isSubmittingManual || !manualJson}
                    className="w-full py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
                  >
                    {isSubmittingManual ? "Saving..." : "Inject Data & Continue"}
                  </button>
                </div>
              )}
            </div>
            */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
