"use client";

import { useState } from "react";
import { createDomain } from "../../lib/cloudflare-api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { Loader2, AlertCircle, CheckCircle2, Copy, AlertTriangle, Info } from "lucide-react";

interface AddDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDomainAdded?: (domain: any) => void;
}

export function AddDomainDialog({
  open,
  onOpenChange,
  onDomainAdded,
}: AddDomainDialogProps) {
  const [domainName, setDomainName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [originalNameservers, setOriginalNameservers] = useState<string[]>([]);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const resetForm = () => {
    setDomainName("");
    setError(null);
    setWarningMessage(null);
    setSuccess(false);
    setNameservers([]);
    setOriginalNameservers([]);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const copyNameservers = () => {
    const text = nameservers.join('\n');
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Nameservers copied to clipboard"))
      .catch(() => toast.error("Failed to copy nameservers"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!domainName.trim()) {
      setError("Domain name is required");
      return;
    }

    // Simple domain name validation
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    if (!domainRegex.test(domainName)) {
      setError("Please enter a valid domain name (e.g., example.com)");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setWarningMessage(null);
    
    try {
      const result = await createDomain(domainName);
      
      if (result.success) {
        setSuccess(true);
        setNameservers(result.nameservers || []);
        setOriginalNameservers(result.originalNameservers || []);
        
        // Check if there's a warning about fallback to mock data
        if (result.warning) {
          setWarningMessage(result.warning);
          console.warn("Domain added with warning:", result.warning);
          toast.warning("Domain added with warning - see details");
        } else {
          toast.success(`Domain ${domainName} added successfully`);
        }
        
        if (onDomainAdded) {
          onDomainAdded(result.domain);
        }
      } else {
        throw new Error(result.error || "Failed to add domain");
      }
    } catch (err: any) {
      console.error("Error adding domain:", err);
      setError(err.message || "Failed to add domain. Please try again.");
      toast.error(`Error adding domain: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Domain</DialogTitle>
          <DialogDescription>
            Add a new domain to your Cloudflare account. You'll need to set up the nameservers to complete the process.
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="domain-name" className="text-right">
                  Domain Name
                </Label>
                <Input
                  id="domain-name"
                  placeholder="example.com"
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  className="col-span-3"
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="ml-2">{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Domain...
                  </>
                ) : (
                  "Add Domain"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-4">
            <Alert className="mb-4 border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="ml-2 text-green-700">
                Domain {domainName} has been added successfully!
              </AlertDescription>
            </Alert>
            
            {/* Warning message for mock data or API fallback */}
            {warningMessage && (
              <Alert className="mb-4 border-amber-500 bg-amber-50">
                <Info className="h-4 w-4 text-amber-500" />
                <AlertDescription className="ml-2 text-amber-700">
                  {warningMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Additional information about Cloudflare permissions */}
            <Alert className="mb-4 border-blue-500 bg-blue-50">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertDescription className="ml-2 text-blue-700">
                <p>For Namecheap domains (ID: 1068), Cloudflare may require using their dashboard instead of API.</p>
                <p className="mt-1 text-xs">Consider using <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="underline">Cloudflare Dashboard</a> if you encounter permission issues.</p>
              </AlertDescription>
            </Alert>
            
            {/* Only show nameservers section for successful domain additions that don't have domain hold errors */}
            {(!warningMessage || !warningMessage.includes("hold")) && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Nameservers</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={copyNameservers}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  To complete the setup, please configure your domain with the following nameservers at your registrar:
                </p>
                <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                  <ul className="space-y-1">
                    {nameservers.length > 0 ? (
                      nameservers.map((ns, i) => (
                        <li key={i} className="text-sm font-mono">
                          {ns}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm font-mono text-muted-foreground">
                        No nameservers provided.
                      </li>
                    )}
                  </ul>
                </div>
                
                {/* Display original nameservers if available */}
                {originalNameservers.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Nameservers to Replace</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      The following nameservers are currently configured for your domain and should be replaced:
                    </p>
                    <div className="bg-rose-50 p-3 rounded-md border border-rose-200">
                      <ul className="space-y-1">
                        {originalNameservers.map((ns, i) => (
                          <li key={i} className="text-sm font-mono text-rose-700">
                            {ns}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                <Alert className="mt-4 border-yellow-500 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="ml-2 text-yellow-700">
                    DNS propagation may take up to 24-48 hours to complete after updating nameservers.
                  </AlertDescription>
                </Alert>
              </div>
            )}
            
            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                onClick={() => {
                  handleOpenChange(false);
                  resetForm();
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}