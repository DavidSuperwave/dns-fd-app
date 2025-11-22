import { randomUUID } from "crypto";

const DEFAULT_TIMEOUT_MS = Number(process.env.PLUSVIBE_TIMEOUT_MS || 10000);
const PLUSVIBE_API_BASE = (process.env.PLUSVIBE_API_BASE || "https://api.plusvibe.ai/api/v1").replace(/\/+$/, "");
const PLUSVIBE_API_KEY = process.env.PLUSVIBE_API_KEY;
const PLUSVIBE_WORKSPACE_ID = process.env.PLUSVIBE_WORKSPACE_ID;
const PLUSVIBE_DEFAULT_CAMPAIGN_ID = process.env.PLUSVIBE_DEFAULT_CAMPAIGN_ID;

if (!PLUSVIBE_API_KEY) {
  console.warn("[PlusVibe] PLUSVIBE_API_KEY is not set. API calls will fail until configured.");
}

if (!PLUSVIBE_WORKSPACE_ID) {
  console.warn("[PlusVibe] PLUSVIBE_WORKSPACE_ID is not set. API calls will fail until configured.");
}

if (!PLUSVIBE_DEFAULT_CAMPAIGN_ID) {
  console.warn("[PlusVibe] PLUSVIBE_DEFAULT_CAMPAIGN_ID is not set. Reply metrics will default to workspace totals.");
}

type QueryValue = string | number | boolean | undefined | null;

export interface PlusVibeClientCredentials {
  workspaceId: string;
  apiKey: string;
}

interface RequestOptions<TBody = any> {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
  body?: TBody;
  timeoutMs?: number;
  cache?: RequestCache;
  credentials?: PlusVibeClientCredentials;
}

export class PlusVibeAPIError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "PlusVibeAPIError";
    this.status = status;
    this.data = data;
  }
}

function requireWorkspaceId(override?: string | null) {
  if (override && override.trim().length > 0) {
    return override.trim();
  }

  if (!PLUSVIBE_WORKSPACE_ID) {
    throw new Error("PLUSVIBE_WORKSPACE_ID environment variable is required");
  }

  return PLUSVIBE_WORKSPACE_ID;
}

function requireApiKey(override?: string | null) {
  const resolved = override ?? PLUSVIBE_API_KEY;
  if (!resolved || resolved.trim().length === 0) {
    throw new Error("PLUSVIBE_API_KEY environment variable is required");
  }

  return resolved.trim();
}

function buildUrl(path: string, workspaceId: string, query: Record<string, QueryValue> = {}) {
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(path.replace(/^\//, ""), `${PLUSVIBE_API_BASE}/`);

  url.searchParams.set("workspace_id", workspaceId);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

export async function plusVibeRequest<TResponse, TBody extends Record<string, any> | undefined = undefined>(
  path: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const {
    method = "GET",
    query = {},
    body,
    headers: customHeaders,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cache,
    credentials,
  } = options;

  const workspaceId = requireWorkspaceId(credentials?.workspaceId);
  const apiKey = requireApiKey(credentials?.apiKey);

  const url = buildUrl(path, workspaceId, query);

  const fetchHeaders: HeadersInit = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "x-workspace-id": workspaceId,
    Accept: "application/json",
    ...customHeaders,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload =
      method.toUpperCase() === "GET"
        ? undefined
        : JSON.stringify({
          ...(body || {}),
          workspace_id: body && "workspace_id" in body ? (body as any).workspace_id : workspaceId,
        });

    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: payload,
      signal: controller.signal,
      cache,
    });

    const text = await response.text();
    const data = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      throw new PlusVibeAPIError(response.status, parseErrorMessage(data) || response.statusText, data);
    }

    return (data ?? {}) as TResponse;
  } catch (error) {
    if (error instanceof PlusVibeAPIError) {
      throw error;
    }

    if ((error as Error).name === "AbortError") {
      throw new PlusVibeAPIError(408, "PlusVibe request timed out");
    }

    throw new PlusVibeAPIError(500, (error as Error).message || "Unknown PlusVibe error");
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") return "";
  if ("message" in data && typeof data.message === "string") {
    return data.message;
  }
  if ("error" in data && typeof data.error === "string") {
    return data.error;
  }
  return "";
}

