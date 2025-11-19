/**
 * PlusVibe Sync Orchestrator
 * 
 * Handles bidirectional synchronization between local campaigns and PlusVibe API
 * Supports:
 * - Campaign import from PlusVibe to local database
 * - Campaign export from local database to PlusVibe
 * - Automatic bidirectional sync
 * - Lead, email template, and reply synchronization
 */

import { createClient } from '@supabase/supabase-js';
import {
  fetchCampaigns,
  fetchCampaignById,
  createPlusVibeCampaign,
  updatePlusVibeCampaign,
  addLeadsToCampaign,
  fetchCampaignLeads,
  fetchCampaignEmails,
  fetchInboxReplies,
  PlusVibeCampaign,
  PlusVibeClientCredentials,
} from './plusvibe';

// ============================================================================
// Types
// ============================================================================

export interface ImportCampaignOptions {
  plusvibeCampaignId: string;
  projectId: string;
  userId: string;
  connectionId: string;
  includeLeads?: boolean;
  includeEmails?: boolean;
  includeReplies?: boolean;
  autoSync?: boolean;
}

export interface ExportCampaignOptions {
  campaignId: string; // local campaign UUID
  userId: string;
  connectionId: string;
  createNew?: boolean; // create new PlusVibe campaign or update existing
  includeLeads?: boolean;
  includeEmails?: boolean;
}

export interface SyncResult {
  success: boolean;
  syncHistoryId: string;
  itemsProcessed: number;
  itemsSuccessful: number;
  itemsFailed: number;
  errors: Array<{ type: string; message: string; details?: any }>;
  campaignId?: string;
  plusvibeCampaignId?: string;
}

interface SyncStats {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
}

// ============================================================================
// Main Sync Functions
// ============================================================================

/**
 * Import a campaign from PlusVibe into the local database
 */
export async function importCampaignFromPlusVibe(
  options: ImportCampaignOptions
): Promise<SyncResult> {
  const {
    plusvibeCampaignId,
    projectId,
    userId,
    connectionId,
    includeLeads = true,
    includeEmails = true,
    includeReplies = true,
    autoSync = true,
  } = options;

  const supabase = createSupabaseAdmin();
  const startTime = Date.now();
  const errors: Array<{ type: string; message: string; details?: any }> = [];
  let campaignId: string | undefined;

  try {
    // 1. Get connection credentials
    const connection = await getConnection(supabase, connectionId, userId);
    const credentials: PlusVibeClientCredentials = {
      workspaceId: connection.workspace_id,
      apiKey: connection.api_key,
    };

    // 2. Create sync history record
    const syncHistoryId = await createSyncHistory(supabase, {
      userId,
      connectionId,
      syncType: 'import_campaign',
      syncDirection: 'from_plusvibe',
    });

    // 3. Fetch campaign from PlusVibe
    const pvCampaign = await fetchCampaignById(plusvibeCampaignId, credentials);
    if (!pvCampaign) {
      throw new Error(`Campaign ${plusvibeCampaignId} not found in PlusVibe`);
    }

    // 4. Create local campaign record
    // Add fallbacks for required fields in case PlusVibe API doesn't provide them
    const campaignName = pvCampaign.name || pvCampaign.title || `Imported Campaign ${plusvibeCampaignId.substring(0, 8)}`;
    const campaignDescription = pvCampaign.description || pvCampaign.notes || '';

    const { data: localCampaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        project_id: projectId,
        name: campaignName,
        description: campaignDescription,
        status: mapPlusVibeStatus(pvCampaign.status),
        plusvibe_campaign_id: plusvibeCampaignId,
        plusvibe_workspace_id: connection.workspace_id,
        sync_with_plusvibe: true,
        auto_sync_enabled: autoSync,
        plusvibe_sync_status: 'syncing',
        plusvibe_sync_direction: 'import',
        last_plusvibe_sync: new Date().toISOString(),
      })
      .select()
      .single();

    if (campaignError || !localCampaign) {
      throw campaignError || new Error('Failed to create local campaign');
    }

    campaignId = localCampaign.id;

    // 5. Import leads if requested
    let leadsStats: SyncStats = { processed: 0, successful: 0, failed: 0, skipped: 0 };
    if (includeLeads) {
      leadsStats = await importLeads(supabase, {
        campaignId: campaignId!,
        plusvibeCampaignId,
        projectId,
        userId,
        credentials,
      });
    }

    // 6. Import email templates if requested
    let emailsStats: SyncStats = { processed: 0, successful: 0, failed: 0, skipped: 0 };
    if (includeEmails) {
      emailsStats = await importEmailTemplates(supabase, {
        campaignId: campaignId!,
        plusvibeCampaignId,
        projectId,
        userId,
        credentials,
      });
    }

    // 7. Import replies if requested
    let repliesStats: SyncStats = { processed: 0, successful: 0, failed: 0, skipped: 0 };
    if (includeReplies) {
      repliesStats = await importEmailReplies(supabase, {
        campaignId: campaignId!,
        plusvibeCampaignId,
        projectId,
        userId,
        credentials,
      });
    }

    // 8. Update campaign sync status
    await supabase
      .from('campaigns')
      .update({
        plusvibe_sync_status: 'synced',
        last_plusvibe_sync: new Date().toISOString(),
      })
      .eq('id', campaignId);

    // 9. Complete sync history
    const totalStats = {
      processed: leadsStats.processed + emailsStats.processed + repliesStats.processed,
      successful: leadsStats.successful + emailsStats.successful + repliesStats.successful,
      failed: leadsStats.failed + emailsStats.failed + repliesStats.failed,
      skipped: leadsStats.skipped + emailsStats.skipped + repliesStats.skipped,
    };

    await completeSyncHistory(supabase, syncHistoryId, {
      status: totalStats.failed > 0 ? 'partial' : 'completed',
      campaignId,
      stats: totalStats,
      duration: Date.now() - startTime,
      errors,
    });

    return {
      success: true,
      syncHistoryId,
      campaignId,
      plusvibeCampaignId,
      itemsProcessed: totalStats.processed,
      itemsSuccessful: totalStats.successful,
      itemsFailed: totalStats.failed,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push({ type: 'import_error', message: errorMessage, details: error });

    // Update campaign status if created
    if (campaignId) {
      await supabase
        .from('campaigns')
        .update({
          plusvibe_sync_status: 'error',
          plusvibe_sync_error: errorMessage,
        })
        .eq('id', campaignId);
    }

    throw error;
  }
}

