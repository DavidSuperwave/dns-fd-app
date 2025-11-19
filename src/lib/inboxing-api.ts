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

