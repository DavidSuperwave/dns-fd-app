"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase-client";
import { Loader2 } from "lucide-react";

interface MetricsData {
  totalActive: number;
  needingDeployment: number;
  withIssues: number;
  isLoading: boolean;
  lastUpdated: string | null;
  trends: {
    totalActive: number;
    needingDeployment: number;
    withIssues: number;
  };
}

export function DomainMetrics() {
  const [metrics, setMetrics] = useState<MetricsData>({
    totalActive: 0,
    needingDeployment: 0,
    withIssues: 0,
    isLoading: true,
    lastUpdated: null,
    trends: {
      totalActive: 0,
      needingDeployment: 0,
      withIssues: 0
    }
  });

  const supabase = createClient();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Get the session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No session token available');
        }

        // Fetch users and their domains from the API
        const response = await fetch('/api/admin/users-with-domains', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Calculate metrics from the users and their domains
        let activeCount = 0;
        let needingDeploymentCount = 0;
        let issuesCount = 0;

        // Store previous metrics for trend calculation
        const previousMetrics = { ...metrics };

        data.forEach((user: any) => {
          const domainCount = user.domain_names?.length || 0;
          activeCount += domainCount;

          // For now, we'll consider domains needing deployment if they're new (added in last 24h)
          const isNewUser = new Date().getTime() - new Date(user.created_at).getTime() < 24 * 60 * 60 * 1000;
          if (isNewUser && domainCount > 0) {
            needingDeploymentCount += domainCount;
          }

          // For now, we'll consider domains with issues if they belong to users in 'pending' status
          if (user.onboarding_status === 'pending' && domainCount > 0) {
            issuesCount += domainCount;
          }
        });

        // Calculate trends (percentage change)
        const calculateTrend = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return Math.round(((current - previous) / previous) * 100);
        };

        setMetrics({
          totalActive: activeCount,
          needingDeployment: needingDeploymentCount,
          withIssues: issuesCount,
          isLoading: false,
          lastUpdated: new Date().toISOString(),
          trends: {
            totalActive: calculateTrend(activeCount, previousMetrics.totalActive),
            needingDeployment: calculateTrend(needingDeploymentCount, previousMetrics.needingDeployment),
            withIssues: calculateTrend(issuesCount, previousMetrics.withIssues)
          }
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
        setMetrics((prev: MetricsData) => ({ ...prev, isLoading: false }));
      }
    };

    fetchMetrics();
  }, []);

  if (metrics.isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="relative min-h-[150px] overflow-hidden border-none bg-gradient-to-br from-gray-50 to-gray-100 shadow-md hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-300 to-blue-500 opacity-70"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
    </div>
  );
}
