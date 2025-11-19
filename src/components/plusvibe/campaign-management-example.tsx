/**
 * Example usage of PlusVibe components in a project campaign page
 * This shows how to integrate the import/launch dialogs
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { CampaignImportDialog } from '@/components/plusvibe/campaign-import-dialog';
import { CampaignLaunchDialog } from '@/components/plusvibe/campaign-launch-dialog';
import { CampaignSyncStatusBadge } from '@/components/plusvibe/sync-status';

interface Campaign {
    id: string;
    name: string;
    sync_with_plusvibe?: boolean;
    plusvibe_sync_status?: string;
    plusvibe_sync_error?: string;
    last_plusvibe_sync?: string;
    auto_sync_enabled?: boolean;
}

export function CampaignManagementExample({ projectId, campaigns }: { projectId: string; campaigns: Campaign[] }) {
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

    function handleLaunchClick(campaign: Campaign) {
        setSelectedCampaign(campaign);
        setLaunchDialogOpen(true);
    }

    return (
        <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex gap-2">
                <Button onClick={() => setImportDialogOpen(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    Import from PlusVibe
                </Button>
            </div>

            {/* Campaign List with Sync Status */}
            <div className="space-y-2">
                {campaigns.map((campaign) => (
                    <div key={campaign.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="font-semibold">{campaign.name}</h3>
                                <CampaignSyncStatusBadge campaign={campaign} />
                            </div>

                            {!campaign.sync_with_plusvibe && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLaunchClick(campaign)}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Launch to PlusVibe
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Dialogs */}
            <CampaignImportDialog
                projectId={projectId}
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onSuccess={(campaignId) => {
                    console.log('Campaign imported:', campaignId);
                    // Refresh campaigns list
                }}
            />

            {selectedCampaign && (
                <CampaignLaunchDialog
                    campaignId={selectedCampaign.id}
                    campaignName={selectedCampaign.name}
                    open={launchDialogOpen}
                    onOpenChange={setLaunchDialogOpen}
                    onSuccess={() => {
                        console.log('Campaign launched');
                        // Refresh campaigns list
                    }}
                />
            )}
        </div>
    );
}
