import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

interface MigratePayload {
  vibePlusCampaignId?: string;
  vibePlusCampaignName?: string;
  snapshot?: Record<string, unknown>;
  credentialId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedCookieStore = await cookies();
  const { id: projectId } = await params;

  const supabase = createServerClient(
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
            console.warn(`[API Project Campaign Migrate] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: "", ...options });
          } catch (error) {
            console.warn(`[API Project Campaign Migrate] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );

  try {
    const payload = (await request.json().catch(() => null)) as MigratePayload | null;

    if (!payload?.vibePlusCampaignId) {
      return NextResponse.json(
        { success: false, error: "vibePlusCampaignId is required" },
        { status: 400 }
      );
    }

    const { data: authData, error: userError } = await supabase.auth.getUser();

    if (userError || !authData?.user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const userId = authData.user.id;

    const isAdmin = authData.user.app_metadata?.role === "admin" || authData.user.user_metadata?.role === "admin";

    const projectQuery = supabaseAdmin
      .from("projects")
      .select("id, user_id, company_profile_id")
      .eq("id", projectId);

    if (!isAdmin) {
      projectQuery.eq("user_id", userId);
    }

    const { data: project, error: projectError } = await projectQuery.single();

    if (projectError || !project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    if (!project.company_profile_id) {
      return NextResponse.json(
        { success: false, error: "Project is missing an associated company profile" },
        { status: 400 }
      );
    }

    const profileQuery = supabaseAdmin
      .from("company_profiles")
      .select("id, user_id, campaign_metadata, current_plusvibe_credentials_id, campaign_workspace_id, plusvibe_settings")
      .eq("id", project.company_profile_id);

    if (!isAdmin) {
      profileQuery.eq("user_id", userId);
    }

    const { data: companyProfile, error: profileError } = await profileQuery.single();

    if (profileError || !companyProfile) {
      return NextResponse.json({ success: false, error: "Company profile not found" }, { status: 404 });
    }

    let credentialRecord: { id: string; workspace_id: string } | null = null;
    if (payload.credentialId) {
      const { data: fetchedCredential, error: credentialError } = await supabaseAdmin
        .from("plusvibe_credentials")
        .select("id, workspace_id, company_profile_id")
        .eq("id", payload.credentialId)
        .single();

      if (credentialError || !fetchedCredential) {
        return NextResponse.json(
          { success: false, error: "PlusVibe credential not found" },
          { status: 404 }
        );
      }

      if (fetchedCredential.company_profile_id !== project.company_profile_id) {
        return NextResponse.json(
          { success: false, error: "Credential does not belong to this project" },
          { status: 400 }
        );
      }

      credentialRecord = {
        id: fetchedCredential.id,
        workspace_id: fetchedCredential.workspace_id,
      };
    }

    const mergedMetadata = {
      ...((companyProfile.campaign_metadata as Record<string, unknown>) || {}),
      vibe_plus: {
        id: payload.vibePlusCampaignId,
        name: payload.vibePlusCampaignName ?? null,
        snapshot: payload.snapshot ?? null,
        linked_at: new Date().toISOString(),
        credential_id: credentialRecord?.id ?? (companyProfile as any).current_plusvibe_credentials_id ?? null,
      },
    };

    const updatedPlusVibeSettings = {
      ...(companyProfile.plusvibe_settings || {}),
      last_linked_at: new Date().toISOString(),
      last_linked_workspace_id: credentialRecord?.workspace_id ?? companyProfile.campaign_workspace_id,
    };

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("company_profiles")
      .update({
        campaign_id: payload.vibePlusCampaignId,
        campaign_name: payload.vibePlusCampaignName ?? null,
        campaign_metadata: mergedMetadata,
        current_plusvibe_credentials_id: credentialRecord?.id ?? companyProfile.current_plusvibe_credentials_id,
        campaign_workspace_id: credentialRecord?.workspace_id ?? companyProfile.campaign_workspace_id,
        plusvibe_settings: updatedPlusVibeSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.company_profile_id)
      .select("*")
      .single();

    if (updateError || !updatedProfile) {
      console.error("[API Project Campaign Migrate] Failed to update company profile:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update company profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      companyProfile: updatedProfile,
    });
  } catch (error) {
    console.error("[API Project Campaign Migrate] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Unexpected error while linking campaign" },
      { status: 500 }
    );
  }
}

