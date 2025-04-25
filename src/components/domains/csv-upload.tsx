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
    setIsLoading(true);
    try {
      const { data, error } = await supabaseAdmin.storage
        .from('domain-csv-files')
        .list(domainId);

      if (error) throw error;

      // Filter out system files and only include CSVs
      const csvFiles = (data || []).filter(file =>
        !file.name.includes('.emptyFolderPlaceholder') &&
        file.name.endsWith('.csv')
      );

      const filesWithUrls = await Promise.all(csvFiles.map(async (file) => {
        const filePath = `${domainId}/${file.name}`;
        
        // Get signed URL for downloading
        const { data: { signedUrl }, error: signedUrlError } = await supabaseAdmin.storage
          .from('domain-csv-files')
          .createSignedUrl(filePath, 60); // URL valid for 60 seconds

        if (signedUrlError) throw signedUrlError;

        return {
          name: file.name,
          downloadUrl: signedUrl
        };
      }));

      setFiles(filesWithUrls);
      
      // Update has_files in database if it doesn't match reality
      const hasAnyFiles = filesWithUrls.length > 0;
      if (hasAnyFiles !== hasFiles) {
        const { error: updateError } = await supabaseAdmin
          .from('domains')
          .update({ has_files: hasAnyFiles })
          .eq('id', domainId);

        if (updateError) throw updateError;
        setHasFiles(hasAnyFiles);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, [domainId, hasFiles]); // Include all dependencies

  // Load files when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      loadFiles();
    }
  }, [isDialogOpen, loadFiles]); // loadFiles is now stable

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setIsUploading(true);

    try {
      // Read and validate file content
      const content = await file.text();
      const validation = await validateCsvContent(content);

      if (validation.hasErrors) {
        setValidationErrors(validation);
        setShowValidationDialog(true);
        return;
      }

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

      // Upload file to storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('domain-csv-files')
        .upload(`${domainId}/${fileName}`, file);

      if (uploadError) throw uploadError;

      // Update has_files flag
      const { error: updateError } = await supabaseAdmin
        .from('domains')
        .update({ has_files: true })
        .eq('id', domainId);

      if (updateError) throw updateError;

      setHasFiles(true);
      toast.success('CSV file uploaded successfully');
      await loadFiles(); // Refresh file list
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process CSV file');
    } finally {
      setIsUploading(false);
      setValidationErrors(null);
      setShowValidationDialog(false);
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
        accept=".csv"
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
                    onClick={() => document.getElementById(`csv-upload-${domainId}`)?.click()}
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