import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, XCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ValidationError {
  errors: string[];
  repeatedEmails: [string, string][];
  hasErrors: boolean;
}

interface CsvValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  validation: ValidationError;
}

export function CsvValidationDialog({ isOpen, onClose, validation }: CsvValidationDialogProps) {
  const { errors, repeatedEmails } = validation;

  // Group errors by type
  const emailErrors = errors.filter(error => error.includes('@'));
  const structureErrors = errors.filter(error => !error.includes('@') && !error.includes('Non-English'));
  const characterErrors = errors.filter(error => error.includes('Non-English'));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            CSV Validation Failed
          </DialogTitle>
          <DialogDescription className="pt-2">
            Please fix the following issues and try uploading again.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {/* Structure Errors */}
            {structureErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">CSV Structure Issues:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {structureErrors.map((error, i) => (
                      <li key={i} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Character Set Errors */}
            {characterErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Character Set Issues:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {characterErrors.map((error, i) => (
                      <li key={i} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Email Format Errors */}
            {emailErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Email Format Issues:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {emailErrors.map((error, i) => (
                      <li key={i} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Duplicate Emails */}
            {repeatedEmails.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Duplicate Emails Found:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {repeatedEmails.map(([email, lines], i) => (
                      <li key={i} className="text-sm">
                        {email} ({lines})
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}