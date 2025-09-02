import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';

/**
 * Verifies if a user is an admin based on their JWT token
 * @param request The Next.js request object containing the authorization header
 * @returns The user object if admin, or an error object otherwise
 */
export async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];

  if (!supabaseAdmin) {
    console.error('[Auth] Supabase admin client is not initialized.');
    return null;
  }

  try {
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.warn('[Auth] Authentication failed via token.', authError);
      return null;
    }

    // Check if the requesting user is an admin
    const isAdmin = requestingUser?.user_metadata?.role === 'admin' || 
                    requestingUser?.email === process.env.ADMIN_EMAIL;
    
    if (!isAdmin) {
      console.warn(`[Auth] Forbidden attempt by non-admin: ${requestingUser.email}`);
      return null;
    }

    return requestingUser;
  } catch (error) {
    console.error('[Auth] Error verifying admin status:', error);
    return null;
  }
}
