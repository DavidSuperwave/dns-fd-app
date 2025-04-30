"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabase-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateSecurePassword } from "@/lib/supabase-client";

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const verifyToken = async () => {
      console.log('[DEBUG-RESET] Starting token verification');
      const token = searchParams.get('token');

      if (!token) {
        console.log('[DEBUG-RESET] No token found in URL');
        toast.error("Invalid reset link");
        router.push('/login');
        return;
      }

      try {
        // Verify token is valid and not expired
        const { data, error } = await supabaseAdmin
          .from('password_resets')
          .select('user_id, expires_at')
          .eq('token', token)
          .is('used_at', null)
          .single();

        console.log('[DEBUG-RESET] Token verification result:', { 
          success: !error, 
          hasData: !!data 
        });

        if (error || !data) {
          throw new Error('Invalid or expired reset token');
        }

        // Check if token is expired
        if (new Date(data.expires_at) < new Date()) {
          throw new Error('Reset token has expired');
        }

        setIsValidToken(true);
        console.log('[DEBUG-RESET] Token verified successfully');

      } catch (error) {
        console.error('[DEBUG-RESET] Token verification error:', error);
        toast.error(error instanceof Error ? error.message : "Invalid reset link");
        router.push('/login');
      }
    };

    verifyToken();
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DEBUG-RESET] Starting password reset');
    
    if (!isValidToken) {
      console.log('[DEBUG-RESET] Token not validated');
      toast.error("Please wait for token verification");
      return;
    }

    if (!password || !confirmPassword) {
      toast.error("Please enter and confirm your new password");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      toast.error("Missing reset token");
      return;
    }

    setIsLoading(true);
    console.log('[DEBUG-RESET] Attempting password update');

    try {
      // First, get the user_id from the valid token
      const { data: resetData } = await supabaseAdmin
        .from('password_resets')
        .select('user_id')
        .eq('token', token)
        .single();

      if (!resetData?.user_id) {
        throw new Error('Invalid reset token');
      }

      // Update the password using admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        resetData.user_id,
        { password }
      );

      if (updateError) throw updateError;

      // Mark token as used
      await supabaseAdmin
        .from('password_resets')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      console.log('[DEBUG-RESET] Password updated successfully');
      toast.success("Password reset successful!");
      
      // Give time for the toast to show
      await new Promise(resolve => setTimeout(resolve, 1500));
      router.push("/login");

    } catch (error) {
      console.error("[DEBUG-RESET] Password update error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a secure password
  const handleGeneratePassword = async () => {
    const newPassword = generateSecurePassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);
    
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success("Password generated and copied to clipboard!");
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy to clipboard');
    }

    if (passwordRef.current) {
      passwordRef.current.select();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 pt-8 pb-6">
          <div className="flex justify-center">
            <Image
              src="/superwave-logo-black.png"
              alt="Superwave Logo"
              width={180}
              height={40}
              priority
            />
          </div>
          <CardTitle className="text-2xl text-center">Reset Your Password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">New Password</Label>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm"
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
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col pt-6 pb-8">
            <Button type="submit" className="w-full" disabled={isLoading || !isValidToken}>
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}