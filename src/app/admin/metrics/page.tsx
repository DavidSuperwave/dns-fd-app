"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function AdminMetricsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Metrics</h1>
        <div className="flex items-center space-x-2">
          <Select defaultValue="7d">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">Export Data</Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total API Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">245,678</div>
            <p className="text-xs text-muted-foreground">
              +12.5% from last period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,204</div>
            <p className="text-xs text-muted-foreground">
              +3.2% from last period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">237ms</div>
            <p className="text-xs text-muted-foreground">
              -18ms from last period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0.14%</div>
            <p className="text-xs text-muted-foreground">
              -0.06% from last period
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="api" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="api">API Usage</TabsTrigger>
          <TabsTrigger value="users">User Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Error Tracking</TabsTrigger>
        </TabsList>
        
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Request Volume</CardTitle>
              <CardDescription>
                Total API requests over time, broken down by endpoint
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              {/* This would be replaced with a real chart */}
              <div className="text-center text-muted-foreground">
                <p>API usage chart would go here</p>
                <p className="text-sm">(Line chart showing API requests over time)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Top API Endpoints</CardTitle>
              <CardDescription>
                Most frequently accessed API endpoints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">/api/domains/list</p>
                    <p className="text-xs text-muted-foreground">Domain listing endpoint</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">62,485</p>
                    <p className="text-xs text-muted-foreground">25.4% of total</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">/api/dns-records/get</p>
                    <p className="text-xs text-muted-foreground">DNS records retrieval</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">48,326</p>
                    <p className="text-xs text-muted-foreground">19.7% of total</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">/api/users/auth</p>
                    <p className="text-xs text-muted-foreground">User authentication</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">35,971</p>
                    <p className="text-xs text-muted-foreground">14.6% of total</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
              <CardDescription>
                Active users and session data
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              {/* This would be replaced with a real chart */}
              <div className="text-center text-muted-foreground">
                <p>User activity chart would go here</p>
                <p className="text-sm">(Area chart showing daily active users)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Performance</CardTitle>
              <CardDescription>
                Response times and system metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              {/* This would be replaced with a real chart */}
              <div className="text-center text-muted-foreground">
                <p>Performance metrics chart would go here</p>
                <p className="text-sm">(Line chart showing response times)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Tracking</CardTitle>
              <CardDescription>
                System errors and exceptions
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              {/* This would be replaced with a real chart */}
              <div className="text-center text-muted-foreground">
                <p>Error tracking chart would go here</p>
                <p className="text-sm">(Bar chart showing error counts by type)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
