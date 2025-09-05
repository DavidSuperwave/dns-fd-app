'use client';

import { useState, useEffect } from 'react'; // Added useEffect back
// Removed useRealtimeUsers import
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { v4 as uuidv4 } from 'uuid';
import { Eye } from 'lucide-react';
import { sendInvitationEmail } from '@/lib/azure-email';
import { createClient } from '@/lib/supabase-client'; // Import createClient, removed supabaseAdmin and supabaseServiceKey
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
import { SetupInvitationsButton } from '@/components/admin/setup-invitations-button';
import { UserInfoDialog } from '@/components/admin/user-info-dialog';
import {
  UserProfile,
  // Removed deleteUser, toggleUserStatus imports as they are now handled via API
} from '@/lib/supabase-client';

function UsersPage() {
  const router = useRouter();
  const { isAdmin, user, session } = useAuth(); // Get session for token
  // State for users fetched from API
  const [usersWithDomains, setUsersWithDomains] = useState<any[]>([]); // Use 'any' for now, define a proper type later
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userToDelete, setUserToDelete] = useState<any | null>(null); // Use 'any' for now
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isUserInfoDialogOpen, setIsUserInfoDialogOpen] = useState(false);

  const [invitation, setInvitation] = useState({
    email: "",
    role: "user",
    active: true,
    status: "pending" as const
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setSending] = useState(false);

  // Function to fetch users from the new API
  const fetchUsersWithDomains = async () => {
    if (!isAdmin || !session?.access_token) {
      setIsLoading(false);
      setError(isAdmin ? 'Session token not available.' : 'Access denied.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/with-domains', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      setUsersWithDomains(data);
    } catch (err) {
      console.error("Error fetching users with domains:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setUsersWithDomains([]); // Clear data on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on component mount and when admin status changes
  useEffect(() => {
    fetchUsersWithDomains();
  }, [isAdmin, session?.access_token]); // Re-fetch if session changes

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
          // REMOVED Authorization header - API endpoint must handle auth internally
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

      // Refresh the users list immediately by calling the fetch function
      await fetchUsersWithDomains();
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
    // Find user in the new state variable
    const user = usersWithDomains.find((u) => u.id === id);
    if (!user) return;

    const newActiveState = !user.active;
    const action = newActiveState ? "activate" : "deactivate";
    const toastId = toast.loading(`${action === 'activate' ? 'Activating' : 'Deactivating'} user ${user.email}...`);

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: newActiveState }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        // Real-time should update, but show success toast immediately
        toast.success(`User ${user.email} ${action}d successfully.`, { id: toastId });
        // Refresh data after successful toggle
        await fetchUsersWithDomains();
      } else {
         throw new Error('API call succeeded but action failed.');
      }
    } catch (error) {
      console.error(`Error toggling user status for ${id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Failed to ${action} user ${user.email}: ${errorMessage}`, { id: toastId });
    }
  };

  const handleViewUserInfo = (user: any) => {
    setSelectedUser(user);
    setIsUserInfoDialogOpen(true);
  };

  const handleUserUpdate = (updatedUser: any) => {
    setUsersWithDomains(prev => 
      prev.map(user => user.id === updatedUser.id ? { ...user, ...updatedUser } : user)
    );
  };

  const handleUserDelete = (userId: string) => {
    setUsersWithDomains(prev => prev.filter(user => user.id !== userId));
  };

  const handleDeleteUser = async (id: string) => {
    // Find user in the new state variable
    const userToDelete = usersWithDomains.find((user) => user.id === id);
    if (!userToDelete) return;

    const toastId = toast.loading(`Deleting user ${userToDelete.email}...`);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // No body needed for DELETE
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success(`User ${userToDelete.email} deleted successfully.`, { id: toastId });
        // Refresh data after successful delete
        await fetchUsersWithDomains();
      } else {
        throw new Error('API call succeeded but deletion failed.');
      }
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Failed to delete user ${userToDelete.email}: ${errorMessage}`, { id: toastId });
    }
  };

  const handleRefreshUserStatus = async (userId: string) => {
    // Find user in the new state variable
    const userToRefresh = usersWithDomains.find((user) => user.id === userId);
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
      // Refresh the user list data by calling the fetch function
      await fetchUsersWithDomains();
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
              <SetupInvitationsButton />
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
              <TableHead>Assigned Domains</TableHead> {/* New Column */}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? ( // Check loading state first
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4"> {/* Updated colSpan */}
                  Loading users...
                </TableCell>
              </TableRow>
            ) : error ? ( // Display error if fetch failed
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-red-600"> {/* Updated colSpan */}
                  Error loading users: {error}
                </TableCell>
              </TableRow>
            ) : usersWithDomains.length === 0 ? ( // Check if array is empty after loading
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4"> {/* Updated colSpan */}
                  No users found.
                </TableCell>
              </TableRow>
            ) : usersWithDomains.map((user) => ( // Map over the new state variable
              // Ensure no extra whitespace between TableCell elements
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <span className={getRoleBadgeStyle(user.role)}>
                    {formatRole(user.role)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={user.status === "pending" ? "bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium" : user.active ? "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium" : "bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium"}>
                    {user.status === "pending" ? "Pending" : user.active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell>{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell>
                  {user.domain_names && user.domain_names.length > 0 ? 
                    user.domain_names.join(', ') : 
                    <span className="text-xs text-gray-500">None</span>
                  }
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleViewUserInfo(user)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Info
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>


      {/* User Info Dialog */}
      {selectedUser && (
        <UserInfoDialog
          user={selectedUser}
          isOpen={isUserInfoDialogOpen}
          onClose={() => {
            setIsUserInfoDialogOpen(false);
            setSelectedUser(null);
          }}
          onUserUpdate={handleUserUpdate}
          onUserDelete={handleUserDelete}
        />
      )}
    </DashboardLayout>
  );
}

export default UsersPage;