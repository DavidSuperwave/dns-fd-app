'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase, supabaseAdmin } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { FileIcon, Loader2, Download } from 'lucide-react';
import { validateCsvContent } from '@/lib/csv-validator';
import { CsvValidationDialog } from './csv-validation-dialog';

interface CSVFile {
  name: string;
  downloadUrl: string;
}

interface CSVUploadProps {
  domainId: string;
  domainName: string;
  hasFiles: boolean;
  userId?: string;
}

export function CSVUpload({ domainId, domainName, hasFiles: initialHasFiles }: CSVUploadProps) {
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    errors: string[];
    repeatedEmails: [string, string][];
    hasErrors: boolean;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [files, setFiles] = useState<CSVFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFiles, setHasFiles] = useState(initialHasFiles);

  // Memoize loadFiles function to keep it stable between renders
  const loadFiles = useCallback(async () => {
    console.log('[loadFiles] Starting...'); // Added log
    setIsLoading(true);
    try {
      console.log('[loadFiles] Fetching file list for domain:', domainId); // Added log
      const { data, error } = await supabaseAdmin.storage
        .from('domain-csv-files')
        .list(domainId);

      if (error) {
        console.error('[loadFiles] Error listing files:', error); // Added log
        throw error;
      }
      console.log('[loadFiles] File list fetched:', data); // Added log

      // Filter out system files and only include CSVs
      const csvFiles = (data || []).filter(file =>
        !file.name.includes('.emptyFolderPlaceholder') &&
        file.name.endsWith('.csv')
      );

      console.log('[loadFiles] Generating signed URLs for', csvFiles.length, 'files...'); // Added log
      const filesWithUrls = await Promise.all(csvFiles.map(async (file) => {
        const filePath = `${domainId}/${file.name}`;
        
        // Get signed URL for downloading
        console.log('[loadFiles] Getting signed URL for:', filePath); // Added log
        const { data, error: signedUrlError } = await supabaseAdmin.storage
          .from('domain-csv-files')
          .createSignedUrl(filePath, 60); // URL valid for 60 seconds

        if (signedUrlError) {
          console.error('[loadFiles] Error getting signed URL for', filePath, ':', signedUrlError); // Added log
          throw signedUrlError;
        }
        if (!data || !data.signedUrl) {
          console.error('[loadFiles] Failed to generate signed URL data for', filePath); // Added log
          throw new Error(`Failed to generate signed URL for ${filePath}`);
        }

        const signedUrl = data.signedUrl;
        console.log('[loadFiles] Signed URL generated for:', filePath); // Added log

        return {
          name: file.name,
          downloadUrl: signedUrl
        };
      }));
      console.log('[loadFiles] Signed URLs generated.'); // Added log

      setFiles(filesWithUrls);
      console.log('[loadFiles] Files state updated.'); // Added log
      
      // Update has_files in database if it doesn't match reality
      const hasAnyFiles = filesWithUrls.length > 0;
      if (hasAnyFiles !== hasFiles) {
        console.log('[loadFiles] Checking if has_files update needed. Current:', hasFiles, 'Actual:', hasAnyFiles); // Added log
        const { error: updateError } = await supabaseAdmin
          .from('domains')
          .update({ has_files: hasAnyFiles })
          .eq('id', domainId);

        if (updateError) {
          console.error('[loadFiles] Error updating has_files flag:', updateError); // Added log
          throw updateError;
        }
        setHasFiles(hasAnyFiles);
        console.log('[loadFiles] has_files state updated.'); // Added log
      }
    } catch (error) {
      console.error('[loadFiles] Error caught in loadFiles:', error); // Modified log
      toast.error('Failed to load files');
    } finally {
      console.log('[loadFiles] Setting isLoading to false.'); // Added log
      setIsLoading(false);
    }
  }, [domainId, hasFiles]); // Include all dependencies

  // Load files when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      console.log('[useEffect] Dialog opened, calling loadFiles.'); // Added log
      loadFiles();
    } else {
      console.log('[useEffect] Dialog closed.'); // Added log
    }
  }, [isDialogOpen, loadFiles]); // loadFiles is now stable

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('--- handleFileChange FUNCTION ENTERED ---'); // Log 1
    const file = e.target.files?.[0];
    console.log('[handleFileChange] File selected:', file?.name); // Log 2
    if (!file) {
      console.log('[handleFileChange] No file selected.'); // Added log
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      console.log('[handleFileChange] Invalid file type:', file.name); // Added log
      toast.error('Please select a CSV file');
      return;
    }

    // Set uploading state *immediately* after confirming a valid file
    setIsUploading(true);
    console.log('[handleFileChange] Set isUploading=true'); // Log 3

    try {
      // Read and validate file content
      console.log('[handleFileChange] Reading file content...'); // Log 4
      const content = await file.text();
      console.log('[handleFileChange] File content read. Validating...'); // Log 5
      const validation = await validateCsvContent(content);
      console.log('[handleFileChange] Validation result:', validation); // Log 6

      if (validation.hasErrors) {
        console.log('[handleFileChange] Validation failed. Showing dialog.'); // Log 7a
        setValidationErrors(validation);
        setShowValidationDialog(true);
        // No need to set isUploading false here, finally block handles it
        return; // Exit early
      }
      console.log('[handleFileChange] Validation successful.'); // Log 7b

      // Create filename with timestamp and unique ID
      const now = new Date();
      // Format as MMDDYYYY_HHMM
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timestamp = `${month}${day}${year}_${hours}${minutes}`;
      const uniqueId = Date.now();
      const fileName = `${timestamp}_${uniqueId}.csv`;
      const filePath = `${domainId}/${fileName}`;
      console.log('[handleFileChange] Generated filename:', fileName); // Log 8

      // Upload file to storage
      console.log('[handleFileChange] Uploading file to Supabase storage:', filePath); // Log 9
      const { error: uploadError } = await supabaseAdmin.storage
        .from('domain-csv-files')
        .upload(filePath, file);

      if (uploadError) {
        console.error('[handleFileChange] Supabase upload error:', uploadError); // Log 10a
        throw uploadError;
      }
      console.log('[handleFileChange] File uploaded successfully.'); // Log 10b

      // Update has_files flag
      console.log('[handleFileChange] Updating has_files flag in database...'); // Log 11
      const { error: updateError } = await supabaseAdmin
        .from('domains')
        .update({ has_files: true })
        .eq('id', domainId);

      if (updateError) {
        console.error('[handleFileChange] Error updating has_files flag:', updateError); // Log 12a
        throw updateError;
      }
      console.log('[handleFileChange] has_files flag updated.'); // Log 12b

      setHasFiles(true);
      toast.success('CSV file uploaded successfully');
      console.log('[handleFileChange] Calling loadFiles to refresh list...'); // Log 13
      await loadFiles(); // Refresh file list
      console.log('[handleFileChange] loadFiles finished.'); // Log 14
    } catch (error) {
      console.error('[handleFileChange] Error caught during file processing:', error); // Log 15 (Error path)
      toast.error(error instanceof Error ? error.message : 'Failed to process CSV file');
    } finally {
      console.log('[handleFileChange] Entering finally block.'); // Log 16 (Always runs)
      setIsUploading(false);
      console.log('[handleFileChange] Set isUploading=false in finally.'); // Log 17 (Always runs)
      // Reset validation state only if it wasn't set due to errors
      if (!validationErrors && showValidationDialog) {
         // If validation dialog was shown due to error, don't reset here
         // It will be reset when the dialog is closed by the user
         console.log('[handleFileChange] Skipping validation reset in finally (dialog shown).'); // Log 18a
      } else {
         setValidationErrors(null);
         setShowValidationDialog(false);
         console.log('[handleFileChange] Reset validation state in finally.'); // Log 18b
      }
      // Clear the file input value so the same file can be selected again if needed
      if (e.target) {
        e.target.value = '';
        console.log('[handleFileChange] Cleared file input value.'); // Log 19
      }
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      const { error: deleteError } = await supabaseAdmin.storage
        .from('domain-csv-files')
        .remove([`${domainId}/${fileName}`]);

      if (deleteError) throw deleteError;

      await loadFiles(); // This will also update has_files if needed
      toast.success('File deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete file');
    }
  };

  const formatFileName = (fileName: string) => {
    // Extract timestamp from filename (MMDDYYYY_HHMM_uniqueId.csv)
    const match = fileName.match(/^(\d{2})(\d{2})(\d{4})_(\d{2})(\d{2})_/);
    if (match) {
      const [_, month, day, year, hour, minute] = match;
      
      // Create Date object in UTC
      const utcDate = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1, // JS months are 0-based
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      ));

      // Format in local timezone
      return utcDate.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
    return fileName;
  };

  return (
    <>
      {/* Validation Error Dialog */}
      {validationErrors && (
        <CsvValidationDialog
          isOpen={showValidationDialog}
          onClose={() => {
            setShowValidationDialog(false);
            setValidationErrors(null);
          }}
          validation={validationErrors}
        />
      )}
      <input
        type="file"
        accept="text/csv,.csv"
        onChange={handleFileChange}
        className="hidden"
        id={`csv-upload-${domainId}`}
      />
      
      {!hasFiles ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById(`csv-upload-${domainId}`)?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            'Upload CSV'
          )}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsDialogOpen(true)}
        >
          Open Files
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">{domainName} - CSV Files</DialogTitle>
          </DialogHeader>
          
          <div className="py-6">
            {isLoading ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="mt-2 text-sm text-gray-500">Loading files...</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between p-4 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-blue-50">
                          <FileIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{formatFileName(file.name)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            asChild
                          >
                            <a
                              href={file.downloadUrl}
                              download={file.name}
                              className="flex items-center gap-2"
                            >
                              <Download className="h-4 w-4" />
                              <span>Download</span>
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(file.name)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 border-t pt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      console.log('--- "Upload New CSV" button onClick HANDLER ENTERED ---'); // Button Log 6
                      const fileInput = document.getElementById(`csv-upload-${domainId}`);
                      console.log('[CSVUpload] Found file input element (dialog):', fileInput); // Button Log 7
                      if (fileInput) {
                        console.log('[CSVUpload] Triggering click on file input (dialog).'); // Button Log 8
                        fileInput.click();
                      } else {
                        console.error('[CSVUpload] Could not find file input element (dialog)!'); // Button Log 9 (Error)
                      }
                    }}
                    disabled={isUploading}
                  >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload New CSV'
                  )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}