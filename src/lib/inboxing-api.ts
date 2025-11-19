const INBOXING_BASE_URL = 'https://app.inboxing.com/api/v1';
const DEFAULT_PAGE_SIZE = 100;

export class InboxingApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type InboxingDomainRecord = {
  id: number;
  domain_name: string;
  status: string;
  user_id?: number | null;
  admin_email?: string | null;
  display_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  tenant_info?: {
    primary_domain?: string | null;
    tenant_id?: string | null;
    domain_limit?: number | null;
    status?: string | null;
  } | null;
  cloudflare_info?: {
    email?: string | null;
    account_id?: string | null;
  } | null;
};

type InboxingPagination = {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
  prev_num: number | null;
  next_num: number | null;
};

type InboxingDomainsResponse = {
  status: string;
  data?: {
    domains?: InboxingDomainRecord[];
    pagination?: InboxingPagination;
    search_term?: string | null;
  };
  error?: string;
};

function getApiKey(): string {
  const key = process.env.INBOXING_API_KEY;
  if (!key) {
    throw new InboxingApiError('INBOXING_API_KEY is not configured', 500);
  }
  return key;
}

export async function fetchInboxingDomainsPage({
  page = 1,
  perPage = DEFAULT_PAGE_SIZE,
  search,
}: {
  page?: number;
  perPage?: number;
  search?: string | null;
}): Promise<InboxingDomainsResponse> {
  const apiKey = getApiKey();
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('per_page', String(perPage));
  if (search && search.trim().length > 0) {
    params.set('search', search.trim());
  }

  const response = await fetch(`${INBOXING_BASE_URL}/domains?${params.toString()}`, {
    headers: {
      'X-API-Key': apiKey,
    },
    cache: 'no-store',
  });

  const payload: InboxingDomainsResponse = await response.json();

  if (!response.ok) {
    throw new InboxingApiError(payload?.error || 'Failed to fetch Inboxing domains', response.status);
  }

  return payload;
}

export async function fetchAllInboxingDomains(options?: { search?: string | null }): Promise<InboxingDomainRecord[]> {
  const perPage = DEFAULT_PAGE_SIZE;
  let currentPage = 1;
  const aggregated: InboxingDomainRecord[] = [];
  const seenPages = new Set<number>();

  while (true) {
    if (seenPages.has(currentPage)) {
      throw new InboxingApiError('Detected pagination loop while fetching Inboxing domains', 500);
    }
    seenPages.add(currentPage);

    const payload = await fetchInboxingDomainsPage({
      page: currentPage,
      perPage,
      search: options?.search,
    });

    const domains = payload?.data?.domains ?? [];
    aggregated.push(...domains);

    const pagination = payload?.data?.pagination;
    if (!pagination?.has_next) {
      break;
    }
    currentPage = pagination.next_num ?? currentPage + 1;
  }

  return aggregated;
}

export type DomainSetupMode = 'single_name' | 'multiple_names' | 'csv_upload';

export type DomainSetupPayload = {
  job_type: 'DOMAIN_SETUP';
  domain_name?: string; // Required for single_name and csv_upload (as identifier)
  redirect_url?: string;
  first_name?: string;
  last_name?: string;

  // Multiple names mode
  multiple_names_mode?: boolean;
  name_pairs?: Array<{ first_name: string; last_name: string }>;

  // CSV upload mode
  csv_upload_mode?: boolean;
  csv_file?: File;

  // Common optional
  admin_email?: string;
  user_count?: 25 | 49 | 99;
  password_base_word?: string;
};

export type DomainJobResponse = {
  status: string;
  data?: {
    message: string;
    job_id: number;
    task_id: string;
  };
  error?: string;
};

export type DomainSlotsResponse = {
  status: string;
  data?: {
    total_slots: number;
    used_slots: number;
    pending_slots: number;
    committed_slots: number;
    available_slots: number;
    user_id: number;
    username: string;
  };
  error?: string;
};

export async function createDomainSetupJob(payload: DomainSetupPayload): Promise<DomainJobResponse> {
  const apiKey = getApiKey();

  let body: FormData | string;
  const headers: Record<string, string> = {
    'X-API-Key': apiKey,
  };

  if (payload.csv_upload_mode && payload.csv_file) {
    const formData = new FormData();
    formData.append('job_type', 'DOMAIN_SETUP');
    formData.append('csv_upload_mode', 'true');
    if (payload.domain_name) formData.append('domain_name', payload.domain_name);
    if (payload.redirect_url) formData.append('redirect_url', payload.redirect_url);
    if (payload.admin_email) formData.append('admin_email', payload.admin_email);
    if (payload.user_count) formData.append('user_count', String(payload.user_count));
    if (payload.password_base_word) formData.append('password_base_word', payload.password_base_word);
    formData.append('csv_file', payload.csv_file);

    body = formData;
    // Content-Type header is automatically set by browser/fetch for FormData
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload);
  }

  const response = await fetch(`${INBOXING_BASE_URL}/jobs`, {
    method: 'POST',
    headers,
    body,
  });

  const data: DomainJobResponse = await response.json();

  if (!response.ok) {
    throw new InboxingApiError(data.error || 'Failed to create domain setup job', response.status);
  }

  return data;
}

export async function deleteDomain(domainName: string): Promise<DomainJobResponse> {
  const apiKey = getApiKey();

  const response = await fetch(`${INBOXING_BASE_URL}/jobs`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      job_type: 'DOMAIN_DELETE',
      domain_name: domainName,
    }),
  });

  const data: DomainJobResponse = await response.json();

  if (!response.ok) {
    throw new InboxingApiError(data.error || 'Failed to delete domain', response.status);
  }

  return data;
}

export async function getDomainSlots(): Promise<DomainSlotsResponse> {
  const apiKey = getApiKey();

  const response = await fetch(`${INBOXING_BASE_URL}/users/me/domain-slots`, {
    headers: {
      'X-API-Key': apiKey,
      'Cache-Control': 'no-cache',
    },
  });

  const data: DomainSlotsResponse = await response.json();

  if (!response.ok) {
    throw new InboxingApiError(data.error || 'Failed to fetch domain slots', response.status);
  }

  return data;
}
