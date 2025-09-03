"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
  const [isValidSession, setIsValidSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { supabase } = await import('@/lib/supabase-browser');
        
        // Listen for auth state changes to catch the session after token verification
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log("Auth state change:", event, session);
          
          if (event === 'PASSWORD_RECOVERY' || (session?.user && event === 'SIGNED_IN')) {
            setIsValidSession(true);
            setUserEmail(session.user.email || null);
            console.log("Password recovery session established for:", session.user.email);
          } else if (event === 'SIGNED_OUT' || !session) {
            // Only redirect if we haven't established a valid session yet
            if (!isValidSession) {
              console.log("No valid session found, redirecting to login");
              setTimeout(() => {
                toast.error("Invalid or expired reset link");
                router.push("/login");
              }, 3000); // Give more time for auth state to settle
            }
          }
        });
        
        // Also check current session immediately
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log("Current session:", session, error);
        
        if (session?.user) {
          setIsValidSession(true);
          setUserEmail(session.user.email || null);
        }
        
        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (error) {
        console.error("Session check error:", error);
        setTimeout(() => {
          toast.error("Invalid reset link");
          router.push("/login");
        }, 3000);
      }
    };

    checkSession();
  }, [router, isValidSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidSession) {
      toast.error("Invalid or expired reset link");
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

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      // Use Supabase's native password update
      const { supabase } = await import('@/lib/supabase-browser');
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      });

      if (error) {
        throw error;
      }

      toast.success("Password reset successful!");
      
      // Sign out the user after password reset
      await supabase.auth.signOut();
      
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.push("/login");
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePassword = async () => {
    const newPassword = generateSecurePassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);

    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success("Password generated and copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy to clipboard");
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
            {userEmail && (
              <span className="block mb-2 font-medium">
                Resetting password for: {userEmail}
              </span>
            )}
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        {isValidSession ? (
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
                    placeholder="Enter new password"
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
                  placeholder="Confirm new password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col pt-6 pb-8">
              <Button type="submit" className="w-full" disabled={isLoading || !isValidSession}>
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="py-8">
            <div className="text-center text-gray-600">
              <div className="mb-2">Validating reset link...</div>
              <div className="text-sm text-gray-500">
                This may take a few seconds while we verify your identity.
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}