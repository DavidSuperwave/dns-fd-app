"use client";

import React, { useState } from "react";
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
import { Checkbox } from "../../components/ui/checkbox";
import { toast } from "sonner";
import DashboardLayout from "../../components/layout/dashboard-layout";

export default function SettingsPage() {
  // Mock profile settings
  const [profileSettings, setProfileSettings] = useState({
    name: "Admin User",
    email: "admin@example.com",
    companyName: "DNS-FD Solutions",
    phone: "+1 (555) 123-4567",
  });

  // Mock security settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    passwordLastChanged: "2023-11-15",
  });

  // Mock notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    domainExpiryAlerts: true,
    securityAlerts: true,
    marketingEmails: false,
  });

  // Mock API settings
  const [apiSettings, setApiSettings] = useState({
    apiKey: "sk_test_51Nx82nCjKLJfDeS9kFgB6PwTySgW2k2",
    apiEnabled: true,
    rateLimit: 100,
  });

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Profile settings saved successfully");
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Password changed successfully");
  };

  const handleNotificationSave = () => {
    toast.success("Notification preferences saved successfully");
  };

  const handleRegenerateApiKey = () => {
    const newApiKey = `sk_test_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setApiSettings({ ...apiSettings, apiKey: newApiKey });
    toast.success("API key regenerated successfully");
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

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full md:w-auto grid-cols-4 md:inline-flex">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your account profile information.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={profileSettings.name}
                      onChange={(e) =>
                        setProfileSettings({
                          ...profileSettings,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileSettings.email}
                      onChange={(e) =>
                        setProfileSettings({
                          ...profileSettings,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input
                      id="company"
                      value={profileSettings.companyName}
                      onChange={(e) =>
                        setProfileSettings({
                          ...profileSettings,
                          companyName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileSettings.phone}
                      onChange={(e) =>
                        setProfileSettings({
                          ...profileSettings,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Button type="submit">Save Changes</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                  <Button type="submit">Change Password</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="two-factor"
                    checked={securitySettings.twoFactorEnabled}
                    onCheckedChange={(checked) =>
                      setSecuritySettings({
                        ...securitySettings,
                        twoFactorEnabled: checked as boolean,
                      })
                    }
                  />
                  <label
                    htmlFor="two-factor"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Enable Two-Factor Authentication
                  </label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Password last changed: {securitySettings.passwordLastChanged}
                </p>
                <Button variant="outline">Set Up Two-Factor</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email-notifications"
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: checked as boolean,
                      })
                    }
                  />
                  <label
                    htmlFor="email-notifications"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Email Notifications
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="domain-expiry"
                    checked={notificationSettings.domainExpiryAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        domainExpiryAlerts: checked as boolean,
                      })
                    }
                  />
                  <label
                    htmlFor="domain-expiry"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Domain Expiry Alerts
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="security-alerts"
                    checked={notificationSettings.securityAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        securityAlerts: checked as boolean,
                      })
                    }
                  />
                  <label
                    htmlFor="security-alerts"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Security Alerts
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="marketing-emails"
                    checked={notificationSettings.marketingEmails}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        marketingEmails: checked as boolean,
                      })
                    }
                  />
                  <label
                    htmlFor="marketing-emails"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Marketing Emails
                  </label>
                </div>
                <Button onClick={handleNotificationSave}>Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Settings</CardTitle>
                <CardDescription>
                  Manage your API keys and settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="api-key">Your API Key</Label>
                  <div className="flex">
                    <Input
                      id="api-key"
                      value={apiSettings.apiKey}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={handleRegenerateApiKey}
                    >
                      Regenerate
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Keep this key secret. This key allows API access to your account.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="api-enabled"
                    checked={apiSettings.apiEnabled}
                    onCheckedChange={(checked) =>
                      setApiSettings({
                        ...apiSettings,
                        apiEnabled: checked as boolean,
                      })
                    }
                  />
                  <label
                    htmlFor="api-enabled"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Enable API Access
                  </label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rate-limit">Rate Limit (requests per minute)</Label>
                  <Input
                    id="rate-limit"
                    type="number"
                    value={apiSettings.rateLimit}
                    onChange={(e) =>
                      setApiSettings({
                        ...apiSettings,
                        rateLimit: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <Button>Save API Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}