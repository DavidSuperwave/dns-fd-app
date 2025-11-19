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
}
        }
      }
    );

return () => {
  authListener.subscription.unsubscribe();
};
  }, [router]);

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
=======
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
>>>>>>> 6581a44820f700804ed097daf20adc1ebda4430b
