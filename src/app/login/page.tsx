"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { useAuth } from "../../components/auth/auth-provider";
// Link component is no longer needed

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "", // Initialize with empty string
    password: "", // Initialize with empty string
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extra validation check
    if (!formData.email || !formData.password) {
      toast.error("Please enter both email and password");
      return;
    }
    
    setIsLoading(true);

    try {
      await signIn(formData.email, formData.password);
      toast.success("Logged in successfully");
      router.push("/domains");
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error instanceof Error ? error.message : "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 pt-8 pb-6"> {/* Added padding */}
          {/* Replace CardTitle with Image */}
          <div className="flex justify-center">
            <Image
              src="/superwave-logo-black.png" // Path relative to public directory
              alt="Superwave Logo"
              width={180} // Adjust width as needed
              height={40} // Adjust height based on aspect ratio
              priority // Prioritize loading the logo
            />
          </div>
          {/* Removed CardDescription */}
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-4"> {/* Adjusted padding */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {/* Make the button non-focusable and type="button" to prevent accidental form submission */}
                <Button type="button" variant="link" className="px-0 text-sm" tabIndex={-1}>
                  {/* Forgot password? - Removed functionality for now */}
                </Button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password" // Add proper autocomplete attribute
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col pt-6 pb-8"> {/* Added padding */}
            {/* Increased top margin for the button */}
            <Button type="submit" className="w-full mt-4" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
            {/* Removed the Sign up link section */}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}