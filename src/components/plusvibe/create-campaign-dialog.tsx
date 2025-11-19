'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

interface Connection {
    id: string;
    connection_name: string;
    workspace_id: string;
    is_default?: boolean;
}

interface CreateCampaignDialogProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (campaignId: string) => void;
}

export function CreateCampaignDialog({ projectId, open, onOpenChange, onSuccess }: CreateCampaignDialogProps) {
    const [loading, setLoading] = useState(false);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        fromName: '',
        fromEmail: '',
    });

    useEffect(() => {
        if (open) {
            loadConnections();
            setFormData({
                name: '',
                description: '',
                fromName: '',
                fromEmail: '',
            });
        }
    }, [open]);

    async function loadConnections() {
        try {
            const response = await fetch('/api/plusvibe/connections');
            const data = await response.json();
            setConnections(data.connections || []);

            // Auto-select default connection
            const defaultConn = data.connections?.find((c: Connection) => c.is_default);
            if (defaultConn) {
                setSelectedConnectionId(defaultConn.id);
            } else if (data.connections?.length > 0) {
                setSelectedConnectionId(data.connections[0].id);
            }
        } catch (error) {
            toast.error('Failed to load connections');
            console.error(error);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!selectedConnectionId) {
            toast.error('Please select a PlusVibe connection');
            return;
        }

        if (!formData.name) {
            toast.error('Campaign name is required');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/plusvibe/campaigns/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    connectionId: selectedConnectionId,
                    ...formData
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create campaign');
            }

            const result = await response.json();
            toast.success('Campaign created successfully!');

            if (onSuccess && result.campaignId) {
                onSuccess(result.campaignId);
            }

            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create campaign');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Campaign</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        {connections.length === 0 && (
                            <p className="text-xs text-muted-foreground text-red-500">
                                No connections found. Please add one in Settings first.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Campaign Name</Label>
                        <Input
                            placeholder="e.g. Q4 Outreach"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Textarea
                            placeholder="Campaign goals..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>From Name (Optional)</Label>
                            <Input
                                placeholder="John Doe"
                                value={formData.fromName}
                                onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>From Email (Optional)</Label>
                            <Input
                                type="email"
                                placeholder="john@example.com"
                                value={formData.fromEmail}
                                onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !selectedConnectionId}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Create Campaign
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
