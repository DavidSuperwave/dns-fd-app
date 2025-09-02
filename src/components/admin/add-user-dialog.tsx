"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanySelect } from "./company-select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useAuth } from "@/components/auth/auth-provider";

const roleOptions = ["owner", "admin", "support", "sales", "user"] as const;
type RoleType = (typeof roleOptions)[number];

// Form schema for user creation
const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  role: z.enum(roleOptions, {
    required_error: "Please select a role",
  }),
  active: z.boolean().default(true),
  companyId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({  
    resolver: zodResolver(formSchema) as any, // Type assertion to avoid resolver errors
    defaultValues: {
      email: "",
      name: "",
      role: "user",
      active: true,
      companyId: undefined,
    },
  });

  const onSubmit = form.handleSubmit(async (values: FormValues) => {
    if (!session?.user) {
      toast.error("You must be logged in to create a user");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const supabase = createClient();
      
      // Insert new user invitation record
      const { data: invitation, error: inviteError } = await supabase
        .from("pending_users")
        .insert({
          email: values.email,
          role: values.role,
          status: "pending",
          tenant_id: values.companyId || null,
          tenant_role: values.role,
        })
        .select("id")
        .single();
      
      if (inviteError) {
        throw inviteError;
      }
      
      // Success!
      toast.success("User invitation sent successfully");
      form.reset();
      setOpen(false);
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Failed to add user");
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleCompanyChange = (companyId: string | undefined) => {
    form.setValue("companyId", companyId);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add User</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user and optionally assign to a company
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Email address for the user
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormDescription>
                    Full name of the user
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Role determines user permissions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="companyId"
              render={() => (
                <FormItem>
                  <FormLabel>Company (Optional)</FormLabel>
                  <FormControl>
                    <CompanySelect
                      selectedCompanyId={form.watch("companyId")}
                      onCompanyChange={handleCompanyChange}
                      placeholder="Select a company (optional)"
                    />
                  </FormControl>
                  <FormDescription>
                    Assign user to a company
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Active User
                    </FormLabel>
                    <FormDescription>
                      Inactive users cannot log in
                    </FormDescription>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding User...
                </>
              ) : (
                "Add User"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