export interface PlusVibeCampaign {
  id: string;
  name: string;
  status: string;
  description?: string;
  last_updated_at?: string;
  created_at?: string;
  stats?: {
    emails_sent?: number;
    replies?: number;
  };
  email_sent_today?: number;
  replied_count?: number;
  [key: string]: unknown;
}

export interface CampaignSummaryMetrics {
  emailsSentToday: number;
  totalReplies: number;
}

export interface PlusVibeInboxEmail {
  id: string;
  subject?: string;
  preview_text?: string;
  snippet?: string;
  body?: string;
  body_html?: string;
  body_text?: string;
  from?: string;
  from_name?: string;
  from_email?: string;
  to?: string;
  to_email?: string;
  received_at?: string;
  email_type?: string;
  reply_status?: string;
  interest_status?: string;
  meeting_status?: string;
  labels?: string[];
  thread_id?: string;
  campaign_id?: string;
  unread?: boolean;
  sentiment?: string;
  [key: string]: unknown;
}

export interface PlusVibeEmail {
  id: string;
  subject?: string;
  from?: string;
  to?: string;
  received_at?: string;
  campaign_id?: string;
  [key: string]: unknown;
}

interface CampaignsResponse {
  data?: PlusVibeCampaign[];
  campaigns?: PlusVibeCampaign[];
  results?: PlusVibeCampaign[];
}

interface AnalyticsSummaryResponse {
  campaign_id?: string;
  campaign_name?: string;
  completed?: number;
  contacted?: number;
  leads_who_read?: number;
  leads_who_replied?: number;
  bounced?: number;
  unsubscribed?: number;
  // Legacy/Fallback fields
  data?: {
    emails_sent_today?: number;
    emails_sent_total?: number;
    replies_total?: number;
    total_replies?: number;
    [key: string]: unknown;
  };
  metrics?: {
    emails_sent_today?: number;
    total_replies?: number;
    replies_total?: number;
    [key: string]: unknown;
  };
  emails_sent_today?: number;
  total_replies?: number;
  replies_total?: number;
  [key: string]: unknown;
}

interface FetchCampaignsOptions {
  limit?: number;
  skip?: number | null;
  campaignType?: string | null;
}

export async function fetchCampaigns(
  options: FetchCampaignsOptions = {},
  credentials?: PlusVibeClientCredentials
): Promise<PlusVibeCampaign[]> {
  const { limit = 50, skip = null, campaignType = "all" } = options;

  try {
    const query: Record<string, QueryValue> = {
      limit: Math.min(Math.max(Number(limit) || 1, 1), 200),
    };

    if (skip !== null && skip !== undefined) {
      query.skip = Math.max(Number(skip) || 0, 0);
    }

    if (campaignType && campaignType.length > 0 && campaignType !== "all") {
      query.campaign_type = campaignType;
    }

    const response = await plusVibeRequest<CampaignsResponse | PlusVibeCampaign[]>("/campaign/list-all", {
      query,
      credentials,
    });

    const campaignsArray = Array.isArray(response)
      ? response
      : response.campaigns || response.data || response.results || [];

    const normalizedCampaigns = campaignsArray.map(normalizeCampaignRecord).filter(Boolean) as PlusVibeCampaign[];
    return normalizedCampaigns;
  } catch (error) {
    if (error instanceof PlusVibeAPIError && error.status === 404) {
      console.warn("[PlusVibe] campaign list endpoint not found; returning empty set");
      return [];
    }
    throw error;
  }
}

export async function fetchActiveCampaigns(
  limit = 10,
  credentials?: PlusVibeClientCredentials
): Promise<PlusVibeCampaign[]> {
  const campaigns = await fetchCampaigns({ limit: Math.max(limit, 1), campaignType: "all" }, credentials);
  return campaigns.filter((campaign) => (campaign.status || "").toLowerCase() === "active").slice(0, limit);
}

