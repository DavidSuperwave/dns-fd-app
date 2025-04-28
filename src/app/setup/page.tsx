"use client";

import React, { useState } from "react"; // Removed unused useEffect
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
// Keep the stashed version for client component
import { createClient } from "../../lib/supabase-client"; // Correct import
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const router = useRouter();

  // Create Supabase client instance
  const supabase = createClient();

  const createAdminAccount = async () => {
    setIsLoading(true);
    
    try {
      // Create admin user
      const { error } = await supabase.auth.signUp({ // Removed unused data variable
        email: "management@superwave.ai",
        password: "hmn7pkq.XBH9yrq_vbk",
      });
      
      if (error) {
        throw error;
      }
      
      toast.success("Admin account created successfully!");
      setIsSetupComplete(true);
    } catch (error: unknown) { // Changed type from any to unknown
      console.error("Setup error:", error);
      // Type check before accessing message property
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      if (errorMessage.includes("already registered")) {
        toast.warning("Admin account already exists");
        setIsSetupComplete(true);
      } else {
        toast.error(errorMessage || "Failed to create admin account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Initial Setup</CardTitle>
          <CardDescription className="text-center">
            Create the admin account for DNS-FD
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSetupComplete ? (
            <div className="p-4 bg-green-50 text-green-700 rounded-md">
              <p className="font-medium">Setup complete!</p>
              <p className="text-sm mt-1">Admin account has been created successfully.</p>
              <ul className="mt-2 text-sm">
                <li><strong>Email:</strong> management@superwave.ai</li>
                <li><strong>Password:</strong> hmn7pkq.XBH9yrq_vbk</li>
              </ul>
            </div>
          ) : (
            <div className="p-4 bg-blue-50 text-blue-700 rounded-md">
              <p className="font-medium">Welcome to DNS-FD Setup</p>
              <p className="text-sm mt-1">
                This will create an administrator account with the following credentials:
              </p>
              <ul className="mt-2 text-sm">
                <li><strong>Email:</strong> management@superwave.ai</li>
                <li><strong>Password:</strong> hmn7pkq.XBH9yrq_vbk</li>
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {isSetupComplete ? (
            <Button className="w-full" onClick={handleLogin}>
              Go to Login
            </Button>
          ) : (
            <Button 
              className="w-full" 
              onClick={createAdminAccount} 
              disabled={isLoading}
            >
              {isLoading ? "Creating Admin..." : "Create Admin Account"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}