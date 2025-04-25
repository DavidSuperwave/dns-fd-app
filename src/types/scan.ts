// Basic progress tracking interface
export interface ProgressTracker {
  current: number;
  total: number;
  percentage: number;
  startTime: number;
}

// Database scan progress interface
export interface ScanProgress extends ProgressTracker {
  status: 'initializing' | 'fetching' | 'processing' | 'completed' | 'failed';
  domains_processed: number;
  total_domains: number | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  is_active: boolean;
  error_message: string | null;
}

// Scan result interface
export interface ScanResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at: string;
  completed_at: string | null;
  updated_at: string | null;
  total_domains: number;
  domains_needing_attention: number;
  scan_duration_ms: number;
  status_breakdown: Record<string, number>;
  scan_result?: {
    progress?: ProgressTracker;
    error?: string;
  };
}

// Database response type
export interface ScanData {
  data: ScanResult | null;
  error: Error | null;
}

// Error type for better type safety
export interface Error {
  message: string;
  code?: string;
  details?: string;
}