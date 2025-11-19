"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client"; // Import createClient, removed supabaseAdmin
import { User } from "@supabase/supabase-js";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null; // Make initialSession optional
}

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: (force?: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, initialSession }: AuthProviderProps) { // Accept initialSession prop
  // Create the Supabase client instance for the browser
  const supabase = createClient();

  // Function to check if user is admin
  const checkAdminStatus = (user: User | null): boolean => {
    if (!user) return false;

    // Check if this is the admin email
    const isAdminEmail = user.email === 'admin@superwave.io';

    // Check if role is admin in user metadata
    const hasAdminRole = user.user_metadata?.role === 'admin';

    // Log for debugging
    console.log(`[Auth Provider] Admin check for ${user.email}:`, {
      isAdminEmail,
      hasAdminRole,
      metadata: user.user_metadata
    });

    return isAdminEmail || hasAdminRole;
  };


  // Initialize state with the server-fetched session
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [isAdmin, setIsAdmin] = useState(checkAdminStatus(initialSession?.user ?? null));
  const [isLoading, setIsLoading] = useState(false); // Start as false since we have initial data
  const router = useRouter();

  // Last refresh timestamp to prevent excessive refreshes
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  // Function to refresh session - with rate limiting to prevent excessive calls
  const refreshSession = async (force = false) => {
    // Only refresh if more than 10 seconds have passed since last refresh, unless forced
    const now = Date.now();
    if (!force && now - lastRefreshTime < 10000) {
      console.log('[Auth Provider] Skipping refresh - too soon since last refresh');
      return;
    }

    console.log('[Auth Provider] Refreshing session');
    setIsLoading(true);

    try {
      // Don't refresh if we don't have a session, just get the current session
      const { data: currentData } = await supabase.auth.getSession();
      if (!currentData.session) {
        console.log('[Auth Provider] No active session to refresh');
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        return;
      }

      // Get user data without forcing token refresh
      const { data: userData } = await supabase.auth.getUser();

      // Only update admin status without refreshing token
      if (userData.user) {
        const adminStatus = checkAdminStatus(userData.user);
        setUser(userData.user);
        setSession(currentData.session);
        setIsAdmin(adminStatus);
        setLastRefreshTime(now);

        console.log('[Auth Provider] Updated user data:', {
          email: userData.user.email,
          isAdmin: adminStatus
        });
      }
    } catch (error) {
      console.error("Error refreshing session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // No need for initial getSession call here anymore,
    // as we initialize state with initialSession from the server.
    // We still need the listener for client-side changes.

    console.log('[Auth Provider] Setting up onAuthStateChange listener.');
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        // Use the session from the event listener
        const currentUser = currentSession?.user ?? null;
        setSession(currentSession);
        setUser(currentUser);
        setIsAdmin(checkAdminStatus(currentUser));

        console.log(`[Auth Provider] Auth state changed (${event}):`, {
          user: currentUser?.email,
          isAdmin: checkAdminStatus(currentUser)
        });

        if (event === "SIGNED_OUT") {
          // Clear all auth state
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          window.localStorage.removeItem('supabase.auth.token');
          router.push("/login");
        } else if (event === "SIGNED_IN") {
          if (!currentUser) return;

          const signIn = async (email: string, password: string) => {
            setIsLoading(true);
            try {
              const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
              });

              if (error) {
                throw error;
              }

              if (!data?.user) {
                throw new Error('No user data returned');
              }

            } catch (error: unknown) {
              console.error('Sign in error:', error);
              const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
              throw new Error(errorMessage || "Error signing in");
            } finally {
              setIsLoading(false);
            }
          };

          const signOut = async () => {
            try {
              setIsLoading(true);
              // Clear all auth data
              await supabase.auth.signOut();
              // Clear local state
              setUser(null);
              setSession(null);
              setIsAdmin(false);
              // Clear any stored auth data
              window.localStorage.removeItem('supabase.auth.token');
              // Force redirect to login
              router.push('/login');
            } catch (error: unknown) {
              console.error("Error signing out:", error);
            } finally {
              setIsLoading(false);
            }
          };

          const value = {
            user,
            session,
            isLoading,
            isAdmin,
            signIn,
            signOut,
            refreshSession,
          };

          return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
        }

        export function useAuth() {
          const context = useContext(AuthContext);
          if (context === undefined) {
            throw new Error("useAuth must be used within an AuthProvider");
          }
          return context;
        }