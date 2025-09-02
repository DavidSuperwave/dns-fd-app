"use client";

import { useEffect, useState } from "react";
import { UserSettingsDialog } from "@/components/admin/user-settings-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase-client";
import { format } from "date-fns";
import { useAuth } from "@/components/auth/auth-provider";

type UserStatus = 'pending' | 'active' | 'inactive';

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  status: UserStatus;
}

interface UserData {
  id: string;
  email: string;
  created_at: string;
  status: UserStatus;
  domain_names: string[];
}

type SortField = 'email' | 'created_at' | 'status' | 'domain_count';
type SortDirection = 'asc' | 'desc';

export function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('email');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [hasDomains, setHasDomains] = useState<'all' | 'with' | 'without'>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const supabase = createClient();
  const { session, isAdmin } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin || !session?.access_token) {
        setError(isAdmin ? 'No session available' : 'Access denied');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/users-with-domains', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [isAdmin, session?.access_token]); // Re-fetch if admin status or session changes

  const handleBulkStatusUpdate = async (status: UserStatus) => {
    if (!session?.access_token) {
      toast.error('No session available');
      return;
    }
    try {
      setIsBulkUpdating(true);
      
      // Update each selected user
      const updatePromises = Array.from(selectedUsers).map(userId =>
        fetch('/api/admin/users-with-domains', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ userId, status })
        }).then(async response => {
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
      );

      await Promise.all(updatePromises);

      // Update local state
      setUsers(users.map(user =>
        selectedUsers.has(user.id)
              ? { ...user, status: status }
          : user
      ));

      // Clear selection
      setSelectedUsers(new Set());

      toast.success(`Successfully updated ${selectedUsers.size} users to ${status}`);
    } catch (error) {
      console.error('Error updating user statuses:', error);
      // Log detailed error info
      if (error instanceof Error) {
        console.log('Bulk update error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      } else {
        console.log('Non-Error object:', error);
      }
      
      // Try to extract any Supabase error details
      const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
      const errorMessage = supabaseError.message || supabaseError.details || 'Failed to update users';
      toast.error(errorMessage);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    if (!session?.access_token) {
      toast.error('No session available');
      return;
    }
    try {
      const response = await fetch('/api/admin/users-with-domains', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId, status })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('User not found');

      // Update local state
      setUsers(users.map((user) =>
        user.id === userId
          ? { ...user, status: status }
          : user
      ));

      toast.success('User status updated successfully');
    } catch (error) {
      console.error('Error updating user status:', error);
      // Log detailed error info
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      } else {
        console.log('Non-Error object:', error);
      }
      
      // Try to extract any Supabase error details
      const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
      const errorMessage = supabaseError.message || supabaseError.details || 'Failed to update user status';
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[200px] text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
          <Input
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={(value: UserStatus | 'all') => setStatusFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={hasDomains} onValueChange={(value: 'all' | 'with' | 'without') => setHasDomains(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="with">With Domains</SelectItem>
              <SelectItem value="without">Without Domains</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {selectedUsers.size > 0 && (
          <div className="flex gap-4 items-center">
            <span className="text-sm text-muted-foreground">
              {selectedUsers.size} user{selectedUsers.size === 1 ? '' : 's'} selected
            </span>
            <Select 
              value="" 
              onValueChange={(value: UserStatus) => handleBulkStatusUpdate(value)}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Update status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Set as Active</SelectItem>
                <SelectItem value="inactive">Set as Inactive</SelectItem>
                <SelectItem value="pending">Set as Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedUsers.size > 0 && selectedUsers.size === users.length}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) {
                        setSelectedUsers(new Set(users.map(u => u.id)));
                      } else {
                        setSelectedUsers(new Set());
                      }
                    }}
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSortDirection(sortField === 'email' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc');
                    setSortField('email');
                  }}
                >
                  Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSortDirection(sortField === 'created_at' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc');
                    setSortField('created_at');
                  }}
                >
                  Join Date {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSortDirection(sortField === 'status' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc');
                    setSortField('status');
                  }}
                >
                  Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSortDirection(sortField === 'domain_count' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc');
                    setSortField('domain_count');
                  }}
                >
                  Active Domains {sortField === 'domain_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead>Pending Domains</TableHead>
                <TableHead className="w-[80px]">Settings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...users]
                .filter(user => 
                  user.email.toLowerCase().includes(searchQuery.toLowerCase()) &&
                  (statusFilter === 'all' || user.status === statusFilter) &&
                  (hasDomains === 'all' || 
                    (hasDomains === 'with' && (user.domain_names?.length || 0) > 0) ||
                    (hasDomains === 'without' && (user.domain_names?.length || 0) === 0))
                )
                .sort((a, b) => {
                if (sortField === 'email') {
                  return sortDirection === 'asc' ? 
                    a.email.localeCompare(b.email) : 
                    b.email.localeCompare(a.email);
                } else if (sortField === 'created_at') {
                  return sortDirection === 'asc' ? 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                } else if (sortField === 'status') {
                  return sortDirection === 'asc' ? 
                    (a.status || 'pending').localeCompare(b.status || 'pending') : 
                    (b.status || 'pending').localeCompare(a.status || 'pending');
                } else if (sortField === 'domain_count') {
                  const aCount = a.domain_names?.length || 0;
                  const bCount = b.domain_names?.length || 0;
                  return sortDirection === 'asc' ? aCount - bCount : bCount - aCount;
                }
                return 0;
              }).map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={(checked: boolean) => {
                        const newSelected = new Set(selectedUsers);
                        if (checked) {
                          newSelected.add(user.id);
                        } else {
                          newSelected.delete(user.id);
                        }
                        setSelectedUsers(newSelected);
                      }}
                    />
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.status || 'pending'}
                      onValueChange={(value) => handleStatusChange(user.id, value as UserStatus)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{user.domain_names?.length || 0}</TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>
                    <UserSettingsDialog 
                      userId={user.id}
                      userEmail={user.email}
                      userStatus={user.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
    </div>
  );
}
