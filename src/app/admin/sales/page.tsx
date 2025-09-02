"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminSalesPage() {
  const [timeframe, setTimeframe] = useState("monthly");
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales Statistics</h1>
        <div className="flex items-center space-x-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">Export Data</Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$24,892</div>
            <p className="text-xs text-muted-foreground">
              +12.5% from previous period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142</div>
            <p className="text-xs text-muted-foreground">
              +8.3% from previous period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,250</div>
            <p className="text-xs text-muted-foreground">
              +3.7% from previous period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.4%</div>
            <p className="text-xs text-muted-foreground">
              -0.3% from previous period
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content Tabs */}
      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>
                Monthly revenue breakdown by plan type
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>Revenue chart would be rendered here</p>
                <p className="text-sm">(Showing revenue trends over time with plan breakdown)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Top Revenue Sources</CardTitle>
              <CardDescription>
                Highest paying customers and plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Monthly Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Acme Corp</TableCell>
                    <TableCell>Enterprise</TableCell>
                    <TableCell>2025-01-15</TableCell>
                    <TableCell>$2,500</TableCell>
                    <TableCell><Badge className="bg-green-500">Active</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">TechGiant Inc</TableCell>
                    <TableCell>Enterprise Plus</TableCell>
                    <TableCell>2024-11-03</TableCell>
                    <TableCell>$3,750</TableCell>
                    <TableCell><Badge className="bg-green-500">Active</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Global Systems</TableCell>
                    <TableCell>Enterprise</TableCell>
                    <TableCell>2025-04-22</TableCell>
                    <TableCell>$2,500</TableCell>
                    <TableCell><Badge className="bg-green-500">Active</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Growth</CardTitle>
              <CardDescription>
                New and churned subscriptions over time
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>Subscription growth chart would be rendered here</p>
                <p className="text-sm">(Showing new vs churned subscriptions)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Plan Distribution</CardTitle>
              <CardDescription>
                Breakdown of active subscriptions by plan
              </CardDescription>
            </CardHeader>
            <CardContent className="h-60 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>Plan distribution chart would be rendered here</p>
                <p className="text-sm">(Pie chart showing distribution of plans)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Acquisition</CardTitle>
              <CardDescription>
                New company signups per month
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>Company acquisition chart would be rendered here</p>
                <p className="text-sm">(Bar chart showing new signups by month)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Company Retention</CardTitle>
              <CardDescription>
                Customer lifetime and retention rates
              </CardDescription>
            </CardHeader>
            <CardContent className="h-60 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>Retention chart would be rendered here</p>
                <p className="text-sm">(Showing cohort retention over time)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="forecasts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Forecasts</CardTitle>
              <CardDescription>
                Projected revenue for next 12 months
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>Forecast chart would be rendered here</p>
                <p className="text-sm">(Line chart showing projected vs actual revenue)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Growth Scenarios</CardTitle>
                  <CardDescription>
                    Projected outcomes under different growth scenarios
                  </CardDescription>
                </div>
                <Select defaultValue="moderate">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="h-60 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>Growth scenario chart would be rendered here</p>
                <p className="text-sm">(Multiple line chart showing different growth paths)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
