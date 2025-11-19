import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { fetchInboxReplies, type PlusVibeClientCredentials } from "@/lib/plusvibe";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WORKSPACE_ID_REGEX = /^[a-f0-9]{24}$/i;

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
            console.warn(`[PlusVibe Replies] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: "", ...options });
          } catch (error) {
            console.warn(`[PlusVibe Replies] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const limitParam = searchParams.get("limit");
  const credentialId = searchParams.get("credentialId");

  const limit = limitParam ? Number(limitParam) : undefined;

  let credentialOverride: PlusVibeClientCredentials | undefined;

  if (credentialId) {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const { data: credential, error: credentialError } = await supabaseAdmin
      .from("plusvibe_credentials")
      .select("id, workspace_id, api_key, company_profile_id")
      .eq("id", credentialId)
      .single();

    if (credentialError || !credential) {
      return NextResponse.json({ success: false, error: "Credential not found" }, { status: 404 });
    }

    const { data: ownership, error: ownershipError } = await supabaseAdmin
      .from("company_profiles")
      .select("id")
      .eq("id", credential.company_profile_id)
      .eq("user_id", user.id)
      .single();

    if (ownershipError || !ownership) {
      return NextResponse.json({ success: false, error: "Credential not found" }, { status: 404 });
    }

    if (!WORKSPACE_ID_REGEX.test(credential.workspace_id)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Workspace ID stored for this PlusVibe connection is invalid. Use the 24-character workspace ID from PlusVibe.",
        },
        { status: 400 }
      );
    }

    credentialOverride = {
      workspaceId: credential.workspace_id,
      apiKey: credential.api_key,
    };
  }

  try {
    const replies = await fetchInboxReplies({
      campaignId,
      status,
      search,
      limit,
      credentials: credentialOverride,
    });

    return NextResponse.json({
      success: true,
      replies,
    });
  } catch (error) {
    console.error("[PlusVibe Replies API] Failed to load inbox replies", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load replies from PlusVibe",
      },
      { status: 500 }
    );
  }
}

