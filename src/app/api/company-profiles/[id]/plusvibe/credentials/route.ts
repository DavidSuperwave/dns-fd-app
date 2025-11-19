import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WORKSPACE_ID_REGEX = /^[a-f0-9]{24}$/i;

function createSupabaseClient() {
  const resolvedCookieStore = cookies();
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
            console.warn(`[PlusVibe Credentials] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: "", ...options });
          } catch (error) {
            console.warn(`[PlusVibe Credentials] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );
}

function maskApiKey(apiKey?: string | null) {
  if (!apiKey) return null;
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) {
    return "*".repeat(trimmed.length || 4);
  }
  const visible = trimmed.slice(-4);
  return `${"*".repeat(Math.max(trimmed.length - 4, 0))}${visible}`;
}

function serializeCredential(record: any) {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    label: record.label,
    isDefault: record.is_default,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    lastUsedAt: record.last_used_at,
    apiKeyPreview: maskApiKey(record.api_key),
    metadata: record.metadata || {},
  };
}

async function ensureProfileOwnership(companyProfileId: string, userId: string) {
  const { data: companyProfile, error } = await supabaseAdmin
    .from("company_profiles")
    .select("id, plusvibe_settings, current_plusvibe_credentials_id, campaign_workspace_id")
    .eq("id", companyProfileId)
    .eq("user_id", userId)
    .single();

  if (error || !companyProfile) {
    return null;
  }

  return companyProfile;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const companyProfile = await ensureProfileOwnership(id, user.id);
  if (!companyProfile) {
    return NextResponse.json({ success: false, error: "Company profile not found" }, { status: 404 });
  }

  const { data: credentials, error: credentialsError } = await supabaseAdmin
    .from("plusvibe_credentials")
    .select("*")
    .eq("company_profile_id", id)
    .order("created_at", { ascending: false });

  if (credentialsError) {
    console.error("[PlusVibe Credentials] Failed to load credentials", credentialsError);
    return NextResponse.json(
      { success: false, error: "Unable to load PlusVibe credentials" },
      { status: 500 }
    );
  }

  const serialized = (credentials || []).map(serializeCredential);
  const defaultCredential = serialized.find((credential) => credential.isDefault) || serialized[0] || null;

  return NextResponse.json({
    success: true,
    credentials: serialized,
    defaultCredentialId: defaultCredential?.id ?? null,
    defaultWorkspaceId: defaultCredential?.workspaceId ?? companyProfile.plusvibe_settings?.default_workspace_id ?? null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    workspaceId?: string;
    apiKey?: string;
    label?: string;
    setAsDefault?: boolean;
  } | null;

  const workspaceId = body?.workspaceId?.trim();
  const apiKey = body?.apiKey?.trim();
  const label = body?.label?.trim() || null;
  const requestedDefault = body?.setAsDefault ?? true;

  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "workspaceId is required" }, { status: 400 });
  }

  if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
    return NextResponse.json(
      {
        success: false,
        error: "Workspace ID must be a 24-character hex string (PlusVibe workspace ID).",
      },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json({ success: false, error: "apiKey is required" }, { status: 400 });
  }

  const companyProfile = await ensureProfileOwnership(id, user.id);
  if (!companyProfile) {
    return NextResponse.json({ success: false, error: "Company profile not found" }, { status: 404 });
  }

  const { data: existingDefault } = await supabaseAdmin
    .from("plusvibe_credentials")
    .select("id")
    .eq("company_profile_id", id)
    .eq("is_default", true)
    .maybeSingle();

  const shouldBeDefault = requestedDefault || !existingDefault;

  try {
    const { data: credential, error: insertError } = await supabaseAdmin
      .from("plusvibe_credentials")
      .insert({
        company_profile_id: id,
        workspace_id: workspaceId,
        api_key: apiKey,
        label,
        is_default: shouldBeDefault,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertError || !credential) {
      console.error("[PlusVibe Credentials] Failed to store credential", insertError);
      return NextResponse.json(
        { success: false, error: insertError?.message || "Failed to save credential" },
        { status: 500 }
      );
    }

    if (shouldBeDefault) {
      await supabaseAdmin
        .from("plusvibe_credentials")
        .update({ is_default: false })
        .eq("company_profile_id", id)
        .neq("id", credential.id);
    }

    const updatedSettings = {
      ...(companyProfile.plusvibe_settings || {}),
      default_workspace_id: shouldBeDefault ? workspaceId : companyProfile.plusvibe_settings?.default_workspace_id,
      last_credential_id: credential.id,
    };

    await supabaseAdmin
      .from("company_profiles")
      .update({
        current_plusvibe_credentials_id: shouldBeDefault ? credential.id : companyProfile.current_plusvibe_credentials_id,
        campaign_workspace_id: workspaceId,
        plusvibe_settings: updatedSettings,
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      credential: serializeCredential(credential),
    });
  } catch (error) {
    console.error("[PlusVibe Credentials] Unexpected error saving credential", error);
    return NextResponse.json(
      { success: false, error: "Unexpected error while saving credential" },
      { status: 500 }
    );
  }
}

