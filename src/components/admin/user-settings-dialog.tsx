"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings2, Loader2, User, Building2, BadgeInfo } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth/auth-provider";

type UserStatus = 'pending' | 'active' | 'inactive';

interface UserSettingsDialogProps {
  userId: string;
  userEmail: string;
  userStatus: UserStatus;
}

export function UserSettingsDialog({ userId, userEmail, userStatus }: UserSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  // Form state for user data
  const [userData, setUserData] = useState({
    displayName: "",
    role: "",
    internalNotes: "",
  });

  // Form state for company assignment
  const [companyData, setCompanyData] = useState({
    companyId: "",
    role: "member", // Default role in company
  });

  // Mock list of companies (this would come from an API in the real implementation)
  const mockCompanies = [
    { id: "1", name: "Acme Corp" },
    { id: "2", name: "Wayne Enterprises" },
    { id: "3", name: "Stark Industries" },
  ];

  // Load user data when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    
    if (newOpen) {
      // In a real implementation, you would fetch the user's data here
      console.log(`Loading settings for user ${userId}`);
      
      // Mock data loading
      setUserData({
        displayName: userEmail.split('@')[0],
        role: "user",
        internalNotes: "",
      });
      
      setCompanyData({
        companyId: "",
        role: "member",
      });
    }
  };

  const handleUserDataSubmit = async () => {
    if (!session?.access_token) {
      toast.error('No session available');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // In a real implementation, this would call your API
      console.log('Saving user data:', userData);
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success('User data updated successfully');
    } catch (error) {
      console.error('Error updating user data:', error);
      toast.error('Failed to update user data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySubmit = async () => {
    if (!session?.access_token) {
      toast.error('No session available');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // In a real implementation, this would call your API
      console.log('Assigning user to company:', companyData);
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success('User assigned to company successfully');
    } catch (error) {
      console.error('Error assigning user to company:', error);
      toast.error('Failed to assign user to company');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>User Settings</DialogTitle>
          <DialogDescription>
            Manage user data and company assignments
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-3 rounded-md border p-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1 flex-1">
            <p className="text-sm font-medium">{userEmail}</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-semibold ${userStatus === 'active' ? 'bg-green-100 text-green-700' : userStatus === 'inactive' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {userStatus === 'active' ? 'Active' : userStatus === 'inactive' ? 'Inactive' : 'Pending'}
              </span>
              <span className="text-xs text-muted-foreground">ID: {userId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="user-data" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="user-data">User Data</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
          </TabsList>
          
          <TabsContent value="user-data" className="space-y-4 mt-4">
            <div className="flex items-center space-x-2 mb-4">
              <User className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">User Information</h4>
            </div>
            
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="display-name" className="text-right">
                  Display Name
                </Label>
                <Input
                  id="display-name"
                  value={userData.displayName}
                  onChange={(e) => setUserData({ ...userData, displayName: e.target.value })}
                  className="col-span-3"
                  disabled={isLoading}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Select 
                  value={userData.role} 
                  onValueChange={(value) => setUserData({ ...userData, role: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="internal-notes" className="text-right">
                  Internal Notes
                </Label>
                <Input
                  id="internal-notes"
                  value={userData.internalNotes}
                  onChange={(e) => setUserData({ ...userData, internalNotes: e.target.value })}
                  className="col-span-3"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleUserDataSubmit} disabled={isLoading} className="relative">
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </TabsContent>
          
          <TabsContent value="company" className="space-y-4 mt-4">
            <div className="flex items-center space-x-2 mb-4">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Company Assignment</h4>
            </div>
            
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company" className="text-right">
                  Company
                </Label>
                <Select 
                  value={companyData.companyId} 
                  onValueChange={(value) => setCompanyData({ ...companyData, companyId: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not Assigned</SelectItem>
                    {mockCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company-role" className="text-right">
                  Role in Company
                </Label>
                <Select 
                  value={companyData.role} 
                  onValueChange={(value) => setCompanyData({ ...companyData, role: value })}
                  disabled={!companyData.companyId || isLoading}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {companyData.companyId && (
                <div className="rounded-md bg-muted p-3 mt-2">
                  <div className="flex items-start gap-2">
                    <BadgeInfo className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">About Company Assignments</p>
                      <p className="text-xs text-muted-foreground">
                        Assigning this user to a company will grant them access to company resources and dashboards.
                        The user's role determines their permissions within the company.  
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                onClick={handleCompanySubmit} 
                disabled={isLoading || !companyData.companyId}
                className="relative"
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isLoading ? "Saving..." : "Save Assignment"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
