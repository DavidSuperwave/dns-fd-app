/**
 * PlusVibe Connection Settings Component
 * 
 * Allows users to manage their PlusVibe API connections
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';

interface Connection {
    id: string;
    connection_name: string;
    workspace_id: string;
    is_active: boolean;
    is_default: boolean;
    last_sync_at: string | null;
    last_sync_status: string | null;
    created_at: string;
}

interface PlusVibeConnectionSettingsProps {
    companyProfileId?: string;
}

export function PlusVibeConnectionSettings({ companyProfileId }: PlusVibeConnectionSettingsProps) {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    useEffect(() => {
        loadConnections();
    }, []);

    async function loadConnections() {
        try {
            const response = await fetch('/api/plusvibe/connections');
            if (!response.ok) throw new Error('Failed to load connections');

            const data = await response.json();
            setConnections(data.connections || []);
        } catch (error) {
            toast.error('Failed to load PlusVibe connections');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function deleteConnection(id: string) {
        if (!confirm('Are you sure you want to delete this connection?')) return;

        try {
            const response = await fetch(`/api/plusvibe/connections/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete connection');

            toast.success('Connection deleted');
            loadConnections();
        } catch (error) {
            toast.error('Failed to delete connection');
            console.error(error);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center p-8">Loading connections...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">PlusVibe Connections</h2>
                    <p className="text-muted-foreground">Manage your PlusVibe API connections</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Connection
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add PlusVibe Connection</DialogTitle>
                        </DialogHeader>
                        <AddConnectionForm
                            onSuccess={() => {
                                setIsAddDialogOpen(false);
                                loadConnections();
                            }}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {connections.length === 0 ? (
                <Card className="p-8 text-center">
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="text-4xl">🔌</div>
                        <h3 className="text-lg font-semibold">No connections yet</h3>
                        <p className="text-sm text-muted-foreground">
                            Add your PlusVibe API credentials to start syncing campaigns
                        </p>
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Your First Connection
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {connections.map((conn) => (
                        <Card key={conn.id} className="p-6">
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold">{conn.connection_name}</h3>
                                            {conn.is_default && (
                                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Workspace: {conn.workspace_id.slice(0, 8)}...
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteConnection(conn.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        {conn.is_active ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <span>{conn.is_active ? 'Active' : 'Inactive'}</span>
                                    </div>

                                    {conn.last_sync_at && (
                                        <div className="text-muted-foreground">
                                            Last sync: {new Date(conn.last_sync_at).toLocaleDateString()}
                                        </div>
                                    )}

                                    {conn.last_sync_status && (
                                        <div>
                                            Status:{' '}
                                            <span className={
                                                conn.last_sync_status === 'success'
                                                    ? 'text-green-600'
                                                    : 'text-red-600'
                                            }>
                                                {conn.last_sync_status}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

function AddConnectionForm({ onSuccess }: { onSuccess: () => void }) {
    const [formData, setFormData] = useState({
        workspace_id: '',
        api_key: '',
        connection_name: '',
        is_default: false,
    });
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/plusvibe/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create connection');
            }

            toast.success('Connection added successfully');
            onSuccess();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to add connection');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="connection_name">Connection Name</Label>
                <Input
                    id="connection_name"
                    placeholder="My PlusVibe Account"
                    value={formData.connection_name}
                    onChange={(e) => setFormData({ ...formData, connection_name: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="workspace_id">Workspace ID</Label>
                <Input
                    id="workspace_id"
                    placeholder="678eb62a071ff7544034bcde"
                    required
                    value={formData.workspace_id}
                    onChange={(e) => setFormData({ ...formData, workspace_id: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input
                    id="api_key"
                    type="password"
                    placeholder="7332bc56-e2769fd4-9f1a00b6-ebb7ce28"
                    required
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                    Find your API key at{' '}
                    <a
                        href="https://app.plusvibe.ai/v2/settings/api-access/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                    >
                        PlusVibe Settings
                    </a>
                </p>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="is_default"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded"
                />
                <Label htmlFor="is_default" className="cursor-pointer">
                    Set as default connection
                </Label>
            </div>

            <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={onSuccess}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Adding...' : 'Add Connection'}
                </Button>
            </div>
        </form>
    );
}
