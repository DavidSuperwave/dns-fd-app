"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddCompanyForm } from "./add-company-form";

export function AddCompanyDialog() {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    // Close the dialog after successful submission
    setOpen(false);
    // You might want to refresh the company list here
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Company</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <DialogDescription>
            Create a new company record. Companies can have multiple users with different roles.
          </DialogDescription>
        </DialogHeader>
        <AddCompanyForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