/**
 * Export a local campaign to PlusVibe
 */
export async function exportCampaignToPlusVibe(
  options: ExportCampaignOptions
): Promise<SyncResult> {
  const {
    campaignId,
    userId,
    connectionId,
    createNew = false,
    includeLeads = true,
    includeEmails = true,
  } = options;

  const supabase = createSupabaseAdmin();
  const startTime = Date.now();
  const errors: Array<{ type: string; message: string; details?: any }> = [];

  try {
    // 1. Get connection credentials
    const connection = await getConnection(supabase, connectionId, userId);
    const credentials: PlusVibeClientCredentials = {
      workspaceId: connection.workspace_id,
      apiKey: connection.api_key,
    };

    // 2. Get local campaign
    const { data: localCampaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (!localCampaign) {
      throw new Error('Campaign not found');
    }

    // 3. Create sync history
    const syncHistoryId = await createSyncHistory(supabase, {
      userId,
      connectionId,
      campaignId,
      syncType: 'export_campaign',
      syncDirection: 'to_plusvibe',
    });

    let plusvibeCampaignId: string;

    // 4. Create or update PlusVibe campaign
    if (createNew || !localCampaign.plusvibe_campaign_id) {
      // Create new campaign in PlusVibe
      const pvCampaign = await createPlusVibeCampaign(
        {
          name: localCampaign.name,
          description: localCampaign.description,
          fromEmail: localCampaign.from_email,
          fromName: localCampaign.from_name,
        },
        credentials
      );
      plusvibeCampaignId = pvCampaign.id;

      // Update local campaign with PlusVibe ID
      await supabase
        .from('campaigns')
        .update({
          plusvibe_campaign_id: plusvibeCampaignId,
          plusvibe_workspace_id: connection.workspace_id,
          sync_with_plusvibe: true,
          plusvibe_sync_status: 'syncing',
          plusvibe_sync_direction: 'export',
        })
        .eq('id', campaignId);
    } else {
      // Update existing PlusVibe campaign
      plusvibeCampaignId = localCampaign.plusvibe_campaign_id;
      await updatePlusVibeCampaign(
        plusvibeCampaignId,
        {
          name: localCampaign.name,
          description: localCampaign.description,
        },
        credentials
      );
    }

    // 5. Export leads if requested
    let leadsStats: SyncStats = { processed: 0, successful: 0, failed: 0, skipped: 0 };
    if (includeLeads) {
      leadsStats = await exportLeads(supabase, {
        campaignId,
        plusvibeCampaignId,
        userId,
        credentials,
      });
    }

    // 6. Update campaign sync status
    await supabase
      .from('campaigns')
      .update({
        plusvibe_sync_status: 'synced',
        last_plusvibe_sync: new Date().toISOString(),
      })
      .eq('id', campaignId);

    // 7. Complete sync history
    await completeSyncHistory(supabase, syncHistoryId, {
      status: leadsStats.failed > 0 ? 'partial' : 'completed',
      campaignId,
      stats: leadsStats,
      duration: Date.now() - startTime,
      errors,
    });

    return {
      success: true,
      syncHistoryId,
      campaignId,
      plusvibeCampaignId,
      itemsProcessed: leadsStats.processed,
      itemsSuccessful: leadsStats.successful,
      itemsFailed: leadsStats.failed,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push({ type: 'export_error', message: errorMessage, details: error });

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({
        plusvibe_sync_status: 'error',
        plusvibe_sync_error: errorMessage,
      })
      .eq('id', campaignId);

    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function importLeads(
  supabase: any,
  options: {
    campaignId: string;
    plusvibeCampaignId: string;
    projectId: string;
    userId: string;
    credentials: PlusVibeClientCredentials;
  }
): Promise<SyncStats> {
  const { campaignId, plusvibeCampaignId, projectId, userId, credentials } = options;
  const stats: SyncStats = { processed: 0, successful: 0, failed: 0, skipped: 0 };

  try {
    // Fetch leads from PlusVibe
    const pvLeads = await fetchCampaignLeads(plusvibeCampaignId, credentials);
    stats.processed = pvLeads.length;

    // Import each lead
    for (const pvLead of pvLeads) {
      try {
        await supabase.from('leads').insert({
          user_id: userId,
          project_id: projectId,
          campaign_id: campaignId,
          name: pvLead.name || pvLead.first_name + ' ' + pvLead.last_name,
          email: pvLead.email,
          company: pvLead.company,
          title: pvLead.title,
          phone: pvLead.phone,
          website: pvLead.website,
          source: 'vibe_plus',
          source_id: pvLead.id,
          source_data: pvLead,
          status: 'new',
        });
        stats.successful++;
      } catch (error) {
        // Check if duplicate
        if (error instanceof Error && error.message.includes('unique constraint')) {
          stats.skipped++;
        } else {
          stats.failed++;
        }
      }
    }
  } catch (error) {
    console.error('Failed to import leads:', error);
  }

  return stats;
}

async function importEmailTemplates(
  supabase: any,
  options: {
    campaignId: string;
    plusvibeCampaignId: string;
    projectId: string;
    userId: string;
    credentials: PlusVibeClientCredentials;
  }
): Promise<SyncStats> {
  const { campaignId, plusvibeCampaignId, projectId, userId, credentials } = options;
  const stats: SyncStats = { processed: 0, successful: 0, failed: 0, skipped: 0 };

  try {
    const pvEmails = await fetchCampaignEmails(plusvibeCampaignId, credentials);
    stats.processed = pvEmails.length;

    for (const pvEmail of pvEmails) {
      try {
        await supabase.from('email_templates').insert({
          user_id: userId,
          project_id: projectId,
          campaign_id: campaignId,
          name: pvEmail.name || `Template ${pvEmail.step || 1}`,
          subject: pvEmail.subject,
          body_text: pvEmail.body || pvEmail.body_text,
          body_html: pvEmail.body_html,
          template_type: pvEmail.type || 'outreach',
          sequence_position: pvEmail.step || pvEmail.sequence_position,
        });
        stats.successful++;
      } catch (error) {
        stats.failed++;
      }
    }
  } catch (error) {
    console.error('Failed to import email templates:', error);
  }

  return stats;
}

async function importEmailReplies(
  supabase: any,
  options: {
    campaignId: string;
    plusvibeCampaignId: string;
    projectId: string;
    userId: string;
    credentials: PlusVibeClientCredentials;
  }
): Promise<SyncStats> {
  const { campaignId, plusvibeCampaignId, projectId, userId, credentials } = options;
  const stats: SyncStats = { processed: 0, successful: 0, failed: 0, skipped: 0 };

  try {
    const replies = await fetchInboxReplies({ campaignId: plusvibeCampaignId, credentials, limit: 200 });
    stats.processed = replies.length;

    for (const reply of replies) {
      try {
        await supabase.from('email_replies').insert({
          user_id: userId,
          project_id: projectId,
          campaign_id: campaignId,
          from_email: reply.sender.email,
          from_name: reply.sender.name,
          to_email: reply.recipient,
          subject: reply.subject,
          body_text: reply.body,
          thread_id: reply.threadId,
          message_id: reply.id,
          source: 'vibe_plus',
          source_id: reply.id,
          source_data: reply,
          status: reply.unread ? 'new' : 'read',
          received_at: reply.receivedAt,
        });
        stats.successful++;
      } catch (error) {
        if (error instanceof Error && error.message.includes('unique constraint')) {
          stats.skipped++;
        } else {
          stats.failed++;
        }
      }
    }
  } catch (error) {
    console.error('Failed to import email replies:', error);
  }

  return stats;
}

async function exportLeads(
  supabase: any,
  options: {
    campaignId: string;
    plusvibeCampaignId: string;
    userId: string;
    credentials: PlusVibeClientCredentials;
  }
): Promise<SyncStats> {
  const { campaignId, plusvibeCampaignId, userId, credentials } = options;
  const stats: SyncStats = { processed: 0, successful: 0, failed: 0, skipped: 0 };

  try {
    // Fetch local leads
    const { data: localLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId);

    if (!localLeads || localLeads.length === 0) {
      return stats;
    }

    stats.processed = localLeads.length;

    // Format leads for PlusVibe
    const pvLeads = localLeads.map((lead: any) => ({
      email: lead.email,
      name: lead.name,
      company: lead.company,
      title: lead.title,
      phone: lead.phone,
      website: lead.website,
      ...lead.custom_fields,
    }));

    // Add leads to PlusVibe (in batches of 100)
    const batchSize = 100;
    for (let i = 0; i < pvLeads.length; i += batchSize) {
      const batch = pvLeads.slice(i, i + batchSize);
      const result = await addLeadsToCampaign(plusvibeCampaignId, batch, credentials);
      stats.successful += result.successful;
      stats.failed += result.failed;
    }
  } catch (error) {
    console.error('Failed to export leads:', error);
  }

  return stats;
}

function mapPlusVibeStatus(pvStatus: string): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    paused: 'paused',
    draft: 'draft',
    completed: 'completed',
    archived: 'archived',
  };
  return statusMap[pvStatus.toLowerCase()] || 'draft';
}

async function getConnection(supabase: any, connectionId: string, userId: string) {
  const { data, error } = await supabase
    .from('plusvibe_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('Connection not found');
  }

  return data;
}

async function createSyncHistory(
  supabase: any,
  params: {
    userId: string;
    connectionId: string;
    campaignId?: string;
    syncType: string;
    syncDirection: string;
  }
) {
  const { data, error } = await supabase
    .from('plusvibe_sync_history')
    .insert({
      user_id: params.userId,
      connection_id: params.connectionId,
      campaign_id: params.campaignId,
      sync_type: params.syncType,
      sync_direction: params.syncDirection,
      status: 'processing',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error('Failed to create sync history');
  }

  return data.id;
}

async function completeSyncHistory(
  supabase: any,
  syncHistoryId: string,
  params: {
    status: string;
    campaignId?: string;
    stats: SyncStats;
    duration: number;
    errors: any[];
  }
) {
  await supabase
    .from('plusvibe_sync_history')
    .update({
      status: params.status,
      campaign_id: params.campaignId,
      items_processed: params.stats.processed,
      items_successful: params.stats.successful,
      items_failed: params.stats.failed,
      items_skipped: params.stats.skipped,
      error_details: params.errors.length > 0 ? { errors: params.errors } : {},
      completed_at: new Date().toISOString(),
      duration_ms: params.duration,
    })
    .eq('id', syncHistoryId);
}

function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}
