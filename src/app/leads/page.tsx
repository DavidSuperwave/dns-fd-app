"use client";

import React from "react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const mockLeads = [
  { name: "Acme Corp", status: "active", source: "Inboxing", updated: "2h ago" },
  { name: "Northwind", status: "nurture", source: "Vibe Plus", updated: "6h ago" },
  { name: "Globex", status: "inactive", source: "Manual import", updated: "1d ago" },
];

export default function LeadsPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Centralized view of leads generated across integrations.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>Syncs from Inboxing, Vibe Plus, and Manus AI.</CardDescription>
            </div>
            <Button size="sm">Import Leads</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockLeads.map((lead) => (
                  <TableRow key={lead.name}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>
                      <Badge variant={lead.status === "active" ? "default" : lead.status === "nurture" ? "secondary" : "outline"}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.source}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.updated}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

