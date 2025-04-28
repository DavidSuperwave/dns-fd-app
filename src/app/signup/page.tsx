"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
// Removed supabaseAdmin import
import { generateSecurePassword } from "../../lib/supabase-client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get token and email from URL parameters
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Removed isVerifying and isInvitationValid states, verification happens on submit now

  // We still need the role for the UI description, but we get it from the API response on error/success now
  // or just display a generic message initially. Let's keep it simple for now.

  // Password setup
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Removed useEffect for initial verification - this now happens server-side on submit

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Generate a random password
  const handleGeneratePassword = async () => {
    const newPassword = generateSecurePassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);

    // Copy the new password to clipboard
    await copyToClipboard(newPassword, "Password generated and copied to clipboard!");

    // Select the password field for visibility
    if (passwordRef.current) {
      passwordRef.current.select();
    }
  };

  // Complete account setup
  const handleCompleteSignup = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    // Basic client-side checks
    if (!token || !email) {
      toast.error("Missing invitation details. Please use the link provided in your email.");
      router.push('/login'); // Redirect if essential info is missing
      return;
    }
    if (!password) {
      toast.error('Password is required');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    // Add password complexity check here if desired

    setIsLoading(true);
    const toastId = toast.loading("Setting up your account...");

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Use error message from API response if available
        throw new Error(result.error || `Server responded with ${response.status}`);
      }

      if (result.success) {
        toast.success('Account set up successfully. Redirecting to login...', { id: toastId });
        // Redirect to login after a short delay
        setTimeout(() => router.push('/login'), 1500);
      } else {
        // Should be caught by !response.ok, but handle just in case
        throw new Error(result.error || 'Signup failed for an unknown reason.');
      }

    } catch (error) {
      console.error('Error completing signup:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      // Provide specific feedback based on common errors
      let displayError = errorMessage;
      if (errorMessage.includes('Invalid or expired invitation')) {
        displayError = 'This invitation link is invalid or has expired. Please request a new one.';
        // Optionally redirect after showing the error
         setTimeout(() => router.push('/login'), 3000);
      } else if (errorMessage.includes('already registered')) {
        displayError = 'This email address is already registered. Please log in instead.';
         setTimeout(() => router.push('/login'), 3000);
      } else if (errorMessage.includes('finalize account setup')) {
         displayError = 'There was an issue finalizing your account setup. Please try again or contact support.';
      }

      toast.error(displayError, { id: toastId, duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  // Removed initial verification UI states. The form is shown directly.
  // Error handling during submit will inform the user of invalid/expired links.

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Complete Your Account Setup</CardTitle>
          <CardDescription>
            You've been invited to join Superwave.
            Set up your password to complete your account setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email || ''}
              disabled
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              <Button
                variant="link"
                className="p-0 h-auto text-xs"
                onClick={handleGeneratePassword}
              >
                Generate secure password
              </Button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                ref={passwordRef}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleCompleteSignup}
            disabled={isLoading}
          >
            {isLoading ? "Setting Up Account..." : "Complete Setup"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Loading</CardTitle>
            <CardDescription>Please wait...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <div className="animate-pulse flex space-x-4">
              <div className="rounded-full bg-slate-200 h-10 w-10"></div>
              <div className="rounded-full bg-slate-200 h-10 w-10"></div>
              <div className="rounded-full bg-slate-200 h-10 w-10"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}