export async function fetchCampaignSummaryMetrics(
  campaignId?: string,
  credentials?: PlusVibeClientCredentials
): Promise<CampaignSummaryMetrics> {
  try {
    // Use the correct endpoint for campaign summary
    // Note: This endpoint requires campaign_id. If not provided, we might need another endpoint or return 0.
    // The docs say /analytics/campaign/summary?workspace_id&campaign_id

    if (!campaignId) {
      // If no campaign ID, we can't get specific summary from this endpoint.
      // We could try to get workspace-wide stats if available, but for now return 0.
      return {
        emailsSentToday: 0,
        totalReplies: 0,
      };
    }

    const response = await plusVibeRequest<AnalyticsSummaryResponse>("/analytics/campaign/summary", {
      query: { campaign_id: campaignId },
      credentials,
    });

    // Map response fields to our internal metrics
    // The API returns 'contacted' (total sent?) and 'leads_who_replied'
    // It does not seem to return 'today' metrics explicitly, so we map total to today as a fallback
    // or just use total. The UI expects 'emailsSentToday' but often displays it as 'Sent'.

    return {
      emailsSentToday:
        Number(response.contacted) ||
        Number(response.emails_sent_today) ||
        Number(response.data?.emails_sent_today) ||
        Number(response.data?.emails_sent_total) ||
        0,
      totalReplies:
        Number(response.leads_who_replied) ||
        Number(response.total_replies) ||
        Number(response.replies_total) ||
        Number(response.data?.total_replies) ||
        Number(response.data?.replies_total) ||
        0,
    };
  } catch (error) {
    if (error instanceof PlusVibeAPIError && error.status === 404) {
      console.warn("[PlusVibe] analytics summary endpoint not found; defaulting to zero metrics");
      return {
        emailsSentToday: 0,
        totalReplies: 0,
      };
    }
    throw error;
  }
}

export async function fetchCampaignById(
  campaignId: string,
  credentials?: PlusVibeClientCredentials
): Promise<PlusVibeCampaign | null> {
  if (!campaignId) {
    return null;
  }

  try {
    const response = await plusVibeRequest<CampaignsResponse | PlusVibeCampaign[]>("/campaign/list-all", {
      query: { campaign_id: campaignId, limit: 1 },
      credentials,
    });

    const campaigns = Array.isArray(response)
      ? response
      : response.campaigns || response.data || response.results || [];
    return campaigns.find((campaign) => campaign.id === campaignId) || campaigns[0] || null;
  } catch (error) {
    if (error instanceof PlusVibeAPIError && error.status === 404) {
      console.warn(`[PlusVibe] campaign ${campaignId} not found`);
      return null;
    }
    throw error;
  }
}

interface UniboxEmailsResponse {
  data?: (PlusVibeEmail | PlusVibeInboxEmail)[];
  emails?: (PlusVibeEmail | PlusVibeInboxEmail)[];
  results?: (PlusVibeEmail | PlusVibeInboxEmail)[];
  [key: string]: unknown;
}

export async function fetchCampaignRepliesCount(
  campaignId: string,
  credentials?: PlusVibeClientCredentials
): Promise<number> {
  if (!campaignId) {
    return 0;
  }

  try {
    const response = await plusVibeRequest<UniboxEmailsResponse>("/unibox/emails", {
      query: { campaign_id: campaignId, email_type: "received", limit: 500 },
      credentials,
    });

    const emails = response.data || response.emails || response.results;
    if (Array.isArray(emails)) {
      return emails.length;
    }

    // Some PlusVibe responses return { total: number, data: [] }
    if ("total" in response && typeof response.total === "number") {
      return response.total;
    }

    return 0;
  } catch (error) {
    if (error instanceof PlusVibeAPIError && error.status === 404) {
      console.warn(`[PlusVibe] replies not found for campaign ${campaignId}`);
      return 0;
    }
    throw error;
  }
}

interface FetchInboxRepliesOptions {
  campaignId?: string | null;
  limit?: number;
  status?: string | null;
  search?: string | null;
  credentials?: PlusVibeClientCredentials;
}

export interface InboxReply {
  id: string;
  subject: string;
  preview: string;
  body?: string;
  receivedAt: string;
  unread: boolean;
  sender: {
    name?: string;
    email?: string;
  };
  recipient?: string;
  campaignId?: string;
  interestStatus?: string;
  meetingStatus?: string;
  labels: string[];
  threadId?: string;
}

