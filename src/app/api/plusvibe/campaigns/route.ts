import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { fetchCampaigns, PlusVibeAPIError, type PlusVibeClientCredentials } from "@/lib/plusvibe";

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
            console.warn(`[PlusVibe Campaigns] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: "", ...options });
          } catch (error) {
            console.warn(`[PlusVibe Campaigns] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limitParam = searchParams.get("limit");
  const campaignTypeParam = searchParams.get("campaignType");
  const credentialId = searchParams.get("credentialId");

  const limit = Number(limitParam ?? 50);
  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50;
  const campaignType =
    typeof campaignTypeParam === "string" && campaignTypeParam.trim().length > 0
      ? campaignTypeParam.trim().toLowerCase()
      : "all";

  let credentialOverride: PlusVibeClientCredentials | undefined;
  let resolvedWorkspaceId: string | null = null;

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
    resolvedWorkspaceId = credential.workspace_id;

    await supabaseAdmin
      .from("plusvibe_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", credential.id);
  }

  try {
    console.log(`[PlusVibe Campaigns] Fetching campaigns. Workspace: ${credentialOverride?.workspaceId || process.env.PLUSVIBE_WORKSPACE_ID}, Limit: ${resolvedLimit}, Type: ${campaignType}`);

    const campaigns = await fetchCampaigns(
      {
        limit: resolvedLimit,
        campaignType,
      },
      credentialOverride
    );

    const workspaceId = resolvedWorkspaceId || process.env.PLUSVIBE_WORKSPACE_ID || null;

    return NextResponse.json({
      success: true,
      campaigns,
      count: campaigns.length,
      workspaceId,
      campaignType,
    });
  } catch (error) {
    const status = error instanceof PlusVibeAPIError ? error.status : 500;
    const message =
      error instanceof PlusVibeAPIError
        ? error.message
        : "Failed to load PlusVibe campaigns. Please verify your API credentials.";

    console.error("[PlusVibe] campaigns route error", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}

