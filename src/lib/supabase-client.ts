import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createStandardClient, SupabaseClient } from '@supabase/supabase-js'; // Import standard client and SupabaseClient type
// Remove unused cookies import here, it's used in layout.tsx
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'; // Import type for cookies()

// Ensure these environment variables are set!
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Service key should only be accessed server-side
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Add checks to ensure variables are loaded
if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
// REMOVED CHECK for SUPABASE_SERVICE_ROLE_KEY - This should only happen server-side


// --- Client Creation Functions ---

// Function to create a client for use in Client Components
export const createClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey);

// --- Admin Client (Server-Side ONLY) ---
// Create the admin client instance ONLY if the service key is available (server-side)
// Initialize as null or potentially throw if key is missing server-side where needed.
let supabaseAdminInstance: SupabaseClient | null = null;

if (supabaseServiceKey && typeof window === 'undefined') { // Ensure service key exists AND we are server-side
  supabaseAdminInstance = createStandardClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else if (!supabaseServiceKey && typeof window === 'undefined') {
  // Optional: Log a warning if running server-side without the key
  console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Supabase admin client cannot be created.");
}

// Export the instance. It will be null if the key is missing or if imported client-side.
// Server-side code using this MUST handle the possibility of it being null if the key isn't set.
export const supabaseAdmin = supabaseAdminInstance;

// User management functions
// !!! IMPORTANT: Many functions below previously used the removed `supabaseAdmin`.
// They MUST be refactored to be called only from server-side contexts (API routes, Server Actions)
// or modified to call server endpoints internally. Direct use from client components will fail.
export interface UserProfile extends Record<string, unknown> {
  id: string;
  email: string;
  full_name?: string | null; // Changed from name to full_name and allow null
  role?: 'admin' | 'user' | 'guest';
  active?: boolean;
  status?: 'pending' | 'active' | 'inactive';
  created_at?: string;
  domains?: string[]; // Array of domain IDs assigned to the user
  has_2fa?: boolean; // Whether 2FA is enabled for the user
}

// Create a new invited user in Supabase
export async function createInvitedUser(
  email: string,
  role: string = 'user',
  invitedBy?: string
): Promise<UserProfile | null> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context (API route, Server Action)
  // where an admin client (using the service key) can be safely created and used.
  throw new Error("createInvitedUser cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  try {
    const tempPassword = generateSecurePassword(16);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ // <<< PROBLEM: supabaseAdmin removed
      email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: {
        name: email.split('@')[0],
        role: role,
        status: 'pending',
        invitedBy: invitedBy || 'unknown'
      }
    });

    if (error) {
      // Log raw error first
      console.error('Raw auth error:', error);

      // Get error details from Supabase error structure
      const errorDetails = {
        message: error.message,
        name: error.name,
        // Only include properties that exist on AuthError
        context: 'createInvitedUser auth error',
        email,
        role
      };

      console.error('Error creating invited user:', errorDetails);

      // Try to get the most descriptive message
      const errorMessage = error.message || 'Failed to create user';

      throw new Error(errorMessage);
    }

    if (!data?.user) {
      throw new Error('No user data returned from auth creation');
    }

    // Create the user profile
    const profile: UserProfile = {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.email?.split('@')[0] || 'Unknown',
      role: role as 'admin' | 'user' | 'guest',
      active: true,
      status: 'pending',
      created_at: data.user.created_at
    };

    // Insert into user_profiles table with upsert
    const { error: profileError } = await supabaseAdmin // <<< PROBLEM: supabaseAdmin removed
      .from('user_profiles')
      .upsert([profile as Record<string, unknown>], {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (profileError) {
      // Log raw error first
      console.error('Raw profile error:', profileError);

      // Get error details from Supabase error structure
      const errorDetails = {
        message: profileError.message,
        name: profileError.name,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
        profile: profile,
        context: 'createInvitedUser'
      };

      console.error('Error creating user profile:', errorDetails);

      // Delete the auth user since profile creation failed
      try {
        await supabaseAdmin.auth.admin.deleteUser(profile.id); // <<< PROBLEM: supabaseAdmin removed
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }

      // Try to get the most descriptive message
      const errorMessage =
        profileError.message ||
        profileError.details ||
        profileError.hint ||
        'Failed to create user profile';

      throw new Error(errorMessage);
    }

    return profile;
  } catch (error) {
    // Log raw error first
    console.error('Raw catch error:', error);

    // Get error details
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      email,
      role,
      context: 'createInvitedUser catch block'
    };

    console.error('Error in createInvitedUser:', errorDetails);
    throw error;
  }
  */
}

// Domain management interfaces
export interface Domain {
  id: string;
  name: string;
  status: string;
  user_id?: string; // ID of the user this domain is assigned to
}

