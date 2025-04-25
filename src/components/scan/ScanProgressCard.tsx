import React from 'react';
import { useScanProgress } from '@/hooks/useScanProgress';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  CheckCircle2,
  Clock, 
  Database, 
  Loader2, 
  // Removed unused RefreshCw
} from 'lucide-react';

// Define props interface
interface ScanProgressCardProps {
  onManualSyncClick: () => Promise<void>;
}

export function ScanProgressCard(_props: ScanProgressCardProps) { // Rename to _props
  const {
    activeScan, 
    isLoading, 
    error, 
    progressPercentage, 
    elapsedTime,
    // Removed unused refreshData
  } = useScanProgress();
  
  // Format the date to be more readable
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Get scan status icon based on status
  const getScanStatusIcon = () => {
    if (!activeScan) return null;
    
    switch (activeScan.status) {
      case 'initializing':
      case 'fetching':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };
  
  // Get status text with appropriate color
  const getStatusText = () => {
    if (!activeScan) return null;
    
    const statusMap = {
      'initializing': { text: 'Initializing', class: 'text-blue-500' },
      'fetching': { text: 'Fetching Data', class: 'text-blue-500' },
      'processing': { text: 'Processing', class: 'text-blue-500' },
      'completed': { text: 'Completed', class: 'text-green-500' },
      'failed': { text: 'Failed', class: 'text-red-500' }
    };
    
    const status = statusMap[activeScan.status] || { text: activeScan.status, class: 'text-gray-500' };
    
    return (
      <span className={`flex items-center gap-1.5 font-medium ${status.class}`}>
        {getScanStatusIcon()}
        {status.text}
      </span>
    );
  };
  
  // Removed unused handleManualSyncClick function

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Current Scan Status</CardTitle>
          <CardDescription>Live scan progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div>
          <CardTitle>Current Scan Status</CardTitle>
          <CardDescription>Live scan progress</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        ) : null}
        
        {activeScan ? (
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                {getStatusText()}
              </div>
              <div className="text-sm text-gray-500">
                <Clock className="h-4 w-4 inline mr-1" />
                {elapsedTime}
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1 text-sm">
                <span>Progress</span>
                <span className="font-medium">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-xs text-gray-500 mb-1">Pages</div>
                <div className="text-lg font-semibold">
                  {activeScan.current_page} / {activeScan.total_pages || '?'}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-xs text-gray-500 mb-1">Domains</div>
                <div className="text-lg font-semibold">
                  {activeScan.domains_processed} / {activeScan.total_domains || '?'}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 mb-1">Details</div>
            <div className="text-xs rounded-md border p-2 bg-gray-50">
              <div className="mb-1"><strong>Scan ID:</strong> {activeScan.scan_id}</div>
              <div className="mb-1"><strong>Started:</strong> {formatDate(activeScan.started_at)}</div>
              <div className="mb-1"><strong>Last Updated:</strong> {formatDate(activeScan.updated_at)}</div>
              {activeScan.error_message && (
                <div className="mb-1 text-red-600">
                  <strong>Error:</strong> {activeScan.error_message}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-gray-400">
              <Database className="h-12 w-12 mx-auto mb-2" />
              <p>No active scan in progress</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}