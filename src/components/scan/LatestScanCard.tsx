import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { ScanStatusFallback } from "./ScanStatusFallback";
import { useLatestScan } from "../../hooks/useLatestScan";

export const LatestScanCard: React.FC = () => {
  const {
    loading,
    latestScan,
    scanAge,
    isRecent,
    hasData,
    error
  } = useLatestScan();

  // If there's an error or no data, show fallback component
  if ((error && !loading) || (!hasData && !loading)) {
    return <ScanStatusFallback error={error} isLoading={loading} />;
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Latest Domain Scan
        </CardTitle>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          className="h-4 w-4 text-muted-foreground"
        >
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M2 10h20" />
        </svg>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="text-xl font-medium">Loading scan data...</div>
            <Progress value={45} className="h-1 mt-2" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-2xl font-bold">
              {scanAge || "Just now"}
            </div>
            <p className="text-xs text-muted-foreground">
              {latestScan ? (
                <>
                  {latestScan.total_domains} domains scanned, 
                  {latestScan.domains_needing_attention > 0 ? (
                    <span className="text-amber-500 font-medium"> {latestScan.domains_needing_attention} requiring attention</span>
                  ) : (
                    <span className="text-green-500 font-medium"> all healthy</span>
                  )}
                </>
              ) : (
                "No scan data available"
              )}
            </p>
            {isRecent && (
              <div className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mt-1">
                Recent
              </div>
            )}
            {latestScan?.scan_duration_ms && (
              <p className="text-xs text-muted-foreground">
                Completed in {(latestScan.scan_duration_ms / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};