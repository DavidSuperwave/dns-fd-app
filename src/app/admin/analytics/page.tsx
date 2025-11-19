'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, RefreshCw, Activity, Users, BarChart3, Cloud, Layers } from 'lucide-react';
import { useInterval } from '@/hooks/useInterval';

type MetricSummary = {
  totalUsers: number;
  activeUsers: number;
  pendingInvites: number;
  totalDomains: number;
  domainsInProgress: number;
  inboxingTracked: number;
  inboxingIssues: number;
  totalProjects: number;
  generatingProjects: number;
  completedProjects: number;
  totalCompanies: number;
  pendingCompanies: number;
};

type LiveUserRow = {
  id: string;
  email: string | null;
  role: string | null;
  status: string | null;
  active: boolean | null;
  created_at: string | null;
};

type LiveDomainRow = {
  id: number;
  name: string | null;
  status: string | null;
  deployment_status: string | null;
  modified_on: string | null;
  last_synced: string | null;
  admin_email?: string | null;
};

type LiveProjectRow = {
  id: string;
  name: string | null;
  status: string | null;
  updated_at: string | null;
  company_profile_id: string | null;
};

type LiveInboxingRow = {
  id: number;
  domain_name: string | null;
  status: string | null;
  is_active: boolean | null;
  last_synced_at: string | null;
  tenant_primary_domain: string | null;
  updated_at: string | null;
};

type SyncRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string | null;
  total_domains: number | null;
  upserted_domains: number | null;
  error: string | null;
} | null;

