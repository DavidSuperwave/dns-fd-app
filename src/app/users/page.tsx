'use client';

import { useState } from 'react'; // Removed unused useEffect
import { useRealtimeUsers } from '@/hooks/useRealtimeUsers';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { v4 as uuidv4 } from 'uuid';
import { sendInvitationEmail } from '@/lib/azure-email';
import { supabaseAdmin, supabaseServiceKey } from '@/lib/supabase-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import {
  UserProfile,
  deleteUser,
  toggleUserStatus
} from '@/lib/supabase-client';

function UsersPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const { users, isLoading, refresh } = useRealtimeUsers(isAdmin);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  

  const [invitation, setInvitation] = useState({
    email: "",
    role: "user",
    active: true,
    status: "pending" as const
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setSending] = useState(false);

  const handleSendInvitation = async () => {
    if (!invitation.email) {
      toast.error("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invitation.email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    setSending(true);
    try {
      if (!isAdmin) {
        throw new Error('Only administrators can invite users');
      }
      
      // Send invitation through the API using service key
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          email: invitation.email,
          role: invitation.role
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send invitation');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      // Reset form and show success message
      setInvitation({
        email: "",
        role: "user",
        active: true,
        status: "pending"
      });
      setIsDialogOpen(false);
      
      toast.success(
        `Invited ${invitation.email} to join the platform as ${formatRole(invitation.role)}`,
        {
          duration: 4000,
          className: "bg-green-50 border border-green-200",
          descriptionClassName: "text-green-800",
          style: {
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
          }
        }
      );

      // Refresh the users list immediately
      await refresh();
    } catch (error) {
      // Log raw error first
      console.error('Raw invitation error:', error);
      
      // Get error details
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : undefined,
        stack: error instanceof Error ? error.stack : undefined,
        email: invitation.email,
        role: invitation.role,
        context: 'handleSendInvitation'
      };
      
      console.error('Error sending invitation:', errorDetails);
      
      // Extract the most useful error message
      let errorMessage = 'Failed to send invitation';
      let errorDescription = 'Please try again or contact support if the issue persists.';

      // Get the most descriptive error message
      errorMessage = error instanceof Error ? error.message : 'Failed to send invitation';
      
      // Check for known error patterns
      if (errorMessage.toLowerCase().includes('already exists')) {
        errorDescription = 'This email is already registered.';
      } else if (errorMessage.toLowerCase().includes('invalid email')) {
        errorDescription = 'Please check the email address and try again.';
      } else if (errorMessage.toLowerCase().includes('profile')) {
        errorDescription = 'There was an issue creating the user profile. Please try again.';
      }
      
      toast.error(errorMessage, {
        duration: 5000,
        description: errorDescription
      });
    } finally {
      setSending(false);
    }
  };

  const handleToggleUserStatus = async (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    
    try {
      const success = await toggleUserStatus(id, !user.active);
      if (success) {
        // The real-time subscription will update the UI
        toast.success(
          `User ${user.email} ${user.active ? "deactivated" : "activated"}`
        );
      } else {
        toast.error(`Failed to ${user.active ? "deactivate" : "activate"} user`);
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error(`Failed to ${user.active ? "deactivate" : "activate"} user`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    const userToDelete = users.find((user) => user.id === id);
    if (!userToDelete) return;
    
    try {
      const success = await deleteUser(id);
      if (success) {
        toast.success(`User ${userToDelete.email} removed successfully`);
        // Force a full page refresh to ensure everything is in sync
        router.refresh();
      } else {
        toast.error('Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleRefreshUserStatus = async (userId: string) => {
    const userToRefresh = users.find((user) => user.id === userId);
    if (!userToRefresh) return;

    const toastId = toast.loading(`Refreshing status for ${userToRefresh.email}...`);

    try {
      const response = await fetch('/api/users/refresh-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to refresh status: ${response.statusText}`);
      }

      const result = await response.json();
      toast.success(`Status refreshed for ${userToRefresh.email}. New status: ${result.newStatus}`, {
        id: toastId,
      });
      // Refresh the user list data using the hook's refresh function
      await refresh(); 
    } catch (error) {
      console.error('Error refreshing user status:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Failed to refresh status for ${userToRefresh.email}: ${errorMessage}`, {
        id: toastId,
      });
    }
  };



  const getRoleBadgeStyle = (role: string | undefined) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium";
      case "user":
        return "bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium";
      case "guest":
        return "bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium";
      default:
        return "bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium";
    }
  };
  
  const formatRole = (role: string | undefined): string => {
    if (!role) return 'User';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage user accounts and permissions.
          </p>
        </div>
        <div className="flex space-x-2">
          {isAdmin && (
            <>
              {/* Removed manual sync button since we now have real-time updates */}
            </>
          )}
          
          {isAdmin ? (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>Invite User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                  <DialogDescription>
                    Enter the email address of the person you want to invite. They will receive an email with instructions to set up their account.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      className="col-span-3"
                      type="email"
                      value={invitation.email}
                      onChange={(e) =>
                        setInvitation({ ...invitation, email: e.target.value })
                      }
                      placeholder="john.doe@example.com"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">
                      Role
                    </Label>
                    <Select
                      value={invitation.role}
                      onValueChange={(value) =>
                        setInvitation({
                          ...invitation,
                          role: value as "admin" | "user" | "guest",
                        })
                      }
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="user">Regular User</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="active" className="text-right">
                      Status
                    </Label>
                    <div className="flex items-center space-x-2 col-span-3">
                      <Checkbox
                        id="active"
                        checked={invitation.active}
                        onCheckedChange={(checked) =>
                          setInvitation({
                            ...invitation,
                            active: checked as boolean,
                          })
                        }
                      />
                      <label
                        htmlFor="active"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Active
                      </label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendInvitation}
                    disabled={isSending}
                  >
                    {isSending ? "Sending..." : "Invite"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="text-sm text-gray-500">
              Only administrators can invite new users
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Email</TableHead>
              <TableHead className="w-[150px]">Role</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
              <TableHead className="w-[200px]">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !users.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  No users found.
                </TableCell>
              </TableRow>
            ) : users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <span className={getRoleBadgeStyle(user.role)}>
                    {formatRole(user.role)}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={
                      user.status === "pending"
                        ? "bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium"
                        : user.active
                        ? "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium"
                        : "bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium"
                    }
                  >
                    {user.status === "pending" ? "Pending" : user.active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell>{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRefreshUserStatus(user.id)}
                      // Add loading state later
                    >
                      Refresh Status
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/users/${user.id}`)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleUserStatus(user.id)}
                    >
                      {user.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUserToDelete(user);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="text-red-600 hover:text-red-900 hover:bg-red-100"
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the user {userToDelete?.email}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (userToDelete) {
                  await handleDeleteUser(userToDelete.id);
                  setIsDeleteDialogOpen(false);
                }
              }}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default UsersPage;