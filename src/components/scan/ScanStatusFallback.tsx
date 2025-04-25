import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertTriangle } from "lucide-react";
import { SetupScanTablesButton } from "./SetupScanTablesButton";

interface ScanStatusFallbackProps {
  error?: string | null;
  isLoading?: boolean;
}

export const ScanStatusFallback: React.FC<ScanStatusFallbackProps> = ({
  error,
  isLoading = false
}) => {
  // Check if error is related to missing scan_results table
  const isMissingTableError = error && (
    error.includes("relation") &&
    error.includes("scan_results") &&
    error.includes("does not exist") ||
    error.includes("Database tables not set up") ||
    error.includes("42P01")
  );

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Latest Domain Scan
          {isLoading && (
            <Badge className="ml-2 bg-blue-500">
              Loading...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error || "Couldn't load scan data. Please try again later."}
                </AlertDescription>
              </Alert>
              
              {isMissingTableError && (
                <div className="mt-4">
                  <p className="text-sm mb-2">This error occurs because the scan_results table is missing in the database.</p>
                  <SetupScanTablesButton fullWidth variant="default" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>No scan data available yet.</p>
              <p>Run a background scan to check domain statuses.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};