"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsLoading(true);
    try {
      // Use Supabase native password reset
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        throw error;
      }

      toast.success("Password reset instructions sent to your email");
      setEmailSent(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send reset instructions");
    } finally {
      setIsLoading(false);
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
          <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we'll send you instructions to reset your password.
          </CardDescription>
        </CardHeader>
        {emailSent ? (
          <CardContent className="py-8">
            <div className="text-center text-green-600 font-medium">
              Password reset instructions have been sent to your email.
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col pt-6 pb-8">
              <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Instructions"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="mt-4"
                onClick={() => router.push("/login")}
              >
                Back to Login
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}