import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createStandardClient } from '@supabase/supabase-js'; // Import standard client
// Remove unused cookies import here, it's used in layout.tsx
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'; // Import type for cookies()

// Ensure these environment variables are set!
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Add checks to ensure variables are loaded
if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
if (!supabaseServiceKey) {
  // Throw error as the admin client requires the service key
  throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
}


// --- Client Creation Functions ---

// Function to create a client for use in Client Components
export const createClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey);

// createServerClientWrapper removed as client is now created directly in RootLayout
// --- Admin Client (Singleton - OK as it uses service key) ---
let supabaseAdminInstance: ReturnType<typeof createStandardClient> | null = null;

export const supabaseAdmin = (() => {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createStandardClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        // Explicitly disable auto-refreshing tokens for service role
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdminInstance;
})();

// User management functions
export interface UserProfile extends Record<string, unknown> {
  id: string;
  email: string;
  name?: string;
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
  try {
    // Generate a temporary password that will be changed on first login
    const tempPassword = generateSecurePassword(16);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false, // Don't auto-confirm email for invited users
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
    const { error: profileError } = await supabaseAdmin
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
        await supabaseAdmin.auth.admin.deleteUser(profile.id);
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
    throw error; // Re-throw the original error to preserve stack trace
  }
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
      const { data: ownProfile, error: profileError } = await supabaseAdmin
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

    // For admins, fetch both active users and pending invitations
    const [profilesResponse, invitationsResponse] = await Promise.all([
      // Fetch user profiles
      supabaseAdmin
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false }),

      // Fetch pending invitations
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
    

  } catch (error) {
    console.error('Error in fetchUsers:', error);
    throw error;
  }
}

// Create a new user in Supabase
export async function createUser(email: string, password: string, userData: Partial<UserProfile>): Promise<UserProfile | null> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
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
  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .insert([profile]);

  if (profileError) {
    console.error('Error creating user profile:', profileError);
    return null;
  }

  return profile;
}

// Update a user in Supabase
export async function updateUser(id: string, userData: Partial<UserProfile>): Promise<boolean> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
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
}

// Delete a user in Supabase
export async function deleteUser(id: string): Promise<boolean> {
  try {
    // First check if the user exists in auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
    
    // Delete from user_profiles first (this will cascade delete related records)
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      console.error('Error deleting user profile:', profileError);
      throw profileError;
    }

    // If user exists in auth, delete them
    if (!userError && userData?.user) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
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
}

// Activate or deactivate a user
export async function toggleUserStatus(id: string, active: boolean): Promise<boolean> {
  // Update user metadata to store their active status
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    user_metadata: {
      is_banned: !active
    }
  });

  if (error) {
    console.error(`Error ${active ? 'activating' : 'deactivating'} user:`, error);
    return false;
  }

  return true;
}

// Change user password
export async function changePassword(id: string, newPassword: string): Promise<boolean> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password: newPassword
  });

  if (error) {
    console.error('Error changing password:', error);
    return false;
  }
  return true;
}

// Domain management functions

// Assign a domain to a user
export async function assignDomainToUser(userId: string, domainId: string): Promise<boolean> { // Removed unused domainName
  // Get current user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (userError || !userData.user) {
    console.error('Error fetching user for domain assignment:', userError);
    return false;
  }

  // Get current domain assignments
  const currentDomains = userData.user.user_metadata?.domains || [];

  // Add domain if not already assigned
  if (!currentDomains.includes(domainId)) {
    // Update user metadata
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
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

  return true; // Domain was already assigned
}

// Remove a domain assignment from a user
export async function removeDomainFromUser(userId: string, domainId: string): Promise<boolean> {
  // Get current user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (userError || !userData.user) {
    console.error('Error fetching user for domain removal:', userError);
    return false;
  }

  // Get current domain assignments
  const currentDomains = userData.user.user_metadata?.domains || [];

  // Remove domain if assigned
  if (currentDomains.includes(domainId)) {
    // Update user metadata
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
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

  return true; // Domain was not assigned
}

// Delete a domain from Cloudflare and remove all assignments
// Accepts a Supabase client instance (server or browser)
export async function deleteDomainAndAssignments(
  domainId: string,
  client: ReturnType<typeof createClient> // Use browser client type
): Promise<boolean> {
  // First, delete the domain from Cloudflare
  try {
    const response = await fetch(`/api/cloudflare/domains/${domainId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete domain from Cloudflare: ${error.message || response.statusText}`);
    }

    // Now, fetch all users using the provided client to remove domain assignments
    const users = await fetchUsers(client);

    // For each user with this domain assigned
    for (const user of users) {
      if (user.domains?.includes(domainId)) {
        await removeDomainFromUser(user.id, domainId);
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting domain:', error);
    return false;
  }
}

// Get all domains assigned to a user
export async function getAssignedDomains(userId: string): Promise<Domain[]> {
  // Get current user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (userError || !userData.user) {
    console.error('Error fetching user for domain list:', userError);
    return [];
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