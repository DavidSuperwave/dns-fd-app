"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminDomainsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Domain Management</h1>
        <div className="space-x-2">
          <Button variant="outline">Run Domain Check</Button>
          <Button>Add Domain</Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Domains</CardTitle>
              <CardDescription>
                Manage and monitor all domains in the system
              </CardDescription>
            </div>
            <Input
              placeholder="Search domains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Domains</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="issues">With Issues</TabsTrigger>
              <TabsTrigger value="expired">Expired</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>DNS Records</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">example.com</TableCell>
                    <TableCell>user@example.com</TableCell>
                    <TableCell>
                      <Badge className="bg-green-500">Active</Badge>
                    </TableCell>
                    <TableCell>12 records</TableCell>
                    <TableCell>Jan 1, 2026</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">test-domain.io</TableCell>
                    <TableCell>admin@company.com</TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-500">Warning</Badge>
                    </TableCell>
                    <TableCell>5 records</TableCell>
                    <TableCell>Dec 15, 2025</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                  {/* More rows would be dynamically generated from actual domain data */}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="active">
              {/* Similar table with filtered results for active domains */}
              <div className="text-center p-4 text-muted-foreground">
                Active domains will be displayed here
              </div>
            </TabsContent>
            
            <TabsContent value="issues">
              {/* Similar table with filtered results for domains with issues */}
              <div className="text-center p-4 text-muted-foreground">
                Domains with issues will be displayed here
              </div>
            </TabsContent>
            
            <TabsContent value="expired">
              {/* Similar table with filtered results for expired domains */}
              <div className="text-center p-4 text-muted-foreground">
                Expired domains will be displayed here
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Domain Health Overview</CardTitle>
          <CardDescription>
            Summary of domain health across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Domains</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Healthy</p>
              <p className="text-2xl font-bold text-green-500">--</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Warnings</p>
              <p className="text-2xl font-bold text-yellow-500">--</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Critical Issues</p>
              <p className="text-2xl font-bold text-red-500">--</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
