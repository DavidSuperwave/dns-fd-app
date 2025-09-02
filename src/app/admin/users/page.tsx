"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserManagement } from "@/components/admin/user-management";
import { AddUserDialog } from "@/components/admin/add-user-dialog";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <AddUserDialog />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage user accounts, permissions, and access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagement />
        </CardContent>
      </Card>
    </div>
  );
}
