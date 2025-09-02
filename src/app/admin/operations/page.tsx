"use client";

import React from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DomainMetrics } from "@/components/admin/domain-metrics";
import { UserManagement } from "@/components/admin/user-management";
import { ActiveDomainsList } from "@/components/admin/active-domains-list";
import { Loader2 } from "lucide-react";

export default function AdminOperationsPage() {
  const { user, isAdmin } = useAuth();
  
  // Admin check is now handled by the AdminLayout component

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-6">Admin Operations</h1>
        
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="domains">Domain Control</TabsTrigger>
            <TabsTrigger value="system">System Status</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DomainMetrics />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="domains" className="space-y-6">
            <ActiveDomainsList />
          </TabsContent>

          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                {/* System status features will be implemented here */}
                <p>System status monitoring coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}
