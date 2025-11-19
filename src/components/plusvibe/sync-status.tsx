/**
 * Campaign Sync Status Badge Component
 * 
 * Displays sync status for campaigns with PlusVibe
 */

'use client';

import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SyncStatusBadgeProps {
    campaign: {
        sync_with_plusvibe?: boolean;
        plusvibe_sync_status?: string;
        plusvibe_sync_error?: string;
        last_plusvibe_sync?: string;
        auto_sync_enabled?: boolean;
    };
    showLabel?: boolean;
}

export function CampaignSyncStatusBadge({ campaign, showLabel = true }: SyncStatusBadgeProps) {
    if (!campaign.sync_with_plusvibe) {
        return null; // Not synced with PlusVibe
    }

    const getStatusConfig = () => {
        switch (campaign.plusvibe_sync_status) {
            case 'synced':
                return {
                    icon: <CheckCircle2 className="h-3 w-3" />,
                    label: 'Synced',
                    variant: 'default' as const,
                    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
                };
            case 'syncing':
                return {
                    icon: <RefreshCw className="h-3 w-3 animate-spin" />,
                    label: 'Syncing',
                    variant: 'secondary' as const,
                    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                };
            case 'pending':
                return {
                    icon: <Cloud className="h-3 w-3" />,
                    label: 'Pending',
                    variant: 'secondary' as const,
                    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
                };
            case 'error':
                return {
                    icon: <AlertCircle className="h-3 w-3" />,
                    label: 'Error',
                    variant: 'destructive' as const,
                    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
                };
            default:
                return {
                    icon: <CloudOff className="h-3 w-3" />,
                    label: 'Not Synced',
                    variant: 'outline' as const,
                    className: '',
                };
        }
    };

    const status = getStatusConfig();
    const lastSyncDate = campaign.last_plusvibe_sync
        ? new Date(campaign.last_plusvibe_sync).toLocaleString()
        : 'Never';

    const tooltipContent = (
        <div className="space-y-1">
            <div className="font-semibold">PlusVibe Sync</div>
            <div className="text-xs space-y-1">
                <div>Status: {status.label}</div>
                <div>Last sync: {lastSyncDate}</div>
                {campaign.auto_sync_enabled && <div>Auto-sync: Enabled</div>}
                {campaign.plusvibe_sync_error && (
                    <div className="text-red-400 mt-2">Error: {campaign.plusvibe_sync_error}</div>
                )}
            </div>
        </div>
    );

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant={status.variant} className={`gap-1.5 ${status.className}`}>
                        {status.icon}
                        {showLabel && <span className="text-xs">{status.label}</span>}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>{tooltipContent}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

interface SyncActionButtonsProps {
    campaignId: string;
    onImport?: () => void;
    onLaunch?: () => void;
    isSynced?: boolean;
}

export function CampaignSyncActionButtons({
    campaignId,
    onImport,
    onLaunch,
    isSynced
}: SyncActionButtonsProps) {
    return (
        <div className="flex gap-2">
            {!isSynced && onLaunch && (
                <button
                    onClick={onLaunch}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                    <Cloud className="h-3 w-3" />
                    Launch to PlusVibe
                </button>
            )}
            {isSynced && (
                <button
                    onClick={() => {/* Manual sync */ }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                    <RefreshCw className="h-3 w-3" />
                    Sync Now
                </button>
            )}
        </div>
    );
}
