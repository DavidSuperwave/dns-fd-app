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
import { supabaseAdmin, generateSecurePassword } from "../../lib/supabase-client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get token and email from URL parameters
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [isInvitationValid, setIsInvitationValid] = useState<boolean>(false);
  interface InvitationData {
    email: string;
    role: string;
    token: string;
    created_at: string;
    created_by: string;
  }
  
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  
  // Password setup
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  
  // Verify the invitation on component mount
  useEffect(() => {
    const verifyInvitation = async () => {
      if (!token || !email) {
        setIsVerifying(false);
        router.push('/login');
        return;
      }

      try {
        // Verify invitation in database
        const { data: invitations, error: verifyError } = await supabaseAdmin
          .from('invitations')
          .select('*')
          .eq('token', token || '')
          .eq('email', email)
          .is('used_at', null)
          .single();

        if (verifyError || !invitations) {
          console.error('Error verifying invitation:', verifyError);
          toast.error('Invalid or expired invitation');
          setIsInvitationValid(false);
          router.push('/login');
          return;
        }

        setIsInvitationValid(true);
        // Construct a new object with the correct type
        if (invitations) {
          const newInvitationData: InvitationData = {
            email: invitations.email as string, // Assert type
            role: invitations.role as string, // Assert type
            token: invitations.token as string, // Assert type
            created_at: invitations.created_at as string, // Assert type
            created_by: invitations.created_by as string, // Assert type
          };
          setInvitationData(newInvitationData);
        }
      } catch (error) {
        console.error('Error verifying invitation:', error);
        toast.error('Error verifying invitation');
        router.push('/login');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyInvitation();
  }, [token, email, router]);

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
    if (!email) {
      toast.error('Email is required');
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

    setIsLoading(true);

    try {
      // Step 1: Verify invitation is still valid
      const { data: invitation, error: inviteError } = await supabaseAdmin
        .from('invitations')
        .select('*')
        .eq('token', token || '')
        .eq('email', email)
        .is('used_at', null)
        .single();

      if (inviteError || !invitation) {
        console.error('[Signup] Invalid or expired invitation:', inviteError);
        throw new Error('Invalid or expired invitation');
      }

      // Step 2: Create the auth user
      // Create user with admin API to bypass email confirmation
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          name: email.split('@')[0],
          role: invitation.role
        },
        email_confirm: true,
        app_metadata: { provider: 'email' }
      });

      if (createError) {
        console.error('[Signup] admin.createUser failed:', createError);
        throw createError;
      }

      if (!createData.user) {
        throw new Error('No user data returned from admin.createUser');
      }

      const userId = createData.user.id;

      try {
        // Step 3: Mark invitation as used first
        const { error: markUsedError } = await supabaseAdmin
          .from('invitations')
          .update({ used_at: new Date().toISOString() })
          .eq('token', token || '');

        if (markUsedError) {
          console.error('[Signup] Error marking invitation as used:', markUsedError);
          throw markUsedError;
        }

        // Step 4: Create active user profile with confirmed status
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: userId,
            email: email,
            name: email.split('@')[0],
            role: invitation.role,
            status: 'active',
            active: true,
            confirmed_at: new Date().toISOString()
          });

        if (profileError) {
          console.error('[Signup] Profile creation failed:', profileError);
          throw profileError;
        }

        toast.success('Account set up successfully. Please log in.');
        router.push('/login');

      } catch (error) {
        // Cleanup: Delete the auth user if any step failed
        console.error('[Signup] Error during post-creation steps, cleaning up auth user:', userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw error;
      }
    } catch (error) {
      console.error('Error setting up account:', error);
      toast.error(error instanceof Error ? error.message : 'Error setting up account');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Verifying Invitation</CardTitle>
            <CardDescription>Please wait while we verify your invitation...</CardDescription>
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
    );
  }

  if (!isInvitationValid) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>The invitation link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-6">
            <p>Please contact your administrator for a new invitation.</p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push('/login')}>Go to Login</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Complete Your Account Setup</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join Superwave as a{" "}
            <span className="font-semibold">{invitationData?.role || 'user'}</span>.
            Set up your password to get started.
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