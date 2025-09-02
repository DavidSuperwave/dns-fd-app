"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useAuth } from "@/components/auth/auth-provider";

// Form schema for company creation
const companySchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  description: z.string().optional(),
  website: z.string().url({ message: "Please enter a valid website URL." }).optional().or(z.literal('')),
  logoUrl: z.string().url({ message: "Please enter a valid logo URL." }).optional().or(z.literal('')),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export function AddCompanyForm({ onSuccess }: { onSuccess?: () => void }) {
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize form with react-hook-form
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      logoUrl: "",
    },
  });

  // Handle form submission
  const onSubmit: SubmitHandler<CompanyFormValues> = async (data) => {
    if (!session?.user) {
      toast.error("You must be logged in to create a company");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const supabase = createClient();
      
      // Insert new company record
      const { data: company, error } = await supabase
        .from("companies")
        .insert({
          name: data.name,
          description: data.description || null,
          website: data.website || null,
          logo_url: data.logoUrl || null,
        })
        .select("id")
        .single();
      
      if (error) {
        throw error;
      }
      
      // Success!
      toast.success("Company added successfully");
      form.reset();
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error adding company:", error);
      toast.error(error.message || "Failed to add company");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corporation" {...field} />
              </FormControl>
              <FormDescription>
                Name of the company to be added to the system
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Brief description of the company" 
                  className="resize-none"
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                A short description of the company
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input placeholder="https://company.com" {...field} />
              </FormControl>
              <FormDescription>
                Company website URL (optional).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input 
                  type="text" 
                  placeholder="https://company.com/logo.png"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                URL for company logo image (optional).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Company...
            </>
          ) : (
            "Add Company"
          )}
        </Button>
      </form>
    </Form>
  );
}
