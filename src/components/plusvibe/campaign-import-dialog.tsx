/**
 * Campaign Import Dialog Component
 * 
 * Allows users to import campaigns from PlusVibe into their projects
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, Loader2, CheckCircle } from 'lucide-react';

interface Connection {
    id: string;
    connection_name: string;
    workspace_id: string;
    api_key: string;
}

interface PlusVibeCampaign {
    id: string;
    name: string;
    status: string;
    description?: string;
    stats?: {
        emails_sent?: number;
        replies?: number;
    };
}

interface ImportDialogProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (campaignId: string) => void;
}

export function CampaignImportDialog({ projectId, open, onOpenChange, onSuccess }: ImportDialogProps) {
    const [step, setStep] = useState<'select_connection' | 'select_campaign' | 'configure' | 'importing'>('select_connection');
    const [connections, setConnections] = useState<Connection[]>([]);
    const [campaigns, setCampaigns] = useState<PlusVibeCampaign[]>([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [options, setOptions] = useState({
        includeLeads: true,
        includeEmails: true,
        includeReplies: true,
        autoSync: true,
    });
    const [loading, setLoading] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);

    useEffect(() => {
        if (open) {
            loadConnections();
            resetDialog();
        }
    }, [open]);

    useEffect(() => {
        if (selectedConnectionId) {
            loadCampaigns();
        }
    }, [selectedConnectionId]);

    function resetDialog() {
        setStep('select_connection');
        setSelectedConnectionId('');
        setSelectedCampaignId('');
        setImportResult(null);
    }

    async function loadConnections() {
        try {
            const response = await fetch('/api/plusvibe/connections');
            const data = await response.json();
            setConnections(data.connections || []);

            // Auto-select default connection
            const defaultConn = data.connections?.find((c: Connection) => c.is_default);
            if (defaultConn) {
                setSelectedConnectionId(defaultConn.id);
            }
        } catch (error) {
            toast.error('Failed to load connections');
            console.error(error);
        }
    }

    async function loadCampaigns() {
        setLoading(true);
        try {
            const response = await fetch(`/api/plusvibe/campaigns?connection_id=${selectedConnectionId}`);
            const data = await response.json();
            setCampaigns(data.campaigns || []);
            setStep('select_campaign');
        } catch (error) {
            toast.error('Failed to load campaigns from PlusVibe');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleImport() {
        if (!selectedCampaignId) {
            toast.error('Please select a campaign');
            return;
        }

        setStep('importing');
        setLoading(true);

        try {
            const response = await fetch('/api/plusvibe/campaigns/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plusvibeCampaignId: selectedCampaignId,
                    projectId,
                    connectionId: selectedConnectionId,
                    ...options,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to import campaign');
            }

            const result = await response.json();
            setImportResult(result);
            toast.success('Campaign imported successfully!');

            if (onSuccess && result.campaignId) {
                onSuccess(result.campaignId);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to import campaign');
            console.error(error);
            setStep('configure');
        } finally {
            setLoading(false);
        }
    }

    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import Campaign from PlusVibe</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Step 1: Select Connection */}
                    {step === 'select_connection' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>PlusVibe Connection</Label>
                                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a connection" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {connections.map((conn) => (
                                            <SelectItem key={conn.id} value={conn.id}>
                                                {conn.connection_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {connections.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No connections found. Please add a PlusVibe connection first.
                                </p>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => loadCampaigns()}
                                    disabled={!selectedConnectionId || loading}
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Select Campaign */}
                    {step === 'select_campaign' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select Campaign</Label>
                                <div className="max-h-96 overflow-y-auto space-y-2">
                                    {campaigns.length === 0 ? (
                                        <p className="text-sm text-muted-foreground p-4 text-center">
                                            No campaigns found in this workspace
                                        </p>
                                    ) : (
                                        campaigns.map((campaign) => (
                                            <div
                                                key={campaign.id}
                                                onClick={() => setSelectedCampaignId(campaign.id)}
                                                className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedCampaignId === campaign.id
                                                        ? 'border-primary bg-primary/5'
                                                        : 'hover:border-primary/50'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold">{campaign.name}</h4>
                                                        {campaign.description && (
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                {campaign.description}
                                                            </p>
                                                        )}
                                                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                                            <span>Status: {campaign.status}</span>
                                                            {campaign.stats?.emails_sent && (
                                                                <span>Sent: {campaign.stats.emails_sent}</span>
                                                            )}
                                                            {campaign.stats?.replies && (
                                                                <span>Replies: {campaign.stats.replies}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between gap-2">
                                <Button variant="outline" onClick={() => setStep('select_connection')}>
                                    Back
                                </Button>
                                <Button
                                    onClick={() => setStep('configure')}
                                    disabled={!selectedCampaignId}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Configure Import */}
                    {step === 'configure' && (
                        <div className="space-y-4">
                            <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">Selected Campaign</h4>
                                <p className="text-sm">{selectedCampaign?.name}</p>
                            </div>

                            <div className="space-y-3">
                                <Label>Import Options</Label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={options.includeLeads}
                                            onChange={(e) => setOptions({ ...options, includeLeads: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Import leads</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={options.includeEmails}
                                            onChange={(e) => setOptions({ ...options, includeEmails: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Import email templates</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={options.includeReplies}
                                            onChange={(e) => setOptions({ ...options, includeReplies: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Import email replies</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={options.autoSync}
                                            onChange={(e) => setOptions({ ...options, autoSync: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Enable auto-sync</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-between gap-2">
                                <Button variant="outline" onClick={() => setStep('select_campaign')}>
                                    Back
                                </Button>
                                <Button onClick={handleImport} disabled={loading}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Import Campaign
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Importing */}
                    {step === 'importing' && (
                        <div className="space-y-4 text-center py-8">
                            {loading ? (
                                <>
                                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                                    <p className="text-lg font-semibold">Importing campaign...</p>
                                    <p className="text-sm text-muted-foreground">
                                        This may take a moment depending on the campaign size
                                    </p>
                                </>
                            ) : importResult ? (
                                <>
                                    <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                                    <p className="text-lg font-semibold">Import Complete!</p>
                                    <div className="bg-muted p-4 rounded-lg text-left">
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <span className="text-muted-foreground">Processed:</span>
                                            <span className="font-semibold">{importResult.stats?.itemsProcessed || 0}</span>
                                            <span className="text-muted-foreground">Successful:</span>
                                            <span className="font-semibold text-green-600">{importResult.stats?.itemsSuccessful || 0}</span>
                                            <span className="text-muted-foreground">Failed:</span>
                                            <span className="font-semibold text-red-600">{importResult.stats?.itemsFailed || 0}</span>
                                        </div>
                                    </div>
                                    <Button onClick={() => onOpenChange(false)} className="mt-4">
                                        Done
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