type AdminAnalyticsResponse = {
  success: boolean;
  generatedAt: string;
  metrics: MetricSummary;
  liveTables: {
    users: LiveUserRow[];
    domains: LiveDomainRow[];
    projects: LiveProjectRow[];
    inboxing: LiveInboxingRow[];
  };
  syncStats: {
    lastRun: SyncRun;
  };
};

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const statusTone = (value?: string | null) => {
  if (!value) return 'bg-muted text-muted-foreground';
  const normalized = value.toLowerCase();
  if (['active', 'ready', 'completed', 'deployed', 'healthy', 'success'].some((val) => normalized.includes(val))) {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (['pending', 'generating', 'processing', 'running', 'queued', 'syncing'].some((val) => normalized.includes(val))) {
    return 'bg-amber-100 text-amber-700';
  }
  if (['error', 'failed', 'inactive', 'paused', 'blocked', 'issue', 'disabled'].some((val) => normalized.includes(val))) {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-slate-100 text-slate-700';
};

const AutoRefreshToggle = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) => (
  <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
    <div className="text-left">
      <p className="text-sm font-medium leading-none">Auto-refresh</p>
      <p className="text-xs text-muted-foreground">Refresh every 15 seconds</p>
    </div>
    <Switch checked={value} onCheckedChange={(checked) => onChange(checked === true)} />
  </div>
);

function StatusBadge({ value }: { value?: string | null }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusTone(value)}`}>
      {value?.length ? value : 'Unknown'}
    </span>
  );
}

export default function AdminAnalyticsPage() {
  const { isAdmin } = useAuth();
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      if (!options?.silent) {
        setLoading(true);
        setIsRefreshing(true);
      }

      try {
        const response = await fetch('/api/admin/analytics', { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load analytics');
        }

        setAnalytics(payload);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        if (!options?.silent) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [isAdmin, fetchAnalytics]);

  useInterval(
    () => {
      fetchAnalytics({ silent: true });
    },
    autoRefresh && isAdmin ? 15000 : null
  );

  const metricCards = useMemo(() => {
    if (!analytics) return [];

    const { metrics } = analytics;
    return [
      {
        label: 'Users',
        value: metrics.totalUsers,
        subline: `${metrics.activeUsers} active • ${metrics.pendingInvites} pending`,
        icon: <Users className="h-4 w-4 text-blue-600" />,
      },
      {
        label: 'Domains',
        value: metrics.totalDomains,
        subline: `${metrics.domainsInProgress} awaiting deployment`,
        icon: <Cloud className="h-4 w-4 text-sky-600" />,
      },
      {
        label: 'Inboxing',
        value: metrics.inboxingTracked,
        subline: `${metrics.inboxingIssues} flagged`,
        icon: <Activity className="h-4 w-4 text-emerald-600" />,
      },
      {
        label: 'Projects',
        value: metrics.totalProjects,
        subline: `${metrics.generatingProjects} generating • ${metrics.completedProjects} done`,
        icon: <BarChart3 className="h-4 w-4 text-purple-600" />,
      },
      {
        label: 'Company Profiles',
        value: metrics.totalCompanies,
        subline: `${metrics.pendingCompanies} in progress`,
        icon: <Layers className="h-4 w-4 text-rose-600" />,
      },
    ];
  }, [analytics]);

  const renderEmptyRow = (message: string, colSpan = 5) => (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Live Database & Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Monitor Supabase activity, deployment health, and inboxing syncs in real time.
            </p>
            {analytics && (
              <p className="text-xs text-muted-foreground">
                Updated {formatDateTime(analytics.generatedAt)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <AutoRefreshToggle value={autoRefresh} onChange={setAutoRefresh} />
            <Button variant="outline" onClick={() => fetchAnalytics()} disabled={isRefreshing || !isAdmin}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {!isAdmin && (
          <Alert variant="destructive">
            <AlertTitle>Admin access required</AlertTitle>
            <AlertDescription>
              You do not have permission to view the live database and analytics dashboard.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Unable to load analytics</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : analytics ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metricCards.map((card) => (
                <Card key={card.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                    {card.icon}
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{numberFormatter.format(card.value)}</div>
                    <p className="text-xs text-muted-foreground">{card.subline}</p>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Inboxing Sync Health</CardTitle>
                  <CardDescription>Latest sync run status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.syncStats.lastRun ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <StatusBadge value={analytics.syncStats.lastRun.status} />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Started</p>
                        <p className="text-sm font-medium">{formatDateTime(analytics.syncStats.lastRun.started_at)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Finished</p>
                        <p className="text-sm font-medium">{formatDateTime(analytics.syncStats.lastRun.finished_at)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Domains Processed</p>
                        <p className="text-sm font-medium">
                          {numberFormatter.format(analytics.syncStats.lastRun.upserted_domains ?? 0)} /{' '}
                          {numberFormatter.format(analytics.syncStats.lastRun.total_domains ?? 0)}
                        </p>
                      </div>
                      {analytics.syncStats.lastRun.error && (
                        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                          {analytics.syncStats.lastRun.error}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No sync runs recorded yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Workflow Snapshot</CardTitle>
                  <CardDescription>Company profile and project pipeline</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending company profiles</p>
                      <p className="text-lg font-semibold">{numberFormatter.format(analytics.metrics.pendingCompanies)}</p>
                    </div>
                    <Badge variant="secondary">Total {numberFormatter.format(analytics.metrics.totalCompanies)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Projects generating</p>
                      <p className="text-lg font-semibold">{numberFormatter.format(analytics.metrics.generatingProjects)}</p>
                    </div>
                    <Badge variant="outline">
                      Completed {numberFormatter.format(analytics.metrics.completedProjects)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Domain deployment queue</p>
                    <p className="text-xs text-muted-foreground">
                      {numberFormatter.format(analytics.metrics.domainsInProgress)} domains waiting on deployment.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Live Database Explorer</CardTitle>
                  <CardDescription>Latest records streamed from Supabase</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="domains">
                    <TabsList>
                      <TabsTrigger value="domains">Domains</TabsTrigger>
                      <TabsTrigger value="users">Users</TabsTrigger>
                      <TabsTrigger value="projects">Projects</TabsTrigger>
                      <TabsTrigger value="inboxing">Inboxing</TabsTrigger>
                    </TabsList>

                    <TabsContent value="domains" className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Deployment</TableHead>
                            <TableHead>Last Synced</TableHead>
                            <TableHead>Owner</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.liveTables.domains.length === 0
                            ? renderEmptyRow('No recent domains found.', 5)
                            : analytics.liveTables.domains.map((domain) => (
                                <TableRow key={domain.id}>
                                  <TableCell className="font-medium">{domain.name ?? '—'}</TableCell>
                                  <TableCell>
                                    <StatusBadge value={domain.status} />
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge value={domain.deployment_status} />
                                  </TableCell>
                                  <TableCell>{formatDateTime(domain.last_synced ?? domain.modified_on)}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {domain.admin_email ?? '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="users" className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.liveTables.users.length === 0
                            ? renderEmptyRow('No user records found.', 4)
                            : analytics.liveTables.users.map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.email ?? '—'}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="capitalize">
                                      {user.role ?? 'unknown'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge value={user.status ?? (user.active ? 'active' : 'inactive')} />
                                  </TableCell>
                                  <TableCell>{formatDateTime(user.created_at)}</TableCell>
                                </TableRow>
                              ))}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="projects" className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead>Company Profile</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.liveTables.projects.length === 0
                            ? renderEmptyRow('No project activity yet.', 4)
                            : analytics.liveTables.projects.map((project) => (
                                <TableRow key={project.id}>
                                  <TableCell className="font-medium">{project.name ?? '—'}</TableCell>
                                  <TableCell>
                                    <StatusBadge value={project.status} />
                                  </TableCell>
                                  <TableCell>{formatDateTime(project.updated_at)}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {project.company_profile_id ?? '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="inboxing" className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Domain</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Active</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.liveTables.inboxing.length === 0
                            ? renderEmptyRow('No inboxing domains tracked.', 5)
                            : analytics.liveTables.inboxing.map((entry) => (
                                <TableRow key={entry.id}>
                                  <TableCell className="font-medium">{entry.domain_name ?? '—'}</TableCell>
                                  <TableCell>
                                    <StatusBadge value={entry.status} />
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {entry.tenant_primary_domain ?? '—'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={entry.is_active ? 'secondary' : 'destructive'}>
                                      {entry.is_active ? 'Active' : 'Disabled'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{formatDateTime(entry.updated_at ?? entry.last_synced_at)}</TableCell>
                                </TableRow>
                              ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </section>
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No analytics data available yet.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


