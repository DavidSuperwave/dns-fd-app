"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Box, Users } from 'lucide-react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';

// --- Type Definitions for our metrics data ---
interface UserMetric {
    email: string;
    name: string | null;
    domain_count: number;
}

interface MetricsData {
    domains_to_deploy: number;
    domains_per_user: UserMetric[];
}

// --- Reusable Metric Card Component ---
const MetricCard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <div className="p-6 bg-white border rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="text-muted-foreground">{icon}</div>
        </div>
        <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
);


export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAdmin} = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Protect the route for non-admins
    if (!isAdmin) {
        toast.error("You don't have permission to view this page.");
        router.replace('/domains');
        return;
    }

    if (isAdmin) {
        const fetchMetrics = async () => {
            try {
                const response = await fetch('/api/metrics');
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Failed to fetch metrics.");
                }
                setMetrics(data);
            } catch (error: any) {
                toast.error(error.message);
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMetrics();
    }
  }, [isAdmin, router]);

  if (isLoading) {
    return (
        <DashboardLayout>
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl mx-auto px-4 py-6 md:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight">System Metrics</h1>
        <p className="text-muted-foreground mt-2">
          An overview of domain deployment status and user assignments.
        </p>

        {/* --- Headcount Cards --- */}
        <div className="grid gap-6 md:grid-cols-2 mt-8">
            <MetricCard 
                title="Domains Ready for Deployment"
                value={metrics?.domains_to_deploy ?? 0}
                icon={<Box className="h-5 w-5" />}
            />
            <MetricCard 
                title="Total Users with Domains"
                value={metrics?.domains_per_user.length ?? 0}
                icon={<Users className="h-5 w-5" />}
            />
        </div>

        {/* --- User Domain Count Table --- */}
        <div className="mt-12">
            <h2 className="text-2xl font-bold">Domain Count per User</h2>
            <div className="mt-4 border rounded-lg bg-white">
                <div className="grid grid-cols-2 font-semibold p-4 border-b bg-gray-50">
                    <div>User</div>
                    <div className="text-right">Assigned Domains</div>
                </div>
                {metrics?.domains_per_user && metrics.domains_per_user.length > 0 ? (
                    metrics.domains_per_user
                        .sort((a, b) => b.domain_count - a.domain_count) // Sort by most domains
                        .map(user => (
                            <div key={user.email} className="grid grid-cols-2 p-4 border-b last:border-b-0 items-center">
                                <div>
                                    <p className="font-medium truncate">{user.name}</p>
                                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                                </div>
                                <p className="text-right font-semibold text-lg">{user.domain_count}</p>
                            </div>
                        ))
                ) : (
                    <p className="p-4 text-center text-muted-foreground">No users have assigned domains.</p>
                )}
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}