export async function fetchInboxReplies(options: FetchInboxRepliesOptions = {}): Promise<InboxReply[]> {
  const { campaignId = null, limit = 50, status = null, search = null, credentials } = options;

  const query: Record<string, QueryValue> = {
    // limit and sort are not supported by the API endpoint /unibox/emails
    // email_type: "received",
  };

  if (campaignId) {
    query.campaign_id = campaignId;
  }

  // Status and search are not supported by the API endpoint directly
  // if (status) { query.status = status; }
  // if (search) { query.search = search; }

  try {
    const response = await plusVibeRequest<UniboxEmailsResponse>("/unibox/emails", {
      query,
      credentials,
    });

    const emails = response.data || response.emails || response.results;
    if (!Array.isArray(emails)) {
      return [];
    }

    return emails.map((email) => normalizeInboxEmail(email)).filter(Boolean) as InboxReply[];
  } catch (error) {
    if (error instanceof PlusVibeAPIError && error.status === 404) {
      console.warn("[PlusVibe] inbox endpoint not found; returning empty replies");
      return [];
    }
    throw error;
  }
}

function normalizeInboxEmail(email: PlusVibeInboxEmail | PlusVibeEmail): InboxReply | null {
  if (!email || typeof email !== "object") return null;

  const from = (email as PlusVibeInboxEmail).from || (email as PlusVibeInboxEmail).from_email;
  const senderName = (email as PlusVibeInboxEmail).from_name;
  const senderEmail = (email as PlusVibeInboxEmail).from_email || from;
  const preview =
    (email as PlusVibeInboxEmail).preview_text ||
    (email as PlusVibeInboxEmail).snippet ||
    (email as PlusVibeInboxEmail).body_text ||
    "";

  return {
    id: String(email.id),
    subject: (email as PlusVibeInboxEmail).subject || "Untitled reply",
    preview: preview?.slice(0, 220) || "",
    body:
      (email as PlusVibeInboxEmail).body ||
      (email as PlusVibeInboxEmail).body_text ||
      (email as PlusVibeInboxEmail).body_html ||
      "",
    receivedAt: (email as PlusVibeInboxEmail).received_at || "",
    unread: Boolean((email as PlusVibeInboxEmail).unread ?? true),
    sender: {
      name: senderName || (from ? from.split("<")[0].trim() : undefined),
      email: senderEmail,
    },
    recipient: (email as PlusVibeInboxEmail).to || (email as PlusVibeInboxEmail).to_email,
    campaignId: (email as PlusVibeInboxEmail).campaign_id,
    interestStatus: (email as PlusVibeInboxEmail).interest_status || (email as PlusVibeInboxEmail).reply_status,
    meetingStatus: (email as PlusVibeInboxEmail).meeting_status,
    labels: Array.isArray((email as PlusVibeInboxEmail).labels)
      ? ((email as PlusVibeInboxEmail).labels as string[])
      : [],
    threadId: (email as PlusVibeInboxEmail).thread_id,
  };
}

function normalizeCampaignRecord(raw: any): PlusVibeCampaign | null {
  if (!raw || typeof raw !== "object") return null;

  return {
    id: raw.id || raw._id || raw.camp_id || raw.campaign_id || raw.camp_name || generateCampaignFallbackId(),
    name: raw.name || raw.camp_name || raw.campaign_name || "Untitled campaign",
    status: raw.status || raw.campaign_status || raw.camp_status || "unknown",
    description: raw.description,
    last_updated_at: raw.last_updated_at || raw.updated_at,
    created_at: raw.created_at,
    stats: raw.stats || {
      emails_sent: raw.emails_sent ?? raw.total_emails,
      replies: raw.replies ?? raw.total_replies,
    },
    email_sent_today: raw.email_sent_today ?? raw.emails_sent_today,
    replied_count: raw.replied_count ?? raw.replies ?? raw.total_replies,
  };
}

