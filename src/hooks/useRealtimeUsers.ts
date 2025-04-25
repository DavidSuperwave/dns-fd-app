import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabaseAdmin, UserProfile, fetchUsers } from '@/lib/supabase-client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Define the structure for the invitations table data
interface Invitation {
  id?: string; // Or token? Check table schema
  email: string;
  role: string;
  token: string;
  created_at: string;
  used_at?: string | null; // Make optional/nullable
  created_by?: string;
}

export function useRealtimeUsers(isAdmin: boolean) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let profilesSubscription: RealtimeChannel;
    let invitationsSubscription: RealtimeChannel;
    let authUnsubscribe: (() => void) | undefined;

    const loadUsers = async () => {
      try {
        const usersData = await fetchUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Error loading users:', error);
        toast.error('Failed to load users');
      } finally {
        setIsLoading(false);
      }
    };

    // Only set up subscriptions for admin users
    if (isAdmin) {
      // Subscribe to user_profiles changes
      profilesSubscription = supabaseAdmin
        .channel('user_profiles_changes')
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'user_profiles' },
          async (payload: RealtimePostgresChangesPayload<UserProfile>) => {
            console.log('Real-time profile deletion:', payload);

            // Type guard: Check if old data exists and has a valid 'id' property
            if (payload.old && 'id' in payload.old && typeof payload.old.id === 'string') {
              const deletedUserId = payload.old.id;
              const deletedUserEmail = payload.old.email; // Can still be undefined/null

              setUsers(current => current.filter(user => user.id !== deletedUserId));
              toast.info(`User removed: ${deletedUserEmail || 'Unknown email'}`);
            } else {
              console.warn('Real-time profile deletion event received, but old data or ID is missing/invalid:', payload);
            }
          }
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_profiles' },
          async (payload: RealtimePostgresChangesPayload<UserProfile>) => {
            console.log('Real-time profile insert:', payload);
            // Construct a new UserProfile object with asserted types
            // Type guard: Check if new data exists and has essential properties
            if (payload.new && 'id' in payload.new && typeof payload.new.id === 'string' && 'email' in payload.new && typeof payload.new.email === 'string') {
               const newUserProfile: UserProfile = {
                id: payload.new.id as string,
                email: payload.new.email as string,
                name: payload.new.name as string | undefined,
                role: payload.new.role as 'admin' | 'user' | 'guest' | undefined,
                active: payload.new.active as boolean | undefined,
                status: payload.new.status as 'pending' | 'active' | 'inactive' | undefined,
                created_at: payload.new.created_at as string | undefined,
                domains: payload.new.domains as string[] | undefined,
                has_2fa: payload.new.has_2fa as boolean | undefined,
              };
              setUsers(current => [...current, newUserProfile]);
              toast.info(`New user added: ${newUserProfile.email}`);
            } else {
              console.warn('Real-time profile insert event received, but new data is missing:', payload);
            }
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'user_profiles' },
          async (payload: RealtimePostgresChangesPayload<UserProfile>) => {
            console.log('Real-time profile update:', payload);
            // Type guard: Check if new data exists and has essential properties
            if (payload.new && 'id' in payload.new && typeof payload.new.id === 'string' && 'email' in payload.new && typeof payload.new.email === 'string') {
              // Construct a new UserProfile object with asserted types
              const updatedUserProfile: UserProfile = {
                id: payload.new.id as string,
                email: payload.new.email as string,
                name: payload.new.name as string | undefined,
                role: payload.new.role as 'admin' | 'user' | 'guest' | undefined,
                active: payload.new.active as boolean | undefined,
                status: payload.new.status as 'pending' | 'active' | 'inactive' | undefined,
                created_at: payload.new.created_at as string | undefined,
                domains: payload.new.domains as string[] | undefined,
                has_2fa: payload.new.has_2fa as boolean | undefined,
              };

              setUsers(current =>
                // Explicitly type the map result and use if/else
                current.map((user): UserProfile => {
                  if (user.id === updatedUserProfile.id) {
                    return updatedUserProfile; // Return the updated profile
                  }
                  return user; // Return the original profile
                })
              );
              toast.info(`User updated: ${updatedUserProfile.email}`);
            } else {
              console.warn('Real-time profile update event received, but new data or essential properties are missing/invalid:', payload);
            }
          }
        )
        .subscribe();

      // Subscribe to invitations changes
      invitationsSubscription = supabaseAdmin
        .channel('invitations_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'invitations' },
          async (payload: RealtimePostgresChangesPayload<Invitation>) => { // Use Invitation type
            console.log('Real-time invitation insert:', payload);
            // Refresh users list to include new pending invite
            await loadUsers();
            // Safely access email using optional chaining, although 'new' should exist on INSERT
            toast.info(`New invitation sent to: ${payload.new?.email || 'Unknown email'}`);
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'invitations' },
          async (payload: RealtimePostgresChangesPayload<Invitation>) => { // Use Invitation type
            console.log('Real-time invitation update:', payload);
            // If invitation was used (used_at is set), refresh users list
            // Type guard: Check if new/old data and used_at property exist before accessing
            if (payload.new && 'used_at' in payload.new && payload.new.used_at &&
                payload.old && 'used_at' in payload.old && !payload.old.used_at) {
              await loadUsers();
            }
          }
        )
        .subscribe();

      // Subscribe to auth state changes
      const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange(async (event, session) => { // Revert to supabaseAdmin as requested
        console.log('Auth state change:', event, session?.user?.email);
        
        // Handle email confirmation
        if (event === 'USER_UPDATED' && session?.user?.email_confirmed_at) {
          try {
            // Update the user profile with confirmed status
            const { error: updateError } = await supabaseAdmin
              .from('user_profiles')
              .update({
                status: 'active',
                confirmed_at: session.user.email_confirmed_at
              })
              .eq('id', session.user.id);

            if (updateError) {
              console.error('Error updating user confirmation status:', updateError);
            } else {
              console.log(`User ${session.user.email} confirmed and activated`);
              // Reload users to reflect the status change
              await loadUsers();
            }
          } catch (error) {
            console.error('Error handling user confirmation:', error);
          }
        }

        // Sync tables and refresh users on relevant auth events
        if (['SIGNED_UP', 'USER_DELETED'].includes(event)) {
          console.log('Syncing tables due to auth change...');
          
          try {
            const response = await fetch('/api/supabase/setup-tables?token=superwave-setup-database', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store'
            });
            
            if (!response.ok) {
              throw new Error('Failed to sync tables');
            }
            
            // Reload users after sync
            await loadUsers();
          } catch (error) {
            console.error('Error syncing after auth change:', error);
          }
        }
      });
      authUnsubscribe = () => subscription.unsubscribe();
    } else {
      // Non-admin users just load their own profile once
      loadUsers();
    }

    // Initial load
    loadUsers();

    // Clean up subscriptions
    return () => {
      try {
        if (profilesSubscription?.unsubscribe) {
          profilesSubscription.unsubscribe();
        }
        if (invitationsSubscription?.unsubscribe) {
          invitationsSubscription.unsubscribe();
        }
        if (typeof authUnsubscribe === 'function') {
          authUnsubscribe();
        }
      } catch (error) {
        console.error('Error cleaning up subscriptions:', error);
      }
    };
  }, [isAdmin]);

  // Expose loadUsers function for manual refresh
  const loadUsers = async () => {
    try {
      const usersData = await fetchUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  return { users, isLoading, setUsers, refresh: loadUsers };
}