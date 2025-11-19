"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth/auth-provider";
import { RecentCampaigns } from "@/components/campaigns/recent-campaigns";
import {
  Rocket,
  Send,
  Reply,
  Phone,
  Sun,
  Home,
  ChevronRight,
  Calendar,
  Plus,
  Target,
  Users,
  Clock3
} from "lucide-react";

const KPI_CARDS = [
  {
    key: "activeCampaigns",
    title: "Active Campaigns",
    description: "Campaigns currently sending",
    icon: Rocket,
  },
  {
    key: "emailsSentToday",
    title: "Emails Sent Today",
    description: "Outbound volume across campaigns",
    icon: Send,
  },
  {
    key: "totalReplies",
    title: "Total Replies",
    description: "Replies captured in PlusVibe",
    icon: Reply,
  },
  {
    key: "callsBooked",
    title: "Calls Booked",
    description: "Coming soon",
    icon: Phone,
  },
] as const;

interface OverviewAPIResponse {
  success: boolean;
  metrics: {
    activeCampaigns: number;
    emailsSentToday: number;
    totalReplies: number;
  };
  campaigns: unknown[];
  error?: string;
}

export default function OverviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState("last-month");
  const [metrics, setMetrics] = useState<OverviewAPIResponse["metrics"] | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const formattedTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  const formattedDate = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  
  const greeting = now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening";
  const userName = user?.email?.split("@")[0] || "Demo";

  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async (silent = false) => {
      if (!silent) {
        setMetricsLoading(true);
      }

      try {
        const response = await fetch("/api/plusvibe/overview", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data: OverviewAPIResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to load PlusVibe metrics");
        }

        if (isMounted) {
          setMetrics(data.metrics);
          setMetricsError(null);
        }
      } catch (error) {
        if (isMounted) {
          setMetricsError((error as Error).message);
        }
      } finally {
        if (isMounted && !silent) {
          setMetricsLoading(false);
        }
      }
    };

    fetchMetrics();
    const interval = setInterval(() => fetchMetrics(true), 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const formatCardValue = (key: (typeof KPI_CARDS)[number]["key"]) => {
    if (!metrics) {
      return metricsLoading ? "…" : "—";
    }

    const formatter = new Intl.NumberFormat();

    switch (key) {
      case "activeCampaigns":
        return formatter.format(metrics.activeCampaigns);
      case "emailsSentToday":
        return formatter.format(metrics.emailsSentToday);
      case "totalReplies":
        return formatter.format(metrics.totalReplies);
      default:
        return "0";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          <ChevronRight className="h-4 w-4" />
          <span>Dashboard</span>
        </div>

        {/* Header with Title and Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">
              Monitor key metrics and manage your platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-week">Last Week</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-quarter">Last Quarter</SelectItem>
                <SelectItem value="last-year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => router.push("/create-company")}>
              <Plus className="h-4 w-4 mr-2" />
              Create a Company
            </Button>
          </div>
        </div>

        {/* Welcome Card and Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Welcome Card - 60% */}
          <Card className="lg:col-span-3 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-800 text-white shadow-lg border-none">
            <CardContent className="p-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <p className="text-sm uppercase tracking-wide text-white/70">
                  Welcome this {greeting}, {userName}
                </p>
                <h2 className="text-4xl font-semibold mt-2">Ready to make today productive! 🚀</h2>
                <div className="mt-6 text-4xl font-bold">{formattedTime}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-6 w-full max-w-xs">
                <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/70">
                  <Sun className="h-4 w-4" />
                  Sunny · Monterrey
                </div>
                <div className="text-5xl font-semibold mt-2">28°C</div>
                <p className="text-white/70 text-sm">{formattedDate}</p>
              </div>
            </CardContent>
          </Card>

          {/* Insights Card - 40% */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle>Insights</CardTitle>
              <CardDescription>Performance analytics</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1">Performance</Button>
                <Button variant="ghost" size="sm" className="flex-1">Trends</Button>
              </div>

              <div className="flex items-start gap-6">
                <div className="relative flex-shrink-0">
                  <div
                    className="w-28 h-28 rounded-full"
                    style={{ background: "conic-gradient(#4c87ff 0% 85%, #e5e7eb 85% 100%)" }}
                  />
                  <div className="absolute inset-2 bg-background rounded-full flex items-center justify-center text-2xl font-semibold">
                    85%
                  </div>
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Task Completion</p>
                    </div>
                    <p className="text-xs text-muted-foreground">85% overall completion rate</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">User Engagement</p>
                    </div>
                    <p className="text-xs text-muted-foreground">84% active user participation</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock3 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Response Time</p>
                    </div>
                    <p className="text-xs text-muted-foreground">78% average response efficiency</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_CARDS.map((item) => (
            <Card key={item.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCardValue(item.key)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.key === "callsBooked" ? "Tracking soon" : item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {metricsError && (
          <div className="rounded-md bg-destructive/15 px-4 py-3 text-sm text-destructive">
            Unable to load PlusVibe metrics: {metricsError}
          </div>
        )}

        {/* Recent Campaigns */}
        <RecentCampaigns />
      </div>
    </DashboardLayout>
  );
}

