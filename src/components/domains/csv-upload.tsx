'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase, supabaseAdmin } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { FileIcon, Loader2 } from 'lucide-react';

interface CSVFile {
  name: string;
  created_at: string;
  url: string;
}

interface CSVUploadProps {
  domainId: string;
  domainName: string;
  hasFiles: boolean;
  userId?: string;
}

export function CSVUpload({ domainId, domainName, hasFiles: initialHasFiles }: CSVUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [files, setFiles] = useState<CSVFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFiles, setHasFiles] = useState(initialHasFiles);

  // Load existing files for this domain
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabaseAdmin.storage
        .from('domain-csv-files')
        .list(domainId);

      if (error) throw error;

      const filesWithUrls = await Promise.all((data || []).map(async (file) => {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('domain-csv-files')
          .getPublicUrl(`${domainId}/${file.name}`);

        return {
          name: file.name,
          created_at: file.created_at,
          url: publicUrl
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
  };

  useEffect(() => {
    if (isDialogOpen) {
      loadFiles();
    }
  }, [isDialogOpen, domainId]);

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
      // Upload file to Supabase Storage
      const fileName = `${Date.now()}.csv`;
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
      console.error('Upload error:', error);
      toast.error('Failed to upload CSV file');
    } finally {
      setIsUploading(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{domainName} - CSV Files</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
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
                      className="flex items-center justify-between p-2 rounded-md border"
                    >
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-blue-500" />
                        <div>
                          <div className="text-sm font-medium">{file.name}</div>
                          <div className="text-xs text-gray-500">
                            {formatDate(file.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            View
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file.name)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}