// Fetch all users from Supabase
// Accepts a Supabase browser client instance
export async function fetchUsers(client: ReturnType<typeof createClient>): Promise<UserProfile[]> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed for admin checks/fetches.
  // Fetching all users requires admin privileges and must happen server-side.
  // This function needs significant refactoring. It can only fetch the *current* user's profile safely now.
  // Option 1: Call an API route from the client-side component that uses this.
  // Option 2: If used in a Server Component, create/use a server client there.
  try {
    console.log('fetchUsers: Starting...');

    // Try to get current user using the provided client
    const { data: { user } } = await client.auth.getUser();
    console.log('fetchUsers: Current user:', user?.email);

    // If no user is logged in, return empty array immediately
    if (!user) {
      console.warn('fetchUsers: No authenticated user found. Returning empty list.');
      return [];
    }

    // Check if user is admin (no need for ?. now user is guaranteed)
    const isAdmin = user.email === 'management@superwave.ai' ||
                   user.user_metadata?.role === 'admin';
    console.log('fetchUsers: Is admin?', isAdmin);

    // If not admin, only show own profile (no need for && user now)
    if (!isAdmin) {
      // Use the provided client (safe for browser) to get the current user's profile
      const { data: ownProfile, error: profileError } = await client
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('fetchUsers: Error fetching own profile:', profileError);
        return [];
      }

      if (ownProfile && typeof ownProfile === 'object' && 'id' in ownProfile && 'email' in ownProfile) {
  return [ownProfile as UserProfile];
}
return [];

    }

    // --- Admin-only logic removed ---
    // Fetching all users requires admin privileges and must be done server-side.
    // The code below is commented out as it relied on the removed `supabaseAdmin`.
    /*
    // For admins, fetch both active users and pending invitations
    const [profilesResponse, invitationsResponse] = await Promise.all([
      // Fetch user profiles - REQUIRES ADMIN CLIENT
      supabaseAdmin
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false }),

      // Fetch pending invitations - REQUIRES ADMIN CLIENT
      supabaseAdmin
        .from('invitations')
        .select('*')
        .is('used_at', null)
        .order('created_at', { ascending: false })
    ]);

    if (profilesResponse.error) {
      console.error('fetchUsers: Error fetching profiles:', profilesResponse.error);
      throw profilesResponse.error;
    }
     if (invitationsResponse.error) { // Check added for completeness
       console.error('fetchUsers: Error fetching invitations:', invitationsResponse.error);
       // Decide how to handle this - maybe return only profiles?
       // For now, let's throw to indicate partial failure
       throw invitationsResponse.error;
     }

    const activeUsers = profilesResponse.data || [];
    const pendingInvites = (invitationsResponse.data || []).map(invite => ({
      id: invite.token, // Use token as temporary ID
      email: invite.email,
      role: invite.role,
      status: 'pending',
      active: false,
      created_at: invite.created_at
    }));

    // Combine active users and pending invites
    return [
      ...activeUsers.map((user) => user as UserProfile),
      ...pendingInvites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        active: invite.active,
        created_at: invite.created_at,
      }) as UserProfile),
    ];
    */
   // If execution reaches here as admin, it means the admin-specific logic
   // needs to be implemented server-side. Return empty for now.
   console.warn("fetchUsers: Admin user detected, but fetching all users requires a server-side implementation.");
   return [];

  } catch (error) {
    console.error('Error in fetchUsers:', error);
    throw error; // Re-throw original error
  }
}

// Create a new user in Supabase
export async function createUser(email: string, password: string, userData: Partial<UserProfile>): Promise<UserProfile | null> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context.
  throw new Error("createUser cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ // <<< PROBLEM: supabaseAdmin removed
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: userData.name,
      role: userData.role || 'user',
      status: userData.status || 'active'
    }
  });

  if (error) {
    console.error('Error creating user:', error);
    return null;
  }

  const profile: UserProfile = {
    id: data.user.id,
    email: data.user.email || '',
    name: userData.name || data.user.email?.split('@')[0] || 'Unknown',
    role: userData.role || 'user',
    active: true,
    status: userData.status || 'active',
    created_at: data.user.created_at
  };

  // Insert into user_profiles table
  const { error: profileError } = await supabaseAdmin // <<< PROBLEM: supabaseAdmin removed
    .from('user_profiles')
    .insert([profile]);

  if (profileError) {
    console.error('Error creating user profile:', profileError);
    return null;
  }

  return profile;
  */
}

// Update a user in Supabase
export async function updateUser(id: string, userData: Partial<UserProfile>): Promise<boolean> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context.
  throw new Error("updateUser cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { // <<< PROBLEM: supabaseAdmin removed
    user_metadata: {
      name: userData.name,
      role: userData.role
    },
    email: userData.email
  });

  if (error) {
    console.error('Error updating user:', error);
    return false;
  }

  return true;
  */
}

// Delete a user in Supabase
export async function deleteUser(id: string): Promise<boolean> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context.
  throw new Error("deleteUser cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(id); // <<< PROBLEM: supabaseAdmin removed

    const { error: profileError } = await supabaseAdmin // <<< PROBLEM: supabaseAdmin removed
      .from('user_profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      console.error('Error deleting user profile:', profileError);
      throw profileError;
    }

    if (!userError && userData?.user) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id); // <<< PROBLEM: supabaseAdmin removed
      if (authError) {
        console.error('Error deleting auth user:', authError);
        throw authError;
      }
    }

    return true;
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return false;
  }
  */
}

