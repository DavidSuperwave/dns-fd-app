"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DomainMetrics } from "@/components/admin/domain-metrics";
import { ActiveDomainsList } from "@/components/admin/active-domains-list";
import { AdminDashboardCharts } from "@/components/admin/admin-charts";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>
      
      {/* Dashboard Charts */}
      <AdminDashboardCharts />
      
      {/* Main Content */}
      <div className="space-y-6">
        <DomainMetrics />
      </div>
    </div>
  );
}
