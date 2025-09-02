"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function MigrateTenantSchemaButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleMigration = async () => {
    if (
      !confirm(
        "Are you sure you want to migrate the database schema to support the company model? This operation cannot be undone."
      )
    ) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/migrate-tenant-schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Migration failed");
      }

      toast.success("Database schema migration completed successfully");
    } catch (error: any) {
      console.error("Migration error:", error);
      toast.error(error.message || "Failed to migrate schema");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleMigration} disabled={isLoading} variant="outline">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Migrating...
        </>
      ) : (
        "Migrate Database Schema"
      )}
    </Button>
  );
}
