"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminTenantsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tenant Management</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add Tenant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Tenant</DialogTitle>
              <DialogDescription>
                Create a new tenant organization in the system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Tenant Name</Label>
                <Input id="tenant-name" placeholder="Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-domain">Primary Domain</Label>
                <Input id="tenant-domain" placeholder="acmecorp.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-admin">Admin Email</Label>
                <Input id="tenant-admin" placeholder="admin@acmecorp.com" type="email" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Create Tenant</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Tenants</CardTitle>
              <CardDescription>
                Manage tenant organizations and their access
              </CardDescription>
            </div>
            <Input
              placeholder="Search tenants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant Name</TableHead>
                <TableHead>Primary Domain</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Example Corp</TableCell>
                <TableCell>example.com</TableCell>
                <TableCell>5</TableCell>
                <TableCell>12</TableCell>
                <TableCell>
                  <Badge className="bg-green-500">Active</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">View</Button>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Test Organization</TableCell>
                <TableCell>testorg.io</TableCell>
                <TableCell>3</TableCell>
                <TableCell>7</TableCell>
                <TableCell>
                  <Badge className="bg-green-500">Active</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">View</Button>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Demo Company</TableCell>
                <TableCell>demo-company.net</TableCell>
                <TableCell>1</TableCell>
                <TableCell>3</TableCell>
                <TableCell>
                  <Badge className="bg-yellow-500">Trial</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">View</Button>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Tenant Usage Statistics</CardTitle>
          <CardDescription>
            Overview of resource usage across tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Tenants</p>
              <p className="text-2xl font-bold">3</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold">9</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Domains</p>
              <p className="text-2xl font-bold">22</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Avg. Domains/Tenant</p>
              <p className="text-2xl font-bold">7.3</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
