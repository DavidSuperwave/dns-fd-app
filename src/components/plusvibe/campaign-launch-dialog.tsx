/**
 * Campaign Launch Dialog Component
 * 
 * Allows users to export/launch campaigns from the app to PlusVibe
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Loader2, CheckCircle } from 'lucide-react';

interface Connection {
    id: string;
    connection_name: string;
    workspace_id: string;
    is_default?: boolean;
}

interface LaunchDialogProps {
    campaignId: string;
    campaignName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    useStandardWorkspace?: boolean;
}

export function CampaignLaunchDialog({
    campaignId,
    campaignName,
    open,
    onOpenChange,
    onSuccess,
    useStandardWorkspace = false
}: LaunchDialogProps) {
    const [step, setStep] = useState<'configure' | 'launching'>('configure');
    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState('');
    const [options, setOptions] = useState({
        createNew: false,
        includeLeads: true,
        includeEmails: true,
        activateImmediately: false,
    });
    const [loading, setLoading] = useState(false);
    const [launchResult, setLaunchResult] = useState<any>(null);

    useEffect(() => {
        if (open) {
            if (useStandardWorkspace) {
                setSelectedConnectionId('standard');
            } else {
                loadConnections();
            }
            resetDialog();
        }
    }, [open, useStandardWorkspace]);

    function resetDialog() {
        setStep('configure');
        setLaunchResult(null);
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

    async function handleLaunch() {
        if (!selectedConnectionId) {
            toast.error('Please select a connection');
            return;
        }

        setStep('launching');
        setLoading(true);

        try {
            const response = await fetch(`/api/plusvibe/campaigns/${campaignId}/launch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connectionId: selectedConnectionId,
                    ...options,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to launch campaign');
            }

            const result = await response.json();
            setLaunchResult(result);
            toast.success('Campaign launched successfully!');

            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to launch campaign');
            console.error(error);
            setStep('configure');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Launch Campaign to PlusVibe</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Step 1: Configure Launch */}
                    {step === 'configure' && (
                        <div className="space-y-4">
                            <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">Campaign</h4>
                                <p className="text-sm">{campaignName}</p>
                            </div>

                            {!useStandardWorkspace && (
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
                            )}

                            {!useStandardWorkspace && connections.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No connections found. Please add a PlusVibe connection first.
                                </p>
                            )}

                            <div className="space-y-3">
                                <Label>Launch Options</Label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={options.createNew}
                                            onChange={(e) => setOptions({ ...options, createNew: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Create new campaign in PlusVibe</span>
                                    </label>
                                    <p className="text-xs text-muted-foreground ml-6">
                                        {options.createNew
                                            ? 'A new campaign will be created in PlusVibe'
                                            : 'Will update existing campaign if already synced, or create new if not'
                                        }
                                    </p>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={options.includeLeads}
                                            onChange={(e) => setOptions({ ...options, includeLeads: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Export leads to PlusVibe</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={options.includeEmails}
                                            onChange={(e) => setOptions({ ...options, includeEmails: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Export email templates</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={options.activateImmediately}
                                            onChange={(e) => setOptions({ ...options, activateImmediately: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Activate campaign immediately</span>
                                    </label>
                                    <p className="text-xs text-muted-foreground ml-6">
                                        Campaign will start sending emails right away
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleLaunch} disabled={!selectedConnectionId || loading}>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Launch Campaign
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Launching */}
                    {step === 'launching' && (
                        <div className="space-y-4 text-center py-8">
                            {loading ? (
                                <>
                                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                                    <p className="text-lg font-semibold">Launching campaign...</p>
                                    <p className="text-sm text-muted-foreground">
                                        Uploading campaign data to PlusVibe
                                    </p>
                                </>
                            ) : launchResult ? (
                                <>
                                    <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                                    <p className="text-lg font-semibold">Launch Complete!</p>
                                    <div className="bg-muted p-4 rounded-lg text-left">
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <span className="text-muted-foreground">PlusVibe Campaign ID:</span>
                                            <span className="font-mono text-xs">{launchResult.plusvibeCampaignId}</span>
                                            <span className="text-muted-foreground">Leads Exported:</span>
                                            <span className="font-semibold text-green-600">
                                                {launchResult.stats?.itemsSuccessful || 0}
                                            </span>
                                            {launchResult.stats?.itemsFailed > 0 && (
                                                <>
                                                    <span className="text-muted-foreground">Failed:</span>
                                                    <span className="font-semibold text-red-600">
                                                        {launchResult.stats.itemsFailed}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-center mt-4">
                                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                                            Close
                                        </Button>
                                        <Button
                                            onClick={() => window.open('https://app.plusvibe.ai', '_blank')}
                                        >
                                            View in PlusVibe
                                        </Button>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