function generateCampaignFallbackId() {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

export interface OverviewSnapshot {
  metrics: {
    activeCampaigns: number;
    emailsSentToday: number;
    totalReplies: number;
  };
  campaigns: PlusVibeCampaign[];
}

interface OverviewSnapshotOptions {
  campaignId?: string | null;
}

export async function getOverviewSnapshot(
  options: OverviewSnapshotOptions = {},
  credentials?: PlusVibeClientCredentials
): Promise<OverviewSnapshot> {
  const campaignId = options.campaignId || PLUSVIBE_DEFAULT_CAMPAIGN_ID || null;

  const [campaigns, summary, campaignDetails, repliesCount] = await Promise.all([
    fetchActiveCampaigns(25, credentials),
    fetchCampaignSummaryMetrics(campaignId || undefined, credentials),
    campaignId ? fetchCampaignById(campaignId, credentials) : Promise.resolve(null),
    campaignId ? fetchCampaignRepliesCount(campaignId, credentials) : Promise.resolve(0),
  ]);

  const emailsSentTodayMetric =
    typeof campaignDetails?.email_sent_today === "number"
      ? campaignDetails.email_sent_today
      : summary.emailsSentToday;

  const totalRepliesMetric = campaignId
    ? repliesCount
    : typeof campaignDetails?.replied_count === "number"
      ? campaignDetails.replied_count
      : summary.totalReplies;

  return {
    metrics: {
      activeCampaigns: campaigns.length,
      emailsSentToday: emailsSentTodayMetric,
      totalReplies: totalRepliesMetric,
    },
    campaigns,
  };
}

// ============================================================================
// Campaign Management Functions
// ============================================================================

export interface CampaignVariation {
  variation: string; // "A", "B", etc.
  subject: string;
  body: string; // HTML supported
  name?: string;
}

export interface CampaignSequence {
  step: number;
  wait_time: number; // Days to wait
  variations: CampaignVariation[];
}

export interface CreateCampaignParams {
  name: string;
  description?: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
  sequences?: CampaignSequence[];
  firstWaitTime?: number;
}

/**
 * Create a new campaign in PlusVibe
 */
export async function createPlusVibeCampaign(
  params: CreateCampaignParams,
  credentials?: PlusVibeClientCredentials
): Promise<PlusVibeCampaign> {
  const body: Record<string, any> = {
    camp_name: params.name,
    // description: params.description, // Not supported by API
    from_email: params.fromEmail,
    from_name: params.fromName,
    reply_to_email: params.replyToEmail || params.fromEmail,
    ...(params.sequences && { sequences: params.sequences }),
  };

  const response = await plusVibeRequest<{ data?: PlusVibeCampaign; campaign?: PlusVibeCampaign }, Record<string, any>>(
    "/campaign/add/campaign",
    {
      method: "POST",
      body,
      credentials,
    }
  );

  return response.campaign || response.data || (response as any);
}

/**
 * Update an existing campaign in PlusVibe
 */
export async function updatePlusVibeCampaign(
  campaignId: string,
  params: Partial<CreateCampaignParams>,
  credentials?: PlusVibeClientCredentials
): Promise<PlusVibeCampaign> {
  const body: Record<string, any> = {
    campaign_id: campaignId,
    ...(params.name && { name: params.name }),
    ...(params.description && { description: params.description }),
    ...(params.fromEmail && { from_email: params.fromEmail }),
    ...(params.fromName && { from_name: params.fromName }),
    ...(params.replyToEmail && { reply_to_email: params.replyToEmail }),
    ...(params.sequences && { sequences: params.sequences }),
    ...(params.firstWaitTime && { first_wait_time: params.firstWaitTime }),
  };

  const response = await plusVibeRequest<{ data?: PlusVibeCampaign; campaign?: PlusVibeCampaign }, Record<string, any>>(
    "/campaign/update/campaign",
    {
      method: "PATCH",
      body,
      credentials,
    }
  );

  return response.campaign || response.data || (response as any);
}

/**
 * Activate a campaign in PlusVibe
 */
export async function activateCampaign(
  campaignId: string,
  credentials?: PlusVibeClientCredentials
): Promise<void> {
  await plusVibeRequest("/campaign/activate", {
    method: "POST",
    body: { campaign_id: campaignId },
    credentials,
  });
}

/**
 * Delete a campaign in PlusVibe
 */
export async function deleteCampaign(
  campaignId: string,
  credentials?: PlusVibeClientCredentials
): Promise<void> {
  await plusVibeRequest("/campaign/delete", {
    method: "DELETE",
    body: { campaign_id: campaignId },
    credentials,
  });
}

// ============================================================================
// Lead Management Functions
// ============================================================================

export interface PlusVibeLead {
  id?: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  phone?: string;
  website?: string;
  [key: string]: any;
}

export interface AddLeadsResult {
  successful: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
  skipped?: number;
}

/**
 * Add leads to a campaign in PlusVibe
 */
export async function addLeadsToCampaign(
  campaignId: string,
  leads: PlusVibeLead[],
  credentials?: PlusVibeClientCredentials
): Promise<AddLeadsResult> {
  try {
    const body: Record<string, any> = {
      campaign_id: campaignId,
      leads: leads.map((lead) => {
        const { id, ...leadWithoutId } = lead;
        return {
          first_name: lead.first_name || lead.name?.split(" ")[0] || "",
          last_name: lead.last_name || lead.name?.split(" ").slice(1).join(" ") || "",
          ...leadWithoutId,
        };
      }),
    };

    const response = await plusVibeRequest<any, Record<string, any>>("/lead/add-to-campaign", {
      method: "POST",
      body,
      credentials,
    });

    // Parse response - different APIs may return different formats
    const successful = response.successful ?? response.added ?? response.count ?? leads.length;
    const failed = response.failed ?? response.errors?.length ?? 0;
    const errors = response.errors || [];

    return {
      successful,
      failed,
      errors,
      skipped: response.skipped ?? 0,
    };
  } catch (error) {
    return {
      successful: 0,
      failed: leads.length,
      errors: [{ email: "bulk", error: error instanceof Error ? error.message : "Unknown error" }],
    };
  }
}

/**
 * Fetch leads from a campaign in PlusVibe
 */
export async function fetchCampaignLeads(
  campaignId: string,
  credentials?: PlusVibeClientCredentials
): Promise<PlusVibeLead[]> {
  try {
    const response = await plusVibeRequest<{ data?: PlusVibeLead[]; leads?: PlusVibeLead[] }>(
      "/lead/get",
      {
        method: "POST",
        body: { campaign_id: campaignId, limit: 100 },
        credentials,
      }
    );

    const leads = response.leads || response.data || [];
    return Array.isArray(leads) ? leads : [];
  } catch (error) {
    if (error instanceof PlusVibeAPIError && error.status === 404) {
      console.warn(`[PlusVibe] No leads found for campaign ${campaignId}`);
      return [];
    }
    throw error;
  }
}

/**
 * Fetch email templates/sequences from a campaign
 */
export async function fetchCampaignEmails(
  campaignId: string,
  credentials?: PlusVibeClientCredentials
): Promise<any[]> {
  try {
    const response = await plusVibeRequest<{ data?: any[]; emails?: any[] }>(
      "/unibox/campaign-emails",
      {
        query: { campaign_id: campaignId },
        credentials,
      }
    );

    const emails = response.emails || response.data || [];
    return Array.isArray(emails) ? emails : [];
  } catch (error) {
    if (error instanceof PlusVibeAPIError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Fetch email accounts associated with a campaign
 */
export async function fetchCampaignEmailAccounts(
  campaignId: string,
  credentials?: PlusVibeClientCredentials
): Promise<any[]> {
  try {
    const response = await plusVibeRequest<{ data?: any[]; accounts?: any[]; email_accounts?: any[] }>(
      "/campaign/get/accounts",
      {
        query: { campaign_id: campaignId },
        credentials,
      }
    );

    const accounts = response.accounts || response.email_accounts || response.data || [];
    return Array.isArray(accounts) ? accounts : [];
  } catch (error) {
    if (error instanceof PlusVibeAPIError && error.status === 404) {
      console.warn(`[PlusVibe] No email accounts found for campaign ${campaignId}`);
      return [];
    }
    throw error;
  }
}
