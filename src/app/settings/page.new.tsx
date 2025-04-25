"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import DashboardLayout from "../../components/layout/dashboard-layout";

// Removed unused imports: toast, QRCodeSVG, supabase, generateSecurePassword, Alert, AlertDescription, AlertTitle, DatabaseIcon, InfoIcon, RefreshCwIcon

export default function SettingsPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState("");
  const [isAdmin, setIsAdmin] = React.useState(false);

  // Initialize admin status and email
  React.useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // Add your admin check logic here
        const isUserAdmin = false; // Replace with actual admin check
        setIsAdmin(isUserAdmin);
        setUserEmail("user@example.com"); // Replace with actual user email
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    };
    
    checkAdminStatus();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Add your profile save logic here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated API call
      console.log("Profile saved with email:", userEmail);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        {/* Account Settings */}
        <div className="space-y-6">
          {/* Email settings card */}
          <Card>
            <CardHeader>
              <CardTitle>Email Address</CardTitle>
              <CardDescription>
                Update your email address. This is used to identify you in the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Update Email"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Password settings card */}
          <Card>
            {/* Password card content remains the same... */}
          </Card>

          {/* Two-Factor Authentication card */}
          <Card>
            {/* 2FA card content remains the same... */}
          </Card>
        </div>
        
        {/* Admin Settings */}
        {isAdmin && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Admin Settings</h2>
            <Tabs defaultValue="supabase">
              <TabsList className="mb-4 flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-fit">
                <TabsTrigger value="supabase">
                  Supabase Admin
                </TabsTrigger>
                <TabsTrigger value="cloudflare">
                  Cloudflare API
                </TabsTrigger>
              </TabsList>

              <TabsContent value="supabase" className="space-y-6">
                {/* Supabase admin cards remain the same... */}
              </TabsContent>

              <TabsContent value="cloudflare" className="space-y-6">
                {/* Cloudflare API card remains the same... */}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}