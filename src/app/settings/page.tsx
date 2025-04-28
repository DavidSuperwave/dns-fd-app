"use client";

import React, { useState, useEffect, useRef, RefObject } from "react";
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
import { toast } from "sonner";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { QRCodeSVG } from 'qrcode.react';
import { generateSecurePassword } from "../../lib/supabase-client";
import { supabase } from "../../lib/supabase-browser";

export default function SettingsPage() {
  // User profile settings
  const [userEmail, setUserEmail] = useState<string>("management@superwave.ai");
  // Removed unused userRole state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    passwordLastChanged: new Date().toISOString().split("T")[0],
    twoFactorSecret: "",
    twoFactorUri: "",
  });
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(false);
  
  // Password fields
  const [passwordFields, setPasswordFields] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  // Refs for copying
  const passwordRef = useRef<HTMLInputElement>(null);
  const twoFactorSecretRef = useRef<HTMLInputElement>(null);

  // Handle profile save
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        email: userEmail
      });
      
      if (error) {
        throw error;
      }
      
      toast.success("Email updated successfully");
    } catch (error) {
      console.error("Error updating email:", error);
      toast.error("Failed to update email");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordFields.newPassword !== passwordFields.confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    
    if (!passwordFields.currentPassword || !passwordFields.newPassword) {
      toast.error("All password fields are required");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: passwordFields.currentPassword,
      });
      
      if (signInError) {
        toast.error("Current password is incorrect");
        setIsLoading(false);
        return;
      }
      
      const { error } = await supabase.auth.updateUser({
        password: passwordFields.newPassword
      });
      
      if (error) {
        throw error;
      }
      
      setPasswordFields({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      
      setSecuritySettings(prev => ({
        ...prev,
        passwordLastChanged: new Date().toISOString().split("T")[0],
      }));
      
      toast.success("Password changed successfully");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate password
  const generatePassword = () => {
    const newPassword = generateSecurePassword();
    setPasswordFields({
      ...passwordFields,
      newPassword,
      confirmPassword: newPassword,
    });
    
    setTimeout(() => {
      if (passwordRef.current) {
        passwordRef.current.select();
        document.execCommand('copy');
        toast.success("Password generated and copied to clipboard!");
      }
    }, 100);
  };

  // Copy to clipboard helper
  const copyToClipboard = (ref: RefObject<HTMLInputElement | null>, message: string) => {
    if (ref.current) {
      ref.current.select();
      document.execCommand('copy');
      toast.success(message);
    }
  };

  // Get current user on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserEmail(data.user.email || "management@superwave.ai");
        
        const role = data.user.user_metadata?.role as string;
        const email = data.user.email;
        const isAdminEmail = email === 'management@superwave.ai';
        
        // Removed setting unused userRole state
        setIsAdmin(isAdminEmail || role === 'admin');
        
        if (data.user.user_metadata?.totp_secret) {
          setSecuritySettings(prev => ({
            ...prev,
            twoFactorEnabled: true,
            twoFactorSecret: data.user.user_metadata.totp_secret,
            twoFactorUri: `otpauth://totp/Superwave:${data.user.email}?secret=${data.user.user_metadata.totp_secret}&issuer=Superwave`
          }));
        }
      }
    };
    
    fetchUserProfile();
  }, []);

  // Helper function to generate a TOTP secret
  const generateTOTPSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 16; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  };

  // Setup 2FA
  const setup2FA = async () => {
    setIs2FALoading(true);
    try {
      const secret = await generateTOTPSecret();
      const uri = `otpauth://totp/Superwave:${userEmail}?secret=${secret}&issuer=Superwave`;
      setSecuritySettings(prev => ({
        ...prev,
        twoFactorSecret: secret,
        twoFactorUri: uri
      }));
      toast.success("2FA setup ready - scan the QR code with your authenticator app");
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      toast.error("Failed to set up 2FA");
    } finally {
      setIs2FALoading(false);
    }
  };

  // Enable 2FA
  const enable2FA = async () => {
    setIs2FALoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          totp_secret: securitySettings.twoFactorSecret,
          totp_enabled: true
        }
      });
      if (error) throw error;
      setSecuritySettings(prev => ({
        ...prev,
        twoFactorEnabled: true
      }));
      toast.success("Two-factor authentication enabled successfully");
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      toast.error("Failed to enable 2FA");
    } finally {
      setIs2FALoading(false);
    }
  };

  // Disable 2FA
  const disable2FA = async () => {
    setIs2FALoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          totp_secret: null,
          totp_enabled: false
        }
      });
      if (error) throw error;
      setSecuritySettings(prev => ({
        ...prev,
        twoFactorEnabled: false,
        twoFactorSecret: "",
        twoFactorUri: ""
      }));
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      toast.error("Failed to disable 2FA");
    } finally {
      setIs2FALoading(false);
    }
  };


  return (
    <DashboardLayout>
      <div className="w-full max-w-full px-4 py-6 md:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        {/* Account Settings */}
        <div className="space-y-6">
          {/* Email settings */}
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

          {/* Password settings */}
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
                  <Input
                    id="current-password"
                    type="password"
                    value={passwordFields.currentPassword}
                    onChange={(e) =>
                      setPasswordFields({
                        ...passwordFields,
                        currentPassword: e.target.value
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordFields.newPassword}
                      onChange={(e) =>
                        setPasswordFields({
                          ...passwordFields,
                          newPassword: e.target.value
                        })
                      }
                      ref={passwordRef}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generatePassword}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordFields.confirmPassword}
                    onChange={(e) =>
                      setPasswordFields({
                        ...passwordFields,
                        confirmPassword: e.target.value
                      })
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Password last changed: {securitySettings.passwordLastChanged}
                </p>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!securitySettings.twoFactorEnabled && !securitySettings.twoFactorSecret && (
                <>
                  <p>Two-factor authentication is not enabled. Set it up for increased security.</p>
                  <Button
                    variant="outline"
                    onClick={setup2FA}
                    disabled={is2FALoading}
                  >
                    {is2FALoading ? "Setting up..." : "Set Up Two-Factor"}
                  </Button>
                </>
              )}

              {!securitySettings.twoFactorEnabled && securitySettings.twoFactorSecret && (
                <>
                  <p className="font-medium">Scan this QR code with your authenticator app:</p>
                  <div className="bg-white p-4 inline-block rounded-md">
                    <QRCodeSVG value={securitySettings.twoFactorUri} size={200} />
                  </div>
                  
                  <div className="grid gap-2 mt-4">
                    <Label htmlFor="totp-secret">Or enter this code manually:</Label>
                    <div className="flex gap-2">
                      <Input
                        id="totp-secret"
                        value={securitySettings.twoFactorSecret}
                        readOnly
                        ref={twoFactorSecretRef}
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => copyToClipboard(twoFactorSecretRef, "Secret copied to clipboard!")}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    onClick={enable2FA}
                    disabled={is2FALoading}
                    className="mt-4"
                  >
                    {is2FALoading ? "Enabling..." : "Enable Two-Factor Authentication"}
                  </Button>
                </>
              )}

              {securitySettings.twoFactorEnabled && (
                <>
                  <div className="flex items-center gap-2 text-green-600 mb-4">
                    <div className="bg-green-100 p-1 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="font-medium">Two-factor authentication is enabled</span>
                  </div>
                  
                  <p>Your account is secured with two-factor authentication. If you want to disable it, click the button below.</p>
                  
                  <Button
                    variant="destructive"
                    onClick={disable2FA}
                    disabled={is2FALoading}
                    className="mt-2"
                  >
                    {is2FALoading ? "Disabling..." : "Disable Two-Factor Authentication"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Admin Settings */}
        {isAdmin && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Admin Settings</h2>
            <Card>
              <CardHeader>
                <CardTitle>Supabase Admin Configuration</CardTitle>
                <CardDescription>
                  Ensure your Supabase admin status is properly synchronized.
                  This is required to manage users and perform administrative tasks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
                    <p className="flex items-center text-amber-800 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Important:</span>
                    </p>
                    <p className="text-sm text-amber-800">
                      If you are <strong>management@superwave.ai</strong> but don&apos;t see admin privileges or can&apos;t manage users,
                      use the sync button below to fix your permissions.
                    </p>
                  </div>
                  
                  <div className="flex space-x-4">
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/supabase/sync', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            }
                          });
                          
                          const data = await response.json();
                          
                          if (response.ok && data.success) {
                            toast.success("Supabase admin permissions synchronized successfully!");
                            // Force refresh the page to apply changes
                            window.location.reload();
                          } else {
                            toast.error(`Sync failed: ${data.error || 'Unknown error'}`);
                          }
                        } catch (error) {
                          console.error('Error syncing Supabase admin:', error);
                          toast.error("Failed to sync Supabase admin permissions");
                        }
                      }}
                      className="flex items-center"
                    >
                      Sync Admin Permissions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}