// Activate or deactivate a user
export async function toggleUserStatus(id: string, active: boolean): Promise<boolean> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context.
  throw new Error("toggleUserStatus cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { // <<< PROBLEM: supabaseAdmin removed
    user_metadata: {
      is_banned: !active
    }
  });

  if (error) {
    console.error(`Error ${active ? 'activating' : 'deactivating'} user:`, error);
    return false;
  }

  return true;
  */
}

// Change user password
export async function changePassword(id: string, newPassword: string): Promise<boolean> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context.
  throw new Error("changePassword cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { // <<< PROBLEM: supabaseAdmin removed
    password: newPassword
  });

  if (error) {
    console.error('Error changing password:', error);
    return false;
  }
  return true;
  */
}

// Domain management functions

// Assign a domain to a user
export async function assignDomainToUser(userId: string, domainId: string): Promise<boolean> { // Removed unused domainName
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context.
  throw new Error("assignDomainToUser cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId); // <<< PROBLEM: supabaseAdmin removed

  if (userError || !userData.user) {
    console.error('Error fetching user for domain assignment:', userError);
    return false;
  }

  const currentDomains = userData.user.user_metadata?.domains || [];

  if (!currentDomains.includes(domainId)) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { // <<< PROBLEM: supabaseAdmin removed
      user_metadata: {
        ...userData.user.user_metadata,
        domains: [...currentDomains, domainId],
      }
    });

    if (error) {
      console.error('Error assigning domain to user:', error);
      return false;
    }

    return true;
  }

  return true;
  */
}

// Remove a domain assignment from a user
export async function removeDomainFromUser(userId: string, domainId: string): Promise<boolean> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context.
  throw new Error("removeDomainFromUser cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId); // <<< PROBLEM: supabaseAdmin removed

  if (userError || !userData.user) {
    console.error('Error fetching user for domain removal:', userError);
    return false;
  }

  const currentDomains = userData.user.user_metadata?.domains || [];

  if (currentDomains.includes(domainId)) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { // <<< PROBLEM: supabaseAdmin removed
      user_metadata: {
        ...userData.user.user_metadata,
        domains: currentDomains.filter((id: string) => id !== domainId),
      }
    });

    if (error) {
      console.error('Error removing domain from user:', error);
      return false;
    }

    return true;
  }

  return true;
  */
}

// Delete a domain from Cloudflare and remove all assignments
// Accepts a Supabase client instance (server or browser)
export async function deleteDomainAndAssignments(
  domainId: string,
  client: ReturnType<typeof createClient> // Use browser client type
): Promise<boolean> {
  // !!! IMPORTANT: This function uses supabaseAdmin indirectly via removeDomainFromUser and fetchUsers.
  // This function MUST be called from a server-side context or refactored
  // to call API endpoints for the user/domain removal parts.
  throw new Error("deleteDomainAndAssignments cannot be called from client-side code. Refactor required.");
  /* Original code:
  try {
    const response = await fetch(`/api/cloudflare/domains/${domainId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete domain from Cloudflare: ${error.message || response.statusText}`);
    }

    // Now, fetch all users using the provided client to remove domain assignments
    const users = await fetchUsers(client); // <<< PROBLEM: fetchUsers needs admin client

    // For each user with this domain assigned
    for (const user of users) {
      if (user.domains?.includes(domainId)) {
        // This call will fail as removeDomainFromUser requires admin client
        await removeDomainFromUser(user.id, domainId);
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting domain:', error);
    return false;
  }
  */
}

// Get all domains assigned to a user
export async function getAssignedDomains(userId: string): Promise<Domain[]> {
  // !!! IMPORTANT: This function uses supabaseAdmin which was removed.
  // This function MUST be called from a server-side context.
  throw new Error("getAssignedDomains cannot be called from client-side code. Refactor to use a server-side endpoint.");
  /* Original code:
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId); // <<< PROBLEM: supabaseAdmin removed

  if (userError || !userData.user) {
    console.error('Error fetching user for domain list:', userError);
    return []; // Return empty array on error
  }

  // Get domain IDs from metadata
  const domainIds = userData.user.user_metadata?.domains || [];

  if (domainIds.length === 0) {
    return [];
  }

  // Fetch domains from Cloudflare
  try {
    // You can fetch this from your Cloudflare API endpoint
    const response = await fetch(`/api/cloudflare/domains?ids=${domainIds.join(',')}`);

    if (!response.ok) {
      throw new Error('Failed to fetch domains');
    }

    const domains = await response.json();
    return domains;
  } catch (error) {
    console.error('Error fetching assigned domains:', error);
    return [];
  }
  */
  return []; // Return empty array as placeholder
}

// Generate a secure random password
export function generateSecurePassword(length = 12): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
  const specialChars = '!@#$%^&*()_+';
  const numbers = '0123456789';
  const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Ensure we have at least one of each type
  let password = '';
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += upperCase.charAt(Math.floor(Math.random() * upperCase.length));

  // Fill the rest with random characters
  for (let i = 3; i < length; i++) {
    password += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}