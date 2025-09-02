"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCompanyDialog } from "@/components/admin/add-company-dialog";

export default function AdminCompaniesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Company Management</h1>
        <div className="flex gap-2">
          <AddCompanyDialog />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>
            Manage companies and assign users to them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Create and manage companies (tenants) that users can be assigned to.
            Each company can have multiple users with different roles.
          </p>
          
          {/* Company listing will be implemented in CompanyManagement component */}
          <div className="bg-muted/40 border rounded-md p-8 text-center">
            <h3 className="text-lg font-medium">Company Management</h3>
            <p className="text-muted-foreground mt-2">
              Company listing and management interface will be implemented here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
