import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createSupabaseClient() {
  const resolvedCookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return resolvedCookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value, ...options });
          } catch (error) {
            console.warn(`[Admin Create Test User] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: "", ...options });
          } catch (error) {
            console.warn(`[Admin Create Test User] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );
}

function ensureAdmin(user: any) {
  const role = user?.app_metadata?.role || user?.user_metadata?.role;
  return role === "admin" || role === "superadmin";
}

function generateTempPassword() {
  return `Test!${Math.random().toString(36).slice(-6)}Aa`;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  if (!ensureAdmin(user)) {
    return NextResponse.json({ success: false, error: "Admin only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    name?: string;
    metadata?: Record<string, unknown>;
  } | null;

  const email =
    body?.email?.trim() ||
    `test-user-${Date.now()}@example.com`.toLowerCase();
  const password = body?.password || generateTempPassword();
  const name = body?.name?.trim() || "Test Client";

  try {
    const { data: createResult, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: "client",
        ...(body?.metadata || {}),
      },
    });

    if (createError || !createResult?.user) {
      return NextResponse.json(
        { success: false, error: createError?.message || "Failed to create user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: createResult.user.id,
        email: createResult.user.email,
      },
      tempPassword: password,
    });
  } catch (error) {
    console.error("[Admin Create Test User] Unexpected error", error);
    return NextResponse.json(
      { success: false, error: "Unexpected error while creating user" },
      { status: 500 }
    );
  }
}


