interface ScanProgress {
  current: number;
  total: number;
  percentage: number;
}

interface ScanResult {
  totalDomains: number;
  nonActiveDomains: { id: string; name: string; status: string; }[];
  statusBreakdown: { [key: string]: number };
  startTime?: string;
  endTime?: string;
  totalPages: number;
}

interface ScanResultData {
  success: boolean;
  timestamp: string;
  totalDomains: number;
  nonActiveDomains: number;
  progress: ScanProgress;
  error?: string;
}

// Create a new scan record in Supabase
export async function createScanRecord(): Promise<string | null> {
  try {
    const response = await fetch('/api/supabase/scan-records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Error creating scan record:', data.error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error in createScanRecord:', error);
    return null;
  }
}

// Update an existing scan record with progress
export async function updateScanRecord(
  scanId: string,
  progress: ScanProgress,
  result: ScanResult
): Promise<boolean> {
  try {
    const response = await fetch('/api/supabase/scan-records', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: scanId,
        total_domains: result.totalDomains,
        domains_needing_attention: result.nonActiveDomains.length,
        scan_result: {
          success: true,
          timestamp: new Date().toISOString(),
          totalDomains: result.totalDomains,
          nonActiveDomains: result.nonActiveDomains.length,
          progress
        },
        status_breakdown: result.statusBreakdown,
        non_active_domains: result.nonActiveDomains
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Error updating scan record:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateScanRecord:', error);
    return false;
  }
}

// Mark a scan as complete
export async function completeScanRecord(scanId: string, result: ScanResult): Promise<boolean> {
  try {
    const response = await fetch('/api/supabase/scan-records', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: scanId,
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_domains: result.totalDomains,
        domains_needing_attention: result.nonActiveDomains.length,
        scan_result: {
          success: true,
          timestamp: new Date().toISOString(),
          totalDomains: result.totalDomains,
          nonActiveDomains: result.nonActiveDomains.length,
          progress: { current: result.totalPages, total: result.totalPages, percentage: 100 }
        },
        status_breakdown: result.statusBreakdown,
        non_active_domains: result.nonActiveDomains,
        scan_duration_ms: Date.now() - new Date(result.startTime || Date.now()).getTime()
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Error completing scan record:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in completeScanRecord:', error);
    return false;
  }
}

// Mark a scan as failed
export async function failScanRecord(scanId: string, reason: string): Promise<boolean> {
  try {
    const response = await fetch('/api/supabase/scan-records', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: scanId,
        status: 'failed',
        completed_at: new Date().toISOString(),
        scan_result: {
          success: false,
          timestamp: new Date().toISOString(),
          error: reason
        }
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Error marking scan as failed:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in failScanRecord:', error);
    return false;
  }
}

// Get the latest completed scan
export async function getLatestScan(): Promise<ScanResultData | null> {
  try {
    const response = await fetch('/api/supabase/scan-records');
    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Error fetching latest scan:', data.error);
      return null;
    }

    return data.data;
  } catch (error) {
    console.error('Error in getLatestScan:', error);
    return null;
  }
}