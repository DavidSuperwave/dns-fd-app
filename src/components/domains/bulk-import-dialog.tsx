"use client";

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Download, Upload, Eye, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ImportOptions {
  includeRedirects: boolean;
  includeDnsRecords: boolean;
  assignToUser?: string;
  filterByStatus: string[];
  filterByName?: string;
  limit: number;
}

interface PreviewDomain {
  name: string;
  status: string;
  paused: boolean;
  type: string;
  created_on: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ domain: string; error: string }>;
  domains: Array<{
    name: string;
    status: string;
    imported: boolean;
    redirectUrl?: string;
    dnsRecords?: number;
  }>;
}

interface BulkImportDialogProps {
  onImportComplete?: () => void;
}

export function BulkImportDialog({ onImportComplete }: BulkImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'options' | 'preview' | 'importing' | 'results'>('options');
  
  // Options state
  const [options, setOptions] = useState<ImportOptions>({
    includeRedirects: true,
    includeDnsRecords: false,
    filterByStatus: ['active'],
    limit: 50
  });

  // Preview state
  const [previewDomains, setPreviewDomains] = useState<PreviewDomain[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);

  // Import state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'initializing', label: 'Initializing' },
    { value: 'moved', label: 'Moved' },
    { value: 'deleted', label: 'Deleted' },
    { value: 'deactivated', label: 'Deactivated' }
  ];

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        preview: 'true',
        status: options.filterByStatus.join(','),
        limit: options.limit.toString()
      });

      if (options.filterByName) {
        params.append('name', options.filterByName);
      }

      const response = await fetch(`/api/cloudflare/bulk-import?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch preview');
      }

      setPreviewDomains(data.domains);
      setPreviewTotal(data.total);
      setCurrentStep('preview');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setIsLoading(true);
    setCurrentStep('importing');
    setImportProgress(0);

    try {
      // Simulate progress updates during import
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/cloudflare/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportResult(result);
      setCurrentStep('results');

      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} domains`);
        onImportComplete?.();
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
      setCurrentStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setCurrentStep('options');
    setPreviewDomains([]);
    setImportResult(null);
    setImportProgress(0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(resetDialog, 300); // Reset after animation
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Bulk Import from Cloudflare
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk Import Domains from Cloudflare
          </DialogTitle>
          <DialogDescription>
            Import multiple domains from your Cloudflare account with advanced filtering and options.
          </DialogDescription>
        </DialogHeader>

        {currentStep === 'options' && (
          <div className="space-y-6">
            {/* Filter Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Filter Options</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Domain Status</Label>
                  <Select
                    value={options.filterByStatus[0]}
                    onValueChange={(value) => setOptions(prev => ({ ...prev, filterByStatus: [value] }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limit">Import Limit</Label>
                  <Input
                    id="limit"
                    type="number"
                    min="1"
                    max="500"
                    value={options.limit}
                    onChange={(e) => setOptions(prev => ({ ...prev, limit: parseInt(e.target.value) || 50 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name-filter">Filter by Name (optional)</Label>
                <Input
                  id="name-filter"
                  placeholder="e.g., example.com or partial match"
                  value={options.filterByName || ''}
                  onChange={(e) => setOptions(prev => ({ ...prev, filterByName: e.target.value || undefined }))}
                />
              </div>
            </div>

            {/* Import Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Import Options</h3>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-redirects"
                    checked={options.includeRedirects}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeRedirects: !!checked }))}
                  />
                  <Label htmlFor="include-redirects">Include redirect URLs (page rules)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-dns"
                    checked={options.includeDnsRecords}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeDnsRecords: !!checked }))}
                  />
                  <Label htmlFor="include-dns">Fetch DNS records count (slower)</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-user">Assign to User (optional)</Label>
                <Input
                  id="assign-user"
                  placeholder="user@example.com"
                  value={options.assignToUser || ''}
                  onChange={(e) => setOptions(prev => ({ ...prev, assignToUser: e.target.value || undefined }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preview: {previewTotal} domains found</h3>
              <Badge variant="outline">{options.filterByStatus[0]} domains</Badge>
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-lg">
              <div className="space-y-2 p-4">
                {previewDomains.map((domain) => (
                  <div key={domain.name} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{domain.name}</div>
                      <div className="text-sm text-gray-500">
                        {domain.status} • {domain.type} • Created {new Date(domain.created_on).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={domain.paused ? "destructive" : "default"}>
                      {domain.paused ? "Paused" : "Active"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('options')}>
                Back to Options
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={isLoading || previewDomains.length === 0} className="gap-2">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import {previewDomains.length} Domains
                </Button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'importing' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              <h3 className="text-lg font-semibold">Importing Domains...</h3>
              <p className="text-gray-500">
                Processing {previewDomains.length} domains from Cloudflare
              </p>
            </div>
            
            <div className="space-y-2">
              <Progress value={importProgress} className="w-full" />
              <p className="text-sm text-gray-500">{importProgress}% complete</p>
            </div>
          </div>
        )}

        {currentStep === 'results' && importResult && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Import Results</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                <div className="text-sm text-gray-500">Imported</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-yellow-600 font-bold">S</span>
                </div>
                <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                <div className="text-sm text-gray-500">Skipped</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                <div className="text-sm text-gray-500">Errors</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-red-600">Errors:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                      <strong>{error.domain}:</strong> {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetDialog}>
                Import More
              </Button>
              <Button onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
