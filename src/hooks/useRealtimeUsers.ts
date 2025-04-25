import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabaseAdmin, UserProfile, fetchUsers } from '@/lib/supabase-client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
            setUsers(current => current.filter(user => user.id !== payload.old.id));
            toast.info(`User removed: ${payload.old.email}`);
          }
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_profiles' },
          async (payload: RealtimePostgresChangesPayload<UserProfile>) => {
            console.log('Real-time profile insert:', payload);
            setUsers(current => [...current, payload.new]);
            toast.info(`New user added: ${payload.new.email}`);
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'user_profiles' },
          async (payload: RealtimePostgresChangesPayload<UserProfile>) => {
            console.log('Real-time profile update:', payload);
            setUsers(current =>
              current.map(user =>
                user.id === payload.new.id ? payload.new : user
              )
            );
            toast.info(`User updated: ${payload.new.email}`);
          }
        )
        .subscribe();

      // Subscribe to invitations changes
      invitationsSubscription = supabaseAdmin
        .channel('invitations_changes')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'invitations' },
          async (payload: RealtimePostgresChangesPayload<any>) => {
            console.log('Real-time invitation insert:', payload);
            // Refresh users list to include new pending invite
            await loadUsers();
            toast.info(`New invitation sent to: ${payload.new.email}`);
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'invitations' },
          async (payload: RealtimePostgresChangesPayload<any>) => {
            console.log('Real-time invitation update:', payload);
            // If invitation was used (used_at is set), refresh users list
            if (payload.new.used_at && !payload.old.used_at